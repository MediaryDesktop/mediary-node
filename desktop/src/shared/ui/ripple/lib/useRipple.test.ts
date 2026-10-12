import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { RIPPLE_HOST_CLASS } from '../types'

import { useRipple } from './useRipple'

function mount(options: Parameters<typeof useRipple>[0] = {}) {
	const host = document.createElement('button')

	Object.defineProperty(host, 'offsetWidth', { value: 200, configurable: true })
	Object.defineProperty(host, 'offsetHeight', { value: 48, configurable: true })

	document.body.appendChild(host)

	const view = renderHook(() => useRipple<HTMLButtonElement>(options))

	act(() => {
		const attach = view.result.current as (node: HTMLButtonElement | null) => void
		attach(host)
	})

	return { host, view }
}

function press(host: HTMLElement, button = 0) {
	act(() => {
		host.dispatchEvent(new PointerEvent('pointerdown', { button, pointerType: 'mouse', bubbles: true }))
	})
}

function release(host: HTMLElement, button = 0) {
	act(() => {
		host.dispatchEvent(new PointerEvent('pointerup', { button, pointerType: 'mouse', bubbles: true }))
	})
}

function ripples(host: HTMLElement) {
	return host.getElementsByClassName('ripple__animation').length
}

beforeEach(() => {
	vi.useFakeTimers()
	vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
		cb(0)
		return 0
	})
})

afterEach(() => {
	vi.useRealTimers()
	vi.unstubAllGlobals()
	document.body.innerHTML = ''
})

describe('useRipple', () => {
	it('marks the host so the ripple is clipped to its shape', () => {
		const { host } = mount()

		expect(host.classList.contains(RIPPLE_HOST_CLASS)).toBe(true)
	})

	it('leaves the host unmarked when clipping is turned off', () => {
		const { host } = mount({ host: false })

		expect(host.classList.contains(RIPPLE_HOST_CLASS)).toBe(false)
	})

	it('survives a rerender that rewrites the host className', () => {
		const { host } = mount()

		host.className = 'item active'

		expect(host.style.isolation).toBe('isolate')
		expect(host.style.position).toBe('relative')
	})

	it('leaves the stacking context alone when clipping is turned off', () => {
		const { host } = mount({ host: false })

		expect(host.style.isolation).toBe('')
		expect(host.style.position).toBe('')
	})

	it('grows a ripple on press and removes it after release', () => {
		const { host } = mount()

		press(host)
		expect(ripples(host)).toBe(1)

		release(host)

		act(() => {
			vi.advanceTimersByTime(2000)
		})

		expect(ripples(host)).toBe(0)
	})

	it('ignores a disabled host', () => {
		const { host } = mount({ disabled: true })

		press(host)

		expect(ripples(host)).toBe(0)
	})

	it('ignores buttons other than the primary one', () => {
		const { host } = mount()

		press(host, 2)

		expect(ripples(host)).toBe(0)
	})

	it('answers the keyboard, so a focused control ripples too', () => {
		const { host } = mount()

		act(() => {
			host.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
		})

		expect(ripples(host)).toBe(1)
	})

	it('cleans up after a press that ends by leaving the control', () => {
		const { host } = mount()

		press(host)
		expect(ripples(host)).toBe(1)

		act(() => {
			host.dispatchEvent(new MouseEvent('mouseleave', { bubbles: true }))
			vi.advanceTimersByTime(2000)
		})

		expect(ripples(host)).toBe(0)
	})

	it('stops listening once the host goes away', () => {
		const { host, view } = mount()

		act(() => {
			view.unmount()
		})

		press(host)

		expect(ripples(host)).toBe(0)
	})
})
