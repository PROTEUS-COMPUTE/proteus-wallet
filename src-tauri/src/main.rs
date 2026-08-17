// windows_subsystem = "windows": no console window flashing behind the app.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs;

/// Write an account backup where the OS save dialog said to.
///
/// This exists so the filesystem permission can stay locked to the app data
/// directory. The backup goes wherever the user pointed the dialog, which is by
/// definition outside any scope we can declare in advance, so it goes through
/// here instead of widening `fs` to the whole disk.
///
/// What travels through is the ENCRYPTED keystore, the same bytes already on
/// disk. No password and no seed ever reach this process.
#[tauri::command]
fn write_backup(path: String, contents: String) -> Result<(), String> {
    fs::write(&path, contents).map_err(|e| format!("could not write {path}: {e}"))
}

// Beyond that command there is nothing here on purpose. Keys are generated,
// encrypted and signed with inside the webview by @polkadot/keyring; this
// process only opens a window and lends the frontend what it cannot do alone:
// a file to keep accounts in, a save dialog, the clipboard, and the updater.
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![write_backup])
        .run(tauri::generate_context!())
        .expect("error while running the proteus wallet");
}
