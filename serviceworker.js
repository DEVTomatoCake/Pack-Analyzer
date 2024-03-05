// Modified by TomatoCake from https://github.com/DEVTomatoCake/dashboard/blob/700b21999a671f4e9c32ba4a1a35f94156db11d4/serviceworker.js
const version = 1

self.addEventListener("install", event => {
	event.waitUntil((async () => {
		(await caches.keys()).forEach(cacheName => {
			if (cacheName != "static" + version && cacheName != "fallback" + version) caches.delete(cacheName)
		})

		const staticCache = await caches.open("static" + version)
		staticCache.addAll([
			"/",
			"/assets/jszip.min.js",
			"/assets/images/icon-128x128.png",
			"assets/images/generated_background.png"
		])

		const fallbackCache = await caches.open("fallback" + version)
		fallbackCache.addAll([
			"/assets/style.css",
			"/assets/script.js",
			"/assets/analyzer.js"
		])
	})())
})

self.addEventListener("activate", event => {
	event.waitUntil((async () => {
		if ("navigationPreload" in self.registration) await self.registration.navigationPreload.enable()
	})())

	self.clients.claim()
})

self.addEventListener("fetch", event => {
	const url = new URL(event.request.url)
	if (event.request.method == "GET" && url.protocol == "https:" && (event.request.mode == "navigate" || event.request.mode == "no-cors" || event.request.mode == "cors")) {
		event.respondWith((async () => {
			const preloadResponse = await event.preloadResponse
			if (preloadResponse) return preloadResponse

			const staticCache = await caches.open("static" + version)
			const assetResponse = await staticCache.match(event.request)
			if (assetResponse) return assetResponse

			const fallback = await caches.open("fallback" + version)
			try {
				const response = await fetch(event.request)
				if (url.href.startsWith("https://cdn.jsdelivr.net/npm/ionicons@")) staticCache.put(event.request, response.clone())
				else if (url.host != "static.cloudflareinsights.com") fallback.put(event.request, response.clone())
				return response
			} catch (e) {
				console.warn("Cannot fetch " + event.request.url + ", serving from cache", e)
				return await fallback.match(event.request) || await caches.match("/offline")
			}
		})())
	}
})
