use git2::{ApplyLocation, Diff, DiffFormat, DiffOptions, Repository, Status, StatusOptions};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;

pub const COLOR_PALETTE_SIZE: usize = 8;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoMetadata {
    pub id: String,
    pub name: String,
    pub path: String,
    pub current_branch: Option<String>,
    pub is_detached: bool,
    pub head_commit_hash: Option<String>,
    pub head_commit_summary: Option<String>,
    pub is_dirty: bool,
    pub staged_count: usize,
    pub unstaged_count: usize,
    pub untracked_count: usize,
    #[serde(default)]
    pub conflicted_count: usize,
    #[serde(default)]
    pub repo_state: String,
    #[serde(default)]
    pub repo_state_label: Option<String>,
    pub remote_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileStatusItem {
    pub path: String,
    pub status: String, // "modified", "new", "deleted", "renamed", "typechange", "untracked", "conflicted"
    pub staged: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkingTreeStatus {
    pub staged: Vec<FileStatusItem>,
    pub unstaged: Vec<FileStatusItem>,
    pub untracked: Vec<FileStatusItem>,
    #[serde(default)]
    pub conflicted: Vec<FileStatusItem>,
    #[serde(default)]
    pub repo_state: String,
    #[serde(default)]
    pub repo_state_label: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictBlock {
    pub id: usize,
    pub ours_header: String,
    pub ours_content: String,
    pub base_content: Option<String>,
    pub theirs_content: String,
    pub theirs_header: String,
    pub start_line: usize,
    pub end_line: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConflictFileDetails {
    pub path: String,
    pub full_content: String,
    pub ours_content: Option<String>,
    pub theirs_content: Option<String>,
    pub base_content: Option<String>,
    pub blocks: Vec<ConflictBlock>,
    pub is_binary: bool,
    pub has_conflict_markers: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlameHunkItem {
    pub commit_id: String,
    pub commit_summary: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub start_line: usize,
    pub lines_in_hunk: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileBlameData {
    pub path: String,
    pub is_binary: bool,
    pub lines: Vec<String>,
    pub hunks: Vec<BlameHunkItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileHistoryItem {
    pub commit_hash: String,
    pub summary: String,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub origin: char, // '+', '-', ' '
    pub old_lineno: Option<u32>,
    pub new_lineno: Option<u32>,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffHunk {
    pub header: String,
    pub old_start: u32,
    pub old_lines: u32,
    pub new_start: u32,
    pub new_lines: u32,
    pub patch: String,
    pub lines: Vec<DiffLine>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FileDiff {
    pub old_path: Option<String>,
    pub new_path: Option<String>,
    pub is_binary: bool,
    pub is_new: bool,
    pub is_deleted: bool,
    pub hunks: Vec<DiffHunk>,
    pub total_additions: usize,
    pub total_deletions: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitRefBadge {
    pub name: String,
    pub shorthand: String,
    pub kind: String, // "head", "local_branch", "remote_branch", "tag"
    pub is_head: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchItem {
    pub name: String,
    pub shorthand: String,
    pub is_head: bool,
    pub is_remote: bool,
    pub upstream: Option<String>,
    pub target_commit: Option<String>,
    #[serde(default)]
    pub ahead: usize,
    #[serde(default)]
    pub behind: usize,
    #[serde(default)]
    pub has_uncommitted: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoBranches {
    pub local: Vec<BranchItem>,
    pub remote: Vec<BranchItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Edge {
    pub from_lane: usize,
    pub to_lane: usize,
    pub to_row: usize,
    pub is_merge: bool,
    pub color_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitNode {
    pub id: String,
    pub summary: String,
    pub author: String,
    pub author_email: String,
    pub timestamp: i64,
    pub hash: String,
    pub parents: Vec<String>,
    pub lane: usize,
    pub color_index: usize,
    pub edges: Vec<Edge>,
    pub refs: Vec<GitRefBadge>,
}

struct RawCommit {
    oid: git2::Oid,
    hash: String,
    summary: String,
    author: String,
    author_email: String,
    timestamp: i64,
    parents: Vec<git2::Oid>,
}

/// Inspect an open git2 Repository and return high-level workspace metadata
pub fn inspect_repository(
    repo: &Repository,
    session_id: &str,
    repo_path: &str,
) -> Result<RepoMetadata, String> {
    let path_obj = Path::new(repo_path);
    let name = path_obj
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Repository")
        .to_string();

    let (current_branch, is_detached, head_commit_hash, head_commit_summary) = match repo.head() {
        Ok(head_ref) => {
            let is_branch = head_ref.is_branch();
            let branch = head_ref.shorthand().map(String::from);
            let (hash, summary) = match head_ref.peel_to_commit() {
                Ok(commit) => (
                    Some(commit.id().to_string()),
                    commit.summary().map(String::from),
                ),
                Err(_) => (None, None),
            };
            (branch, !is_branch, hash, summary)
        }
        Err(_) => (None, false, None, None),
    };

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(false)
        .include_ignored(false);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to read git status: {e}"))?;

    let mut staged_count = 0;
    let mut unstaged_count = 0;
    let mut untracked_count = 0;
    let mut conflicted_count = 0;

    for entry in statuses.iter() {
        let s = entry.status();
        if s.contains(Status::CONFLICTED) {
            conflicted_count += 1;
            continue;
        }
        if s.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        ) {
            staged_count += 1;
        }
        if s.intersects(
            Status::WT_MODIFIED
                | Status::WT_DELETED
                | Status::WT_RENAMED
                | Status::WT_TYPECHANGE,
        ) {
            unstaged_count += 1;
        }
        if s.contains(Status::WT_NEW) {
            untracked_count += 1;
        }
    }

    let is_dirty = staged_count > 0 || unstaged_count > 0 || untracked_count > 0 || conflicted_count > 0;
    let remote_url = get_remote_url(repo, None);
    let (repo_state, repo_state_label) = get_repository_state_info(repo);

    Ok(RepoMetadata {
        id: session_id.to_string(),
        name,
        path: repo_path.to_string(),
        current_branch,
        is_detached,
        head_commit_hash,
        head_commit_summary,
        is_dirty,
        staged_count,
        unstaged_count,
        untracked_count,
        conflicted_count,
        repo_state,
        repo_state_label,
        remote_url,
    })
}

/// Query the primary remote URL (defaults to origin, or first discovered remote)
pub fn get_remote_url(repo: &Repository, remote_name: Option<&str>) -> Option<String> {
    let target = remote_name.unwrap_or("origin");
    if let Ok(rem) = repo.find_remote(target) {
        if let Some(url) = rem.url() {
            return Some(url.to_string());
        }
    }
    if let Ok(remotes) = repo.remotes() {
        for name in remotes.iter().flatten() {
            if let Ok(rem) = repo.find_remote(name) {
                if let Some(url) = rem.url() {
                    return Some(url.to_string());
                }
            }
        }
    }
    None
}

/// Detect the active repository lifecycle state (Clean, Merge, Rebase, CherryPick, Revert, Bisect)
pub fn get_repository_state_info(repo: &Repository) -> (String, Option<String>) {
    match repo.state() {
        git2::RepositoryState::Clean => ("clean".to_string(), None),
        git2::RepositoryState::Merge => {
            let msg = std::fs::read_to_string(repo.path().join("MERGE_MSG"))
                .ok()
                .and_then(|m| m.lines().next().map(|l| l.trim().to_string()));
            ("merge".to_string(), msg.or_else(|| Some("Merge in progress".to_string())))
        }
        git2::RepositoryState::Revert | git2::RepositoryState::RevertSequence => {
            ("revert".to_string(), Some("Revert in progress".to_string()))
        }
        git2::RepositoryState::CherryPick | git2::RepositoryState::CherryPickSequence => {
            ("cherry_pick".to_string(), Some("Cherry-pick in progress".to_string()))
        }
        git2::RepositoryState::Bisect => {
            ("bisect".to_string(), Some("Bisect in progress".to_string()))
        }
        git2::RepositoryState::Rebase
        | git2::RepositoryState::RebaseInteractive
        | git2::RepositoryState::RebaseMerge => {
            ("rebase".to_string(), Some("Rebase in progress".to_string()))
        }
        git2::RepositoryState::ApplyMailbox | git2::RepositoryState::ApplyMailboxOrRebase => {
            ("apply_mailbox".to_string(), Some("Mailbox apply in progress".to_string()))
        }
    }
}

/// Query working tree status into categorized lists: staged, unstaged, untracked, conflicted
pub fn get_working_tree_status(repo: &Repository) -> Result<WorkingTreeStatus, String> {
    // Reload index from disk so external operations (like git commit in PTY) are reflected immediately
    if let Ok(mut idx) = repo.index() {
        let _ = idx.read(true);
    }

    let mut opts = StatusOptions::new();
    opts.include_untracked(true)
        .recurse_untracked_dirs(true)
        .include_ignored(false)
        .update_index(true);

    let statuses = repo
        .statuses(Some(&mut opts))
        .map_err(|e| format!("Failed to read status: {e}"))?;

    let mut staged = Vec::new();
    let mut unstaged = Vec::new();
    let mut untracked = Vec::new();
    let mut conflicted = Vec::new();

    for entry in statuses.iter() {
        let path = entry.path().unwrap_or("").to_string();
        let s = entry.status();

        // Conflicted changes in index/working tree
        if s.contains(Status::CONFLICTED) {
            conflicted.push(FileStatusItem {
                path: path.clone(),
                status: "conflicted".to_string(),
                staged: false,
            });
            continue;
        }

        // Staged changes in index
        if s.intersects(
            Status::INDEX_NEW
                | Status::INDEX_MODIFIED
                | Status::INDEX_DELETED
                | Status::INDEX_RENAMED
                | Status::INDEX_TYPECHANGE,
        ) {
            let status_kind = if s.contains(Status::INDEX_NEW) {
                "new"
            } else if s.contains(Status::INDEX_DELETED) {
                "deleted"
            } else if s.contains(Status::INDEX_RENAMED) {
                "renamed"
            } else {
                "modified"
            };
            staged.push(FileStatusItem {
                path: path.clone(),
                status: status_kind.to_string(),
                staged: true,
            });
        }

        // Unstaged changes in working tree
        if s.intersects(
            Status::WT_MODIFIED
                | Status::WT_DELETED
                | Status::WT_RENAMED
                | Status::WT_TYPECHANGE,
        ) {
            let status_kind = if s.contains(Status::WT_DELETED) {
                "deleted"
            } else if s.contains(Status::WT_RENAMED) {
                "renamed"
            } else {
                "modified"
            };
            unstaged.push(FileStatusItem {
                path: path.clone(),
                status: status_kind.to_string(),
                staged: false,
            });
        }

        // Untracked new files
        if s.contains(Status::WT_NEW) {
            untracked.push(FileStatusItem {
                path,
                status: "untracked".to_string(),
                staged: false,
            });
        }
    }

    let (repo_state, repo_state_label) = get_repository_state_info(repo);

    Ok(WorkingTreeStatus {
        staged,
        unstaged,
        untracked,
        conflicted,
        repo_state,
        repo_state_label,
    })
}

/// Parses Git conflict markers (standard or diff3 format) into structured conflict blocks
pub fn parse_conflict_blocks(content: &str) -> Vec<ConflictBlock> {
    let mut blocks = Vec::new();
    let lines: Vec<&str> = content.lines().collect();

    enum ParserState {
        Outside,
        InOurs {
            header: String,
            start_line: usize,
            lines: Vec<String>,
        },
        InBase {
            header: String,
            start_line: usize,
            ours_lines: Vec<String>,
            base_lines: Vec<String>,
        },
        InTheirs {
            header: String,
            start_line: usize,
            ours_lines: Vec<String>,
            base_lines: Option<Vec<String>>,
            theirs_lines: Vec<String>,
        },
    }

    let mut state = ParserState::Outside;
    let mut block_id = 0;

    for (idx, line) in lines.iter().enumerate() {
        match &mut state {
            ParserState::Outside => {
                if line.starts_with("<<<<<<<") {
                    let header = line.trim_start_matches('<').trim().to_string();
                    state = ParserState::InOurs {
                        header,
                        start_line: idx,
                        lines: Vec::new(),
                    };
                }
            }
            ParserState::InOurs {
                header,
                start_line,
                lines: ours_lines,
            } => {
                if line.starts_with("|||||||") {
                    state = ParserState::InBase {
                        header: std::mem::take(header),
                        start_line: *start_line,
                        ours_lines: std::mem::take(ours_lines),
                        base_lines: Vec::new(),
                    };
                } else if line.starts_with("=======") {
                    state = ParserState::InTheirs {
                        header: std::mem::take(header),
                        start_line: *start_line,
                        ours_lines: std::mem::take(ours_lines),
                        base_lines: None,
                        theirs_lines: Vec::new(),
                    };
                } else {
                    ours_lines.push(line.to_string());
                }
            }
            ParserState::InBase {
                header,
                start_line,
                ours_lines,
                base_lines,
            } => {
                if line.starts_with("=======") {
                    state = ParserState::InTheirs {
                        header: std::mem::take(header),
                        start_line: *start_line,
                        ours_lines: std::mem::take(ours_lines),
                        base_lines: Some(std::mem::take(base_lines)),
                        theirs_lines: Vec::new(),
                    };
                } else {
                    base_lines.push(line.to_string());
                }
            }
            ParserState::InTheirs {
                header,
                start_line,
                ours_lines,
                base_lines,
                theirs_lines,
            } => {
                if line.starts_with(">>>>>>>") {
                    let theirs_header = line.trim_start_matches('>').trim().to_string();
                    blocks.push(ConflictBlock {
                        id: block_id,
                        ours_header: if header.is_empty() {
                            "Current Change (HEAD)".to_string()
                        } else {
                            header.clone()
                        },
                        ours_content: ours_lines.join("\n"),
                        base_content: base_lines.as_ref().map(|b| b.join("\n")),
                        theirs_content: theirs_lines.join("\n"),
                        theirs_header: if theirs_header.is_empty() {
                            "Incoming Change".to_string()
                        } else {
                            theirs_header
                        },
                        start_line: *start_line,
                        end_line: idx,
                    });
                    block_id += 1;
                    state = ParserState::Outside;
                } else {
                    theirs_lines.push(line.to_string());
                }
            }
        }
    }

    blocks
}

/// Inspect a conflicted file: reads working tree content with markers, parses conflict blocks,
/// and retrieves ancestor (stage 1), ours (stage 2), and theirs (stage 3) blobs from index.
pub fn get_conflicted_file_details(
    repo: &Repository,
    path: &str,
) -> Result<ConflictFileDetails, String> {
    let workdir = repo.workdir().ok_or("Bare repository")?;
    let full_path = workdir.join(path);

    let raw_bytes = if full_path.exists() {
        std::fs::read(&full_path).map_err(|e| format!("Failed to read file '{path}': {e}"))?
    } else {
        Vec::new()
    };

    let is_binary = raw_bytes.contains(&0);
    let full_content = if is_binary {
        String::new()
    } else {
        String::from_utf8_lossy(&raw_bytes).to_string()
    };

    let mut ours_content = None;
    let mut theirs_content = None;
    let mut base_content = None;

    if let Ok(index) = repo.index() {
        let path_obj = Path::new(path);
        // Stage 1: Ancestor (Base)
        if let Some(entry) = index.get_path(path_obj, 1) {
            if let Ok(blob) = repo.find_blob(entry.id) {
                if !blob.content().contains(&0) {
                    base_content = Some(String::from_utf8_lossy(blob.content()).to_string());
                }
            }
        }
        // Stage 2: Ours (HEAD)
        if let Some(entry) = index.get_path(path_obj, 2) {
            if let Ok(blob) = repo.find_blob(entry.id) {
                if !blob.content().contains(&0) {
                    ours_content = Some(String::from_utf8_lossy(blob.content()).to_string());
                }
            }
        }
        // Stage 3: Theirs (Incoming)
        if let Some(entry) = index.get_path(path_obj, 3) {
            if let Ok(blob) = repo.find_blob(entry.id) {
                if !blob.content().contains(&0) {
                    theirs_content = Some(String::from_utf8_lossy(blob.content()).to_string());
                }
            }
        }
    }

    let blocks = if !is_binary {
        parse_conflict_blocks(&full_content)
    } else {
        Vec::new()
    };

    let has_conflict_markers = !blocks.is_empty();

    Ok(ConflictFileDetails {
        path: path.to_string(),
        full_content,
        ours_content,
        theirs_content,
        base_content,
        blocks,
        is_binary,
        has_conflict_markers,
    })
}

/// Computes line-by-line Git blame for a file using libgit2.
pub fn get_file_blame(repo: &Repository, path: &str) -> Result<FileBlameData, String> {
    let path_obj = Path::new(path);
    let workdir = repo.workdir().ok_or("Bare repository")?;
    let full_path = workdir.join(path_obj);

    // 1. Read file content (from disk or fallback to HEAD commit tree)
    let raw_bytes = if full_path.exists() {
        std::fs::read(&full_path).map_err(|e| format!("Failed to read '{path}': {e}"))?
    } else if let Ok(head) = repo.head().and_then(|h| h.peel_to_commit()) {
        let tree = head.tree().map_err(|e| e.to_string())?;
        let entry = tree.get_path(path_obj).map_err(|e| e.to_string())?;
        let blob = repo.find_blob(entry.id()).map_err(|e| e.to_string())?;
        blob.content().to_vec()
    } else {
        return Err(format!("File '{path}' does not exist on disk or in HEAD commit"));
    };

    let is_binary = raw_bytes.contains(&0);
    if is_binary {
        return Ok(FileBlameData {
            path: path.to_string(),
            is_binary: true,
            lines: Vec::new(),
            hunks: Vec::new(),
        });
    }

    let text = String::from_utf8_lossy(&raw_bytes);
    let lines: Vec<String> = text.lines().map(String::from).collect();

    // 2. Compute blame hunks with libgit2
    let mut opts = git2::BlameOptions::new();
    let blame = repo
        .blame_file(path_obj, Some(&mut opts))
        .map_err(|e| format!("Failed to compute blame for '{path}': {e}"))?;

    let mut hunks = Vec::new();
    let mut commit_cache: HashMap<git2::Oid, String> = HashMap::new();

    for hunk in blame.iter() {
        let commit_id = hunk.final_commit_id();
        let summary = commit_cache
            .entry(commit_id)
            .or_insert_with(|| {
                repo.find_commit(commit_id)
                    .ok()
                    .and_then(|c| c.summary().map(String::from))
                    .unwrap_or_else(|| "Initial commit".to_string())
            })
            .clone();

        let sig = hunk.final_signature();
        let author_name = sig.name().unwrap_or("Unknown").to_string();
        let author_email = sig.email().unwrap_or("").to_string();
        let timestamp = sig.when().seconds();

        hunks.push(BlameHunkItem {
            commit_id: commit_id.to_string(),
            commit_summary: summary,
            author_name,
            author_email,
            timestamp,
            start_line: hunk.final_start_line(),
            lines_in_hunk: hunk.lines_in_hunk(),
        });
    }

    Ok(FileBlameData {
        path: path.to_string(),
        is_binary: false,
        lines,
        hunks,
    })
}

/// Parses output from `git log --follow --format=%H%x00%an%x00%ae%x00%at%x00%s --shortstat -- <path>`
pub fn parse_file_history_output(output_str: &str) -> Vec<FileHistoryItem> {
    let mut items = Vec::new();
    let lines: Vec<&str> = output_str.lines().collect();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i].trim();
        if line.is_empty() {
            i += 1;
            continue;
        }

        let parts: Vec<&str> = line.split('\0').collect();
        if parts.len() >= 5 {
            let commit_hash = parts[0].to_string();
            let author_name = parts[1].to_string();
            let author_email = parts[2].to_string();
            let timestamp: i64 = parts[3].parse().unwrap_or(0);
            let summary = parts[4].to_string();

            let mut additions = 0;
            let mut deletions = 0;

            if i + 1 < lines.len() {
                let stat_line = lines[i + 1].trim();
                if stat_line.contains("file changed") || stat_line.contains("files changed") {
                    if let Some(ins_idx) = stat_line.find("insertion") {
                        let prefix = &stat_line[..ins_idx];
                        if let Some(num_str) = prefix.split_whitespace().last() {
                            additions = num_str.parse().unwrap_or(0);
                        }
                    }
                    if let Some(del_idx) = stat_line.find("deletion") {
                        let prefix = &stat_line[..del_idx];
                        if let Some(num_str) = prefix.split_whitespace().last() {
                            deletions = num_str.parse().unwrap_or(0);
                        }
                    }
                    i += 1;
                }
            }

            items.push(FileHistoryItem {
                commit_hash,
                summary,
                author_name,
                author_email,
                timestamp,
                additions,
                deletions,
            });
        }
        i += 1;
    }

    items
}

/// Add a specific file path to the Git index (staging)
pub fn stage_file(repo: &Repository, path: &str) -> Result<(), String> {
    let mut index = repo.index().map_err(|e| format!("Failed to open index: {e}"))?;
    let path_obj = Path::new(path);
    let workdir = repo.workdir().ok_or("Bare repository")?;
    let full_path = workdir.join(path_obj);

    if full_path.exists() {
        index.add_path(path_obj).map_err(|e| format!("Failed to stage path: {e}"))?;
    } else {
        index.remove_path(path_obj).map_err(|e| format!("Failed to stage removal: {e}"))?;
    }

    index.write().map_err(|e| format!("Failed to write index: {e}"))?;
    Ok(())
}

/// Reset a specific file in the index back to HEAD (unstaging)
pub fn unstage_file(repo: &Repository, path: &str) -> Result<(), String> {
    match repo.head() {
        Ok(head) => {
            let commit = head.peel_to_commit().map_err(|e| e.to_string())?;
            let obj = commit.into_object();
            repo.reset_default(Some(&obj), [path])
                .map_err(|e| format!("Failed to unstage path: {e}"))?;
        }
        Err(_) => {
            // Unborn branch (empty repo with no commits yet)
            let mut index = repo.index().map_err(|e| e.to_string())?;
            index.remove_path(Path::new(path)).map_err(|e| e.to_string())?;
            index.write().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Stage all modified and untracked files into the index
pub fn stage_all_files(repo: &Repository) -> Result<(), String> {
    let mut index = repo.index().map_err(|e| format!("Failed to open index: {e}"))?;
    index
        .add_all(["*"].iter(), git2::IndexAddOption::DEFAULT, None)
        .map_err(|e| format!("Failed to stage all files: {e}"))?;
    index.write().map_err(|e| format!("Failed to write index: {e}"))?;
    Ok(())
}

/// Unstage all files in the index back to HEAD
pub fn unstage_all_files(repo: &Repository) -> Result<(), String> {
    if let Ok(head) = repo.head() {
        let commit = head.peel_to_commit().map_err(|e| e.to_string())?;
        let obj = commit.into_object();
        repo.reset_default(Some(&obj), ["*"])
            .map_err(|e| format!("Failed to unstage all files: {e}"))?;
    } else {
        let mut index = repo.index().map_err(|e| e.to_string())?;
        index.clear().map_err(|e| e.to_string())?;
        index.write().map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Discard uncommitted working directory changes for a file
pub fn discard_file_changes(repo: &Repository, path: &str) -> Result<(), String> {
    let workdir = repo.workdir().ok_or("Bare repository")?;
    let full_path = workdir.join(path);

    // If untracked file, delete it from disk
    let mut status_opts = StatusOptions::new();
    status_opts.pathspec(path).include_untracked(true);
    let statuses = repo.statuses(Some(&mut status_opts)).map_err(|e| e.to_string())?;

    let is_untracked = statuses.iter().any(|s| s.status().contains(Status::WT_NEW));
    if is_untracked {
        if full_path.is_file() {
            fs::remove_file(&full_path).map_err(|e| format!("Failed to remove file: {e}"))?;
        } else if full_path.is_dir() {
            fs::remove_dir_all(&full_path).map_err(|e| format!("Failed to remove directory: {e}"))?;
        }
        return Ok(());
    }

    // If tracked, checkout file from HEAD
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.path(path).force();
    repo.checkout_head(Some(&mut checkout))
        .map_err(|e| format!("Failed to checkout file: {e}"))?;

    Ok(())
}

/// Discard all unstaged working directory changes (revert tracked unstaged changes to index, delete untracked files)
pub fn discard_all_unstaged_changes(repo: &Repository) -> Result<(), String> {
    let workdir = repo.workdir().ok_or("Bare repository")?;

    // 1. Remove untracked files
    let mut status_opts = StatusOptions::new();
    status_opts.include_untracked(true);
    let statuses = repo.statuses(Some(&mut status_opts)).map_err(|e| e.to_string())?;

    for entry in statuses.iter() {
        let s = entry.status();
        if s.contains(Status::WT_NEW) {
            if let Some(path) = entry.path() {
                let full_path = workdir.join(path);
                if full_path.is_file() || full_path.is_symlink() {
                    let _ = fs::remove_file(&full_path);
                } else if full_path.is_dir() {
                    let _ = fs::remove_dir_all(&full_path);
                }
            }
        }
    }

    // 2. Checkout index to restore modified/deleted working directory files to match index
    let mut checkout = git2::build::CheckoutBuilder::new();
    checkout.force();
    repo.checkout_index(None, Some(&mut checkout))
        .map_err(|e| format!("Failed to checkout index: {e}"))?;

    Ok(())
}

/// Apply a single hunk diff patch directly to the index (selective staging)
pub fn stage_hunk(repo: &Repository, patch: &str) -> Result<(), String> {
    let diff = Diff::from_buffer(patch.as_bytes())
        .map_err(|e| format!("Invalid hunk patch: {e}"))?;

    repo.apply(&diff, ApplyLocation::Index, None)
        .map_err(|e| format!("Failed to apply patch to index: {e}"))?;

    let mut index = repo.index().map_err(|e| format!("Failed to open index: {e}"))?;
    index.write().map_err(|e| format!("Failed to write index: {e}"))?;

    Ok(())
}

/// Apply a patch to unstage changes from the index
pub fn unstage_patch(repo: &Repository, patch: &str) -> Result<(), String> {
    let diff = Diff::from_buffer(patch.as_bytes())
        .map_err(|e| format!("Invalid unstage patch: {e}"))?;

    repo.apply(&diff, ApplyLocation::Index, None)
        .map_err(|e| format!("Failed to apply unstage patch to index: {e}"))?;

    let mut index = repo.index().map_err(|e| format!("Failed to open index: {e}"))?;
    index.write().map_err(|e| format!("Failed to write index: {e}"))?;

    Ok(())
}

/// Apply a patch to discard changes from the working directory
pub fn discard_patch(repo: &Repository, patch: &str) -> Result<(), String> {
    let diff = Diff::from_buffer(patch.as_bytes())
        .map_err(|e| format!("Invalid discard patch: {e}"))?;

    repo.apply(&diff, ApplyLocation::WorkDir, None)
        .map_err(|e| format!("Failed to apply discard patch to working directory: {e}"))?;

    Ok(())
}

/// Helper to construct a unified diff patch for selected lines within a hunk.
/// - is_inverse: false for staging unstaged lines into index;
///               true for unstaging from index or discarding from working tree.
pub fn build_selected_lines_patch(
    file_path: &str,
    hunk: &DiffHunk,
    selected_indices: &[usize],
    is_inverse: bool,
) -> Result<String, String> {
    let clean_path = file_path.trim_start_matches(['/', '\\']);
    let mut patch_lines = Vec::new();
    let mut old_count: u32 = 0;
    let mut new_count: u32 = 0;

    if !is_inverse {
        // Forward: Staging unstaged lines into Index
        for (idx, line) in hunk.lines.iter().enumerate() {
            let is_selected = selected_indices.contains(&idx);
            match line.origin {
                ' ' => {
                    patch_lines.push(format!(" {}", line.content));
                    old_count += 1;
                    new_count += 1;
                }
                '-' => {
                    if is_selected {
                        patch_lines.push(format!("-{}", line.content));
                        old_count += 1;
                    } else {
                        // Unselected deletion remains in index as context
                        patch_lines.push(format!(" {}", line.content));
                        old_count += 1;
                        new_count += 1;
                    }
                }
                '+' => {
                    if is_selected {
                        patch_lines.push(format!("+{}", line.content));
                        new_count += 1;
                    } else {
                        // Unselected addition is omitted from patch
                    }
                }
                _ => {}
            }
        }

        let start_line = if hunk.old_start > 0 { hunk.old_start } else { 1 };
        let header = format!("@@ -{},{} +{},{} @@", start_line, old_count, start_line, new_count);
        let mut patch = format!(
            "diff --git a/{clean_path} b/{clean_path}\n--- a/{clean_path}\n+++ b/{clean_path}\n{}\n",
            header
        );
        for l in patch_lines {
            patch.push_str(&l);
            patch.push('\n');
        }
        Ok(patch)
    } else {
        // Inverse: Unstaging from Index OR Discarding from Workdir
        for (idx, line) in hunk.lines.iter().enumerate() {
            let is_selected = selected_indices.contains(&idx);
            match line.origin {
                ' ' => {
                    patch_lines.push(format!(" {}", line.content));
                    old_count += 1;
                    new_count += 1;
                }
                '+' => {
                    if is_selected {
                        patch_lines.push(format!("-{}", line.content));
                        old_count += 1;
                    } else {
                        patch_lines.push(format!(" {}", line.content));
                        old_count += 1;
                        new_count += 1;
                    }
                }
                '-' => {
                    if is_selected {
                        patch_lines.push(format!("+{}", line.content));
                        new_count += 1;
                    }
                }
                _ => {}
            }
        }

        let start_line = if hunk.new_start > 0 {
            hunk.new_start
        } else if hunk.old_start > 0 {
            hunk.old_start
        } else {
            1
        };
        let header = format!("@@ -{},{} +{},{} @@", start_line, old_count, start_line, new_count);
        let mut patch = format!(
            "diff --git a/{clean_path} b/{clean_path}\n--- a/{clean_path}\n+++ b/{clean_path}\n{}\n",
            header
        );
        for l in patch_lines {
            patch.push_str(&l);
            patch.push('\n');
        }
        Ok(patch)
    }
}

/// Helper to construct a synthetic single-hunk diff from content (all added or all deleted)
fn create_synthetic_diff(
    clean_path: &str,
    content_str: &str,
    is_new: bool,
    is_deleted: bool,
) -> FileDiff {
    let lines_vec: Vec<&str> = content_str.lines().collect();
    let line_count = lines_vec.len() as u32;

    let origin = if is_deleted { '-' } else { '+' };
    let mut diff_lines = Vec::with_capacity(lines_vec.len());

    for (idx, line_text) in lines_vec.iter().enumerate() {
        diff_lines.push(DiffLine {
            origin,
            old_lineno: if is_deleted { Some((idx + 1) as u32) } else { None },
            new_lineno: if is_deleted { None } else { Some((idx + 1) as u32) },
            content: line_text.to_string(),
        });
    }

    let header = if is_deleted {
        format!("@@ -1,{} +0,0 @@", line_count.max(1))
    } else {
        format!("@@ -0,0 +1,{} @@", line_count.max(1))
    };

    let mut patch = if is_deleted {
        format!("diff --git a/{clean_path} b/{clean_path}\n--- a/{clean_path}\n+++ /dev/null\n{header}\n")
    } else {
        format!("diff --git a/{clean_path} b/{clean_path}\n--- /dev/null\n+++ b/{clean_path}\n{header}\n")
    };

    for line_text in &lines_vec {
        patch.push(origin);
        patch.push_str(line_text);
        patch.push('\n');
    }

    let hunks = if line_count == 0 {
        Vec::new()
    } else {
        vec![DiffHunk {
            header,
            old_start: if is_deleted { 1 } else { 0 },
            old_lines: if is_deleted { line_count } else { 0 },
            new_start: if is_deleted { 0 } else { 1 },
            new_lines: if is_deleted { 0 } else { line_count },
            patch,
            lines: diff_lines,
        }]
    };

    FileDiff {
        old_path: if is_new { None } else { Some(clean_path.to_string()) },
        new_path: if is_deleted { None } else { Some(clean_path.to_string()) },
        is_binary: false,
        is_new,
        is_deleted,
        hunks,
        total_additions: if is_new { line_count as usize } else { 0 },
        total_deletions: if is_deleted { line_count as usize } else { 0 },
    }
}

/// Generate structured diff data for a file (staged vs unstaged)
pub fn get_file_diff(repo: &Repository, path: &str, staged: bool) -> Result<FileDiff, String> {
    let clean_path = path.replace('\\', "/");
    let clean_path = clean_path.trim_start_matches('/');
    let workdir = repo.workdir().ok_or("Bare repository")?;
    let full_path = workdir.join(clean_path);

    let mut index = repo.index().map_err(|e| format!("Failed to read index: {e}"))?;
    let _ = index.read(true);
    let in_index = index.get_path(Path::new(clean_path), 0).is_some();

    // 1. Untracked file in working tree (not staged, not in index, exists on disk)
    if !staged && !in_index && full_path.is_file() {
        let bytes = fs::read(&full_path).unwrap_or_default();
        let is_binary = bytes.iter().take(8000).any(|&b| b == 0);
        if is_binary {
            return Ok(FileDiff {
                old_path: None,
                new_path: Some(clean_path.to_string()),
                is_binary: true,
                is_new: true,
                is_deleted: false,
                hunks: Vec::new(),
                total_additions: 0,
                total_deletions: 0,
            });
        }
        let content_str = String::from_utf8_lossy(&bytes);
        return Ok(create_synthetic_diff(clean_path, &content_str, true, false));
    }

    // 2. Unstaged deleted file (not staged, tracked in index, but removed from workdir)
    if !staged && in_index && !full_path.exists() {
        if let Some(entry) = index.get_path(Path::new(clean_path), 0) {
            if let Ok(blob) = repo.find_blob(entry.id) {
                let bytes = blob.content();
                let is_binary = bytes.iter().take(8000).any(|&b| b == 0);
                if is_binary {
                    return Ok(FileDiff {
                        old_path: Some(clean_path.to_string()),
                        new_path: None,
                        is_binary: true,
                        is_new: false,
                        is_deleted: true,
                        hunks: Vec::new(),
                        total_additions: 0,
                        total_deletions: 0,
                    });
                }
                let content_str = String::from_utf8_lossy(bytes);
                return Ok(create_synthetic_diff(clean_path, &content_str, false, true));
            }
        }
    }

    let head_tree = match repo.head() {
        Ok(h) => h.peel_to_tree().ok(),
        Err(_) => None,
    };

    let in_head = head_tree.as_ref().map_or(false, |tree| {
        tree.get_path(Path::new(clean_path)).is_ok()
    });

    // 3. Staged new file (staged in index, but does not exist in HEAD tree)
    if staged && in_index && !in_head {
        if let Some(entry) = index.get_path(Path::new(clean_path), 0) {
            if let Ok(blob) = repo.find_blob(entry.id) {
                let bytes = blob.content();
                let is_binary = bytes.iter().take(8000).any(|&b| b == 0);
                if is_binary {
                    return Ok(FileDiff {
                        old_path: None,
                        new_path: Some(clean_path.to_string()),
                        is_binary: true,
                        is_new: true,
                        is_deleted: false,
                        hunks: Vec::new(),
                        total_additions: 0,
                        total_deletions: 0,
                    });
                }
                let content_str = String::from_utf8_lossy(bytes);
                return Ok(create_synthetic_diff(clean_path, &content_str, true, false));
            }
        }
    }

    // 4. Staged deleted file (staged deletion: removed from index, but was in HEAD tree)
    if staged && !in_index && in_head {
        if let Some(ref tree) = head_tree {
            if let Ok(entry) = tree.get_path(Path::new(clean_path)) {
                if let Ok(blob) = repo.find_blob(entry.id()) {
                    let bytes = blob.content();
                    let is_binary = bytes.iter().take(8000).any(|&b| b == 0);
                    if is_binary {
                        return Ok(FileDiff {
                            old_path: Some(clean_path.to_string()),
                            new_path: None,
                            is_binary: true,
                            is_new: false,
                            is_deleted: true,
                            hunks: Vec::new(),
                            total_additions: 0,
                            total_deletions: 0,
                        });
                    }
                    let content_str = String::from_utf8_lossy(bytes);
                    return Ok(create_synthetic_diff(clean_path, &content_str, false, true));
                }
            }
        }
    }

    // 5. Standard modified file diff via libgit2
    let mut diff_opts = DiffOptions::new();
    diff_opts.pathspec(clean_path);

    let diff = if staged {
        repo.diff_tree_to_index(head_tree.as_ref(), None, Some(&mut diff_opts))
            .map_err(|e| format!("Failed to generate staged diff: {e}"))?
    } else {
        repo.diff_index_to_workdir(None, Some(&mut diff_opts))
            .map_err(|e| format!("Failed to generate unstaged diff: {e}"))?
    };

    parse_git2_diff(&diff, clean_path)
}

pub fn parse_git2_diff(diff: &git2::Diff, clean_path: &str) -> Result<FileDiff, String> {
    let mut hunks: Vec<DiffHunk> = Vec::new();
    let mut current_hunk: Option<DiffHunk> = None;
    let mut total_additions = 0;
    let mut total_deletions = 0;
    let mut is_binary = false;
    let mut old_path = None;
    let mut new_path = None;
    let mut is_new = false;
    let mut is_deleted = false;

    let diff_file_header = format!(
        "diff --git a/{clean_path} b/{clean_path}\n--- a/{clean_path}\n+++ b/{clean_path}\n"
    );

    diff.print(DiffFormat::Patch, |delta, hunk_opt, line| {
        if old_path.is_none() {
            old_path = delta.old_file().path().map(|p| p.to_string_lossy().to_string());
            new_path = delta.new_file().path().map(|p| p.to_string_lossy().to_string());
            is_binary = delta.flags().contains(git2::DiffFlags::BINARY);
            is_new = delta.status() == git2::Delta::Added || delta.status() == git2::Delta::Untracked;
            is_deleted = delta.status() == git2::Delta::Deleted;
        }

        let origin = line.origin();

        if origin == 'H' {
            if let Some(h) = current_hunk.take() {
                hunks.push(h);
            }
            if let Some(hunk_info) = hunk_opt {
                let header = String::from_utf8_lossy(hunk_info.header()).trim_end().to_string();
                current_hunk = Some(DiffHunk {
                    header: header.clone(),
                    old_start: hunk_info.old_start(),
                    old_lines: hunk_info.old_lines(),
                    new_start: hunk_info.new_start(),
                    new_lines: hunk_info.new_lines(),
                    patch: format!("{}{}\n", diff_file_header, header),
                    lines: Vec::new(),
                });
            }
        } else if origin == '+' || origin == '-' || origin == ' ' {
            let content = String::from_utf8_lossy(line.content()).to_string();
            if origin == '+' {
                total_additions += 1;
            } else if origin == '-' {
                total_deletions += 1;
            }

            if let Some(ref mut h) = current_hunk {
                h.patch.push(origin);
                h.patch.push_str(&content);
                if !content.ends_with('\n') {
                    h.patch.push('\n');
                }
                h.lines.push(DiffLine {
                    origin,
                    old_lineno: line.old_lineno(),
                    new_lineno: line.new_lineno(),
                    content: content.trim_end_matches(['\r', '\n']).to_string(),
                });
            }
        }

        true
    })
    .map_err(|e| format!("Failed to parse diff: {e}"))?;

    if let Some(h) = current_hunk {
        hunks.push(h);
    }

    Ok(FileDiff {
        old_path,
        new_path,
        is_binary,
        is_new,
        is_deleted,
        hunks,
        total_additions,
        total_deletions,
    })
}

/// Revwalk repository commit history, resolve branch lanes, parent-child routes,
/// and reference badges directly in Rust for 60fps frontend rendering.
pub fn parse_commit_graph(
    repo: &Repository,
    limit: usize,
    skip: usize,
) -> Result<Vec<CommitNode>, String> {
    let mut ref_map: HashMap<git2::Oid, Vec<GitRefBadge>> = HashMap::new();

    let (head_oid, head_is_branch, head_shorthand) = match repo.head() {
        Ok(head) => match head.peel_to_commit() {
            Ok(commit) => (
                Some(commit.id()),
                head.is_branch(),
                head.shorthand().unwrap_or("HEAD").to_string(),
            ),
            Err(_) => (None, false, "HEAD".to_string()),
        },
        Err(_) => (None, false, "HEAD".to_string()),
    };

    if let Some(oid) = head_oid {
        if !head_is_branch {
            ref_map.entry(oid).or_default().push(GitRefBadge {
                name: "HEAD".to_string(),
                shorthand: "HEAD (detached)".to_string(),
                kind: "detached".to_string(),
                is_head: true,
            });
        }
    }

    if let Ok(references) = repo.references() {
        for reference in references.flatten() {
            if let Ok(commit) = reference.peel_to_commit() {
                let oid = commit.id();
                let full_name = reference.name().unwrap_or("").to_string();
                let shorthand = reference.shorthand().unwrap_or("").to_string();

                if full_name.starts_with("refs/heads/") {
                    let is_current_head = head_is_branch && shorthand == head_shorthand;
                    ref_map.entry(oid).or_default().push(GitRefBadge {
                        name: full_name,
                        shorthand: if is_current_head {
                            format!("HEAD -> {}", shorthand)
                        } else {
                            shorthand
                        },
                        kind: if is_current_head {
                            "head".to_string()
                        } else {
                            "local_branch".to_string()
                        },
                        is_head: is_current_head,
                    });
                } else if full_name.starts_with("refs/remotes/") {
                    ref_map.entry(oid).or_default().push(GitRefBadge {
                        name: full_name,
                        shorthand,
                        kind: "remote_branch".to_string(),
                        is_head: false,
                    });
                } else if full_name.starts_with("refs/tags/") {
                    ref_map.entry(oid).or_default().push(GitRefBadge {
                        name: full_name,
                        shorthand,
                        kind: "tag".to_string(),
                        is_head: false,
                    });
                }
            }
        }
    }

    let mut revwalk = repo.revwalk().map_err(|e| format!("Failed to create revwalk: {e}"))?;
    revwalk
        .set_sorting(git2::Sort::TOPOLOGICAL | git2::Sort::TIME)
        .map_err(|e| format!("Failed to set revwalk sorting: {e}"))?;

    if let Ok(references) = repo.references() {
        for reference in references.flatten() {
            if let Ok(commit) = reference.peel_to_commit() {
                let _ = revwalk.push(commit.id());
            }
        }
    }

    if let Ok(head) = repo.head() {
        if let Ok(commit) = head.peel_to_commit() {
            let _ = revwalk.push(commit.id());
        }
    }

    let max_to_collect = (skip + limit).max(limit);
    let mut oids = Vec::new();

    for oid_res in revwalk {
        if let Ok(oid) = oid_res {
            oids.push(oid);
            if oids.len() >= max_to_collect {
                break;
            }
        }
    }

    if oids.is_empty() {
        return Ok(Vec::new());
    }

    let hash_to_row: HashMap<git2::Oid, usize> = oids
        .iter()
        .enumerate()
        .map(|(idx, &oid)| (oid, idx))
        .collect();

    let mut raw_commits: Vec<RawCommit> = Vec::with_capacity(oids.len());
    for &oid in &oids {
        if let Ok(commit) = repo.find_commit(oid) {
            let parents = commit.parent_ids().collect();
            let summary = commit.summary().unwrap_or("").to_string();
            let author_sig = commit.author();
            let author = author_sig.name().unwrap_or("Unknown").to_string();
            let author_email = author_sig.email().unwrap_or("").to_string();
            let timestamp = commit.time().seconds();
            let hash = oid.to_string();

            raw_commits.push(RawCommit {
                oid,
                hash,
                summary,
                author,
                author_email,
                timestamp,
                parents,
            });
        }
    }

    let total_rows = raw_commits.len();
    let mut active_lanes: Vec<Option<git2::Oid>> = Vec::new();
    let mut all_nodes: Vec<CommitNode> = Vec::with_capacity(total_rows);

    for (_row, c) in raw_commits.iter().enumerate() {
        let commit_lane = match active_lanes.iter().position(|slot| *slot == Some(c.oid)) {
            Some(pos) => pos,
            None => match active_lanes.iter().position(|slot| slot.is_none()) {
                Some(empty_idx) => {
                    active_lanes[empty_idx] = Some(c.oid);
                    empty_idx
                }
                None => {
                    active_lanes.push(Some(c.oid));
                    active_lanes.len() - 1
                }
            },
        };

        let mut edges = Vec::new();

        if c.parents.is_empty() {
            active_lanes[commit_lane] = None;
        } else {
            let p1 = c.parents[0];
            let p1_target_row = hash_to_row.get(&p1).copied().unwrap_or(total_rows + 1);

            if let Some(other_lane) = active_lanes.iter().position(|slot| *slot == Some(p1)) {
                if other_lane != commit_lane {
                    active_lanes[commit_lane] = None;
                    edges.push(Edge {
                        from_lane: commit_lane,
                        to_lane: other_lane,
                        to_row: p1_target_row,
                        is_merge: false,
                        color_index: commit_lane % COLOR_PALETTE_SIZE,
                    });
                } else {
                    active_lanes[commit_lane] = Some(p1);
                    edges.push(Edge {
                        from_lane: commit_lane,
                        to_lane: commit_lane,
                        to_row: p1_target_row,
                        is_merge: false,
                        color_index: commit_lane % COLOR_PALETTE_SIZE,
                    });
                }
            } else {
                active_lanes[commit_lane] = Some(p1);
                edges.push(Edge {
                    from_lane: commit_lane,
                    to_lane: commit_lane,
                    to_row: p1_target_row,
                    is_merge: false,
                    color_index: commit_lane % COLOR_PALETTE_SIZE,
                });
            }

            for &p_sec in c.parents.iter().skip(1) {
                let p_sec_target_row = hash_to_row.get(&p_sec).copied().unwrap_or(total_rows + 1);

                let sec_lane = match active_lanes.iter().position(|slot| *slot == Some(p_sec)) {
                    Some(pos) => pos,
                    None => match active_lanes.iter().position(|slot| slot.is_none()) {
                        Some(empty_idx) => {
                            active_lanes[empty_idx] = Some(p_sec);
                            empty_idx
                        }
                        None => {
                            active_lanes.push(Some(p_sec));
                            active_lanes.len() - 1
                        }
                    },
                };

                edges.push(Edge {
                    from_lane: commit_lane,
                    to_lane: sec_lane,
                    to_row: p_sec_target_row,
                    is_merge: true,
                    color_index: sec_lane % COLOR_PALETTE_SIZE,
                });
            }
        }

        while active_lanes.last() == Some(&None) {
            active_lanes.pop();
        }

        let refs = ref_map.remove(&c.oid).unwrap_or_default();

        all_nodes.push(CommitNode {
            id: c.hash.clone(),
            summary: c.summary.clone(),
            author: c.author.clone(),
            author_email: c.author_email.clone(),
            timestamp: c.timestamp,
            hash: c.hash.clone(),
            parents: c.parents.iter().map(|p| p.to_string()).collect(),
            lane: commit_lane,
            color_index: commit_lane % COLOR_PALETTE_SIZE,
            edges,
            refs,
        });
    }

    let result_nodes = if skip > 0 {
        all_nodes.into_iter().skip(skip).take(limit).collect()
    } else {
        all_nodes
    };

    Ok(result_nodes)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HookDetail {
    pub name: String,
    pub path: String,
    pub is_executable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RepoHooksInfo {
    pub hooks_dir: String,
    pub has_pre_commit: bool,
    pub has_commit_msg: bool,
    pub has_pre_push: bool,
    pub active_hooks: Vec<HookDetail>,
}

/// Detect active client hooks configured in core.hooksPath or inside .git/hooks/
pub fn detect_repo_hooks(repo: &Repository) -> Result<RepoHooksInfo, String> {
    // 1. Resolve hooks path from core.hooksPath or fallback to repo.path().join("hooks")
    let hooks_path_buf = if let Ok(config) = repo.config() {
        if let Ok(path_str) = config.get_string("core.hooksPath") {
            let p = Path::new(&path_str);
            if p.is_absolute() {
                p.to_path_buf()
            } else if let Some(workdir) = repo.workdir() {
                workdir.join(p)
            } else {
                repo.path().join(p)
            }
        } else {
            repo.path().join("hooks")
        }
    } else {
        repo.path().join("hooks")
    };

    let hooks_dir_str = hooks_path_buf.to_string_lossy().to_string();
    let mut active_hooks = Vec::new();
    let mut has_pre_commit = false;
    let mut has_commit_msg = false;
    let mut has_pre_push = false;

    if hooks_path_buf.is_dir() {
        if let Ok(entries) = fs::read_dir(&hooks_path_buf) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() {
                    let file_name = path
                        .file_name()
                        .and_then(|f| f.to_str())
                        .unwrap_or("")
                        .to_string();

                    if file_name.ends_with(".sample") || file_name.is_empty() {
                        continue;
                    }

                    let base_name = file_name
                        .trim_end_matches(".bat")
                        .trim_end_matches(".cmd")
                        .trim_end_matches(".ps1")
                        .trim_end_matches(".sh")
                        .trim_end_matches(".exe");

                    if base_name == "pre-commit" {
                        has_pre_commit = true;
                    } else if base_name == "commit-msg" {
                        has_commit_msg = true;
                    } else if base_name == "pre-push" {
                        has_pre_push = true;
                    }

                    active_hooks.push(HookDetail {
                        name: file_name,
                        path: path.to_string_lossy().to_string(),
                        is_executable: true,
                    });
                }
            }
        }
    }

    Ok(RepoHooksInfo {
        hooks_dir: hooks_dir_str,
        has_pre_commit,
        has_commit_msg,
        has_pre_push,
        active_hooks,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorktreeItem {
    pub path: String,
    pub head: Option<String>,
    pub branch: Option<String>,
    pub is_detached: bool,
    pub is_locked: bool,
    pub lock_reason: Option<String>,
    pub is_prunable: bool,
    pub is_main: bool,
}

pub fn parse_worktree_porcelain(stdout: &str) -> Vec<WorktreeItem> {
    let mut worktrees = Vec::new();
    let blocks = stdout.split("\n\n");

    for (idx, block) in blocks.enumerate() {
        let lines: Vec<&str> = block.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();
        if lines.is_empty() {
            continue;
        }

        let mut path = String::new();
        let mut head = None;
        let mut branch = None;
        let mut is_detached = false;
        let mut is_locked = false;
        let mut lock_reason = None;
        let mut is_prunable = false;

        for line in lines {
            if let Some(p) = line.strip_prefix("worktree ") {
                path = p.trim().to_string();
            } else if let Some(h) = line.strip_prefix("HEAD ") {
                head = Some(h.trim().to_string());
            } else if let Some(b) = line.strip_prefix("branch ") {
                let shorthand = b.trim().strip_prefix("refs/heads/").unwrap_or(b.trim());
                branch = Some(shorthand.to_string());
            } else if line == "detached" {
                is_detached = true;
            } else if let Some(r) = line.strip_prefix("locked") {
                is_locked = true;
                let reason = r.trim();
                if !reason.is_empty() {
                    lock_reason = Some(reason.to_string());
                }
            } else if line.starts_with("prunable") {
                is_prunable = true;
            }
        }

        if !path.is_empty() {
            worktrees.push(WorktreeItem {
                path,
                head,
                branch,
                is_detached,
                is_locked,
                lock_reason,
                is_prunable,
                is_main: idx == 0,
            });
        }
    }

    worktrees
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RemoteSyncStatus {
    pub current_branch: Option<String>,
    pub upstream_branch: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub has_upstream: bool,
}

pub fn get_remote_sync_status(repo: &Repository) -> Result<RemoteSyncStatus, String> {
    let head = match repo.head() {
        Ok(h) => h,
        Err(_) => {
            return Ok(RemoteSyncStatus {
                current_branch: None,
                upstream_branch: None,
                ahead: 0,
                behind: 0,
                has_upstream: false,
            })
        }
    };

    if !head.is_branch() {
        return Ok(RemoteSyncStatus {
            current_branch: head.shorthand().map(String::from),
            upstream_branch: None,
            ahead: 0,
            behind: 0,
            has_upstream: false,
        });
    }

    let branch_name = head.shorthand().unwrap_or("HEAD");
    let local_branch = repo
        .find_branch(branch_name, git2::BranchType::Local)
        .map_err(|e| format!("Branch '{branch_name}' not found: {e}"))?;

    let upstream = match local_branch.upstream() {
        Ok(u) => u,
        Err(_) => {
            return Ok(RemoteSyncStatus {
                current_branch: Some(branch_name.to_string()),
                upstream_branch: None,
                ahead: 0,
                behind: 0,
                has_upstream: false,
            });
        }
    };

    let upstream_name = upstream.name().ok().flatten().map(String::from);
    let local_oid = match head.target() {
        Some(oid) => oid,
        None => {
            return Ok(RemoteSyncStatus {
                current_branch: Some(branch_name.to_string()),
                upstream_branch: upstream_name,
                ahead: 0,
                behind: 0,
                has_upstream: true,
            })
        }
    };

    let upstream_oid = match upstream.get().target() {
        Some(oid) => oid,
        None => {
            return Ok(RemoteSyncStatus {
                current_branch: Some(branch_name.to_string()),
                upstream_branch: upstream_name,
                ahead: 0,
                behind: 0,
                has_upstream: true,
            })
        }
    };

    let (ahead, behind) = repo
        .graph_ahead_behind(local_oid, upstream_oid)
        .unwrap_or((0, 0));

    Ok(RemoteSyncStatus {
        current_branch: Some(branch_name.to_string()),
        upstream_branch: upstream_name,
        ahead,
        behind,
        has_upstream: true,
    })
}

/// Query all local and remote branches in the repository
pub fn get_repo_branches(repo: &Repository) -> Result<RepoBranches, String> {
    let head_shorthand = repo.head().ok().and_then(|h| h.shorthand().map(String::from));
    let mut local = Vec::new();
    let mut remote = Vec::new();

    let repo_is_dirty = {
        let mut opts = StatusOptions::new();
        opts.include_untracked(true)
            .recurse_untracked_dirs(false)
            .include_ignored(false);
        if let Ok(statuses) = repo.statuses(Some(&mut opts)) {
            !statuses.is_empty()
        } else {
            false
        }
    };

    let branches = repo
        .branches(None)
        .map_err(|e| format!("Failed to read branches: {e}"))?;

    for branch_res in branches {
        let (branch, branch_type) = branch_res.map_err(|e| format!("Failed to inspect branch: {e}"))?;
        let name = branch.name().unwrap_or(None).unwrap_or("").to_string();
        let shorthand = branch.get().shorthand().unwrap_or(&name).to_string();
        let is_remote = branch_type == git2::BranchType::Remote;
        let is_head = !is_remote && head_shorthand.as_deref() == Some(&shorthand);
        let target_commit = branch.get().target().map(|oid| oid.to_string());

        let (upstream, ahead, behind) = if !is_remote {
            if let Ok(upstream_branch) = branch.upstream() {
                let upstream_name = upstream_branch.get().shorthand().map(String::from);
                let (a, b) = match (branch.get().target(), upstream_branch.get().target()) {
                    (Some(local_oid), Some(upstream_oid)) => {
                        repo.graph_ahead_behind(local_oid, upstream_oid).unwrap_or((0, 0))
                    }
                    _ => (0, 0),
                };
                (upstream_name, a, b)
            } else {
                (None, 0, 0)
            }
        } else {
            (None, 0, 0)
        };

        let has_uncommitted = is_head && repo_is_dirty;

        let item = BranchItem {
            name,
            shorthand,
            is_head,
            is_remote,
            upstream,
            target_commit,
            ahead,
            behind,
            has_uncommitted,
        };

        if is_remote {
            remote.push(item);
        } else {
            local.push(item);
        }
    }

    local.sort_by(|a, b| a.shorthand.to_lowercase().cmp(&b.shorthand.to_lowercase()));
    remote.sort_by(|a, b| a.shorthand.to_lowercase().cmp(&b.shorthand.to_lowercase()));

    Ok(RepoBranches { local, remote })
}

/// Checkout a target branch (local or remote tracking branch)
pub fn checkout_branch(repo: &Repository, branch_name: &str) -> Result<(), String> {
    // 1. Check if it's already a local branch
    let local_refname = if branch_name.starts_with("refs/heads/") {
        branch_name.to_string()
    } else {
        format!("refs/heads/{}", branch_name)
    };

    if let Ok(reference) = repo.find_reference(&local_refname) {
        let obj = reference
            .peel(git2::ObjectType::Commit)
            .map_err(|e| format!("Failed to peel reference: {e}"))?;
        let mut checkout_builder = git2::build::CheckoutBuilder::new();
        checkout_builder.safe();
        repo.checkout_tree(&obj, Some(&mut checkout_builder))
            .map_err(|e| format!("Failed to checkout tree: {e}"))?;
        repo.set_head(reference.name().unwrap_or(&local_refname))
            .map_err(|e| format!("Failed to set HEAD: {e}"))?;
        return Ok(());
    }

    // 2. Check if it's a remote branch name, e.g. "origin/foo" or "refs/remotes/origin/foo"
    let remote_refname = if branch_name.starts_with("refs/remotes/") {
        branch_name.to_string()
    } else {
        format!("refs/remotes/{}", branch_name)
    };

    if let Ok(reference) = repo.find_reference(&remote_refname) {
        let commit = reference
            .peel_to_commit()
            .map_err(|e| format!("Failed to peel remote branch commit: {e}"))?;

        // Derive local branch name by stripping remote prefix e.g. "origin/"
        let local_name = branch_name
            .strip_prefix("refs/remotes/")
            .unwrap_or(branch_name);
        let local_name = match local_name.find('/') {
            Some(idx) => &local_name[idx + 1..],
            None => local_name,
        };

        // Create local branch pointing to this commit if it doesn't already exist
        let new_branch = repo
            .branch(local_name, &commit, false)
            .or_else(|_| repo.find_branch(local_name, git2::BranchType::Local))
            .map_err(|e| format!("Failed to create local tracking branch: {e}"))?;

        let obj = new_branch
            .get()
            .peel(git2::ObjectType::Commit)
            .map_err(|e| format!("Failed to peel commit: {e}"))?;
        let mut checkout_builder = git2::build::CheckoutBuilder::new();
        checkout_builder.safe();
        repo.checkout_tree(&obj, Some(&mut checkout_builder))
            .map_err(|e| format!("Failed to checkout tree: {e}"))?;
        repo.set_head(new_branch.get().name().unwrap_or(local_name))
            .map_err(|e| format!("Failed to set HEAD: {e}"))?;
        return Ok(());
    }

    Err(format!("Could not find branch '{branch_name}'"))
}

/// Create a new branch pointing to HEAD or a specified commit SHA
pub fn create_branch(
    repo: &Repository,
    branch_name: &str,
    target_commit: Option<&str>,
    checkout: bool,
) -> Result<(), String> {
    let commit = match target_commit {
        Some(sha) if !sha.trim().is_empty() => {
            let oid = git2::Oid::from_str(sha.trim())
                .map_err(|e| format!("Invalid commit SHA '{sha}': {e}"))?;
            repo.find_commit(oid)
                .map_err(|e| format!("Commit not found: {e}"))?
        }
        _ => {
            let head = repo.head().map_err(|e| format!("Repository HEAD not found: {e}"))?;
            head.peel_to_commit()
                .map_err(|e| format!("Failed to resolve HEAD commit: {e}"))?
        }
    };

    let _branch = repo
        .branch(branch_name, &commit, false)
        .map_err(|e| format!("Failed to create branch '{branch_name}': {e}"))?;

    if checkout {
        checkout_branch(repo, branch_name)?;
    }

    Ok(())
}

/// Delete a branch (local or remote reference)
pub fn delete_branch(
    repo: &Repository,
    branch_name: &str,
    is_remote: bool,
) -> Result<(), String> {
    if is_remote {
        let clean_name = branch_name.trim_start_matches("refs/remotes/");
        let mut branch = repo
            .find_branch(clean_name, git2::BranchType::Remote)
            .or_else(|_| repo.find_branch(branch_name, git2::BranchType::Remote))
            .map_err(|e| format!("Remote branch '{branch_name}' not found: {e}"))?;
        branch
            .delete()
            .map_err(|e| format!("Failed to delete remote branch '{branch_name}': {e}"))?;
    } else {
        if let Ok(head) = repo.head() {
            if let Some(shorthand) = head.shorthand() {
                if shorthand == branch_name {
                    return Err(format!(
                        "Cannot delete currently active branch '{branch_name}'. Please switch to another branch first."
                    ));
                }
            }
        }
        let mut branch = repo
            .find_branch(branch_name, git2::BranchType::Local)
            .map_err(|e| format!("Local branch '{branch_name}' not found: {e}"))?;
        branch
            .delete()
            .map_err(|e| format!("Failed to delete local branch '{branch_name}': {e}"))?;
    }
    Ok(())
}

/// Rename a local branch that has not yet been pushed to origin
pub fn rename_branch(
    repo: &Repository,
    old_name: &str,
    new_name: &str,
) -> Result<(), String> {
    let old_clean = old_name.trim().trim_start_matches("refs/heads/");
    let new_clean = new_name.trim().trim_start_matches("refs/heads/");

    if new_clean.is_empty() {
        return Err("Branch name cannot be empty".to_string());
    }

    if old_clean == new_clean {
        return Ok(());
    }

    // Git branch naming validation
    if new_clean.contains(' ')
        || new_clean.contains("..")
        || new_clean.contains('~')
        || new_clean.contains('^')
        || new_clean.contains(':')
        || new_clean.contains('?')
        || new_clean.contains('*')
        || new_clean.contains('[')
        || new_clean.contains('\\')
        || new_clean.starts_with('/')
        || new_clean.ends_with('/')
        || new_clean.ends_with(".lock")
        || new_clean.contains("@{")
    {
        return Err(format!("'{new_clean}' is not a valid git branch name"));
    }

    // 1. Locate the local branch
    let mut branch = repo
        .find_branch(old_clean, git2::BranchType::Local)
        .map_err(|e| format!("Local branch '{old_clean}' not found: {e}"))?;

    // 2. Verify it is not pushed to origin / remote
    if branch.upstream().is_ok() {
        return Err(format!(
            "Cannot rename branch '{old_clean}': it is already pushed and tracking a remote branch."
        ));
    }

    // Also verify no remote branch exists with this name (e.g. pushed without upstream tracking)
    if let Ok(branches) = repo.branches(Some(git2::BranchType::Remote)) {
        for branch_res in branches {
            if let Ok((remote_branch, _)) = branch_res {
                if let Some(shorthand) = remote_branch.get().shorthand() {
                    let remote_suffix = shorthand.split('/').skip(1).collect::<Vec<_>>().join("/");
                    if !remote_suffix.is_empty() && remote_suffix == old_clean {
                        return Err(format!(
                            "Cannot rename branch '{old_clean}': a corresponding remote branch '{shorthand}' already exists on origin."
                        ));
                    }
                }
            }
        }
    }

    // 3. Check if target branch name already exists locally
    if repo.find_branch(new_clean, git2::BranchType::Local).is_ok() {
        return Err(format!("A local branch named '{new_clean}' already exists."));
    }

    // 4. Perform rename (force = false)
    let is_head = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s == old_clean))
        .unwrap_or(false);

    branch
        .rename(new_clean, false)
        .map_err(|e| format!("Failed to rename branch '{old_clean}' to '{new_clean}': {e}"))?;

    // 5. Ensure HEAD is in sync if this was the checked-out branch
    if is_head {
        let _ = repo.set_head(&format!("refs/heads/{new_clean}"));
    }

    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashItem {
    pub index: usize,
    pub message: String,
    pub commit_id: String,
}

/// List all git stashes in the repository
pub fn list_stashes(repo: &mut Repository) -> Result<Vec<StashItem>, String> {
    let mut stashes = Vec::new();
    repo.stash_foreach(|index, message, oid| {
        stashes.push(StashItem {
            index,
            message: message.to_string(),
            commit_id: oid.to_string(),
        });
        true
    })
    .map_err(|e| format!("Failed to list stashes: {e}"))?;
    Ok(stashes)
}

/// Save working tree state into a git stash
pub fn create_stash(
    repo: &mut Repository,
    message: Option<&str>,
    include_untracked: bool,
) -> Result<(), String> {
    let sig = repo
        .signature()
        .or_else(|_| git2::Signature::now("GitShark User", "user@gitshark.dev"))
        .map_err(|e| format!("Failed to generate signature for stash: {e}"))?;

    let flags = if include_untracked {
        git2::StashFlags::INCLUDE_UNTRACKED
    } else {
        git2::StashFlags::DEFAULT
    };

    repo.stash_save2(&sig, message, Some(flags))
        .map_err(|e| {
            if e.code() == git2::ErrorCode::NotFound
                || e.message().to_lowercase().contains("nothing to stash")
            {
                "No local changes to stash.".to_string()
            } else {
                format!("Failed to save stash: {e}")
            }
        })?;
    Ok(())
}

/// Apply or pop a stash entry by index
pub fn apply_stash(repo: &mut Repository, index: usize, pop: bool) -> Result<(), String> {
    let mut options = git2::StashApplyOptions::new();
    if pop {
        repo.stash_pop(index, Some(&mut options))
            .map_err(|e| format!("Failed to pop stash #{index}: {e}"))?;
    } else {
        repo.stash_apply(index, Some(&mut options))
            .map_err(|e| format!("Failed to apply stash #{index}: {e}"))?;
    }
    Ok(())
}

/// Drop a stash entry by index
pub fn drop_stash(repo: &mut Repository, index: usize) -> Result<(), String> {
    repo.stash_drop(index)
        .map_err(|e| format!("Failed to drop stash #{index}: {e}"))?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashFileChange {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String, // "added", "deleted", "modified", "renamed", "untracked"
    pub additions: usize,
    pub deletions: usize,
    pub is_untracked: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StashDetails {
    pub index: usize,
    pub commit_id: String,
    pub message: String,
    pub timestamp: i64,
    pub files: Vec<StashFileChange>,
    pub total_additions: usize,
    pub total_deletions: usize,
}

/// Retrieve details and files changed in a specific stash entry
pub fn get_stash_details(repo: &mut Repository, stash_index: usize) -> Result<StashDetails, String> {
    let mut target_oid = None;
    let mut target_msg = String::new();

    repo.stash_foreach(|index, message, oid| {
        if index == stash_index {
            target_oid = Some(*oid);
            target_msg = message.to_string();
            return false;
        }
        true
    })
    .map_err(|e| format!("Failed to iterate stashes: {e}"))?;

    let oid = target_oid.ok_or_else(|| format!("Stash #{stash_index} not found"))?;
    let commit = repo.find_commit(oid).map_err(|e| format!("Stash commit not found: {e}"))?;

    let timestamp = commit.time().seconds();
    let commit_tree = commit.tree().map_err(|e| format!("Failed to get stash commit tree: {e}"))?;
    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .map_err(|e| format!("Failed to get parent commit: {e}"))?
                .tree()
                .map_err(|e| format!("Failed to get parent tree: {e}"))?,
        )
    } else {
        None
    };

    let mut diff_opts = git2::DiffOptions::new();
    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), Some(&mut diff_opts))
        .map_err(|e| format!("Failed to generate stash diff: {e}"))?;

    let mut files = Vec::new();

    for (idx, delta) in diff.deltas().enumerate() {
        let status = match delta.status() {
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "deleted",
            git2::Delta::Modified => "modified",
            git2::Delta::Renamed => "renamed",
            git2::Delta::Copied => "copied",
            git2::Delta::Untracked => "untracked",
            _ => "modified",
        }
        .to_string();

        let new_file = delta.new_file();
        let old_file = delta.old_file();

        let path = new_file
            .path()
            .or_else(|| old_file.path())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();

        let old_path = if delta.status() == git2::Delta::Renamed {
            old_file
                .path()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
        } else {
            None
        };

        let mut additions = 0;
        let mut deletions = 0;
        if let Ok(Some(patch)) = git2::Patch::from_diff(&diff, idx) {
            let (_, adds, dels) = patch.line_stats().unwrap_or((0, 0, 0));
            additions = adds;
            deletions = dels;
        }

        files.push(StashFileChange {
            path,
            old_path,
            status,
            additions,
            deletions,
            is_untracked: false,
        });
    }

    // Check for untracked files in parent(2) if stash was created with -u/include_untracked
    if commit.parent_count() >= 3 {
        if let Ok(untracked_commit) = commit.parent(2) {
            if let Ok(untracked_tree) = untracked_commit.tree() {
                let mut untracked_diff_opts = git2::DiffOptions::new();
                if let Ok(untracked_diff) = repo.diff_tree_to_tree(
                    None,
                    Some(&untracked_tree),
                    Some(&mut untracked_diff_opts),
                ) {
                    for (idx, delta) in untracked_diff.deltas().enumerate() {
                        let path = delta
                            .new_file()
                            .path()
                            .map(|p| p.to_string_lossy().replace('\\', "/"))
                            .unwrap_or_default();

                        let mut additions = 0;
                        if let Ok(Some(patch)) = git2::Patch::from_diff(&untracked_diff, idx) {
                            let (_, adds, _) = patch.line_stats().unwrap_or((0, 0, 0));
                            additions = adds;
                        }

                        files.push(StashFileChange {
                            path,
                            old_path: None,
                            status: "untracked".to_string(),
                            additions,
                            deletions: 0,
                            is_untracked: true,
                        });
                    }
                }
            }
        }
    }

    let total_additions = files.iter().map(|f| f.additions).sum();
    let total_deletions = files.iter().map(|f| f.deletions).sum();

    Ok(StashDetails {
        index: stash_index,
        commit_id: oid.to_string(),
        message: target_msg,
        timestamp,
        files,
        total_additions,
        total_deletions,
    })
}

/// Generate structured FileDiff for a specific file inside a git stash entry
pub fn get_stash_file_diff(
    repo: &mut Repository,
    stash_index: usize,
    target_path: &str,
) -> Result<FileDiff, String> {
    let mut target_oid = None;

    repo.stash_foreach(|index, _, oid| {
        if index == stash_index {
            target_oid = Some(*oid);
            return false;
        }
        true
    })
    .map_err(|e| format!("Failed to iterate stashes: {e}"))?;

    let oid = target_oid.ok_or_else(|| format!("Stash #{stash_index} not found"))?;
    let commit = repo.find_commit(oid).map_err(|e| format!("Stash commit not found: {e}"))?;

    let clean_path = target_path.replace('\\', "/");
    let clean_path = clean_path.trim_start_matches('/');

    // Check if target_path belongs to untracked files commit (parent 2)
    if commit.parent_count() >= 3 {
        if let Ok(untracked_commit) = commit.parent(2) {
            if let Ok(untracked_tree) = untracked_commit.tree() {
                if untracked_tree.get_path(std::path::Path::new(clean_path)).is_ok() {
                    let mut diff_opts = git2::DiffOptions::new();
                    diff_opts.pathspec(clean_path);
                    let diff = repo
                        .diff_tree_to_tree(None, Some(&untracked_tree), Some(&mut diff_opts))
                        .map_err(|e| format!("Failed to generate untracked stash diff: {e}"))?;
                    return parse_git2_diff(&diff, clean_path);
                }
            }
        }
    }

    // Default: diff commit tree against base parent(0)
    let commit_tree = commit.tree().map_err(|e| format!("Failed to get stash commit tree: {e}"))?;
    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .map_err(|e| format!("Failed to get parent commit: {e}"))?
                .tree()
                .map_err(|e| format!("Failed to get parent tree: {e}"))?,
        )
    } else {
        None
    };

    let mut diff_opts = git2::DiffOptions::new();
    diff_opts.pathspec(clean_path);

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), Some(&mut diff_opts))
        .map_err(|e| format!("Failed to generate stash diff: {e}"))?;

    parse_git2_diff(&diff, clean_path)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitFileChange {
    pub path: String,
    pub old_path: Option<String>,
    pub status: String, // "added", "deleted", "modified", "renamed"
    pub additions: usize,
    pub deletions: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommitDetails {
    pub hash: String,
    pub summary: String,
    pub body: Option<String>,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
    pub parent_hashes: Vec<String>,
    pub files: Vec<CommitFileChange>,
    pub total_additions: usize,
    pub total_deletions: usize,
}

/// Get commit metadata and list of changed files with additions/deletions stats
pub fn get_commit_details(repo: &Repository, commit_sha: &str) -> Result<CommitDetails, String> {
    let oid = git2::Oid::from_str(commit_sha.trim())
        .map_err(|e| format!("Invalid commit SHA '{commit_sha}': {e}"))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Commit not found: {e}"))?;

    let summary = commit.summary().unwrap_or("").to_string();
    let body = commit.body().map(|b| b.to_string());
    let author = commit.author();
    let author_name = author.name().unwrap_or("Unknown").to_string();
    let author_email = author.email().unwrap_or("").to_string();
    let timestamp = commit.time().seconds();

    let parent_hashes: Vec<String> = commit.parents().map(|p| p.id().to_string()).collect();

    let commit_tree = commit
        .tree()
        .map_err(|e| format!("Failed to get commit tree: {e}"))?;
    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .map_err(|e| format!("Failed to get parent commit: {e}"))?
                .tree()
                .map_err(|e| format!("Failed to get parent tree: {e}"))?,
        )
    } else {
        None
    };

    let mut diff_opts = git2::DiffOptions::new();
    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), Some(&mut diff_opts))
        .map_err(|e| format!("Failed to generate commit diff: {e}"))?;

    let stats = diff.stats().ok();
    let total_additions = stats.as_ref().map(|s| s.insertions()).unwrap_or(0);
    let total_deletions = stats.as_ref().map(|s| s.deletions()).unwrap_or(0);

    let mut files = Vec::new();

    for (idx, delta) in diff.deltas().enumerate() {
        let status = match delta.status() {
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "deleted",
            git2::Delta::Modified => "modified",
            git2::Delta::Renamed => "renamed",
            git2::Delta::Copied => "copied",
            git2::Delta::Untracked => "untracked",
            _ => "modified",
        }
        .to_string();

        let new_file = delta.new_file();
        let old_file = delta.old_file();

        let path = new_file
            .path()
            .or_else(|| old_file.path())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();

        let old_path = if delta.status() == git2::Delta::Renamed {
            old_file
                .path()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
        } else {
            None
        };

        let mut additions = 0;
        let mut deletions = 0;
        if let Ok(Some(patch)) = git2::Patch::from_diff(&diff, idx) {
            let (_, adds, dels) = patch.line_stats().unwrap_or((0, 0, 0));
            additions = adds;
            deletions = dels;
        }

        files.push(CommitFileChange {
            path,
            old_path,
            status,
            additions,
            deletions,
        });
    }

    Ok(CommitDetails {
        hash: commit_sha.to_string(),
        summary,
        body,
        author_name,
        author_email,
        timestamp,
        parent_hashes,
        files,
        total_additions,
        total_deletions,
    })
}

/// Generate structured FileDiff for a specific file inside a specific historical commit
pub fn get_commit_file_diff(
    repo: &Repository,
    commit_sha: &str,
    target_path: &str,
) -> Result<FileDiff, String> {
    let oid = git2::Oid::from_str(commit_sha.trim())
        .map_err(|e| format!("Invalid commit SHA '{commit_sha}': {e}"))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Commit not found: {e}"))?;

    let commit_tree = commit
        .tree()
        .map_err(|e| format!("Failed to get commit tree: {e}"))?;
    let parent_tree = if commit.parent_count() > 0 {
        Some(
            commit
                .parent(0)
                .map_err(|e| format!("Failed to get parent commit: {e}"))?
                .tree()
                .map_err(|e| format!("Failed to get parent tree: {e}"))?,
        )
    } else {
        None
    };

    let clean_path = target_path.replace('\\', "/");
    let clean_path = clean_path.trim_start_matches('/');

    let mut diff_opts = git2::DiffOptions::new();
    diff_opts.pathspec(clean_path);

    let diff = repo
        .diff_tree_to_tree(parent_tree.as_ref(), Some(&commit_tree), Some(&mut diff_opts))
        .map_err(|e| format!("Failed to generate commit diff: {e}"))?;

    parse_git2_diff(&diff, clean_path)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComparisonCommitItem {
    pub hash: String,
    pub summary: String,
    pub body: Option<String>,
    pub author_name: String,
    pub author_email: String,
    pub timestamp: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BranchComparisonDetails {
    pub base_ref: String,
    pub compare_ref: String,
    pub base_commit: String,
    pub compare_commit: String,
    pub merge_base_commit: String,
    pub ahead: usize,
    pub behind: usize,
    pub total_additions: usize,
    pub total_deletions: usize,
    pub files: Vec<CommitFileChange>,
    pub commits: Vec<ComparisonCommitItem>,
}

/// Helper to resolve a reference, branch shorthand, or commit hash to a git2::Commit
pub fn resolve_commit_ref<'a>(repo: &'a Repository, ref_str: &str) -> Result<git2::Commit<'a>, String> {
    let clean = ref_str.trim();
    if let Ok(obj) = repo.revparse_single(clean) {
        if let Ok(c) = obj.peel_to_commit() {
            return Ok(c);
        }
    }
    if let Ok(b) = repo.find_branch(clean, git2::BranchType::Local) {
        if let Ok(c) = b.get().peel_to_commit() {
            return Ok(c);
        }
    }
    if let Ok(b) = repo.find_branch(clean, git2::BranchType::Remote) {
        if let Ok(c) = b.get().peel_to_commit() {
            return Ok(c);
        }
    }
    let formats = [
        format!("refs/heads/{clean}"),
        format!("refs/remotes/{clean}"),
        format!("refs/remotes/origin/{clean}"),
        format!("refs/tags/{clean}"),
    ];
    for f in formats {
        if let Ok(obj) = repo.revparse_single(&f) {
            if let Ok(c) = obj.peel_to_commit() {
                return Ok(c);
            }
        }
    }
    Err(format!("Could not resolve reference '{ref_str}' to a valid commit"))
}

/// Compare two branches (e.g. main vs feature branch for PR View)
/// Computes merge base, ahead/behind commit counts, commit history in base..compare,
/// and changed files with diff additions/deletions.
/// If `include_uncommitted` is true and compare_ref is the active branch, factors in
/// current working tree modifications, staged files, and untracked changes.
pub fn get_branch_comparison(
    repo: &Repository,
    base_ref: &str,
    compare_ref: &str,
    include_uncommitted: bool,
) -> Result<BranchComparisonDetails, String> {
    let base_commit = resolve_commit_ref(repo, base_ref)?;
    let compare_commit = resolve_commit_ref(repo, compare_ref)?;

    let merge_base_oid = repo
        .merge_base(base_commit.id(), compare_commit.id())
        .unwrap_or_else(|_| base_commit.id());
    let merge_base_commit = repo
        .find_commit(merge_base_oid)
        .unwrap_or_else(|_| base_commit.clone());

    let (ahead, behind) = repo
        .graph_ahead_behind(compare_commit.id(), base_commit.id())
        .unwrap_or((0, 0));

    let is_current_branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s == compare_ref || compare_ref == "HEAD"))
        .unwrap_or(false);

    // Commits in base..compare
    let mut commits = Vec::new();

    if include_uncommitted && is_current_branch {
        let mut head_workdir_opts = git2::DiffOptions::new();
        head_workdir_opts.include_untracked(true);
        let compare_tree = compare_commit.tree().ok();
        let has_uncommitted = repo
            .diff_tree_to_workdir_with_index(compare_tree.as_ref(), Some(&mut head_workdir_opts))
            .map(|d| d.deltas().len() > 0)
            .unwrap_or(false);

        if has_uncommitted {
            let now = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_secs() as i64)
                .unwrap_or(0);

            commits.push(ComparisonCommitItem {
                hash: "uncommitted".to_string(),
                summary: "Uncommitted changes (working tree & index)".to_string(),
                body: Some("Local uncommitted modifications, staged files, and untracked changes".to_string()),
                author_name: "You".to_string(),
                author_email: "".to_string(),
                timestamp: now,
            });
        }
    }

    if let Ok(mut revwalk) = repo.revwalk() {
        revwalk.set_sorting(git2::Sort::TIME | git2::Sort::TOPOLOGICAL).ok();
        revwalk.push(compare_commit.id()).ok();
        revwalk.hide(base_commit.id()).ok();

        for oid_res in revwalk {
            if let Ok(oid) = oid_res {
                if let Ok(commit) = repo.find_commit(oid) {
                    commits.push(ComparisonCommitItem {
                        hash: oid.to_string(),
                        summary: commit.summary().unwrap_or("No commit message").to_string(),
                        body: commit.body().map(String::from),
                        author_name: commit.author().name().unwrap_or("Unknown").to_string(),
                        author_email: commit.author().email().unwrap_or("").to_string(),
                        timestamp: commit.time().seconds(),
                    });
                }
            }
        }
    }

    // Changed files between merge_base and compare (or workdir)
    let merge_base_tree = merge_base_commit
        .tree()
        .map_err(|e| format!("Failed to get merge base tree: {e}"))?;
    let compare_tree = compare_commit
        .tree()
        .map_err(|e| format!("Failed to get compare commit tree: {e}"))?;

    let diff = if include_uncommitted && is_current_branch {
        let mut diff_opts = git2::DiffOptions::new();
        diff_opts.include_untracked(true);
        diff_opts.recurse_untracked_dirs(true);
        diff_opts.show_untracked_content(true);
        repo.diff_tree_to_workdir_with_index(Some(&merge_base_tree), Some(&mut diff_opts))
            .map_err(|e| format!("Failed to generate branch comparison diff with working tree: {e}"))?
    } else {
        let mut diff_opts = git2::DiffOptions::new();
        repo.diff_tree_to_tree(
            Some(&merge_base_tree),
            Some(&compare_tree),
            Some(&mut diff_opts),
        )
        .map_err(|e| format!("Failed to generate branch comparison diff: {e}"))?
    };

    let stats = diff.stats().ok();
    let total_additions = stats.as_ref().map(|s| s.insertions()).unwrap_or(0);
    let total_deletions = stats.as_ref().map(|s| s.deletions()).unwrap_or(0);

    let mut files = Vec::new();
    for (idx, delta) in diff.deltas().enumerate() {
        let status = match delta.status() {
            git2::Delta::Added => "added",
            git2::Delta::Deleted => "deleted",
            git2::Delta::Modified => "modified",
            git2::Delta::Renamed => "renamed",
            git2::Delta::Copied => "copied",
            git2::Delta::Untracked => "untracked",
            _ => "modified",
        }
        .to_string();

        let new_file = delta.new_file();
        let old_file = delta.old_file();

        let path = new_file
            .path()
            .or_else(|| old_file.path())
            .map(|p| p.to_string_lossy().replace('\\', "/"))
            .unwrap_or_default();

        let old_path = if delta.status() == git2::Delta::Renamed {
            old_file
                .path()
                .map(|p| p.to_string_lossy().replace('\\', "/"))
        } else {
            None
        };

        let mut additions = 0;
        let mut deletions = 0;
        if let Ok(Some(patch)) = git2::Patch::from_diff(&diff, idx) {
            let (_, adds, dels) = patch.line_stats().unwrap_or((0, 0, 0));
            additions = adds;
            deletions = dels;
        }

        files.push(CommitFileChange {
            path,
            old_path,
            status,
            additions,
            deletions,
        });
    }

    Ok(BranchComparisonDetails {
        base_ref: base_ref.to_string(),
        compare_ref: compare_ref.to_string(),
        base_commit: base_commit.id().to_string(),
        compare_commit: compare_commit.id().to_string(),
        merge_base_commit: merge_base_commit.id().to_string(),
        ahead,
        behind,
        total_additions,
        total_deletions,
        files,
        commits,
    })
}

/// Generate structured FileDiff for a specific file between two branches (merge_base vs compare)
pub fn get_branch_comparison_file_diff(
    repo: &Repository,
    base_ref: &str,
    compare_ref: &str,
    target_path: &str,
    include_uncommitted: bool,
) -> Result<FileDiff, String> {
    let base_commit = resolve_commit_ref(repo, base_ref)?;
    let compare_commit = resolve_commit_ref(repo, compare_ref)?;

    let merge_base_oid = repo
        .merge_base(base_commit.id(), compare_commit.id())
        .unwrap_or_else(|_| base_commit.id());
    let merge_base_commit = repo
        .find_commit(merge_base_oid)
        .unwrap_or_else(|_| base_commit.clone());

    let merge_base_tree = merge_base_commit
        .tree()
        .map_err(|e| format!("Failed to get merge base tree: {e}"))?;
    let compare_tree = compare_commit
        .tree()
        .map_err(|e| format!("Failed to get compare commit tree: {e}"))?;

    let clean_path = target_path.replace('\\', "/");
    let clean_path = clean_path.trim_start_matches('/');

    let is_current_branch = repo
        .head()
        .ok()
        .and_then(|h| h.shorthand().map(|s| s == compare_ref || compare_ref == "HEAD"))
        .unwrap_or(false);

    let mut diff_opts = git2::DiffOptions::new();
    diff_opts.pathspec(clean_path);

    let diff = if include_uncommitted && is_current_branch {
        diff_opts.include_untracked(true);
        diff_opts.recurse_untracked_dirs(true);
        diff_opts.show_untracked_content(true);
        repo.diff_tree_to_workdir_with_index(Some(&merge_base_tree), Some(&mut diff_opts))
            .map_err(|e| format!("Failed to generate branch comparison file diff: {e}"))?
    } else {
        repo.diff_tree_to_tree(
            Some(&merge_base_tree),
            Some(&compare_tree),
            Some(&mut diff_opts),
        )
        .map_err(|e| format!("Failed to generate branch comparison file diff: {e}"))?
    };

    parse_git2_diff(&diff, clean_path)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitTagItem {
    pub name: String,
    pub target_commit: String,
    pub message: Option<String>,
    pub tagger: Option<String>,
    pub tagger_date: Option<i64>,
}

/// List all tags in the repository
pub fn list_tags(repo: &Repository) -> Result<Vec<GitTagItem>, String> {
    let mut tags = Vec::new();
    let tag_names = repo.tag_names(None).map_err(|e| format!("Failed to list tags: {e}"))?;

    for name in tag_names.iter().flatten() {
        let full_ref = format!("refs/tags/{name}");
        if let Ok(reference) = repo.find_reference(&full_ref) {
            let target_commit = match reference.peel_to_commit() {
                Ok(c) => c.id().to_string(),
                Err(_) => reference.target().map(|oid| oid.to_string()).unwrap_or_default(),
            };

            let mut message = None;
            let mut tagger = None;
            let mut tagger_date = None;

            if let Ok(tag_obj) = reference.peel(git2::ObjectType::Tag) {
                if let Ok(tag) = tag_obj.into_tag() {
                    message = tag.message().map(|m| m.trim().to_string());
                    if let Some(t) = tag.tagger() {
                        tagger = t.name().map(|n| n.to_string());
                        tagger_date = Some(t.when().seconds());
                    }
                }
            }

            tags.push(GitTagItem {
                name: name.to_string(),
                target_commit,
                message,
                tagger,
                tagger_date,
            });
        }
    }

    tags.sort_by(|a, b| b.name.cmp(&a.name));
    Ok(tags)
}

/// Create a lightweight or annotated tag on a specified commit or HEAD
pub fn create_tag(
    repo: &Repository,
    tag_name: &str,
    target_commit: Option<&str>,
    message: Option<&str>,
) -> Result<GitTagItem, String> {
    let clean_name = tag_name.trim();
    if clean_name.is_empty() {
        return Err("Tag name cannot be empty".to_string());
    }

    let target_obj = match target_commit {
        Some(sha) if !sha.trim().is_empty() => {
            let oid = git2::Oid::from_str(sha.trim())
                .map_err(|e| format!("Invalid target commit SHA '{sha}': {e}"))?;
            repo.find_object(oid, None)
                .map_err(|e| format!("Commit object not found: {e}"))?
        }
        _ => {
            let head = repo.head().map_err(|e| format!("HEAD not found: {e}"))?;
            head.peel(git2::ObjectType::Commit)
                .map_err(|e| format!("Failed to peel HEAD to commit: {e}"))?
        }
    };

    let target_oid_str = target_obj.id().to_string();

    let sig = repo
        .signature()
        .or_else(|_| git2::Signature::now("GitShark User", "user@gitshark.local"))
        .map_err(|e| format!("Failed to create signature for tag: {e}"))?;

    let tag_message = match message {
        Some(msg) if !msg.trim().is_empty() => msg.trim(),
        _ => clean_name,
    };

    repo.tag(clean_name, &target_obj, &sig, tag_message, false)
        .map_err(|e| format!("Failed to create annotated tag '{clean_name}': {e}"))?;

    Ok(GitTagItem {
        name: clean_name.to_string(),
        target_commit: target_oid_str,
        message: Some(tag_message.to_string()),
        tagger: sig.name().map(String::from),
        tagger_date: Some(sig.when().seconds()),
    })
}

/// Delete a tag from the local repository
pub fn delete_tag(repo: &Repository, tag_name: &str) -> Result<(), String> {
    let clean_name = tag_name.trim().trim_start_matches("refs/tags/");
    repo.tag_delete(clean_name)
        .map_err(|e| format!("Failed to delete tag '{clean_name}': {e}"))
}

/// Checkout a specific commit SHA in detached HEAD state
pub fn checkout_commit(repo: &Repository, commit_sha: &str) -> Result<(), String> {
    let oid = git2::Oid::from_str(commit_sha.trim())
        .map_err(|e| format!("Invalid commit SHA '{commit_sha}': {e}"))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Commit not found: {e}"))?;
    let obj = commit.into_object();

    let mut checkout_builder = git2::build::CheckoutBuilder::new();
    checkout_builder.safe();
    repo.checkout_tree(&obj, Some(&mut checkout_builder))
        .map_err(|e| format!("Failed to checkout commit tree: {e}"))?;
    repo.set_head_detached(oid)
        .map_err(|e| format!("Failed to set detached HEAD to {oid}: {e}"))?;

    Ok(())
}

/// Reset current HEAD / branch to a target commit SHA using soft, mixed, or hard mode
pub fn reset_to_commit(repo: &Repository, commit_sha: &str, mode: &str) -> Result<(), String> {
    let oid = git2::Oid::from_str(commit_sha.trim())
        .map_err(|e| format!("Invalid commit SHA '{commit_sha}': {e}"))?;
    let commit = repo
        .find_commit(oid)
        .map_err(|e| format!("Commit not found: {e}"))?;
    let obj = commit.into_object();

    let reset_type = match mode.trim().to_lowercase().as_str() {
        "soft" => git2::ResetType::Soft,
        "hard" => git2::ResetType::Hard,
        _ => git2::ResetType::Mixed,
    };

    repo.reset(&obj, reset_type, None)
        .map_err(|e| format!("Failed to reset ({mode}) to {oid}: {e}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs::File;
    use std::io::Write;

    #[test]
    fn test_detect_repo_hooks() {
        let test_dir = std::env::temp_dir().join(format!("gitshark_test_{}", uuid::Uuid::new_v4()));
        let repo = Repository::init(&test_dir).unwrap();

        let hooks_dir = test_dir.join(".git").join("hooks");
        let _ = fs::create_dir_all(&hooks_dir);

        let pre_commit_path = hooks_dir.join("pre-commit");
        let mut f = File::create(&pre_commit_path).unwrap();
        writeln!(f, "#!/bin/sh\nexit 0").unwrap();

        let sample_path = hooks_dir.join("pre-push.sample");
        let mut f_sample = File::create(&sample_path).unwrap();
        writeln!(f_sample, "#!/bin/sh\nexit 0").unwrap();

        let hooks_info = detect_repo_hooks(&repo).unwrap();
        assert!(hooks_info.has_pre_commit);
        assert!(!hooks_info.has_pre_push);
        assert_eq!(hooks_info.active_hooks.len(), 1);
        assert_eq!(hooks_info.active_hooks[0].name, "pre-commit");

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_parse_worktree_porcelain() {
        let sample = "worktree /path/to/main\nHEAD 1111111111111111111111111111111111111111\nbranch refs/heads/main\n\nworktree /path/to/feature\nHEAD 2222222222222222222222222222222222222222\nbranch refs/heads/feature-1\n\nworktree /path/to/detached\nHEAD 3333333333333333333333333333333333333333\ndetached\nlocked maintenance in progress\n";
        let parsed = parse_worktree_porcelain(sample);
        assert_eq!(parsed.len(), 3);
        assert!(parsed[0].is_main);
        assert_eq!(parsed[0].branch.as_deref(), Some("main"));
        assert!(!parsed[1].is_main);
        assert_eq!(parsed[1].branch.as_deref(), Some("feature-1"));
        assert!(parsed[2].is_detached);
        assert!(parsed[2].is_locked);
        assert_eq!(parsed[2].lock_reason.as_deref(), Some("maintenance in progress"));
    }

    #[test]
    fn test_get_file_diff_new_and_deleted() {
        let test_dir = std::env::temp_dir().join(format!("gitshark_diff_test_{}", uuid::Uuid::new_v4()));
        let repo = Repository::init(&test_dir).unwrap();

        // 1. Create untracked file
        let new_file_path = test_dir.join("hello.txt");
        let mut f = File::create(&new_file_path).unwrap();
        writeln!(f, "line 1\nline 2").unwrap();

        let diff_untracked = get_file_diff(&repo, "hello.txt", false).unwrap();
        println!("Untracked diff hunks: {}", diff_untracked.hunks.len());
        assert!(!diff_untracked.hunks.is_empty(), "Untracked file should have hunks");

        // 1b. Create untracked file in a subdirectory
        let sub_dir = test_dir.join("src").join("sub");
        fs::create_dir_all(&sub_dir).unwrap();
        let sub_file = sub_dir.join("nested.txt");
        let mut f2 = File::create(&sub_file).unwrap();
        writeln!(f2, "nested content").unwrap();

        let diff_nested = get_file_diff(&repo, "src/sub/nested.txt", false).unwrap();
        println!("Nested untracked diff hunks: {}", diff_nested.hunks.len());
        assert!(!diff_nested.hunks.is_empty(), "Nested untracked file should have hunks");

        // 2. Stage the file
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("hello.txt")).unwrap();
        index.write().unwrap();

        let diff_staged_new = get_file_diff(&repo, "hello.txt", true).unwrap();
        println!("Staged new diff hunks: {}", diff_staged_new.hunks.len());
        assert!(!diff_staged_new.hunks.is_empty(), "Staged new file should have hunks");

        // 3. Unstaged deleted file (in index, but deleted on disk)
        fs::remove_file(&new_file_path).unwrap();
        let diff_deleted = get_file_diff(&repo, "hello.txt", false).unwrap();
        println!("Unstaged deleted diff hunks: {}", diff_deleted.hunks.len());
        assert!(!diff_deleted.hunks.is_empty(), "Unstaged deleted file should have hunks");
        assert!(diff_deleted.is_deleted, "Should be marked deleted");
        assert_eq!(diff_deleted.hunks[0].lines[0].origin, '-');

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_create_and_delete_tag() {
        let test_dir = std::env::temp_dir().join(format!("gitshark_tag_test_{}", uuid::Uuid::new_v4()));
        let repo = Repository::init(&test_dir).unwrap();

        // 1. Create initial commit so HEAD exists
        let new_file_path = test_dir.join("release.txt");
        let mut f = File::create(&new_file_path).unwrap();
        writeln!(f, "initial release content").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("release.txt")).unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();

        let sig = git2::Signature::now("Tester", "tester@test.local").unwrap();
        let commit_oid = repo.commit(Some("HEAD"), &sig, &sig, "Initial release commit", &tree, &[]).unwrap();

        // 2. Create lightweight tag
        let tag_item = create_tag(&repo, "v0.1.0", Some(&commit_oid.to_string()), None).unwrap();
        assert_eq!(tag_item.name, "v0.1.0");
        assert_eq!(tag_item.target_commit, commit_oid.to_string());

        // 3. Create annotated tag
        let annotated_tag = create_tag(&repo, "v1.0.0", Some(&commit_oid.to_string()), Some("Production release v1.0.0")).unwrap();
        assert_eq!(annotated_tag.name, "v1.0.0");
        assert_eq!(annotated_tag.message.as_deref(), Some("Production release v1.0.0"));

        // 4. List tags
        let all_tags = list_tags(&repo).unwrap();
        assert_eq!(all_tags.len(), 2);
        assert!(all_tags.iter().any(|t| t.name == "v0.1.0"));
        assert!(all_tags.iter().any(|t| t.name == "v1.0.0"));

        // 5. Delete tag
        delete_tag(&repo, "v0.1.0").unwrap();
        let after_delete = list_tags(&repo).unwrap();
        assert_eq!(after_delete.len(), 1);
        assert_eq!(after_delete[0].name, "v1.0.0");

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_checkout_and_reset_commit() {
        let test_dir = std::env::temp_dir().join(format!("gitshark_commit_ops_{}", uuid::Uuid::new_v4()));
        let repo = Repository::init(&test_dir).unwrap();
        let sig = git2::Signature::now("Tester", "tester@test.local").unwrap();

        // Commit 1
        let file_path = test_dir.join("notes.txt");
        {
            let mut f = File::create(&file_path).unwrap();
            writeln!(f, "v1").unwrap();
        }
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("notes.txt")).unwrap();
        index.write().unwrap();
        let tree1 = repo.find_tree(index.write_tree().unwrap()).unwrap();
        let c1_oid = repo.commit(Some("HEAD"), &sig, &sig, "Commit 1", &tree1, &[]).unwrap();
        let c1 = repo.find_commit(c1_oid).unwrap();

        // Commit 2
        {
            let mut f = File::create(&file_path).unwrap();
            writeln!(f, "v2").unwrap();
        }
        let mut index2 = repo.index().unwrap();
        index2.add_path(std::path::Path::new("notes.txt")).unwrap();
        index2.write().unwrap();
        let tree2 = repo.find_tree(index2.write_tree().unwrap()).unwrap();
        let _c2_oid = repo.commit(Some("HEAD"), &sig, &sig, "Commit 2", &tree2, &[&c1]).unwrap();

        // Soft reset to Commit 1
        reset_to_commit(&repo, &c1_oid.to_string(), "soft").unwrap();
        let head_after_reset = repo.head().unwrap().peel_to_commit().unwrap();
        assert_eq!(head_after_reset.id(), c1_oid);

        // Detached checkout to Commit 1
        checkout_commit(&repo, &c1_oid.to_string()).unwrap();
        assert!(repo.head_detached().unwrap());

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_rename_branch() {
        let test_dir = std::env::temp_dir().join(format!("gitshark_rename_test_{}", uuid::Uuid::new_v4()));
        let repo = Repository::init(&test_dir).unwrap();

        // Create initial commit on main
        let file_path = test_dir.join("readme.md");
        let mut f = File::create(&file_path).unwrap();
        writeln!(f, "Initial").unwrap();

        let sig = git2::Signature::now("Shark", "shark@ocean.dev").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("readme.md")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let c1_oid = repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[]).unwrap();
        let c1 = repo.find_commit(c1_oid).unwrap();

        // Create a new local feature branch
        let branch = repo.branch("feature-calc", &c1, false).unwrap();
        drop(branch);

        // 1. Invalid branch name should fail
        let res_invalid = rename_branch(&repo, "feature-calc", "feature calc with spaces");
        assert!(res_invalid.is_err());

        // 2. Renaming to existing branch name should fail
        // If main or master is HEAD branch name:
        let head_shorthand = repo.head().unwrap().shorthand().unwrap().to_string();
        let res_existing = rename_branch(&repo, "feature-calc", &head_shorthand);
        assert!(res_existing.is_err());

        // 3. Valid rename succeeds
        let res_ok = rename_branch(&repo, "feature-calc", "feature-shark-calc");
        assert!(res_ok.is_ok(), "Rename should succeed: {:?}", res_ok);
        assert!(repo.find_branch("feature-calc", git2::BranchType::Local).is_err());
        assert!(repo.find_branch("feature-shark-calc", git2::BranchType::Local).is_ok());

        // 4. Renaming current HEAD branch updates HEAD
        checkout_branch(&repo, "feature-shark-calc").unwrap();
        assert_eq!(repo.head().unwrap().shorthand(), Some("feature-shark-calc"));
        let res_head_rename = rename_branch(&repo, "feature-shark-calc", "feature-awesome");
        assert!(res_head_rename.is_ok());
        assert_eq!(repo.head().unwrap().shorthand(), Some("feature-awesome"));

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_get_stash_details_and_diff() {
        let test_dir = std::env::temp_dir().join(format!("gitshark_stash_test_{}", uuid::Uuid::new_v4()));
        let mut repo = Repository::init(&test_dir).unwrap();

        // 1. Initial commit
        let file_path = test_dir.join("file1.txt");
        let mut f = File::create(&file_path).unwrap();
        writeln!(f, "Hello line 1").unwrap();

        let sig = git2::Signature::now("Shark", "shark@ocean.dev").unwrap();
        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("file1.txt")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let _ = repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[]).unwrap();
        drop(tree);
        drop(index);

        // 2. Modify tracked file and create untracked file
        let mut f = File::create(&file_path).unwrap();
        writeln!(f, "Hello line 1\nModified line 2").unwrap();

        let untracked_path = test_dir.join("untracked.txt");
        let mut uf = File::create(&untracked_path).unwrap();
        writeln!(uf, "Untracked content").unwrap();

        // 3. Create stash with untracked
        create_stash(&mut repo, Some("WIP stash testing"), true).unwrap();

        // 4. Inspect stash details
        let stashes = list_stashes(&mut repo).unwrap();
        assert_eq!(stashes.len(), 1);
        assert_eq!(stashes[0].index, 0);

        let details = get_stash_details(&mut repo, 0).unwrap();
        assert_eq!(details.index, 0);
        assert_eq!(details.files.len(), 2);

        let file1 = details.files.iter().find(|f| f.path == "file1.txt").unwrap();
        assert_eq!(file1.status, "modified");
        assert!(!file1.is_untracked);

        let file_untracked = details.files.iter().find(|f| f.path == "untracked.txt").unwrap();
        assert_eq!(file_untracked.status, "untracked");
        assert!(file_untracked.is_untracked);

        // 5. Inspect file diff
        let diff_file1 = get_stash_file_diff(&mut repo, 0, "file1.txt").unwrap();
        assert!(!diff_file1.hunks.is_empty());
        assert_eq!(diff_file1.new_path.as_deref(), Some("file1.txt"));

        let diff_untracked = get_stash_file_diff(&mut repo, 0, "untracked.txt").unwrap();
        assert!(!diff_untracked.hunks.is_empty());
        assert_eq!(diff_untracked.new_path.as_deref(), Some("untracked.txt"));

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_parse_conflict_blocks() {
        let sample = r#"function greet() {
<<<<<<< HEAD
    console.log("Hello from current HEAD");
=======
    console.log("Hello from incoming feature");
>>>>>>> feature-branch
}
"#;
        let blocks = parse_conflict_blocks(sample);
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].id, 0);
        assert_eq!(blocks[0].ours_header, "HEAD");
        assert_eq!(blocks[0].ours_content, "    console.log(\"Hello from current HEAD\");");
        assert_eq!(blocks[0].theirs_header, "feature-branch");
        assert_eq!(blocks[0].theirs_content, "    console.log(\"Hello from incoming feature\");");
        assert!(blocks[0].base_content.is_none());
    }

    #[test]
    fn test_parse_conflict_blocks_diff3() {
        let sample = r#"function calculate() {
<<<<<<< HEAD
    return 42;
||||||| merged common ancestors
    return 0;
=======
    return 100;
>>>>>>> incoming-fix
}
"#;
        let blocks = parse_conflict_blocks(sample);
        assert_eq!(blocks.len(), 1);
        assert_eq!(blocks[0].ours_content, "    return 42;");
        assert_eq!(blocks[0].base_content.as_deref(), Some("    return 0;"));
        assert_eq!(blocks[0].theirs_content, "    return 100;");
        assert_eq!(blocks[0].theirs_header, "incoming-fix");
    }

    #[test]
    fn test_conflicted_file_details_and_status() {
        let test_dir = std::env::temp_dir().join(format!("gitshark_conflict_test_{}", uuid::Uuid::new_v4()));
        let repo = Repository::init(&test_dir).unwrap();

        let conflict_path = test_dir.join("conflict.txt");
        let sample_content = "<<<<<<< HEAD\nleft change\n=======\nright change\n>>>>>>> feature\n";
        std::fs::write(&conflict_path, sample_content).unwrap();

        let details = get_conflicted_file_details(&repo, "conflict.txt").unwrap();
        assert_eq!(details.path, "conflict.txt");
        assert!(details.has_conflict_markers);
        assert_eq!(details.blocks.len(), 1);
        assert_eq!(details.blocks[0].ours_content, "left change");
        assert_eq!(details.blocks[0].theirs_content, "right change");

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_parse_file_history_output() {
        let sample = "abc123456789\0Alice Smith\0alice@example.com\01700000000\0feat: initial commit\n 1 file changed, 10 insertions(+), 2 deletions(-)\n";
        let history = parse_file_history_output(sample);
        assert_eq!(history.len(), 1);
        assert_eq!(history[0].commit_hash, "abc123456789");
        assert_eq!(history[0].author_name, "Alice Smith");
        assert_eq!(history[0].author_email, "alice@example.com");
        assert_eq!(history[0].timestamp, 1700000000);
        assert_eq!(history[0].summary, "feat: initial commit");
        assert_eq!(history[0].additions, 10);
        assert_eq!(history[0].deletions, 2);
    }

    #[test]
    fn test_get_file_blame() {
        let test_dir = std::env::temp_dir().join(format!("gitshark_blame_test_{}", uuid::Uuid::new_v4()));
        let repo = Repository::init(&test_dir).unwrap();

        let file_path = test_dir.join("code.rs");
        std::fs::write(&file_path, "fn main() {\n    println!(\"Hello!\");\n}\n").unwrap();

        // Commit file so blame has commit history
        let mut index = repo.index().unwrap();
        index.add_path(Path::new("code.rs")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = git2::Signature::now("Shark Dev", "dev@gitshark.com").unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Initial code commit", &tree, &[]).unwrap();

        let blame_data = get_file_blame(&repo, "code.rs").unwrap();
        assert_eq!(blame_data.path, "code.rs");
        assert!(!blame_data.is_binary);
        assert_eq!(blame_data.lines.len(), 3);
        assert!(!blame_data.hunks.is_empty());
        assert_eq!(blame_data.hunks[0].author_name, "Shark Dev");
        assert_eq!(blame_data.hunks[0].commit_summary, "Initial code commit");

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_stage_and_discard_selected_lines() {
        let test_dir = std::env::temp_dir().join(format!("gitshark_lines_test_{}", uuid::Uuid::new_v4()));
        let repo = Repository::init(&test_dir).unwrap();

        let file_path = test_dir.join("lines.txt");
        std::fs::write(&file_path, "line 1\nline 2\nline 3\n").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(Path::new("lines.txt")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let sig = git2::Signature::now("Shark Dev", "dev@gitshark.com").unwrap();
        repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[]).unwrap();

        // Now modify lines.txt: line 2 is replaced with line 2 mod A and line 2 mod B
        std::fs::write(&file_path, "line 1\nline 2 mod A\nline 2 mod B\nline 3\n").unwrap();

        // Get diff
        let diff_data = get_file_diff(&repo, "lines.txt", false).unwrap();
        assert_eq!(diff_data.hunks.len(), 1);
        let hunk = &diff_data.hunks[0];

        // Find index of "+line 2 mod A" and "-line 2"
        let del_idx = hunk.lines.iter().position(|l| l.origin == '-' && l.content == "line 2").unwrap();
        let add_a_idx = hunk.lines.iter().position(|l| l.origin == '+' && l.content == "line 2 mod A").unwrap();
        let _add_b_idx = hunk.lines.iter().position(|l| l.origin == '+' && l.content == "line 2 mod B").unwrap();

        // Stage ONLY "-line 2" and "+line 2 mod A", but NOT "+line 2 mod B"
        let patch = build_selected_lines_patch("lines.txt", hunk, &[del_idx, add_a_idx], false).unwrap();
        stage_hunk(&repo, &patch).unwrap();

        // Check index diff (HEAD vs Index): should have line 2 replaced with line 2 mod A
        let staged_diff = get_file_diff(&repo, "lines.txt", true).unwrap();
        assert_eq!(staged_diff.total_additions, 1);
        assert_eq!(staged_diff.total_deletions, 1);

        // Test unstaging: unstage the changes from index
        let staged_hunk = &staged_diff.hunks[0];
        let unstage_indices: Vec<usize> = (0..staged_hunk.lines.len()).collect();
        let unstage_patch_str = build_selected_lines_patch("lines.txt", staged_hunk, &unstage_indices, true).unwrap();
        unstage_patch(&repo, &unstage_patch_str).unwrap();

        let after_unstage = get_file_diff(&repo, "lines.txt", true).unwrap();
        assert_eq!(after_unstage.total_additions, 0);
        assert_eq!(after_unstage.total_deletions, 0);

        // Re-stage "-line 2" and "+line 2 mod A"
        let re_patch = build_selected_lines_patch("lines.txt", hunk, &[del_idx, add_a_idx], false).unwrap();
        stage_hunk(&repo, &re_patch).unwrap();

        // Check unstaged diff (Index vs Workdir): should have only "+line 2 mod B" remaining unstaged
        let unstaged_diff = get_file_diff(&repo, "lines.txt", false).unwrap();
        assert_eq!(unstaged_diff.total_additions, 1);
        assert_eq!(unstaged_diff.total_deletions, 0);

        // Now test discard on remaining unstaged line "+line 2 mod B"
        let remaining_hunk = &unstaged_diff.hunks[0];
        let remaining_b_idx = remaining_hunk.lines.iter().position(|l| l.origin == '+' && l.content == "line 2 mod B").unwrap();
        let discard_patch_str = build_selected_lines_patch("lines.txt", remaining_hunk, &[remaining_b_idx], true).unwrap();
        discard_patch(&repo, &discard_patch_str).unwrap();

        // Workdir should now match index perfectly (0 unstaged changes)
        let final_unstaged = get_file_diff(&repo, "lines.txt", false).unwrap();
        assert_eq!(final_unstaged.total_additions, 0);
        assert_eq!(final_unstaged.total_deletions, 0);

        let final_content = std::fs::read_to_string(&file_path).unwrap();
        assert_eq!(final_content.replace("\r\n", "\n"), "line 1\nline 2 mod A\nline 3\n");

        let _ = fs::remove_dir_all(&test_dir);
    }

    #[test]
    fn test_branch_comparison() {
        let test_dir = std::env::temp_dir().join(format!("gitshark_compare_test_{}", uuid::Uuid::new_v4()));
        let repo = Repository::init(&test_dir).unwrap();
        let sig = git2::Signature::now("Shark", "shark@ocean.dev").unwrap();

        // 1. Initial commit on main
        let file_path = test_dir.join("main.txt");
        let mut f = File::create(&file_path).unwrap();
        writeln!(f, "Initial base line").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("main.txt")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let init_commit = repo.commit(Some("HEAD"), &sig, &sig, "Initial commit", &tree, &[]).unwrap();
        let init_commit_obj = repo.find_commit(init_commit).unwrap();
        drop(tree);
        drop(index);

        let _ = repo.branch("main", &init_commit_obj, true);

        // 2. Create feature branch
        let feature_b = repo.branch("feature/pr-view", &init_commit_obj, false).unwrap();
        drop(feature_b);

        // 3. Add commit on feature branch
        let feat_file = test_dir.join("feature.txt");
        let mut ff = File::create(&feat_file).unwrap();
        writeln!(ff, "Feature content line 1\nFeature content line 2").unwrap();

        let mut index = repo.index().unwrap();
        index.add_path(std::path::Path::new("feature.txt")).unwrap();
        index.write().unwrap();
        let tree_id = index.write_tree().unwrap();
        let tree = repo.find_tree(tree_id).unwrap();
        let _feat_commit = repo.commit(
            Some("refs/heads/feature/pr-view"),
            &sig,
            &sig,
            "Add feature support",
            &tree,
            &[&init_commit_obj],
        ).unwrap();
        drop(tree);
        drop(index);

        // 4. Run get_branch_comparison (committed only)
        let comparison = get_branch_comparison(&repo, "main", "feature/pr-view", false).unwrap();
        assert_eq!(comparison.base_ref, "main");
        assert_eq!(comparison.compare_ref, "feature/pr-view");
        assert_eq!(comparison.ahead, 1);
        assert_eq!(comparison.behind, 0);
        assert_eq!(comparison.commits.len(), 1);
        assert_eq!(comparison.commits[0].summary, "Add feature support");
        assert_eq!(comparison.files.len(), 1);
        assert_eq!(comparison.files[0].path, "feature.txt");
        assert_eq!(comparison.files[0].status, "added");
        assert_eq!(comparison.total_additions, 2);
        assert_eq!(comparison.total_deletions, 0);

        // 5. Test get_branch_comparison_file_diff
        let file_diff = get_branch_comparison_file_diff(&repo, "main", "feature/pr-view", "feature.txt", false).unwrap();
        assert_eq!(file_diff.new_path.as_deref(), Some("feature.txt"));
        assert!(!file_diff.hunks.is_empty());

        // 6. Switch HEAD to feature branch and add uncommitted changes
        repo.set_head("refs/heads/feature/pr-view").unwrap();
        let mut checkout_builder = git2::build::CheckoutBuilder::new();
        checkout_builder.force();
        repo.checkout_head(Some(&mut checkout_builder)).unwrap();

        let uncommitted_file = test_dir.join("wip.txt");
        let mut uf = File::create(&uncommitted_file).unwrap();
        writeln!(uf, "WIP uncommitted line").unwrap();

        let comparison_with_uncommitted = get_branch_comparison(&repo, "main", "feature/pr-view", true).unwrap();
        assert_eq!(comparison_with_uncommitted.files.len(), 2);
        assert!(comparison_with_uncommitted.files.iter().any(|f| f.path == "wip.txt"));
        assert!(comparison_with_uncommitted.commits.iter().any(|c| c.hash == "uncommitted"));

        let uncommitted_diff = get_branch_comparison_file_diff(&repo, "main", "feature/pr-view", "wip.txt", true).unwrap();
        assert_eq!(uncommitted_diff.new_path.as_deref(), Some("wip.txt"));
        assert!(!uncommitted_diff.hunks.is_empty());

        let _ = fs::remove_dir_all(&test_dir);
    }
}



