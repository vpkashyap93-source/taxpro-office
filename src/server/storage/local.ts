import fs from "node:fs/promises";
import path from "node:path";
import type { StorageDriver } from "./types";

/** Stores files on the local filesystem. Keys are generated server-side (never user-controlled). */
export class LocalStorageDriver implements StorageDriver {
  readonly name = "local";
  constructor(private readonly root: string) {}

  private resolve(key: string) {
    if (!/^[A-Za-z0-9/_.-]+$/.test(key) || key.includes("..")) throw new Error("Invalid storage key");
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Invalid storage key");
    return full;
  }

  async put(key: string, data: Buffer) {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
  }

  async get(key: string) {
    try {
      return await fs.readFile(this.resolve(key));
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await fs.rm(this.resolve(key), { force: true });
  }
}
