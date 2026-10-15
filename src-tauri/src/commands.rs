use crate::git::{self, FileDiff, RepoMetadata, WorkingTreeStatus};
use crate::state::{AppRepoState, RepoSession};
use crate::watcher::RepoWatcher;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use tauri::{AppHandle, Emitter, State};
use uuid::Uuid;


#[tauri::command]
pub async fn open_repository(
    app_handle: AppHandle,
    state: State<'_, AppRepoState>,
    path: String,
) -> Result<RepoMetadata, String> {
    let canonical = std::fs::canonicalize(&path)
        .map_err(|e| format!("Invalid repository path '{}': {e}", path))?;

    let repo = git2::Repository::discover(&canonical)
        .map_err(|e| format!("Failed to open Git repository: {e}"))?;

    let workdir = repo
        .workdir()
        .unwrap_or(&canonical)
        .to_path_buf();

    let workdir_str = workdir.to_string_lossy().to_string();
    let session_id = Uuid::new_v4().to_string();

    let metadata = git::inspect_repository(&repo, &session_id, &workdir_str)?;

    let session = RepoSession::new(
        session_id.clone(),
        metadata.name.clone(),
        workdir.clone(),
        repo,
    );

    // Initialize filesystem watcher using notify
    if let Ok(watcher) = RepoWatcher::start(session_id.clone(), &workdir, app_handle) {
        *session.watcher.lock() = Some(watcher);
    }

    {
        let mut registry = state.write();
        registry.insert(session_id.clone(), session);
    }

    log::info!("Repository opened [{}] at {}", session_id, workdir_str);
    Ok(metadata)
}

#[tauri::command]
pub async fn close_repository(
    state: State<'_, AppRepoState>,
    id: String,
) -> Result<(), String> {
    let mut registry = state.write();
    if let Some(session) = registry.remove(&id) {
        session.pty_manager.kill();
        log::info!("Repository [{}] closed and session removed", id);
        Ok(())
    } else {
        Err(format!("No repository session found with ID: {id}"))
    }
}

#[tauri::command]
pub async fn get_repository_metadata(
    state: State<'_, AppRepoState>,
    id: String,
) -> Result<RepoMetadata, String> {
    let registry = state.read();
    let session = registry
        .get(&id)
        .ok_or_else(|| format!("Session not found: {id}"))?;

    let repo_guard = session.repo.lock();
    git::inspect_repository(&repo_guard, &session.id, &session.path.to_string_lossy())
}

#[tauri::command]
pub async fn get_working_tree_status(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<WorkingTreeStatus, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let repo_guard = session.repo.lock();
    git::get_working_tree_status(&repo_guard)
}

#[tauri::command]
pub async fn stage_file(
    state: State<'_, AppRepoState>,
    repo_id: String,
    path: String,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let repo_guard = session.repo.lock();
    git::stage_file(&repo_guard, &path)
}

#[tauri::command]
pub async fn unstage_file(
    state: State<'_, AppRepoState>,
    repo_id: String,
    path: String,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let repo_guard = session.repo.lock();
    git::unstage_file(&repo_guard, &path)
}

#[tauri::command]
pub async fn stage_all_files(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let repo_guard = session.repo.lock();
    git::stage_all_files(&repo_guard)
}

#[tauri::command]
pub async fn unstage_all_files(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let repo_guard = session.repo.lock();
    git::unstage_all_files(&repo_guard)
}

#[tauri::command]
pub async fn stage_hunk(
    state: State<'_, AppRepoState>,
    repo_id: String,
    patch: String,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let repo_guard = session.repo.lock();
    git::stage_hunk(&repo_guard, &patch)
}

#[tauri::command]
pub async fn discard_file_changes(
    state: State<'_, AppRepoState>,
    repo_id: String,
    path: String,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let repo_guard = session.repo.lock();
    git::discard_file_changes(&repo_guard, &path)
}

#[tauri::command]
pub async fn get_file_diff(
    state: State<'_, AppRepoState>,
    repo_id: String,
    path: String,
    staged: bool,
) -> Result<FileDiff, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let repo_guard = session.repo.lock();
    git::get_file_diff(&repo_guard, &path, staged)
}

