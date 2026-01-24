// Queen Mama LITE - Tauri Library
// Cross-platform AI coaching assistant

mod shortcuts;
mod tray;
mod window;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--hidden"]),
        ))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Setup system tray
            tray::setup_tray(app)?;

            // Setup global shortcuts
            shortcuts::setup_shortcuts(app)?;

            // Setup window management
            window::setup_windows(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            window::toggle_overlay,
            window::set_overlay_expanded,
            window::move_overlay,
            window::show_main_window,
            shortcuts::get_shortcuts,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
