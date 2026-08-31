import base from '@mediaryorg/core/prettier'

/**
 * House style plus the layer import order.
 *
 * The order is the dependency rule from docs/architecture.md read top to bottom:
 * a file's imports appear in the order of the layers they come from, so an
 * import that violates the direction is visible in the diff before ESLint says
 * anything.
 *
 * @type {import('prettier').Config}
 */
export default {
	...base,
	printWidth: 110,
	endOfLine: 'auto',
	// The shared config targets NestJS services, so its babel plugin list has no
	// `jsx` — without it the sort-imports plugin fails to parse every .tsx file.
	importOrderParserPlugins: ['classProperties', 'decorators-legacy', 'typescript', 'jsx'],
	importOrder: [
		'<THIRD_PARTY_MODULES>',
		'^@lib/(.*)$',
		'^@ui/(.*)$',
		'^@core/(.*)$',
		'^@modules/(.*)$',
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
