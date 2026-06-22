import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ec2VolumeSummary } from "@/lib/types";
import { renderWithProviders, screen, waitFor } from "@/test/render";

vi.mock("@/lib/ec2-api", () => ({
  api: { listVolumes: vi.fn() },
}));

import { api } from "@/lib/ec2-api";
import { VolumesPage } from "./volumes";

const sampleVolume: Ec2VolumeSummary = {
  volumeId: "vol-0abc",
  size: 8,
  volumeType: "gp3",
  iops: 3000,
  throughput: 125,
  state: "available",
  encrypted: true,
  availabilityZone: "us-east-1a",
  createTime: "2024-01-01T00:00:00.000Z",
  attachments: [],
};

describe("VolumesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a row when the api resolves data", async () => {
    vi.mocked(api.listVolumes).mockResolvedValue([sampleVolume]);
    renderWithProviders(<VolumesPage />);

    expect(await screen.findByText("vol-0abc")).toBeInTheDocument();
    expect(screen.getByText("gp3")).toBeInTheDocument();
  });

  it("renders the empty state when the api resolves []", async () => {
    vi.mocked(api.listVolumes).mockResolvedValue([]);
    renderWithProviders(<VolumesPage />);

    expect(await screen.findByText("No volumes")).toBeInTheDocument();
  });

  it("renders the calm 'not supported' state on a not-implemented error", async () => {
    // A backend that doesn't emulate EBS — our code must show the unsupported
    // copy via the real classifyAwsError/ResourceError, not crash.
    vi.mocked(api.listVolumes).mockRejectedValue({
      name: "InternalFailure",
      message: "API for service 'ec2' action 'DescribeVolumes' is not yet implemented",
      $metadata: { httpStatusCode: 500 },
    });
    renderWithProviders(<VolumesPage />);

    await waitFor(() =>
      expect(screen.getByText("This backend does not support EBS.")).toBeInTheDocument(),
    );
  });
});
