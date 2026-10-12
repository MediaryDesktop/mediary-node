export interface BookLocation {
	// Where the reader is, in the viewer's own terms: a CFI, or a PDF page.
	locator: string
	fraction: number
	chapter: string | null
	// Pages as the viewer counts them, from 1; null where it does not.
	current: number | null
	total: number | null
}

export type BookTheme = 'dark' | 'sepia' | 'light'

export interface BookAppearance {
	theme: BookTheme
	// Percent of the book's own size.
	fontSize: number
}

export interface BookViewHandle {
	next: () => void
	prev: () => void
	goToFraction: (fraction: number) => void
	goTo: (target: string) => void
}
