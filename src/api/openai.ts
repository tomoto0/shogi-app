// OpenAI GPT-4o API クライアント
// 多段階戦略的推論による将棋AI
// レベルに応じて推論の深さと複雑さが進化

import type { GameState, Move, AllPieceType, AILevel } from '../types'
import { getAllLegalMoves, isInCheck, applyMove, applyDrop } from '../logic/legalMoves'
import { toHandPieceType, addToHand, removeFromHand } from '../logic/board'
import { PIECE_KANJI } from '../types'

// ========================================
// API設定
// ========================================

const OPENAI_API_ENDPOINT = import.meta.env.VITE_OPENAI_API_ENDPOINT || 'https://api.openai.com/v1/chat/completions'
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || ''

// ========================================
// 型定義
// ========================================

interface ThinkingHistory {
  moveNumber: number
  position: string
  analysis: string
  selectedMove: string
  reasoning: string
  strategicGoals: string[]
  evaluation: number
}

interface StrategicContext {
  openingName: string | null
  currentPlan: string
  longTermGoals: string[]
  threats: string[]
  opportunities: string[]
  previousAnalyses: ThinkingHistory[]
}

export interface AdvancedLLMResult {
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
}

// ========================================
// グローバル戦略コンテキスト
// ========================================

let strategicContext: StrategicContext = {
  openingName: null,
  currentPlan: '',
  longTermGoals: [],
  threats: [],
  opportunities: [],
  previousAnalyses: [],
}

// ========================================
// 定石データベース
// ========================================

interface JosekiEntry {
  name: string
  moves: string[]
  description: string
  strategicGoals: string[]
  keyPositions: string[]
}

const JOSEKI_DATABASE: JosekiEntry[] = [
  {
    name: '居飛車',
    moves: ['76歩', '26歩', '25歩', '24歩'],
    description: '飛車を初期位置のまま使う基本戦法。直線的な攻撃力が高い。',
    strategicGoals: ['中央制圧', '飛車先突破', '角交換からの攻め', '銀の繰り出し'],
    keyPositions: ['飛車先の歩を伸ばす', '銀を46または47に展開'],
  },
  {
    name: '振り飛車（四間飛車）',
    moves: ['76歩', '68飛', '48玉', '38玉', '28玉'],
    description: '飛車を6筋に振り、美濃囲いで堅く守る。カウンター狙い。',
    strategicGoals: ['美濃囲い完成', '角道を活かした反撃', '堅い守りからの逆襲', '端攻めの準備'],
    keyPositions: ['飛車を6筋に振る', '美濃囲い（38玉-48金-58金）'],
  },
  {
    name: '矢倉',
    moves: ['76歩', '66歩', '56歩', '48銀', '68玉', '78玉'],
    description: '堅固な矢倉囲いを築き、じっくり攻める相居飛車の代表戦法。',
    strategicGoals: ['矢倉囲い完成', '銀の繰り出し（46銀）', '盤面制圧', '角頭攻め'],
    keyPositions: ['矢倉囲い（77銀-67金-78玉）', '銀を中央に展開'],
  },
  {
    name: '角換わり',
    moves: ['76歩', '84歩', '22角成', '同銀'],
    description: '序盤で角を交換し、持ち角を活かした激しい攻め合いに。',
    strategicGoals: ['角打ちの隙を狙う', '相手陣への角打ち', '手得を活かす', '急戦志向'],
    keyPositions: ['角交換後の隙を作らない', '角打ちのポイントを探す'],
  },
  {
    name: '中飛車',
    moves: ['76歩', '56歩', '58飛'],
    description: '飛車を5筋に振り、中央から豪快に攻める。',
    strategicGoals: ['中央突破', '5筋の歩を活かした攻め', '左右への柔軟な展開'],
    keyPositions: ['飛車を5筋に振る', '56歩-55歩の突進'],
  },
  {
    name: '右四間飛車',
    moves: ['76歩', '48飛', '46歩', '45歩'],
    description: '飛車を4筋に振り、急戦で一気に攻め込む。',
    strategicGoals: ['45歩からの急戦', '角頭攻め', '速攻で優位を築く'],
    keyPositions: ['飛車を4筋に展開', '45歩の突破'],
  },
]

