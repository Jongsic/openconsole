import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Ec2InstanceSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/ec2-api", () => ({
  api: {
    listInstances: vi.fn(),
    runAction: vi.fn().mockResolvedValue(undefined),
    // detail panel queries (only hit when a row is selected)
    getInstanceDetail: vi.fn().mockResolvedValue({
      instanceId: "i-1",
      name: "web",
      state: "running",
      securityGroups: [],
      networkInterfaces: [],
      tags: [],
    }),
    getInstanceProtection: vi
      .fn()
      .mockResolvedValue({ terminationProtection: false, stopProtection: false }),
    getUserData: vi.fn().mockResolvedValue(""),
    launchInstances: vi.fn(),
    listKeyPairs: vi.fn().mockResolvedValue([]),
    listSecurityGroups: vi.fn().mockResolvedValue([]),
    listSubnets: vi.fn().mockResolvedValue([]),
  },
}));

import { api } from "@/lib/ec2-api";
import { useSettings } from "@/store/settings";
import { Ec2Page } from "./ec2";

function instance(over: Partial<Ec2InstanceSummary>): Ec2InstanceSummary {
  return {
    instanceId: "i-1",
    name: "web",
    instanceType: "t3.micro",
    state: "running",
    availabilityZone: "us-east-1a",
    publicIp: "1.2.3.4",
    privateIp: "10.0.0.5",
    launchTime: "2024-01-01T00:00:00.000Z",
    ...over,
  };
}

describe("Ec2Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettings.setState({ backend: "aws" });
  });
  afterEach(() => useSettings.setState({ backend: "none" }));

  it("renders rows when the api resolves data", async () => {
    vi.mocked(api.listInstances).mockResolvedValue([instance({})]);
    renderWithProviders(<Ec2Page />);
    expect(await screen.findByText("i-1")).toBeInTheDocument();
    expect(screen.getByText("web")).toBeInTheDocument();
    expect(screen.getByText("1.2.3.4")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listInstances).mockResolvedValue([]);
    renderWithProviders(<Ec2Page />);
    expect(await screen.findByText("No instances")).toBeInTheDocument();
  });

  it("shows the unsupported state when the backend rejects with a not-implemented error", async () => {
    vi.mocked(api.listInstances).mockRejectedValue({
      name: "InternalFailure",
      message: "DescribeInstances is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<Ec2Page />);
    await waitFor(() =>
      expect(screen.getByText("This backend does not support EC2.")).toBeInTheDocument(),
    );
  });

  it("enables start only for stopped instances and calls runAction('start')", async () => {
    vi.mocked(api.listInstances).mockResolvedValue([instance({ state: "stopped" })]);
    const { user } = renderWithProviders(<Ec2Page />);

    await user.click(await screen.findByText("i-1"));

    const start = screen.getByRole("button", { name: /Start/ });
    const stop = screen.getByRole("button", { name: /Stop/ });
    expect(start).toBeEnabled();
    expect(stop).toBeDisabled();

    await user.click(start);
    await waitFor(() => expect(api.runAction).toHaveBeenCalledWith("start", "i-1"));
  });

  it("enables stop/reboot for running instances and calls runAction('reboot')", async () => {
    vi.mocked(api.listInstances).mockResolvedValue([instance({ state: "running" })]);
    const { user } = renderWithProviders(<Ec2Page />);

    await user.click(await screen.findByText("i-1"));
    expect(screen.getByRole("button", { name: /Start/ })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: /Reboot/ }));
    await waitFor(() => expect(api.runAction).toHaveBeenCalledWith("reboot", "i-1"));
  });

  it("terminate goes through the confirm modal before calling runAction('terminate')", async () => {
    vi.mocked(api.listInstances).mockResolvedValue([instance({ state: "running" })]);
    const { user } = renderWithProviders(<Ec2Page />);

    await user.click(await screen.findByText("i-1"));
    await user.click(screen.getByRole("button", { name: /Terminate/ }));

    // A confirm dialog appears; the actual call only fires on confirm.
    expect(api.runAction).not.toHaveBeenCalled();
    const confirm = screen.getAllByRole("button", { name: /Terminate/ }).at(-1);
    if (!confirm) throw new Error("no confirm button");
    await user.click(confirm);
    await waitFor(() => expect(api.runAction).toHaveBeenCalledWith("terminate", "i-1"));
  });

  it("Floci exec button copies the docker exec command to the clipboard", async () => {
    useSettings.setState({ backend: "floci" });
    vi.mocked(api.listInstances).mockResolvedValue([instance({ state: "running" })]);
    const { user } = renderWithProviders(<Ec2Page />);

    await screen.findByText("i-1");
    // userEvent.setup() installs its own navigator.clipboard stub; spy on it
    // (defining our own beforehand would be clobbered by setup()).
    const writeText = vi.spyOn(navigator.clipboard, "writeText");
    await user.click(screen.getByTitle("Copy: docker exec into this Floci container"));

    await waitFor(() => expect(writeText).toHaveBeenCalledWith("docker exec -it floci-ec2-i-1 sh"));
  });
});
