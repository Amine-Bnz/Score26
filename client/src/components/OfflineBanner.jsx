import { t } from '../i18n'

export default function OfflineBanner({ lang }) {
  return (
    <div className="fixed top-0 inset-x-0 z-50 flex justify-center px-4 pt-2 pointer-events-none">
      <div className="bg-slate-800 text-slate-200 text-xs font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0 animate-pulse" />
        {t(lang, 'offline')}
      </div>
    </div>
  )
}
