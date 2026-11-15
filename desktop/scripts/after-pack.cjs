// electron-builder skips an extraResources entry whose source is missing, which
// would ship an installer without its node. Refuse that build instead.
const { existsSync } = require('node:fs')
const { join } = require('node:path')

exports.default = async function afterPack(context) {
	const name = context.electronPlatformName === 'win32' ? 'nodesrv.exe' : 'nodesrv'
	const binary = join(context.packager.getResourcesDir(context.appOutDir), 'bin', name)

	if (!existsSync(binary)) {
		throw new Error(
			`the node binary is missing from the package: ${binary}. Run \`task build:all\` in server/ first.`
		)
	}
}
