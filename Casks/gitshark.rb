cask "gitshark" do
  arch arm: "aarch64", intel: "x64"

  version "1.2.5"
  sha256 arm:   "ba76c11818eacea199aad03bd498c123e003bef9b22ef52808049874bfb9b7e5",
         intel: "ba76c11818eacea199aad03bd498c123e003bef9b22ef52808049874bfb9b7e5"

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
