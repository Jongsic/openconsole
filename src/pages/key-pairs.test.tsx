import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ec2KeyPairSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/ec2-api", () => ({
  api: {
    listKeyPairs: vi.fn(),
    createKeyPair: vi.fn().mockResolvedValue({ keyName: "demo", keyMaterial: "" }),
    importKeyPair: vi.fn().mockResolvedValue(undefined),
    deleteKeyPair: vi.fn().mockResolvedValue(undefined),
  },
}));

import { api } from "@/lib/ec2-api";
import { KeyPairsPage } from "./key-pairs";

const sample: Ec2KeyPairSummary = {
  keyPairId: "key-1",
  keyName: "demo",
  keyType: "rsa",
  fingerprint: "ab:cd",
  createTime: "2024-01-01T00:00:00.000Z",
};

describe("KeyPairsPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listKeyPairs).mockResolvedValue([sample]);
    renderWithProviders(<KeyPairsPage />);
    expect(await screen.findByText("demo")).toBeInTheDocument();
    expect(screen.getByText("key-1")).toBeInTheDocument();
  });

  it("renders the empty state for []", async () => {
    vi.mocked(api.listKeyPairs).mockResolvedValue([]);
    renderWithProviders(<KeyPairsPage />);
    expect(await screen.findByText("No key pairs")).toBeInTheDocument();
  });

  it("renders the unsupported state on a not-implemented error", async () => {
    vi.mocked(api.listKeyPairs).mockRejectedValue({
      name: "InternalFailure",
      message: "DescribeKeyPairs is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<KeyPairsPage />);
    await waitFor(() =>
      expect(screen.getByText("This backend does not support EC2 key pairs.")).toBeInTheDocument(),
    );
  });

  it("create modal sends name + key type to createKeyPair", async () => {
    vi.mocked(api.listKeyPairs).mockResolvedValue([]);
    const { user } = renderWithProviders(<KeyPairsPage />);
    await screen.findByText("No key pairs");

    await user.click(screen.getByRole("button", { name: /Create key pair/ }));
    await user.type(screen.getByLabelText("Name"), "my-key");
    await user.selectOptions(screen.getByLabelText("Key type"), "ed25519");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(api.createKeyPair).toHaveBeenCalledWith("my-key", "ed25519"));
  });

  it("import modal sends name + public key to importKeyPair", async () => {
    vi.mocked(api.listKeyPairs).mockResolvedValue([]);
    const { user } = renderWithProviders(<KeyPairsPage />);
    await screen.findByText("No key pairs");

    await user.click(screen.getByRole("button", { name: /Import/ }));
    await user.type(screen.getByLabelText("Name"), "imported");
    await user.type(screen.getByLabelText("Public key material"), "ssh-ed25519 AAAA user@host");
    // The modal's submit button is also labelled "Import".
    const importButtons = screen.getAllByRole("button", { name: /Import/ });
    await user.click(importButtons.at(-1) as HTMLElement);

    await waitFor(() =>
      expect(api.importKeyPair).toHaveBeenCalledWith("imported", "ssh-ed25519 AAAA user@host"),
    );
  });
});
