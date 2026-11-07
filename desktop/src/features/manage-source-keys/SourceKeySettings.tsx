import type { Mutation, Query } from '@farfetched/core'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useState } from 'react'

import type { HttpRequestError } from '@shared/api'
import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, Input, toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

import {
	googleBooksSettingsQuery,
	setGoogleBooksKeyMutation,
	setTMDBKeyMutation,
	tmdbSettingsQuery
} from '@entities/media'

import styles from './SourceKeySettings.module.scss'

interface SourceKeySettingsProps<Settings extends { enabled: boolean; key_source: string }> {
	settingsQuery: Query<void, Settings, HttpRequestError>
	saveMutation: Mutation<string, Settings, HttpRequestError>
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

	const [settings, save, saving] = useUnit([settingsQuery.$data, saveMutation.start, saveMutation.$pending])

	useNodeData(settingsQuery)

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

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<h3 className={styles.title}>{t(`settings.${texts}.name`)}</h3>
				<p className={styles.hint}>{t(`settings.${texts}.hint`)}</p>
			</div>

			{!settings.enabled ? (
				<p className={styles.note}>{t(`${texts}.disabled`)}</p>
			) : (
				<>
					<div className={styles.statusRow}>
						<p className={clsx(styles.status, settings.key_source === 'none' && styles.warning)}>
							<Icon
								name={
									settings.key_source === 'none' ? 'common/info' : 'common/check-circle-2'
								}
								size={18}
							/>
							<span>{t(`${texts}.source.${settings.key_source}` as never)}</span>
						</p>

						{settings.key_source === 'user' && (
							<Button variant='ghost' size='small' disabled={saving} onClick={() => save('')}>
								{t(`${texts}.useBuiltIn`)}
							</Button>
						)}
					</div>

					<form
						className={styles.form}
						onSubmit={event => {
							event.preventDefault()
							const trimmed = key.trim()
							if (trimmed) {
								save(trimmed)
							}
						}}
					>
						<Input
							className={styles.keyField}
							type='password'
							revealable
							value={key}
							onChange={event => setKey(event.target.value)}
							placeholder={t(`${texts}.keyPlaceholder`)}
							autoComplete='off'
							startIcon={<Icon name='common/lock' size={18} />}
							disabled={saving}
						/>

						<Button type='submit' disabled={key.trim() === '' || saving} loading={saving}>
							{t(`${texts}.save`)}
						</Button>
					</form>

					<a className={styles.link} href={keysPage} target='_blank' rel='noreferrer'>
						<Icon name='common/external-link' size={16} />
						{t(`${texts}.getKey`)}
					</a>

					<p className={styles.note}>{t(`${texts}.note`)}</p>
				</>
			)}
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
