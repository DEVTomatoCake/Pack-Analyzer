const { writeTextFile, createDir, exists, BaseDirectory } = window.__TAURI__.fs
const defaultSettings = {
	theme: "dark",
	language: "en"
}

async function refreshData() {
	if (!await exists("", { dir: BaseDirectory.AppCache })) createDir("", { dir: BaseDirectory.AppCache })
	if (!await exists("", { dir: BaseDirectory.AppConfig })) createDir("", { dir: BaseDirectory.AppConfig })

	const res = await window.__TAURI__.http.fetch("https://github.com/misode/mcmeta/raw/summary/versions/data.json")
	const data = res.data.map(ver => {
		return {
			name: ver.id,
			datapack_version: ver.data_pack_version,
			resourcepack_version: ver.resource_pack_version
		}
	})
	window.data = {
		versions: data,
		settings: defaultSettings
	}

	writeTextFile("versions.json", JSON.stringify(data), { dir: BaseDirectory.AppCache })
	writeTextFile("settings.json", JSON.stringify(defaultSettings), { dir: BaseDirectory.AppConfig })
}
async function getData() {
	if (await exists("versions.json", { dir: BaseDirectory.AppCache }) && await exists("settings.json", { dir: BaseDirectory.AppConfig })) window.data = {
		versions: JSON.parse(await readTextFile("versions.json", { dir: BaseDirectory.AppCache })),
		settings: JSON.parse(await readTextFile("settings.json", { dir: BaseDirectory.AppConfig }))
	}
	else await refreshData()
}
const localize = string => string.toLocaleString(window.data.settings.lang || "en-US")

function openDialog(dialog) {
	dialog.style.display = "block"
	dialog.getElementsByClassName("close")[0].onclick = function() {
		dialog.style.display = "none"
	}
	window.onclick = function(event) {
		if (event.target == dialog) dialog.style.display = "none"
	}
}

function openSettingsDialog() {
	var dialog = document.getElementById("settingsDialog")
	openDialog(dialog)

	if (window.data.settings.theme == "light") dialog.querySelector("option[value='light']").selected = true
	else dialog.querySelector("option[value='dark']").selected = true

	if (window.data.settings.language == "en-US") dialog.querySelector("option[value='en-US']").selected = true
	else dialog.querySelector("option[value='de-DE']").selected = true

	for (let select of dialog.getElementsByTagName("select")) {
		select.onchange = () => {
			window.data.settings[select.name] = select.value
			writeTextFile("settings.json", JSON.stringify(window.data.settings), { dir: BaseDirectory.AppConfig })

			if (select.name == "theme") document.body.classList = select.value + "-theme"
		}
	}
}

listen("tauri://update-status", res => {
  	console.warn("New update status: ", res)
})
