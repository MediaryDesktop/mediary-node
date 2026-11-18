import { useState } from 'react'

import styles from './PluginIcon.module.scss'

export interface PluginIconProps {
	name: string
	icon?: string
}

export function PluginIcon({ name, icon }: PluginIconProps) {
	const [broken, setBroken] = useState(false)

	if (icon && !broken) {
		return <img src={icon} alt='' referrerPolicy='no-referrer' onError={() => setBroken(true)} />
	}

	return <span className={styles.letter}>{name.slice(0, 1).toUpperCase()}</span>
}
