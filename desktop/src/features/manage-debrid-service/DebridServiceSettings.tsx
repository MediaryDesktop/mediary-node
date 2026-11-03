import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, CollapsibleSection, ListTile } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { debridService, torrentDebridQuery } from '@entities/torrent'

import styles from './DebridServiceSettings.module.scss'
import { DebridServiceForm } from './ui/service-form/DebridServiceForm'

// The debrid service: set up apart from the torrent client, it plays torrents
// without downloading them and marks the releases it holds, whatever the client.
export function DebridServiceSettings() {
	const { t } = useTranslation()

	const [debrid, load, nodeReady] = useUnit([
		torrentDebridQuery.$data,
		torrentDebridQuery.start,
		$nodeReady
	])

	const [open, setOpen] = useState(false)
	const close = useCallback(() => setOpen(false), [])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	if (!debrid) {
		return null
	}

	const service = debridService(debrid.service)
	const connected = Boolean(service && debrid.ready)

	return (
		<div className={styles.root}>
			<ListTile
				icon='common/play'
				title={connected && service ? service.name : t('debrid.notConfigured')}
				subtitle={connected ? t('debrid.readySubtitle') : t('debrid.offSubtitle')}
				actions={
					<Button size='small' onClick={() => setOpen(current => !current)}>
						{open ? t('common.cancel') : connected ? t('debrid.edit') : t('debrid.configure')}
					</Button>
				}
			/>

			<CollapsibleSection open={open}>
				{open && (
					<div className={styles.form}>
						<DebridServiceForm debrid={debrid} onDone={close} />
					</div>
				)}
			</CollapsibleSection>
		</div>
	)
}
