import clsx from 'clsx'

import styles from './PosterFade.module.scss'

export interface PosterFadeProps {
	src: string
	className?: string
}

export function PosterFade({ src, className }: PosterFadeProps) {
	return (
		<span className={clsx(styles.fade, className)} aria-hidden>
			<img src={src} alt='' loading='lazy' decoding='async' draggable={false} />
		</span>
	)
}
