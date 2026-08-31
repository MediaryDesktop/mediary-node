#!/usr/bin/env node
/**
 * Module-level cycle detector — see docs/architecture.md.
 *
 * ESLint enforces the *direction* of imports (which layer may reach which).
 * It cannot see cycles, because a cycle is a property of the graph, not of any
 * single file: `library/lib/*` importing `media/types` and `media/pages/*`
 * importing `library` are each legal in isolation and jointly a cycle.
 *
 * This script collapses every source file to its owning node (`modules/library`,
 * `shell`, `kernel`, …), builds the import graph between nodes, and fails on any
 * strongly connected component larger than one node.
 *
 * Usage: node scripts/check-architecture.mjs
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const SRC = fileURLToPath(new URL('../src', import.meta.url))
const SOURCE_EXTENSIONS = ['.ts', '.tsx']

/** Ownership categories, each of which collapses to one graph node. */
const CATEGORIES = ['lib', 'ui', 'core', 'app']

/** Alias prefix → the owning graph node. */
const ALIAS_NODES = {
	'@lib': () => 'lib',
	'@ui': () => 'ui',
	'@core': segments => (segments[0] ? `core/${segments[0]}` : 'core'),
	'@app': () => 'app',
	'@modules': segments => (segments[0] ? `modules/${segments[0]}` : 'modules')
}

const IMPORT_PATTERN = /(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g

/**
 * Type-only imports and exports, which vanish at compile time.
 *
 * `verbatimModuleSyntax` keeps `import { type A } from 'x'` as a real import,
 * so that form stays a genuine runtime edge and is left alone. `import type
 * { A } from 'x'` is erased entirely and creates no edge — counting it would
 * report cycles that cannot exist at runtime, which matters now that shared
 * domain types live in the module that owns them rather than in a neutral
 * layer.
 */
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

/** The node a file belongs to, mirroring the alias map above. */
function nodeOfFile(path) {
	const segments = relative(SRC, path).split(sep)
	const [area, name] = segments

	// modules and core are the two categories whose members are independent
	// graph nodes: a cycle between two modules, or between two core packages, is
	// exactly what this script exists to catch.
	if (area === 'modules' || area === 'core') {
		return name ? `${area}/${name}` : area
	}

	if (CATEGORIES.includes(area)) {
		return area
	}

	return 'root'
}

/** The node an import specifier points at, or null for relative / package imports. */
function nodeOfSpecifier(specifier) {
	const [prefix, ...segments] = specifier.split('/')
	const resolve = ALIAS_NODES[prefix]

	return resolve ? resolve(segments) : null
}

/** Tarjan's SCC — every component with more than one node is a cycle. */
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

/** node → target node → sample import lines, kept for the failure report. */
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

const cycles = findCycles(edges)
const nodeCount = [...edges.keys()].filter(node => edges.get(node).size > 0 || node !== 'root').length

if (cycles.length === 0) {
	console.log(`✔ No module cycles (${files.length} files, ${nodeCount} nodes).`)
	process.exit(0)
}

console.error(`✖ Found ${cycles.length} module cycle(s) across ${files.length} files:\n`)

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

console.error('Modules must form a DAG. See docs/architecture.md.')
process.exit(1)
