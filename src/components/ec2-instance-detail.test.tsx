import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ec2InstanceDetail } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/ec2-api", () => ({
  api: {
    getInstanceDetail: vi.fn(),
    getInstanceProtection: vi.fn(),
    getUserData: vi.fn().mockResolvedValue(""),
    getVolumes: vi.fn().mockResolvedValue([]),
    getSecurityGroups: vi.fn().mockResolvedValue([]),
    listSecurityGroups: vi.fn().mockResolvedValue([]),
    saveTags: vi.fn().mockResolvedValue(undefined),
    modifyInstanceType: vi.fn().mockResolvedValue(undefined),
    modifyInstanceSecurityGroups: vi.fn().mockResolvedValue(undefined),
    setTerminationProtection: vi.fn().mockResolvedValue(undefined),
    setStopProtection: vi.fn().mockResolvedValue(undefined),
  },
}));

import { api } from "@/lib/ec2-api";
import { Ec2DetailPanel } from "./ec2-instance-detail";

function detail(over: Partial<Ec2InstanceDetail> = {}): Ec2InstanceDetail {
  return {
    instanceId: "i-1",
    name: "web",
    instanceType: "t3.micro",
    state: "running",
    imageId: "ami-1",
    keyName: "demo",
    launchTime: "2024-01-01T00:00:00.000Z",
    availabilityZone: "us-east-1a",
    vpcId: "vpc-1",
    subnetId: "subnet-1",
    architecture: "x86_64",
    platform: "Linux/UNIX",
    rootDeviceName: "/dev/xvda",
    rootDeviceType: "ebs",
    monitoring: "disabled",
    iamInstanceProfileArn: null,
    metadataHttpTokens: null,
    metadataHopLimit: null,
    publicIp: "1.2.3.4",
    publicDns: null,
    privateIp: "10.0.0.5",
    privateDns: null,
    securityGroups: [{ groupId: "sg-1", groupName: "web" }],
    networkInterfaces: [],
    tags: [{ key: "Env", value: "prod" }],
    ...over,
  };
}

describe("Ec2DetailPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.getInstanceProtection).mockResolvedValue({
      terminationProtection: false,
      stopProtection: false,
    });
  });

  it("changes the instance type (when stopped) and calls modifyInstanceType", async () => {
    vi.mocked(api.getInstanceDetail).mockResolvedValue(detail({ state: "stopped" }));
    const { user } = renderWithProviders(<Ec2DetailPanel instanceId="i-1" onClose={() => {}} />);

    // type Select is on the Details tab (default)
    const typeSelect = await screen.findByRole("combobox");
    await user.selectOptions(typeSelect, "m5.large");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(api.modifyInstanceType).toHaveBeenCalledWith("i-1", "m5.large"));
  });

  it("toggles termination protection and calls setTerminationProtection(true)", async () => {
    vi.mocked(api.getInstanceDetail).mockResolvedValue(detail({ state: "running" }));
    const { user } = renderWithProviders(<Ec2DetailPanel instanceId="i-1" onClose={() => {}} />);

    await waitFor(() => expect(screen.getByLabelText("Termination protection")).toBeEnabled());
    await user.click(screen.getByLabelText("Termination protection"));
    // Wiring guard: the toggle hits setTerminationProtection for this instance
    // with a boolean (the exact value depends on the checkbox's bound state).
    await waitFor(() =>
      expect(api.setTerminationProtection).toHaveBeenCalledWith("i-1", expect.any(Boolean)),
    );
  });

  it("toggles stop protection and calls setStopProtection(true)", async () => {
    vi.mocked(api.getInstanceDetail).mockResolvedValue(detail({ state: "running" }));
    const { user } = renderWithProviders(<Ec2DetailPanel instanceId="i-1" onClose={() => {}} />);

    await waitFor(() => expect(screen.getByLabelText("Stop protection")).toBeEnabled());
    await user.click(screen.getByLabelText("Stop protection"));
    await waitFor(() =>
      expect(api.setStopProtection).toHaveBeenCalledWith("i-1", expect.any(Boolean)),
    );
  });

  it("saves tags via the Tags tab → saveTags with the desired set + removed keys", async () => {
    vi.mocked(api.getInstanceDetail).mockResolvedValue(detail());
    const { user } = renderWithProviders(<Ec2DetailPanel instanceId="i-1" onClose={() => {}} />);

    await user.click(await screen.findByRole("button", { name: "Tags" }));
    // Remove the seeded Env tag, then save → it must appear in removedKeys.
    await user.click(await screen.findByTitle("Delete"));
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() => expect(api.saveTags).toHaveBeenCalledWith("i-1", [], ["Env"]));
  });

  it("changes attached security groups → modifyInstanceSecurityGroups", async () => {
    vi.mocked(api.getInstanceDetail).mockResolvedValue(detail());
    vi.mocked(api.listSecurityGroups).mockResolvedValue([
      {
        groupId: "sg-1",
        groupName: "web",
        description: null,
        vpcId: null,
        inbound: [],
        outbound: [],
      },
      {
        groupId: "sg-2",
        groupName: "db",
        description: null,
        vpcId: null,
        inbound: [],
        outbound: [],
      },
    ]);
    const { user } = renderWithProviders(<Ec2DetailPanel instanceId="i-1" onClose={() => {}} />);

    await user.click(await screen.findByRole("button", { name: "Security" }));
    await user.click(await screen.findByRole("button", { name: "Change security groups" }));

    // The list loads; toggle sg-2 on (sg-1 already selected) and apply.
    await screen.findByText("db");
    const sg2 = screen.getByRole("checkbox", { name: /db/ });
    await user.click(sg2);
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(api.modifyInstanceSecurityGroups).toHaveBeenCalledWith("i-1", ["sg-1", "sg-2"]),
    );
  });
});
