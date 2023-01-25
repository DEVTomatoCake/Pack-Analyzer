// Cookie/"load"/getLanguage() code modified from https://github.com/DEVTomatoCake/dashboard/blob/0ad2ba278373244f05025dc6554e4ebb86868e8a/assets/js/script.js#L1-L26 and language.js
function setCookie(name, value, days) {
	let cookie = name + "=" + (value || "") + ";path=/;"
	if (days) {
		const date = new Date()
		date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000))
		cookie += "expires=" + date.toUTCString() + ";"
	}

	document.cookie = cookie
}
function getCookie(name) {
	const cookies = document.cookie.split(";")

	for (let i = 0; i < cookies.length; i++) {
		let cookie = cookies[i].trim()

		if (cookie.split("=")[0] == name) return cookie.substring(name.length + 1, cookie.length)
	}
	return undefined
}
function deleteCookie(name) {
	document.cookie = name + "=;Max-Age=-99999999;path=/;"
}

window.addEventListener("load", () => {
	if (getCookie("theme") == "light") document.body.classList = "light-theme"
	else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
		document.body.classList = "light-theme"
		setCookie("theme", "light", 365)
	}
	if (!getCookie("lang")) setCookie("lang", getLanguage(), 365)

	if ("serviceWorker" in navigator) navigator.serviceWorker.register("/serviceworker.js")
})

const getLanguage = () => {
	if (getCookie("lang")) return getCookie("lang")

	const userLang = navigator.language || navigator.userLanguage
	return userLang ? (userLang.split("-")[0] == "de" ? "de" : "en") : "en"
}

const requestVersions = async () => {
	const res = await fetch("https://raw.githubusercontent.com/misode/mcmeta/summary/versions/data.json")
	const json = await res.json()
	window.versions = json.map(ver => {
		return {
			name: ver.id,
			datapack_version: ver.data_pack_version,
			resourcepack_version: ver.resource_pack_version
		}
	})
}
requestVersions()

window.addEventListener("dragover", event => {
	event.stopPropagation()
	event.preventDefault()
	event.dataTransfer.dropEffect = "copy"
})
window.addEventListener("drop", async event => {
	event.stopPropagation()
	event.preventDefault()
	const fileList = event.dataTransfer.files
	if (fileList[0].name.endsWith(".zip")) handleZip(fileList[0])
	else {
		selected = []
		for await (const file of Object.values(fileList)) {
			selected.push({
				name: file.name,
				content: await file.text()
			})
		}
		mainScan()
	}
})
window.addEventListener("paste", async e => {
	e.preventDefault()
	if (!e.clipboardData.files.length) return
	const file = e.clipboardData.files[0]
	if (file.name.endsWith(".zip")) handleZip(file)
	else {
		selected = [{
			name: file.name,
			content: await file.text()
		}]
		mainScan()
	}
})

const localize = string => string.toLocaleString(getCookie("lang") || "en-US")

function openDialog(dialog) {
	dialog.style.display = "block"
	dialog.getElementsByClassName("close")[0].onclick = function() {
		dialog.style.display = "none"
	}
	window.onclick = function(event) {
		if (event.target == dialog) dialog.style.display = "none"
	}
}

async function openSettingsDialog() {
	var dialog = document.getElementById("settingsDialog")
	openDialog(dialog)

	if (getCookie("theme") == "light") dialog.querySelector("option[value='light']").selected = true
	else dialog.querySelector("option[value='dark']").selected = true

	if (getCookie("lang") == "de-DE") dialog.querySelector("option[value='de-DE']").selected = true
	else dialog.querySelector("option[value='en-US']").selected = true

	for (let select of dialog.getElementsByTagName("select")) {
		select.onchange = () => {
			setCookie(select.name, select.value, 365)
			if (select.name == "theme") document.body.classList = select.value + "-theme"
		}
	}
}

function clearResults() {
	document.getElementById("progress").innerText = ""
	document.getElementById("result").innerHTML = ""
	document.getElementById("resultButtons").hidden = true
	if (interval) clearInterval(interval)
}

