import { useNavigate } from '@tanstack/react-router'
import clsx from 'clsx'

import { useTranslation } from '@shared/i18n'
import { PageTransition, PhaseTransition, renderIcon, RippleButton } from '@shared/ui'

import { SECTION_GROUPS } from './config/sections'
import type { SettingsSection } from './config/sections'
import styles from './SettingsPage.module.scss'
import { SectionContent } from './ui/section-content/SectionContent'

export interface SettingsPageProps {
	section: SettingsSection
}

export function SettingsPage({ section }: SettingsPageProps) {
	const { t } = useTranslation()
	const navigate = useNavigate()

	const current = SECTION_GROUPS.flat().find(item => item.id === section) ?? SECTION_GROUPS[0]![0]!

	return (
		<PageTransition className={styles.root}>
			<nav className={styles.nav} aria-label={t('nav.settings')}>
				{SECTION_GROUPS.map(group => (
					<ul key={group[0]!.id} className={styles.group}>
						{group.map(item => (
							<li key={item.id}>
								<RippleButton
									className={clsx(styles.item, item.id === current.id && styles.active)}
									aria-current={item.id === current.id ? 'page' : undefined}
									onClick={() =>
										navigate({
											to: '/settings',
											search: { section: item.id },
											replace: true
										})
									}
								>
									{renderIcon(item.icon, 18)}
									{t(`settings.sections.${item.id}.title`)}
								</RippleButton>
							</li>
						))}
					</ul>
				))}
			</nav>

			<section className={styles.panel}>
				<PhaseTransition phase={current.id} className={styles.sectionContent}>
					<header className={styles.header}>
						<span className={styles.headerIcon}>{renderIcon(current.icon, 24)}</span>
						<div>
							<h2 className={styles.headerTitle}>
								{t(`settings.sections.${current.id}.title`)}
							</h2>
							<p className={styles.headerSubtitle}>
								{t(`settings.sections.${current.id}.subtitle`)}
							</p>
						</div>
					</header>

					<SectionContent section={current.id} />
				</PhaseTransition>
			</section>
		</PageTransition>
	)
}
