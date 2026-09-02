import { useId } from 'react'

import { useTranslation } from '@shared/i18n'
import { Icon, Input } from '@shared/ui'

import { SetupCard } from './SetupCard'
import styles from './SetupLibraryStep.module.scss'

interface FolderFieldProps {
	label: string
	placeholder: string
	hint: string
	browseLabel: string
}

function FolderField({ label, placeholder, hint, browseLabel }: FolderFieldProps) {
	const id = useId()

	return (
		<div className={styles.field}>
			<div className={styles.labelRow}>
				<label className={styles.label} htmlFor={id}>
					{label}
				</label>

				<button type='button' className={styles.browse} aria-label={browseLabel}>
					<Icon name='common/folder-open' size={18} />
				</button>
			</div>

			<Input
				id={id}
				readOnly
				placeholder={placeholder}
				startIcon={<Icon name='common/folder' size={18} />}
			/>

			<p className={styles.hint}>{hint}</p>
		</div>
	)
}

export function SetupLibraryStep() {
	const { t } = useTranslation()

	return (
		<SetupCard>
			<div className={styles.step}>
				<FolderField
					label={t('setup.library.video.label')}
					placeholder={t('setup.library.placeholder')}
					hint={t('setup.library.video.hint')}
					browseLabel={t('setup.library.browse')}
				/>

				<FolderField
					label={t('setup.library.reading.label')}
					placeholder={t('setup.library.placeholder')}
					hint={t('setup.library.reading.hint')}
					browseLabel={t('setup.library.browse')}
				/>

				<p className={styles.aside}>{t('setup.library.aside')}</p>
			</div>
		</SetupCard>
	)
}
