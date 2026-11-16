import { createEffect, createEvent, sample } from 'effector'

import { HttpRequestError, problemDetail } from '@shared/api'
import { onEach } from '@shared/factory'
import { translate } from '@shared/i18n'
import { toast } from '@shared/ui'

import { addTorrentFx } from '@entities/torrent'
import type { TorrentDownload } from '@entities/torrent'

export interface EpisodeDownload {
	mediaRef: string
	title: string
	episode?: number
	season?: number
	// What the toasts call it: "Frieren · Episode 12".
	label: string
}

// One click downloads an episode: the node searches for it and takes the best
// release by the profile, and from a batch only the episode's files.
export const episodeDownloadRequested = createEvent<EpisodeDownload>()

const autoAddFx = createEffect((target: EpisodeDownload): Promise<TorrentDownload> =>
	addTorrentFx({
		media_ref: target.mediaRef,
		title: target.title,
		auto: true,
		episode: target.episode,
		season: target.season
	})
)

function toastId(target: EpisodeDownload): string {
	return `episode-download:${target.mediaRef}:${target.season ?? ''}:${target.episode ?? ''}`
}

sample({ clock: episodeDownloadRequested, target: autoAddFx })

onEach(episodeDownloadRequested, target =>
	toast.loading(translate('media.card.autoDownload.searching', { label: target.label }), {
		id: toastId(target)
	})
)

onEach(autoAddFx.done, ({ params }) =>
	toast.success(translate('media.card.autoDownload.started', { label: params.label }), {
		id: toastId(params)
	})
)

onEach(autoAddFx.fail, ({ params, error }) =>
	toast.error(
		problemDetail(
			HttpRequestError.fromUnknown(error),
			translate('media.card.autoDownload.failed', { label: params.label })
		),
		{ id: toastId(params) }
	)
)
