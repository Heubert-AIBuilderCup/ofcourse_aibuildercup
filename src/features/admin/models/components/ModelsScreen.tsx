'use client'

import { Play } from 'lucide-react'
import { type ReactNode, useState, useTransition } from 'react'
import { TIERS, type Tier, type UseCase } from '@/features/content/ai/config'
import { allowedTiers, KNOWN_MODELS } from '@/features/content/ai/models'
import type { AiSettings, SettingChange } from '@/features/content/ai/settings'
import { emptyBox, hairlineTable, tag } from '@/shared/components/classes'
import { Button } from '@/shared/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { NativeSelect } from '@/shared/components/ui/native-select'
import { Spin, Working } from '@/shared/components/Working'
import { formatWhen } from '@/shared/lib/site'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { AdminBand } from '../../components/AdminBand'
import { AdminPageHeader } from '../../components/AdminPageHeader'
import { NETWORK_ERROR } from '../../hooks/useAdminAction'
import type { StudentCallRow, TestResult } from '../test-call'
import { USE_CASES } from '../use-cases'

// The Models page (criteria 90–98): each use case's tier and model, each tier's model and where it
// comes from, the failing mark, and the last changes. Everyone who may open the page sees them; a
// superadmin also gets Test, Change and Reset, which the server actions check again.

const { wrap, table, head, body, th, tr, td } = hairlineTable
const code = 'font-mono text-caption'
const muted = 'text-muted-foreground'

const TIER_LABELS: Record<Tier, string> = {
  lite: 'Flash-Lite',
  flash: 'Flash',
  pro: 'Pro',
  image: 'Image',
}

export type ModelsScreenProps = {
  /** A superadmin: Test, Change and Reset are offered. */
  canManage: boolean
  /** The tier each use case starts on with no choice saved. */
  defaultTiers: Record<UseCase, Tier>
  /** The environment's model for each tier. */
  envModels: Record<Tier, string>
  settings: AiSettings
  /** The newest changes first. */
  changes: SettingChange[]
  /** The settings could not be read (the migration not run yet): nothing can be changed or reset. */
  unavailable?: boolean
  actions: {
    test: (useCase: UseCase) => Promise<ActionResult<{ result: TestResult }>>
    testStudentCalls: () => Promise<ActionResult<{ rows: StudentCallRow[] }>>
    saveTierModel: (tier: Tier, model: string) => Promise<ActionResult<{ result: TestResult }>>
    saveUseCaseTier: (useCase: UseCase, tier: Tier) => Promise<ActionResult>
    reset: () => Promise<ActionResult>
  }
}

type Actions = ModelsScreenProps['actions']

/** "Passed on <model> in 812 ms", or "Failed on <model> in 30 ms: <error>". */
function resultLine(r: TestResult): string {
  const on = r.model ? ` on ${r.model}` : ''
  if (r.ok) return `Passed${on} in ${r.ms} ms`
  return `Failed${on} in ${r.ms} ms${r.error ? `: ${r.error}` : ''}`
}

/**
 * The band over the page: "Not tested yet" until a row is tested here, then how many were and
 * whether all passed. Results live in this page's state only, so a reload starts it again.
 */
function lastTestBand(
  results: Partial<Record<UseCase, TestResult>>,
  total: number,
): { title: string; passed: number; failed: number; untested: number } {
  const tested = Object.values(results)
  const passed = tested.filter((r) => r.ok).length
  const failed = tested.length - passed
  const title =
    tested.length === 0
      ? 'Not tested yet'
      : failed === 0
        ? `${tested.length} tested, all passed`
        : `${tested.length} tested, ${failed} failed`
  return { title, passed, failed, untested: total - tested.length }
}

/** What a change log entry changed, in words. */
function changeLabel(key: string): string {
  if (key === 'reset') return 'Reset to defaults'
  const [kind, name] = key.split(':', 2)
  if (kind === 'tier' && (TIERS as readonly string[]).includes(name)) {
    return `${TIER_LABELS[name as Tier]} model`
  }
  if (kind === 'usecase' && name) return `Tier of ${name}`
  return key
}

/** Runs one action: its refusal kept to show, its success handed on; never throws. */
function useRun() {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const run = <T extends object>(
    action: () => Promise<ActionResult<T>>,
    onOk?: (res: { ok: true } & T) => void,
  ) => {
    setError(null)
    startTransition(async () => {
      try {
        const res = await action()
        if (!res.ok) {
          setError(res.error)
          return
        }
        onOk?.(res)
      } catch {
        setError(NETWORK_ERROR)
      }
    })
  }
  return { pending, error, run }
}

