import { Link } from 'react-router-dom'
import { nb } from '../../i18n/nb'
import { useActiveProgram } from '../../data/queries/program'
import { CalendarSection } from '../calendar/CalendarSection'
import { ProgramSection } from '../blocks/ProgramSection'
import { ProgressSection } from './ProgressSection'

export function HomePage() {
  const { data: program, isLoading } = useActiveProgram()

  const currentExerciseIds = (program?.session_templates ?? []).flatMap((t) =>
    t.items.map((i) => i.exercise_id),
  )

  return (
    <div className="mx-auto max-w-md space-y-4 p-4 pb-16">
      <header className="flex items-center justify-between px-1 pt-2">
        <h1 className="text-xl font-semibold text-ink">{nb.appName}</h1>
        <Link to="/settings" className="text-sm text-muted underline">
          {nb.nav.settings}
        </Link>
      </header>

      {isLoading && <p className="px-1 text-sm text-muted">{nb.home.loading}</p>}

      {!isLoading && !program && (
        <p className="px-1 text-sm text-muted">{nb.program.noProgram}</p>
      )}

      {program && (
        <>
          <CalendarSection program={program} />
          <ProgramSection program={program} />
          <ProgressSection currentExerciseIds={currentExerciseIds} />
        </>
      )}
    </div>
  )
}
