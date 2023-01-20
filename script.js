// Cookie code from https://github.com/DEVTomatoCake/dashboard/blob/0ad2ba278373244f05025dc6554e4ebb86868e8a/assets/js/script.js#L1-L26
function setCookie(name, value, days) {
	if (!getCookie("cookie-dismiss") && name != "token" && name != "user" && name != "cookie-dismiss") return console.warn("Skipping cookie " + name)
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
