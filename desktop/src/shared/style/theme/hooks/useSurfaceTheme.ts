import { useSyncExternalStore } from 'react'

import type { Theme } from '../config/config'
import { getSurfaceTheme, subscribeTheme } from '../lib/theme'

export function useSurfaceTheme(): Theme {
	return useSyncExternalStore(subscribeTheme, getSurfaceTheme)
}
