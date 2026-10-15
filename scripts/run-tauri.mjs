import { spawn } from "node:child_process";
import path from "node:path";
import os from "node:os";

// Guarantee that ~/.cargo/bin and node directory are present in PATH for Tauri CLI and cargo metadata
const cargoBin = path.join(os.homedir(), ".cargo", "bin");
const nodeBin = path.dirname(process.execPath);
let currentPath = process.env.PATH || "";

if (!currentPath.toLowerCase().includes(cargoBin.toLowerCase())) {
  currentPath = `${cargoBin}${path.delimiter}${currentPath}`;
}
if (!currentPath.toLowerCase().includes(nodeBin.toLowerCase())) {
  currentPath = `${nodeBin}${path.delimiter}${currentPath}`;
}
process.env.PATH = currentPath;

const args = process.argv.slice(2);
const isWindows = process.platform === "win32";
const tauriBin = path.join(
  process.cwd(),
  "node_modules",
  ".bin",
  isWindows ? "tauri.cmd" : "tauri"
);

const child = spawn(tauriBin, args, {
  stdio: "inherit",
  shell: true,
  env: process.env,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
