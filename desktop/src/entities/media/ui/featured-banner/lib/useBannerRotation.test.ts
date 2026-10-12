import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useBannerRotation } from './useBannerRotation'

describe('useBannerRotation', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it('moves on by itself, veiled while the next title swaps in', () => {
		const { result } = renderHook(() => useBannerRotation(3))

		act(() => vi.advanceTimersByTime(12000))
		expect(result.current.transitioning).toBe(true)
		expect(result.current.index).toBe(0)

		act(() => vi.advanceTimersByTime(900))
		expect(result.current.transitioning).toBe(false)
		expect(result.current.index).toBe(1)
	})

	it('holds still while paused or with a single title', () => {
		const paused = renderHook(() => useBannerRotation(3))
		act(() => paused.result.current.setPaused(true))

		const single = renderHook(() => useBannerRotation(1))

		act(() => vi.advanceTimersByTime(30000))

		expect(paused.result.current.index).toBe(0)
		expect(single.result.current.transitioning).toBe(false)
	})
})
