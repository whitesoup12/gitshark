#!/usr/bin/env node

/**
 * GitShark Version Bumper
 * 
 * Synchronizes and bumps the application version across all code files,
 * packaging manifests, and lockfiles:
 * - package.json & package-lock.json
 * - src-tauri/Cargo.toml (package version)
 * - src-tauri/tauri.conf.json
 * - src/constants/version.ts
 * - index.html (splash screen)
 * - Homebrew Casks (Casks/gitshark.rb, packaging/homebrew/gitshark.rb)
 * - Scoop manifests (packaging/scoop/gitshark.json, bucket/gitshark.json)
 * 
 * Usage:
 *   npm run bump patch          # 1.1.0 -> 1.1.1
 *   npm run bump minor          # 1.1.0 -> 1.2.0
 *   npm run bump major          # 1.1.0 -> 2.0.0
 *   npm run bump 1.2.0          # Set explicit version
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function parseSemver(v) {
  const clean = v.replace(/^v/, "").trim();
  const match = clean.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4] || null,
    raw: clean,
  };
}

const pkgPath = path.join(rootDir, "package.json");
const currentPkg = readJson(pkgPath);
const currentVersion = currentPkg.version;
const currentSem = parseSemver(currentVersion);

if (!currentSem) {
  console.error(`❌ Could not parse current version in package.json: "${currentVersion}"`);
  process.exit(1);
}

const arg = process.argv[2]?.trim();

if (!arg || arg === "--help" || arg === "-h") {
  console.log(`
🦈 GitShark Version Bumper
Current version: ${currentVersion}

Usage:
  npm run bump patch    # ${currentSem.major}.${currentSem.minor}.${currentSem.patch + 1}
  npm run bump minor    # ${currentSem.major}.${currentSem.minor + 1}.0
  npm run bump major    # ${currentSem.major + 1}.0.0
  npm run bump <semver> # Set specific version (e.g. npm run bump 1.2.0)
`);
  process.exit(0);
}

let newVersion = "";

if (arg === "patch") {
  newVersion = `${currentSem.major}.${currentSem.minor}.${currentSem.patch + 1}`;
} else if (arg === "minor") {
  newVersion = `${currentSem.major}.${currentSem.minor + 1}.0`;
} else if (arg === "major") {
  newVersion = `${currentSem.major + 1}.0.0`;
} else {
  const customSem = parseSemver(arg);
  if (!customSem) {
    console.error(`❌ Invalid semver version or bump type: "${arg}". Use patch, minor, major, or X.Y.Z.`);
    process.exit(1);
  }
  newVersion = customSem.raw;
}

if (newVersion === currentVersion) {
  console.log(`ℹ Version is already ${newVersion}. Nothing to bump.`);
  process.exit(0);
}

console.log(`\n🦈 Bumping GitShark version: v${currentVersion} -> v${newVersion}\n`);
const updatedFiles = [];

// 1. package.json
currentPkg.version = newVersion;
writeJson(pkgPath, currentPkg);
updatedFiles.push("package.json");

// 2. package-lock.json (if exists)
const lockPath = path.join(rootDir, "package-lock.json");
if (fs.existsSync(lockPath)) {
  const lockData = readJson(lockPath);
  lockData.version = newVersion;
  if (lockData.packages && lockData.packages[""]) {
    lockData.packages[""].version = newVersion;
  }
  writeJson(lockPath, lockData);
  updatedFiles.push("package-lock.json");
}

// 3. src-tauri/Cargo.toml
const cargoTomlPath = path.join(rootDir, "src-tauri", "Cargo.toml");
if (fs.existsSync(cargoTomlPath)) {
  let content = fs.readFileSync(cargoTomlPath, "utf8");
  // Only replace version in [package] section before dependencies
  content = content.replace(
    /(\[package\][\s\S]*?^version\s*=\s*")([^"]+)(")/m,
    `$1${newVersion}$3`
  );
  fs.writeFileSync(cargoTomlPath, content, "utf8");
  updatedFiles.push("src-tauri/Cargo.toml");
}

// 4. src-tauri/tauri.conf.json
const tauriConfPath = path.join(rootDir, "src-tauri", "tauri.conf.json");
if (fs.existsSync(tauriConfPath)) {
  const tauriConf = readJson(tauriConfPath);
  tauriConf.version = newVersion;
  writeJson(tauriConfPath, tauriConf);
  updatedFiles.push("src-tauri/tauri.conf.json");
}

// 5. src/constants/version.ts
const versionTsPath = path.join(rootDir, "src", "constants", "version.ts");
if (fs.existsSync(versionTsPath)) {
  const content = `export const APP_VERSION = "${newVersion}";\n`;
  fs.writeFileSync(versionTsPath, content, "utf8");
  updatedFiles.push("src/constants/version.ts");
}

// 6. index.html splash screen
const indexPath = path.join(rootDir, "index.html");
if (fs.existsSync(indexPath)) {
  let content = fs.readFileSync(indexPath, "utf8");
  content = content.replace(/(>\s*v)\d+\.\d+\.\d+(\s*<\/div>)/, `$1${newVersion}$2`);
  fs.writeFileSync(indexPath, content, "utf8");
  updatedFiles.push("index.html");
}

// 7. Homebrew Casks
const caskPaths = [
  path.join(rootDir, "Casks", "gitshark.rb"),
  path.join(rootDir, "packaging", "homebrew", "gitshark.rb"),
  path.join(rootDir, "packaging", "homebrew", "gitshark-local.rb"),
];
for (const cp of caskPaths) {
  if (fs.existsSync(cp)) {
    let content = fs.readFileSync(cp, "utf8");
    content = content.replace(/(version\s+")[^"]+(")/, `$1${newVersion}$2`);
    content = content.replace(/(GitShark_)[0-9a-zA-Z.-]+(_)/g, `$1${newVersion}$2`);
    fs.writeFileSync(cp, content, "utf8");
    updatedFiles.push(path.relative(rootDir, cp));
  }
}

// 8. Scoop manifests
const scoopPaths = [
  path.join(rootDir, "packaging", "scoop", "gitshark.json"),
  path.join(rootDir, "packaging", "scoop", "gitshark-local.json"),
  path.join(rootDir, "bucket", "gitshark.json"),
];
for (const sp of scoopPaths) {
  if (fs.existsSync(sp)) {
    let content = fs.readFileSync(sp, "utf8");
    // Replace "version": "..."
    content = content.replace(/("version":\s*")[^"]+(")/, `$1${newVersion}$2`);
    // Replace download URLs
    content = content.replace(/(releases\/download\/v)[0-9a-zA-Z.-]+(\/)/g, `$1${newVersion}$2`);
    content = content.replace(/(gitshark-v)[0-9a-zA-Z.-]+(-windows)/g, `$1${newVersion}$2`);
    fs.writeFileSync(sp, content, "utf8");
    updatedFiles.push(path.relative(rootDir, sp));
  }
}

// 9. Update Cargo.lock if cargo is available
try {
  execSync("cargo check --manifest-path src-tauri/Cargo.toml", { stdio: "ignore" });
  if (fs.existsSync(path.join(rootDir, "src-tauri", "Cargo.lock"))) {
    updatedFiles.push("src-tauri/Cargo.lock");
  }
} catch {
  // Cargo check will be run on pre-commit/build anyway
}

console.log("Updated files:");
for (const f of updatedFiles) {
  console.log(`  ✔ ${f}`);
}

console.log(`
🎉 Successfully bumped version to v${newVersion}!

Next suggested steps:
  1. git add -A
  2. git commit -m "chore: bump version to v${newVersion}"
  3. git push
`);
