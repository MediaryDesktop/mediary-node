import type { ReactNode } from 'react'

/**
 * The provider tree.
 *
 * Effector needs no provider in a single-scope client application — stores are
 * module-level and `useUnit` reads them directly. A provider appears here only
 * when something genuinely needs React context: the theme, an overlay stack, an
 * error boundary.
 *
 * Cross-module wiring goes in `./wiring`, imported here, so that connecting two
 * modules never requires one to import the other. See docs/architecture.md §4.
 */
export function AppProviders({ children }: { children: ReactNode }) {
	return <>{children}</>
}
