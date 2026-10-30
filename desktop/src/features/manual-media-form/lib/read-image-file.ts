export interface ReadImage {
	// Base64, as CoverSource.data takes it — without the data URL prefix the
	// browser's reader wraps it in.
	data: string
	// For an immediate preview, before the node has seen the file at all.
	previewUrl: string
}

export function readImageFile(file: File): Promise<ReadImage> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()

		reader.onload = () => {
			const url = String(reader.result)
			resolve({ data: url.slice(url.indexOf(',') + 1), previewUrl: url })
		}
		reader.onerror = () => reject(reader.error)

		reader.readAsDataURL(file)
	})
}
