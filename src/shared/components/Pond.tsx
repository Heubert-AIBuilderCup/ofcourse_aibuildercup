import { cn } from '@/shared/lib/utils'
import { Duck } from './Duck'
import styles from './pond.module.css'

/**
 * The duck in its pond (the design's cn-pond): the end of onboarding, and the loader that carries
 * her on to her roadmaps. Decorative. `className` gives it its place and width.
 */
export function Pond({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn(styles.pond, className)}>
      <span className={cn(styles.wave, styles.waveBack)} />
      <span className={styles.swim}>
        <span className={styles.ripple} />
        <span className={styles.ripple} />
        <span className={styles.turn}>
          <Duck size="3.75rem" eager className={styles.duck} />
        </span>
      </span>
      <span className={cn(styles.wave, styles.waveFront)} />
    </div>
  )
}
