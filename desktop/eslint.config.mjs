import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

const LAYERS = [
	{ alias: 'shared', dir: 'shared' },
	{ alias: 'infra', dir: 'infrastructure' },
	{ alias: 'entities', dir: 'entities' },
	{ alias: 'features', dir: 'features' },
	{ alias: 'pages', dir: 'pages' },
	{ alias: 'app', dir: 'app' }
]

const patternsFor = alias => [`@${alias}`, `@${alias}/*`, `@${alias}/*/**`]

const SLICED_LAYERS = ['infra', 'entities', 'features', 'pages']

const deepImportRule = {
	group: SLICED_LAYERS.flatMap(alias => [`@${alias}/*/*`, `@${alias}/*/*/**`]),
	message: 'Import a slice through its public index (`@entities/session`), not a path inside it.'
}

// Routes belong to the app's route tree, and a typed link is a dependency on it.
// Pages and features may lead somewhere; an entity or a backend client that
// knows a route would tie a domain concept to one screen layout. They take the
// way out as a callback instead (useMissingToolAction(openDependencies)).
const ROUTE_BLIND_LAYERS = new Set(['infra', 'entities'])

const routerImport = {
	name: '@tanstack/react-router',
	message:
		'Entities and infrastructure do not know routes: take the navigation as a callback from the feature or page.'
}

function layerRules() {
	return LAYERS.map(({ alias, dir }, index) => {
		const forbidden = LAYERS.slice(index).map(layer => layer.alias)

		return {
			files: [`src/${dir}/**/*.{ts,tsx}`],
			rules: {
				'no-restricted-imports': [
					'error',
					{
						paths: ROUTE_BLIND_LAYERS.has(alias) ? [routerImport] : [],
						patterns: [
							{
								group: forbidden.flatMap(patternsFor),
								message:
									`\`${alias}\` may import only layers below it ` +
									`(${LAYERS.slice(0, index)
										.map(layer => layer.alias)
										.join(', ') || 'nothing'}). ` +
									'Sideways imports are denied too: two slices that need each other are one slice.'
							},
							deepImportRule
						]
					}
				]
			}
		}
	})
}

export default tseslint.config(
	{
		ignores: [
			'out/**',
			'dist/**',
			'release/**',
			'node_modules/**',

			'src/**/*.gen.ts',

			'**/*.d.ts'
		]
	},

	js.configs.recommended,
	...tseslint.configs.recommended,

	{ rules: { 'no-empty': ['error', { allowEmptyCatch: true }] } },

	{
		files: ['**/*.mjs'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: globals.node
		}
	},

	{
		files: ['**/*.cjs'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'commonjs',
			globals: globals.node
		},
		rules: { '@typescript-eslint/no-require-imports': 'off' }
	},

	{
		files: ['src/**/*.{ts,tsx}', 'vitest.setup.ts'],
		languageOptions: {
			parserOptions: {
				project: './tsconfig.web.json',
				ecmaFeatures: { jsx: true }
			},
			globals: globals.browser
		},
		plugins: {
			react: reactPlugin,
			'react-hooks': reactHooks
		},
		settings: { react: { version: 'detect' } },
		rules: {
			...reactPlugin.configs.flat.recommended.rules,
			...reactHooks.configs.recommended.rules,

			'react/react-in-jsx-scope': 'off',
			'react/prop-types': 'off',
			'@typescript-eslint/consistent-type-imports': [
				'error',
				{ prefer: 'type-imports', fixStyle: 'separate-type-imports' }
			],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
			]
		}
	},

	{
		files: ['src/**/*.{ts,tsx}'],
		ignores: ['src/**/*.test.{ts,tsx}'],
		rules: {
			'no-restricted-syntax': [
				'error',
				{
					selector: "CallExpression[callee.type='MemberExpression'][callee.property.name='watch']",
					message:
						'A side effect on a unit is onEach(unit, fn) from @shared/factory: it runs in scope, and a test can replace it.'
				}
			]
		}
	},

	{
		files: ['electron/**/*.ts', 'electron.vite.config.ts', 'vitest.config.ts'],
		languageOptions: {
			parserOptions: { project: './tsconfig.node.json' },
			globals: globals.node
		},
		rules: {

			'no-restricted-imports': [
				'error',
				{
					patterns: [
						{
							group: LAYERS.flatMap(layer => patternsFor(layer.alias)),
							message: 'The main process must not import renderer code — they are separate processes.'
						}
					]
				}
			]
		}
	},

	...layerRules(),

	prettierConfig
)
