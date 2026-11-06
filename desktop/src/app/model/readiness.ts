import { combine } from 'effector'

import { $nodeReady } from '@infra/node'

import { aniListAccountModel } from '@entities/anilist-account'

const $bootReady = combine(
	$nodeReady,
	aniListAccountModel.$loaded,
	(nodeReady, sessionLoaded) => nodeReady && sessionLoaded
)

$bootReady.watch(ready => {
	if (ready) {
		void window.mediary.app.booted()
	}
})
