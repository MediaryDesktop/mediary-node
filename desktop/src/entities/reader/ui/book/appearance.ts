import type { BookAppearance, BookTheme } from './types'

export const BOOK_THEMES: readonly BookTheme[] = ['dark', 'sepia', 'light']

export const FONT_SIZES = { min: 70, max: 180, step: 10 } as const

export const DEFAULT_APPEARANCE: BookAppearance = { theme: 'dark', fontSize: 100 }

export const THEME_COLORS: Record<BookTheme, { background: string; text: string; link: string }> = {
	dark: { background: '#16161a', text: '#dcdcdc', link: '#8ab4f8' },
	sepia: { background: '#f4ecd8', text: '#3b2f22', link: '#7a4b12' },
	light: { background: '#ffffff', text: '#1a1a1a', link: '#1a56c4' }
}

// What a book's pages are drawn with. The colours are forced: a book that
// writes its text black would vanish on a dark page.
export function bookStyles({ theme, fontSize }: BookAppearance): string {
	const colors = THEME_COLORS[theme]

	return `
		html {
			color-scheme: ${theme === 'dark' ? 'dark' : 'light'};
		}
		html, body {
			background: ${colors.background} !important;
			color: ${colors.text} !important;
		}
		body {
			font-size: ${fontSize}% !important;
		}
		p, li, blockquote, dd {
			line-height: 1.55;
			text-align: justify;
			hyphens: auto;
			widows: 2;
		}
		a:link, a:visited {
			color: ${colors.link} !important;
		}
		pre {
			white-space: pre-wrap !important;
		}
	`
}

const STORAGE_KEY = 'mediary.reader.book-appearance'

// How the user likes to read is theirs on this computer, kept beside the window.
export function loadAppearance(): BookAppearance {
	try {
		const raw = window.localStorage.getItem(STORAGE_KEY)
		const parsed = raw ? (JSON.parse(raw) as Partial<BookAppearance>) : {}

		return {
			theme: BOOK_THEMES.includes(parsed.theme as BookTheme) ? (parsed.theme as BookTheme) : 'dark',
			fontSize: clampFontSize(Number(parsed.fontSize) || DEFAULT_APPEARANCE.fontSize)
		}
	} catch {
		return DEFAULT_APPEARANCE
	}
}

export function saveAppearance(appearance: BookAppearance): void {
	try {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(appearance))
	} catch {
		// A window that keeps nothing still reads; the choice lasts the session.
	}
}

export function clampFontSize(size: number): number {
	return Math.min(Math.max(Math.round(size), FONT_SIZES.min), FONT_SIZES.max)
}
