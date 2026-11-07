import { useUnit } from 'effector-react'
import { useEffect, useRef, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { Button, EmptyState, Icon, Input, Modal, SegmentedControl, toast } from '@shared/ui'

import { manualCoverSearchQuery } from '@entities/media'

import type { CoverSelection } from '../../lib/cover'
import type { ManualMediaType } from '../../lib/draft'
import { readImageFile } from '../../lib/read-image-file'

import styles from './PosterModal.module.scss'

export interface PosterModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	mediaType: ManualMediaType
	title: string
	year?: number
	existingCoverUrl?: string | null
	selection: CoverSelection
	onChange: (selection: CoverSelection) => void
	typeMissing?: boolean
	disabled?: boolean
}

type Tab = 'search' | 'url' | 'upload'

export function PosterModal({
	open,
	onOpenChange,
	mediaType,
	title,
	year,
	existingCoverUrl,
	selection,
	onChange,
	typeMissing = false,
	disabled
}: PosterModalProps) {
	const { t } = useTranslation()
	const [tab, setTab] = useState<Tab>('search')
	const [query, setQuery] = useState('')
	const [url, setUrl] = useState('')
	const picker = useRef<HTMLInputElement>(null)
	const lastSearch = useRef('')
	const [searched, setSearched] = useState(false)

	const [search, reset, candidates, searching, failed] = useUnit([
		manualCoverSearchQuery.start,
		manualCoverSearchQuery.reset,
		manualCoverSearchQuery.$data,
		manualCoverSearchQuery.$pending,
		manualCoverSearchQuery.$error
	])

	const previewUrl =
		selection.kind === 'remove'
			? null
			: selection.kind === 'keep'
				? (existingCoverUrl ?? null)
				: selection.previewUrl

	useEffect(() => {
		reset()
	}, [reset])

	const runSearch = () => {
		const text = (query || title).trim()

		if (typeMissing || text === '') {
			return
		}

		lastSearch.current = `${mediaType}|${text}|${year ?? ''}`
		setSearched(true)
		search({ type: mediaType, title: text, year })
	}

	useEffect(() => {
		const text = (query || title).trim()

		if (open && tab === 'search' && lastSearch.current !== `${mediaType}|${text}|${year ?? ''}`) {
			runSearch()
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	const choose = (next: CoverSelection) => {
		onChange(next)
		onOpenChange(false)
	}

	const pickFile = async (file: File | undefined) => {
		if (!file) {
			return
		}

		try {
			const read = await readImageFile(file)
			choose({
				kind: 'data',
				value: read.data,
				previewUrl: read.previewUrl,
				name: file.name,
				size: file.size
			})
		} catch {
			toast.error(t('manualMedia.cover.invalidFile'), { id: 'manual-cover-file' })
		}
	}

	return (
		<Modal
			open={open}
			onOpenChange={onOpenChange}
			size='md'
			title={t('manualMedia.cover.title')}
			description={t('manualMedia.cover.hint')}
			footer={
				<>
					{previewUrl && (
						<div className={styles.current}>
							<img src={previewUrl} alt='' draggable={false} className={styles.currentThumb} />

							<span className={styles.currentInfo}>
								<span className={styles.currentLabel}>{t('manualMedia.cover.current')}</span>
								<span className={styles.currentName}>
									{selection.kind === 'data'
										? `${selection.name} · ${formatBytes(selection.size)}`
										: t(
												selection.kind === 'url' && selection.source === 'search'
													? 'manualMedia.cover.fromSearch'
													: 'manualMedia.cover.fromUrl'
											)}
								</span>
							</span>

							{!disabled && (
								<Button
									variant='ghost'
									size='small'
									startIcon={<Icon name='common/trash' size={14} />}
									onClick={() =>
										choose(existingCoverUrl ? { kind: 'remove' } : { kind: 'keep' })
									}
								>
									{t('manualMedia.cover.remove')}
								</Button>
							)}
						</div>
					)}

					<Button variant='primary' onClick={() => onOpenChange(false)}>
						{t('manualMedia.cover.done')}
					</Button>
				</>
			}
		>
			<div className={styles.root}>
				<SegmentedControl
					className={styles.tabs}
					size='large'
					label={t('manualMedia.cover.title')}
					value={tab}
					onValueChange={setTab}
					items={[
						{ value: 'search', label: t('manualMedia.cover.tabSearch') },
						{ value: 'url', label: t('manualMedia.cover.tabUrl') },
						{ value: 'upload', label: t('manualMedia.cover.tabUpload') }
					]}
				/>

				{tab === 'search' && (
					<div className={styles.panel}>
						<form
							className={styles.row}
							onSubmit={event => {
								event.preventDefault()
								runSearch()
							}}
						>
							<Input
								value={query}
								onChange={event => setQuery(event.target.value)}
								placeholder={title || t('manualMedia.cover.searchPlaceholder')}
								startIcon={<Icon name='common/search' size={16} />}
								disabled={disabled}
							/>

							<Button
								type='submit'
								variant='secondary'
								loading={searching}
								disabled={disabled || typeMissing}
							>
								{t('manualMedia.cover.tabSearch')}
							</Button>
						</form>

						{typeMissing && <EmptyState title={t('manualMedia.cover.needsType')} />}
						{!typeMissing && searching && (
							<p className={styles.hint}>{t('manualMedia.cover.searching')}</p>
						)}
						{!typeMissing && !searching && failed && (
							<EmptyState
								title={t('manualMedia.cover.failed')}
								description={t('manualMedia.cover.failedHint')}
							/>
						)}

						{!typeMissing && searched && !searching && !failed && candidates && (
							<>
								{(candidates.images ?? []).length === 0 ? (
									<EmptyState
										title={t('manualMedia.cover.empty')}
										description={t('manualMedia.cover.emptyHint')}
									/>
								) : (
									<ul className={styles.grid}>
										{candidates.images?.map(image => (
											<li key={image.url}>
												<button
													type='button'
													className={styles.candidate}
													disabled={disabled}
													onClick={() =>
														choose({
															kind: 'url',
															value: image.url,
															previewUrl: image.thumbnail,
															source: 'search'
														})
													}
												>
													<img
														src={image.thumbnail}
														alt=''
														draggable={false}
														loading='lazy'
													/>
												</button>
											</li>
										))}
									</ul>
								)}
							</>
						)}
					</div>
				)}

				{tab === 'url' && (
					<form
						className={styles.panel}
						onSubmit={event => {
							event.preventDefault()
							const trimmed = url.trim()
							if (trimmed) {
								choose({ kind: 'url', value: trimmed, previewUrl: trimmed, source: 'url' })
							}
						}}
					>
						<div className={styles.row}>
							<Input
								value={url}
								onChange={event => setUrl(event.target.value)}
								placeholder={t('manualMedia.cover.urlPlaceholder')}
								startIcon={<Icon name='common/link' size={16} />}
								autoComplete='off'
								disabled={disabled}
							/>

							<Button type='submit' disabled={disabled || url.trim() === ''}>
								{t('manualMedia.cover.useUrl')}
							</Button>
						</div>
					</form>
				)}

				{tab === 'upload' && (
					<div className={styles.panel}>
						<button
							type='button'
							className={styles.drop}
							disabled={disabled}
							onClick={() => picker.current?.click()}
						>
							<Icon name='common/folder-open' size={26} />
							{t('manualMedia.cover.chooseFile')}
						</button>

						<input
							ref={picker}
							type='file'
							accept='image/*'
							className={styles.filePicker}
							onChange={event => {
								void pickFile(event.target.files?.[0])
								event.target.value = ''
							}}
						/>
					</div>
				)}
			</div>
		</Modal>
	)
}
