export {
	addExtensionRepositoryMutation,
	checkExtensionUpdatesMutation,
	configureExtensionMutation,
	extensionCatalogQuery,
	extensionsQuery,
	installExtensionMutation,
	previewExtensionMutation,
	removeExtensionMutation,
	removeExtensionRepositoryMutation,
	updateExtensionMutation
} from './model/model'
export type {
	CatalogPlugin,
	Extension,
	ExtensionCatalog,
	ExtensionPreview,
	ExtensionRepository,
	ExtensionSetting,
	ExtensionUpdate
} from './api/api'

// Called straight from the install dialog, which walks preview → consent →
// install or update in one place and keeps the steps' state itself.
export { installExtensionFx, previewExtensionFx, updateExtensionFx } from './api/api'
