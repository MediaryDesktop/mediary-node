import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useZoomPan } from './useZoomPan'

function pointer(x: number, y: number) {
	return {
		pointerId: 1,
		clientX: x,
		clientY: y,
		currentTarget: { setPointerCapture: () => {}, releasePointerCapture: () => {} }
	} as never
}

describe('useZoomPan', () => {
	it('zooms in where it was asked, and out again', () => {
		const { result } = renderHook(() => useZoomPan(0))

		act(() => result.current.toggleAt(25, 75))
		expect(result.current.zoomed).toBe(true)
		expect(result.current.origin).toEqual({ x: 25, y: 75 })

		act(() => result.current.zoomOut())
		expect(result.current.zoomed).toBe(false)
	})

	it('zooms back out on another page', () => {
		const { result, rerender } = renderHook(({ page }) => useZoomPan(page), { initialProps: { page: 0 } })

		act(() => result.current.toggleAt(50, 50))
		rerender({ page: 1 })

		expect(result.current.zoomed).toBe(false)
		expect(result.current.pan).toEqual({ x: 0, y: 0 })
	})

	it('treats a tiny move as a click and a longer one as a drag', () => {
		const { result } = renderHook(() => useZoomPan(0))
		act(() => result.current.toggleAt(50, 50))

		act(() => result.current.pointer.onPointerDown(pointer(100, 100)))
		act(() => result.current.pointer.onPointerMove(pointer(102, 101)))
		expect(result.current.dragging).toBe(false)
		expect(result.current.consumeDrag()).toBe(false)

		act(() => result.current.pointer.onPointerMove(pointer(122, 100)))
		expect(result.current.dragging).toBe(true)
		expect(result.current.pan.x).toBeCloseTo(22 / 2.2)

		act(() => result.current.pointer.onPointerUp(pointer(122, 100)))
		expect(result.current.dragging).toBe(false)
		expect(result.current.consumeDrag()).toBe(true)
		expect(result.current.consumeDrag()).toBe(false)
	})

	it('does not drag a page that is not zoomed in', () => {
		const { result } = renderHook(() => useZoomPan(0))

		act(() => result.current.pointer.onPointerDown(pointer(100, 100)))
		act(() => result.current.pointer.onPointerMove(pointer(200, 100)))

		expect(result.current.dragging).toBe(false)
	})
})
