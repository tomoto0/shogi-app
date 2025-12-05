// 駒の移動ルール定義
// 将棋の全8種類の駒（+成り駒6種類）の移動パターンを定義

import type { AllPieceType, Position, Player, Board } from '../types';
import { isValidPosition, getPieceAt } from './board';

// ========================================
// 移動方向の定義
// ========================================

/** 移動方向（先手視点） */
interface Direction {
  col: number; // 筋の変化（正=右、負=左）
  row: number; // 段の変化（正=下、負=上）
}

/** 移動タイプ */
type MoveType = 'step' | 'slide';

/** 駒の移動パターン */
interface MovePattern {
  direction: Direction;
  type: MoveType;
}

// ========================================
// 基本方向の定義
// ========================================

const DIRECTIONS = {
  // 前後左右
  UP: { col: 0, row: -1 },
  DOWN: { col: 0, row: 1 },
  LEFT: { col: -1, row: 0 },
  RIGHT: { col: 1, row: 0 },
  
  // 斜め
  UP_LEFT: { col: -1, row: -1 },
  UP_RIGHT: { col: 1, row: -1 },
  DOWN_LEFT: { col: -1, row: 1 },
  DOWN_RIGHT: { col: 1, row: 1 },
  
  // 桂馬
  KNIGHT_LEFT: { col: -1, row: -2 },
  KNIGHT_RIGHT: { col: 1, row: -2 },
} as const;

// ========================================
// 各駒の移動パターン定義
// ========================================

/**
 * 玉将（王将）の移動パターン
 * 全方向に1マス移動可能
 */
const KING_MOVES: MovePattern[] = [
  { direction: DIRECTIONS.UP, type: 'step' },
  { direction: DIRECTIONS.DOWN, type: 'step' },
  { direction: DIRECTIONS.LEFT, type: 'step' },
  { direction: DIRECTIONS.RIGHT, type: 'step' },
  { direction: DIRECTIONS.UP_LEFT, type: 'step' },
  { direction: DIRECTIONS.UP_RIGHT, type: 'step' },
  { direction: DIRECTIONS.DOWN_LEFT, type: 'step' },
  { direction: DIRECTIONS.DOWN_RIGHT, type: 'step' },
];

/**
 * 飛車の移動パターン
 * 縦横に何マスでも移動可能
 */
const ROOK_MOVES: MovePattern[] = [
  { direction: DIRECTIONS.UP, type: 'slide' },
  { direction: DIRECTIONS.DOWN, type: 'slide' },
  { direction: DIRECTIONS.LEFT, type: 'slide' },
  { direction: DIRECTIONS.RIGHT, type: 'slide' },
];

/**
 * 龍王（成り飛車）の移動パターン
 * 飛車の動き + 斜め1マス
 */
const PROMOTED_ROOK_MOVES: MovePattern[] = [
  ...ROOK_MOVES,
  { direction: DIRECTIONS.UP_LEFT, type: 'step' },
  { direction: DIRECTIONS.UP_RIGHT, type: 'step' },
  { direction: DIRECTIONS.DOWN_LEFT, type: 'step' },
  { direction: DIRECTIONS.DOWN_RIGHT, type: 'step' },
];

/**
 * 角行の移動パターン
 * 斜めに何マスでも移動可能
 */
const BISHOP_MOVES: MovePattern[] = [
  { direction: DIRECTIONS.UP_LEFT, type: 'slide' },
  { direction: DIRECTIONS.UP_RIGHT, type: 'slide' },
  { direction: DIRECTIONS.DOWN_LEFT, type: 'slide' },
  { direction: DIRECTIONS.DOWN_RIGHT, type: 'slide' },
];

/**
 * 龍馬（成り角）の移動パターン
 * 角の動き + 縦横1マス
 */
const PROMOTED_BISHOP_MOVES: MovePattern[] = [
  ...BISHOP_MOVES,
  { direction: DIRECTIONS.UP, type: 'step' },
  { direction: DIRECTIONS.DOWN, type: 'step' },
  { direction: DIRECTIONS.LEFT, type: 'step' },
  { direction: DIRECTIONS.RIGHT, type: 'step' },
];

/**
 * 金将の移動パターン
 * 前、左右前、左右、後ろの6方向に1マス移動可能
 */
const GOLD_MOVES: MovePattern[] = [
  { direction: DIRECTIONS.UP, type: 'step' },
  { direction: DIRECTIONS.UP_LEFT, type: 'step' },
  { direction: DIRECTIONS.UP_RIGHT, type: 'step' },
  { direction: DIRECTIONS.LEFT, type: 'step' },
  { direction: DIRECTIONS.RIGHT, type: 'step' },
  { direction: DIRECTIONS.DOWN, type: 'step' },
];

/**
 * 銀将の移動パターン
 * 前と斜め4方向に1マス移動可能
 */
const SILVER_MOVES: MovePattern[] = [
  { direction: DIRECTIONS.UP, type: 'step' },
  { direction: DIRECTIONS.UP_LEFT, type: 'step' },
  { direction: DIRECTIONS.UP_RIGHT, type: 'step' },
  { direction: DIRECTIONS.DOWN_LEFT, type: 'step' },
  { direction: DIRECTIONS.DOWN_RIGHT, type: 'step' },
];

/**
 * 桂馬の移動パターン
 * 前方2マス+左右1マスの2箇所へジャンプ
 */
const KNIGHT_MOVES: MovePattern[] = [
  { direction: DIRECTIONS.KNIGHT_LEFT, type: 'step' },
  { direction: DIRECTIONS.KNIGHT_RIGHT, type: 'step' },
];

