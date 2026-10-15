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

        let child = pair
            .slave
            .spawn_command(cmd)
            .map_err(|e| format!("Failed to spawn command '{command}': {e}"))?;

        let reader = pair
            .master
            .try_clone_reader()
            .map_err(|e| format!("Failed to get PTY reader: {e}"))?;

        let writer = pair
            .master
            .take_writer()
            .map_err(|e| format!("Failed to get PTY writer: {e}"))?;

        let session = ActivePtySession {
            writer: Arc::new(Mutex::new(writer)),
            master: Arc::new(Mutex::new(pair.master)),
            child: Arc::new(Mutex::new(child)),
        };

        {
            let mut guard = self.active_session.lock();
            *guard = Some(session);
        }

        // Spawn background thread to stream stdout/stderr from PTY master
        let session_clone = self.active_session.clone();
        let repo_id_for_thread = repo_id.clone();
        let app_handle_for_thread = app_handle.clone();

        thread::spawn(move || {
            let mut reader = reader;
            let mut buffer = [0u8; 4096];
            let event_name = format!("repo:{}:terminal_data", repo_id_for_thread);
            let exit_event_name = format!("repo:{}:terminal_exit", repo_id_for_thread);

            loop {
                match reader.read(&mut buffer) {
                    Ok(0) => break, // EOF reached
                    Ok(n) => {
                        let text = String::from_utf8_lossy(&buffer[..n]).to_string();
                        let _ = app_handle_for_thread.emit(&event_name, TerminalDataPayload { data: text });
                    }
                    Err(e) => {
                        // Broken pipe or closed terminal
                        log::debug!("PTY reader ended for repo {}: {}", repo_id_for_thread, e);
                        break;
                    }
                }
            }

            // Await child exit code
            let mut exit_code = None;
            let mut success = false;

            if let Some(active) = session_clone.lock().as_ref() {
                if let Ok(status) = active.child.lock().wait() {
                    exit_code = Some(status.exit_code());
                    success = status.success();
                }
            }

            let _ = app_handle_for_thread.emit(
                &exit_event_name,
                TerminalExitPayload {
                    exit_code,
                    success,
                },
            );

            // Clean up session reference once finished
            let mut guard = session_clone.lock();
            *guard = None;
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
