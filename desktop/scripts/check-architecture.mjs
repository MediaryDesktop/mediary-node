#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const SRC = fileURLToPath(new URL('../src', import.meta.url))
const SOURCE_EXTENSIONS = ['.ts', '.tsx']

const LAYER_DIRS = {
	shared: 'shared',
	infrastructure: 'infra',
	entities: 'entities',
	features: 'features',
	pages: 'pages',
	app: 'app'
}

const SLICED_LAYERS = new Set(['shared', 'infra', 'entities', 'features', 'pages'])

const ALIAS_NODES = Object.fromEntries(
	Object.values(LAYER_DIRS).map(alias => [
		`@${alias}`,
		segments => (SLICED_LAYERS.has(alias) && segments[0] ? `${alias}/${segments[0]}` : alias)
	])
)

const IMPORT_PATTERN = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g

const TYPE_ONLY_PATTERN = /(?:import|export)\s+type\s+[\s\S]*?from\s*['"][^'"]+['"]/g

function collectSourceFiles(dir, found = []) {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry)

		if (statSync(path).isDirectory()) {
			collectSourceFiles(path, found)
			continue
		}

		if (SOURCE_EXTENSIONS.some(extension => entry.endsWith(extension))) {
			found.push(path)
		}
	}

	return found
}

function nodeOfFile(path) {
	const segments = relative(SRC, path).split(sep)
	const [dir, name] = segments
	const alias = LAYER_DIRS[dir]

	if (!alias) {
		return 'root'
	}

	return SLICED_LAYERS.has(alias) && name ? `${alias}/${name}` : alias
}

function nodeOfSpecifier(specifier) {
	const [prefix, ...segments] = specifier.split('/')
	const resolve = ALIAS_NODES[prefix]

	return resolve ? resolve(segments) : null
}

function findCycles(edges) {
	const index = new Map()
	const lowlink = new Map()
	const onStack = new Set()
	const stack = []
	const cycles = []
	let counter = 0

	function strongConnect(node) {
		index.set(node, counter)
		lowlink.set(node, counter)
		counter += 1
		stack.push(node)
		onStack.add(node)

		for (const next of edges.get(node)?.keys() ?? []) {
			if (!index.has(next)) {
				strongConnect(next)
				lowlink.set(node, Math.min(lowlink.get(node), lowlink.get(next)))
			} else if (onStack.has(next)) {
				lowlink.set(node, Math.min(lowlink.get(node), index.get(next)))
			}
		}

		if (lowlink.get(node) !== index.get(node)) {
			return
		}

		const component = []
		let member

		do {
			member = stack.pop()
			onStack.delete(member)
			component.push(member)
		} while (member !== node)

		if (component.length > 1) {
			cycles.push(component.reverse())
		}
	}

	for (const node of edges.keys()) {
		if (!index.has(node)) {
			strongConnect(node)
		}
	}

	return cycles
}

const files = collectSourceFiles(SRC)

const edges = new Map()

for (const file of files) {
	const from = nodeOfFile(file)
	const source = readFileSync(file, 'utf8').replace(TYPE_ONLY_PATTERN, '')

	if (!edges.has(from)) {
		edges.set(from, new Map())
	}

	for (const match of source.matchAll(IMPORT_PATTERN)) {
		const to = nodeOfSpecifier(match[1])

		if (!to || to === from) {
			continue
		}

		if (!edges.has(to)) {
			edges.set(to, new Map())
		}

		const samples = edges.get(from).get(to) ?? []

		if (samples.length < 3) {
			samples.push(`${relative(SRC, file).split(sep).join('/')} → ${match[1]}`)
		}

		edges.get(from).set(to, samples)
	}
}

// The root of a slice holds its public index and the one component that composes
// it; everything else sits in ui/, model/, lib/, config/ and the like. A page slice
// serves routes, so each of its *Page components is a main one.
const ROOT_LAYERS = ['entities', 'features', 'pages']

function rootProblems() {
	const problems = []

	for (const layer of ROOT_LAYERS) {
		for (const slice of readdirSync(join(SRC, layer))) {
			const dir = join(SRC, layer, slice)

			if (!statSync(dir).isDirectory()) {
				continue
			}

			const files = readdirSync(dir).filter(entry => statSync(join(dir, entry)).isFile())
			const components = files.filter(file => file.endsWith('.tsx') && !file.startsWith('index.'))

			for (const file of files) {
				const allowed =
					file === 'index.ts' ||
					file === 'index.tsx' ||
					file.endsWith('.module.scss') ||
					(file.endsWith('.tsx') &&
						(layer === 'pages' ? file.endsWith('Page.tsx') : components.length === 1))

				if (!allowed) {
					problems.push(`${layer}/${slice}/${file}`)
				}
			}
		}
	}

	return problems
}

