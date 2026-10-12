import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { SelectDropdown, Switch, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { mangaDexSettingsQuery, putMangaDexSettingsMutation } from '@entities/manga-source'

import styles from './MangaDexSettings.module.scss'

// MangaDex's language codes, named in their own language so a reader finds theirs.
const LANGUAGES: { value: string; label: string }[] = [
	{ value: 'en', label: 'English' },
	{ value: 'uk', label: 'Українська' },
	{ value: 'ru', label: 'Русский' },
	{ value: 'pl', label: 'Polski' },
	{ value: 'de', label: 'Deutsch' },
	{ value: 'fr', label: 'Français' },
	{ value: 'es', label: 'Español' },
	{ value: 'es-la', label: 'Español (Latinoamérica)' },
	{ value: 'pt-br', label: 'Português (Brasil)' },
	{ value: 'it', label: 'Italiano' },
	{ value: 'tr', label: 'Türkçe' },
	{ value: 'id', label: 'Bahasa Indonesia' },
	{ value: 'vi', label: 'Tiếng Việt' },
	{ value: 'ja', label: '日本語' },
	{ value: 'ko', label: '한국어' },
	{ value: 'zh', label: '中文' }
]

export function MangaDexSettings() {
	const { t } = useTranslation()

	const [settings, load, save, saving, nodeReady] = useUnit([
		mangaDexSettingsQuery.$data,
		mangaDexSettingsQuery.start,
		putMangaDexSettingsMutation.start,
		putMangaDexSettingsMutation.$pending,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	useUnitWatch(putMangaDexSettingsMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('mangaSources.mangadex.saveFailed')), {
			id: 'mangadex-settings'
		})
	)

	if (!settings) {
		return null
	}

	if (!settings.available) {
		return <p className={styles.note}>{t('mangaSources.mangadex.unavailable')}</p>
	}

	const languages = settings.languages ?? ['en']

	return (
		<div className={styles.root}>
			<Switch
				checked={settings.enabled}
				onChange={enabled => save({ enabled, languages })}
				label={t('mangaSources.mangadex.enable')}
				disabled={saving}
			/>

			{settings.enabled && (
				<label className={styles.languages}>
					<span className={styles.label}>{t('mangaSources.mangadex.languages')}</span>
					<SelectDropdown
						mode='multiple'
						searchable
						options={LANGUAGES}
						value={languages}
						onChange={next => next.length > 0 && save({ enabled: true, languages: next })}
						placeholder={t('mangaSources.mangadex.languagesPlaceholder')}
						disabled={saving}
					/>
				</label>
			)}

			<p className={styles.note}>{t('mangaSources.mangadex.note')}</p>
		</div>
	)
}
