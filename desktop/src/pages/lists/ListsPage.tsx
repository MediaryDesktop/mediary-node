import { useTranslation } from '@shared/i18n'
import { Placeholder } from '@shared/ui'

export function ListsPage() {
	const { t } = useTranslation()

	return (
		<Placeholder icon='common/list-checks' title={t('nav.lists')} description={t('placeholder.lists')} />
	)
}
