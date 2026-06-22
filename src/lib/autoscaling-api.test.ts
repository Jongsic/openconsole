import {
  AutoScalingClient,
  type AutoScalingGroup,
  CreateAutoScalingGroupCommand,
  DescribeAutoScalingGroupsCommand,
  DescribePoliciesCommand,
  DescribeScheduledActionsCommand,
  type Instance,
  UpdateAutoScalingGroupCommand,
} from "@aws-sdk/client-auto-scaling";
import { mockClient } from "aws-sdk-client-mock";
import { beforeEach, describe, expect, it } from "vitest";
import { api } from "./autoscaling-api";

const asg = mockClient(AutoScalingClient);

beforeEach(() => asg.reset());

describe("listAutoScalingGroups mapping", () => {
  it("maps capacity, instance count, launch-template label (from LaunchTemplate name)", async () => {
    asg.on(DescribeAutoScalingGroupsCommand).resolves({
      AutoScalingGroups: [
        {
          AutoScalingGroupName: "web-asg",
          AutoScalingGroupARN: "arn:asg",
          MinSize: 1,
          MaxSize: 4,
          DesiredCapacity: 2,
          Instances: [{ InstanceId: "i-1" }, { InstanceId: "i-2" }] as unknown as Instance[],
          HealthCheckType: "EC2",
          LaunchTemplate: { LaunchTemplateName: "web-lt", LaunchTemplateId: "lt-1" },
          AvailabilityZones: ["us-east-1a"],
          TargetGroupARNs: ["arn:tg"],
          CreatedTime: new Date("2024-01-01T00:00:00Z"),
        },
      ] as unknown as AutoScalingGroup[],
    });
    const r = await api.listAutoScalingGroups();
    expect(r[0]).toMatchObject({
      name: "web-asg",
      minSize: 1,
      maxSize: 4,
      desiredCapacity: 2,
      instanceCount: 2,
      healthCheckType: "EC2",
      launchTemplate: "web-lt",
      availabilityZones: ["us-east-1a"],
      targetGroupArns: ["arn:tg"],
      createdTime: "2024-01-01T00:00:00.000Z",
    });
  });

  it("launchTemplateLabel falls back through MixedInstancesPolicy then LaunchConfiguration", async () => {
    asg.on(DescribeAutoScalingGroupsCommand).resolves({
      AutoScalingGroups: [
        {
          AutoScalingGroupName: "mixed",
          MinSize: 0,
          MaxSize: 1,
          DesiredCapacity: 0,
          MixedInstancesPolicy: {
            LaunchTemplate: {
              LaunchTemplateSpecification: { LaunchTemplateName: "mixed-lt" },
            },
          },
        },
        {
          AutoScalingGroupName: "legacy",
          MinSize: 0,
          MaxSize: 1,
          DesiredCapacity: 0,
          LaunchConfigurationName: "legacy-lc",
        },
      ] as unknown as AutoScalingGroup[],
    });
    const r = await api.listAutoScalingGroups();
    expect(r[0]?.launchTemplate).toBe("mixed-lt");
    expect(r[1]?.launchTemplate).toBe("legacy-lc");
  });

  it("returns [] when empty", async () => {
    asg.on(DescribeAutoScalingGroupsCommand).resolves({});
    await expect(api.listAutoScalingGroups()).resolves.toEqual([]);
  });
});

