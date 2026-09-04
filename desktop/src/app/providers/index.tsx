import type { ReactNode } from 'react'

import { useTheme } from '@shared/style/theme'
import { Toaster } from '@shared/ui'

export function AppProviders({ children }: { children: ReactNode }) {
	const theme = useTheme()

	return (
		<>
			{children}
			<Toaster theme={theme} />
		</>
	)
}
