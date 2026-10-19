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
pub async fn discard_all_unstaged_changes(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let repo_guard = session.repo.lock();
    git::discard_all_unstaged_changes(&repo_guard)
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

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Creates a standard `std::process::Command` configured with `CREATE_NO_WINDOW` (0x08000000)
/// on Windows. This prevents brief, distracting terminal/command prompt window flashes
/// when GitShark executes Git or background processes from a GUI application.
#[allow(unused_mut)]
fn create_silent_command<S: AsRef<std::ffi::OsStr>>(program: S) -> std::process::Command {
    let mut cmd = std::process::Command::new(program);
    #[cfg(windows)]
    {
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd
}

static CUSTOM_GIT_PATH: parking_lot::RwLock<Option<String>> = parking_lot::RwLock::new(None);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitBinaryInfo {
    pub current_path: String,
    pub is_custom: bool,
    pub auto_detected_path: String,
    pub version: Option<String>,
    pub is_valid: bool,
}

fn query_git_version(path: &str) -> Option<String> {
    let output = create_silent_command(path)
        .arg("--version")
        .output()
        .ok()?;
    if output.status.success() {
        let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
        if !stdout.is_empty() {
            return Some(stdout);
        }
    }
    None
}

fn detect_system_git_command() -> String {
    #[cfg(target_os = "windows")]
    {
        // 1. Standard 64-bit and 32-bit Program Files locations
        if std::path::Path::new("C:\\Program Files\\Git\\cmd\\git.exe").exists() {
            return "C:\\Program Files\\Git\\cmd\\git.exe".to_string();
        }
        if std::path::Path::new("C:\\Program Files (x86)\\Git\\cmd\\git.exe").exists() {
            return "C:\\Program Files (x86)\\Git\\cmd\\git.exe".to_string();
        }

        // 2. User-level LocalAppData installation (non-admin portable or installer)
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let user_git = std::path::Path::new(&local_app_data).join("Programs\\Git\\cmd\\git.exe");
            if user_git.exists() {
                return user_git.to_string_lossy().to_string();
            }
            let user_git_bin = std::path::Path::new(&local_app_data).join("Programs\\Git\\bin\\git.exe");
            if user_git_bin.exists() {
                return user_git_bin.to_string_lossy().to_string();
            }
        }

        // 3. User Scoop installations
        if let Ok(user_profile) = std::env::var("USERPROFILE") {
            let scoop_git = std::path::Path::new(&user_profile).join("scoop\\apps\\git\\current\\bin\\git.exe");
            if scoop_git.exists() {
                return scoop_git.to_string_lossy().to_string();
            }
            let scoop_shim = std::path::Path::new(&user_profile).join("scoop\\shims\\git.exe");
            if scoop_shim.exists() {
                return scoop_shim.to_string_lossy().to_string();
            }
        }
    }
    "git".to_string()
}

fn resolve_git_command() -> String {
    if let Some(custom) = CUSTOM_GIT_PATH.read().as_ref() {
        let trimmed = custom.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    detect_system_git_command()
}

#[tauri::command]
pub fn get_git_binary_info() -> GitBinaryInfo {
    let custom_opt = CUSTOM_GIT_PATH.read().clone();
    let is_custom = custom_opt.as_ref().map(|s| !s.trim().is_empty()).unwrap_or(false);
    let auto_detected_path = detect_system_git_command();
    let current_path = if is_custom {
        custom_opt.unwrap().trim().to_string()
    } else {
        auto_detected_path.clone()
    };

    let version = query_git_version(&current_path);
    let is_valid = version.is_some();

    GitBinaryInfo {
        current_path,
        is_custom,
        auto_detected_path,
        version,
        is_valid,
    }
}

#[tauri::command]
pub fn validate_git_path(path: String) -> Result<String, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("Path cannot be empty".to_string());
    }
    match query_git_version(trimmed) {
        Some(ver) => Ok(ver),
        None => Err(format!("Could not execute 'git --version' using path: {trimmed}")),
    }
}

