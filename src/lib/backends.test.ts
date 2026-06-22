import { describe, expect, it } from "vitest";
import { backendEntry, hasSection, sectionsFor } from "./backends";

describe("sectionsFor", () => {
  it("opens all sections for full backends (aws/floci/localstack/moto)", () => {
    for (const b of ["aws", "floci", "localstack", "moto"] as const) {
      expect(sectionsFor(b)).toEqual(["s3", "compute", "vpc", "db", "function"]);
    }
  });

  it("opens only s3 for minio and unknown", () => {
    expect(sectionsFor("minio")).toEqual(["s3"]);
    expect(sectionsFor("unknown")).toEqual(["s3"]);
  });

  it("opens nothing for 'none'", () => {
    expect(sectionsFor("none")).toEqual([]);
  });

  it("falls back to an empty section list for an unregistered backend", () => {
    // @ts-expect-error testing the closed/none-like fallback path
    expect(sectionsFor("does-not-exist")).toEqual([]);
    // @ts-expect-error label falls back to the kind
    expect(backendEntry("does-not-exist").label).toBe("does-not-exist");
  });
});

describe("hasSection", () => {
  it("is true for compute on a full backend, false on minio", () => {
    expect(hasSection("aws", "compute")).toBe(true);
    expect(hasSection("minio", "compute")).toBe(false);
    expect(hasSection("minio", "s3")).toBe(true);
  });

  it("is always false for 'none'", () => {
    expect(hasSection("none", "s3")).toBe(false);
    expect(hasSection("none", "compute")).toBe(false);
  });
});
