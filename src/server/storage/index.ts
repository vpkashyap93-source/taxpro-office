import "server-only";
import path from "node:path";
import { LocalStorageDriver } from "./local";
import type { StorageDriver } from "./types";

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  const kind = process.env.STORAGE_DRIVER ?? "local";
  switch (kind) {
    case "local":
      driver = new LocalStorageDriver(path.resolve(process.env.STORAGE_LOCAL_DIR ?? "./data/uploads"));
      return driver;
    default:
      // Cloud drivers (e.g. "s3") plug in here; credentials come from environment variables.
      throw new Error(`Storage driver "${kind}" is not configured in this build.`);
  }
}

export const MAX_UPLOAD_BYTES = Math.max(1, Number(process.env.UPLOAD_MAX_MB ?? 15)) * 1024 * 1024;

export const ALLOWED_MIME = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "text/csv",
  "text/plain",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/zip",
]);
