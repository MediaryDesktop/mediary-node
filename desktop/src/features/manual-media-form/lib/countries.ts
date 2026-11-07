export const COMMON_COUNTRIES = [
	'JP',
	'KR',
	'CN',
	'TW',
	'US',
	'GB',
	'FR',
	'DE',
	'IT',
	'ES',
	'CA',
	'AU',
	'IN',
	'TH',
	'RU',
	'BR',
	'MX',
	'NL',
	'PL',
	'SE'
]

export function flagEmoji(code: string): string {
	return [...code.toUpperCase()].map(char => String.fromCodePoint(127_397 + char.charCodeAt(0))).join('')
}
