const cacheName = "offline1"

self.addEventListener("install", event => {
	event.waitUntil((async () => {
		const cache = await caches.open(cacheName)
		await cache.addAll(["/", "./assets/analyzer.js", "./assets/script.js", "./assets/jszip.min.js", "./assets/style.css", "https://raw.githubusercontent.com/misode/mcmeta/summary/versions/data.json"])
	})())
})
self.addEventListener("activate", event => {
	event.waitUntil((async () => {
		if ("navigationPreload" in self.registration) await self.registration.navigationPreload.enable()
	})())

	self.clients.claim()
})

self.addEventListener("fetch", event => {
	if (event.request.method == "GET" && event.request.mode == "navigate") {
		event.respondWith((async () => {
			try {
				const preloadResponse = await event.preloadResponse
				if (preloadResponse) return preloadResponse

				const response = await fetch(event.request)
				cache.put(event.request, response.clone())
				return response
			} catch (e) {
				console.warn("Cannot fetch, serving from cache", e)

				const cache = await caches.open(cacheName)
				return await cache.match(event.request.url)
			}
		})())
	}
})
