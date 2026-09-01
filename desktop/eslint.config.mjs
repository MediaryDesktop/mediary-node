import js from '@eslint/js'
import prettierConfig from 'eslint-config-prettier'
import reactPlugin from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import globals from 'globals'
import tseslint from 'typescript-eslint'

/*
 * ---------------------------------------------------------------------------
 * Architecture boundaries — see docs/architecture.md
 *
 *   app         composition: routes, providers, the frame
 *   pages       one route each: composes features and entities
 *   features    a user scenario that changes something
 *   entities    a domain concept and the state that is it
 *   infra       the outside world: cloud, node, the Electron bridge
 *   shared      domain-free toolkit: ui, request layer, primitives
 *
 * A layer may import strictly downwards, never sideways and never up. The
 * sideways half matters as much as the direction: two slices of the same layer
 * that need each other are one slice with a seam drawn in the wrong place, and
 * a cycle waiting to be written.
 *
 * ESLint sees one file at a time, so it enforces direction and public-API
 * access only. It cannot see cycles: a cycle is a property of the graph, not of
 * any single file. That is what scripts/check-architecture.mjs is for.
 * `npm run arch:check` runs both, and violations are errors, not warnings.
 * ---------------------------------------------------------------------------
 */

/** Bottom to top. Index order *is* the dependency rule. */
const LAYERS = [
	{ alias: 'shared', dir: 'shared' },
	{ alias: 'infra', dir: 'infrastructure' },
	{ alias: 'entities', dir: 'entities' },
	{ alias: 'features', dir: 'features' },
	{ alias: 'pages', dir: 'pages' },
	{ alias: 'app', dir: 'app' }
]

/** Every alias pattern for a layer: the bare alias plus everything under it. */
const patternsFor = alias => [`@${alias}`, `@${alias}/*`, `@${alias}/*/**`]

/**
 * Layers whose slices have a public index. Reaching past it
 * (`@entities/session/model`) makes the index documentation rather than a
 * boundary, so the deep path is denied everywhere.
 *
 * `shared` is exempt on purpose: it is a toolkit of independent segments, not
 * slices with an owner, and `@shared/ui/theme/global.scss` has to be reachable.
 */
const SLICED_LAYERS = ['infra', 'entities', 'features', 'pages']

const deepImportRule = {
	group: SLICED_LAYERS.flatMap(alias => [`@${alias}/*/*`, `@${alias}/*/*/**`]),
	message: 'Import a slice through its public index (`@entities/session`), not a path inside it.'
}

/** One config per layer: may not import its own layer or anything above it. */
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
			// Generated: API types by `npm run api:types`, the sprite metadata by
			// the @neodx/svg plugin on every dev run and build.
			'src/**/*.gen.ts',
			// Declaration files carry no logic to lint.
			'**/*.d.ts'
		]
	},

	js.configs.recommended,
	...tseslint.configs.recommended,

	// Build and tooling scripts: linted, but not type-aware. They are not part
	// of either TypeScript project, and pretending otherwise only produces
	// "file not found in project" noise.
	{
		files: ['**/*.mjs'],
		languageOptions: {
			ecmaVersion: 'latest',
			sourceType: 'module',
			globals: globals.node
		}
	},

	// ── Renderer ────────────────────────────────────────────────────────────
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
			// The JSX transform makes the React import unnecessary.
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

	// ── Main process and preload ────────────────────────────────────────────
	{
		files: ['electron/**/*.ts', 'electron.vite.config.ts', 'vitest.config.ts'],
		languageOptions: {
			parserOptions: { project: './tsconfig.node.json' },
			globals: globals.node
		},
		rules: {
			// The main process must not reach into the renderer at all. They run in
			// different processes — an import that looked like it worked would
			// bundle renderer code into the main process.
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

	// ── Dependency directions ───────────────────────────────────────────────
	...layerRules(),

	prettierConfig
)
