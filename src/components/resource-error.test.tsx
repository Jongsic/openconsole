import { describe, expect, it } from "vitest";
import { renderWithProviders, screen } from "@/test/render";
import { ResourceError } from "./resource-error";

describe("ResourceError", () => {
  it("renders the calm unsupported state (with the service name, no raw detail)", () => {
    renderWithProviders(
      <ResourceError
        error={{ name: "NotYetImplemented", message: "not yet implemented" }}
        service="EBS"
      />,
    );
    expect(screen.getByText("This backend does not support EBS.")).toBeInTheDocument();
    // Unsupported keeps the raw detail subtle (hidden).
    expect(screen.queryByText(/NotYetImplemented/)).not.toBeInTheDocument();
  });

  it("renders the denied state and shows the raw detail", () => {
    renderWithProviders(
      <ResourceError error={{ name: "AccessDenied", message: "nope" }} service="EC2" />,
    );
    expect(
      screen.getByText("Access denied — your credentials lack permission for this action."),
    ).toBeInTheDocument();
    expect(screen.getByText("AccessDenied: nope")).toBeInTheDocument();
  });

  it("renders the network state for a no-status error", () => {
    renderWithProviders(
      <ResourceError error={{ name: "TypeError", message: "Failed to fetch" }} service="EC2" />,
    );
    expect(screen.getByText(/Cannot reach the endpoint/)).toBeInTheDocument();
  });

  it("renders the generic 'other' state for an unclassified status code", () => {
    renderWithProviders(
      <ResourceError
        error={{ name: "ValidationError", message: "bad", $metadata: { httpStatusCode: 400 } }}
        service="EC2"
      />,
    );
    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
  });
});
