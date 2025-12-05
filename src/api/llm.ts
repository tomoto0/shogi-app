// LLM AI統合モジュール
// OpenAI GPT-4o を使用した高度な将棋AI

import type { GameState, Move, Column, Row } from '../types'
import { getAllLegalMoves } from '../logic/legalMoves'
import { PIECE_KANJI } from '../types'
import { selectAdvancedLLMMove, isOpenAIConfigured, resetStrategicContext } from './openai'

// ========================================
// API設定
// ========================================

// レガシーAPI（フォールバック用）
const LEGACY_API_ENDPOINT = import.meta.env.VITE_MANUS_API_ENDPOINT || '/api/llm'

// 高度なLLM AIを使用するかどうか
const USE_ADVANCED_LLM = import.meta.env.VITE_USE_ADVANCED_LLM !== 'false'

// ========================================
// 盤面を日本語テキストで表現
// ========================================

function boardToText(state: GameState): string {
  const { board, hands, currentPlayer } = state
  let text = ''
  
  // 盤面
  text += '【現在の盤面】\n'
  text += '　　９　８　７　６　５　４　３　２　１\n'
  text += '　┌──┬──┬──┬──┬──┬──┬──┬──┬──┐\n'
  
  for (let row = 0; row < 9; row++) {
    text += `${row + 1}│`
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col]
      if (piece) {
        const kanji = PIECE_KANJI[piece.type] || piece.type
        const owner = piece.owner === 'sente' ? '▲' : '△'
        text += `${owner}${kanji}│`
      } else {
        text += '　　│'
      }
    }
    text += '\n'
    if (row < 8) {
      text += '　├──┼──┼──┼──┼──┼──┼──┼──┼──┤\n'
    }
  }
  text += '　└──┴──┴──┴──┴──┴──┴──┴──┴──┘\n'
  
  // 持ち駒
  text += '\n【持ち駒】\n'
  text += `先手（▲）: ${formatHand(hands.sente)}\n`
  text += `後手（△）: ${formatHand(hands.gote)}\n`
  
  // 手番
  text += `\n【手番】${currentPlayer === 'sente' ? '先手（▲）' : '後手（△）'}\n`
  
  return text
}

function formatHand(hand: { [key: string]: number }): string {
  const pieces: string[] = []
  const order = ['rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn']
  
  for (const type of order) {
    const count = hand[type as keyof typeof hand]
    if (count > 0) {
      const kanji = PIECE_KANJI[type as keyof typeof PIECE_KANJI] || type
      pieces.push(`${kanji}${count > 1 ? `×${count}` : ''}`)
    }
  }
  
  return pieces.length > 0 ? pieces.join(' ') : 'なし'
}

// ========================================
// 合法手をテキストで表現
// ========================================

function movesToText(moves: Move[]): string {
  const moveTexts: string[] = []
  let index = 1
  
  for (const move of moves.slice(0, 30)) { // 最大30手まで表示
    if (move.type === 'move') {
      const from = `${move.from.col}${move.from.row}`
      const to = `${move.to.col}${move.to.row}`
      const pieceKanji = PIECE_KANJI[move.piece as keyof typeof PIECE_KANJI] || move.piece
      const captureText = move.captured ? `（${PIECE_KANJI[move.captured as keyof typeof PIECE_KANJI] || move.captured}を取る）` : ''
      moveTexts.push(`${index}. ${from}${pieceKanji}→${to}${captureText}`)
    } else {
      const pieceKanji = PIECE_KANJI[move.piece as keyof typeof PIECE_KANJI] || move.piece
      moveTexts.push(`${index}. ${move.to.col}${move.to.row}${pieceKanji}打`)
    }
    index++
  }
  
  if (moves.length > 30) {
    moveTexts.push(`... 他${moves.length - 30}手`)
  }
  
  return moveTexts.join('\n')
}

// ========================================
// LLM応答から手を解析
// ========================================

