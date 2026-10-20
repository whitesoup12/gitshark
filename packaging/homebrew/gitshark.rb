cask "gitshark" do
  arch arm: "aarch64", intel: "x64"

  version "1.6.0"
  sha256 arm:   "400bc69ea4351c07c2a5f391c557ff12204f0592cf7f6850d9a2618492273239",
         intel: "4d3f179daeed347b27424569ba2277377f1bfeac37155df25d3a99680716e1c7"

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
