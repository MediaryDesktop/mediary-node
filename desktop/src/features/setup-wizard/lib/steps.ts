/**
 * The order of the wizard, as data.
 *
 * The rail, the footer and the page all need the same sequence, and keeping it
 * in one array means a reordered or renamed step cannot drift between them.
 *
 * The phrase keys are spelled out per step rather than built as
 * `` `setup.steps.${id}.title` ``: i18next derives its key union from `en.ts`,
 * and a literal is what turns a typo here into a compile error instead of a
 * missing phrase at runtime.
 */
import type { IconName } from '@shared/ui'

export type SetupStepId = 'library' | 'player' | 'downloads' | 'account' | 'debrid'

export interface SetupStep {
	id: SetupStepId
	icon: IconName
	labelKey: `setup.steps.${SetupStepId}.label`
	titleKey: `setup.steps.${SetupStepId}.title`
	descriptionKey: `setup.steps.${SetupStepId}.description`
}

export const SETUP_STEPS: readonly SetupStep[] = [
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
