import { nodeMediaUrl } from '@infra/node'

// The node names a book's format by type; the renderer's own sniffing wants a
// file name as well, FB2 above all.
const EXTENSIONS: Record<string, string> = {
	'application/epub+zip': 'epub',
	'application/x-fictionbook+xml': 'fb2',
	'application/x-zip-compressed-fb2': 'fbz',
	'application/x-mobipocket-ebook': 'mobi',
	'application/vnd.amazon.ebook': 'azw3',
	'application/pdf': 'pdf'
}

export function bookFileName(contentType: string): string {
	return `book.${EXTENSIONS[contentType] ?? 'bin'}`
}

export function isPdf(contentType: string): boolean {
	return contentType === 'application/pdf'
}

const PDF_LOCATOR = /^page:(\d+)$/

// A PDF's place is its page, counted from 0.
export function pdfLocator(page: number): string {
	return `page:${page}`
}

export function pdfPage(locator: string | null | undefined): number | null {
	const match = locator ? PDF_LOCATOR.exec(locator) : null

	return match ? Number(match[1]) : null
}

// The first page is the start and the last one the end, so opening a book does
// not count as reading its first page, and reaching the last finishes it.
export function pdfFraction(page: number, total: number): number {
	if (total <= 1) {
		return 1
	}

	return Math.min(Math.max(page / (total - 1), 0), 1)
}

export async function loadBookFile(fileId: number, contentType: string, signal?: AbortSignal): Promise<File> {
	const response = await fetch(nodeMediaUrl(`/v1/reader/files/${fileId}/book`), { signal })
	if (!response.ok) {
		throw new Error(`the node answered ${response.status}`)
	}

	const blob = await response.blob()

	return new File([blob], bookFileName(contentType), { type: contentType })
}
