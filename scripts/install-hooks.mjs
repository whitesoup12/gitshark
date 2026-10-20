#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const githooksDir = path.join(rootDir, ".githooks");

// 1. Configure Git to use version-controlled .githooks directory
try {
  execSync("git config core.hooksPath .githooks", { stdio: "ignore" });
  console.log("✔ Configured Git core.hooksPath to .githooks");
} catch (err) {
  console.warn("⚠️ Could not configure git core.hooksPath automatically:", err?.message || err);
}

// 2. Ensure executable permissions on all hook files in .githooks
if (fs.existsSync(githooksDir)) {
  const files = fs.readdirSync(githooksDir);
  for (const file of files) {
    const fullPath = path.join(githooksDir, file);
    try {
      fs.chmodSync(fullPath, 0o755);
    } catch {}
  }
}
