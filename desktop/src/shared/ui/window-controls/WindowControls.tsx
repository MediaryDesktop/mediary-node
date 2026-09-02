import clsx from 'clsx'
import { useEffect, useState } from 'react'

import { useTranslation } from '../../i18n'
import { Icon } from '../icon/Icon'

import styles from './WindowControls.module.scss'

export interface WindowControlsProps {
	className?: string
}

export function WindowControls({ className }: WindowControlsProps) {
	const { t } = useTranslation()
	const [maximized, setMaximized] = useState(false)

	useEffect(() => {
		let cancelled = false

		window.mediary.window.isMaximized().then(value => {
			if (!cancelled) setMaximized(value)
		})

		const unsubscribe = window.mediary.window.onMaximizedChange(setMaximized)

		return () => {
			cancelled = true
			unsubscribe()
		}
	}, [])

	return (
		<div className={clsx(styles.root, className)}>
			<button
				type='button'
				className={styles.button}
				aria-label={t('window.minimize')}
				onClick={() => window.mediary.window.minimize()}
			>
				<Icon name='common/minimize' size={18} />
			</button>

			<button
				type='button'
				className={styles.button}
				aria-label={t(maximized ? 'window.restore' : 'window.maximize')}
				onClick={() => window.mediary.window.toggleMaximize()}
			>
				<Icon name={maximized ? 'common/restore' : 'common/maximize'} size={18} />
			</button>

			<button
				type='button'
				className={clsx(styles.button, styles.close)}
				aria-label={t('window.close')}
				onClick={() => window.mediary.window.close()}
			>
				<Icon name='common/close' size={18} />
			</button>
		</div>
	)
}
