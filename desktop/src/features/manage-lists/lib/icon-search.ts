export function iconLabel(icon: string): string {
	const words = icon.replaceAll('-', ' ')

	return words.charAt(0).toUpperCase() + words.slice(1)
}

export function filterIcons(icons: readonly string[], query: string): string[] {
	const terms = query
		.toLowerCase()
		.split(/[\s-]+/)
		.filter(Boolean)

	if (terms.length === 0) {
		return [...icons]
	}

	const matches = icons.filter(icon => terms.every(term => icon.includes(term)))
	const first = terms.join('-')

	return [
		...matches.filter(icon => icon.startsWith(first)),
		...matches.filter(icon => !icon.startsWith(first))
	]
}
