import type { ButtonHTMLAttributes } from 'react'
import cls from './styles.module.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger'
type ButtonSize = 'sm' | 'md' | 'lg'

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth,
  className,
  ...props
}: ButtonProps) {
  const classes = [
    cls.btn,
    cls[`btn_${variant}`],
    cls[`btn_${size}`],
    fullWidth ? cls.btn_full : null,
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return <button className={classes} {...props} />
}

