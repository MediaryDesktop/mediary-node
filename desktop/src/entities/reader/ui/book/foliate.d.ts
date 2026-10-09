// foliate-js ships plain ES modules without types; this is the part the reader
// uses. The library calls itself unstable, so the version is pinned.
declare module 'foliate-js/view.js' {
	export interface FoliateTocItem {
		label: string
		href: string
		subitems?: FoliateTocItem[]
	}

	export interface FoliateBook {
		dir?: string
		toc?: FoliateTocItem[]
		metadata?: { title?: unknown }
	}

	export interface FoliateLocation {
		cfi: string
		fraction: number
		location?: { current: number; next: number; total: number }
		tocItem?: { label?: string; href?: string }
	}

	export interface FoliateRenderer extends HTMLElement {
		setStyles?(css: string): void
		next(): Promise<void>
	}

	export interface FoliateView extends HTMLElement {
		book: FoliateBook
		renderer: FoliateRenderer
		open(book: File | Blob | string): Promise<void>
		close(): void
		init(options: { lastLocation?: string | null; showTextStart?: boolean }): Promise<void>
		goTo(target: string | number): Promise<unknown>
		goToFraction(fraction: number): Promise<void>
		goLeft(): Promise<void>
		goRight(): Promise<void>
		prev(): Promise<void>
		next(): Promise<void>
	}

	export class View extends HTMLElement {}
}
