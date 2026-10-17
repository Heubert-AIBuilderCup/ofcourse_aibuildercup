import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'

import { FrameMarks } from '@/shared/components/Blueprint'
import { cn } from '@/shared/lib/utils'

// group/button: its corner marks spread on hover (FrameMarks `spread`), and a forward arrow nudges
// 4px, as the design's .btn.blueprint does; eased only when motion is welcome, never while the
// button is unavailable (aria-disabled). The pointer on every button (Tailwind 4 leaves a
// button's cursor at default), not-allowed while unavailable.
const buttonVariants = cva(
  'group/button [&>svg.lucide-arrow-right]:motion-safe:transition-transform [&>svg.lucide-arrow-right]:motion-safe:duration-350 [&>svg.lucide-arrow-right]:motion-safe:ease-out-expo not-aria-disabled:hover:[&>svg.lucide-arrow-right]:translate-x-1 relative inline-flex cursor-pointer aria-disabled:cursor-not-allowed items-center justify-center gap-2 whitespace-nowrap rounded-md font-heading text-sm font-semibold ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*=size-])]:size-icon [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        // The solid button in the shade of primary that passes 4.5:1 with a 14px label
        // (DESIGN.md: plain primary is for large text only).
        default:
          'border border-primary-strong bg-primary-strong text-primary-strong-foreground hover:border-primary-strong-hover hover:bg-primary-strong-hover active:bg-primary-strong-active',
        // The same solid button in the brand blue in light mode (globals.css).
        strong:
          'border border-brand bg-brand text-brand-foreground hover:border-brand-hover hover:bg-brand-hover active:bg-brand-active',
        destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
        // Inside the content workbench (`workbench`, globals.css) a secondary action must read as
        // a button beside its fields (18 Oct): a primary hairline, a surface fill, a hover and a
        // pressed shade. The student screens keep the faint frame.
        outline:
          'border border-input bg-background hover:bg-accent hover:text-accent-foreground workbench:border-primary workbench:bg-secondary workbench:text-foreground workbench:hover:border-primary-strong workbench:hover:bg-accent workbench:active:bg-accent-200',
        secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        // The design's ghost text action (btn-ghost): accent words, no frame, underlined on hover.
        text: 'bg-transparent font-sans text-caption font-medium text-accent-700 underline-offset-3 hover:text-accent-800 hover:underline',
        // A bordered square with no corner marks (the design's hdr-btn and cn-btn): the header's
        // action and the coin stepper. Unavailable (aria-disabled), it fades.
        square:
          'border border-border bg-transparent text-foreground hover:border-foreground/40 hover:bg-foreground/6 aria-disabled:opacity-40 aria-disabled:hover:border-border aria-disabled:hover:bg-transparent',
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-md px-8',
        icon: 'h-10 w-10',
        // 44px, the touch target the header and the coin stepper need.
        'icon-lg': 'size-11 p-0',
      },
    },
    compoundVariants: [
      // A text action sits in running layout: as tall as a touch target, as wide as its words, and
      // free to wrap on a phone.
      {
        variant: 'text',
        className: 'h-auto min-h-11 justify-start px-0 py-0 text-left whitespace-normal',
      },
    ],
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, children, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    // Framed objects in the design system: the solid and outlined buttons carry corner marks.
    const framed =
      !asChild &&
      (variant == null || variant === 'default' || variant === 'strong' || variant === 'outline')
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props}>
        {framed ? (
          <FrameMarks
            spread={props['aria-disabled'] !== true && props['aria-disabled'] !== 'true'}
          />
        ) : null}
        {children}
      </Comp>
    )
  },
)
Button.displayName = 'Button'

export { Button, buttonVariants }
