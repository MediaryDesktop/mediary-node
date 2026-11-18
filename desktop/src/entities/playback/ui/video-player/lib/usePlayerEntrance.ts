import { useUnit } from 'effector-react'

import { useSheetEntrance } from '@shared/lib'
import type { SheetEntrance } from '@shared/lib'

import { $playerOpenedAt } from '../../../model/player-session'

// The player rises as a sheet from the moment it was asked to open, so the
// host that shows it next takes the motion over where the last one left it.
export function usePlayerEntrance(): SheetEntrance {
	return useSheetEntrance(useUnit($playerOpenedAt))
}
