import type { ReactNode } from 'react'

export interface SetupDownloadingStepProps {
	content: ReactNode
}

export function SetupDownloadingStep({ content }: SetupDownloadingStepProps) {
	return <>{content}</>
}
