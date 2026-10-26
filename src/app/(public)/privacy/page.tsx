import type { Metadata } from 'next'
import Link from 'next/link'
import { ThemeToggle } from '@/shared/components/ThemeToggle'
import { SIGNIN_PATH } from '@/shared/lib/auth/gate'
import { SITE_NAME } from '@/shared/lib/site'

export const metadata: Metadata = {
  title: `Privacy · ${SITE_NAME}`,
  description: `What ${SITE_NAME} keeps about you, why, and how to have it removed.`,
}

const CONTACT = 'nikhil@heubert.com'
const UPDATED = '16 October 2026'

/**
 * The privacy policy: public, static, linked from the Google sign-in consent screen (its app domain
 * must hold it). Written from what the schema stores (src/shared/lib/db/schema.ts) and what the
 * model calls send; change it when either changes.
 */
export default function PrivacyPage() {
  return (
    <div className="@container flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b">
        <div className="mx-auto flex h-12 w-full max-w-5xl items-center justify-between gap-4 px-gutter">
          <Link href={SIGNIN_PATH} className="font-heading font-semibold">
            {SITE_NAME}
          </Link>
          <ThemeToggle />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-section px-gutter py-section">
        <article className="flex max-w-prose flex-col gap-block">
          <div className="flex flex-col gap-stack">
            <h1 className="text-h1 font-semibold tracking-tight">Privacy</h1>
            <p className="text-lead">
              {SITE_NAME} helps international students decide where and what to study abroad. This
              page says what we keep about you, why, and how to have it removed.
            </p>
            <p className="text-caption text-muted-foreground">Last updated {UPDATED}</p>
          </div>

          <section className="flex flex-col gap-stack">
            <h2 className="text-h3">Who we are</h2>
            <p>
              {SITE_NAME} is run by Heubert Technologies, Parramatta, NSW, Australia. Questions and
              requests go to <a href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </p>
          </section>

          <section className="flex flex-col gap-stack">
            <h2 className="text-h3">What we keep</h2>
            <ul className="flex list-disc flex-col gap-2 pl-5">
              <li>
                <strong>Your Google account details:</strong> your name, email address and profile
                picture, and the sign-in tokens Google issues, so you stay signed in.
              </li>
              <li>
                <strong>Your sessions:</strong> when you signed in, and the browser and IP address
                you signed in from, to keep your account secure.
              </li>
              <li>
                <strong>Your answers and roadmaps:</strong> what you tell us about yourself, your
                plans and your budget, in taps or in your own words, and the notes we take from
                them.
              </li>
              <li>
                <strong>Your questions:</strong> what you ask about a city or a course, and the
                answer you were given.
              </li>
              <li>
                <strong>Counts without names:</strong> how often each study path is shown, never
                tied to you.
              </li>
            </ul>
            <p>
              Two cookies: one keeps you signed in, one remembers your light or dark theme. There is
              no advertising and no analytics tracker.
            </p>
          </section>

          <section className="flex flex-col gap-stack">
            <h2 className="text-h3">How we use it</h2>
            <p>
              To show you study and visa routes that fit your answers, to answer your questions, and
              to show you posts and updates that concern you. Our team can see answers and questions
              to improve {SITE_NAME}. We do not sell your data or share it with anyone outside the
              services below.
            </p>
          </section>

          <section className="flex flex-col gap-stack">
            <h2 className="text-h3">Google Cloud and Gemini</h2>
            <p>
              {SITE_NAME} runs on Google Cloud: the app on Cloud Run and the database on Cloud SQL,
              both in Singapore. To read what you write in your own words, write the explanations,
              answer your questions and find courses from what you type, we send that text, the
              relevant answers and your question to Google's Gemini models on Vertex AI, never your
              name, email or account. Google processes them under its Google Cloud terms and does
              not use them to train its models. If you write about how you are feeling in the
              own-words boxes during onboarding, it is kept as a private note: never turned into an
              answer, and never sent to the models that write explanations or answer questions. What
              you type into Find courses is sent to Google's models to find courses and write each
              course's explanation, so don't write anything there you wouldn't want read by them.
            </p>
          </section>

          <section className="flex flex-col gap-stack">
            <h2 className="text-h3">How long we keep it</h2>
            <p>
              As long as you have an account. A roadmap you delete is hidden from you and kept until
              you ask us to erase your account. Server logs, which hold addresses but not your
              answers, are kept by Google Cloud for about 30 days.
            </p>
          </section>

          <section className="flex flex-col gap-stack">
            <h2 className="text-h3">Your choices</h2>
            <p>
              You can change your answers at any time. To see what we hold about you, correct it, or
              have your account and everything in it erased, email{' '}
              <a href={`mailto:${CONTACT}`}>{CONTACT}</a>. We answer within 30 days.
            </p>
          </section>
        </article>
      </main>
    </div>
  )
}
