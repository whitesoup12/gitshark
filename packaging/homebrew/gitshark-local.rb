cask "gitshark-local" do
  version "1.2.7"
  sha256 "ba76c11818eacea199aad03bd498c123e003bef9b22ef52808049874bfb9b7e5"

  url "file://#{File.expand_path('../../dist-release/GitShark_1.2.7_aarch64.dmg', __dir__)}"
  name "GitShark (Local Build)"
  desc "Blazingly fast, modern Git desktop client built with Tauri v2 and Rust"
  homepage "https://github.com/whitesoup12/gitshark"

  app "GitShark.app"
  binary "#{appdir}/GitShark.app/Contents/MacOS/gitshark", target: "gitshark"

  zap trash: [
    "~/Library/Application Support/com.gitshark.app",
    "~/Library/Caches/com.gitshark.app",
    "~/Library/Preferences/com.gitshark.app.plist",
    "~/Library/Saved Application State/com.gitshark.app.savedState",
    "~/Library/WebKit/com.gitshark.app",
  ]
end
