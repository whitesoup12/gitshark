use parking_lot::Mutex;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::Arc;
use std::thread;
use tauri::{AppHandle, Emitter};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalDataPayload {
    pub data: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TerminalExitPayload {
    pub exit_code: Option<u32>,
    pub success: bool,
}

pub struct ActivePtySession {
    writer: Arc<Mutex<Box<dyn Write + Send>>>,
    master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
    child: Arc<Mutex<Box<dyn Child + Send + Sync>>>,
}

#[derive(Default)]
pub struct PtyManager {
    active_session: Arc<Mutex<Option<ActivePtySession>>>,
}

impl PtyManager {
    pub fn new() -> Self {
        Self {
            active_session: Arc::new(Mutex::new(None)),
        }
    }

    /// Spawns a command (e.g., git hooks, git status, git fetch) inside a dedicated PTY
    /// and continuously emits chunks over IPC event `repo:{id}:terminal_data`.
    pub fn spawn(
        &self,
        repo_id: String,
        cwd: PathBuf,
        command: String,
        args: Vec<String>,
        cols: u16,
        rows: u16,
        app_handle: AppHandle,
    ) -> Result<(), String> {
        // Terminate any existing active PTY session for this repo before starting a new one
        self.kill();

        let pty_system = native_pty_system();
        let pair = pty_system
            .openpty(PtySize {
                rows: rows.max(10),
                cols: cols.max(20),
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to create PTY pair: {e}"))?;

        let mut cmd = CommandBuilder::new(&command);
        for arg in &args {
            cmd.arg(arg);
        }
        cmd.cwd(&cwd);

        // Inherit standard environment and enrich with Git CLI configs
        cmd.env("TERM", "xterm-256color");
        cmd.env("COLORTERM", "truecolor");

        // Ensure development tooling paths (Node, npx, pnpm, Cargo, Homebrew, Git)
        // are always available in GUI PTY sessions across all platforms.
        cmd.env("PATH", get_augmented_path());

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command '{command}': {e}"))?;

        // Explicitly drop slave handle so it doesn't keep the terminal open or block EOF
        drop(pair.slave);

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to get PTY reader: {e}"))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get PTY writer: {e}"))?;

        let child_arc = Arc::new(Mutex::new(child));
        let session = ActivePtySession {
            writer: Arc::new(Mutex::new(writer)),
            master: Arc::new(Mutex::new(pair.master)),
            child: child_arc.clone(),
        };

        {
            let mut guard = self.active_session.lock();
            *guard = Some(session);
        }

        // Spawn dedicated thread to stream stdout/stderr from PTY master
        let repo_id_for_reader = repo_id.clone();
        let app_handle_for_reader = app_handle.clone();

        thread::spawn(move || {
            let mut reader = reader;
            let mut buffer = [0u8; 4096];
            let event_name = format!("repo:{}:terminal_data", repo_id_for_reader);

            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break, // EOF reached
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buffer[..n]).to_string();
                        let _ = app_handle_for_reader.emit(&event_name, TerminalDataPayload { data: text });
                    }
                    Err(e) => {
                        log::debug!("PTY reader ended for repo {}: {}", repo_id_for_reader, e);
                        break;
                    }
                }
            }
        });

        // Spawn supervisor thread to monitor child exit and clean up PTY master handles.
        // On Windows ConPTY, reader.read() blocks until master is closed, so the child
        // must be waited on in parallel via try_wait() rather than after the read loop.
        let session_clone = self.active_session.clone();
        let repo_id_for_exit = repo_id.clone();
        let app_handle_for_exit = app_handle.clone();

        thread::spawn(move || {
            let exit_event_name = format!("repo:{}:terminal_exit", repo_id_for_exit);
            let mut exit_code = None;
            let mut success = false;

            loop {
                // Check if session was killed or cleared externally
                if session_clone.lock().is_none() {
                    break;
                }

                let wait_res = {
                    let mut child = child_arc.lock();
                    child.try_wait()
                };

                match wait_res {
                    Ok(Some(status)) => {
                        exit_code = Some(status.exit_code());
                        success = status.success();
                        break;
                    }
                    Ok(None) => {
                        thread::sleep(std::time::Duration::from_millis(50));
                    }
                    Err(e) => {
                        log::warn!("PTY try_wait error for repo {}: {}", repo_id_for_exit, e);
                        break;
                    }
                }
            }

            // Give reader thread a moment to drain remaining buffered output
            thread::sleep(std::time::Duration::from_millis(100));

            // Dropping active session drops pair.master and writer,
            // which closes the ConPTY handle on Windows and unblocks reader.read()
            {
                let mut guard = session_clone.lock();
                *guard = None;
            }

            let _ = app_handle_for_exit.emit(
                &exit_event_name,
                TerminalExitPayload {
                    exit_code,
                    success,
                },
            );
        });

        Ok(())
    }

    /// Write raw user keystrokes / input data directly to the active PTY stdin
    pub fn write(&self, data: &[u8]) -> Result<(), String> {
        let guard = self.active_session.lock();
        if let Some(session) = guard.as_ref() {
            let mut writer = session.writer.lock();
            writer
                .write_all(data)
                .map_err(|e| format!("Failed to write to PTY: {e}"))?;
            writer
                .flush()
                .map_err(|e| format!("Failed to flush PTY: {e}"))?;
            Ok(())
        } else {
            Err("No active PTY session to receive input".to_string())
        }
    }

    /// Resizes the pseudo-terminal window when Xterm.js dimensions change
    pub fn resize(&self, cols: u16, rows: u16) -> Result<(), String> {
        let guard = self.active_session.lock();
        if let Some(session) = guard.as_ref() {
            let master = session.master.lock();
            master
                .resize(PtySize {
                    rows: rows.max(5),
                    cols: cols.max(10),
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| format!("Failed to resize PTY: {e}"))?;
            Ok(())
        } else {
            // Not necessarily an error if terminal resized before PTY command starts
            Ok(())
        }
    }

    /// Cancel the active process gracefully with SIGINT (Ctrl+C), then kill
    pub fn cancel(&self) {
        let _ = self.write(&[0x03]); // ASCII ETX / Ctrl+C
        std::thread::sleep(std::time::Duration::from_millis(80));
        self.kill();
    }

    /// Kill the running child process and close the PTY
    pub fn kill(&self) {
        let mut guard = self.active_session.lock();
        if let Some(session) = guard.take() {
            let mut child = session.child.lock();
            let _ = child.kill();
        }
    }
}

