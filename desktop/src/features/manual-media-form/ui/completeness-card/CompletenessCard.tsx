import { useTranslation } from '@shared/i18n'
import { Icon, Tooltip } from '@shared/ui'

import type { Completeness } from '../../lib/draft'

import styles from './CompletenessCard.module.scss'

export interface CompletenessCardProps {
	completeness: Completeness
}

const RADIUS = 38
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function CompletenessCard({ completeness }: CompletenessCardProps) {
	const { t } = useTranslation()

	const { required, recommended, additional } = completeness
	const filled = required.filled + recommended.filled + additional.filled
	const total = required.total + recommended.total + additional.total
	const ratio = total > 0 ? filled / total : 0
	const remaining = total - filled

	return (
		<div className={styles.card}>
			<div className={styles.head}>
				<h3 className={styles.title}>
					{t('manualMedia.completeness.title')}

					<Tooltip content={t('manualMedia.completeness.hint')}>
						<span className={styles.infoDot} tabIndex={0}>
							<Icon name='common/info' size={14} />
						</span>
					</Tooltip>
				</h3>
			</div>

			<div className={styles.ring}>
				<svg width='96' height='96' viewBox='0 0 96 96'>
					<circle className={styles.track} cx='48' cy='48' r={RADIUS} />
					<circle
						className={styles.progress}
						cx='48'
						cy='48'
						r={RADIUS}
						strokeDasharray={CIRCUMFERENCE}
						strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
					/>
				</svg>

				<div className={styles.ringLabel}>
					<span className={styles.ringValue}>{filled}</span>
					<span className={styles.ringTotal}>/{total}</span>
				</div>
			</div>

			<p className={styles.caption}>
				{remaining > 0
					? t('manualMedia.completeness.remaining', { count: remaining })
					: t('manualMedia.completeness.done')}
			</p>

			<ul className={styles.breakdown}>
				<Row tone='required' label={t('manualMedia.completeness.required')} tier={required} />
				<Row
					tone='recommended'
					label={t('manualMedia.completeness.recommended')}
					tier={recommended}
				/>
				<Row tone='additional' label={t('manualMedia.completeness.additional')} tier={additional} />
			</ul>
		</div>
	)
}

function Row({
	tone,
	label,
	tier
}: {
	tone: 'required' | 'recommended' | 'additional'
	label: string
	tier: { filled: number; total: number }
}) {
	return (
		<li className={styles.row}>
			<span className={styles.rowLabel}>
				<span className={[styles.dot, styles[tone]].join(' ')} />
				{label}
			</span>
			<span className={styles.rowCount}>
				{tier.filled}/{tier.total}
			</span>
		</li>
	)
}
