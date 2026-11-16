import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'

export interface CardPlayContext {
	mediaRef: string
	mediaType: string
	title: string
	label: string
	progress: number
	listed: boolean
	trailer: boolean
	onOpen?: () => void
	onDownload?: () => void
}

// What the hover panel of a media card borrows from the layers above it: the
// card knows the title, the app knows how a title is played.
export interface MediaCardSlots {
	play?: (context: CardPlayContext) => ReactNode
}

const MediaCardSlotsContext = createContext<MediaCardSlots>({})

export const MediaCardSlotsProvider = MediaCardSlotsContext.Provider

export function useMediaCardSlots(): MediaCardSlots {
	return useContext(MediaCardSlotsContext)
}