// ========================================
// 駒の価値
// ========================================

const PIECE_VALUES: Record<AllPieceType, number> = {
  king: 0,
  rook: 1000,
  bishop: 900,
  gold: 500,
  silver: 450,
  knight: 350,
  lance: 300,
  pawn: 100,
  promotedRook: 1300,
  promotedBishop: 1200,
  promotedSilver: 500,
  promotedKnight: 500,
  promotedLance: 500,
  promotedPawn: 600,
}

const HAND_PIECE_VALUES: Record<string, number> = {
  rook: 1200,
  bishop: 1100,
  gold: 550,
  silver: 500,
  knight: 350,
  lance: 300,
  pawn: 120,
}

// ========================================
// 評価関数
// ========================================

function getCentralControlBonus(col: number, row: number): number {
  const centerCol = 4
  const centerRow = 4
  const colDist = Math.abs(col - centerCol)
  const rowDist = Math.abs(row - centerRow)
  return Math.max(0, 20 - (colDist + rowDist) * 3)
}

function getKingSafetyScore(board: GameState['board'], player: 'sente' | 'gote'): number {
  let score = 0
  let kingRow = -1
  let kingCol = -1

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col]
      if (piece && piece.type === 'king' && piece.owner === player) {
        kingRow = row
        kingCol = col
        break
      }
    }
    if (kingRow >= 0) break
  }

  if (kingRow < 0) return -10000

  // 自陣にいるほど安全
  if (player === 'sente') {
    score += kingRow >= 6 ? 50 : kingRow >= 4 ? 0 : -30
  } else {
    score += kingRow <= 2 ? 50 : kingRow <= 4 ? 0 : -30
  }

  // 周囲の味方駒
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = kingRow + dr
      const nc = kingCol + dc
      if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
        const piece = board[nr][nc]
        if (piece && piece.owner === player) {
          score += 15
        }
      }
    }
  }

  return score
}

function quickEvaluate(state: GameState): number {
  let score = 0
  const { board, hands } = state

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col]
      if (piece) {
        const value = PIECE_VALUES[piece.type]
        const multiplier = piece.owner === 'sente' ? 1 : -1
        score += value * multiplier
        if (piece.type !== 'king') {
          score += getCentralControlBonus(col, row) * multiplier * 0.3
        }
      }
    }
  }

  const handTypes = ['rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn'] as const
  for (const type of handTypes) {
    score += hands.sente[type] * HAND_PIECE_VALUES[type]
    score -= hands.gote[type] * HAND_PIECE_VALUES[type]
  }

  score += getKingSafetyScore(board, 'sente')
  score -= getKingSafetyScore(board, 'gote')

  if (isInCheck(board, 'sente')) score -= 150
  if (isInCheck(board, 'gote')) score += 150

  return score
}

// ========================================
// ミニマックス法（αβ枝刈り）
// ========================================

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

