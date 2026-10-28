import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import os from "node:os";

const rootDir = process.cwd();
const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const args = process.argv.slice(2);
const versionArg = args.find((a) => a.startsWith("--version="))?.split("=")[1];
const envVersion = process.env.RELEASE_VERSION ? process.env.RELEASE_VERSION.replace(/^v/, "").trim() : null;
const version = versionArg || envVersion || pkgJson.version || "1.1.0";

const skipBuild = args.includes("--skip-build");
const manifestsOnly = args.includes("--manifests-only");
const archArg = args.find((a) => a.startsWith("--arch="))?.split("=")[1];
const targetArg = args.find((a) => a.startsWith("--target="))?.split("=")[1];

const distDir = path.join(rootDir, "dist-release");
const casksDir = path.join(rootDir, "Casks");
const brewDir = path.join(rootDir, "packaging", "homebrew");

fs.mkdirSync(distDir, { recursive: true });
fs.mkdirSync(casksDir, { recursive: true });
fs.mkdirSync(brewDir, { recursive: true });

// Resolve repository slug for GitHub URLs
let repoSlug = "whitesoup12/gitshark";
try {
  const remoteUrl = execSync("git remote get-url origin", { encoding: "utf8", cwd: rootDir }).trim();
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  if (match) {
    repoSlug = `${match[1]}/${match[2]}`;
  }
} catch {}

function computeFileSha256(filePath) {
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

function updateSha256SumsFile(entries) {
  const sumsPath = path.join(distDir, "SHA256SUMS.txt");
  let existingLines = [];
  if (fs.existsSync(sumsPath)) {
    existingLines = fs
      .readFileSync(sumsPath, "utf8")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
  }

  const map = new Map();
  for (const line of existingLines) {
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      map.set(parts.slice(1).join(" "), parts[0]);
    }
  }

  for (const [filename, hash] of Object.entries(entries)) {
    map.set(filename, hash);
  }

  const outputLines = Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([filename, hash]) => `${hash}  ${filename}`);

  fs.writeFileSync(sumsPath, outputLines.join("\n") + "\n", "utf8");
}

function renderCaskContent({ version, repoSlug, armHash, intelHash }) {
  let shaSection = "sha256 :no_check";
  const isValidHash = (h) => typeof h === "string" && h.length === 64 && !h.startsWith("0000") && !h.includes("PLACEHOLDER");
  if (isValidHash(armHash) && isValidHash(intelHash)) {
    shaSection = `sha256 arm:   "${armHash}",\n         intel: "${intelHash}"`;
  } else if (isValidHash(armHash)) {
    shaSection = `sha256 "${armHash}"`;
  } else if (isValidHash(intelHash)) {
    shaSection = `sha256 "${intelHash}"`;
  }

  return `cask "gitshark" do
  arch arm: "aarch64", intel: "x64"

  version "${version}"
  ${shaSection}

  url "https://github.com/${repoSlug}/releases/download/v#{version}/GitShark_#{version}_#{arch}.dmg"
  name "GitShark"
  desc "Blazingly fast, modern Git desktop client built with Tauri v2 and Rust"
  homepage "https://github.com/${repoSlug}"

  livecheck do
    url :url
    strategy :github_latest
  end

  depends_on :macos

  app "GitShark.app"
  binary "#{appdir}/GitShark.app/Contents/MacOS/gitshark", target: "gitshark"

  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-cr", "#{appdir}/GitShark.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/com.gitshark.app",
    "~/Library/Caches/com.gitshark.app",
    "~/Library/Preferences/com.gitshark.app.plist",
    "~/Library/Saved Application State/com.gitshark.app.savedState",
    "~/Library/WebKit/com.gitshark.app",
  ]

  caveats <<~EOS
    If you encounter a macOS Gatekeeper warning when opening GitShark, you can remove the quarantine attribute by running:
      xattr -cr /Applications/GitShark.app
  EOS
end
`;
}

