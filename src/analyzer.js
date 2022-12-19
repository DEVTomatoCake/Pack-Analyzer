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
var selectors = {
	a: 0,
	e: 0,
	p: 0,
	r: 0,
	s: 0
}
var packFiles = []
var commands = {}
var cmdsBehindExecute = {}
var comments = 0
var empty = 0

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
					if (line.startsWith("#")) comments++
					if (line == "") empty++
					if (line.startsWith("#") || line == "") continue
					const splitted = line.split(" ")

					const cmd = splitted[0]
					if (!commands[cmd]) commands[cmd] = 1
					else commands[cmd]++

					if (cmd == "execute") {
						line.match(/ run [a-z_:]{2,}/g)?.forEach(match => {
							const cmdBehind = match.replace(" run ", "")
							if (!cmdsBehindExecute[cmdBehind]) cmdsBehindExecute[cmdBehind] = 1
							else cmdsBehindExecute[cmdBehind]++
							if (!commands[cmdBehind]) commands[cmdBehind] = 1
							else commands[cmdBehind]++
						})
					}

					splitted.forEach(arg => {
						if (arg.startsWith("@")) {
							arg = arg.slice(1)
							if (arg.startsWith("a")) selectors.a++
							else if (arg.startsWith("e")) selectors.e++
							else if (arg.startsWith("p")) selectors.p++
							else if (arg.startsWith("r")) selectors.r++
							else if (arg.startsWith("s")) selectors.s++
						}
					})
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
	selectors = {
		a: 0,
		e: 0,
		p: 0,
		r: 0,
		s: 0
	}
	packFiles = []
	commands = {}
	cmdsBehindExecute = {}
	comments = 0
	empty = 0

	const entries = await readDir(selected, { recursive: true })
	processEntries(entries)

	interval = setInterval(() => {
		document.getElementById("progress").innerText = Math.round(done / files * 100) + "%" + " scanned" + (error > 0 ? " - " + error + " errors" : "")
		if (done + error == files) {
			clearInterval(interval)
			if (error == 0) document.getElementById("progress").innerText = ""
			if (filetypes.mcfunction + filetypes.json + filetypes.nbt + filetypes.mcmeta == 0) {
				document.getElementById("progress").innerHTML = "No datapack files found!"
				return document.getElementById("selfolbutton").hidden = false
			}

			var html = "" +
				(packFiles.length > 0 ? "<strong>Datapack" + (packFiles.length == 1 ? "" : "s") + " found:</strong><br>" +
				packFiles.map(pack => "<span class='indented'>" + pack.pack.description.replace(/§[a-f0-9]/g, "") +
					(window.data.versions.some(ver => ver.datapack_version == pack.pack.pack_format) ?
						" (Supported versions: " +
						(window.data.versions.findLast(ver => ver.datapack_version == pack.pack.pack_format)?.name || "?") + "<strong>-</strong>" +
						(window.data.versions.find(ver => ver.datapack_version == pack.pack.pack_format)?.name || "?") +
						")</span>"
					: "")
				).join("<br>") + "<br>"
				: "") +
				"<strong>Total amount of commands: " + localize(Object.keys(commands).reduce((a, b) => a + commands[b], 0)) + "</strong><br>" +
				"<span class='indented'>Unique commands: " + localize(Object.keys(commands).length) + "</span><br>" +
				"<span class='indented'>Comments: " + localize(comments) + "</span><br>" +
				(empty > 0 ? "<span class='indented'>Empty lines: " + localize(empty) + "</span><br>" : "") +
				"<strong>Datapack file types found:</strong><br>" +
				(filetypes.mcfunction > 0 ? "<span class='indented'>.mcfunction: " + localize(filetypes.mcfunction) + "</span><br>" : "") +
				(filetypes.json > 0 ? "<span class='indented'>.json: " + localize(filetypes.json) + "</span><br>" : "") +
				(filetypes.nbt > 0 ? "<span class='indented'>.nbt: " + localize(filetypes.nbt) + "</span><br>" : "") +
				(filetypes.mcmeta > 0 ? "<span class='indented'>.mcmeta: " + localize(filetypes.mcmeta) + "</span><br>": "") +
				(selectors.a + selectors.e + selectors.p + selectors.r + selectors.s != 0 ? "<strong>Selectors used:</strong><br>" : "") +
				(selectors.a > 0 ? "<span class='indented'>@a: " + localize(selectors.a) + "</span><br>" : "") +
				(selectors.e > 0 ? "<span class='indented'>@e: " + localize(selectors.e) + "</span><br>" : "") +
				(selectors.p > 0 ? "<span class='indented'>@p: " + localize(selectors.p) + "</span><br>" : "") +
				(selectors.r > 0 ? "<span class='indented'>@r: " + localize(selectors.r) + "</span><br>" : "") +
				(selectors.s > 0 ? "<span class='indented'>@s: " + localize(selectors.s) + "</span><br>" : "") + "<br>"

			commands = Object.fromEntries(Object.entries(commands).sort(([, a], [, b]) => b - a))
			Object.keys(commands).forEach(cmd => {
				html += cmd + ": " + localize(commands[cmd]) + "<br>"
				if (cmdsBehindExecute[cmd]) html += "<span class='indented'>Behind execute: " + localize(cmdsBehindExecute[cmd]) +
					(cmd == "execute" ? " <small>(<code>... run execute ...</code> equals <code>... ...</code>)</small>" : "") + "</span><br>"
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
	else if (res.payload == "settings") openSettingsDialog()
})
