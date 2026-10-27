import { useState } from 'react'

import { Icon } from '@shared/ui'
import type { IconName } from '@shared/ui'

import styles from './SourceOptionIcon.module.scss'

export interface SourceOptionIconProps {
	source: string
	name: string
	// The source plugin's own icon, from its manifest.
	image?: string
}

function builtIn(source: string): IconName | null {
	if (source.startsWith('opds:')) {
		return 'common/database'
	}

	return null
}

// A plugin source shows its manifest icon, or its first letter when there is
// none or it does not load.
export function SourceOptionIcon({ source, name, image }: SourceOptionIconProps) {
	const [broken, setBroken] = useState(false)
	const icon = builtIn(source)

	if (icon) {
		return <Icon name={icon} size={16} className={styles.icon} />
	}
	if (image && !broken) {
		return (
			<img
				className={styles.image}
				src={image}
				alt=''
				width={16}
				height={16}
				referrerPolicy='no-referrer'
				onError={() => setBroken(true)}
			/>
		)
	}

	return <span className={styles.letter}>{name.slice(0, 1).toUpperCase()}</span>
}