function renderLocalCaskContent({ version, repoSlug, dmgPath, sha256 }) {
  const formattedPath = dmgPath.replace(/\\/g, "/");
  return `cask "gitshark-local" do
  version "${version}"
  sha256 "${sha256}"

  url "file://${formattedPath}"
  name "GitShark (Local Build)"
  desc "Blazingly fast, modern Git desktop client built with Tauri v2 and Rust"
  homepage "https://github.com/${repoSlug}"

  depends_on :macos

  app "GitShark.app"
  binary "#{appdir}/GitShark.app/Contents/MacOS/gitshark", target: "gitshark"

  postflight do
    system_command "/usr/bin/xattr",
                   args: ["-cr", "#{appdir}/GitShark.app"],
                   sudo: false
  end

  zap trash: [
    "~/Library/Application Support/com.gitshark.app",
    "~/Library/Caches/com.gitshark.app",
    "~/Library/Preferences/com.gitshark.app.plist",
    "~/Library/Saved Application State/com.gitshark.app.savedState",
    "~/Library/WebKit/com.gitshark.app",
  ]
end
`;
}

// -------------------------------------------------------------
// Mode 1: Manifests-only (used by CI to consolidate release artifacts)
// -------------------------------------------------------------
if (manifestsOnly) {
  console.log(`\n========================================`);
  console.log(`📋 Generating Homebrew Cask manifests for GitShark v${version}...`);
  console.log(`========================================\n`);

  // Locate and normalize arm DMG
  let armDmg = path.join(distDir, `GitShark_${version}_aarch64.dmg`);
  if (!fs.existsSync(armDmg)) {
    const found = fs.readdirSync(distDir).find((f) => f.endsWith(".dmg") && (f.includes("aarch64") || f.includes("arm64")));
    if (found) {
      const source = path.join(distDir, found);
      const canonical = path.join(distDir, `GitShark_${version}_aarch64.dmg`);
      if (source !== canonical) {
        fs.renameSync(source, canonical);
      }
      armDmg = canonical;
    }
  }

  // Locate and normalize intel DMG
  let intelDmg = path.join(distDir, `GitShark_${version}_x64.dmg`);
  if (!fs.existsSync(intelDmg)) {
    const found = fs.readdirSync(distDir).find((f) => f.endsWith(".dmg") && (f.includes("x64") || f.includes("x86_64")));
    if (found) {
      const source = path.join(distDir, found);
      const canonical = path.join(distDir, `GitShark_${version}_x64.dmg`);
      if (source !== canonical) {
        fs.renameSync(source, canonical);
      }
      intelDmg = canonical;
    }
  }

  // Normalize zip filenames to canonical version if present
  const armZipFound = fs.readdirSync(distDir).find((f) => f.endsWith(".zip") && (f.includes("aarch64") || f.includes("arm64")));
  if (armZipFound) {
    const canonicalArmZip = `GitShark_${version}_aarch64.zip`;
    if (armZipFound !== canonicalArmZip) {
      fs.renameSync(path.join(distDir, armZipFound), path.join(distDir, canonicalArmZip));
    }
  }
  const intelZipFound = fs.readdirSync(distDir).find((f) => f.endsWith(".zip") && (f.includes("x64") || f.includes("x86_64")));
  if (intelZipFound) {
    const canonicalIntelZip = `GitShark_${version}_x64.zip`;
    if (intelZipFound !== canonicalIntelZip) {
      fs.renameSync(path.join(distDir, intelZipFound), path.join(distDir, canonicalIntelZip));
    }
  }

  let armHash = fs.existsSync(armDmg) ? computeFileSha256(armDmg) : null;
  let intelHash = fs.existsSync(intelDmg) ? computeFileSha256(intelDmg) : null;

  // Try reading existing hashes from Casks/gitshark.rb if an architecture was not present in this local build
  const existingCaskPath = path.join(casksDir, "gitshark.rb");
  if (fs.existsSync(existingCaskPath)) {
    const existing = fs.readFileSync(existingCaskPath, "utf8");
    if (!armHash) {
      const armMatch = existing.match(/arm:\s*"([a-fA-F0-9]{64})"/);
      if (armMatch) armHash = armMatch[1];
    }
    if (!intelHash) {
      const intelMatch = existing.match(/intel:\s*"([a-fA-F0-9]{64})"/);
      if (intelMatch) intelHash = intelMatch[1];
    }
  }

  if (!armHash || !intelHash) {
    console.error(`❌ Release Error: Missing DMG files for Homebrew Cask generation!`);
    console.error(`   Expected: GitShark_${version}_aarch64.dmg and GitShark_${version}_x64.dmg in ${distDir}`);
    console.error(`   armHash:   ${armHash || "MISSING"}`);
    console.error(`   intelHash: ${intelHash || "MISSING"}`);
    console.error(`   Available files in dist-release:`, fs.readdirSync(distDir));
    process.exit(1);
  }

  const caskContent = renderCaskContent({ version, repoSlug, armHash, intelHash });
  fs.writeFileSync(path.join(casksDir, "gitshark.rb"), caskContent, "utf8");
  fs.writeFileSync(path.join(brewDir, "gitshark.rb"), caskContent, "utf8");

  // Sync Scoop manifest if present in dist-release
  const distScoop = path.join(distDir, "gitshark.json");
  if (fs.existsSync(distScoop)) {
    fs.copyFileSync(distScoop, path.join(rootDir, "packaging", "scoop", "gitshark.json"));
    fs.copyFileSync(distScoop, path.join(rootDir, "bucket", "gitshark.json"));
    console.log(`✅ Scoop manifest synchronized from dist-release/gitshark.json`);
  }

  // If a Windows zip was downloaded into dist-release, ensure scoop manifest hash matches and filename matches
  const winZip = fs.readdirSync(distDir).find((f) => f.includes("windows") && f.endsWith(".zip"));
  if (winZip) {
    const canonicalWinZip = `gitshark-v${version}-windows-x64-portable.zip`;
    let activeWinZip = winZip;
    if (winZip !== canonicalWinZip) {
      fs.renameSync(path.join(distDir, winZip), path.join(distDir, canonicalWinZip));
      activeWinZip = canonicalWinZip;
    }
    const winZipHash = computeFileSha256(path.join(distDir, activeWinZip));
    const scoopPath = path.join(rootDir, "packaging", "scoop", "gitshark.json");
    if (fs.existsSync(scoopPath)) {
      try {
        const scoopJson = JSON.parse(fs.readFileSync(scoopPath, "utf8"));
        scoopJson.version = version;
        if (scoopJson.architecture?.["64bit"]) {
          scoopJson.architecture["64bit"].hash = winZipHash;
          scoopJson.architecture["64bit"].url = `https://github.com/${repoSlug}/releases/download/v${version}/${activeWinZip}`;
          const updatedJson = JSON.stringify(scoopJson, null, 2) + "\n";
          fs.writeFileSync(scoopPath, updatedJson, "utf8");
          const bucketPath = path.join(rootDir, "bucket", "gitshark.json");
          fs.writeFileSync(bucketPath, updatedJson, "utf8");
          console.log(`✅ Scoop manifest verified & updated for ${activeWinZip}: ${winZipHash}`);
        }
      } catch (e) {
        console.warn(`   ⚠️ Warning updating scoop manifest: ${e.message}`);
      }
    }
  }

  // Re-hash all files in dist-release to ensure complete SHA256SUMS.txt
  const newSums = {};
  for (const file of fs.readdirSync(distDir)) {
    if (file === "SHA256SUMS.txt" || file.startsWith(".")) continue;
    const full = path.join(distDir, file);
    if (fs.statSync(full).isFile()) {
      newSums[file] = computeFileSha256(full);
    }
  }
  updateSha256SumsFile(newSums);

  console.log(`✅ Cask manifests generated with:`);
  console.log(`   version:         v${version}`);
  console.log(`   arm64 (aarch64): ${armHash}`);
  console.log(`   intel (x64):     ${intelHash}`);
  process.exit(0);
}

