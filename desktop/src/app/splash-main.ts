import type { NodeState } from '@shared/bridge/types'
import { DEFAULT_LANGUAGE, readStoredLanguage } from '@shared/i18n/config'
import { en } from '@shared/i18n/locales/en'
import { ru } from '@shared/i18n/locales/ru'
import { uk } from '@shared/i18n/locales/uk'

const locales = { en, ru, uk }
const { splash: copy } = locales[readStoredLanguage() ?? DEFAULT_LANGUAGE]

const dots = document.getElementById('dots') as HTMLElement
const failure = document.getElementById('failure') as HTMLElement
const failureText = document.getElementById('failure-text') as HTMLElement
const continueButton = document.getElementById('continue-button') as HTMLButtonElement

failureText.textContent = copy.failed
continueButton.textContent = copy.continue

continueButton.addEventListener('click', () => {
	void window.mediary.splash.dismiss()
})

function render(state: NodeState): void {
	const failed = state === 'failed'

	failure.classList.toggle('visible', failed)
	dots.style.display = failed ? 'none' : 'flex'
}

void window.mediary.node.state().then(render)
window.mediary.node.onStateChange(render)
