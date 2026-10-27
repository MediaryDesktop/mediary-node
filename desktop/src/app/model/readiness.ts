import { combine } from 'effector'

import { $nodeReady } from '@infra/node'

import { aniListAccountModel } from '@entities/anilist-account'

const $bootReady = combine(
	$nodeReady,
	aniListAccountModel.$loaded,
	(nodeReady, sessionLoaded) => nodeReady && sessionLoaded
)

// Tells the splash window (a separate, main-process-owned BrowserWindow — see
// electron/main/splash.ts) that it can hand off to this one. The main side
// treats repeat calls as a no-op, so there's no need to latch this to the
// first true only — a node restart later in the session re-reports it, harmlessly.
$bootReady.watch(ready => {
	if (ready) {
		void window.mediary.app.booted()
	}
})
