import { Skeleton } from '@shared/ui'

import styles from './MediaHero.module.scss'

export function MediaHeroSkeleton() {
	return (
		<div aria-busy className={styles.hero}>
			<div className={styles.backdrop}>
				<span className={styles.fadeBottom} />
			</div>

			<div className={styles.details}>
				<div className={styles.entry}>
					<Skeleton className={styles.cover} height='auto' radius='var(--radius-lg)' />

					<div className={styles.info}>
						<Skeleton width='55%' height='2.75rem' />
						<Skeleton width='30%' height='1.25rem' />
						<Skeleton width='42%' height='1.5rem' />
						<Skeleton width='60%' height='1rem' />
						<Skeleton width='100%' height='4rem' radius='var(--radius)' />
					</div>
				</div>
			</div>
		</div>
	)
}
