import { useState } from 'react'

export interface FallbackImageProps {
	sources: (string | null | undefined)[]
	className?: string
}

export function FallbackImage({ sources, className }: FallbackImageProps) {
	const candidates = sources.filter((source): source is string => Boolean(source))

	return <Candidate key={candidates.join('\n')} candidates={candidates} className={className} />
}

function Candidate({ candidates, className }: { candidates: string[]; className?: string }) {
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
