import { useCallback, useEffect, useRef, useState } from 'react'
import type { Ref } from 'react'

export const RIPPLE_HOST_CLASS = 'ripple-host'

export interface RippleOptions {
	disabled?: boolean
	center?: boolean
	circle?: boolean
	className?: string
	host?: boolean
	keys?: string[]
}

const DELAY_RIPPLE = 80
const GROW_MS = 250
const FADE_MS = 300

interface RippleState {
	touched: boolean
	isTouch: boolean
	showTimer: ReturnType<typeof setTimeout> | null
	showTimerCommit: (() => void) | null
}

function calculate(event: MouseEvent | Touch | null, host: HTMLElement, options: RippleOptions) {
	const rect = host.getBoundingClientRect()
	const width = host.offsetWidth
	const height = host.offsetHeight

	let localX = width / 2
	let localY = height / 2

	if (event) {
		localX = event.clientX - rect.left
		localY = event.clientY - rect.top
	}

	let radius: number
	let scale = 0.3

	if (options.circle) {
		scale = 0.15
		radius = width / 2

		if (!options.center) {
			radius += Math.sqrt((localX - radius) ** 2 + (localY - radius) ** 2) / 4
		}
	} else {
		radius = Math.sqrt(width ** 2 + height ** 2) / 2
	}

	const centerX = (width - radius * 2) / 2
	const centerY = (height - radius * 2) / 2

	const x = options.center ? centerX : localX - radius
	const y = options.center ? centerY : localY - radius

	return { radius, scale, x, y, centerX, centerY }
}

function showRipple(event: MouseEvent | Touch | null, host: HTMLElement, options: RippleOptions) {
	const container = document.createElement('span')
	const animation = document.createElement('span')

	container.appendChild(animation)
	container.className = 'ripple__container'

	if (options.className) {
		container.className += ` ${options.className}`
	}

	const { radius, scale, x, y, centerX, centerY } = calculate(event, host, options)
	const size = `${radius * 2}px`

	animation.className = 'ripple__animation ripple__animation--enter'
	animation.style.width = size
	animation.style.height = size
	animation.style.transform = `translate(${x}px, ${y}px) scale3d(${scale},${scale},${scale})`

	host.appendChild(container)

	if (window.getComputedStyle(host).position === 'static') {
		host.style.position = 'relative'
		host.dataset.ripplePrevPosition = 'static'
	}

	animation.dataset.activated = String(performance.now())

	requestAnimationFrame(() => {
		requestAnimationFrame(() => {
			animation.classList.remove('ripple__animation--enter')
			animation.classList.add('ripple__animation--in')
			animation.style.transform = `translate(${centerX}px, ${centerY}px) scale3d(1,1,1)`
		})
	})
}

function hideRipple(host: HTMLElement) {
	const animations = host.getElementsByClassName('ripple__animation')

	if (animations.length === 0) {
		return
	}

	const animation = Array.from(animations).findLast(
		candidate => !(candidate as HTMLElement).dataset.isHiding
	) as HTMLElement | undefined

	if (!animation) {
		return
	}

	animation.dataset.isHiding = 'true'

	const shown = performance.now() - Number(animation.dataset.activated)
	const delay = Math.max(GROW_MS - shown, 0)

	setTimeout(() => {
		animation.classList.remove('ripple__animation--in')
		animation.classList.add('ripple__animation--out')

		setTimeout(() => {
			const remaining = host.getElementsByClassName('ripple__animation')

			if (remaining.length === 1 && host.dataset.ripplePrevPosition) {
				host.style.position = host.dataset.ripplePrevPosition
				delete host.dataset.ripplePrevPosition
			}

			if (animation.parentNode?.parentNode === host) {
				host.removeChild(animation.parentNode)
			}
		}, FADE_MS)
	}, delay)
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

		if (clips) {
			host.classList.add(RIPPLE_HOST_CLASS)
		}

		const onMouseDown = (event: MouseEvent) => {
			if (event.button === 0) {
				handleShow(event, false)
			}
		}

		const onMouseUp = (event: MouseEvent) => {
			if (event.button === 0) {
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

		host.addEventListener('mousedown', onMouseDown)
		host.addEventListener('mouseup', onMouseUp)
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
			}

			host.removeEventListener('mousedown', onMouseDown)
			host.removeEventListener('mouseup', onMouseUp)
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
