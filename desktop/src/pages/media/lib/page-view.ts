export type MediaPageView = 'torrent'

export function isMediaPageView(value: unknown): value is MediaPageView {
	return value === 'torrent'
}
