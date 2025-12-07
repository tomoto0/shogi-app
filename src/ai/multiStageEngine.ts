// 将棋AI - 多段階推論エンジン
// レベルに応じた真の多段階推論を実装

import type { GameState, Move, AILevel } from '../types'
import { getAllLegalMoves, isInCheck, applyMove, applyDrop } from '../logic/legalMoves'
import { toHandPieceType, addToHand, removeFromHand } from '../logic/board'
import { PIECE_KANJI } from '../types'
import { evaluatePosition, quickEvaluate, getEvaluationText, PIECE_VALUES } from './evaluation'
import { getTopMoves, describeMoves } from './moveRanking'
import { findApplicableJoseki, formatJosekiForPrompt } from './joseki'

// ========================================
// API設定
// ========================================

const OPENAI_API_ENDPOINT = import.meta.env.VITE_OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions'
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || ''

// ========================================
// 型定義
// ========================================

export interface MultiStageResult {
  move: Move
  thinking: string[]
  evaluation: number
  strategicAnalysis: {
    positionAnalysis: string
    threats: string[]
    opportunities: string[]
    plan: string
    reasoning: string
  }
  stages: StageResult[]
}

interface StageResult {
  stageName: string
  description: string
  result: string
  candidateMoves?: string[]
}

interface StrategicMemory {
  openingName: string | null
  currentPlan: string
  longTermGoals: string[]
  recentMoves: { moveNumber: number; move: string; reasoning: string }[]
  threatHistory: string[]
}

// グローバル戦略メモリ
let strategicMemory: StrategicMemory = {
  openingName: null,
  currentPlan: '',
  longTermGoals: [],
  recentMoves: [],
  threatHistory: [],
}

// ========================================
// ユーティリティ関数
// ========================================

