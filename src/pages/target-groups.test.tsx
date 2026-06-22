import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TargetGroupSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/elbv2-api", () => ({
  api: {
    listTargetGroups: vi.fn(),
    deleteTargetGroup: vi.fn().mockResolvedValue(undefined),
    createTargetGroup: vi.fn().mockResolvedValue(undefined),
    getTargetGroupAttributes: vi.fn().mockResolvedValue({
      stickinessEnabled: false,
      stickinessType: "lb_cookie",
      stickinessDurationSeconds: 86400,
      deregistrationDelaySeconds: 300,
      loadBalancingAlgorithm: "round_robin",
    }),
    modifyTargetGroupAttributes: vi.fn().mockResolvedValue(undefined),
    modifyHealthCheck: vi.fn().mockResolvedValue(undefined),
    getTargetHealth: vi.fn().mockResolvedValue([]),
    registerTarget: vi.fn().mockResolvedValue(undefined),
    deregisterTarget: vi.fn().mockResolvedValue(undefined),
    getTags: vi.fn().mockResolvedValue([]),
    saveTags: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/lib/ec2-api", () => ({
  api: {
    listInstances: vi.fn().mockResolvedValue([]),
    listSubnets: vi.fn().mockResolvedValue([{ subnetId: "subnet-1", vpcId: "vpc-1" }]),
  },
}));

import { api } from "@/lib/elbv2-api";
import { TargetGroupsPage } from "./target-groups";

const tg: TargetGroupSummary = {
  arn: "arn:tg",
  name: "web-tg",
  protocol: "HTTP",
  port: 80,
  targetType: "instance",
  vpcId: "vpc-1",
  healthCheckPath: "/health",
  healthCheckProtocol: "HTTP",
  healthCheckIntervalSeconds: 30,
  healthCheckTimeoutSeconds: 5,
  healthyThreshold: 5,
  unhealthyThreshold: 2,
  matcherHttpCode: "200",
  loadBalancerArns: [],
};

describe("TargetGroupsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listTargetGroups).mockResolvedValue([tg]);
    renderWithProviders(<TargetGroupsPage />);
    expect(await screen.findByText("web-tg")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listTargetGroups).mockResolvedValue([]);
    renderWithProviders(<TargetGroupsPage />);
    expect(await screen.findByText("No target groups")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listTargetGroups).mockRejectedValue({
      name: "InternalFailure",
      message: "DescribeTargetGroups is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<TargetGroupsPage />);
    await waitFor(() =>
      expect(
        screen.getByText("This backend does not support ELBv2 target groups."),
      ).toBeInTheDocument(),
    );
  });

  it("create modal sends name/protocol/port/type/health path to createTargetGroup", async () => {
    vi.mocked(api.listTargetGroups).mockResolvedValue([]);
    const { user } = renderWithProviders(<TargetGroupsPage />);
    await screen.findByText("No target groups");

    await user.click(screen.getByRole("button", { name: /Create target group/ }));
    await user.type(screen.getByLabelText("Name"), "api-tg");
    await user.selectOptions(screen.getByLabelText("Protocol"), "HTTPS");
    await user.clear(screen.getByLabelText("Port"));
    await user.type(screen.getByLabelText("Port"), "443");
    await user.clear(screen.getByLabelText("Health check path"));
    await user.type(screen.getByLabelText("Health check path"), "/ping");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(api.createTargetGroup).toHaveBeenCalledWith({
        name: "api-tg",
        protocol: "HTTPS",
        port: 443,
        targetType: "instance",
        vpcId: undefined,
        healthCheckPath: "/ping",
      }),
    );
  });

  it("health-check editor saves via modifyHealthCheck; attributes save via modifyTargetGroupAttributes", async () => {
    vi.mocked(api.listTargetGroups).mockResolvedValue([tg]);
    const { user } = renderWithProviders(<TargetGroupsPage />);

    // Open the health panel (row click selects the TG).
    await user.click(await screen.findByText("web-tg"));

    // Health check section: edit interval then Apply (first Apply button).
    const interval = await screen.findByLabelText("Interval (s)");
    await user.tripleClick(interval);
    await user.keyboard("15");
    const applyButtons = screen.getAllByRole("button", { name: "Apply" });
    await user.click(applyButtons[0] as HTMLElement);
    await waitFor(() =>
      expect(api.modifyHealthCheck).toHaveBeenCalledWith(
        "arn:tg",
        expect.objectContaining({ intervalSeconds: 15, path: "/health" }),
      ),
    );

    // Attributes section: toggle stickiness then Apply (second Apply button).
    await user.click(screen.getByLabelText("Stickiness"));
    const apply2 = screen.getAllByRole("button", { name: "Apply" });
    await user.click(apply2[1] as HTMLElement);
    await waitFor(() =>
      expect(api.modifyTargetGroupAttributes).toHaveBeenCalledWith(
        "arn:tg",
        expect.objectContaining({ stickinessEnabled: true }),
      ),
    );
  });

  it("registers a target via registerTarget", async () => {
    // IP-type TG so the target field is a free-text input.
    vi.mocked(api.listTargetGroups).mockResolvedValue([{ ...tg, targetType: "ip" }]);
    const { user } = renderWithProviders(<TargetGroupsPage />);
    await user.click(await screen.findByText("web-tg"));

    await user.type(await screen.findByLabelText("Target"), "10.0.0.5");
    await user.type(screen.getByLabelText("Port"), "8080");
    await user.click(screen.getByRole("button", { name: "Register" }));

    await waitFor(() =>
      expect(api.registerTarget).toHaveBeenCalledWith("arn:tg", "10.0.0.5", 8080),
    );
  });
});
