import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Input, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { setTMDBKeyMutation, tmdbSettingsQuery } from '@entities/media'

import styles from './TMDBSettings.module.scss'

const KEYS_PAGE = 'https://www.themoviedb.org/settings/api'

export function TMDBSettings() {
	const { t } = useTranslation()
	const [key, setKey] = useState('')

	const [settings, load, save, saving, nodeReady] = useUnit([
		tmdbSettingsQuery.$data,
		tmdbSettingsQuery.start,
		setTMDBKeyMutation.start,
		setTMDBKeyMutation.$pending,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	useEffect(() => {
		const stop = [
			setTMDBKeyMutation.finished.failure.watch(({ error }) =>
				toast.error(error.body?.detail ?? t('tmdb.saveFailed'), { id: 'tmdb-settings' })
			),
			setTMDBKeyMutation.finished.success.watch(({ params }) => {
				setKey('')
				toast.success(t(params ? 'tmdb.saved' : 'tmdb.cleared'), { id: 'tmdb-settings' })
			})
		]

		return () => stop.forEach(unwatch => unwatch())
	}, [t])

	if (!settings) {
		return null
	}

	if (!settings.enabled) {
		return <p className={styles.note}>{t('tmdb.disabled')}</p>
	}

	const trimmed = key.trim()

	return (
		<div className={styles.root}>
			<p className={styles.state}>{t(`tmdb.source.${settings.key_source}`)}</p>

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
					placeholder={t('tmdb.keyPlaceholder')}
					autoComplete='off'
					disabled={saving}
				/>
				<Button type='submit' disabled={!trimmed || saving} loading={saving}>
					{t('tmdb.save')}
				</Button>
			</form>

			<div className={styles.actions}>
				<Button
					variant='ghost'
					size='small'
					startIcon={<Icon name='common/external-link' size={16} />}
					onClick={() => window.open(KEYS_PAGE, '_blank', 'noreferrer')}
				>
					{t('tmdb.getKey')}
				</Button>

				{settings.key_source === 'user' && (
					<Button variant='ghost' size='small' disabled={saving} onClick={() => save('')}>
						{t('tmdb.useBuiltIn')}
					</Button>
				)}
			</div>

			<p className={styles.note}>{t('tmdb.note')}</p>
		</div>
	)
}
