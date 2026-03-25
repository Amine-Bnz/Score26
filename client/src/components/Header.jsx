// Header fixe présent sur toutes les pages
export default function Header({ lang, onLangToggle, theme, onThemeToggle }) {
  return (
    <header className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 sticky top-0 z-10">
      {/* Toggle langue */}
      <button
        onClick={onLangToggle}
        className="text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors w-10"
        aria-label="Changer la langue"
      >
        {lang === 'fr' ? '文A' : 'A文'}
      </button>

      {/* Logo */}
      <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">
        score26
      </span>

      {/* Toggle thème */}
      <button
        onClick={onThemeToggle}
        className="text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors w-10 text-right"
        aria-label="Changer le thème"
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </header>
  )
}
