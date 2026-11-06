import { redirect } from '@tanstack/react-router'

import { readStored, writeStored } from '@shared/lib'

const STORAGE_KEY = 'mediary.hasLaunched'

export function redirectFirstLaunchToDiscover() {
	if (readStored(STORAGE_KEY) === 'true') {
		return
	}

	writeStored(STORAGE_KEY, 'true')

	throw redirect({ to: '/discover' })
}
