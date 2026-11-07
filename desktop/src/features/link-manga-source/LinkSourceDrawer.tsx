import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import {
	Badge,
	Button,
	Drawer,
	DrawerSection,
	Icon,
	Input,
	ReelLoader,
	SelectionGroup,
	toast
} from '@shared/ui'

import { useNodeData } from '@infra/node'

import { extensionsQuery } from '@entities/extension'
import { mangaSearchQuery, putMangaLinkMutation } from '@entities/manga-source'
import type { MangaSource } from '@entities/manga-source'

import styles from './LinkSourceDrawer.module.scss'
import { SourceOptionIcon } from './source-option-icon/SourceOptionIcon'

export interface LinkSourceDrawerProps {
	open: boolean
	mediaRef: string
	title: string
	sources: MangaSource[]
	initialSource?: string
	onClose: () => void
}

export function LinkSourceDrawer({ open, onClose, ...props }: LinkSourceDrawerProps) {
	const { t } = useTranslation()

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && onClose()}
			title={t('mangaSources.link.title')}
			description={t('mangaSources.link.description')}
			closable={false}
			size='lg'
			onOpenAutoFocus={event => {
				event.preventDefault()
				if (event.currentTarget instanceof HTMLElement) {
					event.currentTarget.querySelector('input')?.focus({ preventScroll: true })
				}
			}}
		>
			{open && <LinkForm key={props.mediaRef} {...props} onDone={onClose} />}
		</Drawer>
	)
}

interface LinkFormProps extends Omit<LinkSourceDrawerProps, 'open' | 'onClose'> {
	onDone: () => void
}

function LinkForm({ mediaRef, title, sources, initialSource, onDone }: LinkFormProps) {
	const { t } = useTranslation()

	const [search, reset, data, error, pending, link, linking, extensions] = useUnit([
		mangaSearchQuery.start,
		mangaSearchQuery.reset,
		mangaSearchQuery.$data,
		mangaSearchQuery.$error,
		mangaSearchQuery.$pending,
		putMangaLinkMutation.start,
		putMangaLinkMutation.$pending,
		extensionsQuery.$data
	])

	const [source, setSource] = useState(initialSource ?? sources[0]?.id ?? '')
	const [query, setQuery] = useState(title)

	useEffect(() => {
		reset()
	}, [reset, source])

	useNodeData(mangaSearchQuery, {
		params: { source, query: title.trim(), mediaRef },
		enabled: Boolean(source && title.trim())
	})

	useNodeData(extensionsQuery)

	const icons = new Map<string, string>(
		(extensions?.extensions ?? []).flatMap(ext => (ext.icon ? [[`plugin:${ext.id}`, ext.icon]] : []))
	)

	useUnitWatch(putMangaLinkMutation.finished.success, () => onDone())
	useUnitWatch(putMangaLinkMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('mangaSources.link.failed')), { id: 'manga-link-failed' })
	)

	const submitSearch = () => {
		if (source && query.trim()) {
			search({ source, query: query.trim(), mediaRef })
		}
	}

	const results = data?.series ?? []

	return (
		<div className={styles.root}>
			{sources.length > 1 && (
				<DrawerSection
					title={t('mangaSources.link.sourceLabel')}
					description={t('mangaSources.link.sourceDescription')}
					className={styles.sourceSection}
				>
					<SelectionGroup
						options={sources.map(item => ({
							value: item.id,
							label: item.name,
							icon: (
								<SourceOptionIcon
									source={item.id}
									name={item.name}
									image={icons.get(item.id)}
								/>
							)
						}))}
						value={source}
						onValueChange={setSource}
						label={t('mangaSources.link.sourceLabel')}
					/>
				</DrawerSection>
			)}

			<DrawerSection
				title={t('mangaSources.link.searchLabel')}
				description={t('mangaSources.link.searchDescription')}
				className={styles.searchSection}
			>
				<form
					className={styles.search}
					onSubmit={event => {
						event.preventDefault()
						submitSearch()
					}}
				>
					<Input
						value={query}
						onChange={event => setQuery(event.target.value)}
						startIcon={<Icon name='common/search' size={16} />}
						autoComplete='off'
						maxLength={200}
					/>
					<Button type='submit' disabled={!query.trim() || pending}>
						{t('mangaSources.link.search')}
					</Button>
				</form>
			</DrawerSection>

			{pending ? (
				<div className={styles.status}>
					<ReelLoader spinning />
				</div>
			) : error ? (
				<p className={styles.status}>{problemDetail(error, t('mangaSources.link.failed'))}</p>
			) : data && results.length === 0 ? (
				<p className={styles.status}>{t('mangaSources.link.noResults')}</p>
			) : (
				<ul className={styles.results}>
					{results.map(series => (
						<li key={series.id} className={styles.result}>
							<span className={styles.name}>
								{series.title}
								{series.detail && <span className={styles.detail}> · {series.detail}</span>}
								{series.matched && (
									<Badge tone='success' className={styles.matched}>
										{t('mangaSources.link.matched')}
									</Badge>
								)}
							</span>
							<Button
								size='small'
								variant='primary'
								className={styles.use}
								disabled={linking}
								onClick={() =>
									link({ mediaRef, source, seriesId: series.id, seriesTitle: series.title })
								}
							>
								{t('mangaSources.link.choose')}
							</Button>
						</li>
					))}
				</ul>
			)}
		</div>
	)
}
