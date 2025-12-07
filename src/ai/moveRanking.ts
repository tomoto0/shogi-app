// 将棋AI - 候補手絞り込みモジュール
// ヒューリスティックに基づいて有望な手を優先順位付け

import type { GameState, Move, Player } from '../types'
import { isInCheck, applyMove, applyDrop, getAllLegalMoves } from '../logic/legalMoves'
import { PIECE_VALUES } from './evaluation'

// ========================================
// 手のスコアリング基準
// ========================================

export interface MoveScore {
  move: Move
  score: number
  features: string[]
  priority: 'critical' | 'high' | 'medium' | 'low'
}

// ========================================
// ヒューリスティック評価
// ========================================

/**
 * 王手をかける手かチェック
 */
function isCheckingMove(state: GameState, move: Move): boolean {
  const { board, currentPlayer } = state
  const opponent = currentPlayer === 'sente' ? 'gote' : 'sente'
  
  let newBoard: GameState['board']
  
  if (move.type === 'move') {
    const result = applyMove(board, move)
    newBoard = result.newBoard
  } else {
    newBoard = applyDrop(board, move, currentPlayer)
  }
  
  return isInCheck(newBoard, opponent)
}

/**
 * 詰みの可能性がある手かチェック（簡易版）
 */
function isThreatening(state: GameState, move: Move): boolean {
  // 王手をかける手は脅威
  if (isCheckingMove(state, move)) return true
  
  // 大駒を敵陣に打ち込む手
  if (move.type === 'drop') {
    const isInEnemyTerritory = state.currentPlayer === 'sente' 
      ? move.to.row <= 2 
      : move.to.row >= 6
    
    if ((move.piece === 'rook' || move.piece === 'bishop') && isInEnemyTerritory) {
      return true
    }
  }
  
  return false
}

/**
 * 成れる手かチェック
 */
function canPromote(move: Move, player: Player): boolean {
  if (move.type !== 'move' || move.promote) return move.type === 'move' && move.promote === true
  
  // 成れる位置にいる・移動する
  if (player === 'sente') {
    return move.from.row <= 2 || move.to.row <= 2
  } else {
    return move.from.row >= 6 || move.to.row >= 6
  }
}

/**
 * 駒の効きの中心への移動かチェック
 */
function movesToCenter(move: Move): boolean {
  const col = move.to.col
  const row = move.to.row
  // 中央3x3マス
  return col >= 3 && col <= 5 && row >= 3 && row <= 5
}

/**
 * 守備的な手かチェック（自陣への移動）
 */
export function isDefensiveMove(move: Move, player: Player): boolean {
  if (player === 'sente') {
    return move.to.row >= 6  // 7-9段目
  } else {
    return move.to.row <= 2  // 1-3段目
  }
}

// ========================================
// 手のスコアリング
// ========================================

/**
 * 単一の手をスコアリング
 */
export function scoreMove(state: GameState, move: Move): MoveScore {
  const { currentPlayer, isCheck } = state
  let score = 0
  const features: string[] = []
  
  // 1. 王手回避は最優先
  if (isCheck) {
    // 王手がかかっている場合、すべての手が王手回避
    score += 5000
    features.push('王手回避')
  }
  
  // 2. 駒取り
  if (move.type === 'move' && move.captured) {
    const captureValue = PIECE_VALUES[move.captured]
    score += captureValue * 2  // 駒取りは高評価
    features.push(`${move.captured}取り`)
    
    // 大駒取りは特に重要
    if (move.captured === 'rook' || move.captured === 'promotedRook') {
      score += 500
      features.push('飛車取り！')
    } else if (move.captured === 'bishop' || move.captured === 'promotedBishop') {
      score += 400
      features.push('角取り！')
    }
  }
  
  // 3. 王手
  if (isCheckingMove(state, move)) {
    score += 300
    features.push('王手')
  }
  
  // 4. 成り
  if (move.type === 'move' && move.promote) {
    score += 200
    features.push('成り')
    
    // 大駒の成りは特に価値が高い
    if (move.piece === 'rook' || move.piece === 'bishop') {
      score += 150
    }
  }
  
  // 5. 脅威を与える手
  if (isThreatening(state, move)) {
    score += 100
    features.push('脅威')
  }
  
  // 6. 中央制圧
  if (movesToCenter(move)) {
    score += 30
    features.push('中央')
  }
  
  // 7. 駒打ち（持ち駒の活用）
  if (move.type === 'drop') {
    score += 20
    features.push('駒打ち')
    
    // 大駒の打ち込みは特に重要
    if (move.piece === 'rook' || move.piece === 'bishop') {
      score += 100
    }
  }
  
  // 8. 成れる位置への移動（成らない選択）
  if (move.type === 'move' && !move.promote && canPromote(move, currentPlayer)) {
    // あえて成らない手は通常低評価（不成りが有効なケースもあるが）
    score -= 50
  }
  
  // 優先度を決定
  let priority: 'critical' | 'high' | 'medium' | 'low'
  if (score >= 2000) priority = 'critical'
  else if (score >= 500) priority = 'high'
  else if (score >= 100) priority = 'medium'
  else priority = 'low'
  
  return { move, score, features, priority }
}

/**
 * すべての合法手をスコアリングして優先順位付け
 */
export function rankMoves(state: GameState): MoveScore[] {
  const legalMoves = getAllLegalMoves(state)
  
  const scoredMoves = legalMoves.map(move => scoreMove(state, move))
  
  // スコアでソート（降順）
  scoredMoves.sort((a, b) => b.score - a.score)
  
  return scoredMoves
}

/**
 * 上位N手を取得
 */
export function getTopMoves(state: GameState, n: number = 20): MoveScore[] {
  const ranked = rankMoves(state)
  return ranked.slice(0, Math.min(n, ranked.length))
}

/**
 * 重要な手のみを抽出（critical + high）
 */
export function getCriticalMoves(state: GameState): MoveScore[] {
  const ranked = rankMoves(state)
  return ranked.filter(m => m.priority === 'critical' || m.priority === 'high')
}

// ========================================
// 読み筋用のフィルタリング
// ========================================

/**
 * 静止探索用：激しい手（駒取り、王手）のみを抽出
 */
export function getQuiescentMoves(state: GameState): MoveScore[] {
  const ranked = rankMoves(state)
  
  return ranked.filter(m => {
    // 駒取り
    if (m.move.type === 'move' && m.move.captured) return true
    // 王手
    if (m.features.includes('王手')) return true
    // 成り（大駒のみ）
    if (m.move.type === 'move' && m.move.promote && 
        (m.move.piece === 'rook' || m.move.piece === 'bishop')) return true
    return false
  })
}

/**
 * 候補手を日本語で説明
 */
export function describeMoves(moves: MoveScore[], maxCount: number = 5): string[] {
  return moves.slice(0, maxCount).map((m, i) => {
    const moveText = m.move.type === 'move'
      ? `${m.move.from.col}${m.move.from.row}→${m.move.to.col}${m.move.to.row}${m.move.promote ? '成' : ''}`
      : `${m.move.to.col}${m.move.to.row}${m.move.piece}打`
    
    const featureText = m.features.length > 0 ? `（${m.features.join('、')}）` : ''
    
    return `${i + 1}. ${moveText}${featureText} [${m.score}点]`
  })
}