function parseMove(response: string, legalMoves: Move[]): Move | null {
  // 応答から座標や駒の情報を抽出
  const text = response.toLowerCase()
  
  // 数字のマッチを試みる
  const numbers = text.match(/\d/g)
  if (numbers && numbers.length >= 2) {
    const col = parseInt(numbers[0]) as Column
    const row = parseInt(numbers[1]) as Row
    
    // マッチする合法手を探す
    for (const move of legalMoves) {
      if (move.type === 'move' && move.to.col === col && move.to.row === row) {
        return move
      }
      if (move.type === 'drop' && move.to.col === col && move.to.row === row) {
        return move
      }
    }
  }
  
  // 候補番号での指定 "1番" "候補1"
  const indexMatch = text.match(/(?:候補|番号?|選択)?(\d+)/);
  if (indexMatch) {
    const index = parseInt(indexMatch[1]) - 1
    if (index >= 0 && index < legalMoves.length) {
      return legalMoves[index]
    }
  }
  
  return null
}

// ========================================
// Manus LLM API呼び出し
// ========================================

interface LLMResponse {
  move: Move | null
  thinking: string[]
  rawResponse: string
}

export async function callManusLLM(state: GameState): Promise<LLMResponse> {
  const thinking: string[] = []
  const legalMoves = getAllLegalMoves(state)
  
  if (legalMoves.length === 0) {
    return {
      move: null,
      thinking: ['合法手がありません'],
      rawResponse: '',
    }
  }
  
  // プロンプトを構築
  const prompt = `あなたは将棋のプロ棋士です。以下の局面で最善手を選んでください。

${boardToText(state)}

【合法手一覧】
${movesToText(legalMoves)}

上記の合法手の中から、最も良いと思う手を1つだけ選んでください。
回答は「候補番号」と「その理由」を簡潔に述べてください。
例: 「候補5。相手の飛車を取れるため。」`

  thinking.push('LLM APIに局面を送信中...')
  
  try {
    const response = await fetch(LEGACY_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'あなたは将棋のプロ棋士です。局面を分析し、最善手を選んでください。'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 500,
        temperature: 0.3,
      }),
    })
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`)
    }
    
    const data = await response.json()
    const llmResponse = data.choices?.[0]?.message?.content || ''
    
    thinking.push('LLM応答を解析中...')
    thinking.push(`AI: ${llmResponse.slice(0, 100)}${llmResponse.length > 100 ? '...' : ''}`)
    
    // 応答から手を解析
    const selectedMove = parseMove(llmResponse, legalMoves)
    
    if (selectedMove) {
      thinking.push('手を決定しました')
      return {
        move: selectedMove,
        thinking,
        rawResponse: llmResponse,
      }
    } else {
      // 解析失敗時はランダムに選択
      thinking.push('応答の解析に失敗、ランダムに選択します')
      return {
        move: legalMoves[Math.floor(Math.random() * legalMoves.length)],
        thinking,
        rawResponse: llmResponse,
      }
    }
  } catch (error) {
    thinking.push(`APIエラー: ${error}`)
    // エラー時はランダムに選択
    return {
      move: legalMoves[Math.floor(Math.random() * legalMoves.length)],
      thinking,
      rawResponse: '',
    }
  }
}

// ========================================
// LLM AI用のエントリーポイント
// ========================================

export interface LLMAIResult {
  move: Move
  thinking: string[]
  evaluation: number
  strategicAnalysis?: {
    positionAnalysis: string
    threats: string[]
    opportunities: string[]
    plan: string
    reasoning: string
  }
}

/**
 * LLM AIの手を選択
 * OpenAI APIが設定されていれば高度な多段階推論を使用
 * そうでなければレガシーAPIにフォールバック
 */
export async function selectLLMMove(state: GameState): Promise<LLMAIResult | null> {
  // 高度なLLM AIを試みる
  if (USE_ADVANCED_LLM && isOpenAIConfigured()) {
    try {
      const advancedResult = await selectAdvancedLLMMove(state)
      if (advancedResult) {
        return {
          move: advancedResult.move,
          thinking: advancedResult.thinking,
          evaluation: advancedResult.evaluation,
          strategicAnalysis: advancedResult.strategicAnalysis,
        }
      }
    } catch (error) {
      console.warn('Advanced LLM failed, falling back to legacy:', error)
    }
  }

  // レガシーAPIにフォールバック
  const result = await callManusLLM(state)
  
  if (!result.move) {
    return null
  }
  
  return {
    move: result.move,
    thinking: result.thinking,
    evaluation: 0,
  }
}

/**
 * LLM AIの戦略コンテキストをリセット
 * 新しいゲーム開始時に呼び出す
 */
export function resetLLMContext(): void {
  resetStrategicContext()
}

/**
 * OpenAI APIが設定されているか確認
 */
export function isLLMConfigured(): boolean {
  return isOpenAIConfigured()
}
