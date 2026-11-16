import type { ReactNode } from 'react'

import { useSurfaceTheme } from '@shared/style/theme'
import { Toaster } from '@shared/ui'

import { MediaCardSlotsProvider } from '@entities/media'

import { MEDIA_CARD_SLOTS } from './card-play/CardPlay'

export function AppProviders({ children }: { children: ReactNode }) {
	const theme = useSurfaceTheme()

	return (
		<MediaCardSlotsProvider value={MEDIA_CARD_SLOTS}>
			{children}
			<Toaster theme={theme} />
		</MediaCardSlotsProvider>
	)
}