function share(type) {
	var content = ""
	if (type == "txt") content = document.getElementById("result").innerText
	else if (type == "json") content = JSON.stringify({
			files,
			done,
			error,
			rpMode,

			filetypes,
			selectors,
			packFiles,
			commands,
			cmdsBehindExecute,
			comments,
			empty,
			dpExclusive,
			rpExclusive
		}, null, 4)
	else if (type == "png") return createImage()

	const download = document.createElement("a")
	download.download = "export." + type
	download.href = type == "png" ? content : "data:application/" + type + "," + encodeURIComponent(content)
	download.click()
}
function createImage() {
	var canvas = document.createElement("canvas")
	canvas.width = 800
	canvas.height = 500
	var ctx = canvas.getContext("2d")
	ctx.fillStyle = "white"
	ctx.fillRect(0, 0, canvas.width, canvas.height)

	drawing = new Image()
	drawing.src = "./assets/images/novaskin-wallpaper.png"
	drawing.onload = () => {
		ctx.globalAlpha = 0.3
		ctx.drawImage(drawing, 0, 0)
		ctx.globalAlpha = 1

		const x = 20
		var y = 2
		const lineHeight = 21
		ctx.font = lineHeight - 1 + "px Arial"
		ctx.fillStyle = "black"

		/*(packFiles.length > 0 ? "<strong>" + (rpMode ? "Resource" : "Data") + "pack" + (packFiles.length == 1 ? "" : "s") + " found:</strong><br>" +
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
			"Total amount of commands: " + localize(Object.keys(commands).reduce((a, b) => a + commands[b], 0)) + "</strong><br>"
			"<span class='indented'>Unique commands: " + localize(Object.keys(commands).length)
			(comments > 0 ? "<span class='indented'>Comments: " + localize(comments) : "")
		: "")
		(empty > 0 ? "<span class='indented'>Empty lines: " + localize(empty) : "")
		"Pack file types found:</strong><br>"
		Object.keys(filetypes).sort((a, b) => filetypes[b] - filetypes[a]).map(type => "<span class='indented'>." + type + ": " + localize(filetypes[type])).join("") +*/

		if (dpExclusive.scoreboards > 0) ctx.fillText("Scoreboards created: " + localize(dpExclusive.scoreboards), x, y++ * lineHeight, 200)
		if (!rpMode && Object.values(dpExclusive.selectors).reduce((a, b) => a + b) != 0) {
			ctx.fillText("Selectors used:", x, y++ * lineHeight, 200)
			Object.keys(dpExclusive.selectors).filter(i => dpExclusive.selectors[i] > 0).sort((a, b) => dpExclusive.selectors[b] - dpExclusive.selectors[a])
				.forEach(type => ctx.fillText("@" + type + ": " + localize(dpExclusive.selectors[type]), x + 30, y++ * lineHeight, 200))
		}
		if (!rpMode && Object.values(dpExclusive.folders).reduce((a, b) => a + b) != 0) {
			ctx.fillText("Datapack features used:", x, y++ * lineHeight, 200)
			Object.keys(dpExclusive.folders).filter(i => i > 0).sort((a, b) => dpExclusive.folders[b] - dpExclusive.folders[a])
				.forEach(type => ctx.fillText(type + ": " + localize(dpExclusive.folders[type]), x + 30, y++ * lineHeight, 200))
		}
		if (!rpMode && Object.values(dpExclusive.tags).reduce((a, b) => a + b) != 0) {
			ctx.fillText("Tags used:", x, y++ * lineHeight, 200)
			Object.keys(dpExclusive.tags).filter(i => dpExclusive.tags[i] > 0).sort((a, b) => dpExclusive.tags[b] - dpExclusive.tags[a])
				.forEach(type => ctx.fillText(type + ": " + localize(dpExclusive.tags[type]), x + 30, y++ * lineHeight, 200))
		}

		if (rpMode && Object.values(rpExclusive).reduce((a, b) => a + b) != 0) {
			ctx.fillText("Resourcepack features used:", x, y++ * lineHeight, 200)
			Object.keys(rpExclusive).filter(i => !isNaN(i) && rpExclusive[i] > 0).sort((a, b) => rpExclusive[b] - rpExclusive[a])
				.forEach(type => ctx.fillText(type + ": " + localize(rpExclusive[type]), x + 30, y++ * lineHeight, 200))
		}

		ctx.font = "30px Arial"
		ctx.fillText("Commands", 350, 40, 200)
		ctx.font = "20px Arial"

		commands = Object.fromEntries(Object.entries(commands).sort(([, a], [, b]) => b - a))
		y = 2
		Object.keys(commands).forEach(cmd => {
			y++
			ctx.fillText(cmd + ": " + localize(commands[cmd]), 350, y * lineHeight, 200)
			if (cmdsBehindExecute[cmd]) {
				y++
				ctx.fillText("Behind execute: " + localize(cmdsBehindExecute[cmd]), 380, y * lineHeight, 200)
				// (cmd == "execute" ? "⚠️ <small>(<code>... run execute ...</code> equals <code>... ...</code>)</small>" : "")
			}
		})

		document.body.appendChild(canvas)
	}
}
