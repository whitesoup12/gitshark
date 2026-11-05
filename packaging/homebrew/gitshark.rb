cask "gitshark" do
  arch arm: "aarch64", intel: "x64"

  version "2.1.3"
  sha256 arm:   "af2422161a0a494408d9d155bcb4aa2204dea98642c9203f3cc85aa1d829a841",
         intel: "93963bff02aee3ff8769b4f3768f0a1e612008fee044478572d5df24847c74f0"

  url "https://github.com/whitesoup12/gitshark/releases/download/v#{version}/GitShark_#{version}_#{arch}.dmg"
  name "GitShark"
  desc "Blazingly fast, modern Git desktop client built with Tauri v2 and Rust"
  homepage "https://github.com/whitesoup12/gitshark"

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
