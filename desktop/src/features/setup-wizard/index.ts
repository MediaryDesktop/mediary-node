/**
 * The first-run wizard: the frame, the step rail, the footer and the screens
 * inside them.
 *
 * UI only for now — nothing here reads or writes a setting. When the steps get
 * real behaviour it lands in `model/`, and the components keep taking values
 * and callbacks so the page stays the only thing that knows what a finished
 * wizard leads to.
 */
export { SETUP_STEPS } from './lib/steps'
export type { SetupStep, SetupStepId } from './lib/steps'

export { SetupLayout } from './ui/SetupLayout'
export type { SetupLayoutProps } from './ui/SetupLayout'

export { SetupStepRail } from './ui/SetupStepRail'
export type { SetupStepRailProps } from './ui/SetupStepRail'

export { SetupStepPanel } from './ui/SetupStepPanel'
export type { SetupStepPanelProps } from './ui/SetupStepPanel'

export { SetupFooter } from './ui/SetupFooter'
export type { SetupFooterProps } from './ui/SetupFooter'

export { SetupNotice } from './ui/SetupNotice'
export type { SetupNoticeProps } from './ui/SetupNotice'

export { SetupAccountStep } from './ui/SetupAccountStep'
export { SetupLibraryStep } from './ui/SetupLibraryStep'
export { SetupPlayerStep } from './ui/SetupPlayerStep'
export { SetupDownloadingStep } from './ui/SetupDownloadingStep'
export { SetupDebridStep } from './ui/SetupDebridStep'
export { SetupPendingStep } from './ui/SetupPendingStep'
