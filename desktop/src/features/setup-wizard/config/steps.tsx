import { IoCloudDownloadOutline, IoCloudOutline, IoLibraryOutline } from 'react-icons/io5'

import type { IconLike } from '@shared/ui'

export type SetupStepId = 'anilist' | 'account' | 'library' | 'player' | 'torrents' | 'debrid'

export interface SetupStep {
	id: SetupStepId
	icon: IconLike
	labelKey: `setup.steps.${SetupStepId}.label`
	titleKey: `setup.steps.${SetupStepId}.title`
	descriptionKey: `setup.steps.${SetupStepId}.description`
}

export const SETUP_STEPS: readonly SetupStep[] = [
	{
		id: 'anilist',
		icon: 'social/anilist',
		labelKey: 'setup.steps.anilist.label',
		titleKey: 'setup.steps.anilist.title',
		descriptionKey: 'setup.steps.anilist.description'
	},
	{
		id: 'account',
		icon: <IoCloudOutline size={24} />,
		labelKey: 'setup.steps.account.label',
		titleKey: 'setup.steps.account.title',
		descriptionKey: 'setup.steps.account.description'
	},
	{
		id: 'library',
		icon: <IoLibraryOutline size={24} />,
		labelKey: 'setup.steps.library.label',
		titleKey: 'setup.steps.library.title',
		descriptionKey: 'setup.steps.library.description'
	},
	{
		id: 'player',
		icon: 'common/player',
		labelKey: 'setup.steps.player.label',
		titleKey: 'setup.steps.player.title',
		descriptionKey: 'setup.steps.player.description'
	},
	{
		id: 'torrents',
		icon: 'common/download',
		labelKey: 'setup.steps.torrents.label',
		titleKey: 'setup.steps.torrents.title',
		descriptionKey: 'setup.steps.torrents.description'
	},
	{
		id: 'debrid',
		icon: <IoCloudDownloadOutline size={24} />,
		labelKey: 'setup.steps.debrid.label',
		titleKey: 'setup.steps.debrid.title',
		descriptionKey: 'setup.steps.debrid.description'
	}
]