// -------------------------------------------------------------
// Mode 2: Local / CI Build & Packaging
// -------------------------------------------------------------
let resolvedArch = archArg;
if (!resolvedArch) {
  if (targetArg) {
    if (targetArg.includes("aarch64")) resolvedArch = "aarch64";
    else if (targetArg.includes("x86_64")) resolvedArch = "x64";
  }
}
if (!resolvedArch) {
  resolvedArch = os.arch() === "arm64" ? "aarch64" : "x64";
}

console.log(`\n========================================`);
console.log(`🚀 Packaging GitShark v${version} for macOS (${resolvedArch})`);
console.log(`========================================\n`);

// 1. Build via Tauri CLI
if (!skipBuild) {
  console.log(`📦 [1/5] Building macOS bundles via Tauri CLI...`);
  const targetFlag = targetArg ? ` --target ${targetArg}` : "";
  execSync(`node scripts/run-tauri.mjs build${targetFlag}`, {
    stdio: "inherit",
    cwd: rootDir,
  });
} else {
  console.log(`⏩ [1/5] Skipping build (--skip-build specified)...`);
}

// 2. Locate generated DMG or .app bundle
console.log(`🔍 [2/5] Locating build outputs...`);
const searchDirs = [
  path.join(rootDir, "src-tauri", "target", targetArg || "", "release", "bundle", "dmg"),
  path.join(rootDir, "src-tauri", "target", "release", "bundle", "dmg"),
].filter(fs.existsSync);