#[tauri::command]
pub fn set_custom_git_path(path: Option<String>) -> Result<GitBinaryInfo, String> {
    match path {
        Some(p) if !p.trim().is_empty() => {
            let trimmed = p.trim().to_string();
            if query_git_version(&trimmed).is_some() {
                *CUSTOM_GIT_PATH.write() = Some(trimmed);
            } else {
                return Err(format!("The specified Git binary cannot be executed or returned an error: {trimmed}"));
            }
        }
        _ => {
            *CUSTOM_GIT_PATH.write() = None;
        }
    }
    Ok(get_git_binary_info())
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
pub async fn execute_hook_dry_run(
    app_handle: AppHandle,
    state: State<'_, AppRepoState>,
    repo_id: String,
    hook_name: String,
) -> Result<(), String> {
    let (pty_manager, workdir, hooks_info) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        let repo = session.repo.lock();
        let hooks_info = git::detect_repo_hooks(&repo)?;
        (session.pty_manager.clone(), session.path.clone(), hooks_info)
    };

    let target_hook = hooks_info
        .active_hooks
        .into_iter()
        .find(|h| h.name == hook_name || h.name.starts_with(&hook_name))
        .ok_or_else(|| format!("Hook '{hook_name}' not found"))?;

    #[cfg(windows)]
    let (cmd, args) = {
        if target_hook.path.ends_with(".ps1") {
            (
                "powershell".to_string(),
                vec![
                    "-NoProfile".to_string(),
                    "-ExecutionPolicy".to_string(),
                    "Bypass".to_string(),
                    "-File".to_string(),
                    target_hook.path,
                ],
            )
        } else if target_hook.path.ends_with(".cmd") || target_hook.path.ends_with(".bat") {
            (
                "cmd.exe".to_string(),
                vec!["/c".to_string(), target_hook.path],
            )
        } else {
            ("sh".to_string(), vec![target_hook.path])
        }
    };

    #[cfg(not(windows))]
    let (cmd, args) = {
        (
            "/bin/sh".to_string(),
            vec![target_hook.path],
        )
    };

    pty_manager.spawn(
        repo_id,
        workdir,
        cmd,
        args,
        100,
        30,
        app_handle,
    )
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

    let output = create_silent_command(&git_cmd)
        .args(["worktree", "list", "--porcelain"])
        .current_dir(&workdir)
        .output()
        .map_err(|e| format!("Failed to run git worktree list: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut items = git::parse_worktree_porcelain(&stdout);

    // Cross-check with filesystem: if a linked worktree path does not exist, mark it as prunable
    for item in &mut items {
        if !item.is_main && !std::path::Path::new(&item.path).exists() {
            item.is_prunable = true;
        }
    }

    Ok(items)
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

    let output = create_silent_command(&git_cmd)
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

    let output = create_silent_command(&git_cmd)
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
pub async fn prune_worktrees(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<(), String> {
    let (workdir, git_cmd) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.path.clone(), resolve_git_command())
    };

    let output = create_silent_command(&git_cmd)
        .args(["worktree", "prune"])
        .current_dir(&workdir)
        .output()
        .map_err(|e| format!("Failed to execute git worktree prune: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git worktree prune failed: {stderr}"));
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
    let (pty_manager, workdir, git_cmd, args) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        let repo = session.repo.lock();

        let head_branch_name = repo.head().ok().and_then(|h| {
            if h.is_branch() {
                h.shorthand().map(String::from)
            } else {
                None
            }
        });

        let target_branch = branch.or_else(|| head_branch_name.clone());
        let is_current_head = match (&target_branch, &head_branch_name) {
            (Some(tb), Some(hb)) => tb == hb,
            _ => false,
        };

        let default_remote = repo
            .remotes()
            .ok()
            .and_then(|r| r.get(0).map(String::from))
            .unwrap_or_else(|| "origin".to_string());

        let mut cmd_args = Vec::new();

        if is_current_head || target_branch.is_none() {
            // Pulling the currently checked out branch (HEAD)
            cmd_args.push("pull".to_string());
            cmd_args.push("--prune".to_string());
            if rebase.unwrap_or(false) {
                cmd_args.push("--rebase".to_string());
            }

            let mut branch_has_upstream = false;
            let mut resolved_remote = remote.clone();
            let mut resolved_merge_branch = None;

            if let Some(ref cur) = head_branch_name {
                if let Ok(mut local_b) = repo.find_branch(cur, git2::BranchType::Local) {
                    if let Ok(_upstream) = local_b.upstream() {
                        branch_has_upstream = true;
                        if let Some(r_name) = local_b
                            .get()
                            .name()
                            .and_then(|rn| repo.branch_upstream_remote(rn).ok())
                            .and_then(|b| b.as_str().map(String::from))
                        {
                            resolved_remote = Some(r_name);
                        }
                    } else {
                        // Current branch has no upstream tracking configured yet
                        let remote_ref_name = format!("{default_remote}/{cur}");
                        if repo.find_branch(&remote_ref_name, git2::BranchType::Remote).is_ok() {
                            let _ = local_b.set_upstream(Some(&remote_ref_name));
                            branch_has_upstream = true;
                        }
                        resolved_merge_branch = Some(cur.clone());
                    }
                }
            }

            if !branch_has_upstream {
                let r = resolved_remote.unwrap_or(default_remote);
                let b = resolved_merge_branch.or(head_branch_name).unwrap_or_else(|| "HEAD".to_string());
                cmd_args.push(r);
                cmd_args.push(b);
            } else if let Some(r) = resolved_remote {
                cmd_args.push(r);
                if let Some(b) = resolved_merge_branch {
                    cmd_args.push(b);
                }
            }
        } else {
            // Pulling a NON-checked-out branch (Issue #5)
            // Fast-forwards the local branch reference from remote without switching branches:
            // git fetch <remote> <remote_ref>:<local_ref>
            let local_branch = target_branch.unwrap();
            let mut remote_name = remote.clone();
            let mut remote_branch = local_branch.clone();

            if let Ok(mut local_b) = repo.find_branch(&local_branch, git2::BranchType::Local) {
                if let Some(ref_name) = local_b.get().name() {
                    if let Ok(buf) = repo.branch_upstream_remote(ref_name) {
                        if let Some(s) = buf.as_str() {
                            remote_name = Some(s.to_string());
                        }
                    }
                    if let Ok(buf) = repo.branch_upstream_merge(ref_name) {
                        if let Some(s) = buf.as_str() {
                            let short = s.strip_prefix("refs/heads/").unwrap_or(s);
                            remote_branch = short.to_string();
                        }
                    }
                }

                // If upstream wasn't set, check if remote branch exists and configure tracking
                let rem = remote_name.clone().unwrap_or_else(|| default_remote.clone());
                let remote_ref_target = format!("{rem}/{remote_branch}");
                if local_b.upstream().is_err()
                    && repo.find_branch(&remote_ref_target, git2::BranchType::Remote).is_ok()
                {
                    let _ = local_b.set_upstream(Some(&remote_ref_target));
                }
            }

            let rem = remote_name.unwrap_or(default_remote);
            cmd_args.push("fetch".to_string());
            cmd_args.push("--prune".to_string());
            cmd_args.push(rem);
            cmd_args.push(format!("{remote_branch}:{local_branch}"));
        }

        (
            session.pty_manager.clone(),
            session.path.clone(),
            resolve_git_command(),
            cmd_args,
        )
    };

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

#[tauri::command]
pub async fn background_fetch_repository(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<(), String> {
    let (workdir, git_cmd) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.path.clone(), resolve_git_command())
    };

    let output = create_silent_command(&git_cmd)
        .args(["fetch", "--all", "--prune"])
        .current_dir(&workdir)
        .output()
        .map_err(|e| format!("Failed to execute background fetch: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Background fetch failed: {stderr}"));
    }

    Ok(())
}

