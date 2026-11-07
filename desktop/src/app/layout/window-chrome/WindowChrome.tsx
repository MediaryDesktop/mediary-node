import { WindowControls } from '@shared/ui'

import { useWindowControls } from '@infra/window'

import styles from './WindowChrome.module.scss'

export function WindowChrome() {
	const windowControls = useWindowControls()

	return <WindowControls {...windowControls} className={styles.chrome} />
}
