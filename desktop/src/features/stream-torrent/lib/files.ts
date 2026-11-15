import type { StreamVideo } from '@entities/torrent'

export function splitPath(path: string): { name: string; folder: string } {
	const cut = path.lastIndexOf('/')

	return cut < 0 ? { name: path, folder: '' } : { name: path.slice(cut + 1), folder: path.slice(0, cut) }
}

// A filter of words, each of which has to be in the path, in any case.
export function matchingFiles(files: readonly StreamVideo[], filter: string): StreamVideo[] {
	const words = filter.toLowerCase().split(/\s+/u).filter(Boolean)

	return files.filter(file => words.every(word => file.path.toLowerCase().includes(word)))
}

// Only a torrent holding more than one video leaves anything to choose.
export function canChooseFile(files: readonly StreamVideo[] | null | undefined): files is StreamVideo[] {
	return (files?.length ?? 0) > 1
}
