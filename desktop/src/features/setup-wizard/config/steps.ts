import type { IconName } from '@shared/ui'

export type SetupStepId = 'anilist' | 'account' | 'library' | 'player' | 'downloads' | 'debrid'

export interface SetupStep {
	id: SetupStepId
	icon: IconName
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
		icon: 'common/cloud',
		labelKey: 'setup.steps.account.label',
		titleKey: 'setup.steps.account.title',
		descriptionKey: 'setup.steps.account.description'
	},
	{
		id: 'library',
		icon: 'common/library',
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
		id: 'downloads',
		icon: 'common/download',
		labelKey: 'setup.steps.downloads.label',
		titleKey: 'setup.steps.downloads.title',
		descriptionKey: 'setup.steps.downloads.description'
	},
	{
		id: 'debrid',
		icon: 'common/database',
		labelKey: 'setup.steps.debrid.label',
		titleKey: 'setup.steps.debrid.title',
		descriptionKey: 'setup.steps.debrid.description'
	}
]
