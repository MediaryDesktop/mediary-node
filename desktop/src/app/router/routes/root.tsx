import { createRootRoute, Outlet } from '@tanstack/react-router'

import { PlayerHost } from '../../layout/player-host/PlayerHost'

function RootLayout() {
	return (
		<>
			<Outlet />
			<PlayerHost />
		</>
	)
}

export const rootRoute = createRootRoute({ component: RootLayout })
