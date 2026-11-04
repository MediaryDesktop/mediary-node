import { Link } from '@tanstack/react-router'
import clsx from 'clsx'
import { useUnit } from 'effector-react'
import { cloneElement } from 'react'
import type { ReactElement, ReactNode } from 'react'
import { IoCloudOutline, IoExtensionPuzzleOutline } from 'react-icons/io5'

import type { NodeState } from '@shared/bridge'
import { useTranslation } from '@shared/i18n'
import { Icon, Logo, useRipple } from '@shared/ui'
import type { IconName } from '@shared/ui'

import { $nodeState } from '@infra/node'

import { sessionModel } from '@entities/session'

import styles from './Sidebar.module.scss'

// A sidebar icon is either one of our own sprite names, or a ready-made
// element (e.g. from react-icons) dropped in as-is.
type SectionIcon = IconName | ReactElement

const SECTIONS = [
	{ to: '/', icon: 'common/home', labelKey: 'nav.home', size: 22 },
	{ to: '/discover', icon: 'common/compass', labelKey: 'nav.discover', size: 24 },
	{ to: '/search', icon: 'common/search', labelKey: 'nav.search', size: 26 },
	{ to: '/lists', icon: 'common/list', labelKey: 'nav.lists', size: 22 },
	{ to: '/library', icon: 'common/file-tree', labelKey: 'nav.library', size: 22 },
	{ to: '/media/new', icon: 'common/wand-sparkles', labelKey: 'nav.addManually', size: 22 },
	{ to: '/downloads', icon: 'common/download', labelKey: 'nav.downloads', size: 22 },
	{ to: '/extensions', icon: <IoExtensionPuzzleOutline />, labelKey: 'nav.extensions', size: 22 }
] as const satisfies readonly { to: string; icon: SectionIcon; labelKey: string; size?: number }[]

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
	const { state, account } = useUnit({ state: $nodeState, account: sessionModel.$account })

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
							size={section.size}
						/>
					</li>
				))}
			</ul>

			<div className={styles.utilities}>
				{VISIBLE_NODE_STATES.has(state) && (
					<span className={clsx(styles.item, styles.status, styles[state])}>
						<IoCloudOutline size={22} />
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
	icon: SectionIcon
	label: string
	exact?: boolean
	markActive?: boolean
	size?: number
}

function RailLink({ to, icon, label, exact = false, markActive = true, size = 22 }: RailLinkProps) {
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
			{typeof icon === 'string' ? (
				<Icon name={icon} size={size} />
			) : (
				cloneElement(icon, { size } as { size: number })
			)}
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
