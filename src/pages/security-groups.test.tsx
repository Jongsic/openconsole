import { Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ec2SecurityGroup } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/ec2-api", () => ({
  api: {
    listSecurityGroups: vi.fn(),
    authorizeRule: vi.fn().mockResolvedValue(undefined),
    revokeRule: vi.fn().mockResolvedValue(undefined),
    createSecurityGroup: vi.fn().mockResolvedValue(undefined),
    deleteSecurityGroup: vi.fn().mockResolvedValue(undefined),
    listSubnets: vi.fn().mockResolvedValue([]),
  },
}));

import { api } from "@/lib/ec2-api";
import { SecurityGroupDetailPage, SecurityGroupsPage } from "./security-groups";

const group: Ec2SecurityGroup = {
  groupId: "sg-1",
  groupName: "web",
  description: "web tier",
  vpcId: "vpc-1",
  inbound: [],
  outbound: [],
};

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/compute/security-groups/:groupId" element={<SecurityGroupDetailPage />} />
    </Routes>,
    { route: "/compute/security-groups/sg-1" },
  );
}

describe("SecurityGroup RuleEditor add flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.listSecurityGroups).mockResolvedValue([group]);
  });

  it("calls authorizeRule once per comma-separated CIDR with the parsed port range", async () => {
    const { user } = renderDetail();

    // Wait for the detail to render (two RuleEditors: inbound + outbound).
    await waitFor(() => expect(screen.getByText("Inbound rules")).toBeInTheDocument());

    // Inbound editor is the first of each control.
    const [portInput] = screen.getAllByPlaceholderText("80 / 8000-8010");
    const [cidrInput] = screen.getAllByPlaceholderText("0.0.0.0/0, 10.0.0.0/8");
    const [addButton] = screen.getAllByRole("button", { name: "Add" });
    if (!portInput || !cidrInput || !addButton) throw new Error("inbound editor not found");

    await user.type(portInput, "8000-8010");
    await user.clear(cidrInput);
    await user.type(cidrInput, "10.0.0.0/8, 192.168.0.0/16");
    await user.click(addButton);

    await waitFor(() => expect(api.authorizeRule).toHaveBeenCalledTimes(2));

    expect(api.authorizeRule).toHaveBeenNthCalledWith(
      1,
      "sg-1",
      expect.objectContaining({
        direction: "ingress",
        protocol: "tcp",
        fromPort: 8000,
        toPort: 8010,
        cidr: "10.0.0.0/8",
      }),
    );
    expect(api.authorizeRule).toHaveBeenNthCalledWith(
      2,
      "sg-1",
      expect.objectContaining({ cidr: "192.168.0.0/16", fromPort: 8000, toPort: 8010 }),
    );
  });
});

describe("SecurityGroupsPage list", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listSecurityGroups).mockResolvedValue([group]);
    renderWithProviders(<SecurityGroupsPage />);
    expect(await screen.findByText("web")).toBeInTheDocument();
    expect(screen.getByText("sg-1")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listSecurityGroups).mockResolvedValue([]);
    renderWithProviders(<SecurityGroupsPage />);
    expect(await screen.findByText("No security groups")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listSecurityGroups).mockRejectedValue({
      name: "InternalFailure",
      message: "DescribeSecurityGroups is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<SecurityGroupsPage />);
    await waitFor(() =>
      expect(
        screen.getByText("This backend does not support EC2 security groups."),
      ).toBeInTheDocument(),
    );
  });

  it("create modal sends name/description to createSecurityGroup", async () => {
    vi.mocked(api.listSecurityGroups).mockResolvedValue([]);
    const { user } = renderWithProviders(<SecurityGroupsPage />);
    await screen.findByText("No security groups");

    await user.click(screen.getByRole("button", { name: /Create security group/ }));
    await user.type(screen.getByLabelText("Name"), "api-sg");
    await user.type(screen.getByLabelText("Description"), "api tier");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() =>
      expect(api.createSecurityGroup).toHaveBeenCalledWith({
        groupName: "api-sg",
        description: "api tier",
        vpcId: undefined,
      }),
    );
  });
});
