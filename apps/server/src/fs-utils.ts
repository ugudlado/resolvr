import fs from "node:fs";
import path from "node:path";

/** Atomic write: temp file + rename to prevent corruption on concurrent writes. */
export function atomicWriteSync(filePath: string, data: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmpFile = filePath + ".tmp." + process.pid + "." + Date.now();
  fs.writeFileSync(tmpFile, data);
  fs.renameSync(tmpFile, filePath);
}
