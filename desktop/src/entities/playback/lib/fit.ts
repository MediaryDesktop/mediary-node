const FILL_TOLERANCE = 0.03

export function videoFit(stageAspect: number, videoAspect: number): 'cover' | 'contain' {
	if (!(stageAspect > 0) || !(videoAspect > 0)) {
		return 'contain'
	}

	return Math.abs(stageAspect - videoAspect) / videoAspect <= FILL_TOLERANCE ? 'cover' : 'contain'
}

interface PictureSize {
	width?: number
	height?: number
}

interface PictureInfo {
	video?: PictureSize | null
	videos?: PictureSize[] | null
}

const DEFAULT_ASPECT = 16 / 9

// Width over height of the picture, for a window sized to it before the video
// has loaded; widescreen when the node did not say.
export function pictureAspect(info: PictureInfo): number {
	const video = info.video ?? info.videos?.[0]

	return video?.width && video.height ? video.width / video.height : DEFAULT_ASPECT
}
