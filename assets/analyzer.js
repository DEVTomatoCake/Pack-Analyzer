var interval
var files = 0
var done = 0
var error = 0
var selected = null
var rpMode = false

var filetypes = {}
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
var dpExclusive = {
	advancements: 0,
	loot_tables: 0,
	recipes: 0,
	predicates: 0,
	dimension: 0,
	dimension_type: 0,
	worldgen: 0,
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
	}
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
			(rpMode && (ext == "png" || ext == "icns" || ext == "txt" || ext == "ogg" || ext == "fsh" || ext == "vsh"))
		) {
			if (!filetypes[ext]) filetypes[ext] = 1
			else filetypes[ext]++
		} else continue

		if (ext == "mcfunction" || ext == "mcmeta") {
			files++

			function processFile(result) {
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
				} else if (ext == "mcmeta") {
					if (entry.name == "pack.mcmeta") {
						try {
							packFiles.push(JSON.parse(result))
						} catch (e) {
							console.warn("Could not parse pack.mcmeta: " + filePath, e)
							error++
						}
					}
				}
			}

			if (entry.content) processFile(entry.content)
			else {
				const reader = new FileReader()
				reader.readAsText(entry)

				reader.onload = function() {
					processFile(reader.result)
				}
				reader.onerror = function(e) {
					console.warn("Could not read file: " + filePath, e)
					error++
				}
			}
		} else if (ext == "json") {
			if (filePath.includes("/advancements/")) dpExclusive.advancements++
			else if (filePath.includes("/loot_tables/")) dpExclusive.loot_tables++
			else if (filePath.includes("/recipes/")) dpExclusive.recipes++
			else if (filePath.includes("/predicates/")) dpExclusive.predicates++
			else if (filePath.includes("/dimension/")) dpExclusive.dimension++
			else if (filePath.includes("/dimension_type/")) dpExclusive.dimension_type++
			else if (filePath.includes("/worldgen/")) dpExclusive.worldgen++

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
		}
	}
}

async function mainScan() {
	if (interval) clearInterval(interval)
	document.getElementById("result").innerHTML = ""

	files = 0
	done = 0
	error = 0
	rpMode = document.getElementById("radiorp").checked

	filetypes = {}
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
	dpExclusive = {
		advancements: 0,
		loot_tables: 0,
		recipes: 0,
		predicates: 0,
		dimension: 0,
		dimension_type: 0,
		worldgen: 0,
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
		}
	}

	processEntries(selected)

	interval = setInterval(() => {
		document.getElementById("progress").innerText = Math.round(done / files * 100) + "% scanned" + (error > 0 ? " - " + error + " errors" : "")
		if (done + error == files) {
			clearInterval(interval)
			document.getElementById("resultButtons").hidden = false
			if (error == 0) document.getElementById("progress").innerText = ""
			if (Object.values(filetypes).reduce((a, b) => a + b) == 0) document.getElementById("progress").innerHTML = "No " + (rpMode ? "resource" : "data") + "pack files found!"

			var html =
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
				(!rpMode && Object.keys(commands).length > 0 ?
					"<strong>Total amount of commands: " + localize(Object.keys(commands).reduce((a, b) => a + commands[b], 0)) + "</strong><br>" +
					"<span class='indented'>Unique commands: " + localize(Object.keys(commands).length) + "</span><br>" +
					(comments > 0 ? "<span class='indented'>Comments: " + localize(comments) + "</span><br>" : "")
				: "") +
				(empty > 0 ? "<span class='indented'>Empty lines: " + localize(empty) + "</span><br>" : "") +
				"<strong>Pack file types found:</strong><br>" +
				Object.keys(filetypes).sort((a, b) => filetypes[b] - filetypes[a]).map(type => "<span class='indented'>." + type + ": " + localize(filetypes[type]) + "</span><br>").join("") +
				(Object.values(selectors).reduce((a, b) => a + b) != 0 ? "<strong>Selectors used:</strong><br>" : "") +
				Object.keys(selectors).filter(i => selectors[i] > 0).sort((a, b) => selectors[b] - selectors[a])
					.map(type => "<span class='indented'>@" + type + ": " + localize(selectors[type]) + "</span><br>").join("") +

				(!rpMode && Object.values(dpExclusive).reduce((a, b) => a + b) != 0 ? "<br><strong>Datapack features used:</strong><br>" : "") +
				Object.keys(dpExclusive).filter(i => !isNaN(dpExclusive[i]) && dpExclusive[i] > 0).sort((a, b) => dpExclusive[b] - dpExclusive[a])
					.map(type => "<span class='indented'>" + type + ": " + localize(dpExclusive[type]) + "</span><br>").join("") +
				(!rpMode && Object.values(dpExclusive.tags).reduce((a, b) => a + b) != 0 ? "<strong>Tags used:</strong><br>" : "") +
				Object.keys(dpExclusive.tags).filter(i => dpExclusive.tags[i] > 0).sort((a, b) => dpExclusive.tags[b] - dpExclusive.tags[a])
					.map(type => "<span class='indented'>" + type + ": " + localize(dpExclusive.tags[type]) + "</span><br>").join("")

			html += "<br>"
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
		for await (const file of Object.values(zip.files)) {
			selected.push({
				name: file.name,
				content: await file.async("text")
			})
		}
		mainScan()
	})
}
