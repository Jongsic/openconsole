import { describe, expect, it } from "vitest";
import { classifyAwsError } from "./aws-error";

describe("classifyAwsError", () => {
  it("classifies LocalStack Pro/license signal as unsupported", () => {
    expect(
      classifyAwsError({
        name: "InternalFailure",
        message: "This API call is not included in your current license plan",
        $metadata: { httpStatusCode: 500 },
      }).kind,
    ).toBe("unsupported");
  });

  it("classifies an explicit 'is a Pro feature' message as unsupported", () => {
    expect(classifyAwsError({ message: "ElastiCache is a Pro feature", $metadata: {} }).kind).toBe(
      "unsupported",
    );
  });

  it("classifies moto NotYetImplemented as unsupported", () => {
    expect(
      classifyAwsError({
        name: "NotYetImplemented",
        message: "The action is not yet implemented",
        $metadata: { httpStatusCode: 404 },
      }).kind,
    ).toBe("unsupported");
  });

  it("classifies a bare 501 (no denied signal) as unsupported", () => {
    expect(classifyAwsError({ $metadata: { httpStatusCode: 501 } }).kind).toBe("unsupported");
  });

  it("does NOT mask a 501 that is actually an access-denied", () => {
    expect(
      classifyAwsError({
        name: "AccessDenied",
        message: "no",
        $metadata: { httpStatusCode: 501 },
      }).kind,
    ).toBe("denied");
  });

  it("classifies AccessDenied / UnauthorizedOperation as denied", () => {
    expect(classifyAwsError({ name: "AccessDenied", message: "x" }).kind).toBe("denied");
    expect(classifyAwsError({ name: "UnauthorizedOperation", message: "x" }).kind).toBe("denied");
  });

  it("classifies HTTP 403 / 401 as denied", () => {
    expect(classifyAwsError({ $metadata: { httpStatusCode: 403 } }).kind).toBe("denied");
    expect(classifyAwsError({ $metadata: { httpStatusCode: 401 } }).kind).toBe("denied");
  });

  it("classifies a status code we cannot place as 'other' (surfaced, not masked)", () => {
    expect(
      classifyAwsError({
        name: "ValidationError",
        message: "bad",
        $metadata: { httpStatusCode: 400 },
      }).kind,
    ).toBe("other");
  });

  it("classifies a no-status error as network (CORS/unreachable)", () => {
    expect(classifyAwsError({ name: "TypeError", message: "Failed to fetch" }).kind).toBe(
      "network",
    );
  });

  it("classifies a plain object with no signals as network", () => {
    expect(classifyAwsError({}).kind).toBe("network");
  });

  it("builds a readable detail from name + message", () => {
    expect(classifyAwsError({ name: "Foo", message: "bar", $metadata: {} }).detail).toBe(
      "Foo: bar",
    );
    expect(classifyAwsError({}).detail).toBe("error");
  });
});
