import { useTranslation } from '@shared/i18n'
import { EmptyState } from '@shared/ui'

export function DownloadsPage() {
	const { t } = useTranslation()

	return (
		<EmptyState
			size='page'
			title={t('nav.downloads')}
			description={t('placeholder.downloads')}
		/>
	)
}
