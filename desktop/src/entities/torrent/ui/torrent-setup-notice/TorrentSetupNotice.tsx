import { useTranslation } from '@shared/i18n'
import { Notice } from '@shared/ui'

import type { TorrentSetup } from '../../lib/useTorrentSetup'

export interface TorrentSetupNoticeProps {
	setup: TorrentSetup
	needSearch?: boolean
	onOpenSettings: (missing: TorrentSetupGap) => void
}

export type TorrentSetupGap = 'client' | 'sources'

export function TorrentSetupNotice({ setup, needSearch, onOpenSettings }: TorrentSetupNoticeProps) {
	const { t } = useTranslation()

	if (!setup.loaded) {
		return null
	}

	if (!setup.clientConfigured) {
		return (
			<Notice
				tone='warning'
				title={t('torrents.setup.noClient')}
				actionLabel={t('torrents.setup.openSettings')}
				onAction={() => onOpenSettings('client')}
			>
				{t('torrents.setup.noClientHint')}
			</Notice>
		)
	}

	if (setup.clientReachable === false) {
		return (
			<Notice
				tone='danger'
				title={t('torrents.setup.unreachable')}
				actionLabel={t('torrents.setup.openSettings')}
				onAction={() => onOpenSettings('client')}
			>
				{setup.clientError}
			</Notice>
		)
	}

	if (needSearch && !setup.hasSources) {
		return (
			<Notice
				tone='info'
				title={t('torrents.setup.noSources')}
				actionLabel={t('torrents.setup.openSettings')}
				onAction={() => onOpenSettings('sources')}
			>
				{t('torrents.setup.noSourcesHint')}
			</Notice>
		)
	}

	return null
}
