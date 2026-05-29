'use client'

import { useState, useEffect } from 'react'

export function JokeBox() {
  const [joke, setJoke] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  async function fetchJoke() {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch('https://teehee.dev/', {
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setJoke(data.joke)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchJoke() }, [])

  return (
    <div className="w-full max-w-xs p-6 bg-white dark:bg-gray-900 rounded-2xl shadow border border-sky-100 dark:border-gray-800 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-gray-500">😄 Joke of the moment</span>
        <button
          onClick={fetchJoke}
          disabled={loading}
          title="New joke"
          className="p-1 text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 disabled:opacity-40 transition-colors text-base leading-none"
        >
          ↻
        </button>
      </div>
      {loading && (
        <p className="text-sm text-slate-400 dark:text-gray-500 animate-pulse">Loading…</p>
      )}
      {!loading && error && (
        <p className="text-sm text-slate-400 dark:text-gray-500">Couldn't load a joke. Try refreshing.</p>
      )}
      {!loading && !error && joke && (
        <p className="text-sm text-slate-600 dark:text-gray-300 leading-relaxed">{joke}</p>
      )}
    </div>
  )
}
