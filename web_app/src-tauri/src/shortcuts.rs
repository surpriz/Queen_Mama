// Queen Mama LITE - Global Keyboard Shortcuts
// Handles system-wide hotkeys for controlling the application

use tauri::{App, Emitter, Manager};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutState};

/// Shortcut definitions matching macOS app behavior
/// - Cmd/Ctrl + \: Toggle overlay visibility
/// - Cmd/Ctrl + Enter: Trigger AI assist
/// - Cmd/Ctrl + Shift + S: Start/Stop session
/// - Cmd/Ctrl + R: Clear context
pub fn setup_shortcuts(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.app_handle().clone();

    // Define shortcuts
    let toggle_overlay = Shortcut::new(Some(Modifiers::META), Code::Backslash);
    let trigger_assist = Shortcut::new(Some(Modifiers::META), Code::Enter);
    let toggle_session = Shortcut::new(Some(Modifiers::META | Modifiers::SHIFT), Code::KeyS);
    let clear_context = Shortcut::new(Some(Modifiers::META), Code::KeyR);

    // Register all shortcuts
    app.global_shortcut().on_shortcuts(
        [toggle_overlay, trigger_assist, toggle_session, clear_context],
        move |_app, shortcut, event| {
            if event.state() == ShortcutState::Pressed {
                let action = match shortcut.id() {
                    id if id == toggle_overlay.id() => "toggle_overlay",
                    id if id == trigger_assist.id() => "trigger_assist",
                    id if id == toggle_session.id() => "toggle_session",
                    id if id == clear_context.id() => "clear_context",
                    _ => return,
                };

                // Emit event to frontend
                if let Err(e) = app_handle.emit("shortcut", action) {
                    eprintln!("[Shortcuts] Failed to emit event: {}", e);
                }

                // Handle toggle_overlay directly in Rust
                if action == "toggle_overlay" {
                    if let Some(overlay) = app_handle.get_webview_window("overlay") {
                        let is_visible = overlay.is_visible().unwrap_or(false);
                        if is_visible {
                            let _ = overlay.hide();
                        } else {
                            let _ = overlay.show();
                            let _ = overlay.set_focus();
                        }
                    }
                }
            }
        },
    )?;

    println!("[Shortcuts] Global shortcuts registered successfully");
    Ok(())
}

/// Get current shortcut configuration
#[tauri::command]
pub fn get_shortcuts() -> Vec<ShortcutInfo> {
    vec![
        ShortcutInfo {
            id: "toggle_overlay".to_string(),
            keys: if cfg!(target_os = "macos") { "⌘\\" } else { "Ctrl+\\" }.to_string(),
            description: "Toggle overlay visibility".to_string(),
        },
        ShortcutInfo {
            id: "trigger_assist".to_string(),
            keys: if cfg!(target_os = "macos") { "⌘↩" } else { "Ctrl+Enter" }.to_string(),
            description: "Trigger AI assist".to_string(),
        },
        ShortcutInfo {
            id: "toggle_session".to_string(),
            keys: if cfg!(target_os = "macos") { "⌘⇧S" } else { "Ctrl+Shift+S" }.to_string(),
            description: "Start/Stop session".to_string(),
        },
        ShortcutInfo {
            id: "clear_context".to_string(),
            keys: if cfg!(target_os = "macos") { "⌘R" } else { "Ctrl+R" }.to_string(),
            description: "Clear context".to_string(),
        },
    ]
}

#[derive(serde::Serialize)]
pub struct ShortcutInfo {
    id: String,
    keys: String,
    description: String,
}
