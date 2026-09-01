import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { en } from '@shared/i18n/locales/en'

import { $nodeState } from '@infra/node'
import { nodeStateChanged } from '@infra/node'

import { NodeStatusBadge } from './NodeStatusBadge'

describe('NodeStatusBadge', () => {
	beforeEach(() => {
		$nodeState.reinit()
	})

	it('starts from the supervisor default', () => {
		render(<NodeStatusBadge />)

		expect(screen.getByText(en.node.state.stopped)).toBeInTheDocument()
	})

	it('follows supervisor state changes', async () => {
		render(<NodeStatusBadge />)

		nodeStateChanged('starting')
		expect(await screen.findByText(en.node.state.starting)).toBeInTheDocument()

		nodeStateChanged('ready')
		expect(await screen.findByText(en.node.state.ready)).toBeInTheDocument()

		nodeStateChanged('failed')
		expect(await screen.findByText(en.node.state.failed)).toBeInTheDocument()
	})
})
