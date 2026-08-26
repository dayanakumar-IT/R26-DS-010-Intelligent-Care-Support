import type { ButtonHTMLAttributes } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'danger'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-[var(--brand-blue)] text-white hover:opacity-90',
  secondary:
    'bg-white text-[var(--brand-blue)] border border-[var(--brand-blue)] hover:bg-blue-50',
  danger: 'bg-red-600 text-white hover:bg-red-700',
}

export default function Button({
  variant = 'primary',
  className = '',
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${VARIANT_CLASSES[variant]} ${className}`}
      {...props}
    />
  )
}
