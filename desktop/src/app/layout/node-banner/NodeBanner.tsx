import { useUnit } from 'effector-react'
import { useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { useAfterDelay } from '@shared/lib'
import { Button, Notice, noticeActionVariant } from '@shared/ui'

import { $nodeRetrying, $nodeState, nodeRetryRequested } from '@infra/node'

import { nodeBanner, RECOVERING_AFTER_MS } from './lib/banner'
import styles from './NodeBanner.module.scss'

export function NodeBanner() {
	const { t } = useTranslation()
	const [state, retrying, retry] = useUnit([$nodeState, $nodeRetrying, nodeRetryRequested])

	const coming = state === 'starting' || state === 'restarting'
	const [lasted, setLasted] = useState(false)

	useAfterDelay(coming, RECOVERING_AFTER_MS, () => setLasted(true))

	if (!coming && lasted) {
		setLasted(false)
	}

	const kind = nodeBanner(state, { lasted, retrying })

	if (kind === 'recovering') {
		return (
			<Notice className={styles.banner} tone='warning' title={t('node.banner.recovering.title')}>
				{t('node.banner.recovering.text')}
			</Notice>
		)
	}

	if (kind === 'failed') {
		return (
			<Notice
				className={styles.banner}
				tone='danger'
				title={t('node.banner.failed.title')}
				action={
					<Button
						size='small'
						variant={noticeActionVariant('danger')}
						loading={retrying}
						onClick={() => retry()}
					>
						{t('node.banner.retry')}
					</Button>
				}
			>
				{t('node.banner.failed.text')}
			</Notice>
		)
	}

	return null
}
