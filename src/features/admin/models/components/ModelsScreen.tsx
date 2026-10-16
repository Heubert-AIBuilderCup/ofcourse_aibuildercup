'use client'

import { useState, useTransition } from 'react'
import { TIERS, type Tier, type UseCase } from '@/features/content/ai/config'
import { allowedTiers, KNOWN_MODELS } from '@/features/content/ai/models'
import type { AiSettings, SettingChange } from '@/features/content/ai/settings'
import { Button } from '@/shared/components/ui/button'
import { Card } from '@/shared/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog'
import { NativeSelect } from '@/shared/components/ui/native-select'
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/shared/components/ui/table'
import { formatWhen } from '@/shared/lib/site'
import { cn } from '@/shared/lib/utils'
import type { ActionResult } from '@/shared/types/action-result'
import { hint } from '../../components/styles'
import { NETWORK_ERROR } from '../../hooks/useAdminAction'
import type { StudentCallRow, TestResult } from '../test-call'
import { USE_CASES } from '../use-cases'

// The Models page (criteria 90–98): each use case's tier and model, each tier's model and where it
// comes from, the failing mark, and the last changes. Everyone who may open the page sees them; a
// superadmin also gets Test, Change and Reset, which the server actions check again.

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
    <p role="alert" className={cn(hint, 'text-foreground')}>
      {error}
    </p>
  )
}