/**
 * 香車の移動パターン
 * 前方に何マスでも移動可能
 */
const LANCE_MOVES: MovePattern[] = [
  { direction: DIRECTIONS.UP, type: 'slide' },
];

/**
 * 歩兵の移動パターン
 * 前方1マスのみ
 */
const PAWN_MOVES: MovePattern[] = [
  { direction: DIRECTIONS.UP, type: 'step' },
];

// ========================================
// 駒タイプ → 移動パターンのマッピング
// ========================================

const PIECE_MOVES: Record<AllPieceType, MovePattern[]> = {
  king: KING_MOVES,
  rook: ROOK_MOVES,
  bishop: BISHOP_MOVES,
  gold: GOLD_MOVES,
  silver: SILVER_MOVES,
  knight: KNIGHT_MOVES,
  lance: LANCE_MOVES,
  pawn: PAWN_MOVES,
  promotedRook: PROMOTED_ROOK_MOVES,
  promotedBishop: PROMOTED_BISHOP_MOVES,
  promotedSilver: GOLD_MOVES, // 成銀は金と同じ動き
  promotedKnight: GOLD_MOVES, // 成桂は金と同じ動き
  promotedLance: GOLD_MOVES,  // 成香は金と同じ動き
  promotedPawn: GOLD_MOVES,   // と金は金と同じ動き
};

// ========================================
// 移動可能位置の計算
// ========================================

/**
 * 方向を所有者に応じて調整（後手は反転）
 */
function adjustDirectionForPlayer(direction: Direction, owner: Player): Direction {
  if (owner === 'gote') {
    return {
      col: -direction.col,
      row: -direction.row,
    };
  }
  return direction;
}

/**
 * 指定した駒が移動可能な全位置を取得（王手無視版）
 * 自駒のある場所には移動不可、敵駒のある場所は移動可（取れる）
 */
export function getRawMoves(
  board: Board,
  from: Position,
  pieceType: AllPieceType,
  owner: Player
): Position[] {
  const moves: Position[] = [];
  const patterns = PIECE_MOVES[pieceType];

  for (const pattern of patterns) {
    const adjustedDir = adjustDirectionForPlayer(pattern.direction, owner);
    
    if (pattern.type === 'step') {
      // 1マスのみの移動
      const newCol = from.col + adjustedDir.col;
      const newRow = from.row + adjustedDir.row;
      
      if (isValidPosition(newCol, newRow)) {
        const targetPos: Position = { col: newCol as 1|2|3|4|5|6|7|8|9, row: newRow as 1|2|3|4|5|6|7|8|9 };
        const targetPiece = getPieceAt(board, targetPos);
        
        // 自駒がなければ移動可能
        if (!targetPiece || targetPiece.owner !== owner) {
          moves.push(targetPos);
        }
      }
    } else {
      // 連続移動（飛車、角、香車）
      let currentCol = from.col + adjustedDir.col;
      let currentRow = from.row + adjustedDir.row;
      
      while (isValidPosition(currentCol, currentRow)) {
        const targetPos: Position = { col: currentCol as 1|2|3|4|5|6|7|8|9, row: currentRow as 1|2|3|4|5|6|7|8|9 };
        const targetPiece = getPieceAt(board, targetPos);
        
        if (!targetPiece) {
          // 空きマスなら移動可能、さらに先へ進める
          moves.push(targetPos);
        } else if (targetPiece.owner !== owner) {
          // 敵駒なら取れる、そこで止まる
          moves.push(targetPos);
          break;
        } else {
          // 自駒がある、そこで止まる
          break;
        }
        
        currentCol += adjustedDir.col;
        currentRow += adjustedDir.row;
      }
    }
  }

  return moves;
}

/**
 * 駒が特定の位置に移動できるかチェック
 */
export function canMoveTo(
  board: Board,
  from: Position,
  to: Position,
  pieceType: AllPieceType,
  owner: Player
): boolean {
  const moves = getRawMoves(board, from, pieceType, owner);
  return moves.some(m => m.col === to.col && m.row === to.row);
}

/**
 * 移動不能になる位置かチェック（桂馬、香車、歩）
 * - 先手：1段目（歩・香）、1-2段目（桂）
 * - 後手：9段目（歩・香）、8-9段目（桂）
 */
export function isDeadPosition(
  pieceType: AllPieceType,
  to: Position,
  owner: Player
): boolean {
  if (owner === 'sente') {
    if (pieceType === 'pawn' || pieceType === 'lance') {
      return to.row === 1;
    }
    if (pieceType === 'knight') {
      return to.row <= 2;
    }
  } else {
    if (pieceType === 'pawn' || pieceType === 'lance') {
      return to.row === 9;
    }
    if (pieceType === 'knight') {
      return to.row >= 8;
    }
  }
  return false;
}

/**
 * 成りが可能な移動かチェック
 * 敵陣3段に入る、または敵陣3段から出る時に成れる
 */
export function canPromoteMove(
  from: Position,
  to: Position,
  owner: Player
): boolean {
  if (owner === 'sente') {
    // 先手は1-3段目が敵陣
    return from.row <= 3 || to.row <= 3;
  } else {
    // 後手は7-9段目が敵陣
    return from.row >= 7 || to.row >= 7;
  }
}

/**
 * 成りが必須な移動かチェック（移動不能になる場合）
 */
export function mustPromote(
  pieceType: AllPieceType,
  to: Position,
  owner: Player
): boolean {
  return isDeadPosition(pieceType, to, owner);
}

// エクスポート
export { PIECE_MOVES, DIRECTIONS };
export type { Direction, MoveType, MovePattern };
