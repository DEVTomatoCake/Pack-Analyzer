const { writeTextFile, exists, BaseDirectory } = window.__TAURI__.fs

async function refreshData() {
	const res = await window.__TAURI__.http.fetch("https://github.com/misode/mcmeta/raw/summary/versions/data.json")
	const data = res.data.map(ver => {
		return {
			name: ver.id,
			datapack_version: ver.data_pack_version,
			resourcepack_version: ver.resource_pack_version
		}
	})
	window.data = {
		versions: data
	}

	writeTextFile("versions.json", JSON.stringify(data), { dir: BaseDirectory.AppCache })
}
async function getData(file) {
	if (await exists(file, { dir: BaseDirectory.AppCache })) window.data = {
		versions: JSON.parse(await readTextFile(file, { dir: BaseDirectory.AppCache }))
	}
	else await refreshData()
	return window.data.versions
}

listen("tauri://update-status", res => {
  	console.warn("New update status: ", res)
})
