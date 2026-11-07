import { Link } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Badge, Button, Icon, Input, ProgressBar, SelectDropdown, toast } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { aiSettingsQuery, setAISettingsMutation } from '@entities/media'
import type { AIProvider, SetAISettingsParams, AISettings as Settings } from '@entities/media'

import { savedKey } from '../../lib/saved-key'

import styles from './AISettings.module.scss'
import { ProviderOption } from './provider-option/ProviderOption'

const PROVIDERS: readonly AIProvider[] = ['cloud', 'claude', 'gemini', 'openai']

const KEY_PAGES = {
	claude: 'https://console.anthropic.com/settings/keys',
	gemini: 'https://aistudio.google.com/apikey'
} as const

const ENDPOINT_PRESETS = [
	{ label: 'OpenAI', endpoint: 'https://api.openai.com/v1' },
	{ label: 'OpenRouter', endpoint: 'https://openrouter.ai/api/v1' },
	{ label: 'Ollama', endpoint: 'http://localhost:11434/v1' },
	{ label: 'LM Studio', endpoint: 'http://localhost:1234/v1' }
] as const

export function AISettings() {
	const { t } = useTranslation()

	const [settings, save, saving] = useUnit([
		aiSettingsQuery.$data,
		setAISettingsMutation.start,
		setAISettingsMutation.$pending
	])

	useNodeData(aiSettingsQuery)

	useUnitWatch(setAISettingsMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('ai.saveFailed')), { id: 'ai-settings' })
	)
	useUnitWatch(setAISettingsMutation.finished.success, ({ params }) => {
		const key = params.claude?.api_key ?? params.gemini?.api_key ?? params.openai?.api_key

		if (params.openai?.endpoint !== undefined || key) {
			toast.success(t('ai.saved'), { id: 'ai-settings' })
		} else if (key === '') {
			toast.success(t('ai.cleared'), { id: 'ai-settings' })
		}
	})

	if (!settings) {
		return null
	}

	return (
		<div className={styles.root}>
			<div role='radiogroup' aria-label={t('ai.providerLabel')} className={styles.providerGrid}>
				{PROVIDERS.map(provider => (
					<ProviderOption
						key={provider}
						label={t(`ai.providers.${provider}`)}
						selected={settings.provider === provider}
						disabled={saving}
						onSelect={() => save({ provider })}
						badge={provider === 'cloud' ? <Badge size='sm'>{t('ai.free')}</Badge> : undefined}
					/>
				))}
			</div>

			{settings.provider === 'cloud' && <CloudPanel settings={settings} />}

			{(settings.provider === 'claude' || settings.provider === 'gemini') && (
				<KeyPanel
					key={settings.provider}
					provider={settings.provider}
					settings={settings[settings.provider]}
					saving={saving}
					save={save}
				/>
			)}

			{settings.provider === 'openai' && (
				<OpenAIPanel settings={settings.openai} saving={saving} save={save} />
			)}
		</div>
	)
}