interface MinimaxResult {
  score: number
  move: Move | null
  nodesSearched: number
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
    return { score: quickEvaluate(state), move: null, nodesSearched: nodesSearched.count }
  }

  const moves = getAllLegalMoves(state)
  if (moves.length === 0) {
    const inCheck = isInCheck(state.board, state.currentPlayer)
    if (inCheck) {
      return { score: maximizing ? -100000 + (5 - depth) * 1000 : 100000 - (5 - depth) * 1000, move: null, nodesSearched: nodesSearched.count }
    }
    return { score: 0, move: null, nodesSearched: nodesSearched.count }
  }

  // 手を並び替え（駒取り優先）
  const sortedMoves = moves.sort((a, b) => {
    const aScore = a.type === 'move' && a.captured ? PIECE_VALUES[a.captured] : 0
    const bScore = b.type === 'move' && b.captured ? PIECE_VALUES[b.captured] : 0
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
// テキスト変換ユーティリティ
// ========================================

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

  const evalScore = quickEvaluate(state)
  text += `\n【形勢（評価値）】${evalScore > 0 ? '先手有利' : evalScore < 0 ? '後手有利' : '互角'} (${evalScore > 0 ? '+' : ''}${evalScore})\n`

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

function moveHistoryToText(history: Move[]): string {
  if (history.length === 0) return 'まだ手が進んでいません。'
  const lines: string[] = []
  for (let i = 0; i < history.length; i++) {
    const move = history[i]
    const player = i % 2 === 0 ? '▲' : '△'
    lines.push(`${i + 1}手目 ${player}${moveToText(move)}`)
  }
  return lines.slice(-20).join('\n')
}

function strategicContextToText(): string {
  const ctx = strategicContext
  let text = ''

  if (ctx.openingName) text += `採用戦法: ${ctx.openingName}\n`
  if (ctx.currentPlan) text += `現在の方針: ${ctx.currentPlan}\n`
  if (ctx.longTermGoals.length > 0) text += `長期目標: ${ctx.longTermGoals.join('、')}\n`
  if (ctx.threats.length > 0) text += `警戒: ${ctx.threats.join('、')}\n`
  if (ctx.opportunities.length > 0) text += `狙い: ${ctx.opportunities.join('、')}\n`

  if (ctx.previousAnalyses.length > 0) {
    text += '\n【過去の分析（直近5手）】\n'
    for (const a of ctx.previousAnalyses.slice(-5)) {
      text += `${a.moveNumber}手目: ${a.selectedMove} - ${a.reasoning.slice(0, 40)}...\n`
    }
  }

  return text || '戦略コンテキストなし'
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
// レベル別の多段階推論システム
// ========================================

/**
 * 初級LLM: 2段階推論
 * ステージ1: 簡易局面分析
 * ステージ2: 候補手から直感的に選択
 */
async function selectBeginnerLLMMove(state: GameState, legalMoves: Move[]): Promise<AdvancedLLMResult> {
  const thinking: string[] = []
  thinking.push('🔰 初級LLM AI - 2段階推論')

  // ステージ1: 簡易分析
  thinking.push('📊 ステージ1: 局面を確認中...')
  const evalScore = quickEvaluate(state)
  const situation = evalScore > 200 ? '有利' : evalScore < -200 ? '不利' : '互角'
  thinking.push(`形勢: ${situation}`)

  // ステージ2: 直感的選択
  thinking.push('🎯 ステージ2: 良さそうな手を選択...')

  // 駒取り優先、成り優先でスコアリング
  const scoredMoves = legalMoves.map(move => {
    let score = Math.random() * 10 // ランダム要素
    if (move.type === 'move') {
      if (move.captured) score += PIECE_VALUES[move.captured] / 10
      if (move.promote) score += 50
    }
    return { move, score }
  }).sort((a, b) => b.score - a.score)

  // 上位5手からランダムに選択
  const topMoves = scoredMoves.slice(0, Math.min(5, scoredMoves.length))
  const selected = topMoves[Math.floor(Math.random() * topMoves.length)]

  thinking.push(`✅ 決定: ${moveToText(selected.move)}`)

  return {
    move: selected.move,
    thinking,
    evaluation: evalScore,
    strategicAnalysis: {
      positionAnalysis: `形勢: ${situation}`,
      threats: [],
      opportunities: [],
      plan: '駒得を狙う',
      reasoning: '直感的な選択',
    },
  }
}

/**
 * 中級LLM: 3段階推論
 * ステージ1: 局面分析（ミニマックス評価併用）
 * ステージ2: 候補手を評価値でスコアリング（上位15手）
 * ステージ3: LLMが選択
 */
async function selectIntermediateLLMMove(state: GameState, legalMoves: Move[]): Promise<AdvancedLLMResult> {
  const thinking: string[] = []
  thinking.push('⭐ 中級LLM AI - 3段階推論')

  // ステージ1: ミニマックスで評価
  thinking.push('📊 ステージ1: 2手先を読んで局面分析...')
  const nodesSearched = { count: 0 }
  const isMaximizing = state.currentPlayer === 'sente'
  const minimaxResult = minimax(state, 2, -Infinity, Infinity, isMaximizing, nodesSearched)
  thinking.push(`${nodesSearched.count}局面を評価`)

  // ステージ2: 候補手スコアリング
  thinking.push('🔍 ステージ2: 候補手を評価中...')
  const scoredMoves = legalMoves.map(move => {
    let score = 0
    if (move.type === 'move') {
      if (move.captured) score += PIECE_VALUES[move.captured]
      if (move.promote) score += 200
    }
    // ミニマックスで最善手と一致していればボーナス
    if (minimaxResult.move && JSON.stringify(move) === JSON.stringify(minimaxResult.move)) {
      score += 500
    }
    return { move, score, reasoning: move.type === 'move' && move.captured ? '駒取り' : '展開' }
  }).sort((a, b) => b.score - a.score)

  const candidates = scoredMoves.slice(0, 15)
  thinking.push(`有力候補: ${candidates.slice(0, 3).map(c => moveToText(c.move)).join('、')}`)

  // ステージ3: LLMで選択
  thinking.push('🎯 ステージ3: 最善手を決定...')

  try {
    const candidateText = candidates.slice(0, 10).map((c, i) =>
      `${i + 1}. ${moveToText(c.move)} [評価: ${c.score}]`
    ).join('\n')

    const response = await callOpenAI([
      {
        role: 'system',
        content: 'あなたは将棋AIです。候補手から最善の一手を選んでください。JSON形式で回答: {"selectedIndex": 番号, "reason": "理由"}'
      },
      {
        role: 'user',
        content: `${boardToText(state)}\n\n【候補手】\n${candidateText}\n\n上記から最善手を選んでください。`
      }
    ], 0.3)

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const index = (parsed.selectedIndex || 1) - 1
      if (index >= 0 && index < candidates.length) {
        const selected = candidates[index]
        thinking.push(`✅ 決定: ${moveToText(selected.move)}`)
        thinking.push(`💭 理由: ${parsed.reason || '評価値に基づく選択'}`)

        return {
          move: selected.move,
          thinking,
          evaluation: quickEvaluate(state),
          strategicAnalysis: {
            positionAnalysis: '中級分析完了',
            threats: [],
            opportunities: [],
            plan: parsed.reason || '',
            reasoning: parsed.reason || '評価値ベースの選択',
          },
        }
      }
    }
  } catch (e) {
    console.warn('Intermediate LLM API call failed:', e)
  }

  // フォールバック
  const selected = candidates[0]
  thinking.push(`✅ 決定: ${moveToText(selected.move)}（評価値ベース）`)

  return {
    move: selected.move,
    thinking,
    evaluation: minimaxResult.score,
    strategicAnalysis: {
      positionAnalysis: '評価値ベース',
      threats: [],
      opportunities: [],
      plan: '',
      reasoning: 'ミニマックス評価',
    },
  }
}

/**
 * 上級LLM: 4段階推論
 * ステージ1: 深い局面分析（LLM）
 * ステージ2: 定石考慮（序盤のみ）
 * ステージ3: ミニマックス+LLMで候補手評価（上位20手）
 * ステージ4: LLMが3手先の読みで最終選択
 */
async function selectAdvancedLLMMove_Internal(state: GameState, legalMoves: Move[]): Promise<AdvancedLLMResult> {
  const thinking: string[] = []
  thinking.push('💪 上級LLM AI - 4段階推論')

  // ステージ1: 深い局面分析
  thinking.push('📊 ステージ1: 局面を深く分析中...')
  let positionAnalysis = { analysis: '', threats: [] as string[], opportunities: [] as string[], recommendedStrategy: '' }

  try {
    const response = await callOpenAI([
      {
        role: 'system',
        content: `あなたは将棋のプロ棋士です。局面を分析してJSON形式で回答:
{
  "analysis": "局面の総合評価（50字以内）",
  "threats": ["相手の狙い1", "狙い2"],
  "opportunities": ["自分のチャンス1", "チャンス2"],
  "recommendedStrategy": "推奨戦略"
}`
      },
      {
        role: 'user',
        content: boardToText(state) + '\n\n【棋譜】\n' + moveHistoryToText(state.moveHistory)
      }
    ], 0.3)

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      positionAnalysis = JSON.parse(jsonMatch[0])
    }
  } catch (e) {
    console.warn('Position analysis failed:', e)
  }

  thinking.push(`分析: ${positionAnalysis.analysis || '分析完了'}`)
  strategicContext.threats = positionAnalysis.threats
  strategicContext.opportunities = positionAnalysis.opportunities

  // ステージ2: 定石考慮
  thinking.push('📚 ステージ2: 定石・戦法を考慮中...')
  let josekiAdvice = ''
  if (state.moveCount < 20 && state.gamePhase === 'opening') {
    const applicableJoseki = JOSEKI_DATABASE.slice(0, 3)
    josekiAdvice = applicableJoseki.map(j => `${j.name}: ${j.strategicGoals[0]}`).join('、')
    thinking.push(`参考戦法: ${josekiAdvice}`)
  } else {
    thinking.push('中盤以降のため具体的な読みを重視')
  }

  // ステージ3: ミニマックス+候補手評価
  thinking.push('🔍 ステージ3: 3手先を読んで候補手を評価...')
  const nodesSearched = { count: 0 }
  const isMaximizing = state.currentPlayer === 'sente'
  const minimaxResult = minimax(state, 3, -Infinity, Infinity, isMaximizing, nodesSearched)
  thinking.push(`${nodesSearched.count}局面を評価`)

  const scoredMoves = legalMoves.map(move => {
    let score = 0
    if (move.type === 'move') {
      if (move.captured) score += PIECE_VALUES[move.captured]
      if (move.promote) score += 200
    }
    // 王手をかける手にボーナス
    const afterState = applyMoveToState(state, move)
    if (isInCheck(afterState.board, afterState.currentPlayer)) {
      score += 100
    }
    if (minimaxResult.move && JSON.stringify(move) === JSON.stringify(minimaxResult.move)) {
      score += 800
    }
    return { move, score }
  }).sort((a, b) => b.score - a.score)

  const candidates = scoredMoves.slice(0, 20)
  thinking.push(`有力候補: ${candidates.slice(0, 5).map(c => moveToText(c.move)).join('、')}`)

  // ステージ4: 最終選択（深い読み）
  thinking.push('🎯 ステージ4: 3手先の読みで最善手を決定...')

  try {
    const candidateText = candidates.slice(0, 12).map((c, i) =>
      `${i + 1}. ${moveToText(c.move)} [評価: ${c.score}]`
    ).join('\n')

    const response = await callOpenAI([
      {
        role: 'system',
        content: `あなたは将棋のプロ棋士です。3手先までの読みを含めて最善手を選んでください。

【思考プロセス】
1. 相手の応手を予測
2. その後の自分の手を考える
3. 3手後の局面を評価

JSON形式で回答:
{
  "selectedIndex": 候補番号,
  "reasoning": "3手先までの読み筋を含む詳細な理由",
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

【戦略コンテキスト】
${strategicContextToText()}

【候補手】
${candidateText}

3手先までの読みを含めて最善手を選んでください。`
      }
    ], 0.2)

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const index = (parsed.selectedIndex || 1) - 1

      if (index >= 0 && index < candidates.length) {
        const selected = candidates[index]
        thinking.push(`✅ 決定: ${moveToText(selected.move)}`)
        thinking.push(`💭 読み: ${(parsed.reasoning || '').slice(0, 80)}...`)

        // 戦略コンテキスト更新
        strategicContext.currentPlan = parsed.plan || ''
        strategicContext.previousAnalyses.push({
          moveNumber: state.moveCount + 1,
          position: '',
          analysis: positionAnalysis.analysis,
          selectedMove: moveToText(selected.move),
          reasoning: parsed.reasoning || '',
          strategicGoals: [],
          evaluation: quickEvaluate(state),
        })
        if (strategicContext.previousAnalyses.length > 20) {
          strategicContext.previousAnalyses = strategicContext.previousAnalyses.slice(-20)
        }

        return {
          move: selected.move,
          thinking,
          evaluation: minimaxResult.score,
          strategicAnalysis: {
            positionAnalysis: positionAnalysis.analysis,
            threats: positionAnalysis.threats,
            opportunities: positionAnalysis.opportunities,
            plan: parsed.plan || '',
            reasoning: parsed.reasoning || '',
          },
        }
      }
    }
  } catch (e) {
    console.warn('Final selection failed:', e)
  }

  // フォールバック
  const selected = candidates[0]
  thinking.push(`✅ 決定: ${moveToText(selected.move)}（評価値ベース）`)

  return {
    move: selected.move,
    thinking,
    evaluation: minimaxResult.score,
    strategicAnalysis: {
      positionAnalysis: positionAnalysis.analysis || 'フォールバック',
      threats: positionAnalysis.threats,
      opportunities: positionAnalysis.opportunities,
      plan: '',
      reasoning: 'ミニマックス評価に基づく選択',
    },
  }
}