#[tauri::command]
pub async fn execute_pty_command(
    app_handle: AppHandle,
    state: State<'_, AppRepoState>,
    id: String,
    command: String,
    args: Vec<String>,
    cols: Option<u16>,
    rows: Option<u16>,
) -> Result<(), String> {
    let (pty_manager, workdir) = {
        let registry = state.read();
        let session = registry
            .get(&id)
            .ok_or_else(|| format!("Session not found: {id}"))?;
        (session.pty_manager.clone(), session.path.clone())
    };

    pty_manager.spawn(
        id,
        workdir,
        command,
        args,
        cols.unwrap_or(80),
        rows.unwrap_or(24),
        app_handle,
    )
}

#[tauri::command]
pub async fn write_pty_input(
    state: State<'_, AppRepoState>,
    id: String,
    data: String,
) -> Result<(), String> {
    let pty_manager = {
        let registry = state.read();
        let session = registry
            .get(&id)
            .ok_or_else(|| format!("Session not found: {id}"))?;
        session.pty_manager.clone()
    };

    pty_manager.write(data.as_bytes())
}

#[tauri::command]
pub async fn resize_pty(
    state: State<'_, AppRepoState>,
    id: String,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    let pty_manager = {
        let registry = state.read();
        let session = registry
            .get(&id)
            .ok_or_else(|| format!("Session not found: {id}"))?;
        session.pty_manager.clone()
    };

    pty_manager.resize(cols, rows)
}

#[tauri::command]
pub async fn kill_pty(
    state: State<'_, AppRepoState>,
    id: String,
) -> Result<(), String> {
    let pty_manager = {
        let registry = state.read();
        let session = registry
            .get(&id)
            .ok_or_else(|| format!("Session not found: {id}"))?;
        session.pty_manager.clone()
    };

    pty_manager.kill();
    Ok(())
}

#[tauri::command]
pub async fn get_commit_graph(
    state: State<'_, AppRepoState>,
    repo_id: String,
    limit: Option<usize>,
    skip: Option<usize>,
) -> Result<Vec<git::CommitNode>, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let repo_guard = session.repo.lock();
    git::parse_commit_graph(&repo_guard, limit.unwrap_or(1000), skip.unwrap_or(0))
}

fn resolve_git_command() -> String {
    #[cfg(target_os = "windows")]
    {
        if std::path::Path::new("C:\\Program Files\\Git\\cmd\\git.exe").exists() {
            return "C:\\Program Files\\Git\\cmd\\git.exe".to_string();
        }
        if std::path::Path::new("C:\\Program Files (x86)\\Git\\cmd\\git.exe").exists() {
            return "C:\\Program Files (x86)\\Git\\cmd\\git.exe".to_string();
        }
    }
    "git".to_string()
}

#[tauri::command]
pub async fn execute_git_commit(
    app_handle: AppHandle,
    state: State<'_, AppRepoState>,
    repo_id: String,
    message: String,
    amend: bool,
) -> Result<(), String> {
    if message.trim().is_empty() && !amend {
        return Err("Commit message cannot be empty".to_string());
    }

    let (pty_manager, workdir) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.pty_manager.clone(), session.path.clone())
    };

    let git_cmd = resolve_git_command();
    let mut args = vec!["commit".to_string()];
    if amend {
        args.push("--amend".to_string());
    }
    if !message.trim().is_empty() {
        args.push("-m".to_string());
        args.push(message);
    }

    pty_manager.spawn(
        repo_id,
        workdir,
        git_cmd,
        args,
        100,
        30,
        app_handle,
    )
}

#[tauri::command]
pub async fn execute_git_push(
    app_handle: AppHandle,
    state: State<'_, AppRepoState>,
    repo_id: String,
    remote: Option<String>,
    branch: Option<String>,
    force: Option<bool>,
    set_upstream: Option<bool>,
) -> Result<(), String> {
    let (pty_manager, workdir, auto_upstream, current_branch_name, default_remote) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;

        let repo = session.repo.lock();
        let mut auto_up = false;
        let mut cur_branch = None;
        let mut remote_target = None;

        if let Ok(head) = repo.head() {
            if head.is_branch() {
                if let Some(bname) = head.shorthand() {
                    cur_branch = Some(bname.to_string());
                    if let Ok(local_b) = repo.find_branch(bname, git2::BranchType::Local) {
                        if local_b.upstream().is_err() {
                            auto_up = true;
                        }
                    }
                }
            }
        }

        if let Ok(remotes) = repo.remotes() {
            if let Some(first_remote) = remotes.get(0) {
                remote_target = Some(first_remote.to_string());
            }
        }

        (
            session.pty_manager.clone(),
            session.path.clone(),
            auto_up,
            cur_branch,
            remote_target.unwrap_or_else(|| "origin".to_string()),
        )
    };

    let git_cmd = resolve_git_command();
    let mut args = vec!["push".to_string()];
    if force.unwrap_or(false) {
        args.push("--force-with-lease".to_string());
    }

    let should_set_upstream = set_upstream.unwrap_or(auto_upstream);
    if should_set_upstream {
        args.push("--set-upstream".to_string());
        args.push(remote.unwrap_or(default_remote));
        if let Some(b) = branch.or(current_branch_name) {
            args.push(b);
        }
    } else {
        if let Some(r) = remote {
            args.push(r);
            if let Some(b) = branch {
                args.push(b);
            }
        }
    }

    pty_manager.spawn(
        repo_id,
        workdir,
        git_cmd,
        args,
        100,
        30,
        app_handle,
    )
}

