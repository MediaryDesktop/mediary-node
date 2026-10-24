import { useState } from 'react'

import { Icon } from '@shared/ui'
import type { IconName } from '@shared/ui'

import { LOCAL_SOURCE } from '@entities/reader'

import styles from './SourceIcon.module.scss'

export interface SourceIconProps {
	source: string
	name: string
	// A manga plugin's own icon, from its manifest.
	image?: string
	size?: number
}

function builtIn(source: string): IconName | null {
	if (source === LOCAL_SOURCE) {
		return 'common/folder'
	}
	if (source.startsWith('opds:')) {
		return 'common/database'
	}
	if (source === 'mangadex') {
		return 'common/book-open'
	}

	return null
}

// A plugin shows its manifest icon, or its first letter when there is none or
// it does not load.
export function SourceIcon({ source, name, image, size = 16 }: SourceIconProps) {
	const [broken, setBroken] = useState(false)
	const icon = builtIn(source)

	if (icon) {
		return <Icon name={icon} size={size} className={styles.icon} />
	}
	if (image && !broken) {
		return (
			<img
				className={styles.image}
				src={image}
				alt=''
				width={size}
				height={size}
				referrerPolicy='no-referrer'
				onError={() => setBroken(true)}
			/>
		)
	}

	return (
		<span className={styles.letter} style={{ width: size, height: size }}>
			{name.slice(0, 1).toUpperCase()}
		</span>
	)
}
