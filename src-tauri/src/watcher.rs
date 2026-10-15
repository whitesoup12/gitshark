use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::mpsc::{channel, RecvTimeoutError};
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

// Global configurable debounce delay window in milliseconds.
// Default to 1500ms trailing quiet window to comfortably accommodate AI agent file write bursts.
static DEBOUNCE_WINDOW_MS: AtomicU64 = AtomicU64::new(1500);

pub fn set_debounce_window_ms(ms: u64) {
    let clamped = ms.clamp(200, 10000);
    DEBOUNCE_WINDOW_MS.store(clamped, Ordering::Relaxed);
    log::info!("RepoWatcher debounce window updated to {}ms", clamped);
}

pub fn get_debounce_window_ms() -> u64 {
    DEBOUNCE_WINDOW_MS.load(Ordering::Relaxed)
}

pub struct RepoWatcher {
    _watcher: RecommendedWatcher,
}

impl RepoWatcher {
    /// Start watching the repository directory for filesystem changes
    /// Employs an inactivity-based trailing debounce loop with a max-wait ceiling
    /// and emits `repo:{id}:status_changed` across Tauri IPC.
    pub fn start(repo_id: String, repo_path: &Path, app_handle: AppHandle) -> Result<Self, String> {
        let (tx, rx) = channel();

        let mut watcher = RecommendedWatcher::new(tx, Config::default())
            .map_err(|e| format!("Failed to initialize notify watcher: {e}"))?;

        watcher
            .watch(repo_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {e}"))?;

        let event_name = format!("repo:{}:status_changed", repo_id);

        thread::spawn(move || {
            let max_batch_window = Duration::from_millis(4500);

            let mut pending = false;
            let mut batch_start = Instant::now();
            let mut last_event_time = Instant::now();

            loop {
                let quiet_window = Duration::from_millis(get_debounce_window_ms());

                if pending {
                    let now = Instant::now();
                    let since_batch_start = now.duration_since(batch_start);
                    if since_batch_start >= max_batch_window {
                        // Max ceiling reached: emit update
                        let _ = app_handle.emit(&event_name, ());
                        pending = false;
                        continue;
                    }

                    let since_last = now.duration_since(last_event_time);
                    if since_last >= quiet_window {
                        // Quiet window reached without new events: emit update
                        let _ = app_handle.emit(&event_name, ());
                        pending = false;
                        continue;
                    }

                    let until_quiet = quiet_window - since_last;
                    let until_max = max_batch_window - since_batch_start;
                    let wait_duration = until_quiet.min(until_max);

                    match rx.recv_timeout(wait_duration) {
                        Ok(event_res) => {
                            if let Ok(event) = event_res {
                                if Self::is_relevant_fs_event(&event) {
                                    last_event_time = Instant::now();
                                }
                            }
                        }
                        Err(RecvTimeoutError::Timeout) => {
                            // Timeout expired: loop will re-check quiet window and emit
                            continue;
                        }
                        Err(RecvTimeoutError::Disconnected) => break,
                    }
                } else {
                    // Idle state: block until next event arrives
                    match rx.recv() {
                        Ok(Ok(event)) => {
                            if Self::is_relevant_fs_event(&event) {
                                let now = Instant::now();
                                pending = true;
                                batch_start = now;
                                last_event_time = now;
                            }
                        }
                        Ok(Err(_)) => {}
                        Err(_) => break, // Channel closed
                    }
                }
            }
        });

        Ok(Self { _watcher: watcher })
    }

    fn is_relevant_fs_event(event: &notify::Event) -> bool {
        event.paths.iter().any(|p| {
            let path_str = p.to_string_lossy();
            // Ignore noisy internal directories, temporary locks, and build outputs
            !(path_str.contains(".git\\objects")
                || path_str.contains(".git/objects")
                || path_str.contains(".git\\logs")
                || path_str.contains(".git/logs")
                || path_str.ends_with(".lock")
                || path_str.contains("node_modules")
                || path_str.contains("target\\")
                || path_str.contains("target/"))
        })
    }
}
