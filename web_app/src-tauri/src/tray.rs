// Queen Mama LITE - System Tray
// Provides menu bar access to core functionality

use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    App, Emitter, Manager,
};

pub fn setup_tray(app: &App) -> Result<(), Box<dyn std::error::Error>> {
    let app_handle = app.app_handle().clone();
    let app_handle2 = app.app_handle().clone();
    let app_handle3 = app.app_handle().clone();
    let app_handle4 = app.app_handle().clone();
    let app_handle5 = app.app_handle().clone();

    // Create menu items
    let show_overlay = MenuItemBuilder::with_id("show_overlay", "Show Overlay")
        .accelerator("CmdOrCtrl+\\")
        .build(app)?;

    let hide_overlay = MenuItemBuilder::with_id("hide_overlay", "Hide Overlay")
        .build(app)?;

    let start_session = MenuItemBuilder::with_id("start_session", "Start Session")
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;

    let stop_session = MenuItemBuilder::with_id("stop_session", "Stop Session")
        .build(app)?;

    let open_dashboard = MenuItemBuilder::with_id("open_dashboard", "Open Dashboard")
        .build(app)?;

    let feedback = MenuItemBuilder::with_id("feedback", "Give Feedback")
        .build(app)?;

    let quit = MenuItemBuilder::with_id("quit", "Quit Queen Mama")
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;

    // Build menu
    let menu = MenuBuilder::new(app)
        .item(&show_overlay)
        .item(&hide_overlay)
        .separator()
        .item(&start_session)
        .item(&stop_session)
        .separator()
        .item(&open_dashboard)
        .item(&feedback)
        .separator()
        .item(&quit)
        .build()?;

    // Load tray icon (you'll need to add an actual icon file)
    let icon = Image::from_bytes(include_bytes!("../icons/icon.png"))
        .unwrap_or_else(|_| Image::from_bytes(&[0u8; 0]).unwrap());

    // Create tray icon
    TrayIconBuilder::new()
        .menu(&menu)
        .icon(icon)
        .tooltip("Queen Mama LITE")
        .on_menu_event(move |app, event| {
            match event.id().as_ref() {
                "show_overlay" => {
                    if let Some(overlay) = app.get_webview_window("overlay") {
                        let _ = overlay.show();
                        let _ = overlay.set_focus();
                    }
                }
                "hide_overlay" => {
                    if let Some(overlay) = app.get_webview_window("overlay") {
                        let _ = overlay.hide();
                    }
                }
                "start_session" => {
                    let _ = app_handle.emit("tray_action", "start_session");
                }
                "stop_session" => {
                    let _ = app_handle2.emit("tray_action", "stop_session");
                }
                "open_dashboard" => {
                    if let Some(main) = app.get_webview_window("main") {
                        let _ = main.show();
                        let _ = main.set_focus();
                    }
                }
                "feedback" => {
                    let _ = app_handle3.emit("tray_action", "feedback");
                    // Open feedback URL
                    let _ = open::that("https://queenmama.featurebase.app");
                }
                "quit" => {
                    app_handle4.exit(0);
                }
                _ => {}
            }
        })
        .on_tray_icon_event(move |tray, event| {
            use tauri::tray::TrayIconEvent;
            match event {
                TrayIconEvent::Click { button, .. } => {
                    if button == tauri::tray::MouseButton::Left {
                        // Show overlay on left click
                        if let Some(overlay) = app_handle5.get_webview_window("overlay") {
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
                _ => {}
            }
        })
        .build(app)?;

    println!("[Tray] System tray initialized");
    Ok(())
}
