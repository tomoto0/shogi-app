/**
 * ゲーム履歴管理Hook（Undo/Redo機能）
 */
import { useState, useCallback } from 'react'
import type { GameState } from '../types'

interface GameHistoryState {
  past: GameState[]
  present: GameState
  future: GameState[]
}

interface UseGameHistoryReturn {
  gameState: GameState
  setGameState: (state: GameState) => void
  undo: () => void
  undoTwice: () => void  // 2手戻す（待った用）
  redo: () => void
  canUndo: boolean
  canUndoTwice: boolean  // 2手以上戻せるか
  canRedo: boolean
  undoCount: number
  reset: (initialState: GameState) => void
}

/**
 * ゲーム履歴を管理し、Undo/Redo機能を提供するHook
 */
export function useGameHistory(initialState: GameState): UseGameHistoryReturn {
  const [history, setHistory] = useState<GameHistoryState>({
    past: [],
    present: initialState,
    future: [],
  })

  // ゲーム状態を更新（履歴に追加）
  const setGameState = useCallback((newState: GameState) => {
    setHistory(prev => ({
      past: [...prev.past, prev.present],
      present: newState,
      future: [], // 新しい手を打ったら、未来の履歴をクリア
    }))
  }, [])

  // 1手戻す
  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev

      const newPast = [...prev.past]
      const previousState = newPast.pop()!

      return {
        past: newPast,
        present: previousState,
        future: [prev.present, ...prev.future],
      }
    })
  }, [])

  // 2手戻す（待った用：自分の手 + 相手の手を戻す）
  const undoTwice = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length < 2) return prev

      const newPast = [...prev.past]
      const state1 = newPast.pop()!  // 相手の手を戻す
      const state2 = newPast.pop()!  // 自分の手を戻す

      return {
        past: newPast,
        present: state2,
        future: [state1, prev.present, ...prev.future],
      }
    })
  }, [])

  // 1手進める（待ったをキャンセル）
  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev

      const newFuture = [...prev.future]
      const nextState = newFuture.shift()!

      return {
        past: [...prev.past, prev.present],
        present: nextState,
        future: newFuture,
      }
    })
  }, [])

  // 履歴をリセット
  const reset = useCallback((newInitialState: GameState) => {
    setHistory({
      past: [],
      present: newInitialState,
      future: [],
    })
  }, [])

  return {
    gameState: history.present,
    setGameState,
    undo,
    undoTwice,
    redo,
    canUndo: history.past.length > 0,
    canUndoTwice: history.past.length >= 2,
    canRedo: history.future.length > 0,
    undoCount: history.past.length,
    reset,
  }
}

export default useGameHistory