#[tauri::command]
pub async fn execute_git_merge(
    app_handle: AppHandle,
    state: State<'_, AppRepoState>,
    repo_id: String,
    branch: String,
) -> Result<(), String> {
    let (pty_manager, workdir) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.pty_manager.clone(), session.path.clone())
    };

    let git_cmd = resolve_git_command();
    let args = vec!["merge".to_string(), branch];

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
                let _ = create_silent_command("taskkill")
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

    let mut cmd = create_silent_command(&git_cmd);
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
pub async fn rename_branch(
    state: State<'_, AppRepoState>,
    repo_id: String,
    old_name: String,
    new_name: String,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::rename_branch(&repo, &old_name, &new_name)
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

#[tauri::command]
pub async fn list_tags(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<Vec<git::GitTagItem>, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::list_tags(&repo)
}

#[tauri::command]
pub async fn create_tag(
    state: State<'_, AppRepoState>,
    repo_id: String,
    tag_name: String,
    target_commit: Option<String>,
    message: Option<String>,
) -> Result<git::GitTagItem, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::create_tag(
        &repo,
        &tag_name,
        target_commit.as_deref(),
        message.as_deref(),
    )
}

#[tauri::command]
pub async fn delete_tag(
    state: State<'_, AppRepoState>,
    repo_id: String,
    tag_name: String,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::delete_tag(&repo, &tag_name)
}

