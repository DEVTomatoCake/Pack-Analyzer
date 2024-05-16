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

let files = 0
let done = 0
let error = 0
let rpMode = false

let filetypes = {}
let filetypesOther = {}
let packFiles = []
// eslint-disable-next-line sonarjs/no-unused-collection
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
		block: 0,
		blocks: 0, // Before 24w19a
		cat_variant: 0,
		damage_types: 0,
		entity_type: 0,
		entity_types: 0, // Before 24w19a
		fluid: 0,
		fluids: 0, // Before 24w19a
		functions: 0,
		game_event: 0,
		game_events: 0, // Before 24w19a
		instrument: 0,
		item: 0,
		items: 0, // Before 24w19a
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
	shaders: 0,
	sounds: 0,
	texts: 0,
	textures: 0
}

const localize = str => str.toLocaleString()

/* processFile */
async function processEntries(entries) {
	for await (const filePath of entries) {
		const name = filePath.split("/").pop()

		await processFile(filePath, name, async processContent => {
			const content = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath))
			const decoder = new TextDecoder()
			processContent(decoder.decode(content))
		})
	}

	log("Successfully processed " + done + " files with " + error + " errors")
}

async function mainScan() {
	let html =
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

				return (versions.some(ver => (rpMode ? ver.resourcepack_version : ver.datapack_version) == pack.pack.pack_format) ?
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

		"<strong>Pack file types found:</strong><br>" +
		Object.keys(filetypes).sort((a, b) => filetypes[b] - filetypes[a]).map(type => "<span class='indented'>." + type + ": " + localize(filetypes[type]) + "</span><br>").join("") +
		(Object.keys(filetypesOther).length > 0 ?
			"<details><summary>" +
			"<strong>Non-pack file types found:</strong></summary>" +
			Object.keys(filetypesOther).sort((a, b) => filetypesOther[b] - filetypesOther[a]).map(type => "<span class='indented'>" + type + ": " + localize(filetypesOther[type]) + "</span><br>").join("") +
			"</details><br>"
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
	"packs",

	"dpExclusive",
	"rpExclusive",

	"filetypes",
	"filetypesOther",

	"commands",
	"cmdsBehindMacros",
	"cmdsBehindReturn",

	"tags",
	"selectors",

	"uncalledFunctions",
	"missingFunctions"
])

const iconUrl = (icon = "") =>
	vscode.Uri.from({
		scheme: "data",
		path: "image/png;base64," + icon + ""
	})

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
				block: 0,
				blocks: 0, // Before 24w19a
				cat_variant: 0,
				damage_types: 0,
				entity_type: 0,
				entity_types: 0, // Before 24w19a
				fluid: 0,
				fluids: 0, // Before 24w19a
				functions: 0,
				game_event: 0,
				game_events: 0, // Before 24w19a
				instrument: 0,
				item: 0,
				items: 0, // Before 24w19a
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
			shaders: 0,
			sounds: 0,
			texts: 0,
			textures: 0
		}

		this._onDidChangeTreeData.fire()
	}

	getTreeItem(element) {
		log("getTreeItem: " + JSON.stringify(element))

		const treeItem = new vscode.TreeItem(element.item)
		treeItem.iconPath = iconUrl("{DPICON|namespace}")
		if (collapsible.has(element.item)) treeItem.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed

		if (element.item == "files") treeItem.label = "Scanned files: " + localize(files)
		else if (element.item == "error") treeItem.label = "Scanning errors: " + localize(error)
		else if (element.item == "rpMode") treeItem.label = "Resource pack mode: " + (rpMode ? "enabled" : "disabled")

		else if (element.item == "packs") {
			log(JSON.stringify(packFiles))
			treeItem.label = "Packs: " + localize(packFiles.length)
		} else if (element.parent == "packs") {
			log(JSON.stringify(packFiles))
			const pack = packFiles[element.item]
			let description = ""
			if (pack.pack && pack.pack.description) {
				if (typeof pack.pack.description == "object") {
					const desc = Array.isArray(pack.pack.description) ? pack.pack.description : [pack.pack.description]
					desc.forEach(d => {
						if (d.text || d.translation) description += d.text || d.translation
					})
				} else description = pack.pack.description
			} else description = "Pack #" + (element.item + 1)

			treeItem.label = description.replace(/§[0-9a-flmnor]/gi, "")
		} else if (element.item == "dpExclusive") {
			treeItem.label = "Data pack"
			treeItem.iconPath = iconUrl("{DPICON|mcfunction}")
		} else if (element.item == "tags") {
			treeItem.label = "Tags"
			treeItem.description = "(" + localize(Object.values(dpExclusive.tags).reduce((a, b) => a + b)) + " total, " +
				localize(Object.keys(dpExclusive.tags).filter(key => dpExclusive.tags[key] > 0).length) + " unique)"
			treeItem.iconPath = iconUrl("{DPICON|tags}")
		} else if (element.parent == "tags") {
			treeItem.label = element.item + ": " + localize(dpExclusive.tags[element.item])
			treeItem.iconPath = iconUrl("{DPICON|tags}")
		} else if (element.item == "scoreboards") treeItem.label = "Scoreboards: " + localize(dpExclusive.scoreboards)
		else if (element.item == "selectors") {
			treeItem.label = "Selectors"
			treeItem.iconPath = iconUrl("{DPICON|mcfunction}")
		} else if (element.parent == "selectors") {
			treeItem.label = "@" + element.item + ": " + localize(dpExclusive.selectors[element.item])
			treeItem.iconPath = iconUrl("{DPICON|mcfunction}")
		} else if (element.item == "rpExclusive") {
			treeItem.label = "Resource pack"
			treeItem.iconPath = iconUrl("{DPICON|assets}")
		} else if (element.parent == "rpExclusive") {
			treeItem.label = element.item + ": " + localize(rpExclusive[element.item])

			// Must be hardcoded due to static replacement in vscExtension/build.js
			if (element.item == "atlases") treeItem.iconPath = iconUrl("{DPICON|atlases}")
			else if (element.item == "blockstates") treeItem.iconPath = iconUrl("{DPICON|blockstates}")
			else if (element.item == "font") treeItem.iconPath = iconUrl("{DPICON|font}")
			else if (element.item == "lang") treeItem.iconPath = iconUrl("{DPICON|lang}")
			else if (element.item == "models") treeItem.iconPath = iconUrl("{DPICON|models}")
			else if (element.item == "particles") treeItem.iconPath = iconUrl("{DPICON|particles}")
			else if (element.item == "shaders") treeItem.iconPath = iconUrl("{DPICON|shaders}")
			else if (element.item == "sounds") treeItem.iconPath = iconUrl("{DPICON|sounds}")
			else if (element.item == "texts") treeItem.iconPath = iconUrl("{DPICON|texts}")
			else if (element.item == "textures") treeItem.iconPath = iconUrl("{DPICON|textures}")
		} else if (element.item == "filetypes") {
			treeItem.label = "Files"
			treeItem.description = "(parsed only; " + localize(Object.values(filetypes).reduce((a, b) => a + b)) + " total, " + localize(Object.keys(filetypes).length) + " unique)"
			treeItem.iconPath = iconUrl("{DPICON|folder}")
		} else if (element.parent == "filetypes") treeItem.label = "." + element.item + ": " + localize(filetypes[element.item])

		else if (element.item == "commands") {
			treeItem.label = "Commands"
			treeItem.description = "(" + localize(Object.values(commands).reduce((a, b) => a + b)) + " total, " + localize(Object.keys(commands).length) + " unique)"
		} else if (element.parent == "commands") {
			treeItem.label = element.item + ": " + localize(commands[element.item])
			if (cmdsBehindExecute[element.item]) {
				treeItem.description = (element.item == "execute" ? "⚠️ " : "") + "(" + localize(cmdsBehindExecute[element.item]) + " behind execute)"
				if (element.item == "execute") treeItem.tooltip = "⚠️ (\"... run execute ...\" equals \"... ...\")"
			}
		} else if (element.item == "cmdsBehindMacros") treeItem.label = "Commands behind macros: " + localize(Object.keys(cmdsBehindMacros).length)
		else if (element.parent == "cmdsBehindMacros") treeItem.label = element.item + ": " + localize(cmdsBehindMacros[element.item])
		else if (element.item == "cmdsBehindReturn") treeItem.label = "Commands behind return: " + localize(Object.keys(cmdsBehindReturn).length)
		else if (element.parent == "cmdsBehindReturn") treeItem.label = element.item + ": " + localize(cmdsBehindReturn[element.item])

		else if (element.item == "comments") {
			treeItem.label = "Comments: " + localize(comments)
			treeItem.iconPath = iconUrl("{DPICON|md}")
		} else if (element.item == "empty") {
			treeItem.label = "Empty lines: " + localize(empty)
			treeItem.iconPath = iconUrl("{DPICON|misc}")
		} else if (element.item == "emptyFiles") {
			treeItem.label = "Empty files: " + localize(emptyFiles.length)
			treeItem.iconPath = iconUrl("{DPICON|misc}")
		} else if (element.item == "uncalledFunctions") {
			treeItem.label = "Uncalled functions: " + localize(dpExclusive.uncalledFunctions.length)
			treeItem.iconPath = iconUrl("{DPICON|mcfunction}")
		} else if (element.item == "missingFunctions") {
			treeItem.label = "Missing functions: " + localize(dpExclusive.missingFunctions.length)
			treeItem.iconPath = iconUrl("{DPICON|mcfunction}")
		}

		return treeItem
	}

	async getChildren(element) {
		log("getChildren: " + JSON.stringify(element))

		if (element) {
			const item = element.item
			if (item == "packs") return packFiles.map((pack, i) => ({item: i, parent: item}))

			if (item == "dpExclusive") return [
				Object.keys(dpExclusive.tags).reduce((a, b) => a + dpExclusive.tags[b], 0) > 0 ? "tags" : void 0,
				dpExclusive.scoreboards > 0 ? "scoreboards" : void 0,
				Object.keys(dpExclusive.selectors).reduce((a, b) => a + dpExclusive.selectors[b], 0) > 0 ? "selectors" : void 0,
				dpExclusive.uncalledFunctions.length > 0 ? "uncalledFunctions" : void 0,
				dpExclusive.missingFunctions.length > 0 ? "missingFunctions" : void 0
			].filter(Boolean).map(child => ({item: child, parent: item}))

			if (item == "tags") return Object.keys(dpExclusive.tags).filter(key => dpExclusive.tags[key] > 0).map(child => ({item: child, parent: item}))
			if (item == "selectors") return Object.keys(dpExclusive.selectors).filter(key => dpExclusive.selectors[key] > 0).map(child => ({item: child, parent: item}))

			if (item == "rpExclusive") return Object.keys(rpExclusive).filter(key => rpExclusive[key] > 0).map(child => ({item: child, parent: item}))

			if (item == "filetypes") return Object.keys(filetypes).map(child => ({item: child, parent: item}))

			if (item == "commands") return Object.keys(commands).map(child => ({item: child, parent: item}))
			if (item == "cmdsBehindMacros") return Object.keys(cmdsBehindMacros).map(child => ({item: child, parent: item}))
			if (item == "cmdsBehindReturn") return Object.keys(cmdsBehindReturn).map(child => ({item: child, parent: item}))

			if (item == "missingFunctions") return dpExclusive.missingFunctions.map(child => ({item: child, parent: item}))
			if (item == "uncalledFunctions") return dpExclusive.uncalledFunctions.map(child => ({item: child, parent: item}))
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

		dpExclusive.uncalledFunctions = dpExclusive.functions.filter(funcName => !dpExclusive.functionCalls.some(func => func.target == funcName))
		dpExclusive.missingFunctions = [...new Set(dpExclusive.functionCalls.filter(func => !dpExclusive.functions.includes(func.target)).map(func => func.target))]

		return [
			"files",
			error > 0 ? "error" : void 0,
			"rpMode",
			"packs",

			rpMode ? void 0 : "dpExclusive",
			rpMode ? "rpExclusive" : void 0,
			Object.keys(filetypes).length > 0 ? "filetypes" : void 0,

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
