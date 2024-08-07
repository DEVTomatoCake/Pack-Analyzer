// "load" code modified from https://github.com/DEVTomatoCake/dashboard/blob/700b21999a671f4e9c32ba4a1a35f94156db11d4/assets/js/script.js#L16-L31

const requestVersions = async () => {
	const res = await fetch("https://raw.githubusercontent.com/misode/mcmeta/summary/versions/data.json", {
		headers: {
			Accept: "application/json",
			"User-Agent": "DEVTomatoCake/Pack-Analyzer"
		}
	})
	const json = await res.json()

	localStorage.setItem("mcVersions", JSON.stringify(json.map(ver => ({
		name: ver.id,
		datapack_version: ver.data_pack_version,
		resourcepack_version: ver.resource_pack_version
	}))))
	localStorage.setItem("mcVersionsDate", Date.now())
}
if (!localStorage.getItem("mcVersions") || Date.now() - localStorage.getItem("mcVersionsDate") > 1000 * 60 * 60 * 4) requestVersions()

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
let cmdsBehindMacros = {}
let cmdsBehindReturn = {}
let comments = 0
let empty = 0
let emptyFiles = []
let dpExclusive = {
	folders: {
		advancement: 0,
		advancements: 0, // Before 1.21
		banner_pattern: 0,
		chat_type: 0,
		damage_type: 0,
		datapacks: 0,
		dimension: 0,
		dimension_type: 0,
		enchantment: 0,
		enchantment_provider: 0,
		jukebox_song: 0,
		item_modifiers: 0,
		loot_table: 0,
		loot_tables: 0, // Before 1.21
		painting_variant: 0,
		predicate: 0,
		predicates: 0, // Before 1.21
		recipe: 0,
		recipes: 0, // Before 1.21
		structure: 0,
		structures: 0, // Before 1.21
		tags: 0,
		trim_material: 0,
		trim_pattern: 0,
		wolf_variant: 0,
		worldgen: 0
	},
	tags: {
		banner_pattern: 0,
		block: 0,
		blocks: 0, // Before 1.21
		cat_variant: 0,
		damage_type: 0,
		damage_types: 0, // Before 1.21
		enchantment: 0,
		entity_type: 0,
		entity_types: 0, // Before 1.21
		fluid: 0,
		fluids: 0, // Before 1.21
		function: 0,
		functions: 0, // Before 1.21
		game_event: 0,
		game_events: 0, // Before 1.21
		instrument: 0,
		item: 0,
		items: 0, // Before 1.21
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
	functions: ["#minecraft:load", "#minecraft:tick"],
	functionCalls: [{target: "#minecraft:load"}, {target: "#minecraft:tick"}],
	attributesAdded: [],
	attributesRemoved: []
}
let rpExclusive = {
	atlases: 0,
	blockstates: 0,
	font: 0,
	lang: 0,
	models: 0,
	particles: 0,
	resourcepacks: 0,
	shaders: 0,
	sounds: 0,
	texts: 0,
	textures: 0
}

const encode = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;")
const localize = str => typeof str == "number" ? str.toLocaleString() : encode(str) + " (Please report if you see this)"

const createImage = () => {
	const canvas = document.getElementById("shareImage")
	canvas.style.display = "block"
	const ctx = canvas.getContext("2d")
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	ctx.fillStyle = "white"
	ctx.fillRect(0, 0, canvas.width, canvas.height)

	const drawing = new Image()
	drawing.src = "./assets/images/generated_background.png"
	drawing.onload = () => {
		ctx.globalAlpha = 0.3
		ctx.drawImage(drawing, 0, 0)
		ctx.globalAlpha = 1

		let x = 20
		let y = 1
		const lineHeight = 21
		const maxWidth = 400
		ctx.font = (lineHeight - 1) + "px Arial"
		ctx.fillStyle = "black"

		if (packFiles.length > 0) {
			ctx.fillText(packFiles.length + " " + (rpMode ? "Resource" : "Data") + " pack" + (packFiles.length == 1 ? "" : "s") + " found", x, y++ * lineHeight, maxWidth)
			packFiles.forEach(pack => {
				if (pack.features?.enabled?.length > 0) {
					ctx.fillText("Selected internal features:", x + 30, y++ * lineHeight, maxWidth)
					pack.features.enabled.forEach(feature => ctx.fillText(feature, x + 60, y++ * lineHeight, maxWidth))
				}
				if (pack.filter?.block?.length > 0) {
					ctx.fillText("Pack filters:", x + 60, y++ * lineHeight, maxWidth)
					pack.filter.block.forEach(filter => {
						if (filter.namespace) ctx.fillText("Namespace: " + filter.namespace, x + 90, y++ * lineHeight, maxWidth)
						if (filter.path) ctx.fillText("Path: " + filter.path, x + 90, y++ * lineHeight, maxWidth)
					})
				}
			})
		}
		if (packFiles.length == 0 && (filetypes.fsh || filetypes.vsh || filetypes.xcf || filetypes.glsl)) ctx.fillText("Shader found:", x, y++ * lineHeight, maxWidth)
		if (Object.keys(commands).length > 0) {
			ctx.fillText("Total amount of commands: " + localize(Object.keys(commands).reduce((a, b) => a + commands[b], 0)), x, y++ * lineHeight, maxWidth)
			ctx.fillText("Unique commands: " + localize(Object.keys(commands).length), x + 30, y++ * lineHeight, maxWidth)
		}
		if (comments > 0) ctx.fillText("Comments: " + localize(comments), x + 30, y++ * lineHeight, maxWidth)
		if (empty > 0) ctx.fillText("Empty lines: " + localize(empty), x + 30, y++ * lineHeight, maxWidth)
		ctx.fillText((Object.keys(filetypes).length > 2 ? "Top 3 p" : "P") + "ack file types found:", x, y++ * lineHeight, maxWidth)
		Object.keys(filetypes).sort((a, b) => filetypes[b] - filetypes[a]).slice(0, 3).forEach(type => ctx.fillText("." + type + ": " + localize(filetypes[type]), x + 30, y++ * lineHeight, maxWidth))

		if (dpExclusive.scoreboards > 0) ctx.fillText("Scoreboards created: " + localize(dpExclusive.scoreboards), x, y++ * lineHeight, maxWidth)
		if (!rpMode && Object.values(dpExclusive.selectors).reduce((a, b) => a + b) != 0) {
			ctx.fillText((Object.keys(dpExclusive.selectors).filter(i => dpExclusive.selectors[i] > 0).length > 2 ? "Top 3 s" : "S") + "electors used:", x, y++ * lineHeight, maxWidth)
			Object.keys(dpExclusive.selectors).filter(i => dpExclusive.selectors[i] > 0).sort((a, b) => dpExclusive.selectors[b] - dpExclusive.selectors[a]).slice(0, 3)
				.forEach(type => ctx.fillText("@" + type + ": " + localize(dpExclusive.selectors[type]), x + 30, y++ * lineHeight, maxWidth))
		}
		if (!rpMode && Object.values(dpExclusive.folders).reduce((a, b) => a + b) != 0) {
			ctx.fillText("Data pack features used:", x, y++ * lineHeight, maxWidth)
			Object.keys(dpExclusive.folders).filter(i => dpExclusive.folders[i] > 0).sort((a, b) => dpExclusive.folders[b] - dpExclusive.folders[a])
				.forEach(type => ctx.fillText(type + ": " + localize(dpExclusive.folders[type]), x + 30, y++ * lineHeight, maxWidth))
		}
		if (rpMode && Object.values(rpExclusive).reduce((a, b) => a + b) != 0) {
			ctx.fillText("Resource pack features used:", x, y++ * lineHeight, maxWidth)
			Object.keys(rpExclusive).filter(i => !isNaN(i) && rpExclusive[i] > 0).sort((a, b) => rpExclusive[b] - rpExclusive[a])
				.forEach(type => ctx.fillText(type + ": " + localize(rpExclusive[type]), x + 30, y++ * lineHeight, maxWidth))
		}

		x = 450
		y = 3
		ctx.font = "28px Arial"
		ctx.fillText((Object.keys(commands).length > 5 ? "Top c" : "C") + "ommands", x, 40, maxWidth)
		ctx.font = "20px Arial"

		commands = Object.fromEntries(Object.entries(commands).sort(([, a], [, b]) => b - a))
		Object.keys(commands).slice(0, 5).forEach(cmd => {
			ctx.fillText(cmd + ": " + localize(commands[cmd]), x, y++ * lineHeight, maxWidth)
			if (cmdsBehindExecute[cmd]) ctx.fillText("Behind execute: " + localize(cmdsBehindExecute[cmd]), x + 30, y++ * lineHeight, maxWidth)
			if (cmdsBehindMacros[cmd]) ctx.fillText("Behind macro: " + localize(cmdsBehindMacros[cmd]), x + (cmdsBehindExecute[cmd] ? 90 : 30), y++ * lineHeight, maxWidth)
		})
	}
}

const share = async type => {
	let content = ""
	if (type == "txt") content = document.getElementById("result").innerText
	else if (type == "json" || type == "link") {
		content = JSON.stringify({
			files,
			done,
			error,
			rpMode,

			filetypes,
			filetypesOther,
			packFiles,
			commands,
			cmdsBehindExecute,
			cmdsBehindMacros,
			cmdsBehindReturn,
			comments,
			empty,
			emptyFiles,
			dpExclusive,
			rpExclusive
		}, null, type == "json" ? "\t" : void 0)

		if (type == "link") {
			const name = Math.random().toString(36).slice(8)

			const res = await fetch("https://sh0rt.zip", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Accept: "application/json",
					"User-Agent": "TomatoCake Pack-Analyzer"
				},
				body: JSON.stringify({
					name,
					date: Date.now() + 1000 * 60 * 60 * 24 * 30,
					url: (location.protocol == "https:" ? location.href : "https://pack-analyzer.pages.dev/") + "?data=" + encodeURIComponent(content)
				})
			})

			const json = await res.json()
			if (res.ok) {
				document.getElementById("share-link").href = encode(json.uri)
				document.getElementById("share-link").innerText = json.uri
				document.getElementById("share-img").src = "https://sh0rt.zip/qr/" + name
				document.getElementById("shareDialog").showModal()
			} else alert("Couldn't create link: " + json.error)
			return
		}
	} else if (type == "png") return createImage()

	const download = document.createElement("a")
	download.download = "export." + type
	download.href = "data:application/" + type + "," + encodeURIComponent(content)
	download.click()
}

