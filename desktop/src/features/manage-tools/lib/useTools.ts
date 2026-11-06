import { useUnit } from 'effector-react'
import { useEffect } from 'react'

import { problemDetail } from '@shared/api'
import type { RequestFailure } from '@shared/api'
import { useTranslation } from '@shared/i18n'
import { useUnitWatch } from '@shared/lib'
import { toast } from '@shared/ui'

import { $nodeReady } from '@infra/node'

import {
	cancelToolInstallMutation,
	installToolMutation,
	removeToolMutation,
	toolsQuery
} from '@entities/tool'
import type { Tool } from '@entities/tool'

export function useTools(): Tool[] | null {
	const { t } = useTranslation()

	const [data, load, nodeReady] = useUnit([toolsQuery.$data, toolsQuery.start, $nodeReady])

	useEffect(() => {
		if (nodeReady) {
			load()
		}
	}, [load, nodeReady])

	const failed = ({ error }: RequestFailure) =>
		toast.error(problemDetail(error, t('tools.actionFailed')), { id: 'tools' })

	useUnitWatch(installToolMutation.finished.failure, failed)
	useUnitWatch(cancelToolInstallMutation.finished.failure, failed)
	useUnitWatch(removeToolMutation.finished.failure, failed)

	return data ? (data.tools ?? []) : null
}
