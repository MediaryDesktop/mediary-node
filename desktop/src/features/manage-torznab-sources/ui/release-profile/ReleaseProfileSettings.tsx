import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Input, SelectDropdown, Switch, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	debridService,
	putTorrentProfileMutation,
	torrentProfileQuery,
	torrentSettingsQuery
} from '@entities/torrent'
import type { TorrentProfile } from '@entities/torrent'

import styles from './ReleaseProfileSettings.module.scss'

const RESOLUTIONS = ['2160p', '1080p', '720p', '480p'] as const
const CODECS = ['HEVC', 'AVC', 'AV1'] as const

// The node's "any" is an empty string, which a dropdown cannot hold as a value.
const ANY = 'any'

// Words are typed as one comma-separated line; the order is the preference.
function words(line: string): string[] {
	return line
		.split(',')
		.map(word => word.trim())
		.filter(Boolean)
}

// What the user likes in a release. Search ranks by it and names the best result.
export function ReleaseProfileSettings() {
	const [profile, load, nodeReady] = useUnit([
		torrentProfileQuery.$data,
		torrentProfileQuery.start,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	if (!profile) {
		return null
	}

	// Mounted afresh when the saved profile changes, so the fields start from it.
	return <ProfileForm key={JSON.stringify(profile)} profile={profile} />
}

function ProfileForm({ profile }: { profile: TorrentProfile }) {
	const { t } = useTranslation()

	const [save, saving, settings] = useUnit([
		putTorrentProfileMutation.start,
		putTorrentProfileMutation.$pending,
		torrentSettingsQuery.$data
	])

	const [resolution, setResolution] = useState(profile.resolution)
	const [codec, setCodec] = useState(profile.codec)
	const [preferred, setPreferred] = useState((profile.preferred ?? []).join(', '))
	const [excluded, setExcluded] = useState((profile.excluded ?? []).join(', '))
	const [minSeeders, setMinSeeders] = useState(String(profile.min_seeders))
	const [preferCached, setPreferCached] = useState(profile.prefer_cached)

	// Only a debrid service that can say what it holds makes this mean anything;
	// with another client the choice is kept but not offered.
	const service = debridService(settings?.client)
	const debrid = service?.cacheCheck === true

	useUnitWatch(putTorrentProfileMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('torrents.profile.saveFailed')), { id: 'torrent-profile' })
	)

	const submit = () =>
		save({
			resolution,
			codec,
			preferred: words(preferred),
			excluded: words(excluded),
			min_seeders: Math.max(0, Number(minSeeders) || 0),
			prefer_cached: preferCached
		})

	return (
		<div className={styles.root}>
			<div className={styles.row}>
				<label className={styles.field}>
					{t('torrents.profile.resolution')}
					<SelectDropdown
						options={[
							{ value: ANY, label: t('torrents.profile.any') },
							...RESOLUTIONS.map(value => ({ value, label: value }))
						]}
						value={resolution || ANY}
						onChange={value =>
							setResolution(
								(value && value !== ANY ? value : '') as TorrentProfile['resolution']
							)
						}
						disabled={saving}
					/>
				</label>

				<label className={styles.field}>
					{t('torrents.profile.codec')}
					<SelectDropdown
						options={[
							{ value: ANY, label: t('torrents.profile.any') },
							...CODECS.map(value => ({ value, label: value }))
						]}
						value={codec || ANY}
						onChange={value =>
							setCodec((value && value !== ANY ? value : '') as TorrentProfile['codec'])
						}
						disabled={saving}
					/>
				</label>

				<label className={styles.field}>
					{t('torrents.profile.minSeeders')}
					<Input
						type='number'
						min={0}
						value={minSeeders}
						onChange={event => setMinSeeders(event.target.value)}
						disabled={saving}
					/>
				</label>
			</div>

			<label className={styles.field}>
				{t('torrents.profile.preferred')}
				<Input
					value={preferred}
					onChange={event => setPreferred(event.target.value)}
					disabled={saving}
					spellCheck={false}
					placeholder='AniLiberty, SubsPlease, Erai-raws'
				/>
			</label>

			<label className={styles.field}>
				{t('torrents.profile.excluded')}
				<Input
					value={excluded}
					onChange={event => setExcluded(event.target.value)}
					disabled={saving}
					spellCheck={false}
					placeholder='Dub, CAM'
				/>
			</label>

			{debrid && (
				<Switch
					checked={preferCached}
					onChange={setPreferCached}
					label={t('torrents.profile.preferCached', { service: service?.name ?? '' })}
					disabled={saving}
				/>
			)}

			<Button size='small' loading={saving} onClick={submit}>
				{t('torrents.profile.save')}
			</Button>
		</div>
	)
}