const processFile = async (filePath = "", name = "", loadContentCallback = () => {}) => {
	const ext = name.split(".").pop()
	if (
		ext == "mcmeta" || ext == "json" ||
		(!rpMode && (ext == "mcfunction" || ext == "nbt")) ||
		(rpMode && (ext == "png" || ext == "icns" || ext == "txt" || ext == "ogg" || ext == "fsh" || ext == "vsh" || ext == "glsl" || ext == "lang" || ext == "properties" || ext == "inc" || ext == "xcf"))
	) {
		if (filetypes[ext]) filetypes[ext]++
		else filetypes[ext] = 1
	} else {
		if (filetypesOther[(name.includes(".") ? "." : "") + ext]) filetypesOther[(name.includes(".") ? "." : "") + ext]++
		else filetypesOther[(name.includes(".") ? "." : "") + ext] = 1
	}

	if (
		ext == "mcfunction" || ext == "mcmeta" || (!rpMode && ext == "json" && (filePath.includes("/advancements/") || filePath.includes("/tags/functions/"))) ||
		ext == "fsh" || ext == "vsh" || ext == "glsl" || name.endsWith("/pack.png")
	) {
		files++

		const processContent = result => {
			done++
			if (result.trim() == "") return emptyFiles.push(filePath)

			if (!rpMode && ext == "mcfunction") {
				const fileLocation = /data\/([-a-z0-9_.]+)\/functions\/([-a-z0-9_./]+)\.mcfunction/i.exec(filePath)
				if (fileLocation && !dpExclusive.functions.includes(fileLocation[1] + ":" + fileLocation[2])) dpExclusive.functions.push(fileLocation[1] + ":" + fileLocation[2])

				for (let line of result.split("\n")) {
					line = line.trim()
					if (line.startsWith("#")) comments++
					if (line == "") empty++
					if (line.startsWith("#") || line == "") continue
					const splitted = line.split(" ")

					let cmd = splitted[0]
					if (cmd.startsWith("$")) {
						cmd = cmd.slice(1)
						if (cmdsBehindMacros[cmd]) cmdsBehindMacros[cmd]++
						else cmdsBehindMacros[cmd] = 1
					}

					if (commands[cmd]) commands[cmd]++
					else commands[cmd] = 1

					if (cmd == "execute") {
						const matches = / run ([a-z_:]{2,})/g.exec(line)
						if (matches) matches.forEach(match => {
							const cmdBehind = match.replace("run ", "").trim()

							if (cmdsBehindExecute[cmdBehind]) cmdsBehindExecute[cmdBehind]++
							else cmdsBehindExecute[cmdBehind] = 1
							if (commands[cmdBehind]) commands[cmdBehind]++
							else commands[cmdBehind] = 1

							if (cmdBehind == "return") {
								const returnCmd = / run return run ([a-z_:]{2,})/g.exec(line)
								if (returnCmd && returnCmd[1]) {
									if (cmdsBehindReturn[returnCmd[1]]) cmdsBehindReturn[returnCmd[1]]++
									else cmdsBehindReturn[returnCmd[1]] = 1
								}
							}
						})
					} else if (cmd == "scoreboard" && /scoreboard objectives add \w+ \w+( .+)?$/.test(line)) dpExclusive.scoreboards++
					else if (cmd == "return") {
						const returnCmd = / run return run ([a-z_:]{2,})/g.exec(line)
						if (returnCmd && returnCmd[1]) {
							if (cmdsBehindReturn[returnCmd[1]]) cmdsBehindReturn[returnCmd[1]]++
							else cmdsBehindReturn[returnCmd[1]] = 1
						}
					} else if (cmd == "attribute") {
						const matchesAdd = /^attribute \S+ [\w.]+ modifier add ([-\w]+) /.exec(line)
						if (matchesAdd && matchesAdd[1]) {
							if (!dpExclusive.attributesAdded.includes(matchesAdd[1])) dpExclusive.attributesAdded.push(matchesAdd[1])
						} else {
							const matchesRemove = /^attribute \S+ [\w.]+ modifier remove ([-\w]+)$/.exec(line)
							if (matchesRemove && matchesRemove[1] && !dpExclusive.attributesRemoved.includes(matchesRemove[1])) dpExclusive.attributesRemoved.push(matchesRemove[1])
						}
					}

					if (fileLocation && (cmd == "function" || line.includes(" function ") || line.includes("/function "))) {
						const func = /function ((#?[-a-z0-9_.]+):)?([-a-z0-9_./]+)/i.exec(line)
						if (func && func[3]) dpExclusive.functionCalls.push({
							source: fileLocation[1] + ":" + fileLocation[2],
							target: (func[2] || "minecraft") + ":" + func[3]
						})
					}

					splitted.forEach(arg => {
						if (arg.startsWith("@")) {
							const type = arg.charAt(1)
							if (type == "a") dpExclusive.selectors.a++
							else if (type == "e") dpExclusive.selectors.e++
							else if (type == "p") dpExclusive.selectors.p++
							else if (type == "r") dpExclusive.selectors.r++
							else if (type == "s") dpExclusive.selectors.s++
						}
					})
				}
			} else if (ext == "mcmeta") {
				if (name == "pack.mcmeta") {
					try {
						packFiles.push(JSON.parse(result))
					} catch (e) {
						console.warn("Could not parse pack.mcmeta: " + filePath, e)
						error++
					}
				}
			} else if (name.endsWith("pack.png") && !result.includes(">")) packImages.push(result)
			else if (rpMode && (ext == "fsh" || ext == "vsh" || ext == "glsl")) {
				for (let line of result.split("\n")) {
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
					const fileLocation = /data\/([-a-z0-9_.]+)\/advancements\/([-a-z0-9_./]+)\.json/i.exec(filePath)

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
					const fileLocation = /data\/([-a-z0-9_.]+)\/tags\/functions\/([-a-z0-9_./]+)\.json/i.exec(filePath)
					if (fileLocation && !dpExclusive.functions.includes("#" + fileLocation[1] + ":" + fileLocation[2])) dpExclusive.functions.push("#" + fileLocation[1] + ":" + fileLocation[2])

					try {
						const parsed = JSON.parse(result)
						if (parsed.values) parsed.values.forEach(func => {
							if (typeof func == "object") {
								if (func.required === false) return
								func = func.id
							}

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

		await loadContentCallback(processContent, ext)
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

const processEntries = async entries => {
	for await (const entry of entries) {
		const filePath = entry.webkitRelativePath || entry.name
		if (filePath.includes("/.git/") || filePath.includes("/.svn/")) continue
		if (entry.kind == "directory") {
			processEntries(entry)
			continue
		}
		if (entry.name.endsWith("/") && entry.content == "") continue

		processFile(filePath, entry.name, async (processContent, ext) => {
			if ("content" in entry) processContent(entry.content)
			else {
				const reader = new FileReader()
				if (ext == "png") reader.readAsDataURL(entry)
				else entry.text().then(processContent)

				reader.onload = () => {
					processContent(reader.result)
				}
				reader.onerror = e => {
					console.warn("Could not read file: " + filePath, e)
					error++
				}
			}
		})
	}
}

const mainScan = async (hasData = false) => {
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
		cmdsBehindMacros = {}
		cmdsBehindReturn = {}
		comments = 0
		empty = 0
		emptyFiles = []
		dpExclusive = {
			folders: {
				advancement: 0,
				advancements: 0, // Before 1.21
				banner_pattern: 0,
				chat_type: 0,
				damage_type: 0,
				datapacks: 0,
				dimension: 0,
				dimension_type: 0,
				enchantment: 0,
				enchantment_provider: 0,
				jukebox_song: 0,
				item_modifiers: 0,
				loot_table: 0,
				loot_tables: 0, // Before 1.21
				painting_variant: 0,
				predicate: 0,
				predicates: 0, // Before 1.21
				recipe: 0,
				recipes: 0, // Before 1.21
				structure: 0,
				structures: 0, // Before 1.21
				tags: 0,
				trim_material: 0,
				trim_pattern: 0,
				wolf_variant: 0,
				worldgen: 0
			},
			tags: {
				banner_pattern: 0,
				block: 0,
				blocks: 0, // Before 1.21
				cat_variant: 0,
				damage_type: 0,
				damage_types: 0, // Before 1.21
				enchantment: 0,
				entity_type: 0,
				entity_types: 0, // Before 1.21
				fluid: 0,
				fluids: 0, // Before 1.21
				function: 0,
				functions: 0, // Before 1.21
				game_event: 0,
				game_events: 0, // Before 1.21
				instrument: 0,
				item: 0,
				items: 0, // Before 1.21
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
			functions: ["#minecraft:load", "#minecraft:tick"],
			functionCalls: [{target: "#minecraft:load"}, {target: "#minecraft:tick"}],
			attributesAdded: [],
			attributesRemoved: []
		}
		rpExclusive = {
			atlases: 0,
			blockstates: 0,
			font: 0,
			lang: 0,
			models: 0,
			particles: 0,
			resourcepacks: 0,
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
			document.getElementById("resultButtons").removeAttribute("hidden")
			if (error == 0) document.getElementById("progress").innerText = ""
			if (Object.values(filetypes).reduce((a, b) => a + b) == 0) document.getElementById("progress").innerHTML = "No " + (rpMode ? "resource" : "data") + " pack files found!"

			const uncalledFunctions = dpExclusive.functions.filter(funcName => !dpExclusive.functionCalls.some(func => func.target == funcName))
			const missingFunctions = [...new Set(dpExclusive.functionCalls.filter(func => !dpExclusive.functions.includes(func.target)).map(func => func.target))]

			const unaddedAttributes = dpExclusive.attributesAdded.filter(attr => !dpExclusive.attributesRemoved.includes(attr))
			const unremovedAttributes = dpExclusive.attributesRemoved.filter(attr => !dpExclusive.attributesAdded.includes(attr))

			const versions = localStorage.getItem("mcVersions") ? JSON.parse(localStorage.getItem("mcVersions")) : []
			let html =
				(packImages.length > 0 ? "<div style='display: flex;'>" + packImages.map(img => "<img src='" + img + "' width='64' height='64'>") + "</div>" : "") +
				(packFiles.length > 0 ? "<strong>" + (rpMode ? "Resource" : "Data") + " pack" + (packFiles.length == 1 ? "" : "s") + " found:</strong><br>" +
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

						let description = ""
						if (pack.pack && pack.pack.description) {
							if (typeof pack.pack.description == "object") {
								const desc = Array.isArray(pack.pack.description) ? pack.pack.description : [pack.pack.description]
								desc.forEach(d => {
									if (d.text || d.translation) description += d.text || d.translation
								})
							} else description = pack.pack.description
						} else description = "<i>No description</i>"

						return "<span class='indented'>" + encode(description.replace(/§[0-9a-flmnor]/g, "")) +
							(versions.some(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == pack.pack.pack_format) ?
								"<br><span class='indented2'>Supported versions: " +
								encode(versions.findLast(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == oldestFormat)?.name || "?") +
								" - " +
								encode(versions.find(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == newestFormat)?.name || "?") +
								"</span>"
							: "") +
							"</span>" +
							(pack.features?.enabled?.length > 0 ?
								"<br><span class='indented2'>Selected internal features: " +
								pack.features.enabled.map(feature => "<code>" + encode(feature) + "</code>").join(", ") + "</span>"
							: "") +
							(pack.filter?.block?.length > 0 ? "<br><span class='indented2'>Pack filters:</span><br><small>" + pack.filter.block.map(filter =>
								"<span class='indented3'>" +
								(filter.namespace ? "Namespace: <code>" + encode(filter.namespace) + "</code>" : "") +
								(filter.namespace && filter.path ? ", " : "") +
								(filter.path ? "Path: <code>" + encode(filter.path) + "</code>" : "") +
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
				Object.keys(filetypes).sort((a, b) => filetypes[b] - filetypes[a]).map(type => "<span class='indented'>." + encode(type) + ": " + localize(filetypes[type]) + "</span><br>").join("") +
				(Object.keys(filetypesOther).length > 0 ?
					"<details><summary>" +
					"<strong>Non-pack file types found:</strong></summary>" +
					Object.keys(filetypesOther).sort((a, b) => filetypesOther[b] - filetypesOther[a])
						.map(type => "<span class='indented'>" + encode(type) + ": " + localize(filetypesOther[type]) + "</span><br>").join("") +
					"</details><br>"
				: "") +
				(uncalledFunctions.length > 0 ?
					"<strong>Uncalled functions:</strong><br>" +
					uncalledFunctions.map(func => "<span class='indented'>" + encode(func) + "</span><br>").join("") +
					"<br>"
				: "") +
				(missingFunctions.length > 0 ?
					"<strong>Missing functions:</strong><br>" +
					missingFunctions.map(func => "<span class='indented'>" + encode(func) + "</span><br>").join("") +
					"<br>"
				: "") +
				(unaddedAttributes.length > 0 ?
					"<strong>Attribute UUIDs added but not removed (using /attribute):</strong><br>" +
					unaddedAttributes.map(attr => "<span class='indented'>" + encode(attr) + "</span><br>").join("") +
					"<br>"
				: "") +
				(unremovedAttributes.length > 0 ?
					"<strong>Attribute UUIDs removed but not added (using /attribute):</strong><br>" +
					unremovedAttributes.map(attr => "<span class='indented'>" + encode(attr) + "</span><br>").join("") +
					"<br>"
				: "") +
				(emptyFiles.length > 0 ?
					"<strong>Empty files:</strong><br>" +
					emptyFiles.map(func => "<span class='indented'>" + encode(func) + "</span><br>").join("") +
					"<br>"
				: "") +

				(dpExclusive.scoreboards > 0 ? "<strong>Scoreboards created: " + localize(dpExclusive.scoreboards) + "</strong><br>" : "") +
				(!rpMode && Object.values(dpExclusive.selectors).reduce((a, b) => a + b) != 0 ? "<strong>Selectors used:</strong><br>" : "") +
				Object.keys(dpExclusive.selectors).filter(i => dpExclusive.selectors[i] > 0).sort((a, b) => dpExclusive.selectors[b] - dpExclusive.selectors[a])
					.map(type => "<span class='indented'>@" + encode(type) + ": " + localize(dpExclusive.selectors[type]) + "</span><br>").join("") +
				(!rpMode && Object.values(dpExclusive.folders).reduce((a, b) => a + b) != 0 ? "<strong>Data pack features used:</strong><br>" : "") +
				Object.keys(dpExclusive.folders).filter(i => dpExclusive.folders[i] > 0).sort((a, b) => dpExclusive.folders[b] - dpExclusive.folders[a])
					.map(type => "<span class='indented'>" + encode(type) + ": " + localize(dpExclusive.folders[type]) + "</span><br>").join("") +
				(!rpMode && Object.values(dpExclusive.tags).reduce((a, b) => a + b) != 0 ? "<strong>Tags used:</strong><br>" : "") +
				Object.keys(dpExclusive.tags).filter(i => dpExclusive.tags[i] > 0).sort((a, b) => dpExclusive.tags[b] - dpExclusive.tags[a])
					.map(type => "<span class='indented'>" + encode(type) + ": " + localize(dpExclusive.tags[type]) + "</span><br>").join("") +

				(rpMode && Object.values(rpExclusive).reduce((a, b) => a + b) != 0 ? "<br><strong>Resource pack features used:</strong><br>" : "") +
				Object.keys(rpExclusive).filter(i => rpExclusive[i] > 0).sort((a, b) => rpExclusive[b] - rpExclusive[a])
					.map(type => "<span class='indented'>" + encode(type) + ": " + localize(rpExclusive[type]) + "</span><br>").join("")

			html += "<br>"
			commands = Object.fromEntries(Object.entries(commands).sort(([, a], [, b]) => b - a))
			Object.keys(commands).forEach(cmd => {
				html += cmd + ": " + localize(commands[cmd]) + "<br>"
				if (cmdsBehindExecute[cmd]) html += "<span class='indented'>Behind execute: " + localize(cmdsBehindExecute[cmd]) +
					(cmd == "execute" ? "⚠️ <small>(<code>... run execute ...</code> equals <code>... ...</code>)</small>" : "") + "</span><br>"
				if (cmdsBehindMacros[cmd]) html += "<span class='indented'>Behind macro: " + localize(cmdsBehindMacros[cmd]) + "</span><br>"
				if (cmdsBehindReturn[cmd]) html += "<span class='indented'>Behind return: " + localize(cmdsBehindReturn[cmd]) + "</span><br>"
			})
			document.getElementById("result").innerHTML = html
		}
	}, 100)
}

const handleZip = file => {
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

window.addEventListener("DOMContentLoaded", () => {
	if (localStorage.getItem("theme") == "light") document.body.classList.add("light")
	else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
		document.body.classList.add("light")
		localStorage.setItem("theme", "light")
	}

	const params = new URLSearchParams(location.search)
	if (params.has("data")) {
		const parsed = JSON.parse(params.get("data"))
		files = parsed.files
		done = parsed.done
		error = parsed.error
		rpMode = parsed.rpMode
		document.getElementById("radiorp").checked = rpMode

		filetypes = parsed.filetypes
		packFiles = parsed.packFiles
		commands = parsed.commands
		cmdsBehindExecute = parsed.cmdsBehindExecute
		cmdsBehindMacros = parsed.cmdsBehindMacros
		cmdsBehindReturn = parsed.cmdsBehindReturn
		comments = parsed.comments
		empty = parsed.empty
		emptyFiles = parsed.emptyFiles
		dpExclusive = parsed.dpExclusive
		rpExclusive = parsed.rpExclusive

		mainScan(true)
	}

	document.getElementById("clear-results").addEventListener("click", () => {
		document.getElementById("progress").innerText = ""
		document.getElementById("result").innerHTML = ""
		document.getElementById("resultButtons").setAttribute("hidden", "")
		document.getElementById("shareImage").style.display = "none"
		if (interval) clearInterval(interval)
	})
	document.getElementById("toggle-theme").addEventListener("click", () => {
		localStorage.setItem("theme", document.body.classList.toggle("light") ? "light" : "dark")
	})

	document.getElementById("select-folder").addEventListener("click", () => {
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
	})
	document.getElementById("select-zip").addEventListener("click", () => {
		if (interval) clearInterval(interval)

		const input = document.createElement("input")
		input.type = "file"
		input.accept = ".zip"
		input.onchange = e => handleZip(e.target.files[0])

		if ("showPicker" in HTMLInputElement.prototype) input.showPicker()
		else input.click()
	})

	document.getElementById("about-button").addEventListener("click", () => {
		document.getElementById("aboutDialog").showModal()
	})
	for (const elem of document.querySelectorAll("dialog .close")) {
		elem.addEventListener("click", () => elem.closest("dialog").close())
		elem.addEventListener("keydown", e => {
			if (e.key == "Enter") elem.closest("dialog").close()
		})
	}

	for (const elem of document.getElementsByClassName("share")) elem.addEventListener("click", () => share(elem.dataset.type))

	if (location.protocol == "https:" && "serviceWorker" in navigator) navigator.serviceWorker.register("/serviceworker.js")
})

window.addEventListener("dragover", event => {
	event.stopPropagation()
	event.preventDefault()
	event.dataTransfer.dropEffect = "copy"
})
window.addEventListener("drop", async event => {
	event.stopPropagation()
	event.preventDefault()
	const fileList = event.dataTransfer.files
	if (fileList.length == 0) return

	const dropElement = document.createElement("div")
	dropElement.id = "drop"
	dropElement.style.left = event.clientX + "px"
	dropElement.style.top = event.clientY + "px"
	document.body.appendChild(dropElement)
	dropElement.addEventListener("animationend", () => dropElement.remove())

	if (fileList[0].name.endsWith(".zip")) handleZip(fileList[0])
	else {
		selected = []
		for await (const file of Object.values(fileList)) {
			try {
				selected.push({
					name: file.name,
					content: await file.text()
				})
			} catch (e) {
				console.error(e)
				alert("Couldn't read file: " + file.name + "\nYour browser may not support reading files/folders by dropping them on a website, try using the buttons above.")
			}
		}
		mainScan()
	}
})
window.addEventListener("paste", async event => {
	event.preventDefault()
	if (event.clipboardData.files.length == 0) {
		if (event.clipboardData.items.length > 0) event.clipboardData.items[0].getAsString(str => {
			selected = [{name: "clipboard.mcfunction", content: str}]
			mainScan()
		})
		return
	}

	const fileList = event.clipboardData.files
	if (fileList[0].name.endsWith(".zip")) handleZip(fileList[0])
	else {
		selected = []
		for await (const file of Object.values(fileList)) {
			try {
				selected.push({
					name: file.name,
					content: await file.text()
				})
			} catch (e) {
				console.error(e)
				alert("Couldn't read file: " + file.name + "\nYour browser may not support reading files/folders from the clipboard, try using the buttons above.")
			}
		}
		mainScan()
	}
})
