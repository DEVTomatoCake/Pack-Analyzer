const { readDir, readTextFile } = window.__TAURI__.fs
const { open, message } = window.__TAURI__.dialog
const { dataDir } = window.__TAURI__.path
const { listen } = window.__TAURI__.event
const { getVersion, getTauriVersion } = window.__TAURI__.app

var interval
var files = 0
var done = 0
var error = 0
var selected = null

var filetypes = {
	mcfunction: 0,
	json: 0,
	nbt: 0,
	mcmeta: 0
}
var packFiles = []
var commands = {}
var cmdsBehindExecute = {}

async function processEntries(entries) {
	for (const entry of entries) {
		if (entry.children) processEntries(entry.children)
		else if (entry.path.endsWith(".mcfunction") || entry.path.endsWith(".mcmeta")) {
			files++
			try {
				var contents = await readTextFile(entry.path)
			} catch (e) {
				console.warn("Could not read file: " + entry.path, e)
				error++
				continue
			}
			done++

			if (entry.path.endsWith(".mcfunction")) {
				filetypes.mcfunction++
				const lines = contents.split("\n")
				for (let line of lines) {
					line = line.trim()
					if (line.startsWith("#") || line == "") continue

					const cmd = line.split(" ")[0]
					if (!commands[cmd]) commands[cmd] = 1
					else commands[cmd]++

					if (cmd == "execute") {
						const cmdBehind = line.split(" ")[line.split(" ").indexOf("run") + 1]
						if (!cmdsBehindExecute[cmdBehind]) cmdsBehindExecute[cmdBehind] = 1
						else cmdsBehindExecute[cmdBehind]++
						if (!commands[cmdBehind]) commands[cmdBehind] = 1
						else commands[cmdBehind]++
					}
				}
			} else if (entry.path.endsWith(".mcmeta")) {
				filetypes.mcmeta++
				if (entry.path.endsWith("\\pack.mcmeta")) {
					try {
						packFiles.push(JSON.parse(contents))
					} catch (e) {
						console.warn("Could not parse pack.mcmeta: " + entry.path, e)
						error++
					}
				}
			}
		} else if (entry.path.endsWith(".json")) filetypes.json++
		else if (entry.path.endsWith(".nbt")) filetypes.nbt++
	}
}

async function mainScan() {
	if (interval) clearInterval(interval)
	document.getElementById("selfolbutton").hidden = true
	document.getElementById("result").innerHTML = ""

	files = 0
	done = 0
	error = 0

	filetypes = {
		mcfunction: 0,
		json: 0,
		nbt: 0,
		mcmeta: 0
	}
	packFiles = []
	commands = {}
	cmdsBehindExecute = {}

	const entries = await readDir(selected, { recursive: true })
	processEntries(entries)

	interval = setInterval(() => {
		document.getElementById("progress").innerText = Math.round(done / files * 100) + "%" + " scanned" + (error > 0 ? " - " + error + " errors" : "")
		if (done + error == files) {
			clearInterval(interval)
			if (error == 0) document.getElementById("progress").innerText = ""

			var html = "<strong>Datapacks found:</strong><br>" +
				packFiles.map(pack => "<span style='padding-left: 25px;'>" + pack.pack.description +
				(window.data.versions.some(ver => ver.datapack_version == pack.pack.pack_format) ?
					" (Supported versions: " +
					(window.data.versions.findLast(ver => ver.datapack_version == pack.pack.pack_format)?.name || "?") + "<strong>-</strong>" +
					(window.data.versions.find(ver => ver.datapack_version == pack.pack.pack_format)?.name || "?") +
					")</span>"
				: "")).join("<br>") + "<br>" +
				"<strong>Total amount of commands: " + Object.keys(commands).reduce((a, b) => a + commands[b], 0) + "</strong><br>" +
				"<span style='padding-left: 25px;'>Unique commands: " + Object.keys(commands).length + "</span><br>" +
				"<strong>Scannable file types found:</strong><br>" +
				"<span style='padding-left: 25px;'>.mcfunction: " + filetypes.mcfunction + "</span><br>" +
				"<span style='padding-left: 25px;'>.json: " + filetypes.json + "</span><br>" +
				"<span style='padding-left: 25px;'>.nbt: " + filetypes.nbt + "</span><br>" +
				"<span style='padding-left: 25px;'>.mcmeta: " + filetypes.mcmeta + "</span><br><br>"

			commands = Object.fromEntries(Object.entries(commands).sort(([, a], [, b]) => b - a))
			Object.keys(commands).forEach(cmd => {
				html += cmd + ": " + commands[cmd] + "<br>"
				if (cmdsBehindExecute[cmd]) html += "<span style='padding-left: 25px;'>Behind execute: " + cmdsBehindExecute[cmd] + "</span><br>"
			})
			document.getElementById("result").innerHTML = html
		}
	}, 100)
}
async function selectFolder() {
	getData().then(() => {
		if (window.data.settings.theme == "light") document.body.classList = "light-theme"
	})
	if (interval) clearInterval(interval)

	selected = null
	selected = await open({
		title: "Select a Minecraft Java Edition Datapack or world folder",
		defaultPath: await dataDir() + ".minecraft\\saves",
		directory: true,
		recursive: true
	})
	if (selected) mainScan()
}

listen("tauri://menu", async res => {
  	if (res.payload == "selectfolder") selectFolder()
  	else if (res.payload == "rescan") mainScan()
  	else if (res.payload == "clear") {
		document.getElementById("progress").innerText = ""
		document.getElementById("result").innerHTML = ""
		if (interval) clearInterval(interval)
	} else if (res.payload == "about") message("Version: " + await getVersion() + "\nTauri version: " + await getTauriVersion() + "\nDeveloper: TomatoCake\nInspired by: ErrorCraft's FunctionAnalyser\nSource: github.com/DEVTomatoCake/Datapack-Analyzer", "About this app")
})
