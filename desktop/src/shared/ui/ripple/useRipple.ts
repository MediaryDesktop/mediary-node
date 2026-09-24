import { useCallback, useEffect, useRef, useState } from 'react'
import type { Ref } from 'react'

import { hideRipple, showRipple } from './ripple-dom'
import { RIPPLE_HOST_CLASS } from './types'
import type { RippleOptions } from './types'

const DELAY_RIPPLE = 80

interface RippleState {
	touched: boolean
	isTouch: boolean
	showTimer: ReturnType<typeof setTimeout> | null
	showTimerCommit: (() => void) | null
}

export function useRipple<T extends HTMLElement = HTMLElement>(options: RippleOptions = {}): Ref<T> {
	const hostRef = useRef<T | null>(null)
	const [host, setHost] = useState<T | null>(null)

	const stateRef = useRef<RippleState>({
		touched: false,
		isTouch: false,
		showTimer: null,
		showTimerCommit: null
	})

	const optionsRef = useRef(options)

	useEffect(() => {
		optionsRef.current = options
	})

	const handleShow = useCallback((event: MouseEvent | Touch | null, isTouch: boolean) => {
		const element = hostRef.current
		const state = stateRef.current
		const current = optionsRef.current

		if (!element || current.disabled || state.touched) {
			return
		}

		if (isTouch) {
			state.touched = true
			state.isTouch = true
		} else if (state.isTouch) {
			return
		}

		if (!isTouch) {
			showRipple(event, element, current)
			return
		}

		if (state.showTimerCommit) {
			return
		}

		state.showTimerCommit = () => showRipple(event, element, current)
		state.showTimer = setTimeout(() => {
			state.showTimerCommit?.()
			state.showTimerCommit = null
		}, DELAY_RIPPLE)
	}, [])

	const finishHide = useCallback(() => {
		const element = hostRef.current

		if (!element) {
			return
		}

		setTimeout(() => {
			stateRef.current.touched = false
			stateRef.current.isTouch = false
		})

		hideRipple(element)
	}, [])

	const handleHide = useCallback(() => {
		const state = stateRef.current

		if (!hostRef.current) {
			return
		}

		if (state.showTimer !== null) {
			clearTimeout(state.showTimer)
		}

		if (state.showTimerCommit) {
			state.showTimerCommit()
			state.showTimerCommit = null
			state.showTimer = setTimeout(finishHide, 0)

			return
		}

		finishHide()
	}, [finishHide])

	const handleTouchCancel = useCallback(() => {
		const state = stateRef.current

		state.showTimerCommit = null

		if (state.showTimer !== null) {
			clearTimeout(state.showTimer)
		}
	}, [])

	const ref = useCallback((node: T | null) => {
		hostRef.current = node
		setHost(node)
	}, [])

	useEffect(() => {
		if (!host) {
			return
		}

		const clips = optionsRef.current.host !== false
		const position = window.getComputedStyle(host).position
		const pinsPosition = clips && (!position || position === 'static')

		if (clips) {
			host.classList.add(RIPPLE_HOST_CLASS)
			host.style.setProperty('isolation', 'isolate')
		}

		if (pinsPosition) {
			host.style.setProperty('position', 'relative')
		}

		const onPointerDown = (event: PointerEvent) => {
			if (event.pointerType === 'mouse' && event.button === 0) {
				handleShow(event, false)
			}
		}

		const onPointerUp = (event: PointerEvent) => {
			if (event.pointerType === 'mouse' && event.button === 0) {
				handleHide()
			}
		}

		const onMouseLeave = () => handleHide()

		const onTouchStart = (event: TouchEvent) => {
			const touch = event.touches[event.touches.length - 1]

			if (touch) {
				handleShow(touch, true)
			}
		}

		const onTouchEnd = () => handleHide()
		const onTouchMove = () => handleTouchCancel()
		const onTouchCancel = () => handleHide()

		let keyboardActive = false
		const keys = optionsRef.current.keys ?? ['Enter', ' ']

		const onKeyDown = (event: KeyboardEvent) => {
			if (!keyboardActive && keys.includes(event.key)) {
				keyboardActive = true
				handleShow(null, false)
			}
		}

		const onKeyUp = () => {
			keyboardActive = false
			handleHide()
		}

		const onBlur = () => {
			if (keyboardActive) {
				keyboardActive = false
				handleHide()
			}
		}

		const onDragStart = () => handleHide()

		host.addEventListener('pointerdown', onPointerDown)
		host.addEventListener('pointerup', onPointerUp)
		host.addEventListener('mouseleave', onMouseLeave)
		host.addEventListener('touchstart', onTouchStart, { passive: true })
		host.addEventListener('touchend', onTouchEnd, { passive: true })
		host.addEventListener('touchmove', onTouchMove, { passive: true })
		host.addEventListener('touchcancel', onTouchCancel)
		host.addEventListener('keydown', onKeyDown)
		host.addEventListener('keyup', onKeyUp)
		host.addEventListener('blur', onBlur)
		host.addEventListener('dragstart', onDragStart, { passive: true })

		return () => {
			if (clips) {
				host.classList.remove(RIPPLE_HOST_CLASS)
				host.style.removeProperty('isolation')
			}

			if (pinsPosition) {
				host.style.removeProperty('position')
			}

			host.removeEventListener('pointerdown', onPointerDown)
			host.removeEventListener('pointerup', onPointerUp)
			host.removeEventListener('mouseleave', onMouseLeave)
			host.removeEventListener('touchstart', onTouchStart)
			host.removeEventListener('touchend', onTouchEnd)
			host.removeEventListener('touchmove', onTouchMove)
			host.removeEventListener('touchcancel', onTouchCancel)
			host.removeEventListener('keydown', onKeyDown)
			host.removeEventListener('keyup', onKeyUp)
			host.removeEventListener('blur', onBlur)
			host.removeEventListener('dragstart', onDragStart)
		}
	}, [host, handleShow, handleHide, handleTouchCancel])

	return ref
}
