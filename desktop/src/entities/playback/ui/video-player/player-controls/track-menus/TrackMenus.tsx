import { useTranslation } from '@shared/i18n'
import { Button, DropdownMenu, Icon } from '@shared/ui'
import type { DropdownMenuItem, IconName } from '@shared/ui'

import type { MediaInfo } from '../../../../api/api'
import { trackLabel } from '../../../../lib/tracks'

type AudioTrack = NonNullable<MediaInfo['audios']>[number]
type SubtitleTrack = NonNullable<MediaInfo['subtitles']>[number]

export interface TrackMenusProps {
	audios: AudioTrack[]
	audio: number
	onAudio: (index: number) => void
	subtitles: SubtitleTrack[]
	subtitle: number | null
	onSubtitle: (index: number | null) => void
}

// The audio menu shows when there is a choice; subtitles whenever the file has any.
export function TrackMenus({ audios, audio, onAudio, subtitles, subtitle, onSubtitle }: TrackMenusProps) {
	const { t, i18n } = useTranslation()

	const audioItems: DropdownMenuItem[] = audios.map(track => ({
		id: `audio-${track.index}`,
		label: trackLabel(track, i18n.language),
		checked: audio === track.index,
		onSelect: () => onAudio(track.index)
	}))

	const subtitleItems: DropdownMenuItem[] = [
		{
			id: 'off',
			label: t('player.subtitlesOff'),
			checked: subtitle === null,
			onSelect: () => onSubtitle(null)
		},
		...subtitles.map(track => ({
			id: `sub-${track.index}`,
			label: trackLabel(track, i18n.language),
			checked: subtitle === track.index,
			onSelect: () => onSubtitle(track.index)
		}))
	]

	return (
		<>
			{audios.length > 1 && (
				<TrackMenu items={audioItems} icon='common/headphones' label={t('player.audio')} />
			)}

			{subtitles.length > 0 && (
				<TrackMenu items={subtitleItems} icon='common/subtitles' label={t('player.subtitles')} />
			)}
		</>
	)
}

function TrackMenu({ items, icon, label }: { items: DropdownMenuItem[]; icon: IconName; label: string }) {
	return (
		<DropdownMenu
			align='end'
			items={items}
			trigger={
				<Button
					variant='chrome'
					iconOnly
					aria-label={label}
					startIcon={<Icon name={icon} size={22} />}
				/>
			}
		/>
	)
}
