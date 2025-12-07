// 将棋AI - 高度評価関数モジュール
// 駒の価値 + 位置評価 + 玉の安全度 + 駒の働き

import type { GameState, AllPieceType, Player } from '../types'
import { isInCheck } from '../logic/legalMoves'

// ========================================
// 駒の基本価値
// ========================================

export const PIECE_VALUES: Record<AllPieceType, number> = {
  king: 0,           // 玉は無限大扱い
  rook: 1000,        // 飛車
  bishop: 900,       // 角
  gold: 500,         // 金
  silver: 450,       // 銀
  knight: 350,       // 桂馬
  lance: 300,        // 香車
  pawn: 100,         // 歩
  promotedRook: 1300,    // 龍王
  promotedBishop: 1200,  // 龍馬
  promotedSilver: 500,   // 成銀
  promotedKnight: 500,   // 成桂
  promotedLance: 500,    // 成香
  promotedPawn: 600,     // と金
}

// 持ち駒の価値（盤上より少し高い - 打てる柔軟性）
export const HAND_PIECE_VALUES: Record<string, number> = {
  rook: 1200,
  bishop: 1100,
  gold: 550,
  silver: 500,
  knight: 400,
  lance: 350,
  pawn: 150,
}

// ========================================
// 位置評価テーブル（Piece-Square Tables）
// ========================================

// 歩の位置評価（先手視点、後手は反転）
const PAWN_PST: number[][] = [
  [  0,   0,   0,   0,   0,   0,   0,   0,   0],  // 1段目（成れる）
  [ 50,  50,  50,  50,  50,  50,  50,  50,  50],  // 2段目
  [ 30,  30,  30,  30,  30,  30,  30,  30,  30],  // 3段目
  [ 20,  20,  20,  25,  25,  25,  20,  20,  20],  // 4段目
  [ 10,  10,  15,  20,  20,  20,  15,  10,  10],  // 5段目
  [  5,   5,   5,  10,  10,  10,   5,   5,   5],  // 6段目
  [  0,   0,   0,   0,   0,   0,   0,   0,   0],  // 7段目（初期位置）
  [  0,   0,   0,   0,   0,   0,   0,   0,   0],  // 8段目
  [  0,   0,   0,   0,   0,   0,   0,   0,   0],  // 9段目
]

// 銀の位置評価
const SILVER_PST: number[][] = [
  [  0,   0,   0,   0,   0,   0,   0,   0,   0],
  [ 20,  20,  20,  20,  20,  20,  20,  20,  20],
  [ 15,  15,  15,  15,  15,  15,  15,  15,  15],
  [ 10,  15,  20,  25,  25,  25,  20,  15,  10],
  [  5,  10,  15,  20,  20,  20,  15,  10,   5],
  [  0,   5,  10,  15,  15,  15,  10,   5,   0],
  [  0,   0,   5,  10,  10,  10,   5,   0,   0],
  [  0,   0,   0,   5,   5,   5,   0,   0,   0],
  [  0,   0,   0,   0,   0,   0,   0,   0,   0],
]

// 金の位置評価（守りに使うことが多い）
const GOLD_PST: number[][] = [
  [  0,   0,   0,   0,   0,   0,   0,   0,   0],
  [ 10,  10,  10,  10,  10,  10,  10,  10,  10],
  [  5,   5,   5,   5,   5,   5,   5,   5,   5],
  [  0,   5,   5,  10,  10,  10,   5,   5,   0],
  [  0,   0,   5,   5,   5,   5,   5,   0,   0],
  [  0,   5,  10,  10,  10,  10,  10,   5,   0],
  [  5,  10,  15,  15,  15,  15,  15,  10,   5],
  [ 10,  15,  20,  20,  20,  20,  20,  15,  10],
  [  5,  10,  10,  10,  10,  10,  10,  10,   5],
]

// 飛車の位置評価
const ROOK_PST: number[][] = [
  [ 20,  20,  20,  20,  20,  20,  20,  20,  20],
  [ 30,  30,  30,  30,  30,  30,  30,  30,  30],
  [ 20,  20,  20,  20,  20,  20,  20,  20,  20],
  [ 10,  10,  10,  10,  10,  10,  10,  10,  10],
  [  0,   0,   0,   0,   0,   0,   0,   0,   0],
  [  0,   0,   0,   0,   0,   0,   0,   0,   0],
  [  0,   0,   0,   0,   0,   0,   0,   0,   0],
  [ 10,  10,  10,  10,  10,  10,  10,  10,  10],
  [  5,   5,   5,   5,   5,   5,   5,   5,   5],
]