export function ModelsScreen(props: ModelsScreenProps) {
  const { canManage, defaultTiers, envModels, settings, changes, unavailable, actions } = props
  const modelOf = (tier: Tier) => settings.tierModels[tier] ?? envModels[tier]
  // Tests need no settings; a change or a reset needs them read.
  const canChange = canManage && !unavailable

  return (
    <div className="flex flex-col gap-block">
      {unavailable && (
        <p role="alert" className={cn(hint, 'text-destructive')}>
          The model settings cannot be read, so every call runs on the environment's models. Nothing
          can be changed or reset until they can: the migration may not have run yet.
        </p>
      )}
      {canManage ? (
        <ManageBar actions={actions} canReset={canChange} />
      ) : (
        <p className={hint}>Only a superadmin can test, change or reset the models.</p>
      )}

      <Card as="section" aria-labelledby="models-use-cases">
        <h2 id="models-use-cases" className="p-5 pb-0 text-h4 font-semibold">
          Use cases
        </h2>
        <Table>
          <TableCaption className="sr-only">Use cases</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Use case</TableHead>
              <TableHead>For</TableHead>
              <TableHead>Tier</TableHead>
              <TableHead>Model</TableHead>
              {canManage && <TableHead>Test</TableHead>}
              {canChange && <TableHead>Tier choice</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {USE_CASES.map((u) => {
              const tier = settings.useCaseTiers[u] ?? defaultTiers[u]
              return (
                <UseCaseRow
                  key={u}
                  useCase={u}
                  tier={tier}
                  model={modelOf(tier)}
                  canManage={canManage}
                  canChange={canChange}
                  actions={actions}
                />
              )
            })}
          </TableBody>
        </Table>
      </Card>

      <Card as="section" aria-labelledby="models-tiers">
        <h2 id="models-tiers" className="p-5 pb-0 text-h4 font-semibold">
          Tiers
        </h2>
        <Table>
          <TableCaption className="sr-only">Tiers</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Tier</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Last error</TableHead>
              {canChange && <TableHead>Model choice</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
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
          </TableBody>
        </Table>
      </Card>

      <Card as="section" aria-labelledby="models-changes">
        <h2 id="models-changes" className="p-5 pb-0 text-h4 font-semibold">
          Last changes
        </h2>
        <Table>
          <TableCaption className="sr-only">Last changes</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>Who</TableHead>
              <TableHead>What</TableHead>
              <TableHead>Old</TableHead>
              <TableHead>New</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.map((c, i) => (
              // The log has no id here; its order is fixed, newest first.
              // biome-ignore lint/suspicious/noArrayIndexKey: entries can share key and time
              <TableRow key={`${c.at}-${c.key}-${i}`}>
                <TableCell>{formatWhen(c.at)}</TableCell>
                <TableCell>{c.userName ?? 'Unknown'}</TableCell>
                <TableCell>{changeLabel(c.key)}</TableCell>
                <TableCell className="font-mono text-caption break-all">
                  {c.oldValue ?? '—'}
                </TableCell>
                <TableCell className="font-mono text-caption break-all">
                  {c.newValue ?? '—'}
                </TableCell>
              </TableRow>
            ))}
            {changes.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No changes yet.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}

/** "Test all student calls" with its lines, and "Reset to defaults" behind a confirmation. */
function ManageBar({ actions, canReset }: { actions: Actions; canReset: boolean }) {
  const students = useRun()
  const [rows, setRows] = useState<StudentCallRow[] | null>(null)
  return (
    <div className="flex flex-col gap-stack">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={students.pending}
          onClick={() => students.run(actions.testStudentCalls, (res) => setRows(res.rows))}
        >
          Test all student calls
        </Button>
        {canReset && <ResetToDefaults reset={actions.reset} />}
      </div>
      {students.pending && <p className={hint}>Testing the student calls…</p>}
      <Refusal error={students.error} />
      {rows && (
        <ul role="status" className="flex flex-col gap-1 text-caption">
          {rows.map((r) => (
            <li key={r.label} className={r.ok ? undefined : 'text-destructive'}>
              {`${r.label}: ${resultLine(r)}`}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ResetToDefaults({ reset }: { reset: Actions['reset'] }) {
  const [open, setOpen] = useState(false)
  const { pending, error, run } = useRun()
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Reset to defaults
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-lg font-semibold">Reset to defaults</DialogTitle>
            <DialogDescription className={hint}>
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

function UseCaseRow({
  useCase,
  tier,
  model,
  canManage,
  canChange,
  actions,
}: {
  useCase: UseCase
  tier: Tier
  model: string
  canManage: boolean
  canChange: boolean
  actions: Actions
}) {
  const test = useRun()
  const [result, setResult] = useState<TestResult | null>(null)
  const change = useRun()
  const allowed = allowedTiers(useCase)
  return (
    <TableRow>
      <TableCell className="font-mono text-caption">{useCase}</TableCell>
      <TableCell>{useCase.startsWith('student_') ? 'Student' : 'Admin'}</TableCell>
      <TableCell>{TIER_LABELS[tier]}</TableCell>
      <TableCell className="font-mono text-caption">{model || 'Not set'}</TableCell>
      {canManage && (
        <TableCell>
          <div className="flex flex-col items-start gap-1">
            <Button
              size="sm"
              variant="outline"
              aria-label={`Test ${useCase}`}
              disabled={test.pending}
              onClick={() =>
                test.run(
                  () => actions.test(useCase),
                  (res) => setResult(res.result),
                )
              }
            >
              Test
            </Button>
            {test.pending && <p className={hint}>Testing…</p>}
            {result && (
              <p
                role="status"
                className={cn('text-caption', result.ok ? 'text-foreground' : 'text-destructive')}
              >
                {resultLine(result)}
              </p>
            )}
            <Refusal error={test.error} />
          </div>
        </TableCell>
      )}
      {canChange && (
        <TableCell>
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
            <span className={hint}>{TIER_LABELS[allowed[0] ?? tier]} only</span>
          )}
          <Refusal error={change.error} />
        </TableCell>
      )}
    </TableRow>
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
    <TableRow>
      <TableCell>{label}</TableCell>
      <TableCell className="font-mono text-caption">{model || 'Not set'}</TableCell>
      <TableCell>{chosen ? 'Page' : 'Environment'}</TableCell>
      <TableCell>
        {failing ? (
          <div className="flex flex-col items-start gap-1">
            <span className="inline-flex items-center rounded-md border border-destructive px-2 py-0.5 text-caption font-medium text-destructive">
              Falling back to the default
            </span>
            <span className="text-caption text-muted-foreground">
              {formatWhen(failing.at)}: {failing.error}
            </span>
          </div>
        ) : (
          <span className={hint}>None</span>
        )}
      </TableCell>
      {canChange && (
        <TableCell>
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
          {change.pending && <p className={hint}>Testing the new model…</p>}
          {result && <p role="status" className="text-caption">{`Saved. ${resultLine(result)}`}</p>}
          <Refusal error={change.error} />
        </TableCell>
      )}
    </TableRow>
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
        className="w-auto"
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
      <Button
        size="sm"
        variant="outline"
        aria-label={changeLabel}
        disabled={pending || choice === '' || choice === saved}
        onClick={() => onChange(choice)}
      >
        Change
      </Button>
    </div>
  )
}
