import { useUnit } from 'effector-react'
import { useRef, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { formatBytes } from '@shared/lib'
import { Button, Icon, Input, Tabs, toast, Tooltip } from '@shared/ui'

import { manualCoverSearchQuery } from '@entities/media'

import type { ManualMediaType } from '../../lib/draft'
import { readImageFile } from '../../lib/read-image-file'

import styles from './PosterCard.module.scss'

export type CoverSelection =
	| { kind: 'keep' }
	| { kind: 'remove' }
	| { kind: 'url'; value: string; previewUrl: string; source: 'search' | 'url' }
	| { kind: 'data'; value: string; previewUrl: string; name: string; size: number }

export interface PosterCardProps {
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

export function PosterCard({
	mediaType,
	title,
	year,
	existingCoverUrl,
	selection,
	onChange,
	typeMissing = false,
	disabled
}: PosterCardProps) {
	const { t } = useTranslation()
	const [tab, setTab] = useState<Tab>('search')
	const [query, setQuery] = useState('')
	const [url, setUrl] = useState('')
	const picker = useRef<HTMLInputElement>(null)

	const [search, candidates, searching, failed] = useUnit([
		manualCoverSearchQuery.start,
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

	const canRemove = previewUrl !== null

	const runSearch = () => search({ type: mediaType, title: (query || title).trim(), year })

	const pickFile = async (file: File | undefined) => {
		if (!file) {
			return
		}

		try {
			const read = await readImageFile(file)
			onChange({
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
		<section className={styles.card}>
			<h3 className={styles.title}>
				{t('manualMedia.cover.title')}

				<Tooltip content={t('manualMedia.cover.hint')}>
					<span className={styles.infoDot} tabIndex={0}>
						<Icon name='common/info' size={14} />
					</span>
				</Tooltip>
			</h3>

			<Tabs
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
						className={styles.searchForm}
						onSubmit={event => {
							event.preventDefault()
							if (!typeMissing) {
								runSearch()
							}
						}}
					>
						<Input
							value={query}
							onChange={event => setQuery(event.target.value)}
							placeholder={title || t('manualMedia.cover.searchPlaceholder')}
							disabled={disabled}
						/>

						<Button
							type='submit'
							variant='secondary'
							iconOnly
							aria-label={t('manualMedia.cover.search')}
							loading={searching}
							disabled={disabled || typeMissing}
						>
							<Icon name='common/search' size={18} />
						</Button>
					</form>

					{typeMissing && <p className={styles.hint}>{t('manualMedia.cover.needsType')}</p>}

					{searching && <p className={styles.hint}>{t('manualMedia.cover.searching')}</p>}
					{!searching && failed && <p className={styles.hint}>{t('manualMedia.cover.failed')}</p>}

					{!searching && !failed && candidates && (
						<>
							{(candidates.images ?? []).length === 0 ? (
								<p className={styles.hint}>{t('manualMedia.cover.empty')}</p>
							) : (
								<ul className={styles.grid}>
									{candidates.images?.map(image => (
										<li key={image.url}>
											<button
												type='button'
												className={styles.candidate}
												disabled={disabled}
												onClick={() =>
													onChange({
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
							onChange({ kind: 'url', value: trimmed, previewUrl: trimmed, source: 'url' })
						}
					}}
				>
					<Input
						value={url}
						onChange={event => setUrl(event.target.value)}
						placeholder={t('manualMedia.cover.urlPlaceholder')}
						startIcon={<Icon name='common/link' size={16} />}
						autoComplete='off'
						disabled={disabled}
					/>
					<Button
						type='submit'
						variant='secondary'
						fullWidth
						disabled={disabled || url.trim() === ''}
					>
						{t('manualMedia.cover.useUrl')}
					</Button>
				</form>
			)}

			{tab === 'upload' && (
				<div className={styles.panel}>
					<Button
						type='button'
						variant='secondary'
						fullWidth
						disabled={disabled}
						startIcon={<Icon name='common/folder-open' size={16} />}
						onClick={() => picker.current?.click()}
					>
						{t('manualMedia.cover.chooseFile')}
					</Button>

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

			{previewUrl && (
				<div className={styles.current}>
					<span className={styles.currentLabel}>{t('manualMedia.cover.current')}</span>

					<div className={styles.currentRow}>
						<img src={previewUrl} alt='' draggable={false} className={styles.currentThumb} />

						<span className={styles.currentInfo}>
							{selection.kind === 'data' ? (
								<>
									<span className={styles.currentName}>{selection.name}</span>
									<span className={styles.currentMeta}>{formatBytes(selection.size)}</span>
								</>
							) : (
								<span className={styles.currentName}>
									{t(
										selection.kind === 'url' && selection.source === 'search'
											? 'manualMedia.cover.fromSearch'
											: 'manualMedia.cover.fromUrl'
									)}
								</span>
							)}
						</span>

						{canRemove && !disabled && (
							<Button
								iconOnly
								variant='ghost'
								size='small'
								aria-label={t('manualMedia.cover.remove')}
								onClick={() =>
									onChange(existingCoverUrl ? { kind: 'remove' } : { kind: 'keep' })
								}
							>
								<Icon name='common/close' size={14} />
							</Button>
						)}
					</div>
				</div>
			)}
		</section>
	)
}
