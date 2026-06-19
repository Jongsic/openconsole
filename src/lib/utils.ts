import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** i;
  return `${value.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function formatDate(iso: string | null, locale?: string): string {
  if (!iso) return "-";
  return new Date(iso).toLocaleString(locale);
}

const TEXT_EXT = [
  "txt",
  "json",
  "csv",
  "tsv",
  "md",
  "markdown",
  "log",
  "xml",
  "yml",
  "yaml",
  "html",
  "htm",
  "css",
  "js",
  "ts",
  "jsx",
  "tsx",
  "sh",
  "env",
  "ini",
  "conf",
  "toml",
  "sql",
  "py",
  "go",
  "java",
  "properties",
];

/** Heuristically decide whether a key is text-editable, by extension */
export function isTextLike(key: string): boolean {
  if (key.endsWith("/")) return false;
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return TEXT_EXT.includes(ext) || !key.includes(".");
}

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"];

/** Heuristically decide whether a key is an image, by extension */
export function isImage(key: string): boolean {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXT.includes(ext);
}

/** Parent prefix of the current prefix (null at root) */
export function parentPrefix(prefix: string): string | null {
  if (!prefix) return null;
  const segs = prefix.replace(/\/$/, "").split("/");
  segs.pop();
  return segs.length ? `${segs.join("/")}/` : "";
}
