import { useUnit } from 'effector-react'
import { IoCloudOutline } from 'react-icons/io5'
import { SiQbittorrent } from 'react-icons/si'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, ConnectionCheck, Icon, Input, SelectDropdown, toast } from '@shared/ui'

import { AddRootMenu, libraryModel, libraryRootsQuery } from '@entities/library-item'
import { readyDebrid, torrentDebridQuery } from '@entities/torrent'
import type { TorrentSettings } from '@entities/torrent'

import type { ClientFields } from '../../lib/form'
import { NONE } from '../../lib/form'
import { clientForm } from '../../model/form'
import { FOLDER_REQUESTER } from '../../model/model'

import { OptionCard } from './option-card/OptionCard'
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

	const [pick, connectionChanged, mappingChanged, folderPicked, runCheck, submit, reset] = useUnit([
		clientForm.picked,
		clientForm.connectionChanged,
		clientForm.mappingChanged,
		clientForm.folderPicked,
		clientForm.checkRequested,
		clientForm.submitted,
		clientForm.reset
	])

	const { choice, url, username, password, rootId, mapClient, mapNode } = fields

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
								onCheck={() => runCheck()}
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
										onChange={event =>
											connectionChanged({ field: 'url', value: event.target.value })
										}
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
										onChange={event =>
											connectionChanged({
												field: 'username',
												value: event.target.value
											})
										}
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
									onChange={event =>
										connectionChanged({ field: 'password', value: event.target.value })
									}
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
									onCheck={() => runCheck()}
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
											onChange={event =>
												mappingChanged({
													field: 'mapClient',
													value: event.target.value
												})
											}
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
											onChange={event =>
												mappingChanged({
													field: 'mapNode',
													value: event.target.value
												})
											}
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
										onCheck={() => runCheck()}
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
