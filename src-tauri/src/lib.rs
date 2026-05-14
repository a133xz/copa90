use std::fs;
use std::process::{Command, Stdio};
use std::io::{BufRead, BufReader};
use tauri::{AppHandle, Emitter};

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

#[tauri::command]
fn get_volumes() -> Vec<String> {
    let mut volumes = Vec::new();
    if let Ok(entries) = fs::read_dir("/Volumes") {
        for entry in entries.flatten() {
            if entry.file_type().map(|t| t.is_dir()).unwrap_or(false) {
                if let Some(name) = entry.file_name().to_str() {
                    // Filter out some obvious system/hidden stuff if necessary
                    if !name.starts_with('.') && name != "Macintosh HD" {
                        volumes.push(name.to_string());
                    }
                }
            }
        }
    }
    volumes.sort();
    volumes
}

#[tauri::command]
fn get_next_roll(dest_drive: String, cam_letter: String) -> i32 {
    let mut max_roll = 0;
    let cam_prefix = cam_letter.to_uppercase();
    let cam_folder = format!("{}_CAM", cam_prefix);

    let dest_path = format!("/Volumes/{}", dest_drive);
    
    if let Ok(day_entries) = fs::read_dir(&dest_path) {
        for day_entry in day_entries.flatten() {
            let day_name = day_entry.file_name().to_string_lossy().into_owned();
            if day_name.starts_with("Day_") {
                let cam_path = day_entry.path().join(&cam_folder);
                if let Ok(roll_entries) = fs::read_dir(cam_path) {
                    for roll_entry in roll_entries.flatten() {
                        let roll_name = roll_entry.file_name().to_string_lossy().into_owned();
                        // Format: A001 (prefix + 3 digits)
                        if roll_name.starts_with(&cam_prefix) && roll_name.len() == (cam_prefix.len() + 3) {
                            let suffix = &roll_name[cam_prefix.len()..];
                            if let Ok(n) = suffix.parse::<i32>() {
                                if n > max_roll {
                                    max_roll = n;
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    max_roll + 1
}

#[tauri::command]
async fn start_rsync(
    app: AppHandle,
    source: String,
    destination: String,
    delete: bool,
) -> Result<(), String> {
    let mut args = vec![
        "-avh".to_string(), 
        "--progress".to_string(), 
        "--modify-window=1".to_string(),
        "--exclude=.Trashes".to_string(),
        "--exclude=.Spotlight-V100".to_string(),
        "--exclude=.fseventsd".to_string(),
        "--exclude=.DS_Store".to_string(),
        "--exclude=._*".to_string(),
    ];
    
    if delete {
        args.push("--delete".to_string());
    }

    // Ensure source ends with / for rsync to copy contents if it's an ingest
    // But for backup, the script uses "/Volumes/HD-00251/" so it's consistent.
    let src = if source.ends_with('/') { source } else { format!("{}/", source) };
    let dest = destination;

    args.push(src);
    args.push(dest);

    println!("Running rsync with args: {:?}", args);

    let mut child = Command::new("rsync")
        .args(args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    let stdout = child.stdout.take().unwrap();
    let reader = BufReader::new(stdout);

    // Run in a separate thread to not block the async task if needed, 
    // but since this is an async command, we can just await the loop?
    // Actually, to emit events while running, we should use a thread or just loop.
    for line in reader.lines() {
        if let Ok(l) = line {
            let _ = app.emit("rsync-output", l);
        }
    }

    let status = child.wait().map_err(|e| e.to_string())?;
    if status.success() {
        let _ = app.emit("rsync-finished", true);
        Ok(())
    } else {
        let _ = app.emit("rsync-finished", false);
        Err("rsync failed".to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_volumes, 
            get_next_roll, 
            start_rsync
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
