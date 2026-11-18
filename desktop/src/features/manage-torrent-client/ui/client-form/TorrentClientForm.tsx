import { useUnit } from 'effector-react'
import { IoCloudOutline } from 'react-icons/io5'
import { SiQbittorrent } from 'react-icons/si'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, ConnectionCheck, Icon, SelectDropdown, toast } from '@shared/ui'

import { AddRootMenu, libraryModel, libraryRootsQuery } from '@entities/library-item'
import { readyDebrid, torrentDebridQuery } from '@entities/torrent'
import type { TorrentSettings } from '@entities/torrent'

import type { ClientFields } from '../../lib/form'
import { NONE } from '../../lib/form'
import { clientForm } from '../../model/form'
import { FOLDER_REQUESTER } from '../../model/model'

import { OptionCard } from './option-card/OptionCard'
import { QbittorrentDetail } from './qbittorrent-detail/QbittorrentDetail'
import styles from './TorrentClientForm.module.scss'

export interface TorrentClientFormProps {
	settings: TorrentSettings
	fields: ClientFields
}

const DEFAULT_FOLDER = 'default'

export function TorrentClientForm({ settings, fields }: TorrentClientFormProps) {
	const { t } = useTranslation()

	const [roots, debridSettings, pickingFolder] = useUnit([
		libraryRootsQuery.$data,
		torrentDebridQuery.$data,
		libraryModel.$pickingFolder
	])

	const [saving, checking, canSave, result] = useUnit([
		clientForm.$saving,
		clientForm.$checking,
		clientForm.$canSave,
		clientForm.$check
	])

	const [pick, folderPicked, runCheck, submit, reset] = useUnit([
		clientForm.picked,
		clientForm.folderPicked,
		clientForm.checkRequested,
		clientForm.submitted,
		clientForm.reset
	])

	const { choice, url, rootId } = fields

	const qbittorrent = choice === 'qbittorrent'
	const throughDebrid = choice === 'debrid'
	const debrid = readyDebrid(debridSettings)
	const missingUrl = qbittorrent && url.trim() === ''

	const otherRoots = (roots?.roots ?? []).filter(root => root.path !== settings.default_folder)
	const folderValue = otherRoots.some(root => root.id === rootId) ? String(rootId) : DEFAULT_FOLDER

	useUnitWatch(clientForm.saveFailed, ({ error }) =>
		toast.error(problemDetail(error, t('torrents.settings.saveFailed')), {
			id: 'torrent-settings'
		})
	)
	useUnitWatch(libraryModel.rootAddFailedFor, ({ error, requester }) => {
		if (requester === FOLDER_REQUESTER) {
			toast.error(
				error.status === 409
					? problemDetail(error, t('library.root.overlap'))
					: problemDetail(error, t('library.root.failed')),
				{ id: 'library-root-failed' }
			)
		}
	})

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

	const connectionCheck = (disabled: boolean) => (
		<ConnectionCheck
			label={t('torrents.settings.check')}
			checking={checking}
			disabled={disabled}
			onCheck={() => runCheck()}
			status={checkStatus}
		/>
	)

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

							{connectionCheck(saving)}
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
						<QbittorrentDetail
							fields={fields}
							hasPassword={settings.has_password}
							disabled={saving}
							check={connectionCheck(missingUrl || saving)}
						/>
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
								<div className={styles.checkRow}>{connectionCheck(saving)}</div>
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
					onChange={value => folderPicked(value && value !== DEFAULT_FOLDER ? Number(value) : 0)}
					disabled={saving}
					startIcon={<Icon name='common/folder' size={20} />}
					footer={
						<AddRootMenu
							align='center'
							requester={FOLDER_REQUESTER}
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
				<Button variant='secondary' onClick={() => reset()} disabled={saving}>
					{t('common.cancel')}
				</Button>

				<Button type='submit' variant='primary' disabled={!canSave} loading={saving}>
					{t('torrents.settings.save')}
				</Button>
			</div>
		</form>
	)
}
