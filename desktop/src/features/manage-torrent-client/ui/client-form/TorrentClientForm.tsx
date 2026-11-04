import { useUnit } from 'effector-react'
import { useState } from 'react'
import { IoCloudOutline } from 'react-icons/io5'
import { SiQbittorrent } from 'react-icons/si'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, ConnectionCheck, Icon, Input, SelectDropdown, toast } from '@shared/ui'

import { addLibraryRootMutation, AddRootMenu, libraryModel, libraryRootsQuery } from '@entities/library-item'
import {
	checkTorrentClientMutation,
	putTorrentSettingsMutation,
	readyDebrid,
	torrentDebridQuery
} from '@entities/torrent'
import type { TorrentClientKind, TorrentSettings } from '@entities/torrent'

import { OptionCard } from './option-card/OptionCard'
import styles from './TorrentClientForm.module.scss'

export interface TorrentClientFormProps {
	settings: TorrentSettings
	// Called after a successful save, and when the user cancels: either way the
	// form's local state should go back to matching what is saved.
	onReset: () => void
}

type CheckState = { ok: true; version: string } | { ok: false; problem: string } | null

// The node's "no client" is an empty string, which a selection cannot hold.
const NONE = 'none'
type ClientChoice = Exclude<TorrentClientKind, ''> | typeof NONE

// The node's "its own folder" is root 0, which a selection cannot hold either.
const DEFAULT_FOLDER = 'default'

