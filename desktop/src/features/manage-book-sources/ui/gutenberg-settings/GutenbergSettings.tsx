import { useUnit } from 'effector-react'
import { useEffect } from 'react'
import { IoIosRefresh } from 'react-icons/io'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatDateTime, useUnitWatch } from '@shared/lib'
import { Button, Switch, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	gutenbergSettingsQuery,
	putGutenbergSettingsMutation,
	refreshGutenbergCatalogMutation
} from '@entities/book-source'

import styles from './GutenbergSettings.module.scss'

// Project Gutenberg: off until the user turns it on, because turning it on
// downloads its catalogue, and the catalogue is almost all in English — which
// the user is told before, not after.
export function GutenbergSettings() {
	const { t, i18n } = useTranslation()

	const [settings, load, save, saving, refresh, refreshing, nodeReady] = useUnit([
		gutenbergSettingsQuery.$data,
		gutenbergSettingsQuery.start,
		putGutenbergSettingsMutation.start,
		putGutenbergSettingsMutation.$pending,
		refreshGutenbergCatalogMutation.start,
		refreshGutenbergCatalogMutation.$pending,
		$nodeReady
	])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	const failed = ({ error }: RequestFailure) =>
		toast.error(problemDetail(error, t('bookSources.gutenberg.saveFailed')), { id: 'gutenberg-settings' })

	useUnitWatch(putGutenbergSettingsMutation.finished.failure, failed)
	useUnitWatch(refreshGutenbergCatalogMutation.finished.failure, failed)

	if (!settings) {
		return null
	}

	if (!settings.available) {
		return <p className={styles.note}>{t('bookSources.gutenberg.unavailable')}</p>
	}

	return (
		<div className={styles.root}>
			<Switch
				checked={settings.enabled}
				onChange={save}
				label={t('bookSources.gutenberg.enable')}
				disabled={saving}
			/>

			<p className={styles.note}>{t('bookSources.gutenberg.note')}</p>

			{settings.enabled && (
				<div className={styles.status}>
					<p className={styles.line}>
						{settings.syncing
							? t('bookSources.gutenberg.syncing')
							: settings.books > 0
								? t('bookSources.gutenberg.books', {
										count: settings.books,
										number: new Intl.NumberFormat(i18n.language).format(settings.books),
										date: settings.updated_at
											? formatDateTime(settings.updated_at, i18n.language)
											: '—'
									})
								: t('bookSources.gutenberg.noCatalog')}
					</p>

					{settings.error && <p className={styles.error}>{settings.error}</p>}

					<Button
						size='small'
						startIcon={<IoIosRefresh size={14} />}
						disabled={settings.syncing || refreshing}
						onClick={() => refresh()}
					>
						{t('bookSources.gutenberg.refresh')}
					</Button>
				</div>
			)}
		</div>
	)
}
