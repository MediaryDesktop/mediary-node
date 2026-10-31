import { useUnit } from 'effector-react'
import type { ReactNode } from 'react'
import { useEffect, useRef, useState } from 'react'
import { IoCloudOfflineOutline, IoImagesOutline, IoSearchOutline } from 'react-icons/io5'

import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { Button, Icon, Input, Modal, SegmentedControl, toast } from '@shared/ui'

import { manualCoverSearchQuery } from '@entities/media'

import type { ManualMediaType } from '../../lib/draft'
import { readImageFile } from '../../lib/read-image-file'

import styles from './PosterModal.module.scss'

export type CoverSelection =
	| { kind: 'keep' }
	| { kind: 'remove' }
	| { kind: 'url'; value: string; previewUrl: string; source: 'search' | 'url' }
	| { kind: 'data'; value: string; previewUrl: string; name: string; size: number }

function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
	return (
		<div className={styles.empty}>
			<span className={styles.emptyIcon}>{icon}</span>
			<p className={styles.emptyTitle}>{title}</p>
			{hint && <p className={styles.emptyHint}>{hint}</p>}
		</div>
	)
}

export interface PosterModalProps {
	open: boolean
	onOpenChange: (open: boolean) => void
	mediaType: ManualMediaType
	title: string
	year?: number
	existingCoverUrl?: string | null
	selection: CoverSelection
	onChange: (selection: CoverSelection) => void
	// Searching looks for posters of one kind; pasting an address or choosing a
	// file does not, so only the search waits for it.
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
	// Whether this window has searched at all: the answers are kept in a store
	// shared by every form, so what is in it may belong to an earlier title.
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

	// Opening the window on a title that is already named shows its posters
	// straight away, once: reopening it for the same title does not search again.
	useEffect(() => {
		const text = (query || title).trim()

		if (open && tab === 'search' && lastSearch.current !== `${mediaType}|${text}|${year ?? ''}`) {
			runSearch()
		}
		// Only opening should start a search; typing in the box must not.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open])

	// A picture chosen is the answer: the window has nothing more to ask.
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

						{typeMissing && (
							<EmptyState
								icon={<IoSearchOutline size={28} />}
								title={t('manualMedia.cover.needsType')}
							/>
						)}
						{!typeMissing && searching && (
							<p className={styles.hint}>{t('manualMedia.cover.searching')}</p>
						)}
						{!typeMissing && !searching && failed && (
							<EmptyState
								icon={<IoCloudOfflineOutline size={28} />}
								title={t('manualMedia.cover.failed')}
								hint={t('manualMedia.cover.failedHint')}
							/>
						)}

						{!typeMissing && searched && !searching && !failed && candidates && (
							<>
								{(candidates.images ?? []).length === 0 ? (
									<EmptyState
										icon={<IoImagesOutline size={28} />}
										title={t('manualMedia.cover.empty')}
										hint={t('manualMedia.cover.emptyHint')}
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
