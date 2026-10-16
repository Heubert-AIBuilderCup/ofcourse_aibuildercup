import Image from 'next/image'

/**
 * The brand's rubber duck (public/brand/duck.png, 492×456, facing left). `size` is the width it is
 * drawn at (a CSS length, e.g. "4rem"): Next serves the copy that width needs at the screen's
 * density, so the duck stays sharp on a high-density screen and through the 1440→1920 scaling.
 * `className` sets its drawn size, a mirror (-scale-x-100) and its motion; decorative, so no alt.
 */
export function Duck({
  size,
  className,
  eager = false,
}: {
  size: string
  className?: string
  eager?: boolean
}) {
  return (
    <Image
      src="/brand/duck.png"
      alt=""
      width={492}
      height={456}
      sizes={size}
      loading={eager ? 'eager' : undefined}
      className={className}
    />
  )
}
