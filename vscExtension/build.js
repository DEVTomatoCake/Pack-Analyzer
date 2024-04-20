const fs = require("node:fs").promises
const path = require("node:path")

const main = async () => {
	let extension = await fs.readFile("./src/extension.js", "utf8")

	const packAnalyzer = await fs.readFile("../assets/script.js", "utf8")
	const funcStart = packAnalyzer.indexOf("const processFile = ")
	const funcEnd = packAnalyzer.includes("\r\n}", funcStart) ? (packAnalyzer.indexOf("\r\n}", funcStart) + 3) : (packAnalyzer.indexOf("\n}", funcStart) + 2)
	extension = extension.replace("/* processFile */", packAnalyzer.substring(funcStart, funcEnd) + "\n")

	for await (const match of extension.match(/{DPICON\|\w+?}/g)) {
		const icon = await fs.readFile(path.join(__dirname, "dpIcons", match.replace("{DPICON|", "").replace("}", "") + ".png"))
		extension = extension.replace(match, Buffer.from(icon).toString("base64"))
	}

	await fs.writeFile("./out/extension.js", extension.toString())
}
main()
