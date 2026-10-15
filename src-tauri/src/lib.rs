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
            commands::discard_file_changes,
            commands::get_file_diff,
            commands::execute_git_commit,
            commands::execute_git_push,
            commands::execute_git_pull,
            commands::execute_git_fetch,
            commands::cancel_active_process,
            commands::get_repo_hooks,
            commands::list_worktrees,
            commands::add_worktree,
            commands::remove_worktree,
            commands::get_remote_sync_status,
            commands::start_clone_repository,
            commands::cancel_clone,
            commands::get_repo_branches,
            commands::checkout_branch,
            commands::create_branch,
            commands::delete_branch,
            commands::list_stashes,
            commands::create_stash,
            commands::apply_stash,
            commands::drop_stash,
            commands::get_commit_details,
            commands::get_commit_file_diff,
            commands::list_tags,
            commands::create_tag,
            commands::delete_tag,
            commands::push_tag,
            commands::get_git_binary_info,
            commands::validate_git_path,
            commands::set_custom_git_path,
        ])
        .run(tauri::generate_context!())
        .expect("error while running gitshark desktop application");
}
