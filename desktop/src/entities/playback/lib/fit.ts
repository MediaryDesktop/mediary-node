const FILL_TOLERANCE = 0.03

export function videoFit(stageAspect: number, videoAspect: number): 'cover' | 'contain' {
	if (!(stageAspect > 0) || !(videoAspect > 0)) {
		return 'contain'
	}

	return Math.abs(stageAspect - videoAspect) / videoAspect <= FILL_TOLERANCE ? 'cover' : 'contain'
}
