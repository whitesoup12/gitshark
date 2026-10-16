cask "gitshark" do
  arch arm: "aarch64", intel: "x64"

  version "1.3.1"
  sha256 arm:   "3dde9464b4cec2a41a1d98b11a7ac33afffa54e179101d228bb9814cfa5dd911",
         intel: "f290c10f26f8dc8bca762749748f3a4b4abdc185a787d1c8cb8b9864ba9fc38d"

  url "https://github.com/whitesoup12/gitshark/releases/download/v#{version}/GitShark_#{version}_#{arch}.dmg"
  name "GitShark"
  desc "Blazingly fast, modern Git desktop client built with Tauri v2 and Rust"
  homepage "https://github.com/whitesoup12/gitshark"

  livecheck do
    url :url
    strategy :github_latest
  end

  auto_updates true

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