impl Drop for PtyManager {
    fn drop(&mut self) {
        self.kill();
    }
}


/// Builds an augmented PATH environment variable that ensures developer tooling
/// (Node.js, npx, pnpm, yarn, bun, corepack, cargo, git, homebrew, etc.) is accessible
/// within GitShark's GUI-spawned processes and PTY sessions across macOS, Linux, and Windows.
pub fn get_augmented_path() -> std::ffi::OsString {
    let mut resolved_paths: Vec<PathBuf> = Vec::new();
    let mut seen: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();

    let mut add_path = |p: PathBuf| {
        if p.as_os_str().is_empty() {
            return;
        }
        #[cfg(windows)]
        let norm_key = PathBuf::from(p.to_string_lossy().to_lowercase());
        #[cfg(not(windows))]
        let norm_key = p.clone();

        if !seen.contains(&norm_key) {
            seen.insert(norm_key);
            resolved_paths.push(p);
        }
    };

    // 1. Explicitly check PNPM_HOME if set in current environment
    if let Ok(pnpm_home) = std::env::var("PNPM_HOME") {
        let pb = PathBuf::from(pnpm_home);
        if pb.is_dir() {
            add_path(pb);
        }
    }

    // 2. Platform-specific known development binary paths
    #[cfg(not(windows))]
    {
        // On Unix/macOS, query login shell PATH if available (inherits ~/.zprofile, ~/.zshrc, ~/.bashrc, etc.)
        if let Ok(shell) = std::env::var("SHELL") {
            let probe_cmd = if shell.ends_with("/zsh") {
                "if [ -f \"$HOME/.zprofile\" ]; then source \"$HOME/.zprofile\" 2>/dev/null; fi; if [ -f \"$HOME/.zshrc\" ]; then source \"$HOME/.zshrc\" 2>/dev/null; fi; printf \"%s\" \"$PATH\""
            } else if shell.ends_with("/bash") {
                "if [ -f \"$HOME/.bash_profile\" ]; then source \"$HOME/.bash_profile\" 2>/dev/null; elif [ -f \"$HOME/.profile\" ]; then source \"$HOME/.profile\" 2>/dev/null; fi; if [ -f \"$HOME/.bashrc\" ]; then source \"$HOME/.bashrc\" 2>/dev/null; fi; printf \"%s\" \"$PATH\""
            } else {
                "printf \"%s\" \"$PATH\""
            };

            if let Ok(output) = std::process::Command::new(&shell)
                .args(["-l", "-c", probe_cmd])
                .output()
            {
                if output.status.success() {
                    let shell_path_str = String::from_utf8_lossy(&output.stdout);
                    for path in std::env::split_paths(&shell_path_str.trim().to_string()) {
                        if path.is_dir() {
                            add_path(path);
                        }
                    }
                }
            }
        }

        // Add user-level version manager and tooling directories FIRST so they take
        // precedence over system or Rosetta-migrated binaries in /usr/local/bin.
        if let Ok(home) = std::env::var("HOME") {
            let home_paths = [
                // Node & version manager paths
                format!("{home}/.local/share/fnm"),
                format!("{home}/.fnm/current/bin"),
                format!("{home}/.volta/bin"),
                format!("{home}/.asdf/shims"),
                format!("{home}/.asdf/bin"),
                format!("{home}/.local/share/mise/shims"),
                format!("{home}/.local/share/mise/bin"),
                // pnpm standard paths
                format!("{home}/Library/pnpm"),
                format!("{home}/.local/share/pnpm"),
                format!("{home}/.pnpm-global/bin"),
                // Bun, Yarn, Cargo, Local
                format!("{home}/.bun/bin"),
                format!("{home}/.yarn/bin"),
                format!("{home}/.config/yarn/global/node_modules/.bin"),
                format!("{home}/.npm-global/bin"),
                format!("{home}/.cargo/bin"),
                format!("{home}/.local/bin"),
            ];
            for p in home_paths {
                let pb = PathBuf::from(p);
                if pb.is_dir() {
                    add_path(pb);
                }
            }

            // Also check nvm versions directory (~/.nvm/versions/node/*/bin), latest versions first
            let nvm_versions_dir = PathBuf::from(format!("{home}/.nvm/versions/node"));
            if nvm_versions_dir.is_dir() {
                if let Ok(entries) = std::fs::read_dir(nvm_versions_dir) {
                    let mut version_dirs: Vec<PathBuf> = Vec::new();
                    for entry in entries.flatten() {
                        let bin_dir = entry.path().join("bin");
                        if bin_dir.is_dir() {
                            version_dirs.push(bin_dir);
                        }
                    }
                    // Sort descending so newer Node versions take priority
                    version_dirs.sort_by(|a, b| b.cmp(a));
                    for bin_dir in version_dirs {
                        add_path(bin_dir);
                    }
                }
            }
        }

        // Apple Silicon homebrew (/opt/homebrew) MUST precede Intel (/usr/local)
        let unix_system_paths = [
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/local/bin",
            "/usr/local/sbin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
        ];
        for p in unix_system_paths {
            let pb = PathBuf::from(p);
            if pb.is_dir() {
                add_path(pb);
            }
        }
    }

    #[cfg(windows)]
    {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let win_local_paths = [
                format!("{local_app_data}\\pnpm"),
                format!("{local_app_data}\\Programs\\fnm"),
                format!("{local_app_data}\\Programs\\Git\\cmd"),
                format!("{local_app_data}\\Programs\\Git\\bin"),
                format!("{local_app_data}\\Programs\\Git\\usr\\bin"),
                format!("{local_app_data}\\Volta\\bin"),
            ];
            for p in win_local_paths {
                let pb = PathBuf::from(p);
                if pb.is_dir() {
                    add_path(pb);
                }
            }
        }

        if let Ok(app_data) = std::env::var("APPDATA") {
            let win_roaming_paths = [
                format!("{app_data}\\npm"),
                format!("{app_data}\\fnm"),
            ];
            for p in win_roaming_paths {
                let pb = PathBuf::from(p);
                if pb.is_dir() {
                    add_path(pb);
                }
            }
        }

        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let user_paths = [
                format!("{user_profile}\\.cargo\\bin"),
                format!("{user_profile}\\.bun\\bin"),
                format!("{user_profile}\\scoop\\shims"),
                format!("{user_profile}\\scoop\\apps\\git\\current\\bin"),
            ];
            for p in user_paths {
                let pb = PathBuf::from(p);
                if pb.is_dir() {
                    add_path(pb);
                }
            }
        }

        // Program Files standard 64-bit and 32-bit Node & Git locations
        let program_files = [
            "C:\\Program Files\\nodejs",
            "C:\\Program Files (x86)\\nodejs",
            "C:\\Program Files\\Git\\cmd",
            "C:\\Program Files\\Git\\bin",
            "C:\\Program Files\\Git\\usr\\bin",
            "C:\\Program Files (x86)\\Git\\cmd",
            "C:\\Program Files (x86)\\Git\\bin",
            "C:\\Program Files (x86)\\Git\\usr\\bin",
            "C:\\ProgramData\\chocolatey\\bin",
        ];
        for p in program_files {
            let pb = PathBuf::from(p);
            if pb.is_dir() {
                add_path(pb);
            }
        }
    }

    // 3. Append existing PATH entries from the current runtime environment
    if let Some(current_path_os) = std::env::var_os("PATH") {
        for path in std::env::split_paths(&current_path_os) {
            add_path(path);
        }
    }

    // 4. Safely join using OS-native delimiter (; on Windows, : on Unix)
    std::env::join_paths(resolved_paths).unwrap_or_else(|_| std::env::var_os("PATH").unwrap_or_default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_augmented_path_contains_valid_entries() {
        let path = get_augmented_path();
        assert!(!path.is_empty(), "Augmented path must not be empty");
        let entries: Vec<PathBuf> = std::env::split_paths(&path).collect();
        assert!(!entries.is_empty(), "Augmented path must contain entries");
    }
}
