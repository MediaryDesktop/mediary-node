import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useEffect, useMemo } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, EmptyState, Icon, PageTransition, SegmentedControl } from '@shared/ui'
import type { IconName } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { enumLabel } from '@entities/media'
import type { MediaSummary } from '@entities/media'

import styles from './DiscoverPage.module.scss'
import { DISCOVER_TABS, discoverSections } from './lib/sections'
import type { DiscoverSection, DiscoverTab } from './lib/sections'
import { discoverModel } from './model/model'
import { DiscoverHero } from './ui/DiscoverHero'
import { DiscoverRow } from './ui/DiscoverRow'

// How many titles of the first row the banner goes through.
const FEATURED = 8

const TAB_ICONS: Record<DiscoverTab, IconName> = {
	anime: 'categories/anime',
	manga: 'categories/manga',
	movie: 'categories/movie',
	series: 'categories/series',
	dorama: 'categories/doramas',
	book: 'categories/book'
}

export interface DiscoverPageProps {
	tab: DiscoverTab
	onTabChange: (tab: DiscoverTab) => void
}

export function DiscoverPage({ tab, onTabChange }: DiscoverPageProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const [sections, request, retry, nodeReady] = useUnit([
		discoverModel.$sections,
		discoverModel.sectionsRequested,
		discoverModel.sectionRetried,
		$nodeReady
	])

	// The date only moves the anime seasons, and a page left open over a season
	// change is not worth a timer.
	const rows = useMemo(() => discoverSections(tab, new Date()), [tab])

	useEffect(() => {
		if (nodeReady) {
			request(rows)
		}
	}, [nodeReady, request, rows])

	const first = rows[0] ? sections[rows[0].key] : undefined

	const featured = useMemo(
		() =>
			(first?.items ?? []).filter(media => media.banner_image ?? media.cover_image).slice(0, FEATURED),
		[first]
	)

	const setupNeeded = rows.every(row => sections[row.key]?.setupNeeded != null)

	const open = (media: MediaSummary) =>
		void navigate({ to: '/media/$mediaRef', params: { mediaRef: media.media_ref } })

	const rowTitle = (row: DiscoverSection) => {
		const label = t(`discover.sections.${row.id}`)

		if (!row.season) {
			return label
		}

		return (
			<>
				{label}
				<span className={styles.season}>
					{enumLabel(t, 'season', row.season.season)} {row.season.year}
				</span>
			</>
		)
	}

	const tabs = (
		<SegmentedControl
			className={styles.tabControl}
			items={DISCOVER_TABS.map(value => ({
				value,
				label: (
					<span className={styles.tabLabel}>
						<Icon name={TAB_ICONS[value]} size={16} />
						{t(`search.type.${value}`)}
					</span>
				)
			}))}
			value={tab}
			onValueChange={onTabChange}
			label={t('nav.discover')}
		/>
	)

	return (
		<PageTransition className={styles.page}>
			<DiscoverHero
				key={tab}
				items={setupNeeded ? [] : featured}
				loading={!setupNeeded && first?.status !== 'failed'}
				onOpen={open}
				tabs={tabs}
			/>

			{setupNeeded ? (
				<EmptyState
					title={t('discover.tmdbNeeded')}
					description={first?.setupNeeded || undefined}
					action={
						<Button
							size='small'
							onClick={() => void navigate({ to: '/settings', search: { section: 'tmdb' } })}
						>
							{t('tmdb.openSettings')}
						</Button>
					}
				/>
			) : (
				<div className={styles.rows}>
					{rows.map(row => (
						<DiscoverRow
							key={row.key}
							title={rowTitle(row)}
							state={sections[row.key]}
							onRetry={() => retry(row)}
						/>
					))}
				</div>
			)}
		</PageTransition>
	)
}
