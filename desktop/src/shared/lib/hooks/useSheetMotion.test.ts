import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSheetEntrance, useSheetLeave } from './useSheetMotion'

describe('sheet motion', () => {
	beforeEach(() => {
		vi.useFakeTimers()
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('does not rise again when it is already open', () => {
		const { result } = renderHook(() => useSheetEntrance(null))

		expect(result.current).toEqual({ entering: false, style: undefined })
	})

	it('goes on from where an earlier mount left the rise, and ends with it', () => {
		const openedAt = performance.now() - 100
		const { result } = renderHook(() => useSheetEntrance(openedAt))

		expect(result.current.entering).toBe(true)
		expect(result.current.style?.animationDelay).toMatch(/^-\d+(\.\d+)?ms$/)

		act(() => {
			vi.advanceTimersByTime(240)
		})

		expect(result.current.entering).toBe(false)
	})

	it('reports the sheet gone once it has sunk away', () => {
		const onLeft = vi.fn()
		const { rerender } = renderHook(({ leaving }) => useSheetLeave(leaving, onLeft), {
			initialProps: { leaving: false }
		})

		rerender({ leaving: true })
		vi.advanceTimersByTime(239)
		expect(onLeft).not.toHaveBeenCalled()

		vi.advanceTimersByTime(1)
		expect(onLeft).toHaveBeenCalledOnce()
	})
})