// 角の位置評価
const BISHOP_PST: number[][] = [
  [ 10,   5,   5,   5,   5,   5,   5,   5,  10],
  [  5,  15,  10,  10,  10,  10,  10,  15,   5],
  [  5,  10,  15,  15,  15,  15,  15,  10,   5],
  [  5,  10,  15,  20,  20,  20,  15,  10,   5],
  [  5,  10,  15,  20,  25,  20,  15,  10,   5],
  [  5,  10,  15,  20,  20,  20,  15,  10,   5],
  [  5,  10,  15,  15,  15,  15,  15,  10,   5],
  [  5,  15,  10,  10,  10,  10,  10,  15,   5],
  [ 10,   5,   5,   5,   5,   5,   5,   5,  10],
]

// 位置評価を取得
function getPositionBonus(pieceType: AllPieceType, row: number, col: number, owner: Player): number {
  // 後手は盤面を反転
  const r = owner === 'sente' ? row : 8 - row
  
  switch (pieceType) {
    case 'pawn':
    case 'promotedPawn':
      return PAWN_PST[r][col]
    case 'silver':
    case 'promotedSilver':
      return SILVER_PST[r][col]
    case 'gold':
    case 'promotedKnight':
    case 'promotedLance':
      return GOLD_PST[r][col]
    case 'rook':
    case 'promotedRook':
      return ROOK_PST[r][col]
    case 'bishop':
    case 'promotedBishop':
      return BISHOP_PST[r][col]
    case 'knight':
      return SILVER_PST[r][col] * 0.8
    case 'lance':
      return PAWN_PST[r][col] * 0.7
    default:
      return 0
  }
}

// ========================================
// 玉の安全度評価
// ========================================

interface KingSafetyResult {
  score: number
  details: {
    position: number
    defenders: number
    attackers: number
    escapeRoutes: number
  }
}

function evaluateKingSafety(board: GameState['board'], player: Player): KingSafetyResult {
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
  
  if (kingRow < 0) {
    return { score: -100000, details: { position: 0, defenders: 0, attackers: 0, escapeRoutes: 0 } }
  }
  
  const details = { position: 0, defenders: 0, attackers: 0, escapeRoutes: 0 }
  
  // 位置評価：自陣にいるほど安全
  if (player === 'sente') {
    if (kingRow >= 6) details.position = 80  // 7-9段目
    else if (kingRow >= 4) details.position = 40  // 5-6段目
    else details.position = -50  // 前に出すぎ
  } else {
    if (kingRow <= 2) details.position = 80  // 1-3段目
    else if (kingRow <= 4) details.position = 40  // 4-5段目
    else details.position = -50  // 前に出すぎ
  }
  
  // 周囲8マスの評価
  const directions = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1],           [0, 1],
    [1, -1],  [1, 0],  [1, 1]
  ]
  
  for (const [dr, dc] of directions) {
    const nr = kingRow + dr
    const nc = kingCol + dc
    
    if (nr >= 0 && nr < 9 && nc >= 0 && nc < 9) {
      const piece = board[nr][nc]
      if (!piece) {
        details.escapeRoutes += 10  // 逃げ道がある
      } else if (piece.owner === player) {
        // 守り駒の価値（金銀が高い）
        if (piece.type === 'gold' || piece.type === 'silver' || 
            piece.type === 'promotedSilver' || piece.type === 'promotedKnight' || 
            piece.type === 'promotedLance' || piece.type === 'promotedPawn') {
          details.defenders += 25
        } else {
          details.defenders += 10
        }
      }
    }
  }
  
  // 囲いのパターン認識（簡易版）
  const opponent = player === 'sente' ? 'gote' : 'sente'
  
  // 敵の大駒の存在をチェック
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col]
      if (piece && piece.owner === opponent) {
        if (piece.type === 'rook' || piece.type === 'promotedRook') {
          // 飛車が玉と同じ筋または段にいると危険
          if (row === kingRow || col === kingCol) {
            details.attackers -= 40
          }
        }
        if (piece.type === 'bishop' || piece.type === 'promotedBishop') {
          // 角が玉の斜めラインにいると危険
          if (Math.abs(row - kingRow) === Math.abs(col - kingCol)) {
            details.attackers -= 30
          }
        }
      }
    }
  }
  
  const score = details.position + details.defenders + details.attackers + details.escapeRoutes
  return { score, details }
}

