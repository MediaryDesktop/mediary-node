import { useTranslation } from '../../i18n'
import { Button } from '../button/Button'
import { Notice, noticeActionVariant } from '../notice/Notice'

export interface LoadFailedProps {
	message?: string
	onRetry: () => void
	retrying?: boolean
	className?: string
}

export function LoadFailed({ message, onRetry, retrying = false, className }: LoadFailedProps) {
	const { t } = useTranslation()

	return (
		<Notice
			className={className}
			tone='danger'
			action={
				<Button
					size='small'
					variant={noticeActionVariant('danger')}
					loading={retrying}
					onClick={onRetry}
				>
					{t('common.retry')}
				</Button>
			}
		>
			{message ?? t('common.loadFailed')}
		</Notice>
	)
}
