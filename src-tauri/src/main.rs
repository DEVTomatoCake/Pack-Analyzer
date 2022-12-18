#![cfg_attr(
	all(not(debug_assertions), target_os = "windows"),
	windows_subsystem = "windows"
)]

use tauri::{CustomMenuItem, Menu, Submenu};

fn main() {
	let submenu = Submenu::new("App", Menu::new()
		.add_item(CustomMenuItem::new("selectfolder", "Select Folder"))
		.add_item(CustomMenuItem::new("rescan", "Scan Folder again"))
		.add_item(CustomMenuItem::new("clear", "Clear results"))
	);

	let menu = Menu::new()
		.add_submenu(submenu);

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
				.menu(menu)
				.run(tauri::generate_context!())
				.expect("error while running tauri application");
		},
	);
}
