import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { nb } from '../../i18n/nb'
import { useProgress } from '../../data/queries/progress'
import type { ExerciseProgress } from '../../data/queries/progress'

export function ProgressSection({ currentExerciseIds }: { currentExerciseIds: string[] }) {
  const { data: progress, isLoading } = useProgress(currentExerciseIds)

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-line bg-surface p-4">
        <h2 className="text-base font-semibold text-ink">{nb.progress.title}</h2>
        <p className="mt-2 text-sm text-muted">{nb.logger.loading}</p>
      </section>
    )
  }

  const current = (progress ?? []).filter((p) => p.inCurrentProgram)
  const archived = (progress ?? []).filter((p) => !p.inCurrentProgram)

  return (
    <section className="rounded-2xl border border-line bg-surface p-4">
      <h2 className="text-base font-semibold text-ink">{nb.progress.title}</h2>

      {(progress ?? []).length === 0 && (
        <p className="mt-2 text-sm text-muted">{nb.progress.noData}</p>
      )}

      {current.length > 0 && (
        <>
          <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-faint">
            {nb.progress.current}
          </h3>
          <div className="mt-2 space-y-2">
            {current.map((p) => (
              <ExerciseChart key={p.exerciseId} progress={p} />
            ))}
          </div>
        </>
      )}

      {archived.length > 0 && (
        <>
          <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-faint">
            {nb.progress.archived}
          </h3>
          <div className="mt-2 space-y-2">
            {archived.map((p) => (
              <ExerciseChart key={p.exerciseId} progress={p} />
            ))}
          </div>
        </>
      )}
    </section>
  )
}

/**
 * Explicit numeric bounds with a little headroom. Recharts' string forms
 * ('dataMin - 2') produced nonsense ticks here, so the domain is computed.
 */
function yDomain(progress: ExerciseProgress): [number, number] {
  const values = progress.points.map((p) => p.topKg)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pad = Math.max(1, (max - min) * 0.2)
  return [Math.max(0, min - pad), max + pad]
}

function ExerciseChart({ progress }: { progress: ExerciseProgress }) {
  const latest = progress.points.at(-1)
  const first = progress.points[0]
  const trendUp = latest && first ? latest.topKg > first.topKg : false

  return (
    <div className="rounded-xl bg-sunken p-3">
      <div className="flex items-baseline justify-between">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-ink">{progress.name}</p>
          <p className="text-xs text-muted">
            {progress.points.length} {nb.progress.sessions}
          </p>
        </div>
        {latest && (
          <div className="text-right">
            <p className="font-mono text-sm font-bold text-ink">
              {latest.topKg.toFixed(1).replace('.', ',')} kg
            </p>
            <p className={`text-xs ${trendUp ? 'text-done' : 'text-faint'}`}>
              × {latest.reps}
            </p>
          </div>
        )}
      </div>

      {progress.points.length > 1 && (
        <div className="mt-2 h-24 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={progress.points} margin={{ top: 6, right: 8, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--color-faint)' }}
                tickFormatter={(d: string) => d.slice(5)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: 'var(--color-faint)' }}
                axisLine={false}
                tickLine={false}
                width={34}
                domain={yDomain(progress)}
                tickFormatter={(v: number) => String(Math.round(v))}
              />
              <Tooltip
                formatter={(value) => [`${Number(value).toFixed(1)} kg`, nb.progress.topSet]}
                labelStyle={{ fontSize: 12 }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Line
                type="monotone"
                dataKey="topKg"
                stroke="var(--color-brand)"
                strokeWidth={2}
                dot={{ r: 2.5, fill: 'var(--color-brand)' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
