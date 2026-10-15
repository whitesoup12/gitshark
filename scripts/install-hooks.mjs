#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const gitHooksDir = path.join(rootDir, ".git", "hooks");

if (!fs.existsSync(gitHooksDir)) {
  console.log("ℹ No .git/hooks directory found (bare repo or shallow clone). Skipping hook installation.");
  process.exit(0);
}

const prePushScript = `#!/usr/bin/env bash
# GitShark pre-push hook to ensure versions are synchronized and bumped before release

# Resolve node path
NODE_BIN="$(command -v node 2>/dev/null)"
if [ -z "$NODE_BIN" ]; then
  # Fallback to nvm if present
  [ -s "$HOME/.nvm/nvm.sh" ] && \\. "$HOME/.nvm/nvm.sh"
  NODE_BIN="$(command -v node 2>/dev/null)"
fi

if [ -n "$NODE_BIN" ]; then
  "$NODE_BIN" scripts/verify-version.mjs
  exit $?
else
  echo "⚠️ Node.js not detected in PATH, skipping version verification."
  exit 0
fi
`;

const hookTarget = path.join(gitHooksDir, "pre-push");
fs.writeFileSync(hookTarget, prePushScript, { mode: 0o755 });
try {
  fs.chmodSync(hookTarget, 0o755);
} catch {}

console.log("✔ Installed Git pre-push hook at .git/hooks/pre-push");
