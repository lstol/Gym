import { Link } from 'react-router-dom'
import { nb } from '../../i18n/nb'
import { useActiveProgram } from '../../data/queries/program'

export function HomePage() {
  const { data: program, isLoading } = useActiveProgram()

  return (
    <div className="mx-auto max-w-md p-6">
      <h1 className="text-xl font-semibold text-stone-900">{nb.home.programTitle}</h1>

      {isLoading && <p className="mt-4 text-sm text-stone-500">{nb.home.loading}</p>}

      {!isLoading && !program && (
        <p className="mt-4 text-sm text-stone-500">{nb.home.noProgram}</p>
      )}

      {program && (
        <div className="mt-4">
          <p className="text-lg font-medium text-stone-900">{program.name}</p>
          <ul className="mt-4 space-y-2">
            {program.session_templates.map((t) => (
              <li
                key={t.id}
                className="flex items-center justify-between rounded-lg border border-stone-200 p-3"
              >
                <div>
                  <p className="font-medium">
                    {t.code} — {t.name_nb}
                  </p>
                  <p className="text-sm text-stone-500">{t.items.length} øvelser</p>
                </div>
                <Link
                  to={`/logger?template=${t.id}`}
                  className="rounded-lg bg-stone-900 px-3 py-2 text-sm font-medium text-white"
                >
                  {nb.home.startSession}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
