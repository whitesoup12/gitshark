use crate::pty::PtyManager;
use crate::watcher::RepoWatcher;
use parking_lot::{Mutex, RwLock};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Instant;

/// Individual repository session instance.
/// State is strictly scoped per repository instance (tab).
pub struct RepoSession {
    pub id: String,
    pub name: String,
    pub path: PathBuf,
    pub repo: Arc<Mutex<git2::Repository>>,
    pub pty_manager: Arc<PtyManager>,
    pub watcher: Arc<Mutex<Option<RepoWatcher>>>,
    pub created_at: Instant,
}

impl RepoSession {
    pub fn new(id: String, name: String, path: PathBuf, repo: git2::Repository) -> Self {
        Self {
            id,
            name,
            path,
            repo: Arc::new(Mutex::new(repo)),
            pty_manager: Arc::new(PtyManager::new()),
            watcher: Arc::new(Mutex::new(None)),
            created_at: Instant::now(),
        }
    }
}

impl Drop for RepoSession {
    fn drop(&mut self) {
        log::info!("Dropping RepoSession [{}] at {:?}", self.id, self.path);
        self.pty_manager.kill();
        let mut guard = self.watcher.lock();
        *guard = None;
    }
}

/// Global concurrent state container holding all open repository sessions.
pub type AppRepoState = Arc<RwLock<HashMap<String, RepoSession>>>;

pub fn create_app_state() -> AppRepoState {
    Arc::new(RwLock::new(HashMap::new()))
}
