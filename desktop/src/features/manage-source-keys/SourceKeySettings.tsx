import type { Mutation, Query } from '@farfetched/core'
import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import type { HttpRequestError } from '@shared/api'
import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, Input, SelectDropdown, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	aiSettingsQuery,
	googleBooksSettingsQuery,
	imageSearchSettingsQuery,
	setAISettingsMutation,
	setBraveKeyMutation,
	setGoogleBooksKeyMutation,
	setTMDBKeyMutation,
	tmdbSettingsQuery
} from '@entities/media'

import styles from './SourceKeySettings.module.scss'

// Every source with a key answers the same shape: whether it is on, and whose
// key it sends. The key itself never comes back from the node. TMDB and Google
// Books also allow 'build' (a key this app ships with); Brave and Claude never do.
interface SourceKeySettingsProps<Settings extends { enabled: boolean; key_source: string }> {
	settingsQuery: Query<void, Settings, HttpRequestError>
	saveMutation: Mutation<string, Settings, HttpRequestError>
	// The source's strings live under this key, the same shape for each.
	texts: 'tmdb' | 'googleBooks' | 'brave'
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

export function BraveSettings() {
	return (
		<SourceKeySettings
			settingsQuery={imageSearchSettingsQuery}
			saveMutation={setBraveKeyMutation}
			texts='brave'
			keysPage='https://api-dashboard.search.brave.com/app/keys'
		/>
	)
}

// Claude has no built-in key — every request is paid for by the account whose
// key it is — so this answers like SourceKeySettings but adds the model choice
// and never offers to fall back to a key the build ships with.
export function AISettings() {
	const { t } = useTranslation()
	const [key, setKey] = useState('')

	const [settings, load, save, saving, nodeReady] = useUnit([
		aiSettingsQuery.$data,
		aiSettingsQuery.start,
		setAISettingsMutation.start,
		setAISettingsMutation.$pending,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	useUnitWatch(setAISettingsMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('ai.saveFailed')), { id: 'ai-settings' })
	)
	useUnitWatch(setAISettingsMutation.finished.success, ({ params }) => {
		if (params.api_key === undefined) {
			return
		}

		setKey('')
		toast.success(t(params.api_key ? 'ai.saved' : 'ai.cleared'), { id: 'ai-settings' })
	})

	if (!settings) {
		return null
	}

	if (!settings.enabled) {
		return <p className={styles.note}>{t('ai.disabled')}</p>
	}

	const trimmed = key.trim()
	const models = settings.models ?? []

	return (
		<div className={styles.root}>
			<p className={styles.state}>{t(`ai.source.${settings.key_source}` as never)}</p>

			<form
				className={styles.form}
				onSubmit={event => {
					event.preventDefault()
					if (trimmed) {
						save({ api_key: trimmed })
					}
				}}
			>
				<Input
					type='password'
					value={key}
					onChange={event => setKey(event.target.value)}
					placeholder={t('ai.keyPlaceholder')}
					autoComplete='off'
					disabled={saving}
				/>
				<Button type='submit' disabled={!trimmed || saving} loading={saving}>
					{t('ai.save')}
				</Button>
			</form>

			{models.length > 0 && (
				<div className={styles.modelField}>
					<span className={styles.modelLabel}>{t('ai.model')}</span>
					<SelectDropdown
						value={settings.model}
						onChange={value => value && save({ model: value })}
						options={models.map(model => ({ value: model, label: model }))}
						disabled={saving}
					/>
				</div>
			)}

			<div className={styles.actions}>
				<Button
					variant='ghost'
					size='small'
					startIcon={<Icon name='common/external-link' size={16} />}
					onClick={() =>
						window.open('https://console.anthropic.com/settings/keys', '_blank', 'noreferrer')
					}
				>
					{t('ai.getKey')}
				</Button>

				{settings.key_source === 'user' && (
					<Button
						variant='ghost'
						size='small'
						disabled={saving}
						onClick={() => save({ api_key: '' })}
					>
						{t('ai.useBuiltIn')}
					</Button>
				)}
			</div>

			<p className={styles.note}>{t('ai.note')}</p>
		</div>
	)
}
