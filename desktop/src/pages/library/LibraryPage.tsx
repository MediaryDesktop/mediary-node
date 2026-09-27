import { useNavigate } from '@tanstack/react-router'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, PageHeader, PageTransition } from '@shared/ui'

import styles from './LibraryPage.module.scss'

export function LibraryPage() {
	const { t } = useTranslation()
	const navigate = useNavigate()

	return (
		<PageTransition className={styles.root}>
			<PageHeader
				title={t('nav.library')}
				icon={<Icon name='common/database' size={24} />}
				subtitle={t('library.description')}
				rightContent={
					<Button
						startIcon={<Icon name='common/clock' size={16} />}
						onClick={() => navigate({ to: '/library/history' })}
					>
						{t('library.history.action')}
					</Button>
				}
			/>
		</PageTransition>
	)
}
