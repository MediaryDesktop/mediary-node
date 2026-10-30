import { redirect } from '@tanstack/react-router'

import { readStored, writeStored } from '@shared/lib'

const STORAGE_KEY = 'mediary.hasLaunched'

// Nothing is tracked yet on a fresh install, so Home's rows and stats would
// just be empty — Discover gives a new user something to look at immediately.
// Every later launch lands on Home as usual.
export function redirectFirstLaunchToDiscover() {
	if (readStored(STORAGE_KEY) === 'true') {
		return
	}

	writeStored(STORAGE_KEY, 'true')

	throw redirect({ to: '/discover' })
}
