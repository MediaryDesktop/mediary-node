import { allSettled, fork } from 'effector'
import { describe, expect, it, vi } from 'vitest'

import type { PipIntent } from '@shared/bridge'

import { $pipResume, dismissPipFx, openPipFx, pinRequested, pipClosed, pipResumeApplied } from './pip'
import { $playerExpanded, $playerFileId, $playerPinned, playerOpened } from './player-session'

const OPTIONS = { fileId: 7, position: 312, playing: true, aspect: 16 / 9 }

function closed(intent: PipIntent) {
	return { intent, position: 401, playing: false }
}

async function pinnedScope(opened = true) {
	const dismiss = vi.fn(() => Promise.resolve())
	const scope = fork({
		handlers: [
			[openPipFx, () => Promise.resolve(opened)],
			[dismissPipFx, dismiss]
		]
	})

	await allSettled(playerOpened, { scope, params: OPTIONS.fileId })
	await allSettled(pinRequested, { scope, params: OPTIONS })

	return { scope, dismiss }
}

describe('pinned player', () => {
	it('is pinned once the shell has opened the window', async () => {
		const { scope } = await pinnedScope()

		expect(scope.getState($playerPinned)).toBe(true)
	})

	it('stays on the page when the window could not open', async () => {
		const { scope } = await pinnedScope(false)

		expect(scope.getState($playerPinned)).toBe(false)
	})

	it('comes back as the mini player where the window left off', async () => {
		const { scope } = await pinnedScope()

		await allSettled(pipClosed, { scope, params: closed('mini') })

		expect(scope.getState($playerPinned)).toBe(false)
		expect(scope.getState($playerFileId)).toBe(OPTIONS.fileId)
		expect(scope.getState($pipResume)).toEqual({ position: 401, playing: false })

		await allSettled(pipResumeApplied, { scope })

		expect(scope.getState($pipResume)).toBeNull()
	})

	it('comes back full size when the window asked to expand', async () => {
		const { scope } = await pinnedScope()

		await allSettled(pipClosed, { scope, params: closed('expand') })

		expect(scope.getState($playerExpanded)).toBe(true)
		expect(scope.getState($pipResume)).toEqual({ position: 401, playing: false })
	})

	it('ends playback when the window was stopped', async () => {
		const { scope } = await pinnedScope()

		await allSettled(pipClosed, { scope, params: closed('stop') })

		expect(scope.getState($playerFileId)).toBeNull()
		expect(scope.getState($pipResume)).toBeNull()
	})

	it('takes the window with it when another video opens', async () => {
		const { scope, dismiss } = await pinnedScope()

		await allSettled(playerOpened, { scope, params: 8 })

		expect(scope.getState($playerPinned)).toBe(false)
		expect(dismiss).toHaveBeenCalledTimes(1)
	})
})