let foundDmgPath = null;
for (const dir of searchDirs) {
  const files = fs.readdirSync(dir);
  const dmg = files.find((f) => f.endsWith(".dmg"));
  if (dmg) {
    foundDmgPath = path.join(dir, dmg);
    break;
  }
}

const appSearchDirs = [
  path.join(rootDir, "src-tauri", "target", targetArg || "", "release", "bundle", "macos", "GitShark.app"),
  path.join(rootDir, "src-tauri", "target", "release", "bundle", "macos", "GitShark.app"),
];
const foundAppPath = appSearchDirs.find(fs.existsSync);

const targetDmgName = `GitShark_${version}_${resolvedArch}.dmg`;
const targetDmgPath = path.join(distDir, targetDmgName);

// Ensure .app bundle has a valid sealed ad-hoc signature (fixes Apple Silicon "Move to Trash" error
// caused by unsealed linker-signed Mach-O binaries inside .app bundles)
let appWasResigned = false;
if (foundAppPath) {
  try {
    execSync(`codesign --verify --deep --strict "${foundAppPath}"`, { stdio: "pipe" });
    console.log(`   ✅ Verified sealed bundle signature on ${foundAppPath}`);
  } catch {
    console.log(`   🔏 Applying ad-hoc bundle signature to ${foundAppPath}...`);
    execSync(`codesign --force --deep --sign - "${foundAppPath}"`, { stdio: "inherit" });
    appWasResigned = true;
  }
}

if (foundDmgPath && !appWasResigned) {
  console.log(`   Found DMG: ${foundDmgPath}`);
  fs.copyFileSync(foundDmgPath, targetDmgPath);
} else if (foundAppPath) {
  console.log(
    appWasResigned
      ? `   Rebuilding DMG from newly signed ${foundAppPath} using hdiutil...`
      : `   DMG not found directly, but found ${foundAppPath}. Creating DMG using hdiutil...`
  );
  try {
    if (fs.existsSync(targetDmgPath)) fs.unlinkSync(targetDmgPath);
    const dmgStageDir = fs.mkdtempSync(path.join(os.tmpdir(), "gitshark-dmg-"));
    try {
      execSync(`ditto "${foundAppPath}" "${path.join(dmgStageDir, "GitShark.app")}"`, { stdio: "inherit" });
      fs.symlinkSync("/Applications", path.join(dmgStageDir, "Applications"));
      execSync(
        `hdiutil create -volname "GitShark" -srcfolder "${dmgStageDir}" -ov -format UDZO "${targetDmgPath}"`,
        { stdio: "inherit", cwd: rootDir }
      );
    } finally {
      fs.rmSync(dmgStageDir, { recursive: true, force: true });
    }
  } catch (err) {
    console.error(`❌ Failed to create DMG with hdiutil: ${err.message}`);
    process.exit(1);
  }
} else {
  console.error(`❌ Could not locate DMG or GitShark.app in src-tauri/target/!`);
  console.error(`   Searched:`);
  console.error(`   - ${searchDirs.join("\n   - ")}`);
  console.error(`   - ${appSearchDirs.join("\n   - ")}`);
  process.exit(1);
}

