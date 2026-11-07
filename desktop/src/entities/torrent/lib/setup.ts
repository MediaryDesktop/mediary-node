export interface SetupParts {
	loaded: boolean
	clientConfigured: boolean
	clientReachable: boolean | null
	hasSources: boolean
}

// Whether anything that downloads torrents by itself would fail for want of
// setup: no client, a client the node cannot reach, or nowhere to search. Not
// known until the setup has loaded, so not "incomplete" before then either —
// otherwise every screen would flash a setup warning on its way in.
export function isSetupIncomplete({
	loaded,
	clientConfigured,
	clientReachable,
	hasSources
}: SetupParts): boolean {
	return loaded && (!clientConfigured || clientReachable === false || !hasSources)
}