// Remounted (by key) after every save or cancel, so its fields start fresh
// from the saved settings. qBittorrent's address, sign-in and path mapping
// only show once it is the pick; downloading through the debrid service uses
// the service set up on its own, in Settings → Debrid service.
export function TorrentClientForm({ settings, onReset }: TorrentClientFormProps) {
	const { t } = useTranslation()

	const [save, check, saving, checking, roots, debridSettings, pickingFolder] = useUnit([
		putTorrentSettingsMutation.start,
		checkTorrentClientMutation.start,
		putTorrentSettingsMutation.$pending,
		checkTorrentClientMutation.$pending,
		libraryRootsQuery.$data,
		torrentDebridQuery.$data,
		libraryModel.$pickingFolder
	])

	const [choice, setChoice] = useState<ClientChoice>(settings.client || NONE)
	const [url, setUrl] = useState(settings.url)
	const [username, setUsername] = useState(settings.username)
	const [password, setPassword] = useState('')
	const [rootId, setRootId] = useState(settings.root_id)
	const [mapClient, setMapClient] = useState(settings.path_map.client)
	const [mapNode, setMapNode] = useState(settings.path_map.node)
	const [result, setResult] = useState<CheckState>(null)

	const qbittorrent = choice === 'qbittorrent'
	const throughDebrid = choice === 'debrid'
	const debrid = readyDebrid(debridSettings)
	const client: TorrentClientKind = choice === NONE ? '' : choice

	// Once the node's own folder has joined the library it is a root like any
	// other; it is still offered once, as the default.
	const otherRoots = (roots?.roots ?? []).filter(root => root.path !== settings.default_folder)
	const folderValue = otherRoots.some(root => root.id === rootId) ? String(rootId) : DEFAULT_FOLDER

	// An untouched password field keeps the saved password.
	const passwordValue = settings.has_password && password === '' ? undefined : password

	// The node refuses half a mapping, qBittorrent without an address or the
	// debrid client without a service; saying so before it does saves a round trip.
	const mappingHalf = qbittorrent && (mapClient.trim() === '') !== (mapNode.trim() === '')
	const missingUrl = qbittorrent && url.trim() === ''
	const missingDebrid = throughDebrid && !debrid

	// Only one form is mounted at a time, so whatever these mutations report is this form's.
	useUnitWatch(putTorrentSettingsMutation.finished.success, () => onReset())
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
	// The newly added folder is exactly what the user was about to pick anyway.
	useUnitWatch(addLibraryRootMutation.finished.success, ({ result }) => setRootId(result.root.id))
	useUnitWatch(addLibraryRootMutation.finished.failure, ({ error }) =>
		toast.error(
			error.status === 409
				? problemDetail(error, t('library.root.overlap'))
				: problemDetail(error, t('library.root.failed')),
			{ id: 'library-root-failed' }
		)
	)

	const pick = (next: ClientChoice) => {
		setChoice(next)
		setResult(null)
	}

	const submit = () =>
		save({
			client,
			url,
			username,
			password: passwordValue,
			root_id: rootId,
			path_map: { client: mapClient, node: mapNode }
		})

	const runCheck = () => {
		setResult(null)
		check(qbittorrent ? { client, url, username, password: passwordValue } : { client, username: '' })
	}

	const checkStatus =
		result &&
		({
			ok: result.ok,
			message: result.ok
				? throughDebrid
					? t('torrents.settings.okAccount', { account: result.version })
					: t('torrents.settings.ok', { version: result.version })
				: result.problem
		} as const)

	return (
		<form
			className={styles.root}
			onSubmit={event => {
				event.preventDefault()
				submit()
			}}
		>
			<div role='radiogroup' aria-label={t('torrents.settings.clientLabel')} className={styles.options}>
				<OptionCard
					icon='common/download'
					title={t('torrents.settings.embedded')}
					description={t('torrents.settings.embeddedDescription')}
					selected={choice === 'embedded'}
					disabled={saving}
					onSelect={() => pick('embedded')}
					detail={
						<div className={styles.detailRow}>
							<div className={styles.detailText}>
								<span className={styles.detailLabel}>
									{t('torrents.settings.embeddedPort')}
								</span>
								<span className={styles.detailHint}>
									{t('torrents.settings.embeddedPortHint')}
								</span>
							</div>

							<ConnectionCheck
								label={t('torrents.settings.check')}
								checking={checking}
								disabled={saving}
								onCheck={runCheck}
								status={checkStatus}
							/>
						</div>
					}
				/>

				<OptionCard
					icon={<SiQbittorrent size={20} />}
					title='qBittorrent'
					description={t('torrents.settings.qbittorrentDescription')}
					selected={qbittorrent}
					disabled={saving}
					onSelect={() => pick('qbittorrent')}
					detail={
						<div className={styles.detailStack}>
							<div className={styles.fieldGrid}>
								<label className={styles.field}>
									<span className={styles.fieldLabel}>
										{t('torrents.settings.urlLabel')}
									</span>
									<Input
										value={url}
										onChange={event => setUrl(event.target.value)}
										disabled={saving}
										autoComplete='off'
										spellCheck={false}
										placeholder='http://localhost:8080'
									/>
								</label>

								<label className={styles.field}>
									<span className={styles.fieldLabel}>
										{t('torrents.settings.usernameLabel')}
									</span>
									<Input
										value={username}
										onChange={event => setUsername(event.target.value)}
										disabled={saving}
										autoComplete='off'
										spellCheck={false}
										placeholder='Admin'
									/>
								</label>
							</div>

							<label className={styles.field}>
								<span className={styles.fieldLabel}>
									{t('torrents.settings.passwordLabel')}
								</span>
								<Input
									type='password'
									revealable
									value={password}
									onChange={event => setPassword(event.target.value)}
									disabled={saving}
									autoComplete='new-password'
									placeholder={
										settings.has_password
											? t('torrents.settings.passwordKept')
											: t('torrents.settings.passwordHint')
									}
								/>
							</label>

							<div className={styles.checkRow}>
								<ConnectionCheck
									label={t('torrents.settings.check')}
									checking={checking}
									disabled={missingUrl || saving}
									onCheck={runCheck}
									status={checkStatus}
								/>
							</div>

							<div className={styles.mappingBlock}>
								<div className={styles.mappingHeader}>
									<span className={styles.detailLabel}>
										{t('torrents.settings.mappingLabel')}
									</span>
									<span className={styles.detailHint}>
										{t('torrents.settings.mappingHint')}
									</span>
								</div>

								<div className={styles.fieldGrid}>
									<label className={styles.field}>
										<span className={styles.fieldLabel}>
											{t('torrents.settings.mappingClient')}
										</span>
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
										<span className={styles.fieldLabel}>
											{t('torrents.settings.mappingNode')}
										</span>
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
							</div>
						</div>
					}
				/>

				<OptionCard
					icon={<IoCloudOutline size={20} />}
					title={t('torrents.settings.debrid')}
					description={t('torrents.settings.debridDescription')}
					selected={throughDebrid}
					disabled={saving}
					onSelect={() => pick('debrid')}
					detail={
						debrid ? (
							<div className={styles.detailStack}>
								<p className={styles.detailHint}>
									{t('torrents.settings.debridHint', { service: debrid.name })}
								</p>
								<div className={styles.checkRow}>
									<ConnectionCheck
										label={t('torrents.settings.check')}
										checking={checking}
										disabled={saving}
										onCheck={runCheck}
										status={checkStatus}
									/>
								</div>
							</div>
						) : (
							<p className={styles.detailHint}>{t('torrents.settings.debridMissing')}</p>
						)
					}
				/>

				<OptionCard
					icon='common/close'
					title={t('torrents.settings.none')}
					description={t('torrents.settings.noneDescription')}
					selected={choice === NONE}
					disabled={saving}
					onSelect={() => pick(NONE)}
				/>
			</div>

			<div className={styles.folderSection}>
				<div className={styles.sectionHeader}>
					<h4 className={styles.sectionTitle}>{t('torrents.settings.folderLabel')}</h4>
					<p className={styles.sectionHint}>{t('torrents.settings.folderHint')}</p>
				</div>

				<SelectDropdown
					className={styles.folderField}
					options={[
						{ value: DEFAULT_FOLDER, label: settings.default_folder },
						...otherRoots.map(root => ({ value: String(root.id), label: root.path }))
					]}
					value={folderValue}
					onChange={value => setRootId(value && value !== DEFAULT_FOLDER ? Number(value) : 0)}
					disabled={saving}
					startIcon={<Icon name='common/folder' size={20} />}
					footer={
						<AddRootMenu
							align='center'
							trigger={
								<Button
									variant='ghost'
									size='small'
									fullWidth
									disabled={pickingFolder || saving}
									startIcon={<Icon name='common/folder-open' size={16} />}
								>
									{t('library.root.add')}
								</Button>
							}
						/>
					}
				/>
			</div>

			<div className={styles.actions}>
				<Button variant='secondary' onClick={onReset} disabled={saving}>
					{t('common.cancel')}
				</Button>

				<Button
					type='submit'
					variant='primary'
					disabled={saving || mappingHalf || missingUrl || missingDebrid}
					loading={saving}
				>
					{t('torrents.settings.save')}
				</Button>
			</div>
		</form>
	)
}
