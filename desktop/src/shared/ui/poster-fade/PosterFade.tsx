import clsx from 'clsx'

import styles from './PosterFade.module.scss'

export interface PosterFadeProps {
	src: string
	className?: string
}

// A poster laid under a card's left side, fading into the card's own colour. The
// card needs `isolation: isolate` and `overflow: hidden` for it to sit right.
export function PosterFade({ src, className }: PosterFadeProps) {
	return (
		<span className={clsx(styles.fade, className)} aria-hidden>
			<img src={src} alt='' loading='lazy' decoding='async' draggable={false} />
		</span>
	)
}
