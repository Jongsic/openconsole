import {
  AuthorizeSecurityGroupEgressCommand,
  AuthorizeSecurityGroupIngressCommand,
  CreateKeyPairCommand,
  CreateSecurityGroupCommand,
  CreateTagsCommand,
  DeleteTagsCommand,
  DescribeInstanceAttributeCommand,
  DescribeInstancesCommand,
  DescribeKeyPairsCommand,
  DescribeLaunchTemplatesCommand,
  DescribeLaunchTemplateVersionsCommand,
  DescribeSecurityGroupsCommand,
  DescribeSubnetsCommand,
  DescribeVolumesCommand,
  EC2Client,
  ImportKeyPairCommand,
  ModifyInstanceAttributeCommand,
  RevokeSecurityGroupIngressCommand,
  RunInstancesCommand,
  StartInstancesCommand,
  StopInstancesCommand,
  TerminateInstancesCommand,
} from "@aws-sdk/client-ec2";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./ec2-api";

// mockClient intercepts the SDK at the client layer, so it works regardless of
// the module-level client cache in ec2-client.ts. These tests exercise the
// response→our-type mapping (and command-input shape) entirely offline.
const ec2 = mockClient(EC2Client);

beforeEach(() => ec2.reset());

describe("listInstances mapping", () => {
  it("maps reservations/instances and resolves the Name tag", async () => {
    ec2.on(DescribeInstancesCommand).resolves({
      Reservations: [
        {
          Instances: [
            {
              InstanceId: "i-1",
              InstanceType: "t3.micro",
              State: { Name: "running" },
              Placement: { AvailabilityZone: "us-east-1a" },
              PublicIpAddress: "1.2.3.4",
              PrivateIpAddress: "10.0.0.5",
              LaunchTime: new Date("2024-01-01T00:00:00Z"),
              Tags: [
                { Key: "Env", Value: "prod" },
                { Key: "Name", Value: "web" },
              ],
            },
          ],
        },
      ],
    });
    const r = await api.listInstances();
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({
      instanceId: "i-1",
      name: "web",
      instanceType: "t3.micro",
      state: "running",
      availabilityZone: "us-east-1a",
      publicIp: "1.2.3.4",
      privateIp: "10.0.0.5",
      launchTime: "2024-01-01T00:00:00.000Z",
    });
  });

  it("defaults name to null and state to pending when absent", async () => {
    ec2.on(DescribeInstancesCommand).resolves({
      Reservations: [{ Instances: [{ InstanceId: "i-2" }] }],
    });
    const r = await api.listInstances();
    expect(r[0]).toMatchObject({ instanceId: "i-2", name: null, state: "pending" });
  });

  it("returns [] for an empty response (null-check regression)", async () => {
    ec2.on(DescribeInstancesCommand).resolves({});
    await expect(api.listInstances()).resolves.toEqual([]);
  });
});

