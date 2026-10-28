import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, Input, SelectDropdown, toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { aiSettingsQuery, setAISettingsMutation } from '@entities/media'

import styles from './AISettings.module.scss'

const CONSOLE_URL = 'https://platform.claude.com/'

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
		toast.error(problemDetail(error, t('claude.saveFailed')), { id: 'claude-settings' })
	)
	useUnitWatch(setAISettingsMutation.finished.success, ({ params }) => {
		if (params.api_key !== undefined) {
			setKey('')
		}

		const message =
			params.api_key === undefined
				? t('claude.modelSaved')
				: params.api_key
					? t('claude.saved')
					: t('claude.cleared')

		toast.success(message, { id: 'claude-settings' })
	})

	if (!settings) {
		return null
	}

	if (!settings.enabled) {
		return <p className={styles.note}>{t('claude.disabled')}</p>
	}

	const trimmed = key.trim()

	const modelOptions = (settings.models ?? []).map(model => ({
		value: model,
		label: t(`claude.models.${model}` as never, { defaultValue: model })
	}))

	return (
		<div className={styles.root}>
			<p className={styles.state}>{t(`claude.source.${settings.key_source}`)}</p>

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
					placeholder={t('claude.keyPlaceholder')}
					autoComplete='off'
					disabled={saving}
				/>
				<Button type='submit' disabled={!trimmed || saving} loading={saving}>
					{t('claude.save')}
				</Button>
			</form>

			<div className={styles.model}>
				<span className={styles.modelLabel}>{t('claude.model')}</span>
				<SelectDropdown
					options={modelOptions}
					value={settings.model}
					onChange={model => {
						if (model && model !== settings.model) {
							save({ model })
						}
					}}
					disabled={saving}
				/>
			</div>

			<div className={styles.actions}>
				<Button
					variant='ghost'
					size='small'
					startIcon={<Icon name='common/external-link' size={16} />}
					onClick={() => window.open(CONSOLE_URL, '_blank', 'noreferrer')}
				>
					{t('claude.getKey')}
				</Button>

				{settings.key_source === 'user' && (
					<Button
						variant='ghost'
						size='small'
						disabled={saving}
						onClick={() => save({ api_key: '' })}
					>
						{t('claude.forget')}
					</Button>
				)}
			</div>

			<p className={styles.note}>{t('claude.note')}</p>
		</div>
	)
}
