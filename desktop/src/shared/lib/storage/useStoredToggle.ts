import { useState } from 'react'

import { readStored, writeStored } from './storage'

// An open/closed switch of the interface — a settings panel, say — that the
// viewer finds as they left it next time.
export function useStoredToggle(key: string): [boolean, () => void] {
	const [on, setOn] = useState(() => readStored(key) === 'on')

	const toggle = () => {
		writeStored(key, on ? 'off' : 'on')
		setOn(!on)
	}

	return [on, toggle]
}
