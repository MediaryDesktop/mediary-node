import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useEffect, useMemo, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { Button, Checkbox, Drawer, DrawerForm, DrawerSection, toast } from '@shared/ui'

import { titleFilesQuery } from '@entities/library-item'
import {
	selectTorrentFilesMutation,
	torrentFilesClosed,
	torrentFilesOpened,
	torrentFilesQuery
} from '@entities/torrent'
import type { TorrentDownload } from '@entities/torrent'

import { initialSelection, sortFiles } from './lib/file-selection'
import styles from './TorrentFilesDrawer.module.scss'

export interface TorrentFilesDrawerProps {
	// The download whose files are chosen; null keeps the drawer closed.
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

// A batch keeps every file in the release's folder; repeating it on each row
// only pushes the part that differs out of sight.
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

	useEffect(() => {
		const stop = [
			selectTorrentFilesMutation.finished.success.watch(() => onDone()),
			selectTorrentFilesMutation.finished.failure.watch(({ error }) =>
				toast.error(error.body?.detail ?? t('torrents.files.failed'), { id: 'torrent-files' })
			)
		]

		return () => stop.forEach(unwatch => unwatch())
	}, [onDone, t])

	const files = useMemo(() => sortFiles(data?.files ?? []), [data])

	// The episodes already on disk for this title; a missing file is not one.
	const owned = useMemo(() => {
		const episodes = new Set<number>()

		for (const file of library?.files.items ?? []) {
			const episode = file.match?.episode ?? file.parsed.episode
			if (!file.missing && episode !== undefined && episode !== null) {
				episodes.add(episode)
			}
		}

		return episodes
	}, [library])

	// Ticks are the user's from the first change on; until then they follow what
	// the torrent and the library say, which may still be arriving.
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
									new Set(
										files
											.filter(
												file =>
													!(
														file.video &&
														file.episode !== undefined &&
														owned.has(file.episode)
													)
											)
											.map(file => file.index)
									)
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
							const inLibrary =
								file.video && file.episode !== undefined && owned.has(file.episode)

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
											{t('torrents.files.episode', { number: file.episode })}
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
