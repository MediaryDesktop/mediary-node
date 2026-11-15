// What the shell knows about a newer release. `manual` is a release the app
// cannot install by itself (an unsigned macOS build), so the user downloads it.
export type UpdateState =
	| { kind: 'none' }
	| { kind: 'downloading'; version: string }
	| { kind: 'ready'; version: string }
	| { kind: 'manual'; version: string; url: string }
