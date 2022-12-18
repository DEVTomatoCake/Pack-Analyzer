#![cfg_attr(
	all(not(debug_assertions), target_os = "windows"),
	windows_subsystem = "windows"
)]

use tauri::{CustomMenuItem, Menu, Submenu};

fn main() {
	sentry_tauri::init(
		sentry::release_name!(),
		|_| {
			sentry::init((
				"https://56a6214287f648e5a9299b86e0aede0c@o1070850.ingest.sentry.io/4504351008555010",
				sentry::ClientOptions {
					release: sentry::release_name!(),
					..Default::default()
				},
			))
		},
		|sentry_plugin| {
			tauri::Builder::default()
				.plugin(sentry_plugin)
				.run(tauri::generate_context!())
				.expect("error while running tauri application");
		},
	);

	let submenu = Submenu::new("File", Menu::new()
		.add_item(CustomMenuItem::new("selectfolder", "Select Folder"))
		.add_item(CustomMenuItem::new("rescan", "Rescan"))
	);

	let menu = Menu::new()
		.add_submenu(submenu);

	tauri::Builder::default()
		.menu(menu)
		.on_menu_event(|event| {
			match event.menu_item_id() {
				"selectfolder" => {
					std::process::exit(0);
				}
				"rescan" => {
					event.window().close().unwrap();
				}
				_ => {}
			}
		})
		.run(tauri::generate_context!())
		.expect("error while running tauri application");
}
