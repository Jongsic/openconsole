import { describe, expect, it } from "vitest";
import { parsePortRange, splitCidrs } from "./inputs";

describe("parsePortRange", () => {
  it("treats empty / whitespace as all ports (null)", () => {
    expect(parsePortRange("")).toBeNull();
    expect(parsePortRange("   ")).toBeNull();
  });

  it("expands a single port into a from===to range", () => {
    expect(parsePortRange("80")).toEqual({ from: 80, to: 80 });
    expect(parsePortRange("443")).toEqual({ from: 443, to: 443 });
  });

  it("parses an explicit range", () => {
    expect(parsePortRange("8000-8010")).toEqual({ from: 8000, to: 8010 });
  });

  it("tolerates surrounding whitespace", () => {
    expect(parsePortRange("  80 - 90 ")).toEqual({ from: 80, to: 90 });
  });

  it("throws on non-numeric input (the NaN-port regression)", () => {
    expect(() => parsePortRange("abc")).toThrow();
    expect(() => parsePortRange("80-x")).toThrow();
    expect(() => parsePortRange("x-80")).toThrow();
  });
});

describe("splitCidrs", () => {
  it("returns a single trimmed CIDR", () => {
    expect(splitCidrs("0.0.0.0/0")).toEqual(["0.0.0.0/0"]);
    expect(splitCidrs("  10.0.0.0/8  ")).toEqual(["10.0.0.0/8"]);
  });

  it("splits comma-separated CIDRs and drops empties", () => {
    expect(splitCidrs("10.0.0.0/8, , 0.0.0.0/0 ")).toEqual(["10.0.0.0/8", "0.0.0.0/0"]);
  });

  it("returns an empty list for blank input", () => {
    expect(splitCidrs("")).toEqual([]);
    expect(splitCidrs(" , , ")).toEqual([]);
  });
});
