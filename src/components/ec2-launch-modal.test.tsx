import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders, screen, waitFor } from "@/test/render";

// Mock the api module at the import boundary the component uses. Pages/components
// import `{ api }` from "@/lib/ec2-api"; replacing it here keeps the test offline
// and lets us assert exactly what payload the UI hands to our api function.
vi.mock("@/lib/ec2-api", () => ({
  api: {
    launchInstances: vi.fn().mockResolvedValue(undefined),
    listKeyPairs: vi.fn().mockResolvedValue([{ keyName: "demo", keyPairId: "key-1" }]),
    listSecurityGroups: vi
      .fn()
      .mockResolvedValue([{ groupId: "sg-123", groupName: "web", inbound: [], outbound: [] }]),
    listSubnets: vi
      .fn()
      .mockResolvedValue([
        { subnetId: "subnet-abc", name: "public", availabilityZone: "us-east-1a" },
      ]),
  },
}));

import { api } from "@/lib/ec2-api";
import { Ec2LaunchModal } from "./ec2-launch-modal";

describe("Ec2LaunchModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends the typed name, selected instance type and count to api.launchInstances", async () => {
    const { user } = renderWithProviders(<Ec2LaunchModal open onClose={() => {}} />);

    await user.type(screen.getByLabelText("Name (optional)"), "my-box");
    await user.selectOptions(screen.getByLabelText("Instance type"), "m5.large");

    // Count input starts at 1; typing "3" with it focused after clearing the
    // single char yields 3. (userEvent.clear on a controlled number field that
    // clamps to >=1 leaves "1", so select-all then type to replace it.)
    const count = screen.getByLabelText("Count");
    await user.tripleClick(count);
    await user.keyboard("3");

    await user.click(screen.getByRole("button", { name: "Launch" }));

    await waitFor(() => expect(api.launchInstances).toHaveBeenCalledTimes(1));
    expect(api.launchInstances).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "my-box",
        instanceType: "m5.large",
        count: 3,
      }),
    );
  });

  it("includes advanced pickers (key pair, security group, subnet) in the payload", async () => {
    const { user } = renderWithProviders(<Ec2LaunchModal open onClose={() => {}} />);

    // Open advanced section; pickers load from the (mocked) live queries.
    await user.click(screen.getByRole("button", { name: /Advanced options/ }));

    await waitFor(() => expect(screen.getByText("sg-123")).toBeInTheDocument());

    await user.selectOptions(screen.getByLabelText("Key pair"), "demo");
    await user.click(screen.getByRole("checkbox"));
    await user.selectOptions(screen.getByLabelText("Subnet"), "subnet-abc");

    await user.click(screen.getByRole("button", { name: "Launch" }));

    await waitFor(() => expect(api.launchInstances).toHaveBeenCalledTimes(1));
    expect(api.launchInstances).toHaveBeenCalledWith(
      expect.objectContaining({
        keyName: "demo",
        securityGroupIds: ["sg-123"],
        subnetId: "subnet-abc",
      }),
    );
  });
});
