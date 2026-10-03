import type { NodeSchemas } from '@infra/node'

type Audio = NodeSchemas['Audio']
type Subtitle = NodeSchemas['Subtitle']

// The track the file marks as default, as a player would start with; the first
// one when it marks none. Forced tracks only carry signs and foreign lines, so
// they are not a reasonable start unless they are all there is.
export function initialSubtitle(subtitles: Subtitle[]): number | null {
	const full = subtitles.filter(sub => !sub.is_forced)
	const pool = full.length > 0 ? full : subtitles

	return (pool.find(sub => sub.is_default) ?? pool[0])?.index ?? null
}

export function initialAudio(audios: Audio[]): number {
	return (audios.find(audio => audio.is_default) ?? audios[0])?.index ?? 0
}

function languageName(code: string | undefined, locale: string): string | null {
	if (!code) {
		return null
	}

	try {
		return new Intl.DisplayNames([locale], { type: 'language' }).of(code) ?? code
	} catch {
		return code
	}
}

// Release groups put the useful part in the title ("Signs & Songs", "Full"), so
// it goes next to the language rather than instead of it.
export function trackLabel(track: Audio | Subtitle, locale: string): string {
	const language = languageName(track.language, locale)
	const title = track.title?.trim()

	if (language && title && !title.toLowerCase().includes(language.toLowerCase())) {
		return `${language} — ${title}`
	}

	return title || language || `#${track.index + 1}`
}