#[tauri::command]
pub async fn push_tag(
    app_handle: AppHandle,
    state: State<'_, AppRepoState>,
    repo_id: String,
    tag_name: String,
    remote: Option<String>,
) -> Result<(), String> {
    let (pty_manager, workdir) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.pty_manager.clone(), session.path.clone())
    };

    let git_cmd = resolve_git_command();
    let remote_target = remote.unwrap_or_else(|| "origin".to_string());
    let clean_tag = tag_name.trim().trim_start_matches("refs/tags/");
    let args = vec!["push".to_string(), remote_target, format!("refs/tags/{clean_tag}")];

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
pub fn set_diff_debounce_delay(delay_ms: u64) -> Result<u64, String> {
    crate::watcher::set_debounce_window_ms(delay_ms);
    Ok(crate::watcher::get_debounce_window_ms())
}

#[tauri::command]
pub fn get_diff_debounce_delay() -> Result<u64, String> {
    Ok(crate::watcher::get_debounce_window_ms())
}

#[tauri::command]
pub async fn get_repository_remote_url(
    state: State<'_, AppRepoState>,
    id: String,
    remote: Option<String>,
) -> Result<Option<String>, String> {
    let registry = state.read();
    let session = registry.get(&id).ok_or_else(|| "Session not found".to_string())?;
    let repo = session.repo.lock();
    Ok(git::get_remote_url(&repo, remote.as_deref()))
}

#[tauri::command]
pub async fn open_in_browser(app_handle: AppHandle, url: String) -> Result<(), String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("Only http and https URLs can be opened in the browser".to_string());
    }
    use tauri_plugin_shell::ShellExt;
    app_handle
        .shell()
        .open(&url, None)
        .map_err(|e| format!("Failed to open browser: {e}"))
}

#[tauri::command]
pub async fn execute_git_cherry_pick(
    app_handle: AppHandle,
    state: State<'_, AppRepoState>,
    repo_id: String,
    commit_sha: String,
) -> Result<(), String> {
    let (pty_manager, workdir) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.pty_manager.clone(), session.path.clone())
    };

    let git_cmd = resolve_git_command();
    let args = vec!["cherry-pick".to_string(), commit_sha.trim().to_string()];

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
pub async fn execute_git_revert(
    app_handle: AppHandle,
    state: State<'_, AppRepoState>,
    repo_id: String,
    commit_sha: String,
) -> Result<(), String> {
    let (pty_manager, workdir) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.pty_manager.clone(), session.path.clone())
    };

    let git_cmd = resolve_git_command();
    let args = vec![
        "revert".to_string(),
        "--no-edit".to_string(),
        commit_sha.trim().to_string(),
    ];

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
pub async fn checkout_commit(
    state: State<'_, AppRepoState>,
    repo_id: String,
    commit_sha: String,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::checkout_commit(&repo, &commit_sha)
}

#[tauri::command]
pub async fn reset_to_commit(
    state: State<'_, AppRepoState>,
    repo_id: String,
    commit_sha: String,
    mode: String,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::reset_to_commit(&repo, &commit_sha, &mode)
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SharkStatsData {
    pub commits_swum: u64,
    pub changes_chomped: u64,
    pub pushes_launched: u64,
    pub stashes_buried: u64,
    #[serde(default)]
    pub merges_to_main: u64,
    #[serde(default)]
    pub prs_opened: u64,
    #[serde(default)]
    pub storage_path: String,
}

fn resolve_shark_stats_path() -> std::path::PathBuf {
    let home_dir = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(std::path::PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    home_dir.join(".gitshark").join("shark_stats.json")
}

#[tauri::command]
pub fn get_shark_stats() -> Result<SharkStatsData, String> {
    let path = resolve_shark_stats_path();
    let path_str = path.to_string_lossy().to_string();

    if path.is_file() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(mut parsed) = serde_json::from_str::<SharkStatsData>(&content) {
                parsed.storage_path = path_str;
                return Ok(parsed);
            }
        }
    }

    Ok(SharkStatsData {
        commits_swum: 0,
        changes_chomped: 0,
        pushes_launched: 0,
        stashes_buried: 0,
        merges_to_main: 0,
        prs_opened: 0,
        storage_path: path_str,
    })
}

#[tauri::command]
pub fn save_shark_stats(mut stats: SharkStatsData) -> Result<SharkStatsData, String> {
    let path = resolve_shark_stats_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create ~/.gitshark directory: {e}"))?;
    }

    stats.storage_path = path.to_string_lossy().to_string();
    let json = serde_json::to_string_pretty(&stats)
        .map_err(|e| format!("Failed to serialize shark stats: {e}"))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write shark stats to {}: {e}", stats.storage_path))?;

    Ok(stats)
}

