import base from '@mediaryorg/core/prettier'

export default {
	...base,
	printWidth: 110,
	endOfLine: 'auto',

	importOrderParserPlugins: ['classProperties', 'decorators-legacy', 'typescript', 'jsx'],
	importOrder: [
		'<THIRD_PARTY_MODULES>',
		'^@shared/(.*)$',
		'^@infra/(.*)$',
		'^@entities/(.*)$',
		'^@features/(.*)$',
		'^@pages/(.*)$',
		'^@app/(.*)$',
		'^../(.*)$',
		'^./(.*)$'
	],
	importOrderSeparation: true,
	importOrderSortSpecifiers: true,
	overrides: [
		{
			files: '*.scss',
			options: { singleQuote: false }
		}
	]
}
