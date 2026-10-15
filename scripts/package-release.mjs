import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const rootDir = process.cwd();
const platform = os.platform();
const targetScript = platform === "darwin" ? "scripts/package-mac.mjs" : "scripts/package-win.mjs";

const result = spawnSync(process.execPath, [path.join(rootDir, targetScript), ...process.argv.slice(2)], {
  stdio: "inherit",
  cwd: rootDir,
});

process.exit(result.status ?? 0);
