import i18next from 'i18next'
import { initReactI18next } from 'react-i18next'

import { DEFAULT_LANGUAGE, isLanguage, readStoredLanguage, storeLanguage } from './config'
import { en } from './locales/en'
import { ru } from './locales/ru'
import { uk } from './locales/uk'

/**
 * The single i18next instance, initialised on import.
 *
 * There is no Effector store mirroring the current language on purpose. i18next
 * already holds it and already notifies React through `useTranslation`; a store
 * beside it would be a second copy of the same fact, and the one that goes
 * stale is never the one you are looking at.
 */

void i18next.use(initReactI18next).init({
	resources: {
		en: { translation: en },
		uk: { translation: uk },
		ru: { translation: ru }
	},
	lng: readStoredLanguage() ?? DEFAULT_LANGUAGE,
	fallbackLng: DEFAULT_LANGUAGE,
	// Every phrase lives in one namespace: the app is one bundle with no lazy
	// loading, so splitting them would buy nothing and cost a prefix per key.
	defaultNS: 'translation',
	// A colon is punctuation in our phrases ("Version: 1.2"), not a namespace
	// separator, and a server sentence passed through `t` must not be parsed.
	nsSeparator: false,
	interpolation: {
		// React escapes before this ever reaches the DOM.
		escapeValue: false
	}
})

function remember(language: string): void {
	if (!isLanguage(language)) {
		return
	}

	storeLanguage(language)
	// Screen readers and CSS `:lang()` read this; without it the whole document
	// keeps claiming whatever index.html was authored in.
	document.documentElement.lang = language
}

i18next.on('languageChanged', remember)

// `init` above may resolve after this module finishes evaluating, so the first
// language is applied here rather than relying on the event having fired.
remember(i18next.language)

export { i18next }
