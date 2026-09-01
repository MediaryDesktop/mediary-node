import clsx from 'clsx'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'

import { $nodeState } from '@infra/node'
import type { NodeState } from '@infra/node'

import styles from './NodeStatusBadge.module.scss'

const LABEL_KEYS = {
	stopped: 'node.state.stopped',
	starting: 'node.state.starting',
	ready: 'node.state.ready',
	restarting: 'node.state.restarting',
	failed: 'node.state.failed'
} as const satisfies Record<NodeState, string>

export function NodeStatusBadge() {
	const { t } = useTranslation()
	const state = useUnit($nodeState)

	return (
		<span className={clsx(styles.badge, styles[state])}>
			<span className={styles.dot} aria-hidden='true' />
			{t(LABEL_KEYS[state])}
		</span>
	)
}
