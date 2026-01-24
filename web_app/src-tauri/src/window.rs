// Queen Mama LITE - Window Management
// Handles multi-window setup and overlay behavior

use tauri::{App, Emitter, Manager, PhysicalPosition, PhysicalSize};

/// Overlay dimensions
const OVERLAY_COLLAPSED_WIDTH: u32 = 420;
const OVERLAY_COLLAPSED_HEIGHT: u32 = 100;
const OVERLAY_EXPANDED_WIDTH: u32 = 420;
const OVERLAY_EXPANDED_HEIGHT: u32 = 400;

pub fn setup_windows(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    // Get overlay window
    if let Some(overlay) = app.get_webview_window("overlay") {
        // Set initial size
        let _ = overlay.set_size(PhysicalSize::new(OVERLAY_COLLAPSED_WIDTH, OVERLAY_COLLAPSED_HEIGHT));

        // Position in top-right corner with some padding
        if let Ok(monitor) = overlay.current_monitor() {
            if let Some(monitor) = monitor {
                let screen_size = monitor.size();
                let x = screen_size.width as i32 - OVERLAY_COLLAPSED_WIDTH as i32 - 20;
                let y = 100; // Top padding
                let _ = overlay.set_position(PhysicalPosition::new(x, y));
            }
        }

        // Keep always on top
        let _ = overlay.set_always_on_top(true);
    }

    println!("[Window] Windows setup complete");
    Ok(())
}

/// Toggle overlay visibility
#[tauri::command]
pub async fn toggle_overlay(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let is_visible = overlay.is_visible().map_err(|e| e.to_string())?;

        if is_visible {
            overlay.hide().map_err(|e| e.to_string())?;
        } else {
            overlay.show().map_err(|e| e.to_string())?;
            overlay.set_focus().map_err(|e| e.to_string())?;
        }

        Ok(!is_visible)
    } else {
        Err("Overlay window not found".to_string())
    }
}

/// Set overlay expanded state
#[tauri::command]
pub async fn set_overlay_expanded(app: tauri::AppHandle, expanded: bool) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let (width, height) = if expanded {
            (OVERLAY_EXPANDED_WIDTH, OVERLAY_EXPANDED_HEIGHT)
        } else {
            (OVERLAY_COLLAPSED_WIDTH, OVERLAY_COLLAPSED_HEIGHT)
        };

        overlay
            .set_size(PhysicalSize::new(width, height))
            .map_err(|e| e.to_string())?;

        // Emit event to frontend
        app.emit("overlay_expanded_changed", expanded)
            .map_err(|e| e.to_string())?;

        Ok(())
    } else {
        Err("Overlay window not found".to_string())
    }
}

/// Move overlay to a specific position
#[tauri::command]
pub async fn move_overlay(app: tauri::AppHandle, position: OverlayPosition) -> Result<(), String> {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let monitor = overlay.current_monitor()
            .map_err(|e| e.to_string())?
            .ok_or("No monitor found")?;

        let screen_size = monitor.size();
        let window_size = overlay.outer_size().map_err(|e| e.to_string())?;

        let padding = 20;

        let (x, y) = match position {
            OverlayPosition::TopLeft => (padding, padding + 60), // Account for menu bar
            OverlayPosition::TopCenter => {
                ((screen_size.width as i32 - window_size.width as i32) / 2, padding + 60)
            }
            OverlayPosition::TopRight => {
                (screen_size.width as i32 - window_size.width as i32 - padding, padding + 60)
            }
            OverlayPosition::BottomLeft => {
                (padding, screen_size.height as i32 - window_size.height as i32 - padding)
            }
            OverlayPosition::BottomCenter => {
                (
                    (screen_size.width as i32 - window_size.width as i32) / 2,
                    screen_size.height as i32 - window_size.height as i32 - padding,
                )
            }
            OverlayPosition::BottomRight => {
                (
                    screen_size.width as i32 - window_size.width as i32 - padding,
                    screen_size.height as i32 - window_size.height as i32 - padding,
                )
            }
        };

        overlay
            .set_position(PhysicalPosition::new(x, y))
            .map_err(|e| e.to_string())?;

        Ok(())
    } else {
        Err("Overlay window not found".to_string())
    }
}

/// Show main dashboard window
#[tauri::command]
pub async fn show_main_window(app: tauri::AppHandle) -> Result<(), String> {
    if let Some(main) = app.get_webview_window("main") {
        main.show().map_err(|e| e.to_string())?;
        main.set_focus().map_err(|e| e.to_string())?;
        Ok(())
    } else {
        Err("Main window not found".to_string())
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum OverlayPosition {
    TopLeft,
    TopCenter,
    TopRight,
    BottomLeft,
    BottomCenter,
    BottomRight,
}
