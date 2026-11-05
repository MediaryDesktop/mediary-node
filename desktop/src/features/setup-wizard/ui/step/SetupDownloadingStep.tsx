import type { ReactNode } from 'react'

export interface SetupDownloadingStepProps {
	// The real torrent-client settings, composed in by the page: which client —
	// built-in, qBittorrent, or a debrid service — and its connection. It
	// already renders its own card, so this step doesn't wrap it in another.
	content: ReactNode
}

export function SetupDownloadingStep({ content }: SetupDownloadingStepProps) {
	return <>{content}</>
}
