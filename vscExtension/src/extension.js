"use strict"

const vscode = require("vscode")

let outputChannel
const log = message => outputChannel.appendLine(message)
let treeView

let versions = []
const requestVersions = async () => {
	const res = await fetch("https://raw.githubusercontent.com/misode/mcmeta/summary/versions/data.json", {
		headers: {
			Accept: "application/json",
			"User-Agent": "DEVTomatoCake/Pack-Analyzer"
		}
	})
	const json = await res.json()

	versions = json.map(ver => ({
		name: ver.id,
		datapack_version: ver.data_pack_version,
		resourcepack_version: ver.resource_pack_version
	}))
}
requestVersions()

let interval
let files = 0
let done = 0
let error = 0
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
		advancements: 0,
		banner_pattern: 0,
		chat_type: 0,
		damage_type: 0,
		datapacks: 0,
		dimension: 0,
		dimension_type: 0,
		item_modifiers: 0,
		loot_tables: 0,
		predicates: 0,
		recipes: 0,
		structures: 0,
		tags: 0,
		trim_material: 0,
		trim_pattern: 0,
		wolf_variant: 0,
		worldgen: 0
	},
	tags: {
		banner_pattern: 0,
		blocks: 0,
		cat_variant: 0,
		damage_types: 0,
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
	functions: ["#minecraft:load", "#minecraft:tick"],
	functionCalls: [{target: "#minecraft:load"}, {target: "#minecraft:tick"}]
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

const localize = str => str.toLocaleString()

async function processEntries(entries) {
	for await (const filePath of entries) {
		const name = filePath.split("/").pop()

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
			ext == "fsh" || ext == "vsh" || ext == "glsl" || name.endsWith("pack.png")
		) {
			files++

			const processFile = result => {
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
						} else if (cmd == "return") {
							const returnCmd = / run return run ([a-z_:]{2,})/g.exec(line)
							if (returnCmd && returnCmd[1]) {
								if (cmdsBehindReturn[returnCmd[1]]) cmdsBehindReturn[returnCmd[1]]++
								else cmdsBehindReturn[returnCmd[1]] = 1
							}
						}
						if (fileLocation && (cmd == "function" || line.includes(" function ") || line.includes("/function "))) {
							const func = /function ((#?[-a-z0-9_.]+):)?([-a-z0-9_./]+)/i.exec(line)
							if (func && func[3]) dpExclusive.functionCalls.push({
								source: fileLocation[1] + ":" + fileLocation[2],
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

			const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
			const decoder = new TextDecoder()
			processFile(decoder.decode(content))
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

	log("Successfully processed " + done + " files with " + error + " errors")
}

async function mainScan() {
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

				let description = ""
				if (pack.pack && pack.pack.description) {
					if (typeof pack.pack.description == "object") {
						const desc = Array.isArray(pack.pack.description) ? pack.pack.description : [pack.pack.description]
						desc.forEach(d => {
							if (d.text || d.translation) description += d.text || d.translation
						})
					} else description = pack.pack.description
				} else description = "<i>No description</i>"

				return "<span class='indented'>" + description.replace(/§[0-9a-flmnor]/gi, "") +
					(versions.some(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == pack.pack.pack_format) ?
						"<br><span class='indented2'>Supported versions: " +
						(versions.findLast(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == oldestFormat)?.name || "?") +
						" - " +
						(versions.find(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == newestFormat)?.name || "?") +
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
			"</details><br>"
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
		(emptyFiles.length > 0 ?
			"<strong>Empty files:</strong><br>" +
			emptyFiles.map(func => "<span class='indented'>" + func + "</span><br>").join("") +
			"<br>"
		: "") +

		(dpExclusive.scoreboards > 0 ? "<strong>Scoreboards created: " + localize(dpExclusive.scoreboards) + "</strong><br>" : "") +
		(!rpMode && Object.values(dpExclusive.selectors).reduce((a, b) => a + b) != 0 ? "<strong>Selectors used:</strong><br>" : "") +
		Object.keys(dpExclusive.selectors).filter(i => dpExclusive.selectors[i] > 0).sort((a, b) => dpExclusive.selectors[b] - dpExclusive.selectors[a])
			.map(type => "<span class='indented'>@" + type + ": " + localize(dpExclusive.selectors[type]) + "</span><br>").join("") +
		(!rpMode && Object.values(dpExclusive.folders).reduce((a, b) => a + b) != 0 ? "<strong>Data pack features used:</strong><br>" : "") +
		Object.keys(dpExclusive.folders).filter(i => dpExclusive.folders[i] > 0).sort((a, b) => dpExclusive.folders[b] - dpExclusive.folders[a])
			.map(type => "<span class='indented'>" + type + ": " + localize(dpExclusive.folders[type]) + "</span><br>").join("") +
		(!rpMode && Object.values(dpExclusive.tags).reduce((a, b) => a + b) != 0 ? "<strong>Tags used:</strong><br>" : "") +
		Object.keys(dpExclusive.tags).filter(i => dpExclusive.tags[i] > 0).sort((a, b) => dpExclusive.tags[b] - dpExclusive.tags[a])
			.map(type => "<span class='indented'>" + type + ": " + localize(dpExclusive.tags[type]) + "</span><br>").join("") +

		(rpMode && Object.values(rpExclusive).reduce((a, b) => a + b) != 0 ? "<br><strong>Resource pack features used:</strong><br>" : "") +
		Object.keys(rpExclusive).filter(i => rpExclusive[i] > 0).sort((a, b) => rpExclusive[b] - rpExclusive[a])
			.map(type => "<span class='indented'>" + type + ": " + localize(rpExclusive[type]) + "</span><br>").join("")

	commands = Object.fromEntries(Object.entries(commands).sort(([, a], [, b]) => b - a))
	Object.keys(commands).forEach(cmd => {
		html += cmd + ": " + localize(commands[cmd]) + "<br>"
		if (cmdsBehindExecute[cmd]) html += "<span class='indented'>Behind execute: " + localize(cmdsBehindExecute[cmd]) +
			(cmd == "execute" ? "⚠️ <small>(<code>... run execute ...</code> equals <code>... ...</code>)</small>" : "") + "</span><br>"
		if (cmdsBehindMacros[cmd]) html += "<span class='indented'>Behind macro: " + localize(cmdsBehindMacros[cmd]) + "</span><br>"
		if (cmdsBehindReturn[cmd]) html += "<span class='indented'>Behind return: " + localize(cmdsBehindReturn[cmd]) + "</span><br>"
	})
}

const collapsible = new Set([
	"dpExclusive",
	"rpExclusive",

	"filetypes",
	"filetypesOther",

	"commands",
	"cmdsBehindMacros",
	"cmdsBehindReturn",

	"folders",
	"tags",
	"selectors"
])

class PackAnalyzer {
	constructor() {
		this._onDidChangeTreeData = new vscode.EventEmitter()
		this.onDidChangeTreeData = this._onDidChangeTreeData.event
	}

	refresh() {
		files = 0
		done = 0
		error = 0
		rpMode = false //document.getElementById("radiorp").checked

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
				advancements: 0,
				banner_pattern: 0,
				chat_type: 0,
				damage_type: 0,
				datapacks: 0,
				dimension: 0,
				dimension_type: 0,
				item_modifiers: 0,
				loot_tables: 0,
				predicates: 0,
				recipes: 0,
				structures: 0,
				tags: 0,
				trim_material: 0,
				trim_pattern: 0,
				wolf_variant: 0,
				worldgen: 0
			},
			tags: {
				banner_pattern: 0,
				blocks: 0,
				cat_variant: 0,
				damage_types: 0,
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
			functions: ["#minecraft:load", "#minecraft:tick"],
			functionCalls: [{target: "#minecraft:load"}, {target: "#minecraft:tick"}]
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

		this._onDidChangeTreeData.fire()
	}

	getTreeItem(element) {
		log("getTreeItem: " + JSON.stringify(element))

		let label = element.item
		const treeItem = new vscode.TreeItem(label)

		if (element.item == "files") label = "Scanned files: " + files
		else if (element.item == "error") label = "Scanning errors: " + error
		else if (element.item == "rpMode") label = "Resource pack mode: " + (rpMode ? "enabled" : "disabled")

		else if (element.item == "dpExclusive") label = "Data pack"
		else if (element.parent == "folders") label = element.item + ": " + dpExclusive.folders[element.item]
		else if (element.parent == "tags") label = element.item + ": " + dpExclusive.tags[element.item]
		else if (element.item == "scoreboards") label = "Scoreboards: " + dpExclusive.scoreboards
		else if (element.item == "selectors") label = "Selectors: " + Object.keys(dpExclusive.selectors).length
		else if (element.parent == "selectors") label = "@" + element.item + ": " + dpExclusive.selectors[element.item]

		else if (element.item == "rpExclusive") label = "Resource pack"
		else if (element.parent == "rpExclusive") label = element.item + ": " + rpExclusive[element.item]

		else if (element.item == "filetypes") label = "File types: " + Object.keys(filetypes).length
		else if (element.parent == "filetypes") label = "." + element.item + ": " + filetypes[element.item]
		else if (element.item == "filetypesOther") label = "Non-pack file types: " + Object.keys(filetypesOther).length
		else if (element.parent == "filetypesOther") label = element.item + ": " + filetypesOther[element.item]

		else if (element.item == "commands") label = "Commands: " + Object.keys(commands).length
		else if (element.parent == "commands") {
			label = element.item + ": " + commands[element.item]
			if (cmdsBehindExecute[element.item]) treeItem.description = "(" + cmdsBehindExecute[element.item] + " behind execute)"
		} else if (element.item == "cmdsBehindMacros") label = "Commands behind macros: " + Object.keys(cmdsBehindMacros).length
		else if (element.item == "cmdsBehindReturn") label = "Commands behind return: " + Object.keys(cmdsBehindReturn).length

		else if (element.item == "comments") label = "Comments: " + comments
		else if (element.item == "empty") label = "Empty lines: " + empty
		else if (element.item == "emptyFiles") label = "Empty files: " + emptyFiles.length

		treeItem.label = label
		if (collapsible.has(element.item)) treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed

		return treeItem
	}

	async getChildren(element) {
		log("getChildren: " + JSON.stringify(element))

		if (element) {
			const item = element.item
			if (item == "dpExclusive") return [
				Object.keys(dpExclusive.folders).reduce((a, b) => a + dpExclusive.folders[b], 0) > 0 ? "folders" : void 0,
				Object.keys(dpExclusive.tags).reduce((a, b) => a + dpExclusive.tags[b], 0) > 0 ? "tags" : void 0,
				dpExclusive.scoreboards > 0 ? "scoreboards" : void 0,
				Object.keys(dpExclusive.selectors).reduce((a, b) => a + dpExclusive.selectors[b], 0) > 0 ? "selectors" : void 0,
				"uncalledFunctions",
				"missingFunctions"
			].filter(Boolean).map(child => ({item: child, parent: item}))

			if (item == "folders") return Object.keys(dpExclusive.folders).filter(key => dpExclusive.folders[key] > 0).map(child => ({item: child, parent: item}))
			if (item == "tags") return Object.keys(dpExclusive.tags).filter(key => dpExclusive.tags[key] > 0).map(child => ({item: child, parent: item}))
			if (item == "selectors") return Object.keys(dpExclusive.selectors).filter(key => dpExclusive.selectors[key] > 0).map(child => ({item: child, parent: item}))

			if (item == "rpExclusive") return Object.keys(rpExclusive).filter(key => rpExclusive[key] > 0).map(child => ({item: child, parent: item}))

			if (item == "filetypes") return Object.keys(filetypes).map(child => ({item: child, parent: item}))
			if (item == "filetypesOther") return Object.keys(filetypesOther).map(child => ({item: child, parent: item}))

			if (item == "commands") return Object.keys(commands).map(child => ({item: child, parent: item}))
			if (item == "cmdsBehindMacros") return Object.keys(cmdsBehindMacros).map(child => ({item: child, parent: item}))
			if (item == "cmdsBehindReturn") return Object.keys(cmdsBehindReturn).map(child => ({item: child, parent: item}))
		}

		const fileList = await vscode.workspace.findFiles("**/*")
		log(fileList.length + " files with the following schemes found: " + [...new Set(fileList.map(file => file.scheme))].join(", "))
		await processEntries(fileList.filter(file => !file.path.includes("/.git/") && !file.path.includes("/.svn/") && !file.path.includes("/node_modules/")).map(file => file.path))

		if (files == 0) {
			vscode.window.showWarningMessage("No files found in the workspace!")
			return []
		}
		if (Object.values(filetypes).reduce((a, b) => a + b) == 0) {
			vscode.window.showWarningMessage("No " + (rpMode ? "resource" : "data") + " pack files found in the workspace!")
			return []
		}

		return [
			"files",
			error > 0 ? "error" : void 0,
			"rpMode",

			rpMode ? void 0 : "dpExclusive",
			rpMode ? "rpExclusive" : void 0,

			Object.keys(filetypes).length > 0 ? "filetypes" : void 0,
			Object.keys(filetypesOther).length > 0 ? "filetypesOther" : void 0,

			Object.keys(commands).length > 0 ? "commands" : void 0,
			Object.keys(cmdsBehindMacros).length > 0 ? "cmdsBehindMacros" : void 0,
			Object.keys(cmdsBehindReturn).length > 0 ? "cmdsBehindReturn" : void 0,

			comments > 0 ? "comments" : void 0,
			empty > 0 ? "empty" : void 0,
			emptyFiles > 0 ? "emptyFiles" : void 0
		].filter(Boolean).map(child => ({item: child}))
	}
}

module.exports.activate = context => {
	context.subscriptions.push(
		outputChannel = vscode.window.createOutputChannel("Pack Analyzer")
	)
	log("Loading extension...")

	const packAnalyzer = new PackAnalyzer()
	context.subscriptions.push(
		treeView = vscode.window.registerTreeDataProvider("packAnalyzer", packAnalyzer)
	)
	context.subscriptions.push(
		vscode.commands.registerCommand("packAnalyzer.refresh", () => packAnalyzer.refresh())
	)
}
