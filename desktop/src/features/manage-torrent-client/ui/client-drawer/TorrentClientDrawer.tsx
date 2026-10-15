import { useUnit } from 'effector-react'
import { useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import {
	ConnectionCheck,
	Drawer,
	DrawerForm,
	DrawerSection,
	Input,
	SelectDropdown,
	SelectionGroup,
	toast
} from '@shared/ui'

import { libraryRootsQuery } from '@entities/library-item'
import { checkTorrentClientMutation, putTorrentSettingsMutation } from '@entities/torrent'
import type { TorrentSettings } from '@entities/torrent'

import styles from './TorrentClientDrawer.module.scss'

export interface TorrentClientDrawerProps {
	open: boolean
	settings: TorrentSettings
	onClose: () => void
}

type CheckState = { ok: true; version: string } | { ok: false; problem: string } | null

type ClientKind = TorrentSettings['client']

// The node's "no client" is an empty string, which a selection cannot hold.
const NONE = 'none'
type ClientChoice = Exclude<ClientKind, ''> | typeof NONE

// The form is mounted afresh for every opening, so its fields start from the saved
// settings. qBittorrent's address, sign-in and path mapping only show for it, and
// TorBox's key only for TorBox: the node's own client needs none of them.
export function TorrentClientDrawer({ open, settings, onClose }: TorrentClientDrawerProps) {
	const { t } = useTranslation()

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && onClose()}
			title={t('torrents.settings.drawerTitle')}
			description={t('torrents.settings.drawerDescription')}
			closable={false}
		>
			{open && <ClientForm settings={settings} onDone={onClose} />}
		</Drawer>
	)
}

