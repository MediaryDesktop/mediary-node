import { useTranslation } from '@shared/i18n'
import { EmptyState } from '@shared/ui'

export function LibraryPage() {
	const { t } = useTranslation()

	return (
		<EmptyState
			size='page'
			title={t('nav.library')}
			description={t('placeholder.library')}
		/>
	)
}
