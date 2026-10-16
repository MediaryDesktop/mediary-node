import { useUnit } from 'effector-react'
import { useCallback, useEffect, useState } from 'react'

import { useTranslation } from '@shared/i18n'
import { Button, ListTile } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import { debridService, torrentDebridQuery } from '@entities/torrent'

import styles from './DebridServiceSettings.module.scss'
import { DebridServiceDrawer } from './ui/service-drawer/DebridServiceDrawer'

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
					<Button size='small' onClick={() => setOpen(true)}>
						{connected ? t('debrid.edit') : t('debrid.configure')}
					</Button>
				}
			/>

			<DebridServiceDrawer open={open} debrid={debrid} onClose={close} />
		</div>
	)
}
