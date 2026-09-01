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

export { Logo } from './logo/Logo'
export type { LogoProps } from './logo/Logo'

export { Icon } from './icon/Icon'
export type { IconName, IconProps } from './icon/Icon'
