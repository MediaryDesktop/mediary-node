export interface BookLocation {
	locator: string
	fraction: number
	chapter: string | null
	current: number | null
	total: number | null
}

export type BookTheme = 'dark' | 'sepia' | 'light'

export interface BookAppearance {
	theme: BookTheme
	fontSize: number
}

export interface BookViewHandle {
	next: () => void
	prev: () => void
	goToFraction: (fraction: number) => void
	goTo: (target: string) => void
}
