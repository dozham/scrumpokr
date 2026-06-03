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

interface JokeBoxProps {
  joke?: Joke | null
  onRefresh?: () => void
}

export function JokeBox({ joke: controlledJoke, onRefresh }: JokeBoxProps = {}) {
  const controlled = onRefresh !== undefined

  const [standaloneJoke, setStandaloneJoke] = useState<Joke | null>(null)
  const [standaloneLoading, setStandaloneLoading] = useState(true)
  const [standaloneError, setStandaloneError] = useState(false)
  const [revealedForQuestion, setRevealedForQuestion] = useState<string | null>(null)

  const [pendingRefresh, setPendingRefresh] = useState(false)
  const [prevControlledJoke, setPrevControlledJoke] = useState<Joke | null | undefined>(controlledJoke)

  // Derived state: clear pendingRefresh when controlledJoke changes
  if (controlled && prevControlledJoke !== controlledJoke) {
    setPrevControlledJoke(controlledJoke)
    if (pendingRefresh) setPendingRefresh(false)
  }

  useEffect(() => {
    if (controlled) return
    const controller = new AbortController()
    loadJoke(controller.signal)
      .then(j => setStandaloneJoke(j))
      .catch((e: unknown) => {
        if ((e as { name?: string }).name !== 'AbortError') setStandaloneError(true)
      })
      .finally(() => setStandaloneLoading(false))
    return () => controller.abort()
  }, [controlled])

  async function handleStandaloneRefresh() {
    setStandaloneLoading(true)
    setStandaloneError(false)
    setRevealedForQuestion(null)
    try {
      setStandaloneJoke(await loadJoke())
    } catch {
      setStandaloneError(true)
    } finally {
      setStandaloneLoading(false)
    }
  }

  const joke = controlled ? (controlledJoke ?? null) : standaloneJoke
  const loading = controlled ? pendingRefresh : standaloneLoading
  const error = controlled ? false : standaloneError
  const handleRefresh = controlled
    ? () => { setPendingRefresh(true); onRefresh!() }
    : handleStandaloneRefresh
  const revealed = joke != null && revealedForQuestion === joke.question

  return (
    <div className="w-full p-6 bg-white dark:bg-gray-900 rounded-2xl shadow border border-sky-100 dark:border-gray-800 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400 dark:text-gray-500">Joke&apos;s on me</span>
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
      {!loading && !error && !joke && (
        <p className="text-sm text-slate-400 dark:text-gray-500">No joke loaded yet.</p>
      )}
      {!loading && !error && joke && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-slate-600 dark:text-gray-300 leading-relaxed">{joke.question}</p>
          {revealed ? (
            <p className="text-sm text-slate-500 dark:text-gray-400 italic leading-relaxed">{joke.answer}</p>
          ) : (
            <button
              type="button"
              onClick={() => setRevealedForQuestion(joke.question)}
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
