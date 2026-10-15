import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const pkgJson = JSON.parse(fs.readFileSync(path.join(rootDir, "package.json"), "utf8"));
const version = pkgJson.version || "0.1.0";

console.log(`\n========================================`);
console.log(`🚀 Packaging GitShark v${version} for Windows`);
console.log(`========================================\n`);

// 1. Build release binary without installer bundles
console.log(`📦 [1/5] Building release binary via Tauri CLI (--no-bundle)...`);
execSync("node scripts/run-tauri.mjs build --no-bundle", {
  stdio: "inherit",
  cwd: rootDir,
});

const exeSource = path.join(rootDir, "src-tauri", "target", "release", "gitshark.exe");
if (!fs.existsSync(exeSource)) {
  console.error(`❌ Build failed: Cannot find ${exeSource}`);
  process.exit(1);
}

// 2. Prepare release directories
const distDir = path.join(rootDir, "dist-release");
const portableDir = path.join(distDir, `gitshark-v${version}-portable`);
const zipFilename = `gitshark-v${version}-windows-x64-portable.zip`;
const zipPath = path.join(distDir, zipFilename);

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(portableDir, { recursive: true });

// 3. Assemble Portable Folder
console.log(`📁 [2/5] Assembling portable directory structure...`);
fs.copyFileSync(exeSource, path.join(portableDir, "gitshark.exe"));

const icoSource = path.join(rootDir, "src-tauri", "icons", "icon.ico");
if (fs.existsSync(icoSource)) {
  fs.copyFileSync(icoSource, path.join(portableDir, "gitshark.ico"));
}

const readmeContent = `GitShark v${version} (Portable Edition)
=====================================
Blazingly fast, modern Git desktop client built with Tauri v2 and Rust.

ZERO-ADMIN USAGE:
1. You can run 'gitshark.exe' directly from any folder in your user directory.
   Recommended location:
   %LOCALAPPDATA%\\GitShark\\ (e.g. C:\\Users\\<username>\\AppData\\Local\\GitShark\\)

PINNING TO TASKBAR:
- Right-click 'gitshark.exe' -> Select 'Pin to taskbar'.
- Works 100% in restricted environments without administrator rights or UAC prompts.

INSTALLING VIA SCOOP:
If you use Scoop on your machine:
  scoop install .\\packaging\\scoop\\gitshark.json

Website & Source: https://github.com/GitShark/gitshark
`;
fs.writeFileSync(path.join(portableDir, "README.txt"), readmeContent, "utf8");

// 4. Create ZIP archive
console.log(`🗜️  [3/5] Creating portable ZIP archive: ${zipFilename}...`);
try {
  // Use bsdtar or tar (standard in Windows 10/11)
  execSync(`tar -a -c -f "${zipPath}" -C "${portableDir}" *`, {
    stdio: "inherit",
    cwd: rootDir,
  });
} catch (err) {
  // Fallback to PowerShell Compress-Archive
  console.log("Falling back to PowerShell Compress-Archive...");
  execSync(`powershell -NoProfile -Command "Compress-Archive -Path '${portableDir}\\*' -DestinationPath '${zipPath}' -Force"`, {
    stdio: "inherit",
    cwd: rootDir,
  });
}

// 5. Compute SHA-256 hash and copy standalone executable
console.log(`🔐 [4/5] Computing SHA-256 checksums...`);
const standaloneExePath = path.join(distDir, "gitshark.exe");
fs.copyFileSync(exeSource, standaloneExePath);

const zipBuffer = fs.readFileSync(zipPath);
const sha256 = crypto.createHash("sha256").update(zipBuffer).digest("hex");
const fileSizeMB = (zipBuffer.length / (1024 * 1024)).toFixed(2);

const exeBuffer = fs.readFileSync(standaloneExePath);
const exeSha256 = crypto.createHash("sha256").update(exeBuffer).digest("hex");

const sumsContent = `${sha256}  ${zipFilename}\n${exeSha256}  gitshark.exe\n`;
fs.writeFileSync(path.join(distDir, "SHA256SUMS.txt"), sumsContent, "utf8");

console.log(`   ZIP SHA256: ${sha256} (${fileSizeMB} MB)`);
console.log(`   EXE SHA256: ${exeSha256}`);

// 6. Generate Scoop manifests
console.log(`📋 [5/5] Generating Scoop manifests...`);
let repoSlug = "whitesoup12/gitshark";
try {
  const remoteUrl = execSync("git remote get-url origin", { encoding: "utf8", cwd: rootDir }).trim();
  const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
  if (match) {
    repoSlug = `${match[1]}/${match[2]}`;
  }
} catch {}

const scoopDir = path.join(rootDir, "packaging", "scoop");
const bucketDir = path.join(rootDir, "bucket");
fs.mkdirSync(scoopDir, { recursive: true });
fs.mkdirSync(bucketDir, { recursive: true });

// A. Remote/GitHub Release manifest
const publicManifest = {
  version,
  description: "Blazingly fast, modern Git desktop client built with Tauri v2 and Rust",
  homepage: `https://github.com/${repoSlug}`,
  license: "MIT",
  architecture: {
    "64bit": {
      url: `https://github.com/${repoSlug}/releases/download/v${version}/${zipFilename}`,
      hash: sha256,
    },
  },
  bin: "gitshark.exe",
  shortcuts: [["gitshark.exe", "GitShark"]],
  checkver: "github",
  autoupdate: {
    architecture: {
      "64bit": {
        url: `https://github.com/${repoSlug}/releases/download/v$version/gitshark-v$version-windows-x64-portable.zip`,
      },
    },
  },
};

const manifestJson = JSON.stringify(publicManifest, null, 2) + "\n";
fs.writeFileSync(path.join(scoopDir, "gitshark.json"), manifestJson, "utf8");
fs.writeFileSync(path.join(bucketDir, "gitshark.json"), manifestJson, "utf8");

// B. Local manifest pointing to this machine's zip file
const localZipUri = `file:///${zipPath.replace(/\\/g, "/")}`;
const localManifest = {
  version,
  description: "GitShark (Local Portable Build for Scoop)",
  homepage: `https://github.com/${repoSlug}`,
  license: "MIT",
  architecture: {
    "64bit": {
      url: localZipUri,
      hash: sha256,
    },
  },
  bin: "gitshark.exe",
  shortcuts: [["gitshark.exe", "GitShark"]],
};

fs.writeFileSync(
  path.join(scoopDir, "gitshark-local.json"),
  JSON.stringify(localManifest, null, 2) + "\n",
  "utf8"
);

console.log(`\n========================================`);
console.log(`🎉 Packaging complete!`);
console.log(`========================================`);
console.log(`\n📌 1. PORTABLE DIRECTORY:`);
console.log(`   ${portableDir}`);
console.log(`   -> Copy this folder anywhere and right-click gitshark.exe -> "Pin to taskbar".`);
console.log(`\n📌 2. PORTABLE ZIP ARCHIVE:`);
console.log(`   ${zipPath} (${fileSizeMB} MB)`);
console.log(`\n📌 3. SCOOP LOCAL MANIFEST:`);
console.log(`   packaging/scoop/gitshark-local.json`);
console.log(`   -> Test on your PC: scoop install .\\packaging\\scoop\\gitshark-local.json`);
console.log(`\n📌 4. SCOOP REPO MANIFEST:`);
console.log(`   packaging/scoop/gitshark.json`);
console.log(`   -> Ready to upload to a Scoop bucket with release asset checksum.\n`);
