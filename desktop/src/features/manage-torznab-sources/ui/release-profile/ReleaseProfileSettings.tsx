import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Input, SelectDropdown, Switch, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	putTorrentProfileMutation,
	readyDebrid,
	torrentDebridQuery,
	torrentProfileQuery
} from '@entities/torrent'
import type { TorrentProfile } from '@entities/torrent'

import styles from './ReleaseProfileSettings.module.scss'

const RESOLUTIONS = ['2160p', '1080p', '720p', '480p'] as const
const CODECS = ['HEVC', 'AVC', 'AV1'] as const

const ANY = 'any'

function words(line: string): string[] {
	return line
		.split(',')
		.map(word => word.trim())
		.filter(Boolean)
}

export function ReleaseProfileSettings() {
	const { t } = useTranslation()

	const [profile, load, loadDebrid, nodeReady] = useUnit([
		torrentProfileQuery.$data,
		torrentProfileQuery.start,
		torrentDebridQuery.start,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			load()
			loadDebrid()
		}
	}, [load, loadDebrid, nodeReady])

	if (!profile) {
		return null
	}

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<h3 className={styles.title}>{t('settings.releaseProfile.name')}</h3>
				<p className={styles.hint}>{t('settings.releaseProfile.hint')}</p>
			</div>

			{/* Mounted afresh when the saved profile changes, so the fields start from it. */}
			<ProfileForm key={JSON.stringify(profile)} profile={profile} />
		</div>
	)
}

function ProfileForm({ profile }: { profile: TorrentProfile }) {
	const { t } = useTranslation()

	const [save, saving, debridSettings] = useUnit([
		putTorrentProfileMutation.start,
		putTorrentProfileMutation.$pending,
		torrentDebridQuery.$data
	])

	const [resolution, setResolution] = useState(profile.resolution)
	const [codec, setCodec] = useState(profile.codec)
	const [preferred, setPreferred] = useState((profile.preferred ?? []).join(', '))
	const [excluded, setExcluded] = useState((profile.excluded ?? []).join(', '))
	const [minSeeders, setMinSeeders] = useState(String(profile.min_seeders))
	const [preferCached, setPreferCached] = useState(profile.prefer_cached)

	const service = readyDebrid(debridSettings)
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
		<form
			className={styles.form}
			onSubmit={event => {
				event.preventDefault()
				submit()
			}}
		>
			<div className={styles.grid}>
				<label className={styles.field}>
					<span className={styles.label}>{t('torrents.profile.resolution')}</span>
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
					<span className={styles.label}>{t('torrents.profile.codec')}</span>
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
					<span className={styles.label}>{t('torrents.profile.minSeeders')}</span>
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
				<span className={styles.label}>{t('torrents.profile.preferredLabel')}</span>
				<Input
					value={preferred}
					onChange={event => setPreferred(event.target.value)}
					disabled={saving}
					spellCheck={false}
					placeholder='AniLiberty, SubsPlease, Erai-raws'
				/>
			</label>

			<label className={styles.field}>
				<span className={styles.label}>{t('torrents.profile.excluded')}</span>
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

			<div className={styles.actions}>
				<Button type='submit' variant='primary' loading={saving}>
					{t('torrents.profile.save')}
				</Button>
			</div>
		</form>
	)
}
