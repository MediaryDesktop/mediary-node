import { useTranslation } from '@shared/i18n'
import { Placeholder } from '@shared/ui'

export function DiscoverPage() {
	const { t } = useTranslation()

	return (
		<Placeholder
			icon='common/compass'
			title={t('nav.discover')}
			description={t('placeholder.discover')}
		/>
	)
}
