import type { RefObject } from 'react'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'

const GAP = 4
const VIEWPORT_MARGIN = 8
// Tall enough for every search type at once; a list past it scrolls.
const MAX_HEIGHT = 400
const MIN_HEIGHT = 96

export interface PanelPosition {
	top: number
	left: number
	width: number
	maxHeight: number
}

const INITIAL_POSITION: PanelPosition = { top: 0, left: 0, width: 0, maxHeight: MAX_HEIGHT }

export interface FloatingPanelOptions {
	open: boolean
	anchorRef: RefObject<HTMLElement | null>
	panelRef: RefObject<HTMLElement | null>
	containerRef: RefObject<HTMLElement | null>
	onDismiss: () => void
}

export function useFloatingPanel({
	open,
	anchorRef,
	panelRef,
	containerRef,
	onDismiss
}: FloatingPanelOptions): PanelPosition {
	const [position, setPosition] = useState<PanelPosition>(INITIAL_POSITION)

	const measure = useCallback(() => {
		const anchor = anchorRef.current

		if (!anchor) {
			return
		}

		const rect = anchor.getBoundingClientRect()
		const viewportHeight = window.innerHeight
		const below = viewportHeight - rect.bottom - GAP - VIEWPORT_MARGIN
		const above = rect.top - GAP - VIEWPORT_MARGIN

		const openAbove = below < MAX_HEIGHT && above > below
		const available = openAbove ? above : below
		const maxHeight = Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, available))
		const height = Math.min(panelRef.current?.offsetHeight ?? maxHeight, maxHeight)

		const top = openAbove ? rect.top - GAP - height : rect.bottom + GAP

		setPosition({
			top: Math.max(VIEWPORT_MARGIN, Math.min(top, viewportHeight - height - VIEWPORT_MARGIN)),
			left: rect.left,
			width: rect.width,
			maxHeight
		})
	}, [anchorRef, panelRef])

	useLayoutEffect(() => {
		if (!open) {
			return
		}

		measure()

		const frame = requestAnimationFrame(measure)

		return () => cancelAnimationFrame(frame)
	}, [open, measure])

	useEffect(() => {
		const anchor = anchorRef.current

		if (!open || !anchor) {
			return
		}

		const observer = new ResizeObserver(measure)
		observer.observe(anchor)

		if (panelRef.current) {
			observer.observe(panelRef.current)
		}

		window.addEventListener('scroll', measure, true)
		window.addEventListener('resize', measure)

		return () => {
			observer.disconnect()
			window.removeEventListener('scroll', measure, true)
			window.removeEventListener('resize', measure)
		}
	}, [open, anchorRef, panelRef, measure])

	useEffect(() => {
		if (!open) {
			return
		}

		const handlePointerDown = (event: PointerEvent) => {
			const target = event.target as Node

			if (
				containerRef.current?.contains(target) ||
				panelRef.current?.contains(target) ||
				// A Radix popper (a dropdown menu opened from inside the panel, say)
				// renders in its own portal, so it is never a DOM descendant of
				// either ref above even while logically part of this panel.
				(target instanceof Element && target.closest('[data-radix-popper-content-wrapper]'))
			) {
				return
			}

			onDismiss()
		}

		document.addEventListener('pointerdown', handlePointerDown)

		return () => document.removeEventListener('pointerdown', handlePointerDown)
	}, [open, containerRef, panelRef, onDismiss])

	return position
}