function Refusal({ error }: { error: string | null }) {
  if (!error) return null
  return (
    <p role="alert" className="text-caption text-foreground">
      {error}
    </p>
  )
}

export function ModelsScreen(props: ModelsScreenProps) {
  const { canManage, defaultTiers, envModels, settings, changes, unavailable, actions } = props
  const modelOf = (tier: Tier) => settings.tierModels[tier] ?? envModels[tier]
  // Tests need no settings; a change or a reset needs them read.
  const canChange = canManage && !unavailable
  // Each row's last Test in this page's state: the band counts them, the row shows its own.
  const [results, setResults] = useState<Partial<Record<UseCase, TestResult>>>({})
  const band = lastTestBand(results, USE_CASES.length)
  const students = useRun()
  const [studentRows, setStudentRows] = useState<StudentCallRow[] | null>(null)
  const groups: [string, UseCase[]][] = [
    ['For the team', USE_CASES.filter((u) => !u.startsWith('student_'))],
    ['For students', USE_CASES.filter((u) => u.startsWith('student_'))],
  ]
  const columns = 4 + (canManage ? 1 : 0) + (canChange ? 1 : 0)

  return (
    <div className="flex flex-col gap-block">
      <AdminPageHeader
        kicker="AI"
        title="Models"
        lede="Which model each AI call runs on, whether it is healthy, and who changed it last."
      >
        {canChange && <ResetToDefaults reset={actions.reset} />}
        {canManage && (
          <Button
            disabled={students.pending}
            onClick={() =>
              students.run(actions.testStudentCalls, (res) => setStudentRows(res.rows))
            }
            className="h-11 px-5 @max-xl:flex-1"
          >
            {students.pending ? (
              <Spin />
            ) : (
              <Play aria-hidden="true" strokeWidth={1.5} className="size-icon-sm" />
            )}
            Test all student calls
          </Button>
        )}
      </AdminPageHeader>

      <AdminBand
        kicker="Last test"
        title={band.title}
        stats={[
          { value: USE_CASES.length, label: 'AI calls' },
          { value: band.passed, label: 'passed' },
          { value: band.failed, label: 'failed' },
          { value: band.untested, label: 'not tested yet' },
        ]}
      />

      {unavailable && (
        <p role="alert" className="text-destructive">
          The model settings cannot be read, so every call runs on the environment's models. Nothing
          can be changed or reset until they can: the migration may not have run yet.
        </p>
      )}
      {!canManage && (
        <p className={muted}>Only a superadmin can test, change or reset the models.</p>
      )}
      {(students.pending || students.error || studentRows) && (
        <div className="flex flex-col gap-stack">
          {students.pending && <Working words="Testing the student calls…" />}
          <Refusal error={students.error} />
          {studentRows && (
            <ul role="status" className="flex flex-col gap-1 text-caption">
              {studentRows.map((r) => (
                <li key={r.label} className={r.ok ? undefined : 'text-destructive'}>
                  {`${r.label}: ${resultLine(r)}`}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Section id="models-use-cases" title="Use cases">
        <div className={wrap}>
          <table className={table}>
            <caption className="sr-only">Use cases</caption>
            <thead className={head}>
              <tr>
                <th className={th}>Use case</th>
                <th className={th}>Tier</th>
                <th className={th}>Model</th>
                <th className={th}>Last test</th>
                {canManage && <th className={th}>Test</th>}
                {canChange && <th className={th}>Tier choice</th>}
              </tr>
            </thead>
            {groups.map(([label, useCases]) => (
              <tbody key={label} className={body}>
                <tr className="@max-xl:block">
                  <th
                    colSpan={columns}
                    scope="rowgroup"
                    className={cn(th, 'pt-5 text-accent-700 @max-xl:block @max-xl:px-0')}
                  >
                    {label} · {useCases.length}
                  </th>
                </tr>
                {useCases.map((u) => {
                  const tier = settings.useCaseTiers[u] ?? defaultTiers[u]
                  return (
                    <UseCaseRow
                      key={u}
                      useCase={u}
                      tier={tier}
                      model={modelOf(tier)}
                      result={results[u] ?? null}
                      onResult={(r) => setResults((prev) => ({ ...prev, [u]: r }))}
                      canManage={canManage}
                      canChange={canChange}
                      actions={actions}
                    />
                  )
                })}
              </tbody>
            ))}
          </table>
        </div>
      </Section>

      <Section id="models-tiers" title="Tiers">
        <div className={wrap}>
          <table className={table}>
            <caption className="sr-only">Tiers</caption>
            <thead className={head}>
              <tr>
                <th className={th}>Tier</th>
                <th className={th}>Model</th>
                <th className={th}>Source</th>
                <th className={th}>Last error</th>
                {canChange && <th className={th}>Model choice</th>}
              </tr>
            </thead>
            <tbody className={body}>
              {TIERS.map((t) => (
                <TierRow
                  key={t}
                  tier={t}
                  model={modelOf(t)}
                  chosen={settings.tierModels[t] !== undefined}
                  failing={settings.failing[t] ?? null}
                  canChange={canChange}
                  actions={actions}
                />
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="models-changes" title="Last changes">
        {changes.length === 0 ? (
          <p className={emptyBox}>No changes yet.</p>
        ) : (
          <div className={wrap}>
            <table className={table}>
              <caption className="sr-only">Last changes</caption>
              <thead className={head}>
                <tr>
                  <th className={th}>When</th>
                  <th className={th}>Who</th>
                  <th className={th}>What</th>
                  <th className={th}>Old</th>
                  <th className={th}>New</th>
                </tr>
              </thead>
              <tbody className={body}>
                {changes.map((c, i) => (
                  // The log has no id here; its order is fixed, newest first.
                  // biome-ignore lint/suspicious/noArrayIndexKey: entries can share key and time
                  <tr key={`${c.at}-${c.key}-${i}`} className={tr}>
                    <td className={td}>{formatWhen(c.at)}</td>
                    <td className={td}>{c.userName ?? 'Unknown'}</td>
                    <td className={td}>{changeLabel(c.key)}</td>
                    <td className={cn(td, code, 'break-all')}>{c.oldValue ?? '—'}</td>
                    <td className={cn(td, code, 'break-all')}>{c.newValue ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

/** One of the page's parts: its heading over its table, set apart by whitespace. */
function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex min-w-0 flex-col gap-3">
      <h2 id={id} className="text-h3 font-semibold">
        {title}
      </h2>
      {children}
    </section>
  )
}

function ResetToDefaults({ reset }: { reset: Actions['reset'] }) {
  const [open, setOpen] = useState(false)
  const { pending, error, run } = useRun()
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)} className="h-11 px-4 @max-xl:flex-1">
        Reset to defaults
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-h4 font-semibold">Reset to defaults</DialogTitle>
            <DialogDescription className={muted}>
              Clear every model and tier chosen on this page? Every call runs on the environment's
              models again. The change log is kept.
            </DialogDescription>
          </DialogHeader>
          <Refusal error={error} />
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => run(reset, () => setOpen(false))}
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** "Not tested yet", or the row's last result in this page's state, as a status when it lands. */
function LastTest({ result }: { result: TestResult | null }) {
  if (!result) return <span className={cn(muted, 'text-caption')}>Not tested yet</span>
  return (
    <p
      role="status"
      className={cn(
        'inline-flex items-baseline gap-1.5 text-caption',
        result.ok ? 'text-accent-700' : 'text-destructive',
      )}
    >
      {result.ok && (
        <span
          aria-hidden="true"
          className="size-1.75 shrink-0 self-center rounded-full bg-primary"
        />
      )}
      {resultLine(result)}
    </p>
  )
}

function UseCaseRow({
  useCase,
  tier,
  model,
  result,
  onResult,
  canManage,
  canChange,
  actions,
}: {
  useCase: UseCase
  tier: Tier
  model: string
  result: TestResult | null
  onResult: (result: TestResult) => void
  canManage: boolean
  canChange: boolean
  actions: Actions
}) {
  const test = useRun()
  const change = useRun()
  const allowed = allowedTiers(useCase)
  return (
    <tr className={tr}>
      <td className={cn(td, code)}>{useCase}</td>
      <td className={td}>
        <span className={tag}>{TIER_LABELS[tier]}</span>
      </td>
      <td className={cn(td, code, muted, 'break-all')}>{model || 'Not set'}</td>
      <td className={td}>
        <LastTest result={result} />
      </td>
      {canManage && (
        <td className={td}>
          <div className="flex flex-col items-start gap-1">
            <Button
              variant="text"
              aria-label={`Test ${useCase}`}
              disabled={test.pending}
              onClick={() =>
                test.run(
                  () => actions.test(useCase),
                  (res) => onResult(res.result),
                )
              }
              className="min-h-9 underline"
            >
              {test.pending ? (
                <Spin />
              ) : (
                <Play aria-hidden="true" strokeWidth={1.5} className="size-icon-xs" />
              )}
              Test
            </Button>
            {test.pending && <Working words="Testing… one call, up to half a minute" />}
            <Refusal error={test.error} />
          </div>
        </td>
      )}
      {canChange && (
        <td className={td}>
          {allowed.length > 1 ? (
            <ChangePicker
              key={tier}
              label={`Tier for ${useCase}`}
              changeLabel={`Change the tier of ${useCase}`}
              options={allowed.map((t) => ({ value: t, label: TIER_LABELS[t] }))}
              saved={tier}
              pending={change.pending}
              onChange={(t) => change.run(() => actions.saveUseCaseTier(useCase, t as Tier))}
            />
          ) : (
            <span className={cn(muted, 'text-caption')}>
              {TIER_LABELS[allowed[0] ?? tier]} only
            </span>
          )}
          <Refusal error={change.error} />
        </td>
      )}
    </tr>
  )
}

function TierRow({
  tier,
  model,
  chosen,
  failing,
  canChange,
  actions,
}: {
  tier: Tier
  model: string
  chosen: boolean
  failing: { error: string; at: string } | null
  canChange: boolean
  actions: Actions
}) {
  const options = KNOWN_MODELS.filter((m) => m.tiers.includes(tier)).map((m) => m.id)
  const change = useRun()
  const [result, setResult] = useState<TestResult | null>(null)
  const label = TIER_LABELS[tier]
  return (
    <tr className={tr}>
      <td className={td}>
        <span className={cn(tag, 'border-accent-700 text-accent-700')}>{label}</span>
      </td>
      <td className={cn(td, code, 'break-all')}>{model || 'Not set'}</td>
      <td className={td}>{chosen ? 'Page' : 'Environment'}</td>
      <td className={td}>
        {failing ? (
          <div className="flex flex-col items-start gap-1">
            <span className={cn(tag, 'border-destructive font-medium text-destructive')}>
              Falling back to the default
            </span>
            <span className={cn(muted, 'text-caption')}>
              {formatWhen(failing.at)}: {failing.error}
            </span>
          </div>
        ) : (
          <span className={muted}>None</span>
        )}
      </td>
      {canChange && (
        <td className={td}>
          <ChangePicker
            key={model}
            label={`Model for ${label}`}
            changeLabel={`Change the ${label} model`}
            placeholder="Choose a model"
            options={options.map((id) => ({ value: id, label: id }))}
            saved={model}
            pending={change.pending}
            onChange={(id) =>
              change.run(
                () => actions.saveTierModel(tier, id),
                (res) => setResult(res.result),
              )
            }
          />
          {change.pending && <Working words="Testing the new model…" />}
          {result && <p role="status" className="text-caption">{`Saved. ${resultLine(result)}`}</p>}
          <Refusal error={change.error} />
        </td>
      )}
    </tr>
  )
}

/**
 * A select starting on the saved value (or on the placeholder when the saved value is not offered)
 * and its Change button, on while another value is picked. Its row keys it on the saved value, so a
 * new value from the server (a save, a reset, another admin's change) starts it again.
 */
function ChangePicker({
  label,
  changeLabel,
  placeholder,
  options,
  saved,
  pending,
  onChange,
}: {
  label: string
  changeLabel: string
  placeholder?: string
  options: { value: string; label: string }[]
  saved: string
  pending: boolean
  onChange: (value: string) => void
}) {
  const offered = options.some((o) => o.value === saved)
  const [choice, setChoice] = useState(offered ? saved : '')
  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        aria-label={label}
        value={choice}
        onChange={(e) => setChoice(e.target.value)}
        className="h-9 w-auto min-w-28 border-foreground/30"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      <Button
        variant="text"
        aria-label={changeLabel}
        disabled={pending || choice === '' || choice === saved}
        onClick={() => onChange(choice)}
        className="min-h-9 underline"
      >
        {pending && <Spin />}
        Change
      </Button>
    </div>
  )
}