describe("getInstanceDetail mapping", () => {
  it("merges instance-level + ENI security groups, deduped", async () => {
    ec2.on(DescribeInstancesCommand).resolves({
      Reservations: [
        {
          Instances: [
            {
              InstanceId: "i-9",
              State: { Name: "running" },
              SecurityGroups: [{ GroupId: "sg-1", GroupName: "top" }],
              NetworkInterfaces: [
                {
                  NetworkInterfaceId: "eni-1",
                  Status: "in-use",
                  PrivateIpAddress: "10.0.0.1",
                  Groups: [
                    { GroupId: "sg-1", GroupName: "top" }, // dup → ignored
                    { GroupId: "sg-2", GroupName: "eni-only" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    });
    const d = await api.getInstanceDetail("i-9");
    expect(d.securityGroups).toEqual([
      { groupId: "sg-1", groupName: "top" },
      { groupId: "sg-2", groupName: "eni-only" },
    ]);
    expect(d.networkInterfaces[0]).toMatchObject({
      networkInterfaceId: "eni-1",
      status: "in-use",
      privateIp: "10.0.0.1",
    });
  });

  it("prefers PlatformDetails over Platform", async () => {
    ec2.on(DescribeInstancesCommand).resolves({
      Reservations: [
        {
          Instances: [
            { InstanceId: "i-x", State: { Name: "running" }, PlatformDetails: "Linux/UNIX" },
          ],
        },
      ],
    });
    const d = await api.getInstanceDetail("i-x");
    expect(d.platform).toBe("Linux/UNIX");
  });

  it("throws when the instance is not found", async () => {
    ec2.on(DescribeInstancesCommand).resolves({ Reservations: [] });
    await expect(api.getInstanceDetail("i-missing")).rejects.toThrow(/not found/);
  });
});

describe("listSecurityGroups mapping", () => {
  it("flattens IpPermissions into one row per CIDR / group / ipv6", async () => {
    ec2.on(DescribeSecurityGroupsCommand).resolves({
      SecurityGroups: [
        {
          GroupId: "sg-1",
          GroupName: "web",
          Description: "web tier",
          VpcId: "vpc-1",
          IpPermissions: [
            {
              IpProtocol: "tcp",
              FromPort: 80,
              ToPort: 80,
              IpRanges: [{ CidrIp: "0.0.0.0/0" }],
              Ipv6Ranges: [{ CidrIpv6: "::/0" }],
              UserIdGroupPairs: [{ GroupId: "sg-2" }],
            },
          ],
          IpPermissionsEgress: [{ IpProtocol: "-1" }],
        },
      ],
    });
    const r = await api.listSecurityGroups();
    expect(r[0]?.inbound).toEqual([
      { protocol: "tcp", fromPort: 80, toPort: 80, source: "0.0.0.0/0" },
      { protocol: "tcp", fromPort: 80, toPort: 80, source: "::/0" },
      { protocol: "tcp", fromPort: 80, toPort: 80, source: "sg-2" },
    ]);
    // No source → placeholder row with null ports
    expect(r[0]?.outbound).toEqual([{ protocol: "-1", fromPort: null, toPort: null, source: "—" }]);
  });

  it("returns [] on empty response", async () => {
    ec2.on(DescribeSecurityGroupsCommand).resolves({});
    await expect(api.listSecurityGroups()).resolves.toEqual([]);
  });

  it("getSecurityGroups short-circuits without a call when ids empty", async () => {
    await expect(api.getSecurityGroups([])).resolves.toEqual([]);
    expect(ec2.commandCalls(DescribeSecurityGroupsCommand)).toHaveLength(0);
  });
});

describe("volume mapping", () => {
  it("getVolumes picks attachment matching the instance", async () => {
    ec2.on(DescribeVolumesCommand).resolves({
      Volumes: [
        {
          VolumeId: "vol-1",
          Size: 8,
          VolumeType: "gp3",
          Iops: 3000,
          Throughput: 125,
          Encrypted: true,
          State: "in-use",
          Attachments: [
            { InstanceId: "i-other", Device: "/dev/xvdb" },
            {
              InstanceId: "i-1",
              Device: "/dev/xvda",
              DeleteOnTermination: true,
              State: "attached",
            },
          ],
        },
      ],
    });
    const r = await api.getVolumes("i-1");
    expect(r[0]).toMatchObject({
      volumeId: "vol-1",
      deviceName: "/dev/xvda",
      deleteOnTermination: true,
      attachState: "attached",
    });
  });

  it("listVolumes maps attachments + createTime; [] when empty", async () => {
    ec2.on(DescribeVolumesCommand).resolves({
      Volumes: [
        {
          VolumeId: "vol-2",
          Size: 20,
          CreateTime: new Date("2024-02-02T00:00:00Z"),
          Attachments: [{ InstanceId: "i-7", Device: "/dev/sda1", State: "attached" }],
        },
      ],
    });
    const r = await api.listVolumes();
    expect(r[0]).toMatchObject({
      volumeId: "vol-2",
      size: 20,
      encrypted: false,
      createTime: "2024-02-02T00:00:00.000Z",
      attachments: [{ instanceId: "i-7", device: "/dev/sda1", state: "attached" }],
    });

    ec2.reset();
    ec2.on(DescribeVolumesCommand).resolves({});
    await expect(api.listVolumes()).resolves.toEqual([]);
  });
});

describe("launch template mapping", () => {
  it("listLaunchTemplates maps version numbers + createTime", async () => {
    ec2.on(DescribeLaunchTemplatesCommand).resolves({
      LaunchTemplates: [
        {
          LaunchTemplateId: "lt-1",
          LaunchTemplateName: "web",
          DefaultVersionNumber: 1,
          LatestVersionNumber: 3,
          CreateTime: new Date("2024-03-03T00:00:00Z"),
        },
      ],
    });
    const r = await api.listLaunchTemplates();
    expect(r[0]).toMatchObject({
      launchTemplateId: "lt-1",
      launchTemplateName: "web",
      defaultVersionNumber: 1,
      latestVersionNumber: 3,
      createTime: "2024-03-03T00:00:00.000Z",
    });
  });

  it("getLaunchTemplateVersion maps $Default version data + block devices + userData flag", async () => {
    ec2.on(DescribeLaunchTemplateVersionsCommand).resolves({
      LaunchTemplateVersions: [
        {
          VersionNumber: 2,
          LaunchTemplateData: {
            ImageId: "ami-1",
            InstanceType: "t3.small",
            KeyName: "demo",
            SecurityGroupIds: ["sg-1"],
            SecurityGroups: ["default"],
            IamInstanceProfile: { Arn: "arn:role" },
            MetadataOptions: { HttpTokens: "required", HttpPutResponseHopLimit: 2 },
            UserData: "abc",
            BlockDeviceMappings: [
              {
                DeviceName: "/dev/xvda",
                Ebs: { VolumeSize: 8, VolumeType: "gp3", Encrypted: true },
              },
            ],
          },
        },
      ],
    });
    const d = await api.getLaunchTemplateVersion("lt-1");
    expect(d).toMatchObject({
      versionNumber: 2,
      imageId: "ami-1",
      instanceType: "t3.small",
      keyName: "demo",
      securityGroupIds: ["sg-1"],
      securityGroups: ["default"],
      iamInstanceProfileArn: "arn:role",
      metadataHttpTokens: "required",
      metadataHopLimit: 2,
      userDataPresent: true,
    });
    expect(d.blockDevices[0]).toMatchObject({
      deviceName: "/dev/xvda",
      size: 8,
      volumeType: "gp3",
      encrypted: true,
    });
    // The $Default version is requested.
    const input = ec2.commandCalls(DescribeLaunchTemplateVersionsCommand)[0]?.args[0].input;
    expect(input).toMatchObject({ LaunchTemplateId: "lt-1", Versions: ["$Default"] });
  });

  it("getLaunchTemplateVersion tolerates a missing version (no throw)", async () => {
    ec2.on(DescribeLaunchTemplateVersionsCommand).resolves({});
    const d = await api.getLaunchTemplateVersion("lt-x");
    expect(d).toMatchObject({ versionNumber: null, securityGroupIds: [], userDataPresent: false });
    expect(d.blockDevices).toEqual([]);
  });
});

describe("instance protection + user data", () => {
  it("getInstanceProtection maps both attribute calls", async () => {
    ec2
      .on(DescribeInstanceAttributeCommand, {
        InstanceId: "i-1",
        Attribute: "disableApiTermination",
      })
      .resolves({ DisableApiTermination: { Value: true } })
      .on(DescribeInstanceAttributeCommand, { InstanceId: "i-1", Attribute: "disableApiStop" })
      .resolves({ DisableApiStop: { Value: false } });
    const r = await api.getInstanceProtection("i-1");
    expect(r).toEqual({ terminationProtection: true, stopProtection: false });
  });

  it("getInstanceProtection defaults to false when unset", async () => {
    ec2.on(DescribeInstanceAttributeCommand).resolves({});
    await expect(api.getInstanceProtection("i-1")).resolves.toEqual({
      terminationProtection: false,
      stopProtection: false,
    });
  });

  it("getUserData base64-decodes the value", async () => {
    ec2.on(DescribeInstanceAttributeCommand).resolves({ UserData: { Value: btoa("#!/bin/sh") } });
    await expect(api.getUserData("i-1")).resolves.toBe("#!/bin/sh");
  });

  it("getUserData returns '' when none", async () => {
    ec2.on(DescribeInstanceAttributeCommand).resolves({});
    await expect(api.getUserData("i-1")).resolves.toBe("");
  });
});

describe("key pairs + subnets mapping", () => {
  it("listKeyPairs maps fields + createTime", async () => {
    ec2.on(DescribeKeyPairsCommand).resolves({
      KeyPairs: [
        {
          KeyPairId: "key-1",
          KeyName: "demo",
          KeyType: "rsa",
          KeyFingerprint: "ab:cd",
          CreateTime: new Date("2024-04-04T00:00:00Z"),
        },
      ],
    });
    const r = await api.listKeyPairs();
    expect(r[0]).toMatchObject({
      keyPairId: "key-1",
      keyName: "demo",
      keyType: "rsa",
      fingerprint: "ab:cd",
      createTime: "2024-04-04T00:00:00.000Z",
    });
  });

  it("listSubnets maps Name tag + availableIpCount", async () => {
    ec2.on(DescribeSubnetsCommand).resolves({
      Subnets: [
        {
          SubnetId: "subnet-1",
          VpcId: "vpc-1",
          CidrBlock: "10.0.0.0/24",
          AvailabilityZone: "us-east-1a",
          AvailableIpAddressCount: 250,
          Tags: [{ Key: "Name", Value: "public" }],
        },
      ],
    });
    const r = await api.listSubnets();
    expect(r[0]).toMatchObject({
      subnetId: "subnet-1",
      vpcId: "vpc-1",
      availableIpCount: 250,
      name: "public",
    });
  });

  it("createKeyPair returns the key material", async () => {
    ec2.on(CreateKeyPairCommand).resolves({ KeyName: "demo", KeyMaterial: "PEMDATA" });
    await expect(api.createKeyPair("demo", "rsa")).resolves.toEqual({
      keyName: "demo",
      keyMaterial: "PEMDATA",
    });
    expect(ec2.commandCalls(CreateKeyPairCommand)[0]?.args[0].input).toMatchObject({
      KeyName: "demo",
      KeyType: "rsa",
    });
  });
});

describe("write/command shapes", () => {
  it("createSecurityGroup falls back description to name and omits VpcId when blank", async () => {
    ec2.on(CreateSecurityGroupCommand).resolves({ GroupId: "sg-new" });
    await api.createSecurityGroup({ groupName: "web", description: "", vpcId: undefined });
    expect(ec2.commandCalls(CreateSecurityGroupCommand)[0]?.args[0].input).toEqual({
      GroupName: "web",
      Description: "web",
    });
  });

  it("authorizeRule (ingress) builds the expected IpPermissions", async () => {
    ec2.on(AuthorizeSecurityGroupIngressCommand).resolves({});
    await api.authorizeRule("sg-1", {
      direction: "ingress",
      protocol: "tcp",
      fromPort: 8000,
      toPort: 8010,
      cidr: "10.0.0.0/8",
    });
    const input = ec2.commandCalls(AuthorizeSecurityGroupIngressCommand)[0]?.args[0].input;
    expect(input).toEqual({
      GroupId: "sg-1",
      IpPermissions: [
        {
          IpProtocol: "tcp",
          FromPort: 8000,
          ToPort: 8010,
          IpRanges: [{ CidrIp: "10.0.0.0/8" }],
        },
      ],
    });
  });

  it("authorizeRule for protocol -1 omits ports and uses the egress command", async () => {
    ec2.on(AuthorizeSecurityGroupEgressCommand).resolves({});
    await api.authorizeRule("sg-1", {
      direction: "egress",
      protocol: "-1",
      fromPort: null,
      toPort: null,
      cidr: "0.0.0.0/0",
    });
    const input = ec2.commandCalls(AuthorizeSecurityGroupEgressCommand)[0]?.args[0].input;
    expect(input?.IpPermissions?.[0]).not.toHaveProperty("FromPort");
    expect(input?.IpPermissions?.[0]).toMatchObject({ IpProtocol: "-1" });
  });

  it("revokeRule uses the ingress revoke command", async () => {
    ec2.on(RevokeSecurityGroupIngressCommand).resolves({});
    await api.revokeRule("sg-1", {
      direction: "ingress",
      protocol: "tcp",
      fromPort: 22,
      toPort: 22,
      cidr: "1.2.3.4/32",
    });
    expect(ec2.commandCalls(RevokeSecurityGroupIngressCommand)).toHaveLength(1);
  });

  it("saveTags issues Delete BEFORE Create, and skips blank keys", async () => {
    ec2.on(DeleteTagsCommand).resolves({}).on(CreateTagsCommand).resolves({});
    await api.saveTags(
      "i-1",
      [
        { key: "Env", value: "prod" },
        { key: "", value: "ignored" },
      ],
      ["Old"],
    );
    const del = ec2.commandCalls(DeleteTagsCommand)[0]?.args[0].input;
    const create = ec2.commandCalls(CreateTagsCommand)[0]?.args[0].input;
    expect(del).toEqual({ Resources: ["i-1"], Tags: [{ Key: "Old" }] });
    expect(create).toEqual({ Resources: ["i-1"], Tags: [{ Key: "Env", Value: "prod" }] });
  });

  it("saveTags with no removed keys does not call DeleteTags", async () => {
    ec2.on(CreateTagsCommand).resolves({});
    await api.saveTags("i-1", [{ key: "A", value: "1" }], []);
    expect(ec2.commandCalls(DeleteTagsCommand)).toHaveLength(0);
    expect(ec2.commandCalls(CreateTagsCommand)).toHaveLength(1);
  });

  it("launchInstances maps count→Min/Max and Name→TagSpecifications", async () => {
    ec2.on(RunInstancesCommand).resolves({});
    await api.launchInstances({
      imageId: "ami-1",
      instanceType: "t3.micro",
      count: 3,
      name: "my-box",
      keyName: "demo",
      securityGroupIds: ["sg-1"],
      subnetId: "subnet-1",
    });
    expect(ec2.commandCalls(RunInstancesCommand)[0]?.args[0].input).toMatchObject({
      ImageId: "ami-1",
      InstanceType: "t3.micro",
      MinCount: 3,
      MaxCount: 3,
      KeyName: "demo",
      SecurityGroupIds: ["sg-1"],
      SubnetId: "subnet-1",
      TagSpecifications: [{ ResourceType: "instance", Tags: [{ Key: "Name", Value: "my-box" }] }],
    });
  });

  it("launchInstances omits optional fields when not provided", async () => {
    ec2.on(RunInstancesCommand).resolves({});
    await api.launchInstances({ imageId: "ami-1", instanceType: "t3.micro", count: 1 });
    const input = ec2.commandCalls(RunInstancesCommand)[0]?.args[0].input;
    expect(input).not.toHaveProperty("KeyName");
    expect(input).not.toHaveProperty("TagSpecifications");
    expect(input).not.toHaveProperty("SubnetId");
  });

  it("modifyInstanceType + modifyInstanceSecurityGroups send the right attribute", async () => {
    ec2.on(ModifyInstanceAttributeCommand).resolves({});
    await api.modifyInstanceType("i-1", "m5.large");
    await api.modifyInstanceSecurityGroups("i-1", ["sg-1", "sg-2"]);
    const calls = ec2.commandCalls(ModifyInstanceAttributeCommand);
    expect(calls[0]?.args[0].input).toMatchObject({ InstanceType: { Value: "m5.large" } });
    expect(calls[1]?.args[0].input).toMatchObject({ Groups: ["sg-1", "sg-2"] });
  });

  it("setTerminationProtection / setStopProtection send the right flags", async () => {
    ec2.on(ModifyInstanceAttributeCommand).resolves({});
    await api.setTerminationProtection("i-1", true);
    await api.setStopProtection("i-1", false);
    const calls = ec2.commandCalls(ModifyInstanceAttributeCommand);
    expect(calls[0]?.args[0].input).toMatchObject({ DisableApiTermination: { Value: true } });
    expect(calls[1]?.args[0].input).toMatchObject({ DisableApiStop: { Value: false } });
  });

  it("importKeyPair encodes the public key material", async () => {
    ec2.on(ImportKeyPairCommand).resolves({});
    await api.importKeyPair("demo", "ssh-ed25519 AAAA");
    const input = ec2.commandCalls(ImportKeyPairCommand)[0]?.args[0].input;
    expect(input?.KeyName).toBe("demo");
    expect(new TextDecoder().decode(input?.PublicKeyMaterial as Uint8Array)).toBe(
      "ssh-ed25519 AAAA",
    );
  });

  it("runAction routes to the correct command per kind", async () => {
    ec2
      .on(StartInstancesCommand)
      .resolves({})
      .on(StopInstancesCommand)
      .resolves({})
      .on(TerminateInstancesCommand)
      .resolves({});
    await api.runAction("start", "i-1");
    await api.runAction("stop", "i-1");
    await api.runAction("terminate", "i-1");
    expect(ec2.commandCalls(StartInstancesCommand)).toHaveLength(1);
    expect(ec2.commandCalls(StopInstancesCommand)).toHaveLength(1);
    expect(ec2.commandCalls(TerminateInstancesCommand)[0]?.args[0].input).toEqual({
      InstanceIds: ["i-1"],
    });
  });
});