function ClientForm({ settings, onDone }: { settings: TorrentSettings; onDone: () => void }) {
	const { t } = useTranslation()

	const [save, check, saving, checking, roots] = useUnit([
		putTorrentSettingsMutation.start,
		checkTorrentClientMutation.start,
		putTorrentSettingsMutation.$pending,
		checkTorrentClientMutation.$pending,
		libraryRootsQuery.$data
	])

	const [client, setClient] = useState<ClientChoice>(settings.client || NONE)
	const [url, setUrl] = useState(settings.url)
	const [username, setUsername] = useState(settings.username)
	const [password, setPassword] = useState('')
	const [apiKey, setApiKey] = useState('')
	const [rootId, setRootId] = useState(settings.root_id)
	const [mapClient, setMapClient] = useState(settings.path_map.client)
	const [mapNode, setMapNode] = useState(settings.path_map.node)
	const [result, setResult] = useState<CheckState>(null)

	// An untouched password or key field keeps the saved one.
	const passwordValue = settings.has_password && password === '' ? undefined : password
	const apiKeyValue = settings.has_api_key && apiKey.trim() === '' ? undefined : apiKey.trim()

	const qbittorrent = client === 'qbittorrent'
	const torbox = client === 'torbox'

	// The node refuses half a mapping, qBittorrent without an address or TorBox
	// without a key; saying so before it does saves a round trip.
	const mappingHalf = qbittorrent && (mapClient.trim() === '') !== (mapNode.trim() === '')
	const missingUrl = qbittorrent && url.trim() === ''
	const missingKey = torbox && apiKeyValue === ''

	// Only one form is open at a time, so whatever these mutations report is this form's.
	useUnitWatch(putTorrentSettingsMutation.finished.success, () => onDone())
	useUnitWatch(putTorrentSettingsMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('torrents.settings.saveFailed')), {
			id: 'torrent-settings'
		})
	)
	useUnitWatch(checkTorrentClientMutation.finished.success, ({ result }) =>
		setResult({ ok: true, version: result.version })
	)
	useUnitWatch(checkTorrentClientMutation.finished.failure, ({ error }) =>
		setResult({ ok: false, problem: problemDetail(error, t('torrents.client.notConfigured')) })
	)

	const submit = () =>
		save({
			client: client === NONE ? '' : client,
			url,
			username,
			password: passwordValue,
			api_key: torbox ? apiKeyValue : undefined,
			root_id: rootId,
			path_map: { client: mapClient, node: mapNode }
		})

	const runCheck = () => {
		setResult(null)
		check(
			qbittorrent
				? { client, url, username, password: passwordValue }
				: torbox
					? { client, username: '', api_key: apiKeyValue }
					: { client: 'embedded', username: '' }
		)
	}

	const hint =
		client === 'embedded'
			? t('torrents.settings.embeddedHint')
			: qbittorrent
				? t('torrents.settings.qbittorrentHint')
				: torbox
					? t('torrents.settings.torboxHint')
					: t('torrents.settings.noneHint')

	return (
		<DrawerForm
			onSubmit={submit}
			onCancel={onDone}
			submitLabel={t('torrents.settings.save')}
			submitDisabled={saving || mappingHalf || missingUrl || missingKey}
			cancelDisabled={saving}
			submitting={saving}
		>
			<DrawerSection title={t('torrents.settings.clientLabel')} description={hint}>
				<SelectionGroup
					options={[
						{ value: 'embedded', label: t('torrents.settings.embedded') },
						{ value: 'qbittorrent', label: 'qBittorrent' },
						{ value: 'torbox', label: 'TorBox' },
						{ value: NONE, label: t('torrents.settings.none') }
					]}
					value={client}
					onValueChange={next => {
						setClient(next)
						setResult(null)
					}}
					label={t('torrents.settings.clientLabel')}
					disabled={saving}
					stretch
				/>
			</DrawerSection>

			{qbittorrent && (
				<>
					<DrawerSection title={t('torrents.settings.urlLabel')}>
						<Input
							value={url}
							onChange={event => setUrl(event.target.value)}
							disabled={saving}
							autoComplete='off'
							spellCheck={false}
							placeholder='http://localhost:8080'
						/>
					</DrawerSection>

					<DrawerSection title={t('torrents.settings.usernameLabel')}>
						<Input
							value={username}
							onChange={event => setUsername(event.target.value)}
							disabled={saving}
							autoComplete='off'
							spellCheck={false}
						/>
					</DrawerSection>

					<DrawerSection
						title={t('torrents.settings.passwordLabel')}
						description={
							settings.has_password
								? t('torrents.settings.passwordKept')
								: t('torrents.settings.passwordHint')
						}
					>
						<Input
							type='password'
							revealable
							value={password}
							onChange={event => setPassword(event.target.value)}
							disabled={saving}
							autoComplete='new-password'
						/>
					</DrawerSection>
				</>
			)}

			{torbox && (
				<DrawerSection
					title={t('torrents.settings.apiKeyLabel')}
					description={
						settings.has_api_key
							? t('torrents.settings.apiKeyKept')
							: t('torrents.settings.apiKeyHint')
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
			)}

			{client !== NONE && (
				<DrawerSection>
					<ConnectionCheck
						label={t('torrents.settings.check')}
						checking={checking}
						disabled={missingUrl || missingKey || saving}
						onCheck={runCheck}
						status={
							result && {
								ok: result.ok,
								message: result.ok
									? torbox
										? t('torrents.settings.okAccount', { account: result.version })
										: t('torrents.settings.ok', { version: result.version })
									: result.problem
							}
						}
					/>
				</DrawerSection>
			)}

			<DrawerSection
				title={t('torrents.settings.folderLabel')}
				description={t('torrents.settings.folderHint')}
			>
				<SelectDropdown
					options={(roots?.roots ?? []).map(root => ({ value: String(root.id), label: root.path }))}
					value={rootId ? String(rootId) : null}
					onChange={value => setRootId(value ? Number(value) : 0)}
					placeholder={t('torrents.settings.folderPlaceholder')}
					disabled={saving}
				/>
			</DrawerSection>

			{qbittorrent && (
				<DrawerSection
					title={t('torrents.settings.mappingLabel')}
					description={t('torrents.settings.mappingHint')}
				>
					<div className={styles.mapping}>
						<label className={styles.field}>
							{t('torrents.settings.mappingClient')}
							<Input
								value={mapClient}
								onChange={event => setMapClient(event.target.value)}
								disabled={saving}
								autoComplete='off'
								spellCheck={false}
								placeholder='/downloads'
							/>
						</label>
						<label className={styles.field}>
							{t('torrents.settings.mappingNode')}
							<Input
								value={mapNode}
								onChange={event => setMapNode(event.target.value)}
								disabled={saving}
								autoComplete='off'
								spellCheck={false}
								placeholder='D:\Anime'
							/>
						</label>
					</div>
				</DrawerSection>
			)}
		</DrawerForm>
	)
}
