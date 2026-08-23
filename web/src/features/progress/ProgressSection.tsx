import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
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
  // While the load is unchanged (reps still climbing inside the range) the
  // line is flat by design — pad relative to the load itself so it sits in the
  // middle of the chart rather than pinned against an axis.
  const pad = Math.max(1, (max - min) * 0.2, max * 0.05)
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

      {/*
        Two parameters, two encodings. Bars are reps (right axis), the line is
        effective kg (left axis). Double progression is then literally visible:
        bars climb while the line is flat, then the line steps up and the bars
        drop back — one working cycle.
      */}
      {progress.points.length > 1 && (
        <div className="mt-2 h-32 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={progress.points} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: 'var(--color-faint)' }}
                tickFormatter={(d: string) => d.slice(5)}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                yAxisId="kg"
                tick={{ fontSize: 10, fill: 'var(--color-brand)' }}
                axisLine={false}
                tickLine={false}
                width={30}
                domain={yDomain(progress)}
                tickFormatter={(v: number) => String(Math.round(v))}
              />
              <YAxis
                yAxisId="reps"
                orientation="right"
                tick={{ fontSize: 10, fill: 'var(--color-faint)' }}
                axisLine={false}
                tickLine={false}
                width={24}
                allowDecimals={false}
                domain={[0, (max: number) => Math.ceil(max * 1.4)]}
              />
              <Tooltip
                formatter={(value, name) =>
                  name === nb.progress.weight
                    ? [`${Number(value).toFixed(1)} kg`, nb.progress.weight]
                    : [`${value}`, nb.progress.reps]
                }
                labelStyle={{ fontSize: 12 }}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Legend
                wrapperStyle={{ fontSize: 10 }}
                iconSize={8}
                verticalAlign="top"
                height={16}
              />
              <Bar
                yAxisId="reps"
                dataKey="reps"
                name={nb.progress.reps}
                fill="var(--color-brand)"
                fillOpacity={0.16}
                radius={[2, 2, 0, 0]}
                isAnimationActive={false}
              />
              <Line
                yAxisId="kg"
                type="stepAfter"
                dataKey="topKg"
                name={nb.progress.weight}
                stroke="var(--color-brand)"
                strokeWidth={2}
                dot={{ r: 2.5, fill: 'var(--color-brand)' }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}
