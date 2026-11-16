import { createContext, useContext } from 'react'

type Hold = (held: boolean) => void

const ignore: Hold = () => {}

export const CardHoldContext = createContext<Hold>(ignore)

// A menu opened from a card's hover panel lives in its own portal, so the
// pointer leaving for it would close the panel and the menu with it; the menu
// holds the panel open for as long as it is open itself.
export function useCardHold(): Hold {
	return useContext(CardHoldContext)
}
