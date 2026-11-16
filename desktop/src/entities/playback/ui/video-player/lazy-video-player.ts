import { lazy } from 'react'

// The player brings hls.js and the subtitle renderer with it — most of the
// renderer's code by weight — and nobody needs either before pressing play.
// It is a chunk of its own, read from disk the first time a video opens.
export const VideoPlayer = lazy(() =>
	import('./VideoPlayer').then(module => ({ default: module.VideoPlayer }))
)
