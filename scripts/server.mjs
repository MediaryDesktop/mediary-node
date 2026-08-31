/**
 * Proxy an npm script through to the Go server's Taskfile.
 *
 *   node scripts/server.mjs dev
 *
 * The two halves of this repository use different toolchains on purpose — Task
 * for Go, npm for the desktop app — and this keeps `npm run` usable as the
 * single entry point without putting a package.json inside a Go project.
 */
import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const SERVER = resolve(dirname(fileURLToPath(import.meta.url)), '../server')

const args = process.argv.slice(2)

if (args.length === 0) {
	console.error('usage: node scripts/server.mjs <task> [...args]')
	process.exit(2)
}

const child = spawn('task', args, { cwd: SERVER, stdio: 'inherit', shell: true })

child.on('exit', code => process.exit(code ?? 1))
child.on('error', error => {
	console.error(`[server] could not run task: ${error.message}`)
	console.error('Install it with: go install github.com/go-task/task/v3/cmd/task@latest')
	process.exit(1)
})
