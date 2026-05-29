'use client'

import { useState, useEffect } from 'react'

type Joke = { question: string; answer: string }

async function loadJoke(signal?: AbortSignal): Promise<Joke> {
  const res = await fetch('https://teehee.dev/api/joke', {
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!res.ok) throw new Error()
  const data = await res.json()
  if (typeof data.question !== 'string' || typeof data.answer !== 'string') throw new Error()
  return { question: data.question, answer: data.answer }
}

export function JokeBox() {
  const [joke, setJoke] = useState<Joke | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    loadJoke(controller.signal).then(j => { setJoke(j); setRevealed(false) }).catch((e: unknown) => {
      if ((e as { name?: string }).name !== 'AbortError') setError(true)
    }).finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  async function handleRefresh() {
    setLoading(true)
    setError(false)
    setRevealed(false)
    try {
      setJoke(await loadJoke())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="w-full max-w-xs p-6 bg-white dark:bg-gray-900 rounded-2xl shadow border border-sky-100 dark:border-gray-800 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-gray-500">😄 Joke of the moment</span>
        <button
          type="button"
          onClick={handleRefresh}
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
        <p className="text-sm text-slate-400 dark:text-gray-500">Couldn&apos;t load a joke. Try refreshing.</p>
      )}
      {!loading && !error && joke && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-gray-300 leading-relaxed">{joke.question}</p>
          {revealed ? (
            <p className="text-sm text-slate-500 dark:text-gray-400 italic leading-relaxed">{joke.answer}</p>
          ) : (
            <button
              type="button"
              onClick={() => setRevealed(true)}
              className="self-start text-xs text-slate-400 dark:text-gray-500 hover:text-slate-600 dark:hover:text-gray-300 underline underline-offset-2 transition-colors"
            >
              reveal answer
            </button>
          )}
        </div>
      )}
    </div>
  )
}