#[tauri::command]
pub async fn cancel_active_process(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;
    session.pty_manager.cancel();
    Ok(())
}

#[tauri::command]
pub async fn get_repo_hooks(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<git::RepoHooksInfo, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;
    let repo_guard = session.repo.lock();
    git::detect_repo_hooks(&repo_guard)
}

#[tauri::command]
pub async fn list_worktrees(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<Vec<git::WorktreeItem>, String> {
    let (workdir, git_cmd) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.path.clone(), resolve_git_command())
    };

    let output = std::process::Command::new(&git_cmd)
        .args(["worktree", "list", "--porcelain"])
        .current_dir(&workdir)
        .output()
        .map_err(|e| format!("Failed to run git worktree list: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(git::parse_worktree_porcelain(&stdout))
}

#[tauri::command]
pub async fn add_worktree(
    state: State<'_, AppRepoState>,
    repo_id: String,
    path: String,
    branch: String,
    new_branch: Option<bool>,
) -> Result<(), String> {
    let (workdir, git_cmd) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.path.clone(), resolve_git_command())
    };

    let mut args = vec!["worktree".to_string(), "add".to_string()];
    if new_branch.unwrap_or(false) {
        args.push("-b".to_string());
        args.push(branch.clone());
        args.push(path);
    } else {
        args.push(path);
        if !branch.trim().is_empty() {
            args.push(branch);
        }
    }

    let output = std::process::Command::new(&git_cmd)
        .args(&args)
        .current_dir(&workdir)
        .output()
        .map_err(|e| format!("Failed to execute git worktree add: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree add failed: {stderr}"));
    }

    Ok(())
}

#[tauri::command]
pub async fn remove_worktree(
    state: State<'_, AppRepoState>,
    repo_id: String,
    path: String,
    force: bool,
) -> Result<(), String> {
    let (workdir, git_cmd) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.path.clone(), resolve_git_command())
    };

    let mut args = vec!["worktree".to_string(), "remove".to_string()];
    if force {
        args.push("--force".to_string());
    }
    args.push(path);

    let output = std::process::Command::new(&git_cmd)
        .args(&args)
        .current_dir(&workdir)
        .output()
        .map_err(|e| format!("Failed to execute git worktree remove: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree remove failed: {stderr}"));
    }

    Ok(())
}

#[tauri::command]
pub async fn get_remote_sync_status(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<git::RemoteSyncStatus, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;
    let repo_guard = session.repo.lock();
    git::get_remote_sync_status(&repo_guard)
}

#[tauri::command]
pub async fn execute_git_pull(
    app_handle: AppHandle,
    state: State<'_, AppRepoState>,
    repo_id: String,
    remote: Option<String>,
    branch: Option<String>,
    rebase: Option<bool>,
) -> Result<(), String> {
    let (pty_manager, workdir) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.pty_manager.clone(), session.path.clone())
    };

    let git_cmd = resolve_git_command();
    let mut args = vec!["pull".to_string(), "--prune".to_string()];
    if rebase.unwrap_or(false) {
        args.push("--rebase".to_string());
    }
    if let Some(r) = remote {
        args.push(r);
        if let Some(b) = branch {
            args.push(b);
        }
    }

    pty_manager.spawn(
        repo_id,
        workdir,
        git_cmd,
        args,
        100,
        30,
        app_handle,
    )
}

