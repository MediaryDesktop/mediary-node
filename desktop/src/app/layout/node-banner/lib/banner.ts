import type { NodeState } from '@shared/bridge'

export type NodeBannerKind = 'none' | 'recovering' | 'failed'

// A restart that is over in a moment is not worth a banner; one that drags on is.
export const RECOVERING_AFTER_MS = 1_500

// What the shell tells the user about a node that is not there. A node coming
// back by itself is mentioned once it has taken a while; one that was given up
// on is shown at once, with the way to start it — and keeps being shown, with
// that attempt under way, until the node is back.
export function nodeBanner(
	state: NodeState,
	{ lasted, retrying }: { lasted: boolean; retrying: boolean }
): NodeBannerKind {
	if (state === 'failed' || retrying) {
		return state === 'ready' ? 'none' : 'failed'
	}

	if ((state === 'starting' || state === 'restarting') && lasted) {
		return 'recovering'
	}

	return 'none'
}
