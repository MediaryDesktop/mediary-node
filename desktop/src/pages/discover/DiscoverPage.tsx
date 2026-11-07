import { useNavigate } from '@tanstack/react-router'
import { useUnit } from 'effector-react'
import { useMemo } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, EmptyState, Icon, PageTransition, PhaseTransition, SegmentedControl } from '@shared/ui'
import type { IconName } from '@shared/ui'

import { useNodeData } from '@infra/node'

import { enumLabel, FeaturedBanner } from '@entities/media'
import type { MediaSummary } from '@entities/media'

import styles from './DiscoverPage.module.scss'
import { DISCOVER_TABS, discoverSections, SECTION_ICONS } from './lib/sections'
import type { DiscoverSection, DiscoverTab } from './lib/sections'
import { discoverModel } from './model/model'
import { DiscoverRow } from './ui/discover-row/DiscoverRow'

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

	const [sections, retry] = useUnit([discoverModel.$sections, discoverModel.sectionRetried])

	const rows = useMemo(() => discoverSections(tab, new Date()), [tab])

	useNodeData(discoverModel.sectionsRequested, { params: rows })

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
			<FeaturedBanner
				key={tab}
				items={setupNeeded ? [] : featured}
				loading={!setupNeeded && first?.status !== 'failed'}
				onOpen={open}
				label={t('discover.featured')}
				openLabel={t('discover.open')}
				bottom={tabs}
			/>

			<PhaseTransition phase={tab}>
				{setupNeeded ? (
					<EmptyState
						title={t('discover.tmdbNeeded')}
						description={first?.setupNeeded || undefined}
						action={
							<Button
								size='small'
								onClick={() =>
									void navigate({ to: '/settings', search: { section: 'metadata' } })
								}
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
								icon={SECTION_ICONS[row.id]}
								state={sections[row.key]}
								onRetry={() => retry(row)}
							/>
						))}
					</div>
				)}
			</PhaseTransition>
		</PageTransition>
	)
}
