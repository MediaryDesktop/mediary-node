import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { $nodeState } from '@core/node'
import { nodeStateChanged } from '@core/node'

import { NodeStatusBadge } from './node-status-badge'

/**
 * Proves the test harness works end to end: Effector state, the jsdom
 * `window.mediary` stub from vitest.setup.ts, and React Testing Library.
 *
 * It also pins the behaviour that matters most in this component — a node that
 * is down has to read as the node being down, not as the application being
 * broken.
 */
describe('NodeStatusBadge', () => {
	beforeEach(() => {
		// Stores are module-level, so one test's state would otherwise leak into
		// the next. Effector's reinit puts them back to their initial value.
		$nodeState.reinit()
	})

	it('starts from the supervisor default', () => {
		render(<NodeStatusBadge />)

		expect(screen.getByText('Ноду зупинено')).toBeInTheDocument()
	})

	it('follows supervisor state changes', async () => {
		render(<NodeStatusBadge />)

		nodeStateChanged('starting')
		expect(await screen.findByText('Нода запускається…')).toBeInTheDocument()

		nodeStateChanged('ready')
		expect(await screen.findByText('Ноду підключено')).toBeInTheDocument()

		nodeStateChanged('failed')
		expect(await screen.findByText('Нода не запустилася')).toBeInTheDocument()
	})
})
