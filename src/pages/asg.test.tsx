import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AsgDetail, AsgSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/autoscaling-api", () => ({
  api: {
    listAutoScalingGroups: vi.fn(),
    deleteAutoScalingGroup: vi.fn().mockResolvedValue(undefined),
    createAutoScalingGroup: vi.fn().mockResolvedValue(undefined),
    getAutoScalingGroupDetail: vi.fn(),
    updateCapacity: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/lib/ec2-api", () => ({
  api: {
    listLaunchTemplates: vi
      .fn()
      .mockResolvedValue([{ launchTemplateId: "lt-1", launchTemplateName: "web-lt" }]),
    listSubnets: vi
      .fn()
      .mockResolvedValue([{ subnetId: "subnet-1", vpcId: "vpc-1", availabilityZone: "az-a" }]),
  },
}));
vi.mock("@/lib/elbv2-api", () => ({
  api: { listTargetGroups: vi.fn().mockResolvedValue([]) },
}));

import { api } from "@/lib/autoscaling-api";
import { AsgPage } from "./asg";

const asg: AsgSummary = {
  name: "web-asg",
  arn: "arn:asg",
  minSize: 1,
  maxSize: 4,
  desiredCapacity: 2,
  instanceCount: 2,
  healthCheckType: "EC2",
  launchTemplate: "web-lt",
  availabilityZones: ["az-a"],
  targetGroupArns: [],
  createdTime: "2024-01-01T00:00:00.000Z",
};

const detail: AsgDetail = {
  ...asg,
  instances: [],
  policies: [],
  scheduledActions: [],
};

describe("AsgPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listAutoScalingGroups).mockResolvedValue([asg]);
    renderWithProviders(<AsgPage />);
    expect(await screen.findByText("web-asg")).toBeInTheDocument();
    expect(screen.getByText("web-lt")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listAutoScalingGroups).mockResolvedValue([]);
    renderWithProviders(<AsgPage />);
    expect(await screen.findByText("No Auto Scaling groups")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listAutoScalingGroups).mockRejectedValue({
      name: "InternalFailure",
      message: "DescribeAutoScalingGroups is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<AsgPage />);
    await waitFor(() =>
      expect(screen.getByText("This backend does not support Auto Scaling.")).toBeInTheDocument(),
    );
  });

  it("create modal sends launch template/capacity/subnets to createAutoScalingGroup", async () => {
    vi.mocked(api.listAutoScalingGroups).mockResolvedValue([]);
    const { user } = renderWithProviders(<AsgPage />);
    await screen.findByText("No Auto Scaling groups");

    await user.click(screen.getByRole("button", { name: /Create Auto Scaling group/ }));
    await user.type(screen.getByLabelText("Name"), "api-asg");
    await user.selectOptions(await screen.findByLabelText("Launch template"), "lt-1");
    await user.click(await screen.findByRole("checkbox", { name: /subnet-1/ }));
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(api.createAutoScalingGroup).toHaveBeenCalledWith({
        name: "api-asg",
        launchTemplateId: "lt-1",
        minSize: 1,
        maxSize: 2,
        desiredCapacity: 1,
        subnetIds: ["subnet-1"],
        targetGroupArns: [],
      }),
    );
  });

  it("capacity editor saves via updateCapacity", async () => {
    vi.mocked(api.listAutoScalingGroups).mockResolvedValue([asg]);
    vi.mocked(api.getAutoScalingGroupDetail).mockResolvedValue(detail);
    const { user } = renderWithProviders(<AsgPage />);

    await user.click(await screen.findByText("web-asg"));
    // Capacity editor loads from the detail; bump desired then Apply.
    const desired = await screen.findByLabelText("Desired");
    await user.tripleClick(desired);
    await user.keyboard("3");
    await user.click(screen.getByRole("button", { name: "Apply" }));

    await waitFor(() =>
      expect(api.updateCapacity).toHaveBeenCalledWith("web-asg", {
        minSize: 1,
        maxSize: 4,
        desiredCapacity: 3,
      }),
    );
  });
});
