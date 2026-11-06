export interface Filterable {
	id: string
	name: string
	author: string
	description?: string
	type: string
	lang?: string
}

export interface PluginFilter {
	type: string
	language: string
	search: string
}

export function matchesFilter(plugin: Filterable, { type, language, search }: PluginFilter): boolean {
	if (type !== 'all' && plugin.type !== type) {
		return false
	}

	if (language !== 'all' && plugin.lang !== language && plugin.lang !== 'multi') {
		return false
	}

	const needle = search.trim().toLowerCase()
	if (!needle) {
		return true
	}

	return [plugin.name, plugin.id, plugin.author, plugin.description ?? ''].some(text =>
		text.toLowerCase().includes(needle)
	)
}
