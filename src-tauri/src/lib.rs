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

/// 用系统默认浏览器打开链接（桌面与移动端通用）。
///
/// 只放行 http/https：这个命令由前端传入任意字符串，必须挡住 `file://`、`javascript:`
/// 之类的协议，避免被当成打开本地文件或执行脚本的入口。
#[tauri::command]
fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    let target = url.trim();
    if !(target.starts_with("https://") || target.starts_with("http://")) {
        return Err("只允许打开 http/https 链接".into());
    }
    app.opener()
        .open_url(target.to_string(), None::<&str>)
        .map_err(|e| e.to_string())
}

/// 桌面端与移动端共用的启动入口。
///
/// Android / iOS 上 Tauri 以动态库形式加载应用，`tauri android build` 会执行
/// `cargo build --lib`，因此业务逻辑必须放在 lib 目标里（crate-type 含 cdylib）。
/// `mobile_entry_point` 宏只在移动端编译时生成 `Java_..._run` 之类的导出符号。
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![tcp_ping, save_text_file, open_url])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
