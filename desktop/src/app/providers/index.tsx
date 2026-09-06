import type { ReactNode } from 'react'

import { useSurfaceTheme } from '@shared/style/theme'
import { Toaster } from '@shared/ui'

export function AppProviders({ children }: { children: ReactNode }) {
	const theme = useSurfaceTheme()

	return (
		<>
			{children}
			<Toaster theme={theme} />
		</>
	)
}
