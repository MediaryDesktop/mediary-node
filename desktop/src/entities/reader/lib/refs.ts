// A chapter is named by one string wherever it comes from: local:<file id> for a
// file in the library, and later opds:… and mangadex:… for chapters online. The
// node parses it; the desktop only builds the local one and passes the rest through.

export function localRef(fileId: number): string {
	return `local:${fileId}`
}

// The read route once took a bare file id; an old link still opens its chapter.
export function routeRef(param: string): string {
	return /^[1-9]\d*$/.test(param) ? localRef(Number(param)) : param
}
