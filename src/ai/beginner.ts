// 将棋AI - 基本評価関数と初級AI
import type {
  GameState,
  Move,
  Player,
  AllPieceType,
} from '../types'
import { getAllLegalMoves, isInCheck } from '../logic/legalMoves'

// ========================================
// 駒の価値（評価関数用）
// ========================================

const PIECE_VALUES: Record<AllPieceType, number> = {
  king: 0,           // 玉は無限大扱い（取られたら負け）
  rook: 1000,        // 飛車
  bishop: 900,       // 角
  gold: 500,         // 金
  silver: 450,       // 銀
  knight: 350,       // 桂馬
  lance: 300,        // 香車
  pawn: 100,         // 歩
  promotedRook: 1300,    // 龍王
  promotedBishop: 1200,  // 龍馬
  promotedSilver: 500,   // 成銀（金と同じ動き）
  promotedKnight: 500,   // 成桂
  promotedLance: 500,    // 成香
  promotedPawn: 600,     // と金
}

// 持ち駒の価値（盤上より少し低い）
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
// 位置評価（駒の位置による加点）
// ========================================

// 歩の位置評価（前進するほど価値が上がる）
function getPawnPositionBonus(row: number, player: Player): number {
  if (player === 'sente') {
    // 先手は段が小さいほど前
    return (9 - row) * 5
  } else {
    // 後手は段が大きいほど前
    return row * 5
  }
}

// 玉の安全度（自陣にいるほど安全）
function getKingSafetyBonus(row: number, player: Player): number {
  if (player === 'sente') {
    // 先手は7-9段目が自陣
    if (row >= 6) return 50
    if (row >= 4) return 0
    return -30 // 前に出すぎ
  } else {
    // 後手は1-3段目が自陣
    if (row <= 2) return 50
    if (row <= 4) return 0
    return -30
  }
}

// ========================================
// 盤面評価関数
// ========================================

/**
 * 盤面を評価（正の値は先手有利、負の値は後手有利）
 */
export function evaluateBoard(state: GameState): number {
  const { board, hands } = state
  let score = 0

  // 盤上の駒を評価
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col]
      if (!piece) continue

      const pieceValue = PIECE_VALUES[piece.type]
      const multiplier = piece.owner === 'sente' ? 1 : -1

      // 基本価値
      score += pieceValue * multiplier

      // 位置ボーナス
      if (piece.type === 'pawn' || piece.type === 'promotedPawn') {
        score += getPawnPositionBonus(row, piece.owner) * multiplier
      }
      if (piece.type === 'king') {
        score += getKingSafetyBonus(row, piece.owner) * multiplier
      }
    }
  }

  // 持ち駒を評価
  for (const [pieceType, count] of Object.entries(hands.sente)) {
    if (count > 0 && pieceType in HAND_PIECE_VALUES) {
      score += HAND_PIECE_VALUES[pieceType] * count
    }
  }
  for (const [pieceType, count] of Object.entries(hands.gote)) {
    if (count > 0 && pieceType in HAND_PIECE_VALUES) {
      score -= HAND_PIECE_VALUES[pieceType] * count
    }
  }

  // 王手状態のボーナス/ペナルティ
  if (isInCheck(board, 'sente')) {
    score -= 100 // 先手が王手されている
  }
  if (isInCheck(board, 'gote')) {
    score += 100 // 後手が王手されている
  }

  return score
}

// ========================================
// 初級AI - ランダム + 基本評価
// ========================================

/**
 * 初級AI: ランダムに手を選ぶが、駒を取れる手を優先
 */
export function selectBeginnerMove(state: GameState): Move | null {
  const moves = getAllLegalMoves(state)
  if (moves.length === 0) return null

  // 駒を取れる手を抽出
  const captureMoves = moves.filter(
    m => m.type === 'move' && m.captured
  )

  // 優先順位:
  // 1. 高い駒を取れる手
  // 2. 駒を取れる手
  // 3. ランダム

  if (captureMoves.length > 0) {
    // 取れる駒の価値で並び替え
    captureMoves.sort((a, b) => {
      if (a.type !== 'move' || b.type !== 'move') return 0
      const valueA = a.captured ? PIECE_VALUES[a.captured] : 0
      const valueB = b.captured ? PIECE_VALUES[b.captured] : 0
      return valueB - valueA
    })

    // 最も価値の高い駒を取る手から、ランダム性を持たせて選択
    const topValue = captureMoves[0].type === 'move' && captureMoves[0].captured
      ? PIECE_VALUES[captureMoves[0].captured]
      : 0
    
    const topMoves = captureMoves.filter(m => {
      if (m.type !== 'move' || !m.captured) return false
      return PIECE_VALUES[m.captured] >= topValue * 0.8
    })

    // 80%の確率で最良の手、20%でランダム
    if (Math.random() < 0.8 && topMoves.length > 0) {
      return topMoves[Math.floor(Math.random() * topMoves.length)]
    }
  }

  // ランダムに選択（少しだけ評価を考慮）
  // 完全ランダムではなく、明らかに悪い手を避ける
  const scoredMoves = moves.map(move => ({
    move,
    score: Math.random() * 100 // ランダムスコア
  }))

  scoredMoves.sort((a, b) => b.score - a.score)
  return scoredMoves[0].move
}

// ========================================
// AI思考のラッパー
// ========================================

export interface AIThinkResult {
  move: Move
  thinking: string[]
  evaluation: number
  nodesSearched?: number
  strategicAnalysis?: {
    positionAnalysis: string
    threats: string[]
    opportunities: string[]
    plan: string
    reasoning: string
  }
}

/**
 * AIに手を考えさせる
 */
export async function thinkMove(
  state: GameState,
  level: 'beginner' | 'intermediate' | 'advanced'
): Promise<AIThinkResult | null> {
  const thinking: string[] = []
  
  // 合法手を取得
  const moves = getAllLegalMoves(state)
  if (moves.length === 0) {
    thinking.push('合法手がありません。投了します。')
    return null
  }

  thinking.push(`${moves.length}手の候補を検討中...`)

  let selectedMove: Move | null = null

  switch (level) {
    case 'beginner':
      thinking.push('駒得を狙いつつ、ランダムに選択します。')
      selectedMove = selectBeginnerMove(state)
      break
    case 'intermediate':
    case 'advanced':
      // 後で実装
      selectedMove = selectBeginnerMove(state)
      break
  }

  if (!selectedMove) {
    return null
  }

  // 選んだ手の説明
  if (selectedMove.type === 'move') {
    const from = `${selectedMove.from.col}${selectedMove.from.row}`
    const to = `${selectedMove.to.col}${selectedMove.to.row}`
    const promote = selectedMove.promote ? '成' : ''
    const capture = selectedMove.captured ? '（駒を取る）' : ''
    thinking.push(`${from} → ${to}${promote}${capture} を選択`)
  } else {
    thinking.push(`${selectedMove.piece}を${selectedMove.to.col}${selectedMove.to.row}に打つ`)
  }

  return {
    move: selectedMove,
    thinking,
    evaluation: evaluateBoard(state),
  }
}
