import clsx from 'clsx'
import { useEffect, useState } from 'react'

import { useTranslation } from '../../i18n'
import { Button } from '../button/Button'
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
			<Button
				variant='chrome'
				iconOnly
				aria-label={t('window.minimize')}
				startIcon={<Icon name='common/minimize' size={18} />}
				onClick={() => window.mediary.window.minimize()}
			/>

			<Button
				variant='chrome'
				iconOnly
				aria-label={t(maximized ? 'window.restore' : 'window.maximize')}
				startIcon={<Icon name={maximized ? 'common/restore' : 'common/maximize'} size={18} />}
				onClick={() => window.mediary.window.toggleMaximize()}
			/>

			<Button
				variant='chrome-close'
				iconOnly
				aria-label={t('window.close')}
				startIcon={<Icon name='common/close' size={18} />}
				onClick={() => window.mediary.window.close()}
			/>
		</div>
	)
}
