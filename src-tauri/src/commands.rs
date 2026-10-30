use crate::git::{self, FileDiff, RepoMetadata, WorkingTreeStatus};
use crate::state::{AppRepoState, RepoSession};
use crate::watcher::RepoWatcher;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::io::Read;
use tauri::{AppHandle, Emitter, Manager, State};
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
pub async fn unstage_hunk(
    state: State<'_, AppRepoState>,
    repo_id: String,
    file_path: String,
    hunk: git::DiffHunk,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let all_indices: Vec<usize> = (0..hunk.lines.len()).collect();
    let patch = git::build_selected_lines_patch(&file_path, &hunk, &all_indices, true)?;
    let repo_guard = session.repo.lock();
    git::unstage_patch(&repo_guard, &patch)
}

#[tauri::command]
pub async fn discard_hunk(
    state: State<'_, AppRepoState>,
    repo_id: String,
    file_path: String,
    hunk: git::DiffHunk,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let all_indices: Vec<usize> = (0..hunk.lines.len()).collect();
    let patch = git::build_selected_lines_patch(&file_path, &hunk, &all_indices, true)?;
    let repo_guard = session.repo.lock();
    git::discard_patch(&repo_guard, &patch)
}

#[tauri::command]
pub async fn stage_selected_lines(
    state: State<'_, AppRepoState>,
    repo_id: String,
    file_path: String,
    hunk: git::DiffHunk,
    selected_indices: Vec<usize>,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let patch = git::build_selected_lines_patch(&file_path, &hunk, &selected_indices, false)?;
    let repo_guard = session.repo.lock();
    git::stage_hunk(&repo_guard, &patch)
}

#[tauri::command]
pub async fn unstage_selected_lines(
    state: State<'_, AppRepoState>,
    repo_id: String,
    file_path: String,
    hunk: git::DiffHunk,
    selected_indices: Vec<usize>,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let patch = git::build_selected_lines_patch(&file_path, &hunk, &selected_indices, true)?;
    let repo_guard = session.repo.lock();
    git::unstage_patch(&repo_guard, &patch)
}

#[tauri::command]
pub async fn discard_selected_lines(
    state: State<'_, AppRepoState>,
    repo_id: String,
    file_path: String,
    hunk: git::DiffHunk,
    selected_indices: Vec<usize>,
) -> Result<(), String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let patch = git::build_selected_lines_patch(&file_path, &hunk, &selected_indices, true)?;
    let repo_guard = session.repo.lock();
    git::discard_patch(&repo_guard, &patch)
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
pub async fn get_conflicted_file_details(
    state: State<'_, AppRepoState>,
    repo_id: String,
    path: String,
) -> Result<git::ConflictFileDetails, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let repo_guard = session.repo.lock();
    git::get_conflicted_file_details(&repo_guard, &path)
}

#[tauri::command]
pub async fn resolve_conflict_choice(
    state: State<'_, AppRepoState>,
    repo_id: String,
    path: String,
    choice: String,
) -> Result<(), String> {
    let (workdir, git_cmd) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.path.clone(), resolve_git_command())
    };

    let flag = match choice.as_str() {
        "ours" => "--ours",
        "theirs" => "--theirs",
        _ => return Err(format!("Invalid conflict choice '{choice}', expected 'ours' or 'theirs'")),
    };

    let output = create_silent_command(&git_cmd)
        .args(["checkout", flag, "--", &path])
        .current_dir(&workdir)
        .output()
        .map_err(|e| format!("Failed to execute git checkout {flag}: {e}"))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git checkout {flag} failed: {err}"));
    }

    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;
    let repo_guard = session.repo.lock();
    git::stage_file(&repo_guard, &path)
}

#[tauri::command]
pub async fn save_and_stage_resolved_file(
    state: State<'_, AppRepoState>,
    repo_id: String,
    path: String,
    content: String,
) -> Result<(), String> {
    let workdir = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        session.path.clone()
    };

    let full_path = workdir.join(&path);
    std::fs::write(&full_path, content.as_bytes())
        .map_err(|e| format!("Failed to write resolved content to '{path}': {e}"))?;

    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;
    let repo_guard = session.repo.lock();
    git::stage_file(&repo_guard, &path)
}

#[tauri::command]
pub async fn abort_repo_operation(
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<(), String> {
    let (workdir, git_cmd, repo_state) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        let repo_guard = session.repo.lock();
        let (state_name, _) = git::get_repository_state_info(&repo_guard);
        (session.path.clone(), resolve_git_command(), state_name)
    };

    let args: Vec<&str> = match repo_state.as_str() {
        "merge" => vec!["merge", "--abort"],
        "rebase" => vec!["rebase", "--abort"],
        "cherry_pick" => vec!["cherry-pick", "--abort"],
        "revert" => vec!["revert", "--abort"],
        _ => {
            if workdir.join(".git").join("MERGE_HEAD").exists() {
                vec!["merge", "--abort"]
            } else if workdir.join(".git").join("rebase-merge").exists() || workdir.join(".git").join("rebase-apply").exists() {
                vec!["rebase", "--abort"]
            } else if workdir.join(".git").join("CHERRY_PICK_HEAD").exists() {
                vec!["cherry-pick", "--abort"]
            } else if workdir.join(".git").join("REVERT_HEAD").exists() {
                vec!["revert", "--abort"]
            } else {
                return Err("No active merge, rebase, cherry-pick, or revert operation to abort.".to_string());
            }
        }
    };

    let output = create_silent_command(&git_cmd)
        .args(&args)
        .current_dir(&workdir)
        .output()
        .map_err(|e| format!("Failed to execute git {}: {e}", args.join(" ")))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr);
        return Err(format!("git {} failed: {err}", args.join(" ")));
    }

    Ok(())
}

#[tauri::command]
pub async fn continue_repo_operation(
    app_handle: AppHandle,
    state: State<'_, AppRepoState>,
    repo_id: String,
) -> Result<(), String> {
    let (pty_manager, workdir, git_cmd, repo_state) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        let repo_guard = session.repo.lock();
        let (state_name, _) = git::get_repository_state_info(&repo_guard);
        (session.pty_manager.clone(), session.path.clone(), resolve_git_command(), state_name)
    };

    let args: Vec<String> = match repo_state.as_str() {
        "merge" => vec!["commit".to_string(), "--no-edit".to_string()],
        "rebase" => vec!["rebase".to_string(), "--continue".to_string()],
        "cherry_pick" => vec!["cherry-pick".to_string(), "--continue".to_string()],
        "revert" => vec!["revert".to_string(), "--continue".to_string()],
        _ => {
            if workdir.join(".git").join("MERGE_HEAD").exists() {
                vec!["commit".to_string(), "--no-edit".to_string()]
            } else if workdir.join(".git").join("rebase-merge").exists() || workdir.join(".git").join("rebase-apply").exists() {
                vec!["rebase".to_string(), "--continue".to_string()]
            } else if workdir.join(".git").join("CHERRY_PICK_HEAD").exists() {
                vec!["cherry-pick".to_string(), "--continue".to_string()]
            } else if workdir.join(".git").join("REVERT_HEAD").exists() {
                vec!["revert".to_string(), "--continue".to_string()]
            } else {
                return Err("No active operation to continue.".to_string());
            }
        }
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
pub async fn get_file_blame(
    state: State<'_, AppRepoState>,
    repo_id: String,
    path: String,
) -> Result<git::FileBlameData, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Session not found: {repo_id}"))?;

    let repo_guard = session.repo.lock();
    git::get_file_blame(&repo_guard, &path)
}

