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
	if (fileList[0].name.endsWith(".zip")) {
		let dropElement = document.createElement("div")
		dropElement.id = "drop"
		dropElement.style.left = event.clientX + "px"
		dropElement.style.top = event.clientY + "px"
		document.body.appendChild(dropElement)
		dropElement.addEventListener("animationend", () => dropElement.remove())
		handleZip(fileList[0])
	} else {
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

async function share(type) {
	var content = ""
	if (type == "txt") content = document.getElementById("result").innerText
	else if (type == "json" || type == "link") {
		content = JSON.stringify({
			files,
			done,
			error,
			rpMode,

			filetypes,
			packFiles,
			commands,
			cmdsBehindExecute,
			comments,
			empty,
			dpExclusive,
			rpExclusive
		}, null, type == "json" ? 4 : undefined)
		if (type == "link") {
			const res = await fetch("https://api.tomatenkuchen.eu/short", {
				method: "post",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({
					url: location.href + "?data=" + encodeURIComponent(content)
				})
			})
			const json = await res.json()
			console.log(json)
			return
		}
	} else if (type == "png") return createImage()

	const download = document.createElement("a")
	download.download = "export." + type
	download.href = "data:application/" + type + "," + encodeURIComponent(content)
	download.click()
}
function createImage() {
	var canvas = document.getElementById("shareImage")
	canvas.style.display = "block"
	var ctx = canvas.getContext("2d")
	ctx.clearRect(0, 0, canvas.width, canvas.height)
	ctx.fillStyle = "white"
	ctx.fillRect(0, 0, canvas.width, canvas.height)

	drawing = new Image()
	drawing.src = "./assets/images/generated_background.png"
	drawing.onload = () => {
		ctx.globalAlpha = 0.3
		ctx.drawImage(drawing, 0, 0)
		ctx.globalAlpha = 1

		var x = 20
		var y = 1
		const lineHeight = 21
		const maxWidth = 400
		ctx.font = lineHeight - 1 + "px Arial"
		ctx.fillStyle = "black"

		if (packFiles.length > 0) {
			ctx.fillText(packFiles.length + " " + (rpMode ? "Resource" : "Data") + "pack" + (packFiles.length == 1 ? "" : "s") + " found", x, y++ * lineHeight, maxWidth)
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
		if (!rpMode && Object.keys(commands).length > 0) {
			ctx.fillText("Total amount of commands: " + localize(Object.keys(commands).reduce((a, b) => a + commands[b], 0)), x, y++ * lineHeight, maxWidth)
			ctx.fillText("Unique commands: " + localize(Object.keys(commands).length), x + 30, y++ * lineHeight, maxWidth)
		}
		if (comments > 0) ctx.fillText("Comments: " + localize(comments), x + 30, y++ * lineHeight, maxWidth)
		if (empty > 0) ctx.fillText("Empty lines: " + localize(empty), x + 30, y++ * lineHeight, maxWidth)
		ctx.fillText((Object.keys(filetypes).length > 2 ? "Top 3 p" : "P") + "ack file types found:", x, y++ * lineHeight, maxWidth)
		Object.keys(filetypes).slice(0, 3).sort((a, b) => filetypes[b] - filetypes[a]).forEach(type => ctx.fillText("." + type + ": " + localize(filetypes[type]), x + 30, y++ * lineHeight, maxWidth))

		if (dpExclusive.scoreboards > 0) ctx.fillText("Scoreboards created: " + localize(dpExclusive.scoreboards), x, y++ * lineHeight, maxWidth)
		if (!rpMode && Object.values(dpExclusive.selectors).reduce((a, b) => a + b) != 0) {
			ctx.fillText((Object.keys(dpExclusive.selectors).length > 2 ? "Top 3 s" : "S") + "electors used:", x, y++ * lineHeight, maxWidth)
			Object.keys(dpExclusive.selectors).slice(0, 3).filter(i => dpExclusive.selectors[i] > 0).sort((a, b) => dpExclusive.selectors[b] - dpExclusive.selectors[a])
				.forEach(type => ctx.fillText("@" + type + ": " + localize(dpExclusive.selectors[type]), x + 30, y++ * lineHeight, maxWidth))
		}
		if (!rpMode && Object.values(dpExclusive.folders).reduce((a, b) => a + b) != 0) {
			ctx.fillText("Datapack features used:", x, y++ * lineHeight, maxWidth)
			Object.keys(dpExclusive.folders).filter(i => dpExclusive.folders[i] > 0).sort((a, b) => dpExclusive.folders[b] - dpExclusive.folders[a])
				.forEach(type => ctx.fillText(type + ": " + localize(dpExclusive.folders[type]), x + 30, y++ * lineHeight, maxWidth))
		}
		if (rpMode && Object.values(rpExclusive).reduce((a, b) => a + b) != 0) {
			ctx.fillText("Resourcepack features used:", x, y++ * lineHeight, maxWidth)
			Object.keys(rpExclusive).filter(i => !isNaN(i) && rpExclusive[i] > 0).sort((a, b) => rpExclusive[b] - rpExclusive[a])
				.forEach(type => ctx.fillText(type + ": " + localize(rpExclusive[type]), x + 30, y++ * lineHeight, maxWidth))
		}

		x = 450
		y = 2
		ctx.font = "28px Arial"
		ctx.fillText("Commands", x, 40, maxWidth)
		ctx.font = "20px Arial"

		commands = Object.fromEntries(Object.entries(commands).sort(([, a], [, b]) => b - a))
		Object.keys(commands).slice(0, 5).forEach(cmd => {
			ctx.fillText(cmd + ": " + localize(commands[cmd]), x, y++ * lineHeight, maxWidth)
			if (cmdsBehindExecute[cmd]) {
				ctx.fillText("Behind execute: " + localize(cmdsBehindExecute[cmd]), x + 30, y++ * lineHeight, maxWidth)
				if (cmd == "execute") ctx.fillText("⚠️ (\"... run execute ...\" equals \"... ...\")", x + 30, y++ * lineHeight, maxWidth)
			}
		})
	}
}
