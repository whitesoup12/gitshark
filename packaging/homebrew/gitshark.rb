cask "gitshark" do
  arch arm: "aarch64", intel: "x64"

  version "1.5.0"
  sha256 arm:   "39a661247e85820e5fe64a98787a47a92d759f4301353f649179d0f431ab2e60",
         intel: "a26dc68e4b75e5c1aa34de16842b9b3ca3e7cb4636f03a84c69d4bbad00175e8"

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
