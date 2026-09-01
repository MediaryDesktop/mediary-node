/**
 * Choosing the interface language.
 *
 * A feature rather than a piece of `shared/ui`: it changes application state,
 * and the phrases it switches between are the product's, not the toolkit's.
 * The mechanics — the instance, the locales, the stored choice — stay in
 * `shared/i18n`, which this only drives.
 */

export { LanguageSwitcher } from './ui/LanguageSwitcher'
export type { LanguageSwitcherProps } from './ui/LanguageSwitcher'
