import { describe, expect, it } from "vitest";
import { formatBytes, isImage, isTextLike, parentPrefix } from "./utils";

describe("formatBytes", () => {
  it("formats sizes across units", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(1536)).toBe("1.5 KB");
    expect(formatBytes(1024 * 1024)).toBe("1.0 MB");
    expect(formatBytes(1024 ** 3)).toBe("1.0 GB");
  });
});

describe("isImage", () => {
  it("detects image extensions", () => {
    expect(isImage("a/b/photo.png")).toBe(true);
    expect(isImage("logo.SVG")).toBe(true);
    expect(isImage("pic.jpeg")).toBe(true);
  });
  it("rejects non-images", () => {
    expect(isImage("notes.txt")).toBe(false);
    expect(isImage("data.json")).toBe(false);
    expect(isImage("folder/")).toBe(false);
  });
});

describe("isTextLike", () => {
  it("treats known text extensions and extensionless keys as text", () => {
    expect(isTextLike("config.json")).toBe(true);
    expect(isTextLike("README")).toBe(true);
    expect(isTextLike("a/b/notes.md")).toBe(true);
  });
  it("treats binaries and folders as non-text", () => {
    expect(isTextLike("image.png")).toBe(false);
    expect(isTextLike("archive.zip")).toBe(false);
    expect(isTextLike("folder/")).toBe(false);
  });
});

describe("parentPrefix", () => {
  it("returns null at root", () => {
    expect(parentPrefix("")).toBeNull();
  });
  it("returns root for one level deep", () => {
    expect(parentPrefix("logs/")).toBe("");
  });
  it("returns the parent prefix for nested paths", () => {
    expect(parentPrefix("a/b/c/")).toBe("a/b/");
    expect(parentPrefix("a/b/")).toBe("a/");
  });
});
