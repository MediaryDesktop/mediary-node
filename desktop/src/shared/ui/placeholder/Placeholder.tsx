import { Icon } from '../icon/Icon'
import type { IconName } from '../icon/Icon'

import styles from './Placeholder.module.scss'

export interface PlaceholderProps {
	icon: IconName
	title: string
	description: string
}

export function Placeholder({ icon, title, description }: PlaceholderProps) {
	return (
		<div className={styles.root}>
			<span className={styles.icon}>
				<Icon name={icon} size={26} />
			</span>

			<h1 className={styles.title}>{title}</h1>
			<p className={styles.description}>{description}</p>
		</div>
	)
}