/**
 * LLM AI（フルパワー）: 4段階推論 + 戦略的記憶
 * ステージ1: 深い局面分析（駒の効き、玉の安全度、攻防態勢）
 * ステージ2: 定石データベース参照
 * ステージ3: ミニマックス+αβで候補手を深く評価（上位20手）
 * ステージ4: GPT-4oが5手先の読みを含む深い推論で最終選択
 */
async function selectFullPowerLLMMove(state: GameState, legalMoves: Move[]): Promise<AdvancedLLMResult> {
  const thinking: string[] = []
  thinking.push('🤖 LLM AI（フルパワー）- 4段階戦略推論')

  // ステージ1: 深い局面分析
  thinking.push('📊 ステージ1: 駒の配置、玉の安全度、攻防態勢を深く分析...')

  let positionAnalysis = {
    analysis: '',
    threats: [] as string[],
    opportunities: [] as string[],
    recommendedStrategy: '',
    kingSafety: { sente: '', gote: '' },
    pieceActivity: '',
  }

  try {
    const response = await callOpenAI([
      {
        role: 'system',
        content: `あなたは将棋のプロ棋士であり、戦略分析の専門家です。
局面を以下の観点から深く分析してJSON形式で回答してください:
1. 駒の配置と効き（攻撃的/防御的配置）
2. 玉の安全度（囲いの堅さ、逃げ道）
3. 攻撃態勢と防御態勢
4. 手番の価値
5. 潜在的な脅威と機会

JSON形式:
{
  "analysis": "局面の総合評価（100字以内）",
  "threats": ["相手の具体的な狙い1", "狙い2", "狙い3"],
  "opportunities": ["自分のチャンス1", "チャンス2", "チャンス3"],
  "kingSafety": {"sente": "先手玉の安全度", "gote": "後手玉の安全度"},
  "pieceActivity": "駒の働き度合い",
  "recommendedStrategy": "具体的な戦略方針"
}`
      },
      {
        role: 'user',
        content: `${boardToText(state)}

【棋譜履歴】
${moveHistoryToText(state.moveHistory)}

【これまでの戦略】
${strategicContextToText()}`
      }
    ], 0.3)

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      positionAnalysis = { ...positionAnalysis, ...parsed }
    }
  } catch (e) {
    console.warn('Deep analysis failed:', e)
  }

  thinking.push(`分析: ${positionAnalysis.analysis || '分析完了'}`)
  if (positionAnalysis.threats.length > 0) {
    thinking.push(`⚠️ 警戒: ${positionAnalysis.threats.slice(0, 2).join('、')}`)
  }

  strategicContext.threats = positionAnalysis.threats
  strategicContext.opportunities = positionAnalysis.opportunities

  // ステージ2: 定石データベース参照
  thinking.push('📚 ステージ2: 定石・戦法データベースを参照...')
  let josekiRecommendation = ''

  if (state.moveCount < 25 && state.gamePhase === 'opening') {
    const applicableJoseki = JOSEKI_DATABASE
    josekiRecommendation = applicableJoseki.map(j =>
      `【${j.name}】${j.description}\n  目標: ${j.strategicGoals.join('、')}`
    ).join('\n')
    thinking.push(`定石参照: ${JOSEKI_DATABASE.map(j => j.name).join('、')}`)

    if (!strategicContext.openingName) {
      strategicContext.openingName = JOSEKI_DATABASE[0].name
      strategicContext.longTermGoals = JOSEKI_DATABASE[0].strategicGoals
    }
  } else {
    thinking.push('中終盤のため具体的な読みを重視')
  }

  // ステージ3: ミニマックス+αβ枝刈りで深い評価
  thinking.push('🔍 ステージ3: ミニマックス法で4手先まで読んで候補手を評価...')
  const nodesSearched = { count: 0 }
  const isMaximizing = state.currentPlayer === 'sente'

  // 深さ4で探索
  const minimaxResult = minimax(state, 4, -Infinity, Infinity, isMaximizing, nodesSearched)
  thinking.push(`${nodesSearched.count}局面を探索・評価`)

  // 全ての手を評価
  const evaluatedMoves: Array<{ move: Move; score: number; features: string[] }> = []

  for (const move of legalMoves) {
    let score = 0
    const features: string[] = []

    if (move.type === 'move') {
      if (move.captured) {
        score += PIECE_VALUES[move.captured]
        features.push(`${PIECE_KANJI[move.captured as keyof typeof PIECE_KANJI]}取り`)
      }
      if (move.promote) {
        score += 250
        features.push('成り')
      }
    }

    // 王手チェック
    const afterState = applyMoveToState(state, move)
    if (isInCheck(afterState.board, afterState.currentPlayer)) {
      score += 150
      features.push('王手')
    }

    // ミニマックス最善手と一致
    if (minimaxResult.move && JSON.stringify(move) === JSON.stringify(minimaxResult.move)) {
      score += 1000
      features.push('ミニマックス推奨')
    }

    evaluatedMoves.push({ move, score, features })
  }

  evaluatedMoves.sort((a, b) => b.score - a.score)
  const candidates = evaluatedMoves.slice(0, 20)
  thinking.push(`有力候補（上位20手）: ${candidates.slice(0, 5).map(c => moveToText(c.move)).join('、')}`)

  // ステージ4: GPT-4oによる深い最終選択
  thinking.push('🎯 ステージ4: GPT-4oが5手先の読みで最善手を決定...')

  try {
    const candidateText = candidates.slice(0, 15).map((c, i) =>
      `${i + 1}. ${moveToText(c.move)} [評価: ${c.score}] ${c.features.join(', ')}`
    ).join('\n')

    const response = await callOpenAI([
      {
        role: 'system',
        content: `あなたは将棋のプロ棋士です。多段階の戦略的思考で最善手を選びます。

【思考プロセス】
1. 局面の特徴を把握（攻め時か守り時か）
2. 相手の狙いを読む（次の相手の手を予測）
3. 自分の攻撃計画を立てる
4. 各候補手について5手先までの読み筋を検討
5. 長期的な勝ち筋に最も近づく手を選択

【重要な判断基準】
- 駒得よりも玉の安全を優先
- 終盤は速度重視
- 序盤は駒の働きを重視

JSON形式で回答（必ずこの形式で）:
{
  "selectedIndex": 候補番号（1から始まる数字）,
  "reasoning": "5手先までの具体的な読み筋を含む詳細な理由（例：この手を指すと相手は○○、それに対して△△...）",
  "plan": "今後3手の方針",
  "longTermGoal": "この一局での長期的な勝ち筋"
}`
      },
      {
        role: 'user',
        content: `${boardToText(state)}

【深い局面分析結果】
${positionAnalysis.analysis}

玉の安全度:
- 先手玉: ${positionAnalysis.kingSafety?.sente || '不明'}
- 後手玉: ${positionAnalysis.kingSafety?.gote || '不明'}

駒の働き: ${positionAnalysis.pieceActivity || '不明'}

【警戒すべき点】
${positionAnalysis.threats.map((t, i) => `${i + 1}. ${t}`).join('\n') || 'なし'}

【狙い目】
${positionAnalysis.opportunities.map((o, i) => `${i + 1}. ${o}`).join('\n') || 'なし'}

【推奨戦略】
${positionAnalysis.recommendedStrategy}

【定石情報】
${josekiRecommendation || '中終盤のため省略'}

【これまでの戦略】
${strategicContextToText()}

【候補手一覧（評価値順）】
${candidateText}

上記の情報を総合的に判断し、5手先までの読みを含めて最善手を選んでください。`
      }
    ], 0.15)

    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0])
      const index = (parsed.selectedIndex || 1) - 1

      if (index >= 0 && index < candidates.length) {
        const selected = candidates[index]
        thinking.push(`✅ 決定: ${moveToText(selected.move)}`)
        thinking.push(`💭 読み筋: ${(parsed.reasoning || '').slice(0, 100)}...`)
        if (parsed.plan) {
          thinking.push(`📋 方針: ${parsed.plan}`)
        }

        // 戦略コンテキスト更新
        strategicContext.currentPlan = parsed.plan || ''
        if (parsed.longTermGoal) {
          strategicContext.longTermGoals = [parsed.longTermGoal]
        }
        strategicContext.previousAnalyses.push({
          moveNumber: state.moveCount + 1,
          position: '',
          analysis: positionAnalysis.analysis,
          selectedMove: moveToText(selected.move),
          reasoning: parsed.reasoning || '',
          strategicGoals: [parsed.longTermGoal || ''],
          evaluation: quickEvaluate(state),
        })
        if (strategicContext.previousAnalyses.length > 20) {
          strategicContext.previousAnalyses = strategicContext.previousAnalyses.slice(-20)
        }

        return {
          move: selected.move,
          thinking,
          evaluation: minimaxResult.score,
          strategicAnalysis: {
            positionAnalysis: positionAnalysis.analysis,
            threats: positionAnalysis.threats,
            opportunities: positionAnalysis.opportunities,
            plan: parsed.plan || '',
            reasoning: parsed.reasoning || '',
          },
        }
      }
    }
  } catch (e) {
    console.warn('Full power final selection failed:', e)
    thinking.push(`⚠️ API呼び出しエラー、評価値ベースで選択`)
  }

  // フォールバック
  const selected = candidates[0]
  thinking.push(`✅ 決定: ${moveToText(selected.move)}（ミニマックス評価ベース）`)

  return {
    move: selected.move,
    thinking,
    evaluation: minimaxResult.score,
    strategicAnalysis: {
      positionAnalysis: positionAnalysis.analysis || 'フォールバック',
      threats: positionAnalysis.threats,
      opportunities: positionAnalysis.opportunities,
      plan: strategicContext.currentPlan,
      reasoning: 'ミニマックス評価に基づく選択',
    },
  }
}