#[tauri::command]
pub async fn execute_git_fetch(
    app_handle: AppHandle,
    state: State<'_, AppRepoState>,
    repo_id: String,
    remote: Option<String>,
    prune: Option<bool>,
) -> Result<(), String> {
    let (pty_manager, workdir) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.pty_manager.clone(), session.path.clone())
    };

    let git_cmd = resolve_git_command();
    let mut args = vec!["fetch".to_string()];
    if prune.unwrap_or(true) {
        args.push("--prune".to_string());
    }
    if let Some(r) = remote {
        args.push(r);
    } else {
        args.push("--all".to_string());
    }

    pty_manager.spawn(
        repo_id,
        workdir,
        git_cmd,
        args,
        100,
        30,
        app_handle,
    )
}

static ACTIVE_CLONES: parking_lot::Mutex<Option<HashMap<String, u32>>> =
    parking_lot::Mutex::new(None);

fn register_clone_pid(clone_id: String, pid: u32) {
    let mut guard = ACTIVE_CLONES.lock();
    if guard.is_none() {
        *guard = Some(HashMap::new());
    }
    if let Some(map) = guard.as_mut() {
        map.insert(clone_id, pid);
    }
}

fn remove_clone_pid(clone_id: &str) {
    let mut guard = ACTIVE_CLONES.lock();
    if let Some(map) = guard.as_mut() {
        map.remove(clone_id);
    }
}

fn kill_clone_process(clone_id: &str) {
    let mut guard = ACTIVE_CLONES.lock();
    if let Some(map) = guard.as_mut() {
        if let Some(pid) = map.remove(clone_id) {
            #[cfg(windows)]
            {
                let _ = std::process::Command::new("taskkill")
                    .args(["/PID", &pid.to_string(), "/F", "/T"])
                    .output();
            }
            #[cfg(not(windows))]
            {
                let _ = std::process::Command::new("kill")
                    .args(["-9", &pid.to_string()])
                    .output();
            }
        }
    }
}

