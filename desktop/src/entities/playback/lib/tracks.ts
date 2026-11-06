import type { NodeSchemas } from '@infra/node'

type Audio = NodeSchemas['Audio']
type Subtitle = NodeSchemas['Subtitle']

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

export function trackLabel(track: Audio | Subtitle, locale: string): string {
	const language = languageName(track.language, locale)
	const title = track.title?.trim()

	if (language && title && !title.toLowerCase().includes(language.toLowerCase())) {
		return `${language} — ${title}`
	}

	return title || language || `#${track.index + 1}`
}
