export default function Header({ lang, onLangToggle, theme, onThemeToggle }) {
  return (
    <header className="flex items-center justify-between px-5 py-3 bg-slate-50 dark:bg-slate-950 sticky top-0 z-10 border-b border-slate-200 dark:border-slate-800/60">
      {/* Toggle langue — libellé EN/FR explicite */}
      <button
        onClick={onLangToggle}
        className="text-xs font-bold tracking-widest text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-md"
        aria-label="Changer la langue"
      >
        {lang === 'fr' ? 'EN' : 'FR'}
      </button>

      {/* Logo */}
      <span className="text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
        score<span className="text-blue-500">26</span>
      </span>

      {/* Toggle thème */}
      <button
        onClick={onThemeToggle}
        className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 transition-colors bg-slate-100 dark:bg-slate-800 w-8 h-8 rounded-md flex items-center justify-center text-sm"
        aria-label="Changer le thème"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </header>
  )
}
