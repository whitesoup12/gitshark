use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::mpsc::channel;
use std::thread;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter};

pub struct RepoWatcher {
    _watcher: RecommendedWatcher,
}

impl RepoWatcher {
    /// Start watching the repository directory for filesystem changes
    /// Debounces events and emits `repo:{id}:status_changed` across Tauri IPC.
    pub fn start(repo_id: String, repo_path: &Path, app_handle: AppHandle) -> Result<Self, String> {
        let (tx, rx) = channel();

        let mut watcher = RecommendedWatcher::new(tx, Config::default())
            .map_err(|e| format!("Failed to initialize notify watcher: {e}"))?;

        watcher
            .watch(repo_path, RecursiveMode::Recursive)
            .map_err(|e| format!("Failed to watch directory: {e}"))?;

        let event_name = format!("repo:{}:status_changed", repo_id);

        thread::spawn(move || {
            let mut last_emitted = Instant::now() - Duration::from_secs(1);
            let debounce_window = Duration::from_millis(200);

            while let Ok(res) = rx.recv() {
                if let Ok(event) = res {
                    let should_notify = event.paths.iter().any(|p| {
                        let path_str = p.to_string_lossy();
                        // Ignore noisy non-working-tree directories
                        !(path_str.contains(".git\\objects")
                            || path_str.contains(".git/objects")
                            || path_str.contains(".git\\logs")
                            || path_str.contains(".git/logs")
                            || path_str.contains("node_modules")
                            || path_str.contains("target\\")
                            || path_str.contains("target/"))
                    });

                    if should_notify && last_emitted.elapsed() >= debounce_window {
                        last_emitted = Instant::now();
                        let _ = app_handle.emit(&event_name, ());
                    }
                }
            }
        });

        Ok(Self { _watcher: watcher })
    }
}