try {
  execSync(`codesign --force --sign - "${targetDmgPath}"`, { stdio: "pipe" });
} catch {}

// 3. Create standalone .zip archive of the app bundle if present
const zipName = `GitShark_${version}_${resolvedArch}.zip`;
const targetZipPath = path.join(distDir, zipName);
if (foundAppPath) {
  console.log(`🗜️  [3/5] Creating portable macOS ZIP archive: ${zipName}...`);
  try {
    if (fs.existsSync(targetZipPath)) fs.unlinkSync(targetZipPath);
    const parentDir = path.dirname(foundAppPath);
    const appDirName = path.basename(foundAppPath);
    execSync(`ditto -c -k --keepParent "${appDirName}" "${targetZipPath}"`, {
      stdio: "inherit",
      cwd: parentDir,
    });
  } catch (err) {
    console.warn(`   ⚠️ Warning: Failed to create zip with ditto: ${err.message}`);
  }
}

// 4. Compute SHA-256 Checksums
console.log(`🔐 [4/5] Computing SHA-256 checksums...`);
const dmgSha256 = computeFileSha256(targetDmgPath);
const dmgSizeMB = (fs.statSync(targetDmgPath).size / (1024 * 1024)).toFixed(2);
console.log(`   DMG SHA256: ${dmgSha256} (${dmgSizeMB} MB) -> ${targetDmgName}`);

const checksumEntries = { [targetDmgName]: dmgSha256 };
if (fs.existsSync(targetZipPath)) {
  const zipSha256 = computeFileSha256(targetZipPath);
  checksumEntries[zipName] = zipSha256;
  console.log(`   ZIP SHA256: ${zipSha256} -> ${zipName}`);
}
updateSha256SumsFile(checksumEntries);

// 5. Generate Homebrew manifests
console.log(`📋 [5/5] Generating Homebrew Cask manifests...`);
const armHash = resolvedArch === "aarch64" ? dmgSha256 : "PLACEHOLDER_ARM64_SHA256";
const intelHash = resolvedArch === "x64" ? dmgSha256 : "PLACEHOLDER_INTEL_SHA256";

const publicCask = renderCaskContent({ version, repoSlug, armHash, intelHash });
fs.writeFileSync(path.join(casksDir, "gitshark.rb"), publicCask, "utf8");
fs.writeFileSync(path.join(brewDir, "gitshark.rb"), publicCask, "utf8");

const localCask = renderLocalCaskContent({
  version,
  repoSlug,
  dmgPath: targetDmgPath,
  sha256: dmgSha256,
});
fs.writeFileSync(path.join(brewDir, "gitshark-local.rb"), localCask, "utf8");

console.log(`\n========================================`);
console.log(`🎉 macOS Packaging complete!`);
console.log(`========================================`);
console.log(`\n📌 1. DIST DMG DISK IMAGE:`);
console.log(`   ${targetDmgPath}`);
console.log(`\n📌 2. HOMEBREW LOCAL MANIFEST (For testing locally on your Mac):`);
console.log(`   packaging/homebrew/gitshark-local.rb`);
console.log(`   -> Test now: brew install --cask ./packaging/homebrew/gitshark-local.rb`);
console.log(`\n📌 3. HOMEBREW TAP CASKS (Ready for release):`);
console.log(`   Casks/gitshark.rb`);
console.log(`   packaging/homebrew/gitshark.rb`);
console.log(`   -> Users can install via:`);
console.log(`      brew tap ${repoSlug} https://github.com/${repoSlug}`);
console.log(`      brew install --cask gitshark\n`);
