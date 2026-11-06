import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { formatBytes, useUnitWatch } from '@shared/lib'
import { Button, Checkbox, Drawer, DrawerForm, DrawerSection, toast } from '@shared/ui'

import { titleFilesQuery } from '@entities/library-item'
import {
	selectTorrentFilesMutation,
	torrentFilesClosed,
	torrentFilesOpened,
	torrentFilesQuery
} from '@entities/torrent'
import type { TorrentDownload } from '@entities/torrent'

import { initialSelection, OwnedEpisodes, sortFiles } from '../../../lib/file-selection'

import styles from './TorrentFilesDrawer.module.scss'

export interface TorrentFilesDrawerProps {
	download: TorrentDownload | null
	onClose: () => void
}

export function TorrentFilesDrawer({ download, onClose }: TorrentFilesDrawerProps) {
	const { t } = useTranslation()

	const [opened, closed] = useUnit([torrentFilesOpened, torrentFilesClosed])

	const id = download?.id ?? null

	useEffect(() => {
		if (id === null) {
			return
		}

		opened(id)

		return () => closed()
	}, [id, opened, closed])

	return (
		<Drawer
			open={download !== null}
			onOpenChange={next => !next && onClose()}
			title={t('torrents.files.title')}
			description={download ? download.name || download.title : undefined}
			closable={false}
		>
			{download && <FilesForm key={download.id} download={download} onDone={onClose} />}
		</Drawer>
	)
}

function baseName(path: string): string {
	return path.slice(path.lastIndexOf('/') + 1)
}

function FilesForm({ download, onDone }: { download: TorrentDownload; onDone: () => void }) {
	const { t } = useTranslation()

	const [data, pending, select, saving, library, loadLibrary] = useUnit([
		torrentFilesQuery.$data,
		torrentFilesQuery.$pending,
		selectTorrentFilesMutation.start,
		selectTorrentFilesMutation.$pending,
		titleFilesQuery.$data,
		titleFilesQuery.start
	])

	useEffect(() => {
		loadLibrary({ mediaRef: download.media_ref, kind: 'video' })
	}, [download.media_ref, loadLibrary])

	useUnitWatch(selectTorrentFilesMutation.finished.success, () => onDone())
	useUnitWatch(selectTorrentFilesMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('torrents.files.failed')), { id: 'torrent-files' })
	)

	const files = useMemo(() => sortFiles(data?.files ?? []), [data])

	const seasonal = download.media_ref.startsWith('tmdb:tv:')

	const owned = useMemo(
		() => OwnedEpisodes.fromLibrary(library?.files.items ?? [], seasonal),
		[library, seasonal]
	)

	const [touched, setTouched] = useState<Set<number> | null>(null)
	const selected = touched ?? initialSelection(files, owned, download.choosing)

	const toggle = (index: number, on: boolean) => {
		const next = new Set(selected)
		if (on) {
			next.add(index)
		} else {
			next.delete(index)
		}
		setTouched(next)
	}

	const total = files.filter(file => selected.has(file.index)).reduce((sum, file) => sum + file.size, 0)

	return (
		<DrawerForm
			onSubmit={() => select({ id: download.id, selected: [...selected] })}
			onCancel={onDone}
			submitLabel={download.choosing ? t('torrents.files.start') : t('torrents.files.save')}
			submitDisabled={saving || selected.size === 0}
			cancelDisabled={saving}
			submitting={saving}
		>
			{files.length === 0 ? (
				<p className={styles.waiting}>
					{pending ? t('torrents.files.loading') : t('torrents.files.waiting')}
				</p>
			) : (
				<DrawerSection
					title={t('torrents.files.selected', { count: selected.size, size: formatBytes(total) })}
					description={download.choosing ? t('torrents.files.hint') : undefined}
				>
					<div className={styles.bulk}>
						<Button
							size='small'
							variant='ghost'
							disabled={saving}
							onClick={() => setTouched(new Set(files.map(file => file.index)))}
						>
							{t('torrents.files.all')}
						</Button>
						<Button
							size='small'
							variant='ghost'
							disabled={saving}
							onClick={() =>
								setTouched(
									new Set(files.filter(file => !owned.has(file)).map(file => file.index))
								)
							}
						>
							{t('torrents.files.missing')}
						</Button>
						<Button
							size='small'
							variant='ghost'
							disabled={saving}
							onClick={() => setTouched(new Set())}
						>
							{t('torrents.files.none')}
						</Button>
					</div>

					<ul className={styles.list}>
						{files.map(file => {
							const inLibrary = owned.has(file)

							const checked = selected.has(file.index)

							return (
								<li
									key={file.index}
									role='presentation'
									className={clsx(
										styles.file,
										!file.video && styles.other,
										!checked && styles.off
									)}
									onClick={() => !saving && toggle(file.index, !checked)}
								>
									<Checkbox
										checked={checked}
										onCheckedChange={on => toggle(file.index, on)}
										label={file.name}
										disabled={saving}
									/>

									{file.episode !== undefined ? (
										<span className={styles.episode}>
											{seasonal && file.season
												? t('torrents.files.seasonEpisode', {
														season: file.season,
														number: file.episode
													})
												: t('torrents.files.episode', { number: file.episode })}
										</span>
									) : (
										<span className={styles.noEpisode} />
									)}

									<span className={styles.name} title={file.name}>
										{baseName(file.name)}
									</span>

									<span className={styles.meta}>
										{inLibrary && (
											<span className={styles.owned}>
												{t('torrents.files.inLibrary')}
											</span>
										)}
										<span>{formatBytes(file.size)}</span>
									</span>
								</li>
							)
						})}
					</ul>
				</DrawerSection>
			)}
		</DrawerForm>
	)
}
