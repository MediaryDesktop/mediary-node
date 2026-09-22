import { useTranslation } from '@shared/i18n'
import { EmptyState } from '@shared/ui'

export function DiscoverPage() {
	const { t } = useTranslation()

	return (
		<EmptyState
			size='page'
			title={t('nav.discover')}
			description={t('placeholder.discover')}
		/>
	)
}
