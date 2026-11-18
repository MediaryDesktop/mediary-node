import type { Extension } from '../api/api'

// Plugin icons by the source id a plugin's chapters and releases carry
// ("plugin:<id>"); a plugin without an icon is left out.
export function pluginIcons(extensions: Extension[]): Map<string, string> {
	return new Map(extensions.flatMap(ext => (ext.icon ? [[`plugin:${ext.id}`, ext.icon] as const] : [])))
}
