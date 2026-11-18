import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { useLatestAttempt } from './useLatestAttempt'

describe('useLatestAttempt', () => {
	it('keeps only the latest attempt', () => {
		const { result } = renderHook(() => useLatestAttempt())

		const first = result.current.next()
		const second = result.current.next()

		expect(result.current.isLatest(first)).toBe(false)
		expect(result.current.isLatest(second)).toBe(true)
	})

	it('keeps none once the component is gone', () => {
		const { result, unmount } = renderHook(() => useLatestAttempt())
		const attempt = result.current.next()

		unmount()

		expect(result.current.isLatest(attempt)).toBe(false)
	})
})
