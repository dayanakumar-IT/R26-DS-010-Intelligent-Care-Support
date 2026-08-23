import type { CSSProperties } from 'react'

/** Served from `public/admin-avatar.png` */
export const ADMIN_AVATAR_URL = '/admin-avatar.png'

type AdminAvatarImgProps = {
  size: number
  className?: string
  style?: CSSProperties
}

/** Circular photo used wherever an admin profile is shown */
export function AdminAvatarImg({ size, className, style }: AdminAvatarImgProps) {
  return (
    <img
      src={ADMIN_AVATAR_URL}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: 999,
        objectFit: 'cover',
        ...style,
      }}
    />
  )
}
