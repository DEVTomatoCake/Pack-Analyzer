const { readDir, readTextFile } = window.__TAURI__.fs
const { open } = window.__TAURI__.dialog
const { dataDir } = window.__TAURI__.path

var interval
var files = 0
var done = 0

var filetypes = {
	mcfunction: 0,
	mcmeta: 0,
	json: 0
}
var commands = {}
var cmdsBehindExecute = {}

async function processEntries(entries) {
	for (const entry of entries) {
		if (entry.children) processEntries(entry.children)
		else if (entry.path.endsWith(".mcfunction") || entry.path.endsWith(".mcmeta") || entry.path.endsWith(".json")) {
			files++
			const contents = await readTextFile(entry.path)
			done++

			if (entry.path.endsWith(".mcfunction")) {
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
			}
		}
	}
}

async function selectFolder() {
	document.getElementById("result").innerHTML = ""
	if (interval) clearInterval(interval)
	files = 0
	done = 0

	filetypes = {
		mcfunction: 0,
		mcmeta: 0,
		json: 0
	}
	commands = {}
	cmdsBehindExecute = {}

	const selected = await open({
		title: "Select a datapack or world folder",
		defaultPath: await dataDir() + ".minecraft\\saves",
		directory: true,
		recursive: true
	})
	if (selected) {
		const entries = await readDir(selected, { recursive: true })
		processEntries(entries)

		interval = setInterval(() => {
			document.getElementById("progress").innerText = Math.round(done / files * 100) + "%" + " scanned (" + done + "/" + files + ")"
			if (done == files) {
				clearInterval(interval)
				var html = "<strong>Total amount of commands: " + Object.keys(commands).reduce((a, b) => a + commands[b], 0) + "</strong><br>" +
					"<span style='padding-left: 25px;'>Unique commands: " + Object.keys(commands).length + "</span><br><br>"

				commands = Object.fromEntries(Object.entries(commands).sort(([, a], [, b]) => b - a))
				Object.keys(commands).forEach(cmd => {
					html += cmd + ": " + commands[cmd] + "<br>"
					if (cmdsBehindExecute[cmd]) html += "<span style='padding-left: 25px;'>Behind execute: " + cmdsBehindExecute[cmd] + "</span><br>"
				})
				document.getElementById("result").innerHTML = html
			}
		}, 100)
	}
}

const { listen } = window.__TAURI__.event
listen("tauri://update-status", function (res) {
  	console.warn("New update status: ", res)
})