#[tauri::command]
pub async fn get_git_auth_token(host: Option<String>) -> Result<Option<String>, String> {
    let target_host = host.unwrap_or_else(|| "github.com".to_string());

    // 1. Check environment variables first
    if target_host.contains("github") {
        if let Ok(tok) = std::env::var("GITHUB_TOKEN").or_else(|_| std::env::var("GH_TOKEN")) {
            let trimmed = tok.trim().to_string();
            if !trimmed.is_empty() {
                return Ok(Some(trimmed));
            }
        }
    } else if target_host.contains("gitlab") {
        if let Ok(tok) = std::env::var("GITLAB_TOKEN").or_else(|_| std::env::var("GL_TOKEN")) {
            let trimmed = tok.trim().to_string();
            if !trimmed.is_empty() {
                return Ok(Some(trimmed));
            }
        }
    }

    // 2. Query git credential fill
    let git_cmd = resolve_git_command();
    let mut child = match create_silent_command(&git_cmd)
        .arg("credential")
        .arg("fill")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .spawn()
    {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };

    if let Some(mut stdin) = child.stdin.take() {
        use std::io::Write;
        let query = format!("protocol=https\nhost={target_host}\n\n");
        let _ = stdin.write_all(query.as_bytes());
    }

    if let Ok(output) = child.wait_with_output() {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            for line in text.lines() {
                if let Some(pwd) = line.strip_prefix("password=") {
                    let trimmed = pwd.trim().to_string();
                    if !trimmed.is_empty() {
                        return Ok(Some(trimmed));
                    }
                }
            }
        }
    }

    Ok(None)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevFolderItem {
    pub name: String,
    pub path: String,
    pub is_git_repo: bool,
}

#[tauri::command]
pub fn list_dev_folders(dir_path: String) -> Result<Vec<DevFolderItem>, String> {
    let p = std::path::Path::new(&dir_path);
    if !p.exists() || !p.is_dir() {
        return Err(format!("Directory '{dir_path}' does not exist or is not a directory"));
    }

    let mut folders = Vec::new();
    let entries = std::fs::read_dir(p)
        .map_err(|e| format!("Failed to read directory '{dir_path}': {e}"))?;

    for entry in entries.flatten() {
        if let Ok(file_type) = entry.file_type() {
            if file_type.is_dir() {
                let file_name = entry.file_name().to_string_lossy().to_string();
                if file_name.starts_with('.') || file_name == "node_modules" || file_name == "target" || file_name == "dist" {
                    continue;
                }
                let full_path = entry.path().to_string_lossy().to_string();
                let is_git_repo = entry.path().join(".git").exists();
                folders.push(DevFolderItem {
                    name: file_name,
                    path: full_path,
                    is_git_repo,
                });
            }
        }
    }

    folders.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(folders)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_git_binary_info_query() {
        let info = get_git_binary_info();
        assert!(!info.current_path.is_empty());
        assert!(!info.auto_detected_path.is_empty());
    }

    #[test]
    fn test_validate_git_path() {
        let info = get_git_binary_info();
        if info.is_valid {
            let res = validate_git_path(info.current_path);
            assert!(res.is_ok());
            assert!(res.unwrap().contains("git version"));
        }
    }

    #[test]
    fn test_shark_stats_path_resolution() {
        let path = resolve_shark_stats_path();
        assert!(path.to_string_lossy().contains(".gitshark"));
        assert!(path.to_string_lossy().ends_with("shark_stats.json"));
    }

    #[test]
    fn test_list_dev_folders() {
        let test_dir = std::env::temp_dir().join(format!("gitshark_devdir_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&test_dir);

        let sub_repo = test_dir.join("repo-a");
        let _ = std::fs::create_dir_all(&sub_repo);
        let _ = git2::Repository::init(&sub_repo);

        let sub_folder = test_dir.join("folder-b");
        let _ = std::fs::create_dir_all(&sub_folder);

        let ignored_folder = test_dir.join(".hidden");
        let _ = std::fs::create_dir_all(&ignored_folder);

        let folders = list_dev_folders(test_dir.to_string_lossy().to_string()).unwrap();
        assert_eq!(folders.len(), 2);
        assert_eq!(folders[0].name, "folder-b");
        assert!(!folders[0].is_git_repo);
        assert_eq!(folders[1].name, "repo-a");
        assert!(folders[1].is_git_repo);

        let _ = std::fs::remove_dir_all(&test_dir);
    }
}

