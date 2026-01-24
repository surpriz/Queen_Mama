// Queen Mama LITE - Tauri Application Entry Point
// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    queen_mama_lite_lib::run()
}
