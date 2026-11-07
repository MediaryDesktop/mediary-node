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

const cycles = findCycles(edges)
const nodeCount = [...edges.keys()].filter(node => edges.get(node).size > 0 || node !== 'root').length

if (cycles.length === 0) {
	console.log(`✔ No slice cycles (${files.length} files, ${nodeCount} nodes).`)
	process.exit(
		misplaced.length + commented.length + askingForThemselves.length + rawColours.length === 0 ? 0 : 1
	)
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
