import type { RippleOptions } from './types'

// Grow and fade are read back from the DOM when hiding, so a ripple that was
// released early still completes its spread before it fades.
export const GROW_MS = 250
export const FADE_MS = 300

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

export function showRipple(event: MouseEvent | Touch | null, host: HTMLElement, options: RippleOptions) {
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

export function hideRipple(host: HTMLElement) {
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
