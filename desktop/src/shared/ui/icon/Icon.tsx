import clsx from 'clsx'
import type { SVGProps } from 'react'

import { sprites } from './sprite.gen'
import type { SpritesMeta } from './sprite.gen'

export type IconName = {
	[Group in keyof SpritesMeta]: `${Group & string}/${SpritesMeta[Group]}`
}[keyof SpritesMeta]

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'name'> {
	name: IconName
	size?: number
}

export function Icon({ name, size = 20, className, ...props }: IconProps) {
	const [group = '', symbol = ''] = name.split('/')
	const found = sprites.experimental_get(group, symbol)

	return (
		<svg
			className={clsx(className)}
			width={size}
			height={size}
			viewBox={found?.symbol.viewBox ?? '0 0 24 24'}
			aria-hidden
			focusable={false}
			{...props}
		>
			<use href={`./sprite/${group}.svg#${symbol}`} />
		</svg>
	)
}
