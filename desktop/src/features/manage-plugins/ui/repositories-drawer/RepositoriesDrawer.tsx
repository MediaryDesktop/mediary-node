import { useUnit } from 'effector-react'
import { useState } from 'react'
import { LuTrash2 } from 'react-icons/lu'

import { problemDetail } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { Button, Drawer, DrawerSection, Input, RippleButton, toast, Tooltip } from '@shared/ui'

import {
	addExtensionRepositoryMutation,
	extensionCatalogQuery,
	removeExtensionRepositoryMutation
} from '@entities/extension'

import styles from './RepositoriesDrawer.module.scss'

export interface RepositoriesDrawerProps {
	open: boolean
	onClose: () => void
}

// The lists of plugins the user reads the catalog from. Mediary starts with
// none and vouches for none.
export function RepositoriesDrawer({ open, onClose }: RepositoriesDrawerProps) {
	const { t } = useTranslation()

	const [catalog, add, remove, adding] = useUnit([
		extensionCatalogQuery.$data,
		addExtensionRepositoryMutation.start,
		removeExtensionRepositoryMutation.start,
		addExtensionRepositoryMutation.$pending
	])

	const [url, setURL] = useState('')

	useUnitWatch(addExtensionRepositoryMutation.finished.success, ({ result }) => {
		setURL('')
		toast.success(t('plugins.repositories.added', { name: result.name || result.url }), { id: 'plugins' })
	})
	useUnitWatch(addExtensionRepositoryMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('plugins.actionFailed')), { id: 'plugins' })
	)
	useUnitWatch(removeExtensionRepositoryMutation.finished.failure, ({ error }) =>
		toast.error(problemDetail(error, t('plugins.actionFailed')), { id: 'plugins' })
	)

	const repositories = catalog?.repositories ?? []

	return (
		<Drawer
			open={open}
			onOpenChange={next => !next && onClose()}
			title={t('plugins.repositories.title')}
			description={t('plugins.repositories.description')}
		>
			<DrawerSection title={t('plugins.repositories.urlLabel')}>
				<form
					className={styles.add}
					onSubmit={event => {
						event.preventDefault()
						if (url.trim()) {
							add(url.trim())
						}
					}}
				>
					<Input
						value={url}
						onChange={event => setURL(event.target.value)}
						placeholder='https://example.org/plugins.json'
						spellCheck={false}
						disabled={adding}
					/>
					<Button type='submit' variant='primary' loading={adding} disabled={!url.trim()}>
						{t('plugins.repositories.add')}
					</Button>
				</form>
			</DrawerSection>

			<DrawerSection>
				{repositories.length === 0 ? (
					<p className={styles.none}>{t('plugins.repositories.none')}</p>
				) : (
					<ul className={styles.list}>
						{repositories.map(repo => (
							<li key={repo.id} className={styles.item}>
								<div className={styles.text}>
									<p className={styles.name}>{repo.name || repo.url}</p>
									<p className={styles.url} title={repo.url}>
										{repo.url}
									</p>
									<p className={styles.facts}>
										{t('plugins.repositories.count', { count: repo.plugins })}
										{repo.skipped > 0 &&
											` · ${t('plugins.repositories.skipped', { count: repo.skipped })}`}
									</p>
									{repo.error && <p className={styles.error}>{repo.error}</p>}
								</div>
								<Tooltip content={t('plugins.repositories.remove')} side='left'>
									<RippleButton
										className={styles.remove}
										aria-label={t('plugins.repositories.remove')}
										onClick={() => remove(repo.id)}
									>
										<LuTrash2 size={16} />
									</RippleButton>
								</Tooltip>
							</li>
						))}
					</ul>
				)}
			</DrawerSection>
		</Drawer>
	)
}
