import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { useTranslation } from '@shared/i18n'
import { Notice } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { $playerMode } from '@entities/playback'
import { toolsQuery } from '@entities/tool'

export interface MissingPlayerNoticeProps {
	className?: string
}

// mpv is the chosen player but the node finds it nowhere: every episode would
// fail to open, so the setting says so and points at the tab that installs it.
export function MissingPlayerNotice({ className }: MissingPlayerNoticeProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [mode, data, load, nodeReady] = useUnit([
		$playerMode,
		toolsQuery.$data,
		toolsQuery.start,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	const mpv = data?.tools?.find(tool => tool.id === 'mpv')

	if (mode !== 'external' || mpv?.state !== 'missing') {
		return null
	}

	return (
		<div className={className}>
			<Notice
				tone='warning'
				title={t('settings.player.mpvMissing.title')}
				actionLabel={t('player.openDependencies')}
				onAction={() => void navigate({ to: '/extensions', search: { tab: 'dependencies' } })}
			>
				{t('settings.player.mpvMissing.description')}
			</Notice>
		</div>
	)
}
