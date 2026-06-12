use tauri::{AppHandle, Manager, Emitter, PhysicalPosition, PhysicalSize, Size, Position, State};
use tauri::tray::TrayIconBuilder;
use tauri::menu::{Menu, MenuItem};
use device_query::{DeviceQuery, DeviceState};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use std::path::PathBuf;

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MousePayload {
    x: i32,
    y: i32,
    work_area: Rect,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Rect {
    x: i32,
    y: i32,
    width: i32,
    height: i32,
}

#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PetConfig {
    pet_scale: f64,
    follow_enabled: bool,
    follow_mode: String,
    speed_scale: f64,
    always_on_top: bool,
    click_through: bool,
    skin_id: String,
    last_position: Point,
}

#[derive(Clone, Serialize, Deserialize)]
struct Point {
    x: f64,
    y: f64,
}

impl Default for PetConfig {
    fn default() -> Self {
        Self {
            pet_scale: 1.0,
            follow_enabled: true,
            follow_mode: "chase".to_string(),
            speed_scale: 1.0,
            always_on_top: true,
            click_through: false,
            skin_id: "default".to_string(),
            last_position: Point { x: 640.0, y: 420.0 },
        }
    }
}

struct AppState {
    config: Mutex<PetConfig>,
    config_path: PathBuf,
}

impl AppState {
    fn load(app: &AppHandle) -> Self {
        let mut path = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
        std::fs::create_dir_all(&path).unwrap_or(());
        path.push("config.json");
        
        let config = if let Ok(data) = std::fs::read_to_string(&path) {
            serde_json::from_str(&data).unwrap_or_default()
        } else {
            PetConfig::default()
        };
        
        Self {
            config: Mutex::new(config),
            config_path: path,
        }
    }

    fn save(&self, config: &PetConfig) {
        if let Ok(data) = serde_json::to_string(config) {
            let _ = std::fs::write(&self.config_path, data);
        }
    }
}

#[tauri::command]
fn get_config(state: State<'_, AppState>) -> PetConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn set_config(app: AppHandle, state: State<'_, AppState>, patch: serde_json::Value) -> Result<(), String> {
    let mut config = state.config.lock().unwrap();
    
    // Merge patch into config
    let mut config_json = serde_json::to_value(&*config).unwrap();
    if let Some(config_obj) = config_json.as_object_mut() {
        if let Some(patch_obj) = patch.as_object() {
            for (k, v) in patch_obj {
                config_obj.insert(k.clone(), v.clone());
            }
        }
    }
    
    *config = serde_json::from_value(config_json).map_err(|e| e.to_string())?;
    state.save(&*config);
    
    let _ = app.emit("config:changed", &*config);
    Ok(())
}

#[tauri::command]
fn set_click_through(app: AppHandle, enabled: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_ignore_cursor_events(enabled);
    }
}

#[tauri::command]
fn set_always_on_top(app: AppHandle, enabled: bool) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_always_on_top(enabled);
    }
    if let Some(window) = app.get_webview_window("panel") {
        let _ = window.set_always_on_top(enabled);
    }
}

#[tauri::command]
fn resize_panel(app: AppHandle, width: f64, height: f64) {
    if let Some(window) = app.get_webview_window("panel") {
        let _ = window.set_size(Size::Physical(PhysicalSize { width: width as u32, height: height as u32 }));
    }
}

#[tauri::command]
fn set_window_position(app: AppHandle, x: f64, y: f64) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.set_position(Position::Physical(PhysicalPosition { x: x as i32, y: y as i32 }));
    }
}

#[tauri::command]
fn quit(app: AppHandle) {
    app.exit(0);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            let state = AppState::load(app.handle());
            
            // Set initial config states
            let config = state.config.lock().unwrap().clone();
            app.manage(state);

            let quit_i = MenuItem::with_id(app, "quit", "退出程序", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&quit_i])?;

            let _tray = TrayIconBuilder::new()
                .menu(&menu)
                .on_menu_event(|app, event| {
                    if event.id == tauri::menu::MenuId::new("quit") {
                        app.exit(0);
                    }
                })
                .icon(app.default_window_icon().unwrap().clone())
                .build(app)?;

            let app_handle = app.handle().clone();
            std::thread::spawn(move || {
                let device_state = DeviceState::new();
                loop {
                    let mouse = device_state.get_mouse();
                    let (mx, my) = mouse.coords;
                    
                    let mut work_area = Rect { x: 0, y: 0, width: 1920, height: 1040 };
                    
                    if let Ok(Some(monitor)) = app_handle.primary_monitor() {
                        let size = monitor.size();
                        let pos = monitor.position();
                        work_area = Rect {
                            x: pos.x,
                            y: pos.y,
                            width: size.width as i32,
                            height: size.height as i32 - 40,
                        };
                    }

                    let payload = MousePayload {
                        x: mx,
                        y: my,
                        work_area,
                    };
                    
                    let _ = app_handle.emit("mouse-position", payload);
                    std::thread::sleep(std::time::Duration::from_millis(33));
                }
            });

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_ignore_cursor_events(config.click_through);
                let _ = window.set_always_on_top(config.always_on_top);
                let _ = window.show();
            }
            if let Some(window) = app.get_webview_window("panel") {
                let _ = window.set_always_on_top(config.always_on_top);
                let _ = window.show();
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            set_config,
            set_click_through,
            set_always_on_top,
            resize_panel,
            set_window_position,
            quit
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