function moveToText(move: Move): string {
  if (move.type === 'move') {
    const from = `${move.from.col}${move.from.row}`
    const to = `${move.to.col}${move.to.row}`
    const pieceKanji = PIECE_KANJI[move.piece as keyof typeof PIECE_KANJI] || move.piece
    const captureText = move.captured ? `${PIECE_KANJI[move.captured as keyof typeof PIECE_KANJI] || move.captured}取り` : ''
    const promoteText = move.promote ? '成' : ''
    return `${to}${pieceKanji}${promoteText}${captureText}（${from}から）`
  } else {
    const pieceKanji = PIECE_KANJI[move.piece as keyof typeof PIECE_KANJI] || move.piece
    return `${move.to.col}${move.to.row}${pieceKanji}打`
  }
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

function boardToText(state: GameState): string {
  const { board, hands, currentPlayer, moveCount, gamePhase, isCheck } = state
  let text = ''

  text += `【ゲーム情報】\n`
  text += `手数: ${moveCount}手目\n`
  text += `局面: ${gamePhase === 'opening' ? '序盤' : gamePhase === 'middlegame' ? '中盤' : '終盤'}\n`
  text += `手番: ${currentPlayer === 'sente' ? '先手（▲）' : '後手（△）'}\n`
  if (isCheck) text += `※王手がかかっています\n`
  text += '\n'

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

  text += '\n【持ち駒】\n'
  text += `先手（▲）: ${formatHand(hands.sente)}\n`
  text += `後手（△）: ${formatHand(hands.gote)}\n`

  return text
}

function moveHistoryToText(history: Move[], maxMoves: number = 10): string {
  if (history.length === 0) return 'まだ手が進んでいません。'
  const lines: string[] = []
  const startIdx = Math.max(0, history.length - maxMoves)
  for (let i = startIdx; i < history.length; i++) {
    const move = history[i]
    const player = i % 2 === 0 ? '▲' : '△'
    lines.push(`${i + 1}手目 ${player}${moveToText(move)}`)
  }
  return lines.join('\n')
}

function applyMoveToState(state: GameState, move: Move): GameState {
  const { board, hands, currentPlayer } = state
  const nextPlayer = currentPlayer === 'sente' ? 'gote' : 'sente'

  if (move.type === 'move') {
    const { newBoard, captured } = applyMove(board, move)
    let newHands = { ...hands }
    if (captured) {
      const handPieceType = toHandPieceType(captured.type)
      newHands = {
        ...newHands,
        [currentPlayer]: addToHand(newHands[currentPlayer], handPieceType),
      }
    }
    return { ...state, board: newBoard, hands: newHands, currentPlayer: nextPlayer, moveCount: state.moveCount + 1 }
  } else {
    const newBoard = applyDrop(board, move, currentPlayer)
    const newHands = {
      ...hands,
      [currentPlayer]: removeFromHand(hands[currentPlayer], move.piece),
    }
    return { ...state, board: newBoard, hands: newHands, currentPlayer: nextPlayer, moveCount: state.moveCount + 1 }
  }
}

// ========================================
// OpenAI API呼び出し
// ========================================

async function callOpenAI(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  temperature: number = 0.3
): Promise<string> {
  const response = await fetch(OPENAI_API_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages,
      max_tokens: 2500,
      temperature,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

// ========================================
// ミニマックス法 + 静止探索（Quiescence Search）
// ========================================

interface MinimaxResult {
  score: number
  move: Move | null
  nodesSearched: number
}

/**
 * 静止探索（Quiescence Search）
 * 駒取りが続く限り読み続けることで、読みの途中で評価することを防ぐ
 */
function quiescenceSearch(
  state: GameState,
  alpha: number,
  beta: number,
  maximizing: boolean,
  nodesSearched: { count: number },
  depth: number = 0
): number {
  nodesSearched.count++
  
  // 静止探索の深さ制限（無限ループ防止）
  const MAX_QUIESCENCE_DEPTH = 6
  if (depth >= MAX_QUIESCENCE_DEPTH) {
    return quickEvaluate(state)
  }
  
  // スタンドパット（現在の評価値）
  const standPat = quickEvaluate(state)
  
  if (maximizing) {
    if (standPat >= beta) return beta  // ベータカットオフ
    if (standPat > alpha) alpha = standPat
  } else {
    if (standPat <= alpha) return alpha  // アルファカットオフ
    if (standPat < beta) beta = standPat
  }
  
  // 駒取りの手のみを生成
  const allMoves = getAllLegalMoves(state)
  const captureMoves = allMoves.filter(m => m.type === 'move' && m.captured)
  
  // 駒取りがなければ静止状態
  if (captureMoves.length === 0) {
    return standPat
  }
  
  // 駒取りを価値順にソート（MVV-LVA: Most Valuable Victim - Least Valuable Attacker）
  const sortedCaptures = captureMoves.sort((a, b) => {
    if (a.type !== 'move' || b.type !== 'move') return 0
    const aValue = a.captured ? PIECE_VALUES[a.captured] - PIECE_VALUES[a.piece] * 0.1 : 0
    const bValue = b.captured ? PIECE_VALUES[b.captured] - PIECE_VALUES[b.piece] * 0.1 : 0
    return bValue - aValue
  })
  
  for (const move of sortedCaptures) {
    // デルタ枝刈り：取る駒の価値が低すぎる場合はスキップ
    if (move.type === 'move' && move.captured) {
      const captureValue = PIECE_VALUES[move.captured]
      const DELTA_MARGIN = 200
      if (maximizing && standPat + captureValue + DELTA_MARGIN < alpha) continue
      if (!maximizing && standPat - captureValue - DELTA_MARGIN > beta) continue
    }
    
    const newState = applyMoveToState(state, move)
    const score = quiescenceSearch(newState, alpha, beta, !maximizing, nodesSearched, depth + 1)
    
    if (maximizing) {
      if (score > alpha) alpha = score
      if (alpha >= beta) break
    } else {
      if (score < beta) beta = score
      if (alpha >= beta) break
    }
  }
  
  return maximizing ? alpha : beta
}

function minimax(
  state: GameState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean,
  nodesSearched: { count: number }
): MinimaxResult {
  nodesSearched.count++

  if (depth === 0) {
    // 静止探索を呼び出し
    const score = quiescenceSearch(state, alpha, beta, maximizing, nodesSearched)
    return { score, move: null, nodesSearched: nodesSearched.count }
  }

  const moves = getAllLegalMoves(state)
  if (moves.length === 0) {
    const inCheck = isInCheck(state.board, state.currentPlayer)
    if (inCheck) {
      return { score: maximizing ? -100000 + (5 - depth) * 1000 : 100000 - (5 - depth) * 1000, move: null, nodesSearched: nodesSearched.count }
    }
    return { score: 0, move: null, nodesSearched: nodesSearched.count }
  }

  // 手を並び替え（駒取り、王手、成り優先）
  const sortedMoves = moves.sort((a, b) => {
    let aScore = 0
    let bScore = 0
    
    // 駒取りの価値（MVV-LVA）
    if (a.type === 'move' && a.captured) {
      aScore += PIECE_VALUES[a.captured] * 10 - PIECE_VALUES[a.piece]
    }
    if (b.type === 'move' && b.captured) {
      bScore += PIECE_VALUES[b.captured] * 10 - PIECE_VALUES[b.piece]
    }
    
    // 成りボーナス
    if (a.type === 'move' && a.promote) aScore += 300
    if (b.type === 'move' && b.promote) bScore += 300
    
    return bScore - aScore
  })

  let bestMove: Move | null = null

  if (maximizing) {
    let maxScore = -Infinity
    for (const move of sortedMoves) {
      const newState = applyMoveToState(state, move)
      const result = minimax(newState, depth - 1, alpha, beta, false, nodesSearched)
      if (result.score > maxScore) {
        maxScore = result.score
        bestMove = move
      }
      alpha = Math.max(alpha, result.score)
      if (beta <= alpha) break
    }
    return { score: maxScore, move: bestMove, nodesSearched: nodesSearched.count }
  } else {
    let minScore = Infinity
    for (const move of sortedMoves) {
      const newState = applyMoveToState(state, move)
      const result = minimax(newState, depth - 1, alpha, beta, true, nodesSearched)
      if (result.score < minScore) {
        minScore = result.score
        bestMove = move
      }
      beta = Math.min(beta, result.score)
      if (beta <= alpha) break
    }
    return { score: minScore, move: bestMove, nodesSearched: nodesSearched.count }
  }
}

// ========================================
// 初級AI: シンプルな評価ベース（LLM不使用）
// ========================================

async function selectBeginnerMove(state: GameState): Promise<MultiStageResult> {
  const thinking: string[] = []
  const stages: StageResult[] = []
  
  thinking.push('🔰 初級AI - 評価値ベースの選択')
  
  // ステージ1: 基本評価
  stages.push({
    stageName: '局面評価',
    description: '現在の形勢を確認',
    result: getEvaluationText(quickEvaluate(state))
  })
  
  // ヒューリスティックで候補手をランク付け
  const rankedMoves = getTopMoves(state, 10)
  
  if (rankedMoves.length === 0) {
    throw new Error('合法手がありません')
  }
  
  stages.push({
    stageName: '候補手評価',
    description: '有望な手をリストアップ',
    result: `${rankedMoves.length}手を評価`,
    candidateMoves: describeMoves(rankedMoves, 3)
  })
  
  // 上位3手からランダムに選択（初級らしさ）
  const topMoves = rankedMoves.slice(0, Math.min(3, rankedMoves.length))
  const selected = topMoves[Math.floor(Math.random() * topMoves.length)]
  
  thinking.push(`✅ 決定: ${moveToText(selected.move)}`)
  
  return {
    move: selected.move,
    thinking,
    evaluation: quickEvaluate(state),
    strategicAnalysis: {
      positionAnalysis: getEvaluationText(quickEvaluate(state)),
      threats: [],
      opportunities: [],
      plan: '駒得を狙う',
      reasoning: '評価値に基づく選択',
    },
    stages,
  }
}

// ========================================
// 中級AI: ミニマックス + 簡易LLM（1回呼び出し）
// ========================================

async function selectIntermediateMove(state: GameState): Promise<MultiStageResult> {
  const thinking: string[] = []
  const stages: StageResult[] = []
  
  thinking.push('⭐ 中級AI - ミニマックス法 + LLM補助')
  
  // ステージ1: ミニマックス探索（2手読み）
  thinking.push('📊 ステージ1: 2手先を読んで評価中...')
  const nodesSearched = { count: 0 }
  const isMaximizing = state.currentPlayer === 'sente'
  const minimaxResult = minimax(state, 2, -Infinity, Infinity, isMaximizing, nodesSearched)
  
  stages.push({
    stageName: 'ミニマックス探索',
    description: '2手先まで読んで最善手を探索',
    result: `${nodesSearched.count}局面を評価、スコア: ${minimaxResult.score}`,
  })
  thinking.push(`${nodesSearched.count}局面を評価`)
  
  // ステージ2: 候補手をスコアリング
  thinking.push('🔍 ステージ2: 候補手を評価中...')
  const rankedMoves = getTopMoves(state, 15)
  
  // ミニマックスの最善手を優先
  if (minimaxResult.move) {
    const minimaxIndex = rankedMoves.findIndex(m => 
      JSON.stringify(m.move) === JSON.stringify(minimaxResult.move)
    )
    if (minimaxIndex > 0) {
      const [best] = rankedMoves.splice(minimaxIndex, 1)
      best.score += 500
      rankedMoves.unshift(best)
    }
  }
  
  stages.push({
    stageName: '候補手評価',
    description: 'ヒューリスティックでスコアリング',
    result: `上位${Math.min(5, rankedMoves.length)}手を選出`,
    candidateMoves: describeMoves(rankedMoves, 5)
  })
  
  // ステージ3: LLMで最終選択（APIが利用可能な場合）
  let selectedMove = rankedMoves[0]
  let reasoning = 'ミニマックス評価に基づく選択'
  
  if (OPENAI_API_KEY) {
    thinking.push('🎯 ステージ3: LLMで最終判断...')
    
    try {
      const candidateText = rankedMoves.slice(0, 8).map((c, i) =>
        `${i + 1}. ${moveToText(c.move)} [スコア: ${c.score}] ${c.features.join(', ')}`
      ).join('\n')
      
      const response = await callOpenAI([
        {
          role: 'system',
          content: `あなたは将棋AIです。候補手から最善の一手を選んでください。
JSON形式で回答: {"selectedIndex": 番号, "reason": "簡潔な理由"}`
        },
        {
          role: 'user',
          content: `${boardToText(state)}

【候補手】
${candidateText}

最善手を選んでください。`
        }
      ], 0.3)
      
      const jsonMatch = response.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const index = (parsed.selectedIndex || 1) - 1
        if (index >= 0 && index < rankedMoves.length) {
          selectedMove = rankedMoves[index]
          reasoning = parsed.reason || reasoning
        }
      }
      
      stages.push({
        stageName: 'LLM最終選択',
        description: 'GPT-4oで最善手を決定',
        result: reasoning,
      })
    } catch (e) {
      console.warn('Intermediate LLM failed:', e)
      stages.push({
        stageName: 'LLM最終選択',
        description: 'API呼び出し失敗、評価値で選択',
        result: 'フォールバック',
      })
    }
  }
  
  thinking.push(`✅ 決定: ${moveToText(selectedMove.move)}`)
  thinking.push(`💭 理由: ${reasoning}`)
  
  return {
    move: selectedMove.move,
    thinking,
    evaluation: minimaxResult.score,
    strategicAnalysis: {
      positionAnalysis: getEvaluationText(minimaxResult.score),
      threats: [],
      opportunities: [],
      plan: reasoning,
      reasoning,
    },
    stages,
  }
}

// ========================================
// 上級AI: 3段階推論 + CoT
// ========================================

async function selectAdvancedMove(state: GameState): Promise<MultiStageResult> {
  const thinking: string[] = []
  const stages: StageResult[] = []
  
  thinking.push('💪 上級AI - 3段階戦略推論')
  
  // ステージ1: 深いミニマックス探索（3手読み）
  thinking.push('📊 ステージ1: 3手先を読んで評価中...')
  const nodesSearched = { count: 0 }
  const isMaximizing = state.currentPlayer === 'sente'
  const minimaxResult = minimax(state, 3, -Infinity, Infinity, isMaximizing, nodesSearched)
  
  stages.push({
    stageName: 'ミニマックス探索',
    description: '3手先まで深く読んで最善手を探索',
    result: `${nodesSearched.count}局面を評価、スコア: ${minimaxResult.score}`,
  })
  thinking.push(`${nodesSearched.count}局面を評価`)
  
  // ステージ2: LLMで局面分析
  thinking.push('🔍 ステージ2: 局面を戦略的に分析...')
  let positionAnalysis = { analysis: '', threats: [] as string[], opportunities: [] as string[] }
  
  if (OPENAI_API_KEY) {
    try {
      const response = await callOpenAI([
        {
          role: 'system',
          content: `あなたは将棋のプロ棋士です。局面を分析してJSON形式で回答:
{
  "analysis": "局面の評価（50字以内）",
  "threats": ["相手の狙い1", "狙い2"],
  "opportunities": ["チャンス1", "チャンス2"]
}`
        },
        {
          role: 'user',
          content: `${boardToText(state)}

【直近の手】
${moveHistoryToText(state.moveHistory, 5)}`
        }
      ], 0.3)
      
      const jsonMatch = response.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        positionAnalysis = JSON.parse(jsonMatch[0])
      }
    } catch (e) {
      console.warn('Position analysis failed:', e)
    }
  }
  
  stages.push({
    stageName: '局面分析',
    description: 'LLMで戦略的に局面を評価',
    result: positionAnalysis.analysis || '分析完了',
  })
  thinking.push(`分析: ${positionAnalysis.analysis || '分析完了'}`)
  
  // ステージ3: 候補手評価 + 最終選択
  thinking.push('🎯 ステージ3: 最善手を決定...')
  const rankedMoves = getTopMoves(state, 20)
  
  // ミニマックスの最善手を優先
  if (minimaxResult.move) {
    const minimaxIndex = rankedMoves.findIndex(m => 
      JSON.stringify(m.move) === JSON.stringify(minimaxResult.move)
    )
    if (minimaxIndex > 0) {
      const [best] = rankedMoves.splice(minimaxIndex, 1)
      best.score += 800
      rankedMoves.unshift(best)
    }
  }
  
  let selectedMove = rankedMoves[0]
  let reasoning = 'ミニマックス評価に基づく選択'
  
  if (OPENAI_API_KEY) {
    try {
      const candidateText = rankedMoves.slice(0, 10).map((c, i) =>
        `${i + 1}. ${moveToText(c.move)} [スコア: ${c.score}] ${c.features.join(', ')}`
      ).join('\n')
      
      const response = await callOpenAI([
        {
          role: 'system',
          content: `あなたは将棋のプロ棋士です。3手先までの読みを含めて最善手を選んでください。

JSON形式で回答:
{
  "selectedIndex": 番号,
  "reasoning": "3手先までの読み筋を含む理由",
  "plan": "今後の方針"
}`
        },
        {
          role: 'user',
          content: `${boardToText(state)}

【局面分析】
${positionAnalysis.analysis}
警戒: ${positionAnalysis.threats.join('、') || 'なし'}
狙い: ${positionAnalysis.opportunities.join('、') || 'なし'}

【候補手】
${candidateText}

3手先までの読みを含めて最善手を選んでください。`
        }
      ], 0.2)
      
      const jsonMatch = response.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const index = (parsed.selectedIndex || 1) - 1
        if (index >= 0 && index < rankedMoves.length) {
          selectedMove = rankedMoves[index]
          reasoning = parsed.reasoning || reasoning
          
          // 戦略メモリ更新
          strategicMemory.currentPlan = parsed.plan || ''
        }
      }
    } catch (e) {
      console.warn('Final selection failed:', e)
    }
  }
  
  stages.push({
    stageName: '最終選択',
    description: 'LLMで3手先の読みを含めて決定',
    result: reasoning.slice(0, 50) + '...',
    candidateMoves: describeMoves(rankedMoves, 3)
  })
  
  thinking.push(`✅ 決定: ${moveToText(selectedMove.move)}`)
  thinking.push(`💭 読み: ${reasoning.slice(0, 80)}...`)
  
  // 戦略メモリに記録
  strategicMemory.recentMoves.push({
    moveNumber: state.moveCount + 1,
    move: moveToText(selectedMove.move),
    reasoning: reasoning.slice(0, 100)
  })
  if (strategicMemory.recentMoves.length > 10) {
    strategicMemory.recentMoves.shift()
  }
  
  return {
    move: selectedMove.move,
    thinking,
    evaluation: minimaxResult.score,
    strategicAnalysis: {
      positionAnalysis: positionAnalysis.analysis,
      threats: positionAnalysis.threats,
      opportunities: positionAnalysis.opportunities,
      plan: strategicMemory.currentPlan,
      reasoning,
    },
    stages,
  }
}

