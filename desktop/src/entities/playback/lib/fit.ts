// A letterbox of a few pixels is worse than a few pixels of picture: when the window
// is within this share of the video's own proportions, the picture fills it and the
// overflow is cropped away instead.
const FILL_TOLERANCE = 0.03

export function videoFit(stageAspect: number, videoAspect: number): 'cover' | 'contain' {
	if (!(stageAspect > 0) || !(videoAspect > 0)) {
		return 'contain'
	}

	return Math.abs(stageAspect - videoAspect) / videoAspect <= FILL_TOLERANCE ? 'cover' : 'contain'
}
