import type { MouseEvent, PointerEvent } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, Icon, Tooltip } from '@shared/ui'

import { BOOK_THEMES, clampFontSize, FONT_SIZES } from '../../lib/appearance'
import type { BookAppearance } from '../../types'

import styles from './AppearanceTools.module.scss'

export interface AppearanceToolsProps {
	appearance: BookAppearance
	onChange: (appearance: BookAppearance) => void
	hasContents: boolean
	onToggleContents: () => void
}

// Radix closes the tooltip on its own pointerdown/click; marking both prevented
// keeps it open so the percent stays visible after clicking.
const keepTooltip = (event: PointerEvent | MouseEvent) => event.preventDefault()

// Contents, text size and the page theme.
export function AppearanceTools({
	appearance,
	onChange,
	hasContents,
	onToggleContents
}: AppearanceToolsProps) {
	const { t } = useTranslation()

	const nextTheme = BOOK_THEMES[(BOOK_THEMES.indexOf(appearance.theme) + 1) % BOOK_THEMES.length] ?? 'dark'
	const size = t('reader.book.percent', { percent: appearance.fontSize })

	const resize = (event: MouseEvent, step: number) => {
		keepTooltip(event)
		onChange({ ...appearance, fontSize: clampFontSize(appearance.fontSize + step) })
	}

	return (
		<div className={styles.tools}>
			<Button
				variant='ghost'
				size='small'
				aria-label={t('reader.book.contents')}
				title={t('reader.book.contents')}
				disabled={!hasContents}
				startIcon={<Icon name='common/list' size={18} />}
				onClick={onToggleContents}
			/>
			<Tooltip content={size} keepOpenOnClick>
				<Button
					variant='ghost'
					size='small'
					aria-label={t('reader.book.smaller')}
					disabled={appearance.fontSize <= FONT_SIZES.min}
					onPointerDown={keepTooltip}
					onClick={event => resize(event, -FONT_SIZES.step)}
				>
					A−
				</Button>
			</Tooltip>
			<Tooltip content={size} keepOpenOnClick>
				<Button
					variant='ghost'
					size='small'
					aria-label={t('reader.book.larger')}
					disabled={appearance.fontSize >= FONT_SIZES.max}
					onPointerDown={keepTooltip}
					onClick={event => resize(event, FONT_SIZES.step)}
				>
					A+
				</Button>
			</Tooltip>
			<Button
				variant='ghost'
				size='small'
				aria-label={t(`reader.book.theme.${nextTheme}`)}
				title={t(`reader.book.theme.${nextTheme}`)}
				startIcon={<Icon name={nextTheme === 'dark' ? 'common/moon' : 'common/sun'} size={18} />}
				onClick={() => onChange({ ...appearance, theme: nextTheme })}
			/>
		</div>
	)
}
