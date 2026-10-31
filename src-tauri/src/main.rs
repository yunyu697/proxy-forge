// Prevents an additional console window on Windows in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::{TcpStream, ToSocketAddrs};
use std::time::Duration;

/// 对节点做 TCP 握手测速，返回毫秒数；失败返回错误描述。
#[tauri::command]
fn tcp_ping(host: String, port: u16, timeout_ms: u64) -> Result<u64, String> {
    let addrs: Vec<std::net::SocketAddr> = (host.as_str(), port)
        .to_socket_addrs()
        .map_err(|e| format!("DNS 解析失败: {e}"))?
        .collect();
    if addrs.is_empty() {
        return Err("DNS 解析无结果".into());
    }
    let start = std::time::Instant::now();
    match TcpStream::connect_timeout(&addrs[0], Duration::from_millis(timeout_ms)) {
        Ok(_) => Ok(start.elapsed().as_millis() as u64),
        Err(e) => Err(format!("{e}")),
    }
}

/// 弹出系统保存对话框，把文本写入用户选择的位置；取消返回 None。
#[tauri::command]
fn save_text_file(
    app: tauri::AppHandle,
    file_name: String,
    content: String,
) -> Result<Option<String>, String> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = std::sync::mpsc::channel();
    app.dialog()
        .file()
        .set_file_name(&file_name)
        .save_file(move |path| {
            let _ = tx.send(path);
        });
    let picked = rx.recv().map_err(|e| e.to_string())?;
    let Some(path) = picked else {
        return Ok(None);
    };
    let path = path.as_path().ok_or("路径无效")?;
    std::fs::write(path, content).map_err(|e| e.to_string())?;
    Ok(Some(path.to_string_lossy().to_string()))
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![tcp_ping, save_text_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
