import { useState } from 'react'

export interface EpisodeImageProps {
	// Tried in order, each one only once the previous has failed to load.
	sources: (string | null | undefined)[]
	className?: string
}

// An episode's still comes from wherever it can: the source's own, a frame the
// node cuts from the file, the title's banner. Any of them can be missing or
// fail, and the next one is tried without the card going blank.
export function EpisodeImage({ sources, className }: EpisodeImageProps) {
	const candidates = sources.filter((source): source is string => Boolean(source))

	return <FallbackImage key={candidates.join('\n')} candidates={candidates} className={className} />
}

function FallbackImage({ candidates, className }: { candidates: string[]; className?: string }) {
	const [failed, setFailed] = useState(0)
	const source = candidates[failed]

	if (!source) {
		return null
	}

	return (
		<img
			className={className}
			src={source}
			alt=''
			loading='lazy'
			decoding='async'
			onError={() => setFailed(count => count + 1)}
		/>
	)
}