// ========================================
// 最強AI: 完全な4段階推論
// ========================================

async function selectLLMMove(state: GameState): Promise<MultiStageResult> {
  const thinking: string[] = []
  const stages: StageResult[] = []
  
  thinking.push('🤖 最強LLM AI - 4段階戦略推論')
  
  // ========== ステージ1: 深い局面分析 ==========
  thinking.push('📊 ステージ1: 局面を多角的に分析...')
  
  const evaluation = evaluatePosition(state)
  let positionAnalysis = {
    analysis: getEvaluationText(evaluation.score),
    threats: [] as string[],
    opportunities: [] as string[],
    recommendedStrategy: '',
    kingSafety: { sente: '', gote: '' },
  }
  
  if (OPENAI_API_KEY) {
    try {
      const response = await callOpenAI([
        {
          role: 'system',
          content: `あなたは将棋のプロ棋士です。局面を多角的に分析してJSON形式で回答:
{
  "analysis": "局面の総合評価（80字以内）",
  "threats": ["相手の具体的な狙い1", "狙い2", "狙い3"],
  "opportunities": ["自分のチャンス1", "チャンス2", "チャンス3"],
  "kingSafety": {"sente": "先手玉の評価", "gote": "後手玉の評価"},
  "recommendedStrategy": "推奨戦略"
}`
        },
        {
          role: 'user',
          content: `${boardToText(state)}

【評価値内訳】
駒得: ${evaluation.breakdown.material}
位置: ${evaluation.breakdown.position}
玉の安全度: 先手${evaluation.breakdown.kingSafety.sente} / 後手${evaluation.breakdown.kingSafety.gote}
駒の働き: 先手${evaluation.breakdown.activity.sente} / 後手${evaluation.breakdown.activity.gote}

【直近の棋譜】
${moveHistoryToText(state.moveHistory, 10)}

【これまでの戦略】
${strategicMemory.currentPlan || 'なし'}
${strategicMemory.recentMoves.slice(-3).map(m => `${m.moveNumber}手目: ${m.move}`).join('\n')}`
        }
      ], 0.3)
      
      const jsonMatch = response.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        positionAnalysis = { ...positionAnalysis, ...parsed }
      }
    } catch (e) {
      console.warn('Deep analysis failed:', e)
    }
  }
  
  stages.push({
    stageName: '深い局面分析',
    description: '駒の配置、玉の安全度、攻防態勢を多角的に分析',
    result: positionAnalysis.analysis,
  })
  thinking.push(`分析: ${positionAnalysis.analysis}`)
  if (positionAnalysis.threats.length > 0) {
    thinking.push(`⚠️ 警戒: ${positionAnalysis.threats.slice(0, 2).join('、')}`)
  }
  
  // ========== ステージ2: 定石・戦略コンテキスト ==========
  thinking.push('📚 ステージ2: 定石と戦略コンテキストを参照...')
  
  let josekiInfo = ''
  if (state.moveCount < 25 && state.gamePhase === 'opening') {
    const moveStrings = state.moveHistory.map(m => moveToText(m))
    const applicableJoseki = findApplicableJoseki(moveStrings)
    josekiInfo = formatJosekiForPrompt(applicableJoseki, 3)
    
    if (applicableJoseki.length > 0 && !strategicMemory.openingName) {
      strategicMemory.openingName = applicableJoseki[0].name
      strategicMemory.longTermGoals = applicableJoseki[0].strategicGoals
    }
    
    thinking.push(`参考戦法: ${applicableJoseki.slice(0, 3).map(j => j.name).join('、')}`)
  } else {
    thinking.push('中終盤のため具体的な読みを重視')
  }
  
  stages.push({
    stageName: '定石・戦略参照',
    description: '定石データベースと戦略コンテキストを活用',
    result: strategicMemory.openingName || '中終盤の読み重視',
  })
  
  // ========== ステージ3: ミニマックス + 候補手評価 ==========
  thinking.push('🔍 ステージ3: 4手先を読んで候補手を評価...')
  
  const nodesSearched = { count: 0 }
  const isMaximizing = state.currentPlayer === 'sente'
  const minimaxResult = minimax(state, 4, -Infinity, Infinity, isMaximizing, nodesSearched)
  thinking.push(`${nodesSearched.count}局面を探索`)
  
  // ヒューリスティックで候補手をスコアリング
  const rankedMoves = getTopMoves(state, 25)
  
  // ミニマックスの最善手を優先
  if (minimaxResult.move) {
    const minimaxIndex = rankedMoves.findIndex(m => 
      JSON.stringify(m.move) === JSON.stringify(minimaxResult.move)
    )
    if (minimaxIndex >= 0) {
      rankedMoves[minimaxIndex].score += 1000
      rankedMoves[minimaxIndex].features.push('ミニマックス推奨')
    }
  }
  
  // 再ソート
  rankedMoves.sort((a, b) => b.score - a.score)
  
  stages.push({
    stageName: 'ミニマックス探索',
    description: '4手先まで読んで候補手を深く評価',
    result: `${nodesSearched.count}局面を評価、上位${Math.min(15, rankedMoves.length)}手を選出`,
    candidateMoves: describeMoves(rankedMoves, 5)
  })
  
  // ========== ステージ4: LLMによる最終選択（5手読み） ==========
  thinking.push('🎯 ステージ4: GPT-4oが5手先の読みで最善手を決定...')
  
  let selectedMove = rankedMoves[0]
  let reasoning = 'ミニマックス評価に基づく選択'
  let plan = strategicMemory.currentPlan
  
  if (OPENAI_API_KEY) {
    try {
      const candidateText = rankedMoves.slice(0, 15).map((c, i) =>
        `${i + 1}. ${moveToText(c.move)} [評価: ${c.score}] ${c.features.join(', ')}`
      ).join('\n')
      
      const response = await callOpenAI([
        {
          role: 'system',
          content: `あなたは将棋のプロ棋士です。5手先までの読みを含めて、戦略的に最善手を選びます。

【思考プロセス】
1. 局面の特徴を把握（攻め時か守り時か）
2. 相手の狙いを読む
3. 各候補手について5手先までの読み筋を検討
4. 長期的な勝ち筋に最も近づく手を選択

【判断基準】
- 終盤は速度重視
- 序盤は駒の働きと囲い
- 駒得よりも玉の安全を優先することもある

JSON形式で回答:
{
  "selectedIndex": 候補番号,
  "reasoning": "5手先までの具体的な読み筋（例：この手に対し相手は○○、それに△△...）",
  "plan": "今後3手の方針",
  "longTermGoal": "この一局での勝ち筋"
}`
        },
        {
          role: 'user',
          content: `${boardToText(state)}

【深い局面分析】
${positionAnalysis.analysis}

玉の安全度:
- 先手: ${positionAnalysis.kingSafety?.sente || '不明'}
- 後手: ${positionAnalysis.kingSafety?.gote || '不明'}

【警戒すべき点】
${positionAnalysis.threats.map((t, i) => `${i + 1}. ${t}`).join('\n') || 'なし'}

【狙い目】
${positionAnalysis.opportunities.map((o, i) => `${i + 1}. ${o}`).join('\n') || 'なし'}

【推奨戦略】
${positionAnalysis.recommendedStrategy || 'なし'}

【定石情報】
${josekiInfo || '中終盤のため省略'}

【これまでの戦略】
採用戦法: ${strategicMemory.openingName || 'なし'}
現在の方針: ${strategicMemory.currentPlan || 'なし'}
直近の手:
${strategicMemory.recentMoves.slice(-5).map(m => `${m.moveNumber}手目: ${m.move} - ${m.reasoning.slice(0, 30)}...`).join('\n') || 'なし'}

【候補手一覧（評価値順）】
${candidateText}

5手先までの読みを含めて、戦略的に最善手を選んでください。`
        }
      ], 0.15)
      
      const jsonMatch = response.match(/\{[\s\S]*?\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        const index = (parsed.selectedIndex || 1) - 1
        
        if (index >= 0 && index < rankedMoves.length) {
          selectedMove = rankedMoves[index]
          reasoning = parsed.reasoning || reasoning
          plan = parsed.plan || plan
          
          // 戦略メモリ更新
          strategicMemory.currentPlan = plan
          if (parsed.longTermGoal) {
            strategicMemory.longTermGoals = [parsed.longTermGoal]
          }
        }
      }
    } catch (e) {
      console.warn('Final LLM selection failed:', e)
      stages.push({
        stageName: 'LLM最終選択',
        description: 'API呼び出し失敗、評価値で選択',
        result: 'フォールバック',
      })
    }
  }
  
  stages.push({
    stageName: 'LLM最終選択',
    description: 'GPT-4oで5手先の読みを含めて決定',
    result: reasoning.slice(0, 60) + '...',
  })
  
  thinking.push(`✅ 決定: ${moveToText(selectedMove.move)}`)
  thinking.push(`💭 読み: ${reasoning.slice(0, 100)}...`)
  if (plan) {
    thinking.push(`📋 方針: ${plan}`)
  }
  
  // 戦略メモリに記録
  strategicMemory.recentMoves.push({
    moveNumber: state.moveCount + 1,
    move: moveToText(selectedMove.move),
    reasoning: reasoning.slice(0, 100)
  })
  if (strategicMemory.recentMoves.length > 15) {
    strategicMemory.recentMoves.shift()
  }
  strategicMemory.threatHistory = positionAnalysis.threats
  
  return {
    move: selectedMove.move,
    thinking,
    evaluation: minimaxResult.score,
    strategicAnalysis: {
      positionAnalysis: positionAnalysis.analysis,
      threats: positionAnalysis.threats,
      opportunities: positionAnalysis.opportunities,
      plan,
      reasoning,
    },
    stages,
  }
}

// ========================================
// メインエントリーポイント
// ========================================

/**
 * レベルに応じた多段階推論AIの手を選択
 */
export async function selectMultiStageMove(state: GameState, level: AILevel): Promise<MultiStageResult | null> {
  const legalMoves = getAllLegalMoves(state)
  if (legalMoves.length === 0) return null

  switch (level) {
    case 'beginner':
      return selectBeginnerMove(state)
    case 'intermediate':
      return selectIntermediateMove(state)
    case 'advanced':
      return selectAdvancedMove(state)
    case 'llm':
    default:
      return selectLLMMove(state)
  }
}

/**
 * 戦略メモリをリセット
 */
export function resetStrategicMemory(): void {
  strategicMemory = {
    openingName: null,
    currentPlan: '',
    longTermGoals: [],
    recentMoves: [],
    threatHistory: [],
  }
}

/**
 * API設定確認
 */
export function isLLMConfigured(): boolean {
  return OPENAI_API_KEY.length > 0
}
