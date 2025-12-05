// AI モジュールのエントリーポイント
// すべてのレベルでLLM多段階推論AIを使用
import type { GameState, AILevel } from '../types'
import { selectAdvancedLLMMove, isOpenAIConfigured } from '../api/openai'
import { selectBeginnerMove, type AIThinkResult } from './beginner'
import { selectIntermediateMove, selectAdvancedMove } from './intermediate'

export type { AIThinkResult }

/**
 * AIに手を考えさせる
 * OpenAI APIが設定されていれば、全レベルでLLM多段階推論を使用
 * 設定されていなければ従来のアルゴリズムにフォールバック
 */
export async function thinkMove(
  state: GameState,
  level: AILevel
): Promise<AIThinkResult | null> {
  // OpenAI APIが設定されていればLLM多段階推論を使用
  if (isOpenAIConfigured()) {
    try {
      const result = await selectAdvancedLLMMove(state, level)
      if (result) {
        return {
          move: result.move,
          thinking: result.thinking,
          evaluation: result.evaluation,
          strategicAnalysis: result.strategicAnalysis,
        }
      }
    } catch (error) {
      console.warn('LLM AI failed, falling back to traditional AI:', error)
    }
  }

  // フォールバック: 従来のアルゴリズム
  switch (level) {
    case 'beginner':
      const beginnerMove = selectBeginnerMove(state)
      if (!beginnerMove) return null
      return {
        move: beginnerMove,
        thinking: ['駒得を狙いつつ、ランダムに選択'],
        evaluation: 0,
      }
    
    case 'intermediate':
      return selectIntermediateMove(state)
    
    case 'advanced':
    case 'llm':
      return selectAdvancedMove(state)
    
    default:
      return null
  }
}
