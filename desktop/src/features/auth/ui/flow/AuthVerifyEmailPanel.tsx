import { VerifyEmailForm } from '../form'

import panel from './AuthPanel.module.scss'

export function AuthVerifyEmailPanel() {
	return (
		<div className={panel.panel}>
			<VerifyEmailForm />
		</div>
	)
}
