'use client'

import { ArrowRight, Check, CircleAlert, LoaderCircle } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { type FormEvent, type ReactNode, useEffect, useRef, useState } from 'react'
// The mini build: the same z.email() check the server makes, without the full library in the page.
import { z } from 'zod/mini'
import { Blueprint } from '@/shared/components/Blueprint'
import { Button } from '@/shared/components/ui/button'
import { Input } from '@/shared/components/ui/input'
import { Label } from '@/shared/components/ui/label'
import { emailOtp, signIn } from '@/shared/lib/auth/client'
import { SIGNIN_ERROR_PATH, SUSPENDED_PATH } from '@/shared/lib/auth/gate'
import { cn } from '@/shared/lib/utils'
import {
  CODE_LIFETIME_SECONDS,
  CODE_MESSAGES,
  type CodeError,
  codeErrorOf,
  MAX_WRONG_CODES,
  RESEND_WAIT_SECONDS,
} from '../lib/code-messages'
import { GoogleSignIn } from './GoogleSignIn'
import styles from './sign-in.module.css'

const EMAIL = z.email()
const CODE = /^\d{6}$/

// The text links, in the shade of primary that passes 4.5:1 with a 14px label (DESIGN.md: plain
// primary is for large text only).
const LINK = 'px-0 text-primary-strong hover:text-primary-strong-hover'

// The design's field: a small label that takes the accent while the field has focus and the
// danger red while it is invalid; the input in the surface fill, ringed in red when invalid.
const LABEL =
  'text-xs font-normal text-foreground/70 transition-colors group-focus-within:text-primary-strong group-data-invalid:text-danger-700'
const INPUT =
  'h-9 bg-muted text-sm focus-visible:border-primary focus-visible:ring-offset-0 aria-invalid:border-danger aria-invalid:inset-ring aria-invalid:inset-ring-danger aria-invalid:focus-visible:border-danger aria-invalid:focus-visible:ring-danger'

function emailProblem(value: string): string {
  const address = value.trim()
  if (!address) return 'Enter your email.'
  return EMAIL.safeParse(address).success ? '' : 'Enter an email like name@company.com.'
}

const codeProblem = (value: string) => (CODE.test(value) ? '' : 'Enter the six-digit code.')

/**
 * The seconds left before a new code may be asked for. Each tick reads the clock, so a phone that
 * slept through the wait wakes with the right count.
 */
function useResendWait() {
  const [deadline, setDeadline] = useState<number | null>(null)
  const [left, setLeft] = useState(0)

  useEffect(() => {
    if (deadline === null) return
    const timer = setInterval(() => {
      const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000))
      setLeft(seconds)
      if (seconds === 0) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [deadline])

  const restart = () => {
    setDeadline(Date.now() + RESEND_WAIT_SECONDS * 1000)
    setLeft(RESEND_WAIT_SECONDS)
  }
  return { left, restart }
}

/** A field's own mistake, under it: an icon and the words, never colour alone. */
function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      id={id}
      className={cn(
        styles.errorIn,
        'm-0 flex items-start gap-1.5 text-xs leading-snug font-medium text-danger-700',
      )}
    >
      <CircleAlert aria-hidden="true" className="mt-px size-icon-sm shrink-0 text-danger" />
      <span>{children}</span>
    </p>
  )
}

/** The form's error block, for what the server or the sign-in page says. */
function Alert({ children }: { children: ReactNode }) {
  return (
    <div
      role="alert"
      className={cn(
        styles.errorIn,
        'flex items-start gap-2 border border-danger-300 bg-danger-100 px-3.5 py-2.5 text-caption text-danger-800',
      )}
    >
      <CircleAlert aria-hidden="true" className="icon-on-line size-icon shrink-0 text-danger-700" />
      <span>{children}</span>
    </div>
  )
}

/**
 * Student sign-in, the login design's framed card: a code sent to an email address, or Google.
 * The server owns the rules (ten minutes, five tries, a new code after 30 seconds, students only);
 * this mirrors them so the page says what is going on, and never shows the server's own wording.
 * A field's mistake shows under it once she leaves the field or sends; what the server says, or
 * the sign-in page's `notice`, shows in the error block; the card shakes at each failed try. The
 * button says what it is doing (sending, signing in, signed in). `next` must already be a safe
 * path (safeNextPath).
 */