describe("getAutoScalingGroupDetail mapping", () => {
  it("maps instances, target-tracking policy metric, and scheduled actions", async () => {
    asg.on(DescribeAutoScalingGroupsCommand).resolves({
      AutoScalingGroups: [
        {
          AutoScalingGroupName: "web-asg",
          MinSize: 1,
          MaxSize: 4,
          DesiredCapacity: 2,
          Instances: [
            {
              InstanceId: "i-1",
              LifecycleState: "InService",
              HealthStatus: "Healthy",
              AvailabilityZone: "us-east-1a",
            },
          ] as unknown as Instance[],
        },
      ] as unknown as AutoScalingGroup[],
    });
    asg.on(DescribePoliciesCommand).resolves({
      ScalingPolicies: [
        {
          PolicyName: "cpu",
          PolicyType: "TargetTrackingScaling",
          TargetTrackingConfiguration: {
            PredefinedMetricSpecification: { PredefinedMetricType: "ASGAverageCPUUtilization" },
            TargetValue: 50,
          },
        },
        {
          PolicyName: "custom",
          PolicyType: "TargetTrackingScaling",
          TargetTrackingConfiguration: {
            CustomizedMetricSpecification: {
              MetricName: "x",
              Namespace: "y",
              Statistic: "Average",
            },
            TargetValue: 10,
          },
        },
      ],
    });
    asg.on(DescribeScheduledActionsCommand).resolves({
      ScheduledUpdateGroupActions: [
        {
          ScheduledActionName: "scale-up",
          Recurrence: "0 9 * * *",
          MinSize: 2,
          MaxSize: 6,
          DesiredCapacity: 4,
          StartTime: new Date("2024-05-05T00:00:00Z"),
        },
      ],
    });
    const d = await api.getAutoScalingGroupDetail("web-asg");
    expect(d.instances[0]).toEqual({
      instanceId: "i-1",
      lifecycleState: "InService",
      healthStatus: "Healthy",
      availabilityZone: "us-east-1a",
    });
    expect(d.policies[0]).toMatchObject({
      name: "cpu",
      metric: "ASGAverageCPUUtilization",
      targetValue: 50,
    });
    expect(d.policies[1]?.metric).toBe("Custom");
    expect(d.scheduledActions[0]).toMatchObject({
      name: "scale-up",
      recurrence: "0 9 * * *",
      desiredCapacity: 4,
      startTime: "2024-05-05T00:00:00.000Z",
    });
  });

  it("throws when the group is not found", async () => {
    asg
      .on(DescribeAutoScalingGroupsCommand)
      .resolves({ AutoScalingGroups: [] })
      .on(DescribePoliciesCommand)
      .resolves({})
      .on(DescribeScheduledActionsCommand)
      .resolves({});
    await expect(api.getAutoScalingGroupDetail("missing")).rejects.toThrow(/not found/);
  });
});

describe("write/command shapes", () => {
  it("createAutoScalingGroup uses $Default version + joins subnets into VPCZoneIdentifier", async () => {
    asg.on(CreateAutoScalingGroupCommand).resolves({});
    await api.createAutoScalingGroup({
      name: "web-asg",
      launchTemplateId: "lt-1",
      minSize: 1,
      maxSize: 4,
      desiredCapacity: 2,
      subnetIds: ["subnet-1", "subnet-2"],
      targetGroupArns: ["arn:tg"],
    });
    expect(asg.commandCalls(CreateAutoScalingGroupCommand)[0]?.args[0].input).toMatchObject({
      AutoScalingGroupName: "web-asg",
      LaunchTemplate: { LaunchTemplateId: "lt-1", Version: "$Default" },
      MinSize: 1,
      MaxSize: 4,
      DesiredCapacity: 2,
      VPCZoneIdentifier: "subnet-1,subnet-2",
      TargetGroupARNs: ["arn:tg"],
    });
  });

  it("createAutoScalingGroup omits VPCZoneIdentifier/TargetGroupARNs when empty", async () => {
    asg.on(CreateAutoScalingGroupCommand).resolves({});
    await api.createAutoScalingGroup({
      name: "web-asg",
      launchTemplateId: "lt-1",
      minSize: 1,
      maxSize: 1,
      desiredCapacity: 1,
      subnetIds: [],
      targetGroupArns: [],
    });
    const input = asg.commandCalls(CreateAutoScalingGroupCommand)[0]?.args[0].input;
    expect(input).not.toHaveProperty("VPCZoneIdentifier");
    expect(input).not.toHaveProperty("TargetGroupARNs");
  });

  it("updateCapacity sends min/max/desired", async () => {
    asg.on(UpdateAutoScalingGroupCommand).resolves({});
    await api.updateCapacity("web-asg", { minSize: 2, maxSize: 8, desiredCapacity: 4 });
    expect(asg.commandCalls(UpdateAutoScalingGroupCommand)[0]?.args[0].input).toEqual({
      AutoScalingGroupName: "web-asg",
      MinSize: 2,
      MaxSize: 8,
      DesiredCapacity: 4,
    });
  });
});
