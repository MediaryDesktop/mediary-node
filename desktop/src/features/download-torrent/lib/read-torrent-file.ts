export function readTorrentFile(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()

		reader.onload = () => {
			const url = String(reader.result)
			resolve(url.slice(url.indexOf(',') + 1))
		}
		reader.onerror = () => reject(reader.error)

		reader.readAsDataURL(file)
	})
}
