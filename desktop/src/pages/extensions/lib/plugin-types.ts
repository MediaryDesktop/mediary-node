export const PLUGIN_TYPES = ['all', 'torrent-provider', 'manga-provider'] as const

export type PluginTypeFilter = (typeof PLUGIN_TYPES)[number]

export function isPluginType(kind: string): kind is PluginTypeFilter {
	return (PLUGIN_TYPES as readonly string[]).includes(kind)
}

// Plugins grouped by what they provide, in the order of PLUGIN_TYPES; a type
// this client does not know yet comes last.
export function byType<T extends { type: string }>(items: T[]): [string, T[]][] {
	const order: string[] = PLUGIN_TYPES.filter(type => type !== 'all')
	const groups = new Map<string, T[]>()

	for (const item of items) {
		groups.set(item.type, [...(groups.get(item.type) ?? []), item])
	}

	const rank = (type: string) => {
		const index = order.indexOf(type)
		return index < 0 ? order.length : index
	}

	return [...groups.entries()].sort(([a], [b]) => rank(a) - rank(b))
}
