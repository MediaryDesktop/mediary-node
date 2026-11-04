import * as Primitive from '@radix-ui/react-dropdown-menu'
import clsx from 'clsx'
import type { ReactNode } from 'react'
import { useState } from 'react'
import { IoIosRefresh } from 'react-icons/io'

import { useTranslation } from '@shared/i18n'
import { Button, CollapsibleSection, Icon, useRipple } from '@shared/ui'

import { LIBRARY_CONTENT_ICONS, LIBRARY_CONTENTS } from '@entities/library-item'
import type { LibraryRoot } from '@entities/library-item'

import styles from './RootMenu.module.scss'

export interface RootMenuProps {
	root: LibraryRoot
	onRescan: () => void
	onSwitch: (content: LibraryRoot['content']) => void
	onRemove: () => void
	switching: boolean
	removing: boolean
}

// This row's "⋮" menu, built on the Radix primitives directly instead of the
// generic DropdownMenu: the six folder-type choices fold under a summary of
// the current one, so picking a different type doesn't mean scanning past the
// rescan and remove actions to find them.
export function RootMenu({ root, onRescan, onSwitch, onRemove, switching, removing }: RootMenuProps) {
	const { t } = useTranslation()
	const [open, setOpen] = useState(false)
	const [typeOpen, setTypeOpen] = useState(false)

	return (
		<Primitive.Root
			modal={false}
			open={open}
			onOpenChange={next => {
				setOpen(next)
				// Shut again next time, rather than remembering it was left open.
				if (!next) {
					setTypeOpen(false)
				}
			}}
		>
			<Primitive.Trigger asChild>
				<Button
					size='small'
					variant='ghost'
					iconOnly
					className={styles.trigger}
					aria-label={t('library.root.menu')}
					startIcon={<Icon name='common/more-vertical' size={16} />}
				/>
			</Primitive.Trigger>

			<Primitive.Portal>
				<Primitive.Content
					align='end'
					sideOffset={6}
					collisionPadding={12}
					className={styles.content}
				>
					<MenuItem
						icon={<IoIosRefresh size={20} />}
						label={t('library.root.rescan')}
						onSelect={onRescan}
					/>

					<div className={styles.separator} aria-hidden='true' />

					<button
						type='button'
						className={clsx(styles.typeTrigger, typeOpen && styles.typeTriggerOpen)}
						onClick={() => setTypeOpen(current => !current)}
					>
						<Icon name={LIBRARY_CONTENT_ICONS[root.content]} size={20} className={styles.icon} />
						<span className={styles.text}>{t(`library.root.switchTo.${root.content}`)}</span>
						<Icon
							name='common/chevron-down'
							size={16}
							className={clsx(styles.chevron, typeOpen && styles.chevronOpen)}
						/>
					</button>

					<CollapsibleSection open={typeOpen}>
						<div className={styles.typeList}>
							{LIBRARY_CONTENTS.map(content => (
								<MenuItem
									key={content}
									icon={<Icon name={LIBRARY_CONTENT_ICONS[content]} size={20} />}
									label={t(`library.root.switchTo.${content}`)}
									checked={content === root.content}
									disabled={switching}
									onSelect={() => {
										if (content !== root.content) {
											onSwitch(content)
										}
									}}
								/>
							))}
						</div>
					</CollapsibleSection>

					<div className={styles.separator} aria-hidden='true' />

					<MenuItem
						danger
						icon={<Icon name='common/trash' size={20} />}
						label={t('library.root.remove')}
						disabled={removing}
						onSelect={onRemove}
					/>
				</Primitive.Content>
			</Primitive.Portal>
		</Primitive.Root>
	)
}

interface MenuItemProps {
	icon: ReactNode
	label: string
	checked?: boolean
	danger?: boolean
	disabled?: boolean
	onSelect: () => void
}

function MenuItem({ icon, label, checked, danger, disabled, onSelect }: MenuItemProps) {
	const ripple = useRipple<HTMLDivElement>({ disabled })

	return (
		<Primitive.Item
			ref={ripple}
			disabled={disabled}
			onSelect={onSelect}
			className={clsx(styles.item, danger && styles.danger)}
		>
			<span className={styles.icon}>{icon}</span>
			<span className={styles.text}>{label}</span>
			{checked && <Icon name='common/check' size={18} className={styles.check} />}
		</Primitive.Item>
	)
}
