const fs = require("node:fs").promises
const path = require("node:path")

const main = async () => {
	let extension = await fs.readFile("./src/extension.js", "utf8")
	//const packAnalyzer = await fs.readFile("./src/script.js", "utf8")

	for await (const match of extension.match(/{DPICON\|\w+?}/g)) {
		const icon = await fs.readFile(path.join(__dirname, "dpIcons", match.replace("{DPICON|", "").replace("}", "") + ".png"))
		extension = extension.replace(match, Buffer.from(icon).toString("base64"))
	}

	await fs.writeFile("./out/extension.js", /*packAnalyzer.toString() + "\n".repeat(3) +*/ extension.toString())
}
main()
