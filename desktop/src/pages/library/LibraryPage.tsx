import { useTranslation } from '@shared/i18n'
import { Placeholder } from '@shared/ui'

export function LibraryPage() {
	const { t } = useTranslation()

	return (
		<Placeholder
			icon='common/book-open'
			title={t('nav.library')}
			description={t('placeholder.library')}
		/>
	)
}
