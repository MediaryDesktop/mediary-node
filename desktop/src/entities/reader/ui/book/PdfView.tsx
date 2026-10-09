import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'

import { pdfFraction, pdfLocator, pdfPage } from '../../lib/book'

import styles from './BookViews.module.scss'
import type { BookLocation, BookViewHandle } from './types'

GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfViewProps {
	file: File
	locator: string | null
	onReady: () => void
	onRelocate: (location: BookLocation) => void
	onError: (error: unknown) => void
}

// A PDF is drawn a page at a time, fitted to the window: its pages are already
// laid out, and there is nothing to reflow.
export const PdfView = forwardRef<BookViewHandle, PdfViewProps>(function PdfView(
	{ file, locator, onReady, onRelocate, onError },
	ref
) {
	const stageRef = useRef<HTMLDivElement>(null)
	const canvasRef = useRef<HTMLCanvasElement>(null)

	const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null)
	const [page, setPage] = useState(() => pdfPage(locator) ?? 0)
	const [size, setSize] = useState<{ width: number; height: number } | null>(null)

	const latest = useRef({ onReady, onRelocate, onError })
	latest.current = { onReady, onRelocate, onError }

	const total = pdf?.numPages ?? 0

	useImperativeHandle(ref, () => ({
		next: () => setPage(current => Math.min(current + 1, Math.max(total - 1, 0))),
		prev: () => setPage(current => Math.max(current - 1, 0)),
		goToFraction: fraction => setPage(Math.round(fraction * Math.max(total - 1, 0))),
		goTo: target => {
			const found = pdfPage(target)
			if (found !== null) {
				setPage(found)
			}
		}
	}))

	useEffect(() => {
		let cancelled = false
		const loading = file.arrayBuffer().then(buffer => getDocument({ data: new Uint8Array(buffer) }))

		loading
			.then(async opened => {
				const loaded = await opened.promise
				if (cancelled) {
					return
				}

				setPdf(loaded)
				setPage(current => Math.min(current, loaded.numPages - 1))
				latest.current.onReady()
			})
			.catch(error => {
				if (!cancelled) {
					latest.current.onError(error)
				}
			})

		return () => {
			cancelled = true
			void loading.then(opened => opened.destroy())
		}
	}, [file])

	useEffect(() => {
		const stage = stageRef.current
		if (!stage) {
			return
		}

		const observer = new ResizeObserver(([entry]) => {
			if (entry) {
				setSize({ width: entry.contentRect.width, height: entry.contentRect.height })
			}
		})
		observer.observe(stage)

		return () => observer.disconnect()
	}, [])

	useEffect(() => {
		if (!pdf || total === 0) {
			return
		}

		latest.current.onRelocate({
			locator: pdfLocator(page),
			fraction: pdfFraction(page, total),
			chapter: null,
			current: page + 1,
			total
		})
	}, [pdf, page, total])

	useEffect(() => {
		const canvas = canvasRef.current
		if (!pdf || !canvas || !size || size.width === 0 || size.height === 0) {
			return
		}

		let cancelled = false
		let task: RenderTask | null = null

		const draw = async () => {
			const pdfPageProxy = await pdf.getPage(page + 1)
			if (cancelled) {
				return
			}

			const natural = pdfPageProxy.getViewport({ scale: 1 })
			const scale = Math.min(size.width / natural.width, size.height / natural.height)
			const viewport = pdfPageProxy.getViewport({ scale: scale * window.devicePixelRatio })

			canvas.width = Math.floor(viewport.width)
			canvas.height = Math.floor(viewport.height)
			canvas.style.width = `${Math.floor(natural.width * scale)}px`
			canvas.style.height = `${Math.floor(natural.height * scale)}px`

			task = pdfPageProxy.render({ canvas, viewport })
			await task.promise
		}

		draw().catch(error => {
			// A page turned before the last one finished drawing cancels it; that is
			// not a failure.
			if (!cancelled && (error as { name?: string })?.name !== 'RenderingCancelledException') {
				latest.current.onError(error)
			}
		})

		return () => {
			cancelled = true
			task?.cancel()
		}
	}, [pdf, page, size])

	return (
		<div ref={stageRef} className={styles.pdf}>
			<canvas ref={canvasRef} className={styles.canvas} />
		</div>
	)
})
