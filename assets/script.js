// Cookie/"load" code modified from https://github.com/DEVTomatoCake/dashboard/blob/0ad2ba278373244f05025dc6554e4ebb86868e8a/assets/js/script.js#L1-L26

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

	for (const rawCookie of cookies) {
		const cookie = rawCookie.trim()
		if (cookie.split("=")[0] == name) return cookie.substring(name.length + 1, cookie.length)
	}
	return void 0
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

window.addEventListener("load", () => {
	if (getCookie("theme") == "light") document.body.classList.add("light-theme")
	else if (window.matchMedia("(prefers-color-scheme: light)").matches) {
		document.body.classList.add("light-theme")
		setCookie("theme", "light", 365)
	}

	const params = new URLSearchParams(location.search)
	if (params.has("data")) {
		const parsed = JSON.parse(params.get("data"))
		files = parsed.files
		done = parsed.done
		errors = parsed.errors
		rpMode = parsed.rpMode

		filetypes = parsed.filetypes
		packFiles = parsed.packFiles
		commands = parsed.commands
		cmdsBehindExecute = parsed.cmdsBehindExecute
		comments = parsed.comments
		empty = parsed.empty
		dpExclusive = parsed.dpExclusive
		rpExclusive = parsed.rpExclusive

		mainScan(true)
	}

	if ("serviceWorker" in navigator) navigator.serviceWorker.register("/serviceworker.js")
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

	let dropElement = document.createElement("div")
	dropElement.id = "drop"
	dropElement.style.left = event.clientX + "px"
	dropElement.style.top = event.clientY + "px"
	document.body.appendChild(dropElement)
	dropElement.addEventListener("animationend", () => dropElement.remove())

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

const localize = string => string.toLocaleString()

function openDialog(dialog) {
	dialog.style.display = "block"
	dialog.getElementsByClassName("close")[0].onclick = function() {
		dialog.style.display = "none"
	}
	window.onclick = function(event) {
		if (event.target == dialog) dialog.style.display = "none"
	}
}

const toggleTheme = () => {
	const toggled = document.body.classList.toggle("light-theme")
	setCookie("theme", toggled ? "light" : "dark", 365)
}

function clearResults() {
	document.getElementById("progress").innerText = ""
	document.getElementById("result").innerHTML = ""
	document.getElementById("resultButtons").hidden = true
	if (interval) clearInterval(interval)
}

async function share(type) {
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
			comments,
			empty,
			emptyFiles,
			dpExclusive,
			rpExclusive
		}, null, type == "json" ? 4 : void 0)
		if (type == "link") {
			const name = Math.random().toString(36).slice(7)
			const date = Date.now() + 1000 * 60 * 60 * 24 * 7

			const res = await fetch("https://shorter.cf", {
				method: "POST",
				headers: {
					"Content-Type": "application/json"
				},
				body: JSON.stringify({name, url: location.href + "?data=" + encodeURIComponent(content), date})
			})

			const json = await res.json()
			if (json.status == "success") {
				document.getElementById("share-link").href = "https://shorter.cf/" + name
				document.getElementById("share-link").innerText = "https://shorter.cf/" + name
				document.getElementById("share-img").src = "https://api.qrserver.com/v1/create-qr-code/?data=" + encodeURIComponent("https://shorter.cf/" + name) + "&size=150x150&qzone=2"
				openDialog(document.getElementById("shareDialog"))
			} else alert("Couldn't create link: " + json.error)
			return
		}
	} else if (type == "png") return createImage()

	const download = document.createElement("a")
	download.download = "export." + type
	download.href = "data:application/" + type + "," + encodeURIComponent(content)
	download.click()
}
function createImage() {
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
