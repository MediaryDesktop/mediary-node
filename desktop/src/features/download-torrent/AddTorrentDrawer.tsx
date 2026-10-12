import { useUnit } from 'effector-react'
import { useRef, useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import {
	Button,
	Checkbox,
	Drawer,
	DrawerForm,
	DrawerSection,
	Icon,
	ListTile,
	Textarea,
	toast
} from '@shared/ui'

import { addTorrentMutation } from '@entities/torrent'

import styles from './AddTorrentDrawer.module.scss'

export interface AddTorrentDrawerProps {
	open: boolean
	mediaRef: string
	// The title's name; it also names the folder the torrent is saved into.
	title: string
	onClose: () => void
}

// The form is mounted afresh for every opening, so it never carries a magnet over
// from another title.
export function AddTorrentDrawer({ open, mediaRef, title, onClose }: AddTorrentDrawerProps) {
	const { t } = useTranslation()

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && onClose()}
			title={t('torrents.drawer.title')}
			description={t('torrents.drawer.description', { title })}
			closable={false}
		>
			{open && <AddForm mediaRef={mediaRef} title={title} onDone={onClose} />}
		</Drawer>
	)
}

interface TorrentFile {
	name: string
	// Base64, as the node takes it.
	content: string
}

function readAsBase64(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader()

		reader.onload = () => {
			const url = String(reader.result)
			resolve(url.slice(url.indexOf(',') + 1))
		}
		reader.onerror = () => reject(reader.error)

		reader.readAsDataURL(file)
	})
}

function AddForm({ mediaRef, title, onDone }: { mediaRef: string; title: string; onDone: () => void }) {
	const { t } = useTranslation()

	const [add, adding] = useUnit([addTorrentMutation.start, addTorrentMutation.$pending])

	const [magnet, setMagnet] = useState('')
	const [file, setFile] = useState<TorrentFile | null>(null)
	// On by default: a batch is the common case, and picking from it is the point.
	const [chooseFiles, setChooseFiles] = useState(true)
	const picker = useRef<HTMLInputElement>(null)

	useUnitWatch(addTorrentMutation.finished.success, () => onDone())
	useUnitWatch(addTorrentMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('torrents.drawer.failed')), { id: 'torrent-add' })
	)

	const pick = async (chosen: File | undefined) => {
		if (!chosen) {
			return
		}

		try {
			setFile({ name: chosen.name, content: await readAsBase64(chosen) })
			setMagnet('')
		} catch {
			toast.error(t('torrents.drawer.fileUnreadable'), { id: 'torrent-file' })
		}
	}

	const submit = () =>
		add(
			file
				? { media_ref: mediaRef, title, torrent: file.content, choose_files: chooseFiles }
				: { media_ref: mediaRef, title, magnet: magnet.trim(), choose_files: chooseFiles }
		)

	return (
		<DrawerForm
			onSubmit={submit}
			onCancel={onDone}
			submitLabel={t('torrents.drawer.submit')}
			submitDisabled={adding || (!file && magnet.trim() === '')}
			cancelDisabled={adding}
			submitting={adding}
		>
			<DrawerSection title={t('torrents.drawer.magnetLabel')}>
				<Textarea
					value={magnet}
					onChange={event => setMagnet(event.target.value)}
					disabled={adding || file !== null}
					spellCheck={false}
					rows={4}
					placeholder={t('torrents.drawer.magnetPlaceholder')}
				/>
			</DrawerSection>

			<DrawerSection title={t('torrents.drawer.fileLabel')}>
				<input
					ref={picker}
					type='file'
					accept='.torrent,application/x-bittorrent'
					className={styles.picker}
					onChange={event => {
						void pick(event.target.files?.[0])
						event.target.value = ''
					}}
				/>

				{file ? (
					<ListTile
						icon='common/link'
						title={file.name}
						titleHint={file.name}
						actions={
							<Button
								size='small'
								variant='ghost'
								iconOnly
								aria-label={t('torrents.drawer.clearFile')}
								title={t('torrents.drawer.clearFile')}
								startIcon={<Icon name='common/close' size={14} />}
								disabled={adding}
								onClick={() => setFile(null)}
							/>
						}
					/>
				) : (
					<Button
						size='small'
						startIcon={<Icon name='common/folder-open' size={16} />}
						disabled={adding}
						onClick={() => picker.current?.click()}
					>
						{t('torrents.drawer.chooseFile')}
					</Button>
				)}
			</DrawerSection>

			<div
				role='presentation'
				className={styles.checkRow}
				onClick={() => !adding && setChooseFiles(!chooseFiles)}
			>
				<Checkbox
					checked={chooseFiles}
					onCheckedChange={setChooseFiles}
					label={t('torrents.drawer.chooseFiles')}
					disabled={adding}
				/>
				<span className={styles.checkLabel}>{t('torrents.drawer.chooseFiles')}</span>
			</div>
		</DrawerForm>
	)
}
