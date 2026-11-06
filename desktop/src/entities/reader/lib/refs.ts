
export function localRef(fileId: number): string {
	return `local:${fileId}`
}

export function routeRef(param: string): string {
	return /^[1-9]\d*$/.test(param) ? localRef(Number(param)) : param
}
