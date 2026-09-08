import { Icon } from '@shared/ui'

import styles from './SetupNotice.module.scss'

export interface SetupNoticeProps {
	children: string
}

export function SetupNotice({ children }: SetupNoticeProps) {
	return (
		<div className={styles.notice}>
			<Icon name='common/info' size={18} className={styles.icon} />
			<p className={styles.text}>{children}</p>
		</div>
	)
}
