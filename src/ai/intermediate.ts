// 将棋AI - 中級AI（ミニマックス法）
import type {
  GameState,
  Move,
  Player,
  AllPieceType,
} from '../types'
import { getAllLegalMoves, isInCheck, applyMove, applyDrop } from '../logic/legalMoves'
import { toHandPieceType, addToHand, removeFromHand } from '../logic/board'

// ========================================
// 駒の価値（評価関数用）
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
// 位置評価
// ========================================

// 中央制圧の価値
function getCentralControlBonus(col: number, row: number): number {
  const centerCol = 4
  const centerRow = 4
  const colDist = Math.abs(col - centerCol)
  const rowDist = Math.abs(row - centerRow)
  return Math.max(0, 20 - (colDist + rowDist) * 3)
}

// 玉の安全度
function getKingSafetyScore(board: GameState['board'], player: Player): number {
  let score = 0
  let kingRow = -1
  let kingCol = -1
  
  // 玉の位置を探す
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
  
  if (kingRow < 0) return -10000 // 玉がない
  
  // 自陣にいるほど安全
  if (player === 'sente') {
    score += kingRow >= 6 ? 50 : kingRow >= 4 ? 0 : -30
  } else {
    score += kingRow <= 2 ? 50 : kingRow <= 4 ? 0 : -30
  }
  
  // 周囲の味方駒の数
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue
      const nr = kingRow + dr
      const nc = kingCol + dc
      if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
        const piece = board[nr][nc]
        if (piece && piece.owner === player) {
          score += 10 // 味方駒がガード
        }
      }
    }
  }
  
  return score
}

// ========================================
// 盤面評価関数（改良版）
// ========================================

export function evaluateBoardAdvanced(state: GameState): number {
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

      // 中央制圧ボーナス（玉以外）
      if (piece.type !== 'king') {
        score += getCentralControlBonus(col, row) * multiplier * 0.3
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

  // 玉の安全度
  score += getKingSafetyScore(board, 'sente')
  score -= getKingSafetyScore(board, 'gote')

  // 王手状態
  if (isInCheck(board, 'sente')) score -= 150
  if (isInCheck(board, 'gote')) score += 150

  return score
}

// ========================================
// 手を適用してGameStateを更新
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
    
    return {
      ...state,
      board: newBoard,
      hands: newHands,
      currentPlayer: nextPlayer,
      moveCount: state.moveCount + 1,
    }
  } else {
    const newBoard = applyDrop(board, move, currentPlayer)
    const newHands = {
      ...hands,
      [currentPlayer]: removeFromHand(hands[currentPlayer], move.piece),
    }
    
    return {
      ...state,
      board: newBoard,
      hands: newHands,
      currentPlayer: nextPlayer,
      moveCount: state.moveCount + 1,
    }
  }
}

// ========================================
// ミニマックス法（アルファベータ枝刈り）
// ========================================

interface SearchResult {
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
): SearchResult {
  nodesSearched.count++
  
  // 終端条件
  if (depth === 0) {
    return {
      score: evaluateBoardAdvanced(state),
      move: null,
      nodesSearched: nodesSearched.count,
    }
  }
  
  const moves = getAllLegalMoves(state)
  
  // 合法手がない = 詰みまたはステイルメート
  if (moves.length === 0) {
    const isCheck = isInCheck(state.board, state.currentPlayer)
    if (isCheck) {
      // 詰み
      return {
        score: maximizing ? -100000 + (3 - depth) * 1000 : 100000 - (3 - depth) * 1000,
        move: null,
        nodesSearched: nodesSearched.count,
      }
    } else {
      // ステイルメート
      return {
        score: 0,
        move: null,
        nodesSearched: nodesSearched.count,
      }
    }
  }
  
  // 手を並び替え（良さそうな手を先に）
  const sortedMoves = moves.sort((a, b) => {
    // 駒を取る手を優先
    const aCapture = a.type === 'move' && a.captured ? PIECE_VALUES[a.captured] : 0
    const bCapture = b.type === 'move' && b.captured ? PIECE_VALUES[b.captured] : 0
    return bCapture - aCapture
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
      if (beta <= alpha) break // 枝刈り
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
      if (beta <= alpha) break // 枝刈り
    }
    
    return { score: minScore, move: bestMove, nodesSearched: nodesSearched.count }
  }
}

// ========================================
// 中級AI
// ========================================

export interface AIThinkResult {
  move: Move
  thinking: string[]
  evaluation: number
  nodesSearched?: number
}

export async function selectIntermediateMove(state: GameState): Promise<AIThinkResult | null> {
  const thinking: string[] = []
  const moves = getAllLegalMoves(state)
  
  if (moves.length === 0) {
    thinking.push('合法手がありません。')
    return null
  }
  
  thinking.push(`${moves.length}手の候補を検討中...`)
  
  // 深さ2で探索（初手と応手を読む）
  const depth = 2
  thinking.push(`${depth}手先まで読みます...`)
  
  const nodesSearched = { count: 0 }
  const isMaximizing = state.currentPlayer === 'sente'
  
  const result = minimax(
    state,
    depth,
    -Infinity,
    Infinity,
    isMaximizing,
    nodesSearched
  )
  
  if (!result.move) {
    // フォールバック: ランダムに選択
    const randomMove = moves[Math.floor(Math.random() * moves.length)]
    return {
      move: randomMove,
      thinking: [...thinking, 'ランダムに選択'],
      evaluation: evaluateBoardAdvanced(state),
    }
  }
  
  thinking.push(`${nodesSearched.count}局面を評価しました`)
  thinking.push(`評価値: ${result.score > 0 ? '+' : ''}${result.score}`)
  
  // 選んだ手の説明
  if (result.move.type === 'move') {
    const from = `${result.move.from.col}${result.move.from.row}`
    const to = `${result.move.to.col}${result.move.to.row}`
    const capture = result.move.captured ? '（駒を取る）' : ''
    thinking.push(`${from} → ${to}${capture} を選択`)
  } else {
    thinking.push(`${result.move.piece}を打つ`)
  }
  
  return {
    move: result.move,
    thinking,
    evaluation: result.score,
    nodesSearched: nodesSearched.count,
  }
}

// ========================================
// 上級AI（より深い探索）
// ========================================

export async function selectAdvancedMove(state: GameState): Promise<AIThinkResult | null> {
  const thinking: string[] = []
  const moves = getAllLegalMoves(state)
  
  if (moves.length === 0) {
    return null
  }
  
  thinking.push(`${moves.length}手の候補を検討中...`)
  
  // 深さ3で探索
  const depth = 3
  thinking.push(`${depth}手先まで読みます...`)
  
  const nodesSearched = { count: 0 }
  const isMaximizing = state.currentPlayer === 'sente'
  
  const result = minimax(
    state,
    depth,
    -Infinity,
    Infinity,
    isMaximizing,
    nodesSearched
  )
  
  if (!result.move) {
    const randomMove = moves[Math.floor(Math.random() * moves.length)]
    return {
      move: randomMove,
      thinking: [...thinking, 'ランダムに選択'],
      evaluation: evaluateBoardAdvanced(state),
    }
  }
  
  thinking.push(`${nodesSearched.count}局面を評価しました`)
  thinking.push(`評価値: ${result.score > 0 ? '+' : ''}${result.score}`)
  
  return {
    move: result.move,
    thinking,
    evaluation: result.score,
    nodesSearched: nodesSearched.count,
  }
}
