import { useTranslation } from '@shared/i18n'
import { Button, Notice } from '@shared/ui'

import type { TorrentSetup } from '../lib/useTorrentSetup'

export interface TorrentSetupNoticeProps {
	setup: TorrentSetup
	// Search and the rules also need a source; a downloads list does not.
	needSearch?: boolean
	onOpenSettings: () => void
}

// Says what is missing before torrents work, and leads to where it is fixed. One
// message at a time, the most basic first: without a client nothing else helps.
export function TorrentSetupNotice({ setup, needSearch, onOpenSettings }: TorrentSetupNoticeProps) {
	const { t } = useTranslation()

	if (!setup.loaded) {
		return null
	}

	const action = (
		<Button size='small' variant='secondary' onClick={onOpenSettings}>
			{t('torrents.setup.openSettings')}
		</Button>
	)

	if (!setup.clientConfigured) {
		return (
			<Notice tone='warning' title={t('torrents.setup.noClient')} action={action}>
				{t('torrents.setup.noClientHint')}
			</Notice>
		)
	}

	if (setup.clientReachable === false) {
		return (
			<Notice tone='danger' title={t('torrents.setup.unreachable')} action={action}>
				{setup.clientError}
			</Notice>
		)
	}

	if (needSearch && !setup.hasSources) {
		return (
			<Notice tone='info' title={t('torrents.setup.noSources')} action={action}>
				{t('torrents.setup.noSourcesHint')}
			</Notice>
		)
	}

	return null
}
