import { describe, expect, it } from "vitest";
import { classifyFailure } from "./detect";

describe("classifyFailure", () => {
  it("classifies invalid access key as credentials", () => {
    const r = classifyFailure({
      name: "InvalidAccessKeyId",
      message: "The Access Key Id you provided does not exist in our records.",
      $metadata: { httpStatusCode: 403 },
    });
    expect(r.kind).toBe("credentials");
  });

  it("classifies signature mismatch as credentials", () => {
    const r = classifyFailure({
      name: "SignatureDoesNotMatch",
      message: "The request signature we calculated does not match.",
      $metadata: { httpStatusCode: 403 },
    });
    expect(r.kind).toBe("credentials");
  });

  it("classifies a network/no-status error as cors", () => {
    const r = classifyFailure(new TypeError("Failed to fetch"));
    expect(r.kind).toBe("cors");
  });

  it("classifies a non-auth HTTP error as other", () => {
    const r = classifyFailure({
      name: "NoSuchBucket",
      message: "The specified bucket does not exist",
      $metadata: { httpStatusCode: 404 },
    });
    expect(r.kind).toBe("other");
  });

  it("includes a human-readable detail", () => {
    const r = classifyFailure({ name: "AccessDenied", message: "denied" });
    expect(r.kind).toBe("credentials");
    expect(r.detail).toContain("AccessDenied");
  });
});
