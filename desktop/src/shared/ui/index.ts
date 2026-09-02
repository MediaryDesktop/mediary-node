/**
 * The design system's public surface.
 *
 * Domain-free by rule (see ./README.md): nothing here knows what a title, a
 * download or the node is. A component that does belongs to the entity or
 * feature that owns it.
 */

export { Button } from './button/Button'
export type { ButtonProps, ButtonVariant } from './button/Button'

export { Input } from './input/Input'
export type { InputProps } from './input/Input'

export { OtpInput } from './otp-input/OtpInput'
export type { OtpInputProps } from './otp-input/OtpInput'

export { WindowControls } from './window-controls/WindowControls'
export type { WindowControlsProps } from './window-controls/WindowControls'

export { Logo } from './logo/Logo'
export type { LogoProps } from './logo/Logo'

export { Icon } from './icon/Icon'
export type { IconName, IconProps } from './icon/Icon'

export { Select } from './select/Select'
export type { SelectOption, SelectProps } from './select/Select'