#[tauri::command]
pub async fn get_file_history(
    state: State<'_, AppRepoState>,
    repo_id: String,
    path: String,
) -> Result<Vec<git::FileHistoryItem>, String> {
    let (workdir, git_cmd) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.path.clone(), resolve_git_command())
    };

    let output = create_silent_command(&git_cmd)
        .args([
            "log",
            "--follow",
            "-n",
            "100",
            "--format=%H%x00%an%x00%ae%x00%at%x00%s",
            "--shortstat",
            "--",
            &path,
        ])
        .current_dir(&workdir)
        .output()
        .map_err(|e| format!("Failed to execute git log: {e}"))?;

    let output_str = String::from_utf8_lossy(&output.stdout);
    Ok(git::parse_file_history_output(&output_str))
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
    tags: Option<bool>,
    follow_tags: Option<bool>,
) -> Result<(), String> {
    let (
        pty_manager,
        workdir,
        auto_upstream,
        resolved_branch_name,
        target_remote,
        upstream_merge_name,
    ) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;

        let repo = session.repo.lock();
        let mut cur_branch = None;
        let mut default_remote = "origin".to_string();
        let mut upstream_remote = None;
        let mut upstream_merge = None;
        let mut has_upstream = false;

        if let Ok(head) = repo.head() {
            if head.is_branch() {
                if let Some(bname) = head.shorthand() {
                    cur_branch = Some(bname.to_string());
                }
            }
        }

        if let Ok(remotes) = repo.remotes() {
            if let Some(first_remote) = remotes.get(0) {
                default_remote = first_remote.to_string();
            }
        }

        let push_branch = branch.as_deref().or(cur_branch.as_deref());

        if let Some(bname) = push_branch {
            if let Ok(local_b) = repo.find_branch(bname, git2::BranchType::Local) {
                if let Ok(upstream) = local_b.upstream() {
                    has_upstream = true;
                    if let Some(ref_name) = local_b.get().name() {
                        if let Ok(buf) = repo.branch_upstream_remote(ref_name) {
                            if let Some(s) = buf.as_str() {
                                upstream_remote = Some(s.to_string());
                            }
                        }
                        if let Ok(buf) = repo.branch_upstream_merge(ref_name) {
                            if let Some(s) = buf.as_str() {
                                let short = s.strip_prefix("refs/heads/").unwrap_or(s);
                                upstream_merge = Some(short.to_string());
                            }
                        }
                    }
                    if upstream_remote.is_none() {
                        if let Some(shorthand) = upstream.get().shorthand() {
                            if let Some((rem, mrg)) = shorthand.split_once('/') {
                                upstream_remote = Some(rem.to_string());
                                upstream_merge = Some(mrg.to_string());
                            }
                        }
                    }
                }
            }
        }

        let chosen_remote = remote
            .or(upstream_remote)
            .unwrap_or(default_remote);

        (
            session.pty_manager.clone(),
            session.path.clone(),
            !has_upstream,
            push_branch.map(String::from),
            chosen_remote,
            upstream_merge,
        )
    };

    let git_cmd = resolve_git_command();
    let mut args = vec!["push".to_string()];
    if force.unwrap_or(false) {
        args.push("--force-with-lease".to_string());
    }

    if tags.unwrap_or(false) {
        args.push("--tags".to_string());
    } else if follow_tags.unwrap_or(false) {
        args.push("--follow-tags".to_string());
    }

    let should_set_upstream = set_upstream.unwrap_or(auto_upstream);
    if should_set_upstream {
        args.push("--set-upstream".to_string());
        args.push(target_remote);
        if let Some(b) = resolved_branch_name {
            args.push(b);
        }
    } else {
        args.push(target_remote);
        if let Some(local_b) = resolved_branch_name {
            if let Some(upstream_mrg) = upstream_merge_name {
                if upstream_mrg != local_b {
                    // Upstream remote branch has a different name than local branch (Issue #38)
                    // Push explicit refspec: <local_branch>:<upstream_branch>
                    args.push(format!("{local_b}:{upstream_mrg}"));
                } else {
                    args.push(local_b);
                }
            } else {
                args.push(local_b);
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

pub fn build_worktree_add_args(
    path: &str,
    branch: &str,
    new_branch: bool,
    no_track: bool,
) -> Vec<String> {
    let mut args = vec!["worktree".to_string(), "add".to_string()];
    if new_branch {
        args.push("-b".to_string());
        args.push(branch.to_string());
        if no_track {
            args.push("--no-track".to_string());
        }
        args.push(path.to_string());
    } else {
        args.push(path.to_string());
        if !branch.trim().is_empty() {
            args.push(branch.to_string());
        }
    }
    args
}

#[tauri::command]
pub async fn add_worktree(
    state: State<'_, AppRepoState>,
    repo_id: String,
    path: String,
    branch: String,
    new_branch: Option<bool>,
    no_track: Option<bool>,
) -> Result<(), String> {
    let (workdir, git_cmd) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Session not found: {repo_id}"))?;
        (session.path.clone(), resolve_git_command())
    };

    let raw_path = path.trim().trim_matches(['"', '\'']).trim();
    let clean_path = if let Some(stripped) = raw_path.strip_prefix(r"\\?\\") {
        stripped
    } else {
        raw_path
    };
    let clean_path = clean_path.trim_end_matches(['/', '\\']);
    if clean_path.is_empty() {
        return Err("Worktree path cannot be empty".to_string());
    }

    let branch_trimmed = branch.trim();
    if branch_trimmed.is_empty() {
        return Err("Worktree branch name cannot be empty".to_string());
    }

    // If clean_path points to an existing directory that has entries (or is the repo itself),
    // append the branch name as a subdirectory so Git doesn't fail with 'already exists'.
    let target_dir = std::path::Path::new(clean_path);
    let resolved_path = if target_dir.is_dir() {
        let is_empty = std::fs::read_dir(target_dir)
            .map(|mut entries| entries.next().is_none())
            .unwrap_or(false);
        if !is_empty {
            let subfolder_name = branch_trimmed.replace(['/', '\\', ':'], "-");
            target_dir.join(subfolder_name).to_string_lossy().to_string()
        } else {
            clean_path.to_string()
        }
    } else {
        clean_path.to_string()
    };

    let is_new_branch = new_branch.unwrap_or(false);
    let branch_existed_before = if is_new_branch {
        let check = create_silent_command(&git_cmd)
            .args(["rev-parse", "--verify", &format!("refs/heads/{}", branch_trimmed)])
            .current_dir(&workdir)
            .output();
        check.map(|o| o.status.success()).unwrap_or(false)
    } else {
        false
    };

    let args = build_worktree_add_args(
        &resolved_path,
        branch_trimmed,
        is_new_branch,
        no_track.unwrap_or(true),
    );

    let output = create_silent_command(&git_cmd)
        .args(&args)
        .current_dir(&workdir)
        .output()
        .map_err(|e| format!("Failed to execute git worktree add: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let stdout = String::from_utf8_lossy(&output.stdout);
        let err_msg = if !stderr.trim().is_empty() {
            stderr.trim().to_string()
        } else if !stdout.trim().is_empty() {
            stdout.trim().to_string()
        } else {
            "Unknown error executing git worktree add".to_string()
        };

        // If a new branch was requested and did not exist before this call,
        // but Git created the branch ref before failing the worktree directory setup,
        // cleanly delete the orphaned branch so the repository is not left in a broken state.
        if is_new_branch && !branch_existed_before {
            let _ = create_silent_command(&git_cmd)
                .args(["branch", "-D", branch_trimmed])
                .current_dir(&workdir)
                .output();
        }

        return Err(format!("git worktree add failed: {err_msg}"));
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

    let clean_path = path.trim().trim_end_matches(['/', '\\']).to_string();

    let mut args = vec!["worktree".to_string(), "remove".to_string()];
    if force {
        args.push("--force".to_string());
    }
    args.push(clean_path.clone());

    let output = create_silent_command(&git_cmd)
        .args(&args)
        .current_dir(&workdir)
        .output()
        .map_err(|e| format!("Failed to execute git worktree remove: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        // If the directory does not exist on disk, or git notes it is not a working tree, try git worktree prune
        if !std::path::Path::new(&clean_path).exists() || stderr.contains("is not a working tree") {
            let prune_output = create_silent_command(&git_cmd)
                .args(["worktree", "prune", "--expire", "now"])
                .current_dir(&workdir)
                .output();
            if let Ok(po) = prune_output {
                if po.status.success() {
                    return Ok(());
                }
            }
        }
        return Err(format!("git worktree remove failed: {stderr}"));
    }

    // Ensure the folder on disk is completely removed (Windows file handles can sometimes leave empty folders)
    if std::path::Path::new(&clean_path).exists() {
        let _ = std::fs::remove_dir_all(&clean_path);
    }

    // Always prune after remove so git administrative files drop the worktree reference immediately
    let _ = create_silent_command(&git_cmd)
        .args(["worktree", "prune", "--expire", "now"])
        .current_dir(&workdir)
        .output();

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
    let (workdir, git_cmd) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
        (session.path.clone(), resolve_git_command())
    };

    let clean_branch = branch_name
        .trim()
        .trim_start_matches("refs/heads/")
        .trim_start_matches("refs/remotes/")
        .to_string();

    // 1. Check if trying to delete the currently active branch of the main repository
    if !is_remote {
        let is_active_branch = {
            let registry = state.read();
            if let Some(session) = registry.get(&repo_id) {
                let repo = session.repo.lock();
                repo.head()
                    .ok()
                    .and_then(|h| h.shorthand().map(|s| s == clean_branch))
                    .unwrap_or(false)
            } else {
                false
            }
        };

        if is_active_branch {
            return Err(format!(
                "Cannot delete currently active branch '{clean_branch}'. Please switch to another branch first."
            ));
        }
    }

    // 2. Try libgit2 deletion first
    let libgit2_res = {
        let registry = state.read();
        if let Some(session) = registry.get(&repo_id) {
            let repo = session.repo.lock();
            git::delete_branch(&repo, &clean_branch, is_remote)
        } else {
            Err("Session not found".to_string())
        }
    };

    if libgit2_res.is_ok() {
        return Ok(());
    }

    let libgit2_err = libgit2_res.unwrap_err();

    // For remote branch deletion, libgit2 handles references; if it failed, return error
    if is_remote {
        return Err(libgit2_err);
    }

    // 3. Fallback for local branches:
    // Worktree metadata in .git/worktrees/ may be stale or held by cached handles.
    // Prune stale worktrees with `--expire now`
    let _ = create_silent_command(&git_cmd)
        .args(["worktree", "prune", "--expire", "now"])
        .current_dir(&workdir)
        .output();

    // Run native Git CLI `git branch -D <clean_branch>`
    let cli_output = create_silent_command(&git_cmd)
        .args(["branch", "-D", &clean_branch])
        .current_dir(&workdir)
        .output()
        .map_err(|e| format!("Failed to execute git branch -D: {e}"))?;

    if cli_output.status.success() {
        log::info!("Deleted branch '{}' via git CLI fallback", clean_branch);
        return Ok(());
    }

    let stderr = String::from_utf8_lossy(&cli_output.stderr);
    let trimmed_stderr = stderr.trim();

    if trimmed_stderr.contains("checked out at") {
        return Err(format!("Cannot delete branch '{clean_branch}': {trimmed_stderr}"));
    }

    if !trimmed_stderr.is_empty() {
        Err(format!("Cannot delete branch '{clean_branch}': {trimmed_stderr}"))
    } else {
        Err(libgit2_err)
    }
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
    let (workdir, git_cmd) = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
        (session.path.clone(), resolve_git_command())
    };

    let res = {
        let registry = state.read();
        let session = registry
            .get(&repo_id)
            .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
        let mut repo = session.repo.lock();
        git::create_stash(&mut *repo, message.as_deref(), include_untracked)
    };

    match res {
        Ok(()) => Ok(()),
        Err(e) if e.contains("No local changes to stash") => Err(e),
        Err(orig_err) => {
            // Fallback to Git CLI (e.g. for linked worktrees or edge cases where libgit2 fails)
            let mut cmd = std::process::Command::new(&git_cmd);
            cmd.current_dir(&workdir);
            cmd.arg("stash").arg("push");
            if include_untracked {
                cmd.arg("--include-untracked");
            }
            if let Some(ref m) = message {
                if !m.trim().is_empty() {
                    cmd.arg("-m").arg(m.trim());
                }
            }
            match cmd.output() {
                Ok(output) if output.status.success() => Ok(()),
                Ok(output) => {
                    let err_str = String::from_utf8_lossy(&output.stderr);
                    if err_str.contains("No local changes to save")
                        || err_str.contains("nothing to stash")
                    {
                        Err("No local changes to stash.".to_string())
                    } else {
                        Err(format!("Stash failed: {orig_err} | CLI: {err_str}"))
                    }
                }
                Err(_) => Err(orig_err),
            }
        }
    }
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
pub async fn get_stash_details(
    state: State<'_, AppRepoState>,
    repo_id: String,
    stash_index: usize,
) -> Result<git::StashDetails, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let mut repo = session.repo.lock();
    git::get_stash_details(&mut *repo, stash_index)
}

#[tauri::command]
pub async fn get_stash_file_diff(
    state: State<'_, AppRepoState>,
    repo_id: String,
    stash_index: usize,
    file_path: String,
) -> Result<git::FileDiff, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let mut repo = session.repo.lock();
    git::get_stash_file_diff(&mut *repo, stash_index, &file_path)
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
pub async fn get_branch_comparison(
    state: State<'_, AppRepoState>,
    repo_id: String,
    base_ref: String,
    compare_ref: String,
    include_uncommitted: Option<bool>,
) -> Result<git::BranchComparisonDetails, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::get_branch_comparison(
        &repo,
        &base_ref,
        &compare_ref,
        include_uncommitted.unwrap_or(false),
    )
}

#[tauri::command]
pub async fn get_branch_comparison_file_diff(
    state: State<'_, AppRepoState>,
    repo_id: String,
    base_ref: String,
    compare_ref: String,
    file_path: String,
    include_uncommitted: Option<bool>,
) -> Result<git::FileDiff, String> {
    let registry = state.read();
    let session = registry
        .get(&repo_id)
        .ok_or_else(|| format!("Repository session '{}' not found", repo_id))?;
    let repo = session.repo.lock();
    git::get_branch_comparison_file_diff(
        &repo,
        &base_ref,
        &compare_ref,
        &file_path,
        include_uncommitted.unwrap_or(false),
    )
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
pub async fn push_all_tags(
    app_handle: AppHandle,
    state: State<'_, AppRepoState>,
    repo_id: String,
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
    let args = vec!["push".to_string(), remote_target, "--tags".to_string()];

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
    if let Err(e) = app_handle.shell().open(&url, None) {
        log::warn!("tauri-plugin-shell failed to open URL ({e}), falling back to system launcher");
        #[cfg(target_os = "windows")]
        {
            let _ = std::process::Command::new("cmd")
                .args(["/c", "start", "", &url])
                .spawn();
            return Ok(());
        }
        #[cfg(target_os = "macos")]
        {
            let _ = std::process::Command::new("open").arg(&url).spawn();
            return Ok(());
        }
        #[cfg(target_os = "linux")]
        {
            let _ = std::process::Command::new("xdg-open").arg(&url).spawn();
            return Ok(());
        }
        #[allow(unreachable_code)]
        return Err(format!("Failed to open browser: {e}"));
    }
    Ok(())
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
    pub chum_jackpots: u64,
    #[serde(default)]
    pub storage_path: String,
    #[serde(default)]
    pub exists: bool,
}

fn resolve_gitshark_dir() -> std::path::PathBuf {
    let home_dir = std::env::var_os("USERPROFILE")
        .or_else(|| std::env::var_os("HOME"))
        .map(std::path::PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    home_dir.join(".gitshark")
}

fn resolve_shark_stats_path() -> std::path::PathBuf {
    resolve_gitshark_dir().join("shark_stats.json")
}

fn resolve_open_repos_path() -> std::path::PathBuf {
    resolve_gitshark_dir().join("open_repos.json")
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct OpenReposSession {
    pub open_paths: Vec<String>,
    pub active_path: Option<String>,
}

#[tauri::command]
pub fn get_saved_open_repos() -> Result<OpenReposSession, String> {
    let path = resolve_open_repos_path();
    if path.is_file() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(mut session) = serde_json::from_str::<OpenReposSession>(&content) {
                // Keep only paths that currently exist on disk
                session.open_paths.retain(|p| std::path::Path::new(p).exists());
                if let Some(ref active) = session.active_path {
                    if !std::path::Path::new(active).exists() {
                        session.active_path = session.open_paths.first().cloned();
                    }
                }
                return Ok(session);
            }
        }
    }
    Ok(OpenReposSession::default())
}

#[tauri::command]
pub fn save_open_repos(session: OpenReposSession) -> Result<(), String> {
    let path = resolve_open_repos_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create ~/.gitshark directory: {e}"))?;
    }
    let json = serde_json::to_string_pretty(&session)
        .map_err(|e| format!("Failed to serialize open repos: {e}"))?;
    std::fs::write(&path, json)
        .map_err(|e| format!("Failed to write open repos to {}: {e}", path.display()))?;
    Ok(())
}

#[tauri::command]
pub fn get_shark_stats() -> Result<SharkStatsData, String> {
    let path = resolve_shark_stats_path();
    let path_str = path.to_string_lossy().to_string();

    if path.is_file() {
        if let Ok(content) = std::fs::read_to_string(&path) {
            if let Ok(mut parsed) = serde_json::from_str::<SharkStatsData>(&content) {
                parsed.storage_path = path_str;
                parsed.exists = true;
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
        chum_jackpots: 0,
        storage_path: path_str,
        exists: false,
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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSharkDirEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSharkPathInfo {
    pub path: String,
    pub name: String,
    pub is_dir: bool,
    pub exists: bool,
}

fn simple_percent_encode(s: &str) -> String {
    let mut encoded = String::new();
    for b in s.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                encoded.push(b as char);
            }
            _ => {
                encoded.push_str(&format!("%{:02X}", b));
            }
        }
    }
    encoded
}

#[tauri::command]
pub fn get_path_info(target_path: String) -> Result<CodeSharkPathInfo, String> {
    let p = std::path::Path::new(&target_path);
    if !p.exists() {
        return Ok(CodeSharkPathInfo {
            path: target_path.clone(),
            name: p.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or(target_path),
            is_dir: false,
            exists: false,
        });
    }

    let canonical = std::fs::canonicalize(p).unwrap_or_else(|_| p.to_path_buf());
    let normalized = canonical.to_string_lossy().to_string().replace(r"\\?\", "");
    let name = canonical.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_else(|| normalized.clone());

    Ok(CodeSharkPathInfo {
        path: normalized,
        name,
        is_dir: canonical.is_dir(),
        exists: true,
    })
}

#[tauri::command]
pub async fn launch_or_focus_codeshark(
    app_handle: AppHandle,
    target_path: Option<String>,
) -> Result<(), String> {
    let normalized_path = target_path.map(|p| {
        let path = std::path::Path::new(&p);
        if let Ok(canon) = std::fs::canonicalize(path) {
            canon.to_string_lossy().to_string().replace(r"\\?\", "")
        } else {
            p
        }
    });

    if let Some(window) = app_handle.get_webview_window("codeshark") {
        let _ = window.unminimize();
        let _ = window.show();
        let _ = window.set_focus();

        if let Some(ref path) = normalized_path {
            let _ = window.emit("codeshark:open-target", serde_json::json!({ "path": path }));
        }
    } else {
        let mut url_str = "index.html?app=codeshark".to_string();
        if let Some(ref path) = normalized_path {
            let encoded = simple_percent_encode(path);
            url_str = format!("index.html?app=codeshark&initPath={}", encoded);
        }

        let builder = tauri::WebviewWindowBuilder::new(
            &app_handle,
            "codeshark",
            tauri::WebviewUrl::App(url_str.into()),
        )
        .title("CodeShark")
        .inner_size(1400.0, 900.0)
        .min_inner_size(800.0, 500.0)
        .center()
        .decorations(true)
        .focused(true);

        builder.build().map_err(|e| format!("Failed to create CodeShark window: {e}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn read_dir_entries(dir_path: String) -> Result<Vec<CodeSharkDirEntry>, String> {
    let p = std::path::Path::new(&dir_path);
    if !p.exists() || !p.is_dir() {
        return Err(format!("Path '{}' is not a valid directory", dir_path));
    }

    let entries = std::fs::read_dir(p)
        .map_err(|e| format!("Failed to read directory '{}': {e}", dir_path))?;

    let mut result = Vec::new();

    for entry in entries.flatten() {
        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name == ".git" {
            continue;
        }

        let file_type = entry.file_type();
        let is_dir = file_type.as_ref().map(|t| t.is_dir()).unwrap_or(false);
        let path_buf = entry.path();
        let normalized = path_buf.to_string_lossy().to_string().replace(r"\\?\", "");

        let size = if !is_dir {
            entry.metadata().ok().map(|m| m.len())
        } else {
            None
        };

        result.push(CodeSharkDirEntry {
            name: file_name,
            path: normalized,
            is_dir,
            size,
        });
    }

    result.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(result)
}

#[tauri::command]
pub fn read_text_file(file_path: String) -> Result<String, String> {
    let p = std::path::Path::new(&file_path);
    if !p.exists() || !p.is_file() {
        return Err(format!("File '{}' does not exist or is not a file", file_path));
    }

    if let Ok(meta) = p.metadata() {
        if meta.len() > 10 * 1024 * 1024 {
            return Err("File exceeds 10MB limit for in-memory editor".to_string());
        }
    }

    std::fs::read_to_string(p)
        .map_err(|e| format!("Failed to read file '{}': {e}", file_path))
}

#[tauri::command]
pub fn write_text_file(file_path: String, content: String) -> Result<(), String> {
    let p = std::path::Path::new(&file_path);
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            let _ = std::fs::create_dir_all(parent);
        }
    }

    std::fs::write(p, content.as_bytes())
        .map_err(|e| format!("Failed to write file '{}': {e}", file_path))
}

#[tauri::command]
pub async fn get_repo_git_status(dir_path: String) -> Result<HashMap<String, String>, String> {
    let p = std::path::Path::new(&dir_path);
    if !p.exists() {
        return Ok(HashMap::new());
    }

    let repo = match git2::Repository::discover(p) {
        Ok(r) => r,
        Err(_) => return Ok(HashMap::new()),
    };

    let status = git::get_working_tree_status(&repo)?;
    let mut map = HashMap::new();

    for item in status.untracked {
        map.insert(item.path.replace('\\', "/"), "untracked".to_string());
    }
    for item in status.unstaged {
        map.insert(item.path.replace('\\', "/"), item.status);
    }
    for item in status.staged {
        map.entry(item.path.replace('\\', "/")).or_insert_with(|| "staged".to_string());
    }
    for item in status.conflicted {
        map.insert(item.path.replace('\\', "/"), "conflicted".to_string());
    }

    Ok(map)
}

#[tauri::command]
pub async fn get_file_git_head_content(
    dir_path: String,
    file_path: String,
) -> Result<Option<String>, String> {
    let p = std::path::Path::new(&dir_path);
    if !p.exists() {
        return Ok(None);
    }

    let repo = match git2::Repository::discover(p) {
        Ok(r) => r,
        Err(_) => return Ok(None),
    };

    let workdir = repo.workdir().unwrap_or(p);
    let full_file = std::path::Path::new(&file_path);
    let canon_workdir = std::fs::canonicalize(workdir).unwrap_or_else(|_| workdir.to_path_buf());
    let canon_file = std::fs::canonicalize(full_file).unwrap_or_else(|_| full_file.to_path_buf());

    let rel_path = match canon_file.strip_prefix(&canon_workdir) {
        Ok(rel) => rel.to_path_buf(),
        Err(_) => match full_file.strip_prefix(workdir) {
            Ok(rel) => rel.to_path_buf(),
            Err(_) => return Ok(None),
        },
    };

    let rel_str = rel_path.to_string_lossy().replace('\\', "/");
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => return Ok(None),
    };

    let commit = match head.peel_to_commit() {
        Ok(c) => c,
        Err(_) => return Ok(None),
    };

    let tree = match commit.tree() {
        Ok(t) => t,
        Err(_) => return Ok(None),
    };

    let entry = match tree.get_path(std::path::Path::new(&rel_str)) {
        Ok(e) => e,
        Err(_) => return Ok(None),
    };

    let object = match entry.to_object(&repo) {
        Ok(o) => o,
        Err(_) => return Ok(None),
    };

    let blob = match object.as_blob() {
        Some(b) => b,
        None => return Ok(None),
    };

    match std::str::from_utf8(blob.content()) {
        Ok(s) => Ok(Some(s.to_string())),
        Err(_) => Ok(None),
    }
}


#[tauri::command]
pub fn create_codeshark_file(file_path: String) -> Result<(), String> {
    let p = std::path::Path::new(&file_path);
    if p.exists() {
        return Err(format!("File '{}' already exists", file_path));
    }
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create parent directories: {e}"))?;
        }
    }
    std::fs::File::create(p)
        .map_err(|e| format!("Failed to create file: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn create_codeshark_dir(dir_path: String) -> Result<(), String> {
    let p = std::path::Path::new(&dir_path);
    if p.exists() {
        return Err(format!("Directory '{}' already exists", dir_path));
    }
    std::fs::create_dir_all(p)
        .map_err(|e| format!("Failed to create directory: {e}"))?;
    Ok(())
}

#[tauri::command]
pub fn rename_codeshark_path(old_path: String, new_path: String) -> Result<(), String> {
    let old_p = std::path::Path::new(&old_path);
    let new_p = std::path::Path::new(&new_path);
    if !old_p.exists() {
        return Err(format!("Path '{}' does not exist", old_path));
    }
    if new_p.exists() && old_path.to_lowercase() != new_path.to_lowercase() {
        return Err(format!("Target path '{}' already exists", new_path));
    }
    if let Some(parent) = new_p.parent() {
        if !parent.exists() {
            let _ = std::fs::create_dir_all(parent);
        }
    }
    std::fs::rename(old_p, new_p)
        .map_err(|e| format!("Failed to rename '{}' to '{}': {e}", old_path, new_path))?;
    Ok(())
}

#[tauri::command]
pub fn delete_codeshark_path(target_path: String) -> Result<(), String> {
    let p = std::path::Path::new(&target_path);
    if !p.exists() {
        return Ok(());
    }
    if p.is_dir() {
        std::fs::remove_dir_all(p)
            .map_err(|e| format!("Failed to delete directory '{}': {e}", target_path))?;
    } else {
        std::fs::remove_file(p)
            .map_err(|e| format!("Failed to delete file '{}': {e}", target_path))?;
    }
    Ok(())
}

#[tauri::command]
pub fn reveal_in_file_manager(target_path: String) -> Result<(), String> {
    let p = std::path::Path::new(&target_path);
    if !p.exists() {
        return Err(format!("Path '{}' does not exist", target_path));
    }

    #[cfg(target_os = "windows")]
    {
        let win_path = p.to_string_lossy().replace('/', "\\");
        let arg = format!("/select,{}", win_path);
        let _ = std::process::Command::new("explorer")
            .arg(arg)
            .spawn()
            .map_err(|e| format!("Failed to launch Explorer: {e}"))?;
        return Ok(());
    }

    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .args(["-R", &target_path])
            .spawn()
            .map_err(|e| format!("Failed to launch Finder: {e}"))?;
        return Ok(());
    }

    #[cfg(target_os = "linux")]
    {
        let parent = if p.is_dir() { p } else { p.parent().unwrap_or(p) };
        let _ = std::process::Command::new("xdg-open")
            .arg(parent)
            .spawn()
            .map_err(|e| format!("Failed to launch file manager: {e}"))?;
        return Ok(());
    }

    #[allow(unreachable_code)]
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceContentMatch {
    pub file_path: String,
    pub file_name: String,
    pub relative_path: String,
    pub line_number: usize,
    pub line_content: String,
    pub match_start: usize,
    pub match_end: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchWorkspaceContentOptions {
    pub root_paths: Vec<String>,
    pub query: String,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub is_regex: bool,
    pub include_pattern: Option<String>,
    pub exclude_pattern: Option<String>,
    pub max_results: Option<usize>,
}

fn matches_filter_pattern(path_str: &str, file_name: &str, pattern: &str) -> bool {
    let parts: Vec<&str> = pattern.split(',').map(|s| s.trim()).filter(|s| !s.is_empty()).collect();
    if parts.is_empty() {
        return true;
    }
    let lower_path = path_str.to_lowercase();
    let lower_name = file_name.to_lowercase();

    for pat in parts {
        let pat_clean = pat.trim_start_matches('*').to_lowercase();
        if pat.starts_with('*') && pat.ends_with('*') {
            let mid = &pat[1..pat.len() - 1].to_lowercase();
            if lower_path.contains(mid) {
                return true;
            }
        } else if pat.starts_with('*') {
            if lower_name.ends_with(&pat_clean) {
                return true;
            }
        } else if lower_path.contains(&pat.to_lowercase()) {
            return true;
        }
    }
    false
}

fn build_search_regex(
    query: &str,
    case_sensitive: bool,
    whole_word: bool,
    is_regex: bool,
) -> Result<regex::Regex, String> {
    let base_pattern = if is_regex {
        query.to_string()
    } else {
        regex::escape(query)
    };

    let patterned = if whole_word {
        format!(r"\b{}\b", base_pattern)
    } else {
        base_pattern
    };

    regex::RegexBuilder::new(&patterned)
        .case_insensitive(!case_sensitive)
        .multi_line(false)
        .build()
        .map_err(|e| format!("Invalid search pattern: {e}"))
}

#[tauri::command]
pub fn search_workspace_content(
    options: SearchWorkspaceContentOptions,
) -> Result<Vec<WorkspaceContentMatch>, String> {
    if options.query.trim().is_empty() {
        return Ok(Vec::new());
    }

    let re = build_search_regex(
        &options.query,
        options.case_sensitive,
        options.whole_word,
        options.is_regex,
    )?;
    let max = options.max_results.unwrap_or(1000);
    let mut matches = Vec::new();

    for root_str in &options.root_paths {
        if matches.len() >= max {
            break;
        }

        let root_path = std::path::Path::new(root_str);
        if !root_path.exists() {
            continue;
        }

        for entry in walkdir::WalkDir::new(root_path)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                if e.file_type().is_dir() {
                    !name.starts_with(".git")
                        && name != "node_modules"
                        && name != "target"
                        && name != "dist"
                        && name != "build"
                        && name != ".next"
                        && name != ".turbo"
                        && name != ".cache"
                        && name != ".vscode"
                        && name != ".idea"
                } else {
                    true
                }
            })
            .flatten()
        {
            if matches.len() >= max {
                break;
            }
            if !entry.file_type().is_file() {
                continue;
            }

            let file_path = entry.path();
            if let Ok(meta) = entry.metadata() {
                if meta.len() > 5 * 1024 * 1024 {
                    continue;
                }
            }

            let file_name = entry.file_name().to_string_lossy().to_string();
            let full_path_str = file_path
                .to_string_lossy()
                .to_string()
                .replace(r"\\?\", "")
                .replace('\\', "/");

            if let Some(ref incl) = options.include_pattern {
                if !incl.trim().is_empty() && !matches_filter_pattern(&full_path_str, &file_name, incl) {
                    continue;
                }
            }
            if let Some(ref excl) = options.exclude_pattern {
                if !excl.trim().is_empty() && matches_filter_pattern(&full_path_str, &file_name, excl) {
                    continue;
                }
            }

            let Ok(bytes) = std::fs::read(file_path) else {
                continue;
            };
            if bytes.iter().take(4096).any(|&b| b == 0) {
                continue;
            }
            let Ok(text) = std::str::from_utf8(&bytes) else {
                continue;
            };

            let rel_path = file_path
                .strip_prefix(root_path)
                .map(|p| p.to_string_lossy().to_string().replace('\\', "/"))
                .unwrap_or_else(|_| file_name.clone());

            for (idx, line) in text.lines().enumerate() {
                if matches.len() >= max {
                    break;
                }
                for m in re.find_iter(line) {
                    let line_content = if line.len() > 400 {
                        let start = m.start().saturating_sub(60);
                        let end = (m.end() + 60).min(line.len());
                        format!("...{}...", &line[start..end])
                    } else {
                        line.to_string()
                    };

                    matches.push(WorkspaceContentMatch {
                        file_path: full_path_str.clone(),
                        file_name: file_name.clone(),
                        relative_path: rel_path.clone(),
                        line_number: idx + 1,
                        line_content,
                        match_start: m.start(),
                        match_end: m.end(),
                    });

                    if matches.len() >= max {
                        break;
                    }
                }
            }
        }
    }

    Ok(matches)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceReplaceOptions {
    pub root_paths: Vec<String>,
    pub query: String,
    pub replacement: String,
    pub case_sensitive: bool,
    pub whole_word: bool,
    pub is_regex: bool,
    pub include_pattern: Option<String>,
    pub exclude_pattern: Option<String>,
    pub target_files: Option<Vec<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceReplaceSummary {
    pub files_modified: usize,
    pub occurrences_replaced: usize,
    pub modified_files: Vec<String>,
}

#[tauri::command]
pub fn replace_workspace_content(
    options: WorkspaceReplaceOptions,
) -> Result<WorkspaceReplaceSummary, String> {
    if options.query.is_empty() {
        return Ok(WorkspaceReplaceSummary {
            files_modified: 0,
            occurrences_replaced: 0,
            modified_files: Vec::new(),
        });
    }

    let re = build_search_regex(
        &options.query,
        options.case_sensitive,
        options.whole_word,
        options.is_regex,
    )?;

    let mut candidate_files: Vec<std::path::PathBuf> = Vec::new();

    if let Some(ref targets) = options.target_files {
        for t in targets {
            candidate_files.push(std::path::PathBuf::from(t));
        }
    } else {
        for root_str in &options.root_paths {
            let root_path = std::path::Path::new(root_str);
            if !root_path.exists() {
                continue;
            }

            for entry in walkdir::WalkDir::new(root_path)
                .follow_links(false)
                .into_iter()
                .filter_entry(|e| {
                    let name = e.file_name().to_string_lossy();
                    if e.file_type().is_dir() {
                        !name.starts_with(".git")
                            && name != "node_modules"
                            && name != "target"
                            && name != "dist"
                            && name != "build"
                    } else {
                        true
                    }
                })
                .flatten()
            {
                if !entry.file_type().is_file() {
                    continue;
                }
                let file_name = entry.file_name().to_string_lossy().to_string();
                let full_str = entry.path().to_string_lossy().to_string().replace('\\', "/");

                if let Some(ref incl) = options.include_pattern {
                    if !incl.trim().is_empty() && !matches_filter_pattern(&full_str, &file_name, incl) {
                        continue;
                    }
                }
                if let Some(ref excl) = options.exclude_pattern {
                    if !excl.trim().is_empty() && matches_filter_pattern(&full_str, &file_name, excl) {
                        continue;
                    }
                }
                candidate_files.push(entry.into_path());
            }
        }
    }

    let mut files_modified = 0;
    let mut occurrences_replaced = 0;
    let mut modified_files = Vec::new();

    for file_path in candidate_files {
        if !file_path.is_file() {
            continue;
        }
        if let Ok(meta) = file_path.metadata() {
            if meta.len() > 10 * 1024 * 1024 {
                continue;
            }
        }

        let Ok(bytes) = std::fs::read(&file_path) else {
            continue;
        };
        if bytes.iter().take(4096).any(|&b| b == 0) {
            continue;
        }
        let Ok(content) = std::str::from_utf8(&bytes) else {
            continue;
        };

        let count = re.find_iter(content).count();
        if count > 0 {
            let replaced = re.replace_all(content, options.replacement.as_str());
            if std::fs::write(&file_path, replaced.as_bytes()).is_ok() {
                files_modified += 1;
                occurrences_replaced += count;
                let norm = file_path
                    .to_string_lossy()
                    .to_string()
                    .replace(r"\\?\", "")
                    .replace('\\', "/");
                modified_files.push(norm);
            }
        }
    }

    Ok(WorkspaceReplaceSummary {
        files_modified,
        occurrences_replaced,
        modified_files,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkspaceFileMatch {
    pub path: String,
    pub name: String,
    pub relative_path: String,
    pub is_dir: bool,
}

#[tauri::command]
pub fn search_workspace_files(
    root_paths: Vec<String>,
    query: String,
    max_results: Option<usize>,
) -> Result<Vec<WorkspaceFileMatch>, String> {
    let max = max_results.unwrap_or(200);
    let mut results = Vec::new();
    let query_lower = query.trim().to_lowercase();

    for root_str in &root_paths {
        if results.len() >= max {
            break;
        }
        let root_path = std::path::Path::new(root_str);
        if !root_path.exists() {
            continue;
        }

        for entry in walkdir::WalkDir::new(root_path)
            .follow_links(false)
            .into_iter()
            .filter_entry(|e| {
                let name = e.file_name().to_string_lossy();
                if e.file_type().is_dir() {
                    !name.starts_with(".git")
                        && name != "node_modules"
                        && name != "target"
                        && name != "dist"
                        && name != "build"
                } else {
                    true
                }
            })
            .flatten()
        {
            if results.len() >= max {
                break;
            }
            if entry.depth() == 0 {
                continue;
            }

            let name = entry.file_name().to_string_lossy().to_string();
            let path_norm = entry
                .path()
                .to_string_lossy()
                .to_string()
                .replace(r"\\?\", "")
                .replace('\\', "/");
            let rel_path = entry
                .path()
                .strip_prefix(root_path)
                .map(|p| p.to_string_lossy().to_string().replace('\\', "/"))
                .unwrap_or_else(|_| name.clone());

            let name_lower = name.to_lowercase();
            let rel_lower = rel_path.to_lowercase();

            if query_lower.is_empty() || name_lower.contains(&query_lower) || rel_lower.contains(&query_lower) {
                results.push(WorkspaceFileMatch {
                    path: path_norm,
                    name,
                    relative_path: rel_path,
                    is_dir: entry.file_type().is_dir(),
                });
            }
        }
    }

    Ok(results)
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
    fn test_shark_stats_chum_jackpots_serialization() {
        // Test backwards compatibility when chum_jackpots is missing from older JSON
        let legacy_json = r#"{"commits_swum":12,"changes_chomped":5,"pushes_launched":2,"stashes_buried":0}"#;
        let parsed: SharkStatsData = serde_json::from_str(legacy_json).expect("should parse legacy stats");
        assert_eq!(parsed.commits_swum, 12);
        assert_eq!(parsed.chum_jackpots, 0);

        // Test with chum_jackpots present
        let stats = SharkStatsData {
            commits_swum: 10,
            changes_chomped: 4,
            pushes_launched: 2,
            stashes_buried: 1,
            merges_to_main: 1,
            prs_opened: 1,
            chum_jackpots: 3,
            storage_path: "~/.gitshark/shark_stats.json".to_string(),
            exists: true,
        };
        let serialized = serde_json::to_string(&stats).expect("should serialize stats");
        assert!(serialized.contains("\"chum_jackpots\":3"));
        let deserialized: SharkStatsData = serde_json::from_str(&serialized).expect("should deserialize stats");
        assert_eq!(deserialized.chum_jackpots, 3);
        assert_eq!(deserialized.commits_swum, 10);
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

    #[test]
    fn test_open_repos_path_resolution() {
        let path = resolve_open_repos_path();
        assert!(path.to_string_lossy().contains(".gitshark"));
        assert!(path.to_string_lossy().ends_with("open_repos.json"));
    }

    #[test]
    fn test_build_worktree_add_args() {
        let args_default = build_worktree_add_args("../wt-path", "feat-wt", true, true);
        assert_eq!(args_default, vec!["worktree", "add", "-b", "feat-wt", "--no-track", "../wt-path"]);

        let args_track = build_worktree_add_args("../wt-path", "feat-wt", true, false);
        assert_eq!(args_track, vec!["worktree", "add", "-b", "feat-wt", "../wt-path"]);

        let args_existing = build_worktree_add_args("../wt-path", "existing-branch", false, true);
        assert_eq!(args_existing, vec!["worktree", "add", "../wt-path", "existing-branch"]);
    }

    #[test]
    fn test_open_repos_session_save_and_load() {
        let test_dir = std::env::temp_dir().join(format!("gitshark_session_test_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&test_dir);
        let session = OpenReposSession {
            open_paths: vec![test_dir.to_string_lossy().to_string()],
            active_path: Some(test_dir.to_string_lossy().to_string()),
        };
        let json = serde_json::to_string(&session).unwrap();
        let loaded: OpenReposSession = serde_json::from_str(&json).unwrap();
        assert_eq!(loaded.open_paths.len(), 1);
        assert_eq!(loaded.active_path, session.active_path);
        let _ = std::fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_codeshark_simple_percent_encode() {
        assert_eq!(simple_percent_encode("hello world"), "hello%20world");
        assert_eq!(simple_percent_encode("D:\\dev\\repo"), "D%3A%5Cdev%5Crepo");
        assert_eq!(simple_percent_encode("foo-bar_baz.txt~"), "foo-bar_baz.txt~");
    }

    #[test]
    fn test_codeshark_file_read_write_and_info() {
        let test_dir = std::env::temp_dir().join(format!("codeshark_test_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&test_dir);

        let test_file = test_dir.join("sample.txt");
        let content = "Hello CodeShark IDE!";
        assert!(write_text_file(test_file.to_string_lossy().to_string(), content.to_string()).is_ok());

        let read_back = read_text_file(test_file.to_string_lossy().to_string()).unwrap();
        assert_eq!(read_back, content);

        let info = get_path_info(test_file.to_string_lossy().to_string()).unwrap();
        assert!(info.exists);
        assert!(!info.is_dir);

        let dir_info = get_path_info(test_dir.to_string_lossy().to_string()).unwrap();
        assert!(dir_info.exists);
        assert!(dir_info.is_dir);

        let entries = read_dir_entries(test_dir.to_string_lossy().to_string()).unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].name, "sample.txt");
        assert!(!entries[0].is_dir);

        let _ = std::fs::remove_dir_all(&test_dir);
    }

    #[tokio::test]
    async fn test_codeshark_git_status_and_head_content() {
        let test_dir = std::env::temp_dir().join(format!("codeshark_git_test_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&test_dir);

        let repo = git2::Repository::init(&test_dir).unwrap();
        let sig = git2::Signature::now("Shark Tester", "test@gitshark.com").unwrap();

        let file_path = test_dir.join("main.rs");
        std::fs::write(&file_path, "fn main() {\n    println!(\"Initial\");\n}\n").unwrap();

        // Commit file into repo HEAD
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("main.rs")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[]).unwrap();

        // Verify reading HEAD content
        let head_content = get_file_git_head_content(
            test_dir.to_string_lossy().to_string(),
            file_path.to_string_lossy().to_string(),
        ).await.unwrap();
        assert_eq!(head_content, Some("fn main() {\n    println!(\"Initial\");\n}\n".to_string()));

        // Modify file on disk
        std::fs::write(&file_path, "fn main() {\n    println!(\"Modified\");\n}\n").unwrap();

        // Verify status shows modified
        let status = get_repo_git_status(test_dir.to_string_lossy().to_string()).await.unwrap();
        assert_eq!(status.get("main.rs").map(|s| s.as_str()), Some("modified"));

        let _ = std::fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_codeshark_fs_operations() {
        let test_dir = std::env::temp_dir().join(format!("codeshark_fs_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&test_dir);

        let sub_dir = test_dir.join("subdir");
        assert!(create_codeshark_dir(sub_dir.to_string_lossy().to_string()).is_ok());

        let new_file = sub_dir.join("test.txt");
        assert!(create_codeshark_file(new_file.to_string_lossy().to_string()).is_ok());
        assert!(new_file.exists());

        let renamed_file = sub_dir.join("renamed.txt");
        assert!(rename_codeshark_path(
            new_file.to_string_lossy().to_string(),
            renamed_file.to_string_lossy().to_string(),
        ).is_ok());
        assert!(!new_file.exists());
        assert!(renamed_file.exists());

        assert!(delete_codeshark_path(renamed_file.to_string_lossy().to_string()).is_ok());
        assert!(!renamed_file.exists());

        assert!(delete_codeshark_path(sub_dir.to_string_lossy().to_string()).is_ok());
        assert!(!sub_dir.exists());

        let _ = std::fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_codeshark_search_and_replace() {
        let test_dir = std::env::temp_dir().join(format!("codeshark_search_{}", uuid::Uuid::new_v4()));
        let _ = std::fs::create_dir_all(&test_dir);

        let file1 = test_dir.join("alpha.ts");
        let file2 = test_dir.join("beta.rs");
        std::fs::write(&file1, "const sharkName = 'GreatWhite';\nconsole.log(sharkName);\n").unwrap();
        std::fs::write(&file2, "fn shark_bite() {\n    let sharkName = \"Hammerhead\";\n}\n").unwrap();

        let search_opts = SearchWorkspaceContentOptions {
            root_paths: vec![test_dir.to_string_lossy().to_string()],
            query: "sharkName".to_string(),
            case_sensitive: true,
            whole_word: true,
            is_regex: false,
            include_pattern: None,
            exclude_pattern: None,
            max_results: Some(10),
        };

        let matches = search_workspace_content(search_opts).unwrap();
        assert_eq!(matches.len(), 3);

        // Test file search
        let file_matches = search_workspace_files(
            vec![test_dir.to_string_lossy().to_string()],
            "alpha".to_string(),
            None,
        ).unwrap();
        assert_eq!(file_matches.len(), 1);
        assert_eq!(file_matches[0].name, "alpha.ts");

        // Test replace workspace content
        let rep_opts = WorkspaceReplaceOptions {
            root_paths: vec![test_dir.to_string_lossy().to_string()],
            query: "sharkName".to_string(),
            replacement: "oceanBeast".to_string(),
            case_sensitive: true,
            whole_word: true,
            is_regex: false,
            include_pattern: None,
            exclude_pattern: None,
            target_files: None,
        };

        let summary = replace_workspace_content(rep_opts).unwrap();
        assert_eq!(summary.files_modified, 2);
        assert_eq!(summary.occurrences_replaced, 3);

        let after1 = std::fs::read_to_string(&file1).unwrap();
        assert!(after1.contains("oceanBeast"));
        assert!(!after1.contains("sharkName"));

        let _ = std::fs::remove_dir_all(&test_dir);
    }

}
