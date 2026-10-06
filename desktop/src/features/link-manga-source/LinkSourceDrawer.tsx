import { useUnit } from 'effector-react'
import { useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
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

import { mangaSearchQuery, putMangaLinkMutation } from '@entities/manga-source'
import type { MangaSource } from '@entities/manga-source'

import styles from './LinkSourceDrawer.module.scss'

export interface LinkSourceDrawerProps {
	open: boolean
	mediaRef: string
	// The title's name, as the first search.
	title: string
	sources: MangaSource[]
	// The source to start on, when the user is changing an existing link.
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
				// Focus the search field without selecting its text: the title is
				// already in it, and a selected one looks like it is about to be replaced.
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

	const [search, reset, data, error, pending, link, linking] = useUnit([
		mangaSearchQuery.start,
		mangaSearchQuery.reset,
		mangaSearchQuery.$data,
		mangaSearchQuery.$error,
		mangaSearchQuery.$pending,
		putMangaLinkMutation.start,
		putMangaLinkMutation.$pending
	])

	const [source, setSource] = useState(initialSource ?? sources[0]?.id ?? '')
	const [query, setQuery] = useState(title)

	// Opening the drawer searches for the title straight away; the user only types
	// when its name on the server is different.
	useEffect(() => {
		reset()
		if (source && title.trim()) {
			search({ source, query: title.trim(), mediaRef })
		}
	}, [reset, search, source, title, mediaRef])

	useEffect(() => {
		const stop = [
			putMangaLinkMutation.finished.success.watch(() => onDone()),
			putMangaLinkMutation.finished.failure.watch(({ error }) =>
				toast.error(error.body?.detail ?? t('mangaSources.link.failed'), { id: 'manga-link-failed' })
			)
		]

		return () => stop.forEach(unwatch => unwatch())
	}, [onDone, t])

	const submitSearch = () => {
		if (source && query.trim()) {
			search({ source, query: query.trim(), mediaRef })
		}
	}

	const results = data?.series ?? []

	return (
		<div className={styles.root}>
			{sources.length > 1 && (
				<DrawerSection title={t('mangaSources.link.sourceLabel')}>
					<SelectionGroup
						options={sources.map(item => ({ value: item.id, label: item.name }))}
						value={source}
						onValueChange={setSource}
						label={t('mangaSources.link.sourceLabel')}
					/>
				</DrawerSection>
			)}

			<DrawerSection title={t('mangaSources.link.searchLabel')}>
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
				<p className={styles.status}>{error.body?.detail ?? t('mangaSources.link.failed')}</p>
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