fn parse_clone_line(line: &str) -> (String, f32) {
    let trimmed = line.trim();
    if trimmed.is_empty() {
        return ("Initializing".to_string(), 0.0);
    }

    let stages = [
        ("Counting objects", 10.0),
        ("Compressing objects", 25.0),
        ("Receiving objects", 75.0),
        ("Resolving deltas", 95.0),
        ("Updating files", 100.0),
        ("Cloning into", 5.0),
    ];

    for (stage_name, default_pct) in stages {
        if let Some(pos) = trimmed.find(stage_name) {
            let rest = &trimmed[pos + stage_name.len()..];
            if let Some(pct_pos) = rest.find('%') {
                let slice = &rest[..pct_pos];
                let digits: String = slice.chars().filter(|c| c.is_numeric()).collect();
                if let Ok(val) = digits.parse::<f32>() {
                    return (stage_name.to_string(), val.min(100.0));
                }
            }
            return (stage_name.to_string(), default_pct);
        }
    }

    ("Working".to_string(), 0.0)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloneOptions {
    pub url: String,
    pub destination: String,
    pub branch: Option<String>,
    pub depth: Option<usize>,
    pub recurse_submodules: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloneProgressPayload {
    pub clone_id: String,
    pub stage: String,
    pub percentage: f32,
    pub raw_line: String,
    pub is_complete: bool,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn start_clone_repository(
    app_handle: AppHandle,
    clone_id: String,
    options: CloneOptions,
) -> Result<(), String> {
    let git_cmd = resolve_git_command();

    let mut cmd = std::process::Command::new(&git_cmd);
    cmd.arg("clone");
    cmd.arg("--progress");

    if let Some(ref b) = options.branch {
        if !b.trim().is_empty() {
            cmd.arg("-b");
            cmd.arg(b.trim());
        }
    }

    if let Some(depth) = options.depth {
        if depth > 0 {
            cmd.arg("--depth");
            cmd.arg(depth.to_string());
        }
    }

    if options.recurse_submodules {
        cmd.arg("--recurse-submodules");
    }

    cmd.arg(&options.url);
    cmd.arg(&options.destination);

    cmd.stdout(std::process::Stdio::piped());
    cmd.stderr(std::process::Stdio::piped());

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn git clone: {e}"))?;

    let pid = child.id();
    register_clone_pid(clone_id.clone(), pid);

    let stderr = child
        .stderr
        .take()
        .ok_or("Failed to capture clone stderr")?;

    let clone_id_for_thread = clone_id.clone();
    let app_handle_for_thread = app_handle.clone();

    std::thread::spawn(move || {
        let mut reader = std::io::BufReader::new(stderr);
        let mut buffer = Vec::new();
        let mut byte_buf = [0u8; 1];
        let mut last_error = String::new();

        loop {
            match reader.read(&mut byte_buf) {
                Ok(0) => break,
                Ok(1) => {
                    let b = byte_buf[0];
                    if b == b'\r' || b == b'\n' {
                        if !buffer.is_empty() {
                            let line = String::from_utf8_lossy(&buffer).to_string();
                            buffer.clear();

                            let (stage, percentage) = parse_clone_line(&line);
                            if line.to_lowercase().contains("fatal:")
                                || line.to_lowercase().contains("error:")
                            {
                                last_error = line.clone();
                            }

                            let _ = app_handle_for_thread.emit(
                                &format!("clone_progress:{}", clone_id_for_thread),
                                CloneProgressPayload {
                                    clone_id: clone_id_for_thread.clone(),
                                    stage,
                                    percentage,
                                    raw_line: line,
                                    is_complete: false,
                                    error: None,
                                },
                            );
                        }
                    } else {
                        buffer.push(b);
                        if buffer.len() > 2048 {
                            buffer.clear();
                        }
                    }
                }
                _ => break,
            }
        }

        let exit_status = child.wait();
        remove_clone_pid(&clone_id_for_thread);

        let (success, error_msg) = match exit_status {
            Ok(s) if s.success() => (true, None),
            Ok(s) => (
                false,
                Some(if !last_error.is_empty() {
                    last_error
                } else {
                    format!("Git clone exited with code {:?}", s.code())
                }),
            ),
            Err(e) => (false, Some(e.to_string())),
        };

        let _ = app_handle_for_thread.emit(
            &format!("clone_progress:{}", clone_id_for_thread),
            CloneProgressPayload {
                clone_id: clone_id_for_thread.clone(),
                stage: if success {
                    "Complete".to_string()
                } else {
                    "Failed".to_string()
                },
                percentage: if success { 100.0 } else { 0.0 },
                raw_line: if success {
                    "Cloning repository completed successfully.".to_string()
                } else {
                    error_msg.clone().unwrap_or_default()
                },
                is_complete: true,
                error: error_msg,
            },
        );
    });

    Ok(())
}

#[tauri::command]
pub async fn cancel_clone(clone_id: String) -> Result<(), String> {
    kill_clone_process(&clone_id);
    Ok(())
}

#[tauri::command]
pub async fn get_repo_branches(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<git::RepoBranches, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::get_repo_branches(&repo)
}

#[tauri::command]
pub async fn checkout_branch(
    state: State<'_, AppRepoState>,
    repo_id: String,
    branch_name: String,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::checkout_branch(&repo, &branch_name)
}

#[tauri::command]
pub async fn create_branch(
    state: State<'_, AppRepoState>,
    repo_id: String,
    branch_name: String,
    target_commit: Option<String>,
    checkout: bool,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::create_branch(&repo, &branch_name, target_commit.as_deref(), checkout)
}

#[tauri::command]
pub async fn delete_branch(
    state: State<'_, AppRepoState>,
    repo_id: String,
    branch_name: String,
    is_remote: bool,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::delete_branch(&repo, &branch_name, is_remote)
}

#[tauri::command]
pub async fn list_stashes(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<Vec<git::StashItem>, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let mut repo = session.repo.lock();
    git::list_stashes(&mut *repo)
}

#[tauri::command]
pub async fn create_stash(
    state: State<'_, AppRepoState>,
    repo_id: String,
    message: Option<String>,
    include_untracked: bool,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let mut repo = session.repo.lock();
    git::create_stash(&mut *repo, message.as_deref(), include_untracked)
}

#[tauri::command]
pub async fn apply_stash(
    state: State<'_, AppRepoState>,
    repo_id: String,
    index: usize,
    pop: bool,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let mut repo = session.repo.lock();
    git::apply_stash(&mut *repo, index, pop)
}

#[tauri::command]
pub async fn drop_stash(
    state: State<'_, AppRepoState>,
    repo_id: String,
    index: usize,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let mut repo = session.repo.lock();
    git::drop_stash(&mut *repo, index)
}

#[tauri::command]
pub async fn get_commit_details(
    state: State<'_, AppRepoState>,
    repo_id: String,
    commit_sha: String,
) -> Result<git::CommitDetails, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::get_commit_details(&repo, &commit_sha)
}

#[tauri::command]
pub async fn get_commit_file_diff(
    state: State<'_, AppRepoState>,
    repo_id: String,
    commit_sha: String,
    file_path: String,
) -> Result<git::FileDiff, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::get_commit_file_diff(&repo, &commit_sha, &file_path)
}



