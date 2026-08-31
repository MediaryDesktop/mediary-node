import { useUnit } from 'effector-react'

import { $nodeReady, nodeHealthQuery } from '@core/node'

import styles from './home-screen.module.scss'

/** Placeholder route proving the vertical works end to end — shell → node →
 * HTTP → generated types → Effector → React. Phase 1 replaces it. */
export function HomeScreen() {
	// Farfetched exposes a query as plain Effector stores, so useUnit reads
	// them directly — no @farfetched/react binding needed.
	const [ready, data, pending, error] = useUnit([
		$nodeReady,
		nodeHealthQuery.$data,
		nodeHealthQuery.$pending,
		nodeHealthQuery.$error
	])

	return (
		<div className={styles.root}>
			<h1 className={styles.title}>Mediary</h1>
			<p className={styles.subtitle}>
				Скелет фази 0. Каталогу ще немає — тут лише перевірка, що оболонка бачить ноду.
			</p>

			<section className={styles.panel}>
				<h2 className={styles.panelTitle}>Локальна нода</h2>

				{!ready && <p className={styles.muted}>Очікування на запуск ноди…</p>}

				{ready && pending && <p className={styles.muted}>Запит стану…</p>}

				{error && <p className={styles.error}>Не вдалося опитати ноду: {String(error)}</p>}

				{data && (
					<dl className={styles.facts}>
						<dt>Версія</dt>
						<dd>{data.version}</dd>

						<dt>Збірка</dt>
						<dd>{data.commit}</dd>

						<dt>Хмарний акаунт</dt>
						<dd>{data.linked ? 'привʼязано' : 'не привʼязано'}</dd>
					</dl>
				)}
			</section>
		</div>
	)
}
