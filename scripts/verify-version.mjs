#!/usr/bin/env node

/**
 * GitShark Pre-Push Version Verifier
 * 
 * Ensures that:
 * 1. All version files across the project (package.json, Cargo.toml, tauri.conf.json,
 *    version.ts, index.html) are completely in sync.
 * 2. The current codebase version has not already been tagged/released on Git,
 *    preventing accidental pushes of new code without bumping the version.
 * 
 * Can be run manually:
 *   node scripts/verify-version.mjs
 * Or automatically via git pre-push hook.
 * 
 * To bypass in emergencies:
 *   git push --no-verify
 *   OR SKIP_VERSION_CHECK=1 git push
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

if (process.env.SKIP_VERSION_CHECK === "1" || process.env.SKIP_VERSION_CHECK === "true") {
  console.log("ℹ Skipping version verification (SKIP_VERSION_CHECK enabled).");
  process.exit(0);
}

const rootDir = process.cwd();

function runGit(cmd) {
  try {
    return execSync(`git ${cmd}`, { encoding: "utf8", stdio: ["pipe", "pipe", "ignore"] }).trim();
  } catch {
    return null;
  }
}

// 1. Collect versions from files
const versions = {};

// package.json
const pkgPath = path.join(rootDir, "package.json");
if (fs.existsSync(pkgPath)) {
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
  versions["package.json"] = pkg.version;
}

// src-tauri/Cargo.toml
const cargoPath = path.join(rootDir, "src-tauri", "Cargo.toml");
if (fs.existsSync(cargoPath)) {
  const content = fs.readFileSync(cargoPath, "utf8");
  const match = content.match(/\[package\][\s\S]*?^version\s*=\s*"([^"]+)"/m);
  if (match) {
    versions["src-tauri/Cargo.toml"] = match[1];
  }
}

// src-tauri/tauri.conf.json
const tauriPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
if (fs.existsSync(tauriPath)) {
  const tauriConf = JSON.parse(fs.readFileSync(tauriPath, "utf8"));
  versions["src-tauri/tauri.conf.json"] = tauriConf.version;
}

// src/constants/version.ts
const versionTsPath = path.join(rootDir, "src", "constants", "version.ts");
if (fs.existsSync(versionTsPath)) {
  const content = fs.readFileSync(versionTsPath, "utf8");
  const match = content.match(/APP_VERSION\s*=\s*"([^"]+)"/);
  if (match) {
    versions["src/constants/version.ts"] = match[1];
  }
}

// index.html
const indexPath = path.join(rootDir, "index.html");
if (fs.existsSync(indexPath)) {
  const content = fs.readFileSync(indexPath, "utf8");
  const match = content.match(/>\s*v(\d+\.\d+\.\d+)\s*<\/div>/);
  if (match) {
    versions["index.html"] = match[1];
  }
}

// 2. Verify all files have identical version
const uniqueVersions = Array.from(new Set(Object.values(versions)));

if (uniqueVersions.length === 0) {
  console.error("❌ Could not detect version from any project files.");
  process.exit(1);
}

if (uniqueVersions.length > 1) {
  console.error("\n❌ VERSION MISMATCH DETECTED ACROSS PROJECT FILES:");
  for (const [file, ver] of Object.entries(versions)) {
    console.error(`   - ${file.padEnd(28)} : ${ver}`);
  }
  console.error("\n👉 Fix this by running: npm run bump <new-version> (e.g. npm run bump minor)\n");
  process.exit(1);
}

const currentVersion = uniqueVersions[0];

// 3. Check if the current version tag has already been released in Git
const tagName = `v${currentVersion}`;
const tagCommit = runGit(`rev-list -n 1 refs/tags/${tagName}`);

if (tagCommit) {
  const headCommit = runGit("rev-parse HEAD");

  if (headCommit && tagCommit !== headCommit) {
    // Check if HEAD has new commits ahead of the tag
    const commitsAhead = runGit(`rev-list refs/tags/${tagName}..HEAD --count`);
    const count = parseInt(commitsAhead || "0", 10);

    if (count > 0) {
      console.error(`
================================================================================
🚨 GIT PRE-PUSH ERROR: VERSION NOT BUMPED!
================================================================================
Current codebase version is "${currentVersion}", but tag "${tagName}" has ALREADY
been released!

You have ${count} commit(s) ahead of "${tagName}" without bumping the version.
If you push now, your release will collide with the existing "${tagName}" release.

👉 HOW TO FIX:
   Run one of the following commands:
     npm run bump patch    # ${currentVersion} -> e.g. patch release
     npm run bump minor    # ${currentVersion} -> e.g. minor release
     npm run bump <semver> # set explicit version (e.g. 1.2.0)

   Then commit the version bump and push:
     git commit -am "chore: bump version to v<new-version>"
     git push

(To bypass this check in an emergency, use: git push --no-verify)
================================================================================
`);
      process.exit(1);
    }
  }
}

console.log(`✔ Version verification passed: v${currentVersion} (all ${Object.keys(versions).length} files synchronized)`);
process.exit(0);