const misplaced = rootProblems()

if (misplaced.length === 0) {
	console.log('✔ Slice roots hold only their index and main component.')
} else {
	console.error(`✖ ${misplaced.length} file(s) at a slice root that belong in ui/, model/, lib/ or config/:
`)

	for (const file of misplaced) {
		console.error(`   ${file}`)
	}

	console.error('')
}

// Markup and styles carry no comments (architecture.md §5): what a component
// needs explained goes into a clearer name, a smaller part, or the .ts beside it.
// Directives are code, not comments, and stay.
const DIRECTIVE = /^\/[/*]\s*(eslint-|@ts-|prettier-ignore)/

function tsxComments(path) {
	const text = readFileSync(path, 'utf8')
	const source = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
	const found = new Map()

	const collect = ranges => {
		for (const range of ranges ?? []) {
			const comment = text.slice(range.pos, range.end)
			if (!DIRECTIVE.test(comment)) {
				found.set(range.pos, source.getLineAndCharacterOfPosition(range.pos).line + 1)
			}
		}
	}

	const visit = node => {
		collect(ts.getLeadingCommentRanges(text, node.getFullStart()))
		collect(ts.getTrailingCommentRanges(text, node.getEnd()))
		node.getChildren(source).forEach(visit)
	}
	visit(source)

	return [...found.values()]
}

function scssComments(path) {
	const lines = readFileSync(path, 'utf8')
		.replace(/url\([^)]*\)/g, 'url()')
		.replace(/(["'])(?:\\.|(?!\1).)*\1/g, '""')
		.split('\n')

	return lines.flatMap((line, index) => (/\/\*|(^|\s)\/\//.test(line) ? [index + 1] : []))
}

function collectStyleFiles(dir, found = []) {
	for (const entry of readdirSync(dir)) {
		const path = join(dir, entry)

		if (statSync(path).isDirectory()) {
			collectStyleFiles(path, found)
		} else if (entry.endsWith('.scss')) {
			found.push(path)
		}
	}

	return found
}

const commented = [
	...files.filter(file => file.endsWith('.tsx')).map(file => [file, tsxComments(file)]),
	...collectStyleFiles(SRC).map(file => [file, scssComments(file)])
].flatMap(([file, lines]) => lines.map(line => `${relative(SRC, file).split(sep).join('/')}:${line}`))

if (commented.length === 0) {
	console.log('✔ No comments in .tsx or .scss.')
} else {
	console.error(`✖ ${commented.length} comment(s) in .tsx or .scss (architecture.md §5):\n`)

	for (const place of commented) {
		console.error(`   ${place}`)
	}

	console.error('')
}

// A component's styles name colours by token only (architecture.md §8): the
// theme swaps token values on <html>, so a colour written out stays what it was
// in the other theme. A mask's colour is only its alpha, and a colour built from
// a token (rgba(var(--accent-rgb), …)) is a token.
const RAW_COLOUR = /#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?)\((?!\s*var\()/

const rawColours = collectStyleFiles(SRC)
	.filter(file => file.endsWith('.module.scss'))
	.flatMap(file =>
		readFileSync(file, 'utf8')
			.split('\n')
			.flatMap((line, index) =>
				RAW_COLOUR.test(line) && !/mask-image/.test(line)
					? [`${relative(SRC, file).split(sep).join('/')}:${index + 1}`]
					: []
			)
	)

if (rawColours.length === 0) {
	console.log('✔ Component styles use colour tokens only.')
} else {
	console.error(`✖ ${rawColours.length} raw colour(s) in component styles; use a palette token:\n`)

	for (const place of rawColours) {
		console.error(`   ${place}`)
	}

	console.error('')
}

// Type sizes come from the scale (--font-size-*), so a new screen cannot add a
// thirtieth size by accident. A fluid clamp() for a hero heading is the one
// thing that stays outside it.
const OFF_SCALE = /font-size:(?!\s*(var\(--font-size-|clamp\(|inherit))/

const offScale = collectStyleFiles(SRC).flatMap(file =>
	readFileSync(file, 'utf8')
		.split('\n')
		.flatMap((line, index) =>
			OFF_SCALE.test(line) ? [`${relative(SRC, file).split(sep).join('/')}:${index + 1}`] : []
		)
)

if (offScale.length === 0) {
	console.log('✔ Type sizes come from the scale.')
} else {
	console.error(`✖ ${offScale.length} font size(s) off the scale; use a --font-size-* token:\n`)

	for (const place of offScale) {
		console.error(`   ${place}`)
	}

	console.error('')
}

// The Electron bridge is the outside world: it is reached from infrastructure,
// from the app's composition, or as an effect in a slice's api/ or model/ —
// never from a component or the design system, which then could not render
// without a shell behind it.
const BRIDGE = /\bwindow\.mediary\b/

const bridgeOutside = files
	.map(file => relative(SRC, file).split(sep).join('/'))
	.filter(file => !/^(infrastructure|app)\//.test(file))
	.filter(file => !/\/(api|model)\/[^/]+\.ts$/.test(file))
	.filter(file => !/\.test\.tsx?$/.test(file))
	.filter(file => BRIDGE.test(readFileSync(join(SRC, file), 'utf8')))

if (bridgeOutside.length === 0) {
	console.log('✔ The Electron bridge is reached only from infrastructure, app, api and model.')
} else {
	console.error(`✖ ${bridgeOutside.length} file(s) reach window.mediary directly:\n`)

	for (const file of bridgeOutside) {
		console.error(`   ${file}`)
	}

	console.error('')
}

// When to ask the node is one rule (infra/node, whenNodeReady), not each screen's.
// A component or hook that reads $nodeReady to decide for itself is the thing
// that rule replaced.
const NODE_READY_IN_COMPONENT = /\$nodeReady\b/
const NODE_READY_IN_HOOK = /useUnit\([^)]*\$nodeReady/

const askingForThemselves = files
	.filter(file => !relative(SRC, file).startsWith('infrastructure'))
	.filter(file => {
		const text = readFileSync(file, 'utf8')

		return file.endsWith('.tsx') ? NODE_READY_IN_COMPONENT.test(text) : NODE_READY_IN_HOOK.test(text)
	})
	.map(file => relative(SRC, file).split(sep).join('/'))

if (askingForThemselves.length === 0) {
	console.log('✔ No component decides for itself whether the node is ready.')
} else {
	console.error(
		`✖ ${askingForThemselves.length} file(s) read $nodeReady in a component or hook; use useNodeData:\n`
	)

	for (const file of askingForThemselves) {
		console.error(`   ${file}`)
	}

	console.error('')
}

// Components and hooks: what renders, and the use* functions beside it.
const rendersOrHooks = files
	.map(file => relative(SRC, file).split(sep).join('/'))
	.filter(file => !file.startsWith('infrastructure/'))
	.filter(file => !/\.test\.tsx?$/.test(file))
	.filter(file => file.endsWith('.tsx') || /(^|\/)use[A-Z][^/]*\.ts$/.test(file))

// An effect called by name from a component runs outside the scope the app is
// rendered in, and its answer lands in local state nobody else can see. A
// component starts an event or a mutation; when it must await an effect, it
// binds it with useUnit first, which keeps the call in scope.
const DIRECT_EFFECT_CALL = /(?<![.\w])(\w+Fx)\(/g

const directEffectCalls = rendersOrHooks.flatMap(file => {
	const names = [...readFileSync(join(SRC, file), 'utf8').matchAll(DIRECT_EFFECT_CALL)]
		.map(match => match[1])
		.filter(name => !/^create\w*Fx$/.test(name))

	return [...new Set(names)].map(name => `${file} → ${name}()`)
})

if (directEffectCalls.length === 0) {
	console.log('✔ Components and hooks call no effect directly.')
} else {
	console.error(
		`✖ ${directEffectCalls.length} direct effect call(s) in components or hooks; start a unit, or bind the effect with useUnit:\n`
	)

	for (const line of directEffectCalls) {
		console.error(`   ${line}`)
	}

	console.error('')
}

// The other way round the node rule (§2) is broken: a screen that starts a node
// query from its own effect asks whether or not the node is up, and never asks
// again after it restarts. Which queries are the node's is read off the source:
// those whose effect is made with createNodeRequestFx.
const sources = files.filter(file => !/\.test\.tsx?$/.test(file)).map(file => readFileSync(file, 'utf8'))

const nodeEffects = new Set(
	sources.flatMap(text => [...text.matchAll(/const\s+(\w+Fx)\s*=\s*createNodeRequestFx\b/g)].map(m => m[1]))
)

const nodeQueries = new Set(
	sources.flatMap(text =>
		[...text.matchAll(/const\s+(\w+)\s*=\s*createQuery\(\{\s*effect:\s*(\w+)/g)]
			.filter(match => nodeEffects.has(match[2]))
			.map(match => match[1])
	)
)

function callBlocks(text, opener) {
	const found = []
	let start = text.indexOf(opener)

	while (start !== -1) {
		let depth = 0
		let end = start + opener.length - 1

		for (; end < text.length; end++) {
			if (text[end] === '(') {
				depth++
			} else if (text[end] === ')' && --depth === 0) {
				break
			}
		}

		found.push(text.slice(start, end + 1))
		start = text.indexOf(opener, end)
	}

	return found
}

// Names a component gives to `someQuery.start`, read from useUnit([...]) and
// useUnit(someQuery.start).
function startersOf(text) {
	const starters = new Map()

	for (const [, names, units] of text.matchAll(/const\s+\[([^\]]*)\]\s*=\s*useUnit\(\[([^\]]*)\]\)/g)) {
		const unitList = units.split(',').map(unit => unit.trim())

		names
			.split(',')
			.map(name => name.trim())
			.forEach((name, index) => {
				const query = /^(\w+)\.start$/.exec(unitList[index] ?? '')?.[1]

				if (query) {
					starters.set(name, query)
				}
			})
	}

	for (const [, name, query] of text.matchAll(/const\s+(\w+)\s*=\s*useUnit\((\w+)\.start\)/g)) {
		starters.set(name, query)
	}

	return starters
}

const nodeQueriesFromEffects = rendersOrHooks.flatMap(file => {
	const text = readFileSync(join(SRC, file), 'utf8')
	const starters = [...startersOf(text)].filter(([, query]) => nodeQueries.has(query))
	const effects = callBlocks(text, 'useEffect(')

	return starters
		.filter(([name]) => effects.some(effect => new RegExp(`(?<![.\\w])${name}\\(`).test(effect)))
		.map(([, query]) => `${file} → ${query}.start`)
})

if (nodeQueriesFromEffects.length === 0) {
	console.log(`✔ No screen starts a node query from its own effect (${nodeQueries.size} node queries).`)
} else {
	console.error(
		`✖ ${nodeQueriesFromEffects.length} node query(ies) started from a component's effect; use useNodeData:\n`
	)

	for (const line of nodeQueriesFromEffects) {
		console.error(`   ${line}`)
	}

	console.error('')
}

// Windows and macOS find './logo.module.scss' when the file is Logo.module.scss;
// Linux does not, and the build and the tests there fail on a file that "exists".
const listings = new Map()

function namesIn(dir) {
	if (!listings.has(dir)) {
		let names = null

		try {
			names = new Set(readdirSync(dir))
		} catch {
			names = null
		}

		listings.set(dir, names)
	}

	return listings.get(dir)
}

function existsWithCase(path) {
	const segments = relative(SRC, path).split(sep)

	if (segments[0] === '..') {
		return true
	}

	let dir = SRC

	for (const segment of segments) {
		if (!namesIn(dir)?.has(segment)) {
			return false
		}

		dir = join(dir, segment)
	}

	return true
}

const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', `${sep}index.ts`, `${sep}index.tsx`]

const wrongCase = files.flatMap(file => {
	const found = []

	for (const [, specifier] of readFileSync(file, 'utf8').matchAll(IMPORT_PATTERN)) {
		if (!specifier.startsWith('.')) {
			continue
		}

		const target = join(file, '..', specifier)
		const candidates = RESOLVE_SUFFIXES.map(suffix => target + suffix)

		if (!candidates.some(existsWithCase)) {
			found.push(`${relative(SRC, file).split(sep).join('/')} → ${specifier}`)
		}
	}

	return found
})

if (wrongCase.length === 0) {
	console.log('✔ Relative imports name their files with the right case.')
} else {
	console.error(`✖ ${wrongCase.length} relative import(s) that only resolve on a case-insensitive disk:\n`)

	for (const line of wrongCase) {
		console.error(`   ${line}`)
	}

	console.error('')
}

const cycles = findCycles(edges)
const nodeCount = [...edges.keys()].filter(node => edges.get(node).size > 0 || node !== 'root').length

if (cycles.length === 0) {
	console.log(`✔ No slice cycles (${files.length} files, ${nodeCount} nodes).`)
	const problems = [
		misplaced,
		commented,
		askingForThemselves,
		rawColours,
		offScale,
		bridgeOutside,
		directEffectCalls,
		nodeQueriesFromEffects,
		wrongCase
	]

	process.exit(problems.every(found => found.length === 0) ? 0 : 1)
}

console.error(`✖ Found ${cycles.length} slice cycle(s) across ${files.length} files:\n`)

cycles.forEach((component, position) => {
	console.error(`${position + 1}) ${component.join(' ↔ ')}`)

	for (const from of component) {
		for (const [to, samples] of edges.get(from)) {
			if (!component.includes(to)) {
				continue
			}

			for (const sample of samples) {
				console.error(`     ${sample}`)
			}
		}
	}

	console.error('')
})

console.error('Slices must form a DAG. See docs/architecture.md.')
process.exit(1)