// ========================================
// メインエントリーポイント
// ========================================

/**
 * レベルに応じた多段階推論LLM AIの手を選択
 */
export async function selectAdvancedLLMMove(state: GameState, level?: AILevel): Promise<AdvancedLLMResult | null> {
  const legalMoves = getAllLegalMoves(state)
  if (legalMoves.length === 0) return null

  // レベルに応じて異なる推論システムを使用
  // デフォルトはフルパワー（LLMレベル）
  const aiLevel = level || 'llm'

  switch (aiLevel) {
    case 'beginner':
      return selectBeginnerLLMMove(state, legalMoves)
    case 'intermediate':
      return selectIntermediateLLMMove(state, legalMoves)
    case 'advanced':
      return selectAdvancedLLMMove_Internal(state, legalMoves)
    case 'llm':
    default:
      return selectFullPowerLLMMove(state, legalMoves)
  }
}

// ========================================
// 戦略コンテキストリセット
// ========================================

export function resetStrategicContext(): void {
  strategicContext = {
    openingName: null,
    currentPlan: '',
    longTermGoals: [],
    threats: [],
    opportunities: [],
    previousAnalyses: [],
  }
}

// ========================================
// API設定確認
// ========================================

export function isOpenAIConfigured(): boolean {
  return OPENAI_API_KEY.length > 0
}
