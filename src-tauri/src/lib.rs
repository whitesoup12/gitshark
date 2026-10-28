pub mod commands;
pub mod git;
pub mod pty;
pub mod state;
pub mod watcher;

use state::create_app_state;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .manage(create_app_state())
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                if let Ok(Some(monitor)) = window.current_monitor() {
                    let scale = monitor.scale_factor();
                    let screen_width = monitor.size().width as f64 / scale;
                    let screen_height = monitor.size().height as f64 / scale;

                    // Desired default dimensions: 1600x1000, but clamped to 90% of screen size if smaller
                    let target_width = 1600.0_f64.min(screen_width * 0.92).max(960.0);
                    let target_height = 1000.0_f64.min(screen_height * 0.90).max(600.0);

                    let _ = window.set_size(tauri::Size::Logical(tauri::LogicalSize {
                        width: target_width,
                        height: target_height,
                    }));
                    let _ = window.center();
                }

                let _ = window.show();
                let _ = window.set_focus();
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::open_repository,
            commands::close_repository,
            commands::get_repository_metadata,
            commands::execute_pty_command,
            commands::write_pty_input,
            commands::resize_pty,
            commands::kill_pty,
            commands::get_commit_graph,
            commands::get_working_tree_status,
            commands::stage_file,
            commands::unstage_file,
            commands::stage_all_files,
            commands::unstage_all_files,
            commands::stage_hunk,
            commands::unstage_hunk,
            commands::discard_hunk,
            commands::stage_selected_lines,
            commands::unstage_selected_lines,
            commands::discard_selected_lines,
            commands::discard_file_changes,
            commands::discard_all_unstaged_changes,
            commands::get_file_diff,
            commands::get_conflicted_file_details,
            commands::resolve_conflict_choice,
            commands::save_and_stage_resolved_file,
            commands::abort_repo_operation,
            commands::continue_repo_operation,
            commands::get_file_blame,
            commands::get_file_history,
            commands::execute_git_commit,
            commands::execute_git_push,
            commands::execute_git_pull,
            commands::execute_git_fetch,
            commands::background_fetch_repository,
            commands::execute_git_merge,
            commands::cancel_active_process,
            commands::get_repo_hooks,
            commands::execute_hook_dry_run,
            commands::list_worktrees,
            commands::add_worktree,
            commands::remove_worktree,
            commands::prune_worktrees,
            commands::get_remote_sync_status,
            commands::start_clone_repository,
            commands::cancel_clone,
            commands::get_repo_branches,
            commands::checkout_branch,
            commands::create_branch,
            commands::delete_branch,
            commands::rename_branch,
            commands::list_stashes,
            commands::create_stash,
            commands::apply_stash,
            commands::drop_stash,
            commands::get_stash_details,
            commands::get_stash_file_diff,
            commands::get_commit_details,
            commands::get_commit_file_diff,
            commands::get_branch_comparison,
            commands::get_branch_comparison_file_diff,
            commands::list_tags,
            commands::create_tag,
            commands::delete_tag,
            commands::push_tag,
            commands::push_all_tags,
            commands::get_git_binary_info,
            commands::validate_git_path,
            commands::set_custom_git_path,
            commands::set_diff_debounce_delay,
            commands::get_diff_debounce_delay,
            commands::get_repository_remote_url,
            commands::open_in_browser,
            commands::execute_git_cherry_pick,
            commands::execute_git_revert,
            commands::checkout_commit,
            commands::reset_to_commit,
            commands::get_shark_stats,
            commands::save_shark_stats,
            commands::get_saved_open_repos,
            commands::save_open_repos,
            commands::get_git_auth_token,
            commands::list_dev_folders,
            commands::launch_or_focus_codeshark,
            commands::get_path_info,
            commands::read_dir_entries,
            commands::read_text_file,
            commands::write_text_file,
            commands::get_repo_git_status,
            commands::get_file_git_head_content,
        ])
        .run(tauri::generate_context!())
        .expect("error while running gitshark desktop application");
}