function CloudPanel({ settings }: { settings: Settings }) {
	const { t } = useTranslation()
	const cloud = settings.cloud

	if (!cloud.linked) {
		return (
			<div className={styles.panel}>
				<p className={styles.state}>{t('ai.cloud.notLinked')}</p>

				<Link to='/settings' search={{ section: 'backup' }} className={styles.link}>
					<Icon name='common/user' size={15} />
					{t('ai.cloud.pair')}
				</Link>

				<p className={styles.note}>{t('ai.cloud.privacy')}</p>
			</div>
		)
	}

	if (!cloud.known) {
		return (
			<div className={styles.panel}>
				<p className={styles.state}>{t('ai.cloud.unknown')}</p>
				<p className={styles.note}>{t('ai.cloud.privacy')}</p>
			</div>
		)
	}

	if (!cloud.enabled) {
		return (
			<div className={styles.panel}>
				<p className={styles.state}>{t('ai.cloud.unavailable')}</p>
			</div>
		)
	}

	const renews = cloud.resets_at
		? new Date(cloud.resets_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
		: null

	return (
		<div className={styles.panel}>
			<div className={styles.quota}>
				<div className={styles.quotaHead}>
					<span className={styles.state}>
						{t('ai.cloud.remaining', { remaining: cloud.remaining, limit: cloud.limit })}
					</span>
					{renews && (
						<span className={styles.quotaMeta}>{t('ai.cloud.renews', { time: renews })}</span>
					)}
				</div>

				<ProgressBar value={cloud.used} max={cloud.limit} label={t('ai.providers.cloud')} />
			</div>

			<p className={styles.note}>{t('ai.cloud.privacy')}</p>
		</div>
	)
}

interface KeyPanelProps {
	provider: 'claude' | 'gemini'
	settings: Settings['claude']
	saving: boolean
	save: (params: SetAISettingsParams) => void
}

function KeyPanel({ provider, settings, saving, save }: KeyPanelProps) {
	const { t } = useTranslation()
	const [key, setKey] = useState('')

	useUnitWatch(setAISettingsMutation.finished.success, ({ params }) => {
		if (savedKey(params, provider)) {
			setKey('')
		}
	})

	const name = t(`ai.providers.${provider}`)

	if (!settings.available) {
		return <p className={styles.note}>{t('ai.disabled', { provider: name })}</p>
	}

	const trimmed = key.trim()

	return (
		<div className={styles.panel}>
			<form
				className={styles.form}
				onSubmit={event => {
					event.preventDefault()
					if (trimmed) {
						save({ [provider]: { api_key: trimmed } })
					}
				}}
			>
				<SelectDropdown
					className={styles.modelField}
					value={settings.model}
					onChange={model => model && save({ [provider]: { model } })}
					options={(settings.models ?? []).map(model => ({ value: model, label: model }))}
					disabled={saving}
				/>

				<Input
					className={styles.keyInput}
					type='password'
					value={key}
					onChange={event => setKey(event.target.value)}
					placeholder={t('ai.key.placeholder', { provider: name })}
					autoComplete='off'
					disabled={saving}
				/>
				<Button type='submit' disabled={!trimmed || saving} loading={saving}>
					{t('ai.key.save')}
				</Button>
			</form>

			<div className={styles.actions}>
				<Button
					variant='ghost'
					size='small'
					startIcon={<Icon name='common/external-link' size={16} />}
					onClick={() => window.open(KEY_PAGES[provider], '_blank', 'noreferrer')}
				>
					{t('ai.key.getKey')}
				</Button>

				{settings.configured && (
					<Button
						variant='ghost'
						size='small'
						disabled={saving}
						onClick={() => save({ [provider]: { api_key: '' } })}
					>
						{t('ai.key.remove')}
					</Button>
				)}
			</div>

			<p className={styles.note}>{t('ai.note')}</p>
		</div>
	)
}

interface OpenAIPanelProps {
	settings: Settings['openai']
	saving: boolean
	save: (params: SetAISettingsParams) => void
}

function OpenAIPanel({ settings, saving, save }: OpenAIPanelProps) {
	const { t } = useTranslation()

	const [endpoint, setEndpoint] = useState(settings.endpoint)
	const [model, setModel] = useState(settings.model)
	const [key, setKey] = useState('')

	useUnitWatch(setAISettingsMutation.finished.success, ({ params }) => {
		if (savedKey(params, 'openai')) {
			setKey('')
		}
	})

	const dirty =
		endpoint.trim() !== settings.endpoint || model.trim() !== settings.model || key.trim() !== ''

	return (
		<form
			className={styles.panel}
			onSubmit={event => {
				event.preventDefault()
				save({
					openai: {
						endpoint: endpoint.trim(),
						model: model.trim(),
						...(key.trim() ? { api_key: key.trim() } : {})
					}
				})
			}}
		>
			<div className={styles.presets}>
				{ENDPOINT_PRESETS.map(preset => (
					<button
						key={preset.label}
						type='button'
						className={styles.preset}
						aria-pressed={endpoint === preset.endpoint}
						disabled={saving}
						onClick={() => setEndpoint(preset.endpoint)}
					>
						{preset.label}
					</button>
				))}
			</div>

			<div className={styles.row}>
				<label className={styles.field}>
					<span className={styles.label}>{t('ai.openai.endpoint')}</span>
					<Input
						value={endpoint}
						onChange={event => setEndpoint(event.target.value)}
						placeholder='https://api.openai.com/v1'
						autoComplete='off'
						disabled={saving}
					/>
				</label>

				<label className={styles.field}>
					<span className={styles.label}>{t('ai.model')}</span>
					<Input
						value={model}
						onChange={event => setModel(event.target.value)}
						placeholder={t('ai.openai.modelPlaceholder')}
						autoComplete='off'
						disabled={saving}
					/>
				</label>
			</div>

			<div className={styles.keyRow}>
				<label className={styles.field}>
					<span className={styles.label}>
						{settings.has_key ? t('ai.openai.keySaved') : t('ai.openai.key')}
					</span>
					<Input
						type='password'
						value={key}
						onChange={event => setKey(event.target.value)}
						placeholder={t('ai.openai.keyPlaceholder')}
						autoComplete='off'
						disabled={saving}
					/>
				</label>

				<Button type='submit' disabled={!dirty || saving} loading={saving}>
					{t('ai.key.save')}
				</Button>

				{settings.has_key && (
					<Button
						type='button'
						variant='ghost'
						size='small'
						disabled={saving}
						onClick={() => save({ openai: { api_key: '' } })}
					>
						{t('ai.key.remove')}
					</Button>
				)}
			</div>

			<p className={styles.note}>{t('ai.note')}</p>
		</form>
	)
}