// ========================================
// 駒の働き評価
// ========================================

function evaluatePieceActivity(board: GameState['board'], player: Player): number {
  let activity = 0
  
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col]
      if (!piece || piece.owner !== player) continue
      
      // 大駒が敵陣に近いほど活発
      if (piece.type === 'rook' || piece.type === 'promotedRook' ||
          piece.type === 'bishop' || piece.type === 'promotedBishop') {
        if (player === 'sente') {
          activity += (8 - row) * 3  // 前にいるほど加点
        } else {
          activity += row * 3
        }
      }
      
      // 成り駒は活発
      if (piece.type.startsWith('promoted')) {
        activity += 15
      }
    }
  }
  
  return activity
}

// ========================================
// 総合評価関数
// ========================================

export interface EvaluationResult {
  score: number
  breakdown: {
    material: number
    position: number
    kingSafety: { sente: number; gote: number }
    activity: { sente: number; gote: number }
    check: number
  }
}

/**
 * 盤面を総合評価（正の値は先手有利、負の値は後手有利）
 */
export function evaluatePosition(state: GameState): EvaluationResult {
  const { board, hands } = state
  const breakdown = {
    material: 0,
    position: 0,
    kingSafety: { sente: 0, gote: 0 },
    activity: { sente: 0, gote: 0 },
    check: 0,
  }

  // 1. 駒の価値（Material）
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col]
      if (!piece) continue

      const pieceValue = PIECE_VALUES[piece.type]
      const multiplier = piece.owner === 'sente' ? 1 : -1

      breakdown.material += pieceValue * multiplier
      
      // 位置ボーナス
      if (piece.type !== 'king') {
        breakdown.position += getPositionBonus(piece.type, row, col, piece.owner) * multiplier
      }
    }
  }

  // 持ち駒の価値
  const handTypes = ['rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn'] as const
  for (const type of handTypes) {
    breakdown.material += hands.sente[type] * HAND_PIECE_VALUES[type]
    breakdown.material -= hands.gote[type] * HAND_PIECE_VALUES[type]
  }

  // 2. 玉の安全度
  const senteSafety = evaluateKingSafety(board, 'sente')
  const goteSafety = evaluateKingSafety(board, 'gote')
  breakdown.kingSafety.sente = senteSafety.score
  breakdown.kingSafety.gote = goteSafety.score

  // 3. 駒の働き
  breakdown.activity.sente = evaluatePieceActivity(board, 'sente')
  breakdown.activity.gote = evaluatePieceActivity(board, 'gote')

  // 4. 王手状態
  if (isInCheck(board, 'sente')) breakdown.check -= 150
  if (isInCheck(board, 'gote')) breakdown.check += 150

  // 総合スコア計算
  const score = 
    breakdown.material +
    breakdown.position +
    (breakdown.kingSafety.sente - breakdown.kingSafety.gote) +
    (breakdown.activity.sente - breakdown.activity.gote) +
    breakdown.check

  return { score, breakdown }
}

/**
 * 簡易評価（高速版）
 */
export function quickEvaluate(state: GameState): number {
  const { board, hands } = state
  let score = 0

  // 駒の価値のみ
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col]
      if (piece) {
        const value = PIECE_VALUES[piece.type]
        score += piece.owner === 'sente' ? value : -value
      }
    }
  }

  const handTypes = ['rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn'] as const
  for (const type of handTypes) {
    score += hands.sente[type] * HAND_PIECE_VALUES[type]
    score -= hands.gote[type] * HAND_PIECE_VALUES[type]
  }

  return score
}

/**
 * 形勢を日本語で表現
 */
export function getEvaluationText(score: number): string {
  if (score > 1000) return '先手優勢'
  if (score > 300) return '先手有利'
  if (score > 100) return '先手やや有利'
  if (score > -100) return '互角'
  if (score > -300) return '後手やや有利'
  if (score > -1000) return '後手有利'
  return '後手優勢'
}
