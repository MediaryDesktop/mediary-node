// What both plugin lists filter on: an installed plugin and a catalog entry
// alike.
export interface Filterable {
	id: string
	name: string
	author: string
	description?: string
	type: string
	lang?: string
}

export interface PluginFilter {
	// 'all', or a plugin type.
	type: string
	// 'all', or a language code.
	language: string
	search: string
}

export function matchesFilter(plugin: Filterable, { type, language, search }: PluginFilter): boolean {
	if (type !== 'all' && plugin.type !== type) {
		return false
	}

	// A plugin for many languages shows under each of them.
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
