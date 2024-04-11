const fs = require("node:fs").promises

const main = async () => {
	const extension = await fs.readFile("./src/extension.js", "utf8")
	//const packAnalyzer = await fs.readFile("./src/script.js", "utf8")

	await fs.writeFile("./out/extension.js", /*packAnalyzer.toString() + "\n".repeat(3) +*/ extension.toString())
}
main()
