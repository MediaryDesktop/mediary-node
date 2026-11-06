export interface ReadImage {
	data: string
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
