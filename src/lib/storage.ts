import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const STORAGE_DIR = path.resolve(
  process.cwd(),
  process.env.STORAGE_DIR ?? "./storage",
);

export const storageRoot = STORAGE_DIR;

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

export async function saveFile(opts: {
  bucket: "photos" | "documents" | "exports";
  subpath: string;
  data: Buffer | Uint8Array;
}): Promise<string> {
  const dir = path.join(STORAGE_DIR, opts.bucket, path.dirname(opts.subpath));
  await ensureDir(dir);
  const filePath = path.join(STORAGE_DIR, opts.bucket, opts.subpath);
  await fs.writeFile(filePath, opts.data);
  return path.relative(STORAGE_DIR, filePath);
}

export async function readFile(relPath: string): Promise<Buffer> {
  const full = path.join(STORAGE_DIR, relPath);
  if (!full.startsWith(STORAGE_DIR)) {
    throw new Error("Path traversal blocked");
  }
  return fs.readFile(full);
}

// Overwrite an existing file at the given relative storage path.
export async function writeFile(
  relPath: string,
  data: Buffer | Uint8Array,
): Promise<void> {
  const full = path.join(STORAGE_DIR, relPath);
  if (!full.startsWith(STORAGE_DIR)) {
    throw new Error("Path traversal blocked");
  }
  await fs.writeFile(full, data);
}

export async function deleteFile(relPath: string): Promise<void> {
  const full = path.join(STORAGE_DIR, relPath);
  if (!full.startsWith(STORAGE_DIR)) return;
  await fs.unlink(full).catch(() => {});
}

export function extFromMime(mime: string): string {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "application/pdf": "pdf",
  };
  return map[mime] ?? "bin";
}

export function randomId(): string {
  return crypto.randomBytes(8).toString("hex");
}

export function fullPath(relPath: string): string {
  return path.join(STORAGE_DIR, relPath);
}
