import type { ReactNode } from 'react'

import { SetupCard } from '../layout'

export interface SetupAniListStepProps {
	connect: ReactNode
}

export function SetupAniListStep({ connect }: SetupAniListStepProps) {
	return <SetupCard>{connect}</SetupCard>
}
