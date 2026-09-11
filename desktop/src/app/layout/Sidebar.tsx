import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import type { ReactNode } from 'react'

import type { NodeState } from '@shared/bridge'
import { useTranslation } from '@shared/i18n'
import { Icon, Logo } from '@shared/ui'
import type { IconName } from '@shared/ui'

import { $nodeState } from '@infra/node'

import { sessionModel } from '@entities/session'

import styles from './Sidebar.module.scss'

const SECTIONS = [
	{ to: '/', icon: 'common/home', labelKey: 'nav.home' },
	{ to: '/discover', icon: 'common/compass', labelKey: 'nav.discover' },
	{ to: '/catalog', icon: 'common/search', labelKey: 'nav.catalog' },
	{ to: '/lists', icon: 'common/list-checks', labelKey: 'nav.lists' },
	{ to: '/library', icon: 'common/book-open', labelKey: 'nav.library' },
	{ to: '/downloads', icon: 'common/download', labelKey: 'nav.downloads' }
] as const satisfies readonly { to: string; icon: IconName; labelKey: string }[]

const NODE_LABELS = {
	stopped: 'node.state.stopped',
	starting: 'node.state.starting',
	ready: 'node.state.ready',
	restarting: 'node.state.restarting',
	failed: 'node.state.failed'
} as const satisfies Record<NodeState, string>

export function Sidebar() {
	const { t } = useTranslation()
	const [state, account] = useUnit([$nodeState, sessionModel.$account])

	return (
		<nav className={styles.rail} aria-label={t('nav.label')}>
			<Logo markOnly iconSize={32} className={styles.mark} />

			<ul className={styles.sections}>
				{SECTIONS.map(section => (
					<li key={section.to}>
						<Link
							to={section.to}
							activeOptions={{ exact: section.to === '/' }}
							activeProps={{ className: styles.active }}
							className={styles.item}
							aria-label={t(section.labelKey)}
						>
							<Icon name={section.icon} size={22} />
							<Tooltip>{t(section.labelKey)}</Tooltip>
						</Link>
					</li>
				))}
			</ul>

			<div className={styles.utilities}>
				<span className={clsx(styles.item, styles.status, styles[state])}>
					<Icon name='common/cloud' size={22} />
					<Tooltip>{t(NODE_LABELS[state])}</Tooltip>
				</span>

				<Link
					to='/settings'
					activeProps={{ className: styles.active }}
					className={styles.item}
					aria-label={t('nav.settings')}
				>
					<Icon name='common/settings' size={22} />
					<Tooltip>{t('nav.settings')}</Tooltip>
				</Link>

				{account ? (
					<span className={clsx(styles.item, styles.avatar)}>
						{account.display_name.slice(0, 1).toUpperCase()}
						<Tooltip>{account.display_name}</Tooltip>
					</span>
				) : (
					<Link to='/sign-in' className={styles.item} aria-label={t('nav.signIn')}>
						<Icon name='common/user' size={22} />
						<Tooltip>{t('nav.signIn')}</Tooltip>
					</Link>
				)}
			</div>
		</nav>
	)
}

function Tooltip({ children }: { children: ReactNode }) {
	return (
		<span className={styles.tooltip} role='tooltip'>
			{children}
		</span>
	)
}
