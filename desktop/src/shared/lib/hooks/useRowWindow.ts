import { useEffect, useState } from 'react'

export interface RowWindow {
	start: number
	end: number
	before: number
	after: number
}

// Which rows of a long list of equal-height rows to actually render: the ones in
// view plus `overscan` either side, with the space of the rest kept as padding
// so the scrollbar and positions stay as if every row were there.
export function rowWindow({
	count,
	rowHeight,
	scrollTop,
	viewport,
	overscan
}: {
	count: number
	rowHeight: number
	scrollTop: number
	viewport: number
	overscan: number
}): RowWindow {
	const top = Math.min(Math.max(scrollTop, 0), Math.max(0, count * rowHeight - viewport))
	const first = Math.floor(top / rowHeight)
	const visible = Math.ceil(viewport / rowHeight)

	const start = Math.max(0, Math.min(first - overscan, count))
	const end = Math.min(count, first + visible + overscan)

	return { start, end, before: start * rowHeight, after: (count - end) * rowHeight }
}

function remToPx(rem: number): number {
	const root = parseFloat(getComputedStyle(document.documentElement).fontSize)

	return rem * (Number.isFinite(root) && root > 0 ? root : 16)
}

// The window of a scrolling element's rows, kept up to date as it scrolls or is
// resized. Rows are `rowHeightRem` tall — the list's CSS sets the same height.
// The element is taken through the returned ref, so a list that mounts later —
// inside a drawer that opens, say — is followed from the moment it appears.
// Until its size is known (the observer reports it right after it is
// observed), a viewport of 0 still renders the overscan rows.
export function useRowWindow(
	count: number,
	rowHeightRem: number,
	overscan = 12
): [(element: HTMLElement | null) => void, RowWindow] {
	const [element, setElement] = useState<HTMLElement | null>(null)
	const [scrollTop, setScrollTop] = useState(0)
	const [viewport, setViewport] = useState(0)

	useEffect(() => {
		if (!element) {
			return
		}

		let frame = 0
		const onScroll = () => {
			cancelAnimationFrame(frame)
			frame = requestAnimationFrame(() => setScrollTop(element.scrollTop))
		}

		const observer = new ResizeObserver(() => {
			setViewport(element.clientHeight)
			setScrollTop(element.scrollTop)
		})

		element.addEventListener('scroll', onScroll, { passive: true })
		observer.observe(element)

		return () => {
			cancelAnimationFrame(frame)
			element.removeEventListener('scroll', onScroll)
			observer.disconnect()
		}
	}, [element])

	return [setElement, rowWindow({ count, rowHeight: remToPx(rowHeightRem), scrollTop, viewport, overscan })]
}
