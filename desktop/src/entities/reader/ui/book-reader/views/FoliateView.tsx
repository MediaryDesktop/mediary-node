import type { FoliateView as FoliateElement, FoliateLocation, FoliateTocItem } from 'foliate-js/view.js'
import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import { bookStyles } from '../lib/appearance'
import type { BookAppearance, BookLocation, BookViewHandle } from '../types'

import styles from './BookViews.module.scss'

export interface FoliateViewProps {
	file: File
	locator: string | null
	appearance: BookAppearance
	onReady: (toc: FoliateTocItem[]) => void
	onRelocate: (location: BookLocation) => void
	onError: (error: unknown) => void
	// Keys pressed while the book's own document has focus, which the window never
	// hears: every section is an iframe of its own.
	onKey: (event: KeyboardEvent) => void
}

// EPUB, FB2, MOBI and AZW3, laid out by foliate-js in pages. The book's own
// scripts never run: the window's CSP allows no script but the app's, and the
// sections' blob: frames inherit it.
export const FoliateView = forwardRef<BookViewHandle, FoliateViewProps>(function FoliateView(
	{ file, locator, appearance, onReady, onRelocate, onError, onKey },
	ref
) {
	const hostRef = useRef<HTMLDivElement>(null)
	const viewRef = useRef<FoliateElement | null>(null)

	// The callbacks change on every render; the book is opened once per file.
	const latest = useRef({ locator, appearance, onReady, onRelocate, onError, onKey })
	latest.current = { locator, appearance, onReady, onRelocate, onError, onKey }

	useImperativeHandle(ref, () => ({
		next: () => void viewRef.current?.next(),
		prev: () => void viewRef.current?.prev(),
		goToFraction: fraction => void viewRef.current?.goToFraction(fraction),
		goTo: target => void viewRef.current?.goTo(target)
	}))

	useEffect(() => {
		const host = hostRef.current
		if (!host) {
			return
		}

		let cancelled = false
		let view: FoliateElement | null = null

		const open = async () => {
			await import('foliate-js/view.js')
			if (cancelled) {
				return
			}

			view = document.createElement('foliate-view') as FoliateElement
			view.className = styles.foliate ?? ''
			host.append(view)
			viewRef.current = view

			view.addEventListener('relocate', event => {
				const detail = (event as CustomEvent<FoliateLocation>).detail

				latest.current.onRelocate({
					locator: detail.cfi,
					fraction: detail.fraction,
					chapter: detail.tocItem?.label?.trim() || null,
					current: detail.location ? detail.location.current + 1 : null,
					total: detail.location?.total ?? null
				})
			})

			view.addEventListener('load', event => {
				const { doc } = (event as CustomEvent<{ doc: Document }>).detail
				doc.addEventListener('keydown', keyEvent => latest.current.onKey(keyEvent))
			})

			await view.open(file)
			if (cancelled) {
				return
			}

			view.renderer.setAttribute('flow', 'paginated')
			view.renderer.setAttribute('gap', '6%')
			view.renderer.setAttribute('max-inline-size', '760px')
			view.renderer.setAttribute('max-column-count', '2')
			view.renderer.setStyles?.(bookStyles(latest.current.appearance))

			latest.current.onReady(view.book.toc ?? [])

			await view.init({ lastLocation: latest.current.locator, showTextStart: true })
		}

		open().catch(error => {
			if (!cancelled) {
				latest.current.onError(error)
			}
		})

		return () => {
			cancelled = true
			view?.close()
			view?.remove()
			viewRef.current = null
		}
	}, [file])

	useEffect(() => {
		viewRef.current?.renderer?.setStyles?.(bookStyles(appearance))
	}, [appearance])

	return <div ref={hostRef} className={styles.host} />
})