export function StudentSignIn({ next, notice }: { next: string; notice?: string | null }) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  // The address the current code went to; null on the email step.
  const [sentTo, setSentTo] = useState<string | null>(null)
  // When it went. The server forgets an expired code once any request tidies its table and then
  // calls it wrong, so the page tells expiry from its own clock.
  const sentAt = useRef(0)
  const [code, setCode] = useState('')
  const [wrong, setWrong] = useState(0)
  // The current code can no longer sign in (voided after wrong tries, or expired): send a new one.
  const [spent, setSpent] = useState(false)
  const [error, setError] = useState<CodeError | null>(null)
  // The page's own message (a Google sign-in that came back refused), until she sends a code.
  const [pageNotice, setPageNotice] = useState(notice ?? null)
  const [busy, setBusy] = useState<'send' | 'sign' | null>(null)
  const [done, setDone] = useState(false)
  // Whether the field's own check shows: once she has left it with something in it, or sent.
  const [checkEmail, setCheckEmail] = useState(false)
  const [checkCode, setCheckCode] = useState(false)
  const [failures, setFailures] = useState(0)
  const emailInput = useRef<HTMLInputElement>(null)
  const codeInput = useRef<HTMLInputElement>(null)
  const wait = useResendWait()

  const failed = () => setFailures((n) => n + 1)

  function fail(reason: CodeError | 'suspended') {
    if (reason === 'suspended') return router.replace(SUSPENDED_PATH)
    setError(reason)
    failed()
  }

  async function sendCode(address: string) {
    setBusy('send')
    setError(null)
    setPageNotice(null)
    try {
      const { error: refused } = await emailOtp.sendVerificationOtp({
        email: address,
        type: 'sign-in',
      })
      if (refused) return fail(codeErrorOf(refused))
      sentAt.current = Date.now()
      setSentTo(address)
      setCode('')
      setCheckCode(false)
      setWrong(0)
      setSpent(false)
      wait.restart()
    } catch {
      fail('SEND_FAILED')
    } finally {
      setBusy(null)
    }
  }

  function onEmail(e: FormEvent) {
    e.preventDefault()
    if (busy) return
    setCheckEmail(true)
    if (emailProblem(email)) {
      failed()
      emailInput.current?.focus()
      return
    }
    void sendCode(email.trim())
  }

  async function onCode(e: FormEvent) {
    e.preventDefault()
    if (!sentTo || spent || busy || done) return
    // Not six digits: never sent, so it costs none of the server's five tries.
    setCheckCode(true)
    if (codeProblem(code)) {
      failed()
      codeInput.current?.focus()
      return
    }
    setBusy('sign')
    setError(null)
    try {
      const { error: refused } = await signIn.emailOtp({ email: sentTo, otp: code })
      if (!refused) {
        // Signed in: say so, and stay busy-looking while the page changes.
        setBusy(null)
        setDone(true)
        router.replace(next)
        return
      }
      const expired = Date.now() - sentAt.current >= CODE_LIFETIME_SECONDS * 1000
      const known = codeErrorOf(refused)
      // She has the code: an error we have no words for is a failed sign-in, not a failed send.
      const reason = expired ? 'OTP_EXPIRED' : known === 'SEND_FAILED' ? 'SIGN_IN_FAILED' : known
      if (reason === 'INVALID_OTP') {
        const tries = wrong + 1
        setWrong(tries)
        if (tries >= MAX_WRONG_CODES) {
          setSpent(true)
          fail('TOO_MANY_ATTEMPTS')
        } else {
          fail('INVALID_OTP')
        }
      } else {
        if (reason === 'TOO_MANY_ATTEMPTS' || reason === 'OTP_EXPIRED') setSpent(true)
        fail(reason)
      }
    } catch {
      fail('SIGN_IN_FAILED')
    }
    setBusy(null)
  }

  function differentEmail() {
    setSentTo(null)
    setCode('')
    setError(null)
  }

  const onEmailStep = sentTo === null
  const message = error ? CODE_MESSAGES[error] : onEmailStep ? pageNotice : null
  const emailError = checkEmail ? emailProblem(email) : ''
  const codeError = checkCode ? codeProblem(code) : ''
  const shake = failures === 0 ? undefined : failures % 2 ? 'a' : 'b'
  const holding = busy !== null || done

  const label = onEmailStep ? 'Send me a code' : 'Sign in'
  const working =
    busy === 'send' && onEmailStep ? 'Sending…' : busy === 'sign' ? 'Signing in…' : null
  const status =
    busy === 'send' ? 'Sending the code' : busy === 'sign' ? 'Signing in' : done ? 'Signed in' : ''

  const submit = (
    <div className={cn(styles.rise, styles.d8, 'flex flex-col gap-3.5')}>
      <Button
        type="submit"
        variant="strong"
        size="lg"
        aria-disabled={holding || undefined}
        disabled={!onEmailStep && spent}
        className={cn(
          styles.frame,
          styles.spread,
          'w-full',
          busy && 'cursor-progress',
          done && 'cursor-default',
        )}
      >
        {done ? (
          <>
            <Check aria-hidden="true" className="size-icon-sm" />
            Signed in
          </>
        ) : working ? (
          <>
            <LoaderCircle aria-hidden="true" className={cn(styles.spin, 'size-icon-sm')} />
            {working}
          </>
        ) : (
          <>
            {label}
            <ArrowRight aria-hidden="true" className={cn(styles.arrow, 'size-icon-sm')} />
          </>
        )}
      </Button>
      <p role="status" className="sr-only">
        {status}
      </p>
      {onEmailStep ? (
        <div className="text-center text-overline uppercase text-muted-foreground">or</div>
      ) : null}
    </div>
  )

  return (
    <Blueprint
      data-shake={shake}
      className={cn(
        styles.frame,
        styles.d5,
        shake === 'a' && styles.shakeA,
        shake === 'b' && styles.shakeB,
        'flex w-full max-w-sm flex-col gap-5 bg-card p-stack text-card-foreground @max-xl:p-5',
      )}
    >
      <div className={cn(styles.rise, styles.d6)}>
        <div className="mb-[0.425rem] text-micro uppercase text-primary-strong">Sign in</div>
        <h2 className="m-0 mb-[0.425rem] font-heading text-h2 font-semibold tracking-[-0.015em]">
          Welcome
        </h2>
        <p className="m-0 text-sm text-muted-foreground">Use Google or a code we email you.</p>
      </div>

      {message ? <Alert>{message}</Alert> : null}

      {onEmailStep ? (
        <form noValidate onSubmit={onEmail} className="flex flex-col gap-5">
          <div
            data-invalid={emailError ? '' : undefined}
            className={cn(styles.rise, styles.d7, 'group grid gap-1.5')}
          >
            <Label htmlFor="student-email" className={LABEL}>
              Your email
            </Label>
            <Input
              ref={emailInput}
              id="student-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@company.com"
              value={email}
              readOnly={holding}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => {
                if (email) setCheckEmail(true)
              }}
              aria-invalid={emailError ? true : undefined}
              aria-describedby={emailError ? 'student-email-error' : 'student-email-hint'}
              className={INPUT}
            />
            {emailError ? (
              <FieldError id="student-email-error">{emailError}</FieldError>
            ) : (
              <p id="student-email-hint" className="m-0 text-caption text-muted-foreground">
                We send a six-digit code. No password.
              </p>
            )}
          </div>
          {submit}
        </form>
      ) : (
        <form noValidate onSubmit={onCode} className="flex flex-col gap-5">
          <div className={cn(styles.rise, styles.d7, 'flex flex-col gap-3.5')}>
            <p className="m-0 text-sm">{`The code we sent to ${sentTo}`}</p>
            <div data-invalid={codeError ? '' : undefined} className="group grid gap-1.5">
              <Label htmlFor="student-code" className={LABEL}>
                Six-digit code
              </Label>
              <Input
                ref={codeInput}
                id="student-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                readOnly={holding}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                onBlur={() => {
                  if (code) setCheckCode(true)
                }}
                aria-invalid={codeError ? true : undefined}
                aria-describedby={codeError ? 'student-code-error' : undefined}
                className={INPUT}
              />
              {codeError ? <FieldError id="student-code-error">{codeError}</FieldError> : null}
            </div>
          </div>
          {submit}
          <div className="-mt-1.5 flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              variant="link"
              disabled={holding || wait.left > 0}
              onClick={() => void sendCode(sentTo)}
              // The wait is status, so it stays readable while the button is off.
              className={cn(LINK, 'disabled:text-muted-foreground disabled:opacity-100')}
            >
              {wait.left > 0 ? `Send a new code in ${wait.left} s` : 'Send a new code'}
            </Button>
            <Button
              type="button"
              variant="link"
              disabled={holding}
              onClick={differentEmail}
              className={LINK}
            >
              Use a different email
            </Button>
          </div>
        </form>
      )}

      {onEmailStep ? (
        // The "or" closes the form's last group; Google sits that group's gap below it.
        <GoogleSignIn
          next={next}
          surface="student"
          errorCallbackURL={SIGNIN_ERROR_PATH}
          className="-mt-1.5"
        />
      ) : null}
    </Blueprint>
  )
}
