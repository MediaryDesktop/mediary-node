import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'

import { useAfterDelay } from './useAfterDelay'

// How long the sheet motion of shared/style/animation/_sheet-motion.scss runs.
// The stylesheet holds the same two numbers: change them together.
const SHEET_ENTER_MS = 340
const SHEET_LEAVE_MS = 240

export interface SheetEntrance {
	entering: boolean
	style: CSSProperties | undefined
}

// A sheet rising over the window. `openedAt` (a performance.now() reading) is
// when it began to open, so a sheet mounted again before the motion ends goes
// on from where it was instead of starting over; null — it is already open.
export function useSheetEntrance(openedAt: number | null): SheetEntrance {
	const [elapsed] = useState(() => (openedAt === null ? Infinity : performance.now() - openedAt))
	const [entering, setEntering] = useState(elapsed < SHEET_ENTER_MS)

	useEffect(() => {
		if (!entering) {
			return
		}

		const timer = window.setTimeout(() => setEntering(false), SHEET_ENTER_MS - elapsed)

		return () => window.clearTimeout(timer)
	}, [entering, elapsed])

	return { entering, style: entering ? { animationDelay: `${-elapsed}ms` } : undefined }
}

// Calls `onLeft` once the sheet has sunk away.
export function useSheetLeave(leaving: boolean, onLeft: () => void): void {
	useAfterDelay(leaving, SHEET_LEAVE_MS, onLeft)
}
