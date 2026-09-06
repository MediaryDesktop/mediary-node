import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useOtpCountdown } from './useOtpCountdown'

describe('useOtpCountdown', () => {
	beforeEach(() => {
		vi.useFakeTimers()
		vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'))
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	it('counts down to a deadline the server chose', () => {
		const { result } = renderHook(() => useOtpCountdown('2026-01-01T00:30:00.000Z'))

		expect(result.current.known).toBe(true)
		expect(result.current.formatted).toBe('30:00')
		expect(result.current.expired).toBe(false)

		act(() => {
			vi.advanceTimersByTime(29 * 60_000)
		})

		expect(result.current.formatted).toBe('1:00')
		expect(result.current.expired).toBe(false)
	})

	it('reports expiry only once the deadline has passed', () => {
		const { result } = renderHook(() => useOtpCountdown('2026-01-01T00:00:30.000Z'))

		act(() => {
			vi.advanceTimersByTime(30_000)
		})

		expect(result.current.secondsLeft).toBe(0)
		expect(result.current.expired).toBe(true)
	})

	it('stays quiet when no deadline is known', () => {
		const { result } = renderHook(() => useOtpCountdown(null))

		expect(result.current.known).toBe(false)
		expect(result.current.expired).toBe(false)
	})
})
