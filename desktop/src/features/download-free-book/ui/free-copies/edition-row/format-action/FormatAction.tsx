import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { IoIosRefresh } from 'react-icons/io'

import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { Button, Icon } from '@shared/ui'

import { enqueueBookDownloadMutation, retryBookDownloadMutation } from '@entities/book-source'
import type { BookDownload, BookEdition, BookFormat } from '@entities/book-source'

import { downloadRequested } from '../../../../model/model'

export interface FormatActionProps {
	edition: BookEdition
	format: BookFormat
	mediaRef: string
	download: BookDownload | undefined
}

export function FormatAction({ edition, format, mediaRef, download }: FormatActionProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [request, retry, queueing] = useUnit([
		downloadRequested,
		retryBookDownloadMutation.start,
		enqueueBookDownloadMutation.$pending
	])

	const label = [format.ext.replace('.', '').toUpperCase(), format.size ? formatBytes(format.size) : '']
		.filter(Boolean)
		.join(' · ')

	if (download?.state === 'done' && download.file_id) {
		const fileId = String(download.file_id)

		return (
			<Button
				size='small'
				variant='primary'
				startIcon={<Icon name='common/book-open' size={16} />}
				onClick={() => void navigate({ to: '/read-book/$fileId', params: { fileId } })}
			>
				{t('reader.book.read')}
			</Button>
		)
	}

	if (download?.state === 'queued' || download?.state === 'running') {
		const percent =
			download.bytes_total > 0 ? Math.round((download.bytes_done / download.bytes_total) * 100) : null

		return (
			<Button size='small' disabled>
				{percent === null
					? t(`bookSources.downloads.states.${download.state}`)
					: t('bookSources.copies.saving', { percent })}
			</Button>
		)
	}

	if (download?.state === 'failed' || download?.state === 'cancelled') {
		return (
			<Button
				size='small'
				startIcon={<IoIosRefresh size={14} />}
				title={download.error}
				onClick={() => retry(download.id)}
			>
				{t('bookSources.copies.retry', { format: label })}
			</Button>
		)
	}

	return (
		<Button
			size='small'
			startIcon={<Icon name='common/download' size={16} />}
			disabled={queueing}
			onClick={() => request({ edition_ref: edition.ref, format: format.type, media_ref: mediaRef })}
		>
			{label}
		</Button>
	)
}
