#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

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

const cycles = findCycles(edges)
const nodeCount = [...edges.keys()].filter(node => edges.get(node).size > 0 || node !== 'root').length

if (cycles.length === 0) {
	console.log(`✔ No slice cycles (${files.length} files, ${nodeCount} nodes).`)
	process.exit(misplaced.length === 0 ? 0 : 1)
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
