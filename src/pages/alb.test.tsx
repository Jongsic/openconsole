import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AlbListenerDetail, AlbSummary, TargetGroupSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/elbv2-api", () => ({
  api: {
    listLoadBalancers: vi.fn(),
    deleteLoadBalancer: vi.fn().mockResolvedValue(undefined),
    createLoadBalancer: vi.fn().mockResolvedValue(undefined),
    getListeners: vi.fn().mockResolvedValue([]),
    listTargetGroups: vi.fn().mockResolvedValue([]),
    createListener: vi.fn().mockResolvedValue(undefined),
    deleteListener: vi.fn().mockResolvedValue(undefined),
    createRule: vi.fn().mockResolvedValue(undefined),
    deleteRule: vi.fn().mockResolvedValue(undefined),
    getLoadBalancerAttributes: vi.fn().mockResolvedValue({
      idleTimeoutSeconds: 60,
      deletionProtection: false,
      http2Enabled: true,
    }),
    modifyLoadBalancerAttributes: vi.fn().mockResolvedValue(undefined),
    getTags: vi.fn().mockResolvedValue([]),
    saveTags: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock("@/lib/ec2-api", () => ({
  api: {
    listSubnets: vi
      .fn()
      .mockResolvedValue([{ subnetId: "subnet-1", vpcId: "vpc-1", availabilityZone: "az-a" }]),
    listSecurityGroups: vi
      .fn()
      .mockResolvedValue([{ groupId: "sg-1", groupName: "web", inbound: [], outbound: [] }]),
  },
}));

import { api } from "@/lib/elbv2-api";
import { AlbDetailPage, AlbPage } from "./alb";

const lb: AlbSummary = {
  arn: "arn:lb",
  name: "web-lb",
  type: "application",
  scheme: "internet-facing",
  state: "active",
  dnsName: "web-lb.example.com",
  vpcId: "vpc-1",
  availabilityZones: ["az-a"],
  createdTime: "2024-01-01T00:00:00.000Z",
};

const tg: TargetGroupSummary = {
  arn: "arn:tg",
  name: "web-tg",
  protocol: "HTTP",
  port: 80,
  targetType: "instance",
  vpcId: "vpc-1",
  healthCheckPath: "/",
  healthCheckProtocol: "HTTP",
  healthCheckIntervalSeconds: 30,
  healthCheckTimeoutSeconds: 5,
  healthyThreshold: 5,
  unhealthyThreshold: 2,
  matcherHttpCode: "200",
  loadBalancerArns: [],
};

describe("AlbPage list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listLoadBalancers).mockResolvedValue([lb]);
    renderWithProviders(<AlbPage />);
    expect(await screen.findByText("web-lb")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listLoadBalancers).mockResolvedValue([]);
    renderWithProviders(<AlbPage />);
    expect(await screen.findByText("No load balancers")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listLoadBalancers).mockRejectedValue({
      name: "InternalFailure",
      message: "DescribeLoadBalancers is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<AlbPage />);
    await waitFor(() =>
      expect(
        screen.getByText("This backend does not support ELBv2 (load balancers)."),
      ).toBeInTheDocument(),
    );
  });

  it("create modal sends subnets + SGs to createLoadBalancer", async () => {
    vi.mocked(api.listLoadBalancers).mockResolvedValue([]);
    const { user } = renderWithProviders(<AlbPage />);
    await screen.findByText("No load balancers");

    await user.click(screen.getByRole("button", { name: /Create load balancer/ }));
    await user.type(screen.getByLabelText("Name"), "api-lb");
    // subnet + SG checkboxes load from the (mocked) queries
    await user.click(await screen.findByRole("checkbox", { name: /subnet-1/ }));
    await user.click(screen.getByRole("checkbox", { name: /web/ }));
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(api.createLoadBalancer).toHaveBeenCalledWith({
        name: "api-lb",
        scheme: "internet-facing",
        type: "application",
        subnetIds: ["subnet-1"],
        securityGroupIds: ["sg-1"],
      }),
    );
  });
});

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/compute/load-balancers/:lbName" element={<AlbDetailPage />} />
    </Routes>,
    { route: "/compute/load-balancers/web-lb" },
  );
}

describe("AlbDetailPage listeners & rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listLoadBalancers).mockResolvedValue([lb]);
    vi.mocked(api.listTargetGroups).mockResolvedValue([tg]);
  });

  it("creates a forward listener with the chosen target group", async () => {
    vi.mocked(api.getListeners).mockResolvedValue([]);
    const { user } = renderDetail();

    await screen.findByText("No listeners");
    // Forward action is the default; pick the target group then add.
    await user.selectOptions(await screen.findByLabelText("Target groups"), "arn:tg");
    await user.click(screen.getByRole("button", { name: /Add listener/ }));

    await waitFor(() =>
      expect(api.createListener).toHaveBeenCalledWith(
        expect.objectContaining({
          loadBalancerArn: "arn:lb",
          protocol: "HTTP",
          port: 80,
          action: { type: "forward", targetGroupArn: "arn:tg" },
        }),
      ),
    );
  });

  it("creates a fixed-response listener with status code + body", async () => {
    vi.mocked(api.getListeners).mockResolvedValue([]);
    const { user } = renderDetail();

    await screen.findByText("No listeners");
    await user.selectOptions(await screen.findByLabelText("Actions"), "fixed-response");
    // Status code defaults to 404; just fill the response body.
    await user.type(screen.getByLabelText("Response body"), "gone");
    await user.click(screen.getByRole("button", { name: /Add listener/ }));

    await waitFor(() =>
      expect(api.createListener).toHaveBeenCalledWith(
        expect.objectContaining({
          action: {
            type: "fixed-response",
            statusCode: "404",
            contentType: "text/plain",
            body: "gone",
          },
        }),
      ),
    );
  });

  it("adds a path rule to a listener via createRule", async () => {
    const listener: AlbListenerDetail = {
      arn: "arn:listener",
      port: 80,
      protocol: "HTTP",
      defaultActionType: "forward",
      rules: [
        {
          arn: "arn:rule-default",
          isDefault: true,
          priority: "default",
          conditions: [],
          actions: ["forward → web-tg"],
        },
      ],
    };
    vi.mocked(api.getListeners).mockResolvedValue([listener]);
    const { user } = renderDetail();

    // Expand the listener's "+ rule" form.
    await user.click(await screen.findByRole("button", { name: /rule/ }));
    await user.type(await screen.findByPlaceholderText("/api/*"), "/api/*");
    // Two target-group selects on the page (listener form + rule form); pick the rule form's last.
    const selects = screen.getAllByRole("combobox");
    await user.selectOptions(selects.at(-1) as HTMLElement, "arn:tg");
    await user.click(screen.getByRole("button", { name: "Add" }));

    await waitFor(() =>
      expect(api.createRule).toHaveBeenCalledWith(
        expect.objectContaining({
          listenerArn: "arn:listener",
          conditionField: "path-pattern",
          values: "/api/*",
          targetGroupArn: "arn:tg",
          priority: 10,
        }),
      ),
    );
  });

  it("deletes a listener via deleteListener", async () => {
    const listener: AlbListenerDetail = {
      arn: "arn:listener",
      port: 80,
      protocol: "HTTP",
      defaultActionType: "forward",
      rules: [],
    };
    vi.mocked(api.getListeners).mockResolvedValue([listener]);
    const { user } = renderDetail();

    await user.click(await screen.findByTitle("Delete listener"));
    await waitFor(() => expect(api.deleteListener).toHaveBeenCalledWith("arn:listener"));
  });
});
