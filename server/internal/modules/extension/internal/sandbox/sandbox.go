// Package sandbox runs a plugin's code in goja with nothing but what the node
// hands it: fetch to the plugin's own hosts, an HTML parser, a console and the
// plugin's settings. goja itself gives a script no files, no network and no
// processes, so a plugin is exactly as dangerous as these few bindings let it be.
package sandbox
