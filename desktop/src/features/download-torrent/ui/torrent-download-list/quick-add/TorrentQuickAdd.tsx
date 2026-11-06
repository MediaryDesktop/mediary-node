import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { useState } from 'react'
import type { DragEvent, FormEvent } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Icon, Input, toast } from '@shared/ui'

import { addTorrentMutation } from '@entities/torrent'

import { readTorrentFile } from '../../../lib/read-torrent-file'

import styles from './TorrentQuickAdd.module.scss'

export interface TorrentQuickAddProps {
	mediaRef: string
	title: string
}

export function TorrentQuickAdd({ mediaRef, title }: TorrentQuickAddProps) {
	const { t } = useTranslation()

	const [add, adding] = useUnit([addTorrentMutation.start, addTorrentMutation.$pending])

	const [magnet, setMagnet] = useState('')
	const [dragOver, setDragOver] = useState(false)

	useUnitWatch(addTorrentMutation.finished.success, () => setMagnet(''))
	useUnitWatch(addTorrentMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('torrents.drawer.failed')), { id: 'torrent-add' })
	)

	const submitMagnet = (event: FormEvent) => {
		event.preventDefault()
		const trimmed = magnet.trim()

		if (trimmed && !adding) {
			add({ media_ref: mediaRef, title, magnet: trimmed, choose_files: true })
		}
	}

	const submitFile = async (file: File) => {
		if (!file.name.toLowerCase().endsWith('.torrent')) {
			toast.error(t('torrents.drawer.fileUnreadable'), { id: 'torrent-file' })
			return
		}

		try {
			add({ media_ref: mediaRef, title, torrent: await readTorrentFile(file), choose_files: true })
		} catch {
			toast.error(t('torrents.drawer.fileUnreadable'), { id: 'torrent-file' })
		}
	}

	const onDrop = (event: DragEvent<HTMLDivElement>) => {
		event.preventDefault()
		setDragOver(false)

		const file = event.dataTransfer.files[0]
		if (file) void submitFile(file)
	}

	return (
		<div
			className={clsx(styles.root, dragOver && styles.dragOver)}
			onDragOver={event => {
				event.preventDefault()
				setDragOver(true)
			}}
			onDragLeave={() => setDragOver(false)}
			onDrop={onDrop}
		>
			<span className={styles.icon}>
				<Icon name='common/download' size={28} />
			</span>

			<p className={styles.title}>{t('torrents.list.emptyForTitle')}</p>
			<p className={styles.hint}>{t('torrents.list.emptyForTitleHint')}</p>

			<form className={styles.form} onSubmit={submitMagnet}>
				<Input
					value={magnet}
					onChange={event => setMagnet(event.target.value)}
					startIcon={<Icon name='common/link' size={16} />}
					placeholder={t('torrents.drawer.magnetPlaceholder')}
					disabled={adding}
					spellCheck={false}
					className={styles.input}
				/>
				<Button type='submit' disabled={adding || magnet.trim() === ''} loading={adding}>
					{t('torrents.list.quickAdd')}
				</Button>
			</form>

			<p className={styles.caption}>{t('torrents.list.dropHint')}</p>
		</div>
	)
}
