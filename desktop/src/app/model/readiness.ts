import { combine } from 'effector'

import { onEach } from '@shared/factory'

import { $nodeReady } from '@infra/node'

import { aniListAccountModel } from '@entities/anilist-account'

const $bootReady = combine(
	$nodeReady,
	aniListAccountModel.$loaded,
	(nodeReady, sessionLoaded) => nodeReady && sessionLoaded
)

onEach($bootReady, ready => {
	if (ready) {
		void window.mediary.app.booted()
	}
})
