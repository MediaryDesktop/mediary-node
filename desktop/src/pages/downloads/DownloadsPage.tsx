import { useTranslation } from '@shared/i18n'
import { Placeholder } from '@shared/ui'

export function DownloadsPage() {
	const { t } = useTranslation()

	return (
		<Placeholder
			icon='common/download'
			title={t('nav.downloads')}
			description={t('placeholder.downloads')}
		/>
	)
}
