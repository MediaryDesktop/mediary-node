import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import type { ReactNode } from 'react'

import type { NodeState } from '@shared/bridge'
import { useTranslation } from '@shared/i18n'
import { Icon, Logo, useRipple } from '@shared/ui'
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

const VISIBLE_NODE_STATES = new Set<NodeState>(['starting', 'restarting', 'failed'])

const NODE_LABELS = {
	stopped: 'node.state.stopped',
	starting: 'node.state.starting',
	ready: 'node.state.ready',
	restarting: 'node.state.restarting',
	failed: 'node.state.failed'
} as const satisfies Record<NodeState, string>

type RailTo = (typeof SECTIONS)[number]['to'] | '/settings' | '/sign-in'

export function Sidebar() {
	const { t } = useTranslation()
	const [state, account] = useUnit([$nodeState, sessionModel.$account])

	return (
		<nav className={styles.rail} aria-label={t('nav.label')}>
			<Logo markOnly iconSize={32} className={styles.mark} />

			<ul className={styles.sections}>
				{SECTIONS.map(section => (
					<li key={section.to}>
						<RailLink
							to={section.to}
							icon={section.icon}
							label={t(section.labelKey)}
							exact={section.to === '/'}
						/>
					</li>
				))}
			</ul>

			<div className={styles.utilities}>
				{VISIBLE_NODE_STATES.has(state) && (
					<span className={clsx(styles.item, styles.status, styles[state])}>
						<Icon name='common/cloud' size={22} />
						<Tooltip>{t(NODE_LABELS[state])}</Tooltip>
					</span>
				)}

				<RailLink to='/settings' icon='common/settings' label={t('nav.settings')} />

				{account ? (
					<span className={clsx(styles.item, styles.avatar)}>
						{account.display_name.slice(0, 1).toUpperCase()}
						<Tooltip>{account.display_name}</Tooltip>
					</span>
				) : (
					<RailLink to='/sign-in' icon='common/user' label={t('nav.signIn')} markActive={false} />
				)}
			</div>
		</nav>
	)
}

interface RailLinkProps {
	to: RailTo
	icon: IconName
	label: string
	exact?: boolean
	markActive?: boolean
}

function RailLink({ to, icon, label, exact = false, markActive = true }: RailLinkProps) {
	const ripple = useRipple<HTMLAnchorElement>()

	return (
		<Link
			ref={ripple}
			to={to}
			activeOptions={{ exact }}
			activeProps={markActive ? { className: styles.active } : undefined}
			className={styles.item}
			aria-label={label}
		>
			<Icon name={icon} size={22} />
			<Tooltip>{label}</Tooltip>
		</Link>
	)
}

function Tooltip({ children }: { children: ReactNode }) {
	return (
		<span className={styles.tooltip} role='tooltip'>
			{children}
		</span>
	)
}
