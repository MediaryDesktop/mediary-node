import { useSyncExternalStore } from 'react'

import type { Theme } from '../config/config'
import { getTheme, subscribeTheme } from '../lib/theme'

export function useTheme(): Theme {
	return useSyncExternalStore(subscribeTheme, getTheme)
}
