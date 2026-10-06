import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Drawer, DrawerForm, DrawerSection, Icon, Input, SelectDropdown, toast } from '@shared/ui'

import { libraryRootsQuery } from '@entities/library-item'
import { checkTorrentClientMutation, putTorrentSettingsMutation } from '@entities/torrent'
import type { TorrentSettings } from '@entities/torrent'

import styles from './TorrentClient.module.scss'

export interface TorrentClientDrawerProps {
	open: boolean
	settings: TorrentSettings
	onClose: () => void
}

type CheckState = { ok: true; version: string } | { ok: false; problem: string } | null

// The form is mounted afresh for every opening, so its fields start from the saved
// settings.
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

	const [url, setUrl] = useState(settings.url)
	const [username, setUsername] = useState(settings.username)
	const [password, setPassword] = useState('')
	const [rootId, setRootId] = useState(settings.root_id)
	const [mapClient, setMapClient] = useState(settings.path_map.client)
	const [mapNode, setMapNode] = useState(settings.path_map.node)
	const [result, setResult] = useState<CheckState>(null)

	// An untouched password field keeps the saved password.
	const passwordValue = settings.has_password && password === '' ? undefined : password

	// The node refuses half a mapping; saying so before it does saves a round trip.
	const mappingHalf = (mapClient.trim() === '') !== (mapNode.trim() === '')

	// Only one form is open at a time, so whatever these mutations report is this form's.
	useEffect(() => {
		const stop = [
			putTorrentSettingsMutation.finished.success.watch(() => onDone()),
			putTorrentSettingsMutation.finished.failure.watch(({ error }) =>
				toast.error(error.body?.detail ?? t('torrents.settings.saveFailed'), {
					id: 'torrent-settings'
				})
			),
			checkTorrentClientMutation.finished.success.watch(({ result }) =>
				setResult({ ok: true, version: result.version })
			),
			checkTorrentClientMutation.finished.failure.watch(({ error }) =>
				setResult({ ok: false, problem: error.body?.detail ?? t('torrents.client.notConfigured') })
			)
		]

		return () => stop.forEach(unwatch => unwatch())
	}, [onDone, t])

	const submit = () =>
		save({
			url,
			username,
			password: passwordValue,
			root_id: rootId,
			path_map: { client: mapClient, node: mapNode }
		})

	const runCheck = () => {
		setResult(null)
		check({ url, username, password: passwordValue })
	}

	return (
		<DrawerForm
			onSubmit={submit}
			onCancel={onDone}
			submitLabel={t('torrents.settings.save')}
			submitDisabled={saving || mappingHalf}
			cancelDisabled={saving}
			submitting={saving}
		>
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

			<div className={styles.check}>
				<Button
					size='small'
					startIcon={<Icon name='common/signal' size={16} />}
					loading={checking}
					disabled={url.trim() === '' || saving}
					onClick={runCheck}
				>
					{t('torrents.settings.check')}
				</Button>

				{result && (
					<span className={result.ok ? styles.ok : styles.problem} role='status'>
						{result.ok ? t('torrents.settings.ok', { version: result.version }) : result.problem}
					</span>
				)}
			</div>

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
		</DrawerForm>
	)
}
