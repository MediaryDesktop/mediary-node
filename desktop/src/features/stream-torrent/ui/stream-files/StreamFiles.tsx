import { useUnit } from 'effector-react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatBytes, useUnitWatch } from '@shared/lib'
import { Drawer, Icon, Input, toast } from '@shared/ui'

import { useNodeQuery } from '@infra/node'

import { ControlButton } from '@entities/playback'
import { torrentStreamQuery } from '@entities/torrent'

import { canChooseFile, matchingFiles, splitPath } from '../../lib/files'
import { streamFileChosen, streamFileRefused } from '../../model/model'

import styles from './StreamFiles.module.scss'

const FILTER_FROM = 10
const TOAST_ID = 'stream-file'

export interface StreamFilesProps {
	fileId: number
}

export function StreamFiles({ fileId }: StreamFilesProps) {
	const { t } = useTranslation()
	const streamId = -fileId

	const { data: stream } = useNodeQuery(torrentStreamQuery, { params: streamId })
	const choose = useUnit(streamFileChosen)

	const [open, setOpen] = useState(false)
	const [filter, setFilter] = useState('')

	useUnitWatch(streamFileRefused, message => toast.error(message, { id: TOAST_ID }))

	const files = stream?.files

	if (!canChooseFile(files)) {
		return null
	}

	const shown = matchingFiles(files, filter)

	const pick = (id: number) => {
		setOpen(false)
		choose({ id: streamId, fileId: id })
	}

	return (
		<>
			<ControlButton
				icon='common/file-tree'
				label={t('torrents.stream.chooseFile')}
				onClick={() => setOpen(true)}
			/>

			<Drawer
				open={open}
				onOpenChange={setOpen}
				title={t('torrents.stream.files')}
				description={stream?.name}
				side='bottom'
				size='lg'
				overPlayer
			>
				<div className={styles.body}>
					{files.length >= FILTER_FROM && (
						<Input
							value={filter}
							onChange={event => setFilter(event.target.value)}
							placeholder={t('torrents.stream.filesFilter')}
							startIcon={<Icon name='common/search' size={16} />}
						/>
					)}

					<ul className={styles.files}>
						{shown.map(file => {
							const { name, folder } = splitPath(file.path)
							const current = name === stream?.name

							return (
								<li key={file.id}>
									<button
										type='button'
										className={current ? `${styles.file} ${styles.current}` : styles.file}
										title={file.path}
										disabled={current}
										onClick={() => pick(file.id)}
									>
										<span className={styles.text}>
											<span className={styles.name}>{name}</span>
											{folder && <span className={styles.folder}>{folder}</span>}
										</span>
										<span className={styles.size}>{formatBytes(file.size)}</span>
									</button>
								</li>
							)
						})}

						{shown.length === 0 && (
							<li className={styles.none}>{t('torrents.stream.filesNone')}</li>
						)}
					</ul>
				</div>
			</Drawer>
		</>
	)
}
