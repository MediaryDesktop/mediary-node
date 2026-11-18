import clsx from 'clsx'
import { useUnit } from 'effector-react'

import { useTranslation } from '@shared/i18n'
import { useStoredToggle } from '@shared/lib'
import { CollapsibleSection, Icon, Notice, RippleButton, SegmentedControl, Switch } from '@shared/ui'

import { $autoSelect, autoSelectChanged, streamViaChanged } from '@features/stream-torrent'
import type { StreamVia } from '@features/stream-torrent'

import styles from './StreamSettings.module.scss'

const SETTINGS_OPEN_KEY = 'mediary.stream.settingsOpen'

export interface StreamSettingsProps {
	via: StreamVia
	debridName: string | null
	onOpenSettings: () => void
}

export function StreamSettings({ via, debridName, onOpenSettings }: StreamSettingsProps) {
	const { t } = useTranslation()
	const [chooseVia, autoSelect, changeAutoSelect] = useUnit([
		streamViaChanged,
		$autoSelect,
		autoSelectChanged
	])
	const [settingsOpen, toggleSettings] = useStoredToggle(SETTINGS_OPEN_KEY)

	return (
		<section className={styles.card}>
			<RippleButton
				className={styles.head}
				aria-expanded={settingsOpen}
				aria-controls='stream-settings-body'
				onClick={toggleSettings}
			>
				<span className={styles.headIcon}>
					<Icon name='common/settings' size={18} />
				</span>

				<span className={styles.headText}>
					<span className={styles.headTitle}>{t('media.stream.settings')}</span>
					<span className={styles.headSubtitle}>{t('media.stream.settingsHint')}</span>
				</span>

				<span className={clsx(styles.chevron, settingsOpen && styles.chevronOpen)} aria-hidden>
					<Icon name='common/chevron-down' size={18} />
				</span>
			</RippleButton>

			<CollapsibleSection open={settingsOpen}>
				<div id='stream-settings-body' className={styles.body}>
					<div className={styles.info}>
						<Icon name='common/info' size={18} className={styles.infoIcon} />
						<p>{t('media.stream.explain')}</p>
					</div>

					{!debridName && (
						<Notice
							title={t('media.stream.debridPitch')}
							actionLabel={t('torrents.setup.openSettings')}
							onAction={onOpenSettings}
						>
							{t('media.stream.debridPitchHint')}
						</Notice>
					)}

					<div className={styles.toolbar}>
						{debridName && (
							<>
								<SegmentedControl
									label={t('media.stream.via')}
									items={[
										{ value: 'embedded', label: t('media.stream.viaBuiltIn') },
										{ value: 'debrid', label: debridName }
									]}
									value={via}
									onValueChange={chooseVia}
								/>
								<span className={styles.divider} aria-hidden />
							</>
						)}
						<Switch
							checked={autoSelect}
							onChange={changeAutoSelect}
							label={t('media.stream.autoSelect')}
						/>
						<p className={styles.hint}>
							{!autoSelect
								? t('media.stream.manualHint')
								: via === 'embedded'
									? t('media.stream.autoSelectBuiltInHint')
									: t('media.stream.autoSelectHint', {
											service: debridName ?? ''
										})}
						</p>
					</div>
				</div>
			</CollapsibleSection>
		</section>
	)
}
