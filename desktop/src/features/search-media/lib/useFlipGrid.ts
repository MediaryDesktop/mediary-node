import { useEffect, useLayoutEffect, useRef } from 'react'
import type { RefObject } from 'react'

const DURATION_MS = 320
const EASING = 'cubic-bezier(0.2, 0, 0, 1)'

type Point = { x: number; y: number }

function snapshot(grid: HTMLElement): Map<Element, Point> {
	const points = new Map<Element, Point>()
	for (const child of Array.from(grid.children) as HTMLElement[]) {
		// Координати відносно самої сітки: зсув сторінки чи шапки не робить знімок застарілим.
		// offset* не залежать від поточного transform, тож знімок не ламається посеред анімації.
		points.set(child, { x: child.offsetLeft - grid.offsetLeft, y: child.offsetTop - grid.offsetTop })
	}
	return points
}

/**
 * FLIP для сітки: розкладка змінюється миттєво (один раз), а картки плавно
 * переїжджають зі старих позицій у нові. Спрацьовує, коли змінюється `trigger`.
 * Анімується лише translate, розмір карток змінюється одразу.
 */
export function useFlipGrid(gridRef: RefObject<HTMLElement | null>, trigger: unknown) {
	const previous = useRef<Map<Element, Point>>(new Map())
	const lastTrigger = useRef(trigger)
	const observed = useRef<{ grid: HTMLElement; observer: ResizeObserver } | null>(null)

	useLayoutEffect(() => {
		const grid = gridRef.current

		if (observed.current && observed.current.grid !== grid) {
			observed.current.observer.disconnect()
			observed.current = null
			previous.current = new Map()
		}

		if (!grid) return

		const triggerChanged = lastTrigger.current !== trigger
		lastTrigger.current = trigger

		if (triggerChanged && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			for (const child of Array.from(grid.children) as HTMLElement[]) {
				const from = previous.current.get(child)
				if (!from) continue

				const dx = from.x - (child.offsetLeft - grid.offsetLeft)
				const dy = from.y - (child.offsetTop - grid.offsetTop)
				if (dx === 0 && dy === 0) continue

				// Не анімуємо те, що поза екраном: на довгих списках це зайве навантаження
				const rect = child.getBoundingClientRect()
				if (rect.bottom < -200 || rect.top > window.innerHeight + 200) continue

				child.animate(
					[{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }],
					{ duration: DURATION_MS, easing: EASING }
				)
			}
		}

		previous.current = snapshot(grid)

		// Поки сторінка «доростає» після входу (шрифти, скролбар, дані трекера), знімок тримається свіжим
		if (!observed.current) {
			const observer = new ResizeObserver(() => {
				previous.current = snapshot(grid)
			})
			observer.observe(grid)
			observed.current = { grid, observer }
		}
	})

	useEffect(
		() => () => {
			observed.current?.observer.disconnect()
			observed.current = null
		},
		[]
	)
}
