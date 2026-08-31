import clsx from 'clsx'
import { useUnit } from 'effector-react'

import { $nodeState } from '@core/node'
import type { NodeState } from '@core/node'

import styles from './node-status-badge.module.scss'

/**
 * Shows what the local node process is doing.
 *
 * The node is a separate process that can be starting, restarting or dead while
 * the window is perfectly fine. Without this, every one of those states looks
 * to the user like the application is broken.
 */

const LABELS: Record<NodeState, string> = {
	stopped: 'Ноду зупинено',
	starting: 'Нода запускається…',
	ready: 'Ноду підключено',
	restarting: 'Нода перезапускається…',
	failed: 'Нода не запустилася'
}

export function NodeStatusBadge() {
	const state = useUnit($nodeState)

	return (
		<span className={clsx(styles.badge, styles[state])}>
			<span className={styles.dot} aria-hidden='true' />
			{LABELS[state]}
		</span>
	)
}
