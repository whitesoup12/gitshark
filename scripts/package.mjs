import { spawnSync } from "node:child_process";
import path from "node:path";
import os from "node:os";

const rootDir = process.cwd();
const platform = os.platform();
const args = process.argv.slice(2);

let scriptName = "scripts/package-win.mjs";
if (platform === "darwin" || args.includes("--mac") || args.includes("--brew")) {
  scriptName = "scripts/package-mac.mjs";
} else if (platform === "win32" || args.includes("--win") || args.includes("--windows")) {
  scriptName = "scripts/package-win.mjs";
}

const filteredArgs = args.filter((a) => !["--mac", "--brew", "--win", "--windows"].includes(a));

console.log(`🧭 Delegating packaging to ${scriptName} (platform: ${platform})...\n`);
const result = spawnSync(process.execPath, [path.join(rootDir, scriptName), ...filteredArgs], {
  stdio: "inherit",
  cwd: rootDir,
});

process.exit(result.status ?? 0);
