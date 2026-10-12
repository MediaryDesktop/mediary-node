import { renderHook } from '@testing-library/react'
import { createEvent } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import { useUnitWatch } from './useUnitWatch'

describe('useUnitWatch', () => {
	it('calls the latest handler while mounted and stops after unmount', () => {
		const fired = createEvent<number>()
		const first = vi.fn()
		const second = vi.fn()

		const { rerender, unmount } = renderHook(({ handler }) => useUnitWatch(fired, handler), {
			initialProps: { handler: first }
		})

		fired(1)
		rerender({ handler: second })
		fired(2)
		unmount()
		fired(3)

		expect(first).toHaveBeenCalledExactlyOnceWith(1)
		expect(second).toHaveBeenCalledExactlyOnceWith(2)
	})
})
