import type { ReactNode } from 'react'

import { SetupCard } from '../layout'

export interface SetupDownloadingStepProps {
	// The real torrent-client settings, composed in by the page: which client —
	// built-in, qBittorrent, or a debrid service — and its connection.
	content: ReactNode
}

export function SetupDownloadingStep({ content }: SetupDownloadingStepProps) {
	return <SetupCard>{content}</SetupCard>
}
