// The always-on-top window the mini player can be pinned into.

// Where playback stood, so the player in the other window carries on from there.
export interface PipSnapshot {
	position: number
	playing: boolean
}

export interface PipOpenOptions extends PipSnapshot {
	fileId: number
	/** Width over height of the picture. */
	aspect: number
}

// What the user asked for as the window went: back to the mini player, to the
// full one, or to stop watching.
export type PipIntent = 'mini' | 'expand' | 'stop'

export interface PipResult extends PipSnapshot {
	intent: PipIntent
}
