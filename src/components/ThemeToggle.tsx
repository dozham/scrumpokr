'use client'

import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()
  return (
    <button
      onClick={toggleTheme}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className="p-1.5 rounded-md text-slate-500 dark:text-gray-400 hover:text-slate-800 dark:hover:text-white hover:bg-sky-100 dark:hover:bg-gray-800 transition-colors text-lg leading-none"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}
