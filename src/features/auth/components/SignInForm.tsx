'use client'

import { ArrowRight, Eye, EyeOff } from 'lucide-react'
import { type FormEvent, useId, useState } from 'react'
import { Button } from '@/shared/components/ui/button'
import { Checkbox } from '@/shared/components/ui/checkbox'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { cn } from '@/shared/lib/utils'
import styles from './sign-in.module.css'

/**
 * The email-and-password form from the Industry login design: email, password with show/hide,
 * "Keep me signed in" and "Forgot password?", then the primary action. Visual only: the starter
 * signs in with Google (GoogleSignIn), so this form submits nowhere and its forgot-password link
 * points at a route each project adds. Its one piece of state is whether the password is shown.
 */
export function SignInForm({ className }: { className?: string }) {
  const [showPassword, setShowPassword] = useState(false)
  const id = useId()

  return (
    <form
      aria-label="Sign in with email"
      onSubmit={(e: FormEvent) => e.preventDefault()}
      className={cn('flex flex-col gap-5', className)}
    >
      <div className={cn(styles.rise, styles.d7, 'flex flex-col gap-3.5')}>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-email`} className="text-xs font-normal text-foreground/70">
            Email
          </Label>
          <Input
            id={`${id}-email`}
            name="email"
            type="email"
            autoComplete="email"
            placeholder="name@company.com"
            className="h-9 bg-muted text-sm"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${id}-password`} className="text-xs font-normal text-foreground/70">
            Password
          </Label>
          <div className="relative">
            <Input
              id={`${id}-password`}
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              className="h-9 bg-muted pr-11 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute top-0 right-0 size-9 text-muted-foreground"
            >
              {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3.5">
          <div className="flex min-h-6 items-center gap-2">
            <Checkbox id={`${id}-remember`} name="remember" />
            <Label htmlFor={`${id}-remember`} className="cursor-pointer font-normal">
              Keep me signed in
            </Label>
          </div>
          <a
            href="/forgot-password"
            className="text-sm text-primary-strong underline-offset-[3px] hover:text-primary-strong-hover hover:underline"
          >
            Forgot password?
          </a>
        </div>
      </div>

      <div className={cn(styles.rise, styles.d8, 'flex flex-col gap-3.5')}>
        <Button
          type="submit"
          size="lg"
          className={cn(
            styles.frame,
            styles.spread,
            'w-full border-primary-strong bg-primary-strong text-primary-strong-foreground hover:border-primary-strong-hover hover:bg-primary-strong-hover active:bg-primary-strong-active',
          )}
        >
          Sign in
          <ArrowRight aria-hidden="true" className={cn(styles.arrow, 'size-3.5')} />
        </Button>
        <div className="text-center text-overline uppercase text-muted-foreground">or</div>
      </div>
    </form>
  )
}
