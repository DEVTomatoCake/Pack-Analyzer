let interval
let files = 0
let done = 0
let error = 0
let selected = null
let rpMode = false

let filetypes = {}
let filetypesOther = {}
let packFiles = []
let packImages = []
let commands = {}
let cmdsBehindExecute = {}
let comments = 0
let empty = 0
let dpExclusive = {
	folders: {
		advancements: 0,
		loot_tables: 0,
		recipes: 0,
		predicates: 0,
		dimension: 0,
		dimension_type: 0,
		worldgen: 0
	},
	tags: {
		banner_pattern: 0,
		blocks: 0,
		cat_variant: 0,
		entity_types: 0,
		fluids: 0,
		functions: 0,
		game_events: 0,
		instrument: 0,
		items: 0,
		painting_variant: 0,
		point_of_interest_type: 0,
		worldgen: 0
	},
	scoreboards: 0,
	selectors: {
		a: 0,
		e: 0,
		p: 0,
		r: 0,
		s: 0
	},
	functions: [],
	functionCalls: []
}
let rpExclusive = {
	atlases: 0,
	blockstates: 0,
	font: 0,
	lang: 0,
	models: 0,
	particles: 0,
	shaders: 0,
	sounds: 0,
	texts: 0,
	textures: 0
}

async function processEntries(entries) {
	for await (const entry of entries) {
		const filePath = entry.webkitRelativePath || entry.name
		if (filePath.includes("/.git/") || filePath.includes("/.svn/")) continue
		if (entry.kind == "directory") {
			processEntries(entry)
			continue
		}

		const ext = entry.name.split(".").pop()
		if (
			ext == "mcmeta" || ext == "json" ||
			(!rpMode && (ext == "mcfunction" || ext == "nbt")) ||
			(rpMode && (ext == "png" || ext == "icns" || ext == "txt" || ext == "ogg" || ext == "fsh" || ext == "vsh" || ext == "glsl" || ext == "lang" || ext == "properties" || ext == "inc" || ext == "xcf"))
		) {
			if (filetypes[ext]) filetypes[ext]++
			else filetypes[ext] = 1
		} else {
			if (filetypesOther[(entry.name.includes(".") ? "." : "") + ext]) filetypesOther[(entry.name.includes(".") ? "." : "") + ext]++
			else filetypesOther[(entry.name.includes(".") ? "." : "") + ext] = 1
		}

		if (
			ext == "mcfunction" || ext == "mcmeta" || (!rpMode && ext == "json" && (filePath.includes("/advancements/") || filePath.includes("/tags/functions/"))) ||
			ext == "fsh" || ext == "vsh" || ext == "glsl" || entry.name.endsWith("pack.png")
		) {
			files++

			const processFile = result => {
				done++

				if (!rpMode && ext == "mcfunction") {
					const funcLocation = /data\/([-a-z0-9_]+)\/functions\/([-a-z0-9_/]+)/i.exec(filePath)
					if (funcLocation && !dpExclusive.functions.includes(funcLocation[1] + ":" + funcLocation[2])) dpExclusive.functions.push(funcLocation[1] + ":" + funcLocation[2])

					const lines = result.split("\n")
					for (let line of lines) {
						line = line.trim()
						if (line.startsWith("#")) comments++
						if (line == "") empty++
						if (line.startsWith("#") || line == "") continue
						const splitted = line.split(" ")

						const cmd = splitted[0]
						if (commands[cmd]) commands[cmd]++
						else commands[cmd] = 1

						if (cmd == "execute") {
							line.match(/run ([a-z_:]{2,})/g)?.forEach(match => {
								if (match[1] == "return") return

								const cmdBehind = match.replace(" run ", "")
								if (cmdsBehindExecute[cmdBehind]) cmdsBehindExecute[cmdBehind]++
								else cmdsBehindExecute[cmdBehind] = 1
								if (commands[cmdBehind]) commands[cmdBehind]++
								else commands[cmdBehind] = 1
							})
						}
						if (cmd == "function" || line.includes(" function ") || line.includes("/function ")) {
							const func = /function (([-a-z0-9_]+):)?([-a-z0-9_/]+)/i.exec(line)
							if (func && func[3]) dpExclusive.functionCalls.push({
								source: funcLocation[1] + ":" + funcLocation[2],
								target: (func[2] || "minecraft") + ":" + func[3]
							})
						}

						if (/scoreboard objectives add \w+ \w+( .+)?$/.test(line)) dpExclusive.scoreboards++

						splitted.forEach(arg => {
							if (arg.startsWith("@")) {
								arg = arg.slice(1)
								if (arg.startsWith("a")) dpExclusive.selectors.a++
								else if (arg.startsWith("e")) dpExclusive.selectors.e++
								else if (arg.startsWith("p")) dpExclusive.selectors.p++
								else if (arg.startsWith("r")) dpExclusive.selectors.r++
								else if (arg.startsWith("s")) dpExclusive.selectors.s++
							}
						})
					}
				} else if (ext == "mcmeta") {
					if (entry.name == "pack.mcmeta") {
						try {
							packFiles.push(JSON.parse(result))
						} catch (e) {
							console.warn("Could not parse pack.mcmeta: " + filePath, e)
							error++
						}
					}
				} else if (entry.name.endsWith("pack.png") && !result.includes(">")) packImages.push(result)
				else if (rpMode && (ext == "fsh" || ext == "vsh" || ext == "glsl")) {
					const lines = result.split("\n")
					for (let line of lines) {
						line = line.trim()
						if (line.startsWith("//") || line.startsWith("/*")) comments++
						if (line == "") empty++
						if (line.startsWith("//") || line.startsWith("/*") || line == "") continue

						const cmd = line.match(/^[a-z_#0-9]+/i)?.[0]
						if (cmd && cmd != "{" && cmd != "}") {
							if (commands[cmd]) commands[cmd]++
							else commands[cmd] = 1
						}
					}
				} else if (!rpMode && ext == "json") {
					if (filePath.includes("/advancements/")) {
						const fileLocation = /data\/([-a-z0-9_]+)\/advancements\/([-a-z0-9_/]+)/i.exec(filePath)

						try {
							const parsed = JSON.parse(result)
							if (parsed.rewards && parsed.rewards.function) dpExclusive.functionCalls.push({
								source: "(Advancement) " + fileLocation[1] + ":" + fileLocation[2],
								target: parsed.rewards.function.includes(":") ? parsed.rewards.function : "minecraft:" + parsed.rewards.function
							})
						} catch (e) {
							console.warn("Unable to analyze advancement: " + filePath, e)
						}
					} else if (filePath.includes("/tags/functions/")) {
						const fileLocation = /data\/([-a-z0-9_]+)\/tags\/functions\/([-a-z0-9_/]+)/i.exec(filePath)

						try {
							const parsed = JSON.parse(result)
							if (parsed.values) parsed.values.forEach(func => {
								dpExclusive.functionCalls.push({
									source: "#" + fileLocation[1] + ":" + fileLocation[2],
									target: func.includes(":") ? func : "minecraft:" + func
								})
							})
						} catch (e) {
							console.warn("Unable to analyze function tag: " + filePath, e)
						}
					}
				}
			}

			if (entry.content) processFile(entry.content)
			else {
				const reader = new FileReader()
				if (ext == "png") reader.readAsDataURL(entry)
				else entry.text().then(processFile)

				reader.onload = () => {
					processFile(reader.result)
				}
				reader.onerror = e => {
					console.warn("Could not read file: " + filePath, e)
					error++
				}
			}
		}
		if (!rpMode && ext == "json") {
			Object.keys(dpExclusive.folders).forEach(type => {
				if (filePath.includes("/" + type + "/")) dpExclusive.folders[type]++
			})
			Object.keys(dpExclusive.tags).forEach(type => {
				if (filePath.includes("/tags/" + type + "/")) dpExclusive.tags[type]++
			})
		} else if (rpMode)
			Object.keys(rpExclusive).forEach(type => {
				if (filePath.includes("/" + type + "/")) rpExclusive[type]++
			})
	}
}

async function mainScan(hasData = false) {
	if (interval) clearInterval(interval)
	document.getElementById("result").innerHTML = ""

	if (!hasData) {
		files = 0
		done = 0
		error = 0
		rpMode = document.getElementById("radiorp").checked

		filetypes = {}
		filetypesOther = {}
		packFiles = []
		packImages = []
		commands = {}
		cmdsBehindExecute = {}
		comments = 0
		empty = 0
		dpExclusive = {
			folders: {
				advancements: 0,
				loot_tables: 0,
				recipes: 0,
				predicates: 0,
				dimension: 0,
				dimension_type: 0,
				worldgen: 0
			},
			tags: {
				banner_pattern: 0,
				blocks: 0,
				cat_variant: 0,
				entity_types: 0,
				fluids: 0,
				functions: 0,
				game_events: 0,
				instrument: 0,
				items: 0,
				painting_variant: 0,
				point_of_interest_type: 0,
				worldgen: 0
			},
			scoreboards: 0,
			selectors: {
				a: 0,
				e: 0,
				p: 0,
				r: 0,
				s: 0
			},
			functions: [],
			functionCalls: []
		}
		rpExclusive = {
			atlases: 0,
			blockstates: 0,
			font: 0,
			lang: 0,
			models: 0,
			particles: 0,
			shaders: 0,
			sounds: 0,
			texts: 0,
			textures: 0
		}

		processEntries(selected)
	}

	interval = setInterval(() => {
		document.getElementById("progress").innerText = Math.round(done / files * 100) + "% scanned" + (error > 0 ? " - " + error + " errors" : "")
		if (done + error == files || hasData) {
			clearInterval(interval)
			if (files == 0) return document.getElementById("progress").innerText = "No files found!"
			document.getElementById("resultButtons").hidden = false
			if (error == 0) document.getElementById("progress").innerText = ""
			if (Object.values(filetypes).reduce((a, b) => a + b) == 0) document.getElementById("progress").innerHTML = "No " + (rpMode ? "resource" : "data") + "pack files found!"

			const uncalledFunctions = dpExclusive.functions.filter(funcName => !dpExclusive.functionCalls.some(func => func.target == funcName))
			const missingFunctions = [...new Set(dpExclusive.functionCalls.filter(func => !dpExclusive.functions.includes(func.target)).map(func => func.target))]

			let html =
				(packImages.length > 0 ? "<div style='display: flex;'>" + packImages.map(img => "<img src='" + img + "' width='64' height='64'>") + "</div>" : "") +
				(packFiles.length > 0 ? "<strong>" + (rpMode ? "Resource" : "Data") + "pack" + (packFiles.length == 1 ? "" : "s") + " found:</strong><br>" +
					packFiles.map(pack => {
						let oldestFormat = pack.pack.pack_format
						let newestFormat = pack.pack.pack_format
						if (pack.pack.supported_formats && typeof pack.pack.supported_formats == "object") {
							if (Array.isArray(pack.pack.supported_formats)) {
								oldestFormat = pack.pack.supported_formats[0]
								newestFormat = pack.pack.supported_formats[1]
							} else {
								oldestFormat = pack.pack.supported_formats.min_inclusive
								newestFormat = pack.pack.supported_formats.max_inclusive
							}
						}

						return "<span class='indented'>" + (pack.pack?.description?.replace(/§[0-9a-flmnor]/gi, "") || "<i>No description</i>") +
							(window.versions.some(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == pack.pack.pack_format) ?
								"<br><span class='indented2'>Supported versions: " +
								(window.versions.findLast(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == oldestFormat)?.name || "?") +
								" - " +
								(window.versions.find(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == newestFormat)?.name || "?") +
								"</span>"
							: "") +
							"</span>" +
							(pack.features?.enabled?.length > 0 ?
								"<br><span class='indented2'>Selected internal features: " +
								pack.features.enabled.map(feature => "<code>" + feature + "</code>").join(", ") + "</span>"
							: "") +
							(pack.filter?.block?.length > 0 ? "<br><span class='indented2'>Pack filters:</span><br><small>" + pack.filter.block.map(filter =>
								"<span class='indented3'>" +
								(filter.namespace ? "Namespace: <code>" + filter.namespace + "</code>" : "") +
								(filter.namespace && filter.path ? ", " : "") +
								(filter.path ? "Path: <code>" + filter.path + "</code>" : "") +
								"</span>"
							).join("<br>") + "</small>" : "")
					}).join("<br>") + "<br>"
				: "") +
				(packFiles.length == 0 && (filetypes.fsh || filetypes.vsh || filetypes.xcf || filetypes.glsl) ? "<strong>Shader found</strong><br>" : "") +

				(Object.keys(commands).length > 0 ?
					"<strong>Total amount of commands: " + localize(Object.keys(commands).reduce((a, b) => a + commands[b], 0)) + "</strong><br>" +
					"<span class='indented'>Unique command names: " + localize(Object.keys(commands).length) + "</span><br>"
				: "") +
				(comments > 0 ? "<span class='indented'>Comments: " + localize(comments) + "</span><br>" : "") +
				(empty > 0 ? "<span class='indented'>Empty lines: " + localize(empty) + "</span><br>" : "") +
				"<strong>Pack file types found:</strong><br>" +
				Object.keys(filetypes).sort((a, b) => filetypes[b] - filetypes[a]).map(type => "<span class='indented'>." + type + ": " + localize(filetypes[type]) + "</span><br>").join("") +
				(Object.keys(filetypesOther).length > 0 ?
					"<details><summary>" +
					"<strong>Non-pack file types found:</strong></summary>" +
					Object.keys(filetypesOther).sort((a, b) => filetypesOther[b] - filetypesOther[a]).map(type => "<span class='indented'>" + type + ": " + localize(filetypesOther[type]) + "</span><br>").join("") +
					"<br></details>"
				: "") +
				(uncalledFunctions.length > 0 ?
					"<strong>Uncalled functions:</strong><br>" +
					uncalledFunctions.map(func => "<span class='indented'>" + func + "</span><br>").join("") +
					"<br>"
				: "") +
				(missingFunctions.length > 0 ?
					"<strong>Missing functions:</strong><br>" +
					missingFunctions.map(func => "<span class='indented'>" + func + "</span><br>").join("") +
					"<br>"
				: "") +

				(dpExclusive.scoreboards > 0 ? "<strong>Scoreboards created: " + localize(dpExclusive.scoreboards) + "</strong><br>" : "") +
				(!rpMode && Object.values(dpExclusive.selectors).reduce((a, b) => a + b) != 0 ? "<strong>Selectors used:</strong><br>" : "") +
				Object.keys(dpExclusive.selectors).filter(i => dpExclusive.selectors[i] > 0).sort((a, b) => dpExclusive.selectors[b] - dpExclusive.selectors[a])
					.map(type => "<span class='indented'>@" + type + ": " + localize(dpExclusive.selectors[type]) + "</span><br>").join("") +
				(!rpMode && Object.values(dpExclusive.folders).reduce((a, b) => a + b) != 0 ? "<strong>Datapack features used:</strong><br>" : "") +
				Object.keys(dpExclusive.folders).filter(i => dpExclusive.folders[i] > 0).sort((a, b) => dpExclusive.folders[b] - dpExclusive.folders[a])
					.map(type => "<span class='indented'>" + type + ": " + localize(dpExclusive.folders[type]) + "</span><br>").join("") +
				(!rpMode && Object.values(dpExclusive.tags).reduce((a, b) => a + b) != 0 ? "<strong>Tags used:</strong><br>" : "") +
				Object.keys(dpExclusive.tags).filter(i => dpExclusive.tags[i] > 0).sort((a, b) => dpExclusive.tags[b] - dpExclusive.tags[a])
					.map(type => "<span class='indented'>" + type + ": " + localize(dpExclusive.tags[type]) + "</span><br>").join("") +

				(rpMode && Object.values(rpExclusive).reduce((a, b) => a + b) != 0 ? "<br><strong>Resourcepack features used:</strong><br>" : "") +
				Object.keys(rpExclusive).filter(i => rpExclusive[i] > 0).sort((a, b) => rpExclusive[b] - rpExclusive[a])
					.map(type => "<span class='indented'>" + type + ": " + localize(rpExclusive[type]) + "</span><br>").join("")

			html += "<br>"
			commands = Object.fromEntries(Object.entries(commands).sort(([, a], [, b]) => b - a))
			Object.keys(commands).forEach(cmd => {
				html += cmd + ": " + localize(commands[cmd]) + "<br>"
				if (cmdsBehindExecute[cmd]) html += "<span class='indented'>Behind execute: " + localize(cmdsBehindExecute[cmd]) +
					(cmd == "execute" ? "⚠️ <small>(<code>... run execute ...</code> equals <code>... ...</code>)</small>" : "") + "</span><br>"
			})
			document.getElementById("result").innerHTML = html
		}
	}, 100)
}

async function selectFolder() {
	if (interval) clearInterval(interval)
	selected = null

	const input = document.createElement("input")
	input.type = "file"
	input.webkitdirectory = true
	input.onchange = e => {
		selected = e.target.files
		mainScan()
	}
	if ("showPicker" in HTMLInputElement.prototype) input.showPicker()
	else input.click()
}

async function selectZip() {
	if (interval) clearInterval(interval)

	const input = document.createElement("input")
	input.type = "file"
	input.accept = ".zip"
	input.onchange = e => handleZip(e.target.files[0])

	if ("showPicker" in HTMLInputElement.prototype) input.showPicker()
	else input.click()
}

function handleZip(file) {
	selected = []

	new JSZip().loadAsync(file).then(async zip => {
		for await (const zipFile of Object.values(zip.files)) {
			selected.push({
				name: zipFile.name,
				content: await zipFile.async("text")
			})
		}
		mainScan()
	})
}
