import { useEffect, useState } from 'react'

import type { UpdateState } from '@shared/bridge'

export interface AppUpdate {
	state: UpdateState
	installing: boolean
	onInstall: () => void
}

// A newer release, as the shell's updater sees it, and the way to put it in place.
export function useAppUpdate(): AppUpdate {
	const [state, setState] = useState<UpdateState>({ kind: 'none' })
	const [installing, setInstalling] = useState(false)

	useEffect(() => {
		let cancelled = false

		void window.mediary.update.state().then(value => {
			if (!cancelled) {
				setState(value)
			}
		})

		const unsubscribe = window.mediary.update.onStateChange(setState)

		return () => {
			cancelled = true
			unsubscribe()
		}
	}, [])

	return {
		state,
		installing,
		onInstall: () => {
			setInstalling(true)
			void window.mediary.update.install().finally(() => setInstalling(false))
		}
	}
}
