// A rule counts one run of episodes, the way anime numbers them. A show
// numbered by season (a TMDB series) is not something the node can follow yet,
// so it is offered no rule at all rather than one that would never match.
export function supportsAutoDownload(mediaRef: string): boolean {
	return !mediaRef.startsWith('tmdb:tv:')
}
