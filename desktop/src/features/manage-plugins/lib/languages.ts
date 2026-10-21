// Languages by their own names, as Seanime lists them. "multi" is a plugin for
// every language; it shows under all of them.
export const LANGUAGES: Record<string, string> = {
	en: 'English',
	uk: 'Українська',
	ru: 'Русский',
	ja: '日本語',
	pl: 'Polski',
	de: 'Deutsch',
	fr: 'Français',
	es: 'Español',
	pt: 'Português',
	it: 'Italiano',
	zh: '中文',
	ko: '한국어'
}

export function languageName(code: string | undefined, multi: string): string {
	if (!code) {
		return ''
	}
	if (code === 'multi') {
		return multi
	}

	return LANGUAGES[code] ?? code.toUpperCase()
}
