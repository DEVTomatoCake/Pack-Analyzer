let interval
let files = 0
let done = 0
let error = 0
let selected = null
let rpMode = false

let filetypes = {}
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
	}
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
		} else continue

		if (ext == "mcfunction" || ext == "mcmeta" || ext == "fsh" || ext == "vsh" || entry.name.endsWith("pack.png")) {
			files++

			const processFile = result => {
				done++

				if (!rpMode && ext == "mcfunction") {
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
							line.match(/ run [a-z_:]{2,}/g)?.forEach(match => {
								const cmdBehind = match.replace(" run ", "")
								if (cmdsBehindExecute[cmdBehind]) cmdsBehindExecute[cmdBehind]++
								else cmdsBehindExecute[cmdBehind] = 1
								if (commands[cmdBehind]) commands[cmdBehind]++
								else commands[cmdBehind] = 1
							})
						}

						if (/scoreboard objectives add \w+ \w+( [ \S]+)?$/.match(line)) dpExclusive.scoreboards++

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
		} else if (!rpMode && ext == "json") {
			if (filePath.includes("/advancements/")) dpExclusive.folders.advancements++
			else if (filePath.includes("/loot_tables/")) dpExclusive.folders.loot_tables++
			else if (filePath.includes("/recipes/")) dpExclusive.folders.recipes++
			else if (filePath.includes("/predicates/")) dpExclusive.folders.predicates++
			else if (filePath.includes("/dimension/")) dpExclusive.folders.dimension++
			else if (filePath.includes("/dimension_type/")) dpExclusive.folders.dimension_type++
			else if (filePath.includes("/worldgen/")) dpExclusive.folders.worldgen++

			else if (filePath.includes("/tags/banner_pattern/")) dpExclusive.tags.banner_pattern++
			else if (filePath.includes("/tags/blocks/")) dpExclusive.tags.blocks++
			else if (filePath.includes("/tags/cat_variant/")) dpExclusive.tags.cat_variant++
			else if (filePath.includes("/tags/entity_types/")) dpExclusive.tags.entity_types++
			else if (filePath.includes("/tags/fluids/")) dpExclusive.tags.fluids++
			else if (filePath.includes("/tags/functions/")) dpExclusive.tags.functions++
			else if (filePath.includes("/tags/game_events/")) dpExclusive.tags.game_events++
			else if (filePath.includes("/tags/items/")) dpExclusive.tags.items++
			else if (filePath.includes("/tags/instrument/")) dpExclusive.tags.instrument++
			else if (filePath.includes("/tags/painting_variant/")) dpExclusive.tags.painting_variant++
			else if (filePath.includes("/tags/point_of_interest_type/")) dpExclusive.tags.point_of_interest_type++
			else if (filePath.includes("/tags/worldgen/")) dpExclusive.tags.worldgen++
		} else if (rpMode) {
			if (filePath.includes("/atlases/")) rpExclusive.atlases++
			else if (filePath.includes("/blockstates/")) rpExclusive.blockstates++
			else if (filePath.includes("/font/")) rpExclusive.font++
			else if (filePath.includes("/lang/")) rpExclusive.lang++
			else if (filePath.includes("/models/")) rpExclusive.models++
			else if (filePath.includes("/particles/")) rpExclusive.particles++
			else if (filePath.includes("/shaders/")) rpExclusive.shaders++
			else if (filePath.includes("/sounds/")) rpExclusive.sounds++
			else if (filePath.includes("/texts/")) rpExclusive.texts++
			else if (filePath.includes("/textures/")) rpExclusive.textures++
		}
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
			}
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

			let html =
				(packImages.length > 0 ? "<div style='display: flex;'>" + packImages.map(img => "<img src='" + img + "' width='64' height='64'>") + "</div>" : "") +
				(packFiles.length > 0 ? "<strong>" + (rpMode ? "Resource" : "Data") + "pack" + (packFiles.length == 1 ? "" : "s") + " found:</strong><br>" +
					packFiles.map(pack => "<span class='indented'>" + (pack.pack?.description?.replace(/§[a-f0-9]/gi, "") || "<i>No description</i>") +
						(window.versions.some(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == pack.pack.pack_format) ?
							" <small>(Supported versions: " +
							(window.versions.findLast(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == pack.pack.pack_format)?.name || "?") + "<strong>-</strong>" +
							(window.versions.find(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == pack.pack.pack_format)?.name || "?") +
							")</small>"
						: "") +
						"</span>" +
						(pack.features?.enabled?.length > 0 ? "<br><span class='indented'>Selected internal features:<br>" + pack.features.enabled.map(feature => "<span class='indented'>" + feature + "</span>").join("<br>") + "</span>" : "") +
						(pack.filter?.block?.length > 0 ? "<br><span class='indented2'>Pack filters:</span><br><small>" + pack.filter.block.map(filter => {
							return "<span class='indented3'>" +
							(filter.namespace ? "Namespace: <code>" + filter.namespace + "</code>" : "") +
							(filter.namespace && filter.path ? ", " : "") +
							(filter.path ? "Path: <code>" + filter.path + "</code>" : "") + "</span>"
						}).join("<br>") + "</small>" : "")
					).join("<br>") + "<br>"
				: "") +
				(packFiles.length == 0 && (filetypes.fsh || filetypes.vsh || filetypes.xcf || filetypes.glsl) ? "<strong>Shader found:</strong><br>" : "") +
				(Object.keys(commands).length > 0 ?
					"<strong>Total amount of commands: " + localize(Object.keys(commands).reduce((a, b) => a + commands[b], 0)) + "</strong><br>" +
					"<span class='indented'>Unique commands: " + localize(Object.keys(commands).length) + "</span><br>"
				: "") +
				(comments > 0 ? "<span class='indented'>Comments: " + localize(comments) + "</span><br>" : "") +
				(empty > 0 ? "<span class='indented'>Empty lines: " + localize(empty) + "</span><br>" : "") +
				"<strong>Pack file types found:</strong><br>" +
				Object.keys(filetypes).sort((a, b) => filetypes[b] - filetypes[a]).map(type => "<span class='indented'>." + type + ": " + localize(filetypes[type]) + "</span><br>").join("") +

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
