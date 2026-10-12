import { Button, Icon } from '@shared/ui'
import type { IconName } from '@shared/ui'

export interface ControlButtonProps {
	icon: IconName
	label: string
	onClick: () => void
	closing?: boolean
}

export function ControlButton({ icon, label, onClick, closing }: ControlButtonProps) {
	return (
		<Button
			variant={closing ? 'chrome-close' : 'chrome'}
			iconOnly
			aria-label={label}
			title={label}
			startIcon={<Icon name={icon} size={22} />}
			onClick={onClick}
		/>
	)
}
