import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useAfterDelay } from './useAfterDelay'

describe('useAfterDelay', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it('calls back once the delay has passed after turning on', () => {
		const callback = vi.fn()
		const { rerender } = renderHook(({ active }) => useAfterDelay(active, 240, callback), {
			initialProps: { active: false }
		})

		vi.advanceTimersByTime(1000)
		rerender({ active: true })
		vi.advanceTimersByTime(239)
		expect(callback).not.toHaveBeenCalled()

		vi.advanceTimersByTime(1)
		expect(callback).toHaveBeenCalledOnce()
	})

	it('does not call back when turned off before the delay', () => {
		const callback = vi.fn()
		const { rerender } = renderHook(({ active }) => useAfterDelay(active, 240, callback), {
			initialProps: { active: true }
		})

		rerender({ active: false })
		vi.advanceTimersByTime(1000)

		expect(callback).not.toHaveBeenCalled()
	})
})
