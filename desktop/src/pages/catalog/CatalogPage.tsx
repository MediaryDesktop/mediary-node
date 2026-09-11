import { useTranslation } from '@shared/i18n'
import { Placeholder } from '@shared/ui'

export function CatalogPage() {
	const { t } = useTranslation()

	return (
		<Placeholder icon='common/search' title={t('nav.catalog')} description={t('placeholder.catalog')} />
	)
}
