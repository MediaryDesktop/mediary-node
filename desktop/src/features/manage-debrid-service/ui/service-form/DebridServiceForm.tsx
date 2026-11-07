import { useUnit } from 'effector-react'
import { useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Badge, Button, ConnectionCheck, Icon, Input, toast, Tooltip } from '@shared/ui'

import { DEBRID_SERVICES, debridService } from '@entities/torrent'
import type { DebridKind, TorrentDebrid } from '@entities/torrent'

import { debridCheck, debridSave } from '../../model/model'

import styles from './DebridServiceForm.module.scss'
import { ServiceOption } from './service-option/ServiceOption'

export interface DebridServiceFormProps {
	debrid: TorrentDebrid
	onReset: () => void
}

type CheckState = { ok: true; account: string } | { ok: false; problem: string } | null

export function DebridServiceForm({ debrid, onReset }: DebridServiceFormProps) {
	const { t } = useTranslation()

	const [save, check, saving, checking] = useUnit([
		debridSave.sent,
		debridCheck.sent,
		debridSave.$pending,
		debridCheck.$pending
	])
	const forget = useUnit(debridCheck.forgotten)

	const [kind, setKind] = useState<DebridKind>(
		debridService(debrid.service)?.kind ?? DEBRID_SERVICES[0]!.kind
	)
	const [apiKey, setApiKey] = useState('')
	const [result, setResult] = useState<CheckState>(null)

	const service = debridService(kind)!
	const connectedKind = debrid.ready ? debridService(debrid.service)?.kind : undefined

	const keySaved = (debrid.keys ?? []).includes(kind)
	const apiKeyValue = keySaved && apiKey.trim() === '' ? undefined : apiKey.trim()
	const missingKey = apiKeyValue === ''

	useUnitWatch(debridSave.succeeded, () => onReset())
	useUnitWatch(debridSave.failed, ({ error }) =>
		toast.error(problemDetail(error, t('debrid.saveFailed')), { id: 'torrent-debrid' })
	)
	useUnitWatch(debridCheck.succeeded, ({ result }) => setResult({ ok: true, account: result.version }))
	useUnitWatch(debridCheck.failed, ({ error }) =>
		setResult({ ok: false, problem: problemDetail(error, t('debrid.checkFailed')) })
	)

	const pick = (next: DebridKind) => {
		setKind(next)
		setApiKey('')
		forget()
		setResult(null)
	}

	const checkStatus =
		result &&
		({
			ok: result.ok,
			message: result.ok ? t('debrid.ok', { account: result.account }) : result.problem
		} as const)

	return (
		<form
			className={styles.root}
			onSubmit={event => {
				event.preventDefault()
				save({ service: kind, api_key: apiKeyValue })
			}}
		>
			<div className={styles.serviceSection}>
				<h4 className={styles.sectionTitle}>{t('debrid.serviceLabel')}</h4>

				<div role='radiogroup' aria-label={t('debrid.serviceLabel')} className={styles.serviceGrid}>
					{DEBRID_SERVICES.map(option => (
						<ServiceOption
							key={option.kind}
							label={option.name}
							selected={kind === option.kind}
							disabled={saving}
							onSelect={() => pick(option.kind)}
							badge={
								connectedKind === option.kind ? (
									<Badge tone='success' size='sm'>
										{t('common.connected')}
									</Badge>
								) : option.kind === 'torbox' ? (
									<Badge size='sm'>{t('debrid.freePlan')}</Badge>
								) : undefined
							}
						/>
					))}
				</div>

				{kind === 'torbox' && (
					<p className={styles.note}>
						<Icon name='common/info' size={16} />
						{t('debrid.torboxFree')}
					</p>
				)}
			</div>

			<div className={styles.keySection}>
				<div className={styles.sectionHeader}>
					<h4 className={styles.sectionTitle}>{t('debrid.apiKeyLabel')}</h4>
					<p className={styles.sectionHint}>
						{keySaved
							? t('debrid.apiKeyKept')
							: t('debrid.apiKeyHint', { page: service.keyPage })}
					</p>
				</div>

				<div className={styles.keyRow}>
					<Input
						className={styles.keyField}
						type='password'
						revealable
						value={apiKey}
						onChange={event => {
							setApiKey(event.target.value)
							forget()
							setResult(null)
						}}
						disabled={saving}
						autoComplete='off'
						spellCheck={false}
						startIcon={<Icon name='common/lock' size={18} />}
						placeholder={t('debrid.apiKeyPlaceholder', { service: service.name })}
					/>

					<ConnectionCheck
						label={t('debrid.check')}
						size='default'
						checking={checking}
						disabled={missingKey || saving}
						onCheck={() => {
							setResult(null)
							check({ service: kind, api_key: apiKeyValue })
						}}
						status={checkStatus}
					/>
				</div>
			</div>

			<div className={styles.actions}>
				{debrid.service !== '' && (
					<div className={styles.turnOff}>
						<Tooltip content={debrid.in_use ? t('debrid.offInUse') : t('debrid.offHint')}>
							<Button
								type='button'
								variant='ghost'
								size='small'
								disabled={saving || debrid.in_use}
								onClick={() => save({ service: '' })}
							>
								{t('debrid.turnOff')}
							</Button>
						</Tooltip>
					</div>
				)}

				<div className={styles.formActions}>
					<Button variant='secondary' onClick={onReset} disabled={saving}>
						{t('common.cancel')}
					</Button>

					<Button type='submit' variant='primary' disabled={saving || missingKey} loading={saving}>
						{t('debrid.save')}
					</Button>
				</div>
			</div>
		</form>
	)
}
