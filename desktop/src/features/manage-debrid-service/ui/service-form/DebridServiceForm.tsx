import { useUnit } from 'effector-react'
import { useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, ConnectionCheck, DrawerForm, DrawerSection, Input, SelectDropdown, toast } from '@shared/ui'

import {
	checkTorrentDebridMutation,
	DEBRID_SERVICES,
	debridService,
	putTorrentDebridMutation
} from '@entities/torrent'
import type { DebridKind, TorrentDebrid } from '@entities/torrent'

export interface DebridServiceFormProps {
	debrid: TorrentDebrid
	onDone: () => void
}

type CheckState = { ok: true; account: string } | { ok: false; problem: string } | null

// Mounted afresh for every opening, so the fields start from what is saved.
export function DebridServiceForm({ debrid, onDone }: DebridServiceFormProps) {
	const { t } = useTranslation()

	const [save, check, saving, checking] = useUnit([
		putTorrentDebridMutation.start,
		checkTorrentDebridMutation.start,
		putTorrentDebridMutation.$pending,
		checkTorrentDebridMutation.$pending
	])

	const [kind, setKind] = useState<DebridKind>(
		debridService(debrid.service)?.kind ?? DEBRID_SERVICES[0]!.kind
	)
	const [apiKey, setApiKey] = useState('')
	const [result, setResult] = useState<CheckState>(null)

	const service = debridService(kind)!

	// Each service keeps its own key; an untouched field keeps the saved one.
	const keySaved = (debrid.keys ?? []).includes(kind)
	const apiKeyValue = keySaved && apiKey.trim() === '' ? undefined : apiKey.trim()
	const missingKey = apiKeyValue === ''

	useUnitWatch(putTorrentDebridMutation.finished.success, () => onDone())
	useUnitWatch(putTorrentDebridMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('debrid.saveFailed')), { id: 'torrent-debrid' })
	)
	useUnitWatch(checkTorrentDebridMutation.finished.success, ({ result }) =>
		setResult({ ok: true, account: result.version })
	)
	useUnitWatch(checkTorrentDebridMutation.finished.failure, ({ error }) =>
		setResult({ ok: false, problem: problemDetail(error, t('debrid.checkFailed')) })
	)

	return (
		<DrawerForm
			onSubmit={() => save({ service: kind, api_key: apiKeyValue })}
			onCancel={onDone}
			submitLabel={t('debrid.save')}
			submitDisabled={saving || missingKey}
			cancelDisabled={saving}
			submitting={saving}
			scrollable={false}
		>
			<DrawerSection
				title={t('debrid.serviceLabel')}
				description={kind === 'torbox' ? t('debrid.torboxFree') : t('debrid.serviceHint')}
			>
				<SelectDropdown
					options={DEBRID_SERVICES.map(option => ({ value: option.kind, label: option.name }))}
					value={kind}
					onChange={value => {
						const next = debridService(value)
						if (next) {
							setKind(next.kind)
							setApiKey('')
							setResult(null)
						}
					}}
					disabled={saving}
				/>
			</DrawerSection>

			<DrawerSection
				title={t('debrid.apiKeyLabel')}
				description={
					keySaved ? t('debrid.apiKeyKept') : t('debrid.apiKeyHint', { page: service.keyPage })
				}
			>
				<Input
					type='password'
					revealable
					value={apiKey}
					onChange={event => setApiKey(event.target.value)}
					disabled={saving}
					autoComplete='off'
					spellCheck={false}
				/>
			</DrawerSection>

			<DrawerSection>
				<ConnectionCheck
					label={t('debrid.check')}
					checking={checking}
					disabled={missingKey || saving}
					onCheck={() => {
						setResult(null)
						check({ service: kind, api_key: apiKeyValue })
					}}
					status={
						result && {
							ok: result.ok,
							message: result.ok ? t('debrid.ok', { account: result.account }) : result.problem
						}
					}
				/>
			</DrawerSection>

			{debrid.service !== '' && (
				<DrawerSection
					title={t('debrid.offLabel')}
					description={debrid.in_use ? t('debrid.offInUse') : t('debrid.offHint')}
				>
					<Button
						variant='secondary'
						size='small'
						disabled={saving || debrid.in_use}
						onClick={() => save({ service: '' })}
					>
						{t('debrid.turnOff')}
					</Button>
				</DrawerSection>
			)}
		</DrawerForm>
	)
}
