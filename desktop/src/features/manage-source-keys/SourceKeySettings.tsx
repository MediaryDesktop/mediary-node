import type { Mutation, Query } from '@farfetched/core'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import type { HttpRequestError } from '@shared/api'
import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, Input, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	googleBooksSettingsQuery,
	setGoogleBooksKeyMutation,
	setTMDBKeyMutation,
	tmdbSettingsQuery
} from '@entities/media'

import styles from './SourceKeySettings.module.scss'

// Every source with a key answers the same shape: whether it is on, and whose
// key it sends. The key itself never comes back from the node. Both sources
// also allow 'build' (a key this app ships with).
interface SourceKeySettingsProps<Settings extends { enabled: boolean; key_source: string }> {
	settingsQuery: Query<void, Settings, HttpRequestError>
	saveMutation: Mutation<string, Settings, HttpRequestError>
	// The source's strings live under this key, the same shape for each.
	texts: 'tmdb' | 'googleBooks'
	keysPage: string
}

function SourceKeySettings<Settings extends { enabled: boolean; key_source: string }>({
	settingsQuery,
	saveMutation,
	texts,
	keysPage
}: SourceKeySettingsProps<Settings>) {
	const { t } = useTranslation()
	const [key, setKey] = useState('')

	const [settings, load, save, saving, nodeReady] = useUnit([
		settingsQuery.$data,
		settingsQuery.start,
		saveMutation.start,
		saveMutation.$pending,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	useUnitWatch(saveMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t(`${texts}.saveFailed`)), { id: `${texts}-settings` })
	)
	useUnitWatch(saveMutation.finished.success, ({ params }) => {
		setKey('')
		toast.success(t(params ? `${texts}.saved` : `${texts}.cleared`), { id: `${texts}-settings` })
	})

	if (!settings) {
		return null
	}

	if (!settings.enabled) {
		return <p className={styles.note}>{t(`${texts}.disabled`)}</p>
	}

	const trimmed = key.trim()

	return (
		<div className={styles.root}>
			<p className={styles.state}>{t(`${texts}.source.${settings.key_source}` as never)}</p>

			<form
				className={styles.form}
				onSubmit={event => {
					event.preventDefault()
					if (trimmed) {
						save(trimmed)
					}
				}}
			>
				<Input
					type='password'
					value={key}
					onChange={event => setKey(event.target.value)}
					placeholder={t(`${texts}.keyPlaceholder`)}
					autoComplete='off'
					disabled={saving}
				/>
				<Button type='submit' disabled={!trimmed || saving} loading={saving}>
					{t(`${texts}.save`)}
				</Button>
			</form>

			<div className={styles.actions}>
				<Button
					variant='ghost'
					size='small'
					startIcon={<Icon name='common/external-link' size={16} />}
					onClick={() => window.open(keysPage, '_blank', 'noreferrer')}
				>
					{t(`${texts}.getKey`)}
				</Button>

				{settings.key_source === 'user' && (
					<Button variant='ghost' size='small' disabled={saving} onClick={() => save('')}>
						{t(`${texts}.useBuiltIn`)}
					</Button>
				)}
			</div>

			<p className={styles.note}>{t(`${texts}.note`)}</p>
		</div>
	)
}

export function TMDBSettings() {
	return (
		<SourceKeySettings
			settingsQuery={tmdbSettingsQuery}
			saveMutation={setTMDBKeyMutation}
			texts='tmdb'
			keysPage='https://www.themoviedb.org/settings/api'
		/>
	)
}

export function GoogleBooksSettings() {
	return (
		<SourceKeySettings
			settingsQuery={googleBooksSettingsQuery}
			saveMutation={setGoogleBooksKeyMutation}
			texts='googleBooks'
			keysPage='https://console.cloud.google.com/apis/library/books.googleapis.com'
		/>
	)
}
