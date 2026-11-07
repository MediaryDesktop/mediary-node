import clsx from 'clsx'

import { useTranslation } from '../../i18n'
import { Button } from '../button/Button'
import { Icon } from '../icon/Icon'

import styles from './WindowControls.module.scss'

export interface WindowControlsProps {
	maximized: boolean
	onMinimize: () => void
	onToggleMaximize: () => void
	onClose: () => void
	className?: string
}

export function WindowControls({
	maximized,
	onMinimize,
	onToggleMaximize,
	onClose,
	className
}: WindowControlsProps) {
	const { t } = useTranslation()

	return (
		<div className={clsx(styles.root, className)}>
			<Button
				variant='chrome'
				iconOnly
				aria-label={t('window.minimize')}
				startIcon={<Icon name='common/minimize' size={18} />}
				onClick={onMinimize}
			/>

			<Button
				variant='chrome'
				iconOnly
				aria-label={t(maximized ? 'window.restore' : 'window.maximize')}
				startIcon={<Icon name={maximized ? 'common/restore' : 'common/maximize'} size={18} />}
				onClick={onToggleMaximize}
			/>

			<Button
				variant='chrome-close'
				iconOnly
				aria-label={t('window.close')}
				startIcon={<Icon name='common/close' size={18} />}
				onClick={onClose}
			/>
		</div>
	)
}
