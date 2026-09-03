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

function layerRules() {
	return LAYERS.map(({ alias, dir }, index) => {
		const forbidden = LAYERS.slice(index).map(layer => layer.alias)

		return {
			files: [`src/${dir}/**/*.{ts,tsx}`],
			rules: {
				'no-restricted-imports': [
					'error',
					{
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
