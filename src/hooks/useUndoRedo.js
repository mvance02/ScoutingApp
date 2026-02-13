import { useState, useCallback, useRef } from 'react'

const MAX_HISTORY = 50

export function useUndoRedo(initialState) {
  const [state, setState] = useState(initialState)
  const historyRef = useRef([])
  const futureRef = useRef([])

  const pushState = useCallback((newState) => {
    historyRef.current = [...historyRef.current.slice(-MAX_HISTORY + 1), state]
    futureRef.current = []
    setState(newState)
  }, [state])

  const undo = useCallback(() => {
    if (historyRef.current.length === 0) return

    const previous = historyRef.current[historyRef.current.length - 1]
    historyRef.current = historyRef.current.slice(0, -1)
    futureRef.current = [state, ...futureRef.current]
    setState(previous)
  }, [state])

  const redo = useCallback(() => {
    if (futureRef.current.length === 0) return

    const next = futureRef.current[0]
    futureRef.current = futureRef.current.slice(1)
    historyRef.current = [...historyRef.current, state]
    setState(next)
  }, [state])

  const setWithoutHistory = useCallback((newState) => {
    setState(newState)
  }, [])

  const clearHistory = useCallback(() => {
    historyRef.current = []
    futureRef.current = []
  }, [])

  return {
    state,
    setState: pushState,
    setWithoutHistory,
    undo,
    redo,
    canUndo: historyRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    clearHistory,
    historyLength: historyRef.current.length,
    futureLength: futureRef.current.length,
  }
}

export default useUndoRedo
