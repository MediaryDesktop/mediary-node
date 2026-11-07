import { useRef, useState } from 'react'
import type { PointerEvent } from 'react'

const ZOOM_SCALE = 2.2
const DRAG_THRESHOLD_PX = 4

interface Drag {
	pointerId: number
	startX: number
	startY: number
	panX: number
	panY: number
}

// A page that zooms in where it was double-clicked and can then be dragged
// around. A move shorter than a few pixels is still a click; a longer one is a
// drag, and the click that ends it is swallowed (see consumeDrag). Turning to
// another page zooms back out.
export function useZoomPan(page: number) {
	const [zoomed, setZoomed] = useState(false)
	const [origin, setOrigin] = useState({ x: 50, y: 50 })
	const [pan, setPan] = useState({ x: 0, y: 0 })
	const [dragging, setDragging] = useState(false)
	const drag = useRef<Drag | null>(null)
	const dragged = useRef(false)

	const [zoomedPage, setZoomedPage] = useState(page)
	if (zoomedPage !== page) {
		setZoomedPage(page)
		setZoomed(false)
		setPan({ x: 0, y: 0 })
	}

	const zoomOut = () => {
		setZoomed(false)
		setPan({ x: 0, y: 0 })
	}

	const toggleAt = (x: number, y: number) => {
		setOrigin({ x, y })
		setPan({ x: 0, y: 0 })
		setZoomed(current => !current)
	}

	const consumeDrag = (): boolean => {
		if (!dragged.current) {
			return false
		}

		dragged.current = false

		return true
	}

	const onPointerDown = (event: PointerEvent<HTMLElement>) => {
		if (!zoomed) {
			return
		}

		event.currentTarget.setPointerCapture(event.pointerId)
		drag.current = {
			pointerId: event.pointerId,
			startX: event.clientX,
			startY: event.clientY,
			panX: pan.x,
			panY: pan.y
		}
	}

	const onPointerMove = (event: PointerEvent<HTMLElement>) => {
		const current = drag.current
		if (!current || current.pointerId !== event.pointerId) {
			return
		}

		const dx = event.clientX - current.startX
		const dy = event.clientY - current.startY

		if (!dragged.current && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
			dragged.current = true
			setDragging(true)
		}

		if (dragged.current) {
			setPan({ x: current.panX + dx / ZOOM_SCALE, y: current.panY + dy / ZOOM_SCALE })
		}
	}

	const onPointerUp = (event: PointerEvent<HTMLElement>) => {
		if (drag.current?.pointerId === event.pointerId) {
			event.currentTarget.releasePointerCapture(event.pointerId)
			drag.current = null
			setDragging(false)
		}
	}

	return {
		zoomed,
		origin,
		pan,
		dragging,
		zoomOut,
		toggleAt,
		consumeDrag,
		pointer: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp }
	}
}
