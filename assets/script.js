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
	if (getCookie("theme") == "light" || window.matchMedia("(prefers-color-scheme: light)").matches) document.body.classList = "light-theme"
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
