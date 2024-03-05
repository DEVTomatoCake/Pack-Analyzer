const fsPromises = require("node:fs").promises
const UglifyJS = require("uglify-js")

const nameCache = {}
const defaultOptions = {
	compress: {
		passes: 5,
		unsafe: true,
		unsafe_Function: true,
		unsafe_math: true,
		unsafe_proto: true,
		unsafe_regexp: true
	}
}

const minifyFile = async (path, options = {}) => {
	const filename = path.split("/").pop()
	const result = UglifyJS.minify({
		[path]: await fsPromises.readFile(path, "utf8")
	}, {
		sourceMap: {
			root: "https://pack-analyzer.pages.dev/assets/",
			filename,
			url: filename + ".map"
		},
		warnings: "verbose",
		parse: {
			shebang: false
		},
		nameCache,
		mangle: true,
		...defaultOptions,
		...options
	})

	if (result.error) throw result.error
	if (result.warnings && result.warnings.length > defaultOptions.compress.passes) console.log(path, result.warnings)

	if (process.env.MINIFY_ENABLED) {
		await fsPromises.writeFile(path, result.code)
		await fsPromises.writeFile(path + ".map", result.map)
	}
}

async function main() {
	await minifyFile("./assets/script.js", {
		toplevel: true,
		compress: {
			...defaultOptions.compress,
			top_retain: ["selectFolder", "selectZip", "toggleTheme", "openDialog", "clearResults", "share"]
		},
		mangle: {
			reserved: ["selectFolder", "selectZip", "toggleTheme", "openDialog", "clearResults", "share"]
		}
	})
	await minifyFile("./assets/jszip.js", {
		toplevel: true,
		mangle: {
			reserved: ["JSZip"]
		}
	})
}
main()
