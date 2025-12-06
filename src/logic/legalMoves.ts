// 合法手生成ロジック
// 王手を考慮した完全な合法手生成

import type {
  Board,
  Position,
  Player,
  Piece,
  Move,
  MoveAction,
  DropAction,
  Hand,
  HandPieceType,
  GameState,
  Column,
  Row,
} from '../types';
import {
  getPieceAt,
  cloneBoard,
  positionToIndex,
  indexToPosition,
  promotePiece,
  canPromote,
  isPromotedPiece,
} from './board';
import {
  getRawMoves,
  canPromoteMove,
  mustPromote,
  isDeadPosition,
} from './moves';

// ========================================
// 王の位置を取得
// ========================================

/**
 * 指定プレイヤーの玉の位置を取得
 */
export function findKingPosition(board: Board, player: Player): Position | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'king' && piece.owner === player) {
        return indexToPosition(row, col);
      }
    }
  }
  return null;
}

// ========================================
// 王手判定
// ========================================

/**
 * 指定位置が敵駒から攻撃されているかチェック
 */
export function isSquareAttacked(
  board: Board,
  targetPos: Position,
  byPlayer: Player
): boolean {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece && piece.owner === byPlayer) {
        const from = indexToPosition(row, col);
        const moves = getRawMoves(board, from, piece.type, byPlayer);
        if (moves.some(m => m.col === targetPos.col && m.row === targetPos.row)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * 指定プレイヤーの玉が王手されているかチェック
 */
export function isInCheck(board: Board, player: Player): boolean {
  const kingPos = findKingPosition(board, player);
  if (!kingPos) return false; // 玉がない（テスト用など）
  
  const opponent = player === 'sente' ? 'gote' : 'sente';
  return isSquareAttacked(board, kingPos, opponent);
}

// ========================================
// 手を適用
// ========================================

/**
 * 駒を動かす手を適用（新しい盤面を返す）
 */
export function applyMove(
  board: Board,
  move: MoveAction
): { newBoard: Board; captured: Piece | null } {
  const newBoard = cloneBoard(board);
  const { rowIndex: fromRow, colIndex: fromCol } = positionToIndex(move.from);
  const { rowIndex: toRow, colIndex: toCol } = positionToIndex(move.to);
  
  const movingPiece = newBoard[fromRow][fromCol];
  const captured = newBoard[toRow][toCol];
  
  // 駒を移動
  newBoard[fromRow][fromCol] = null;
  
  if (movingPiece) {
    // 成りの処理
    if (move.promote && canPromote(movingPiece.type) && !isPromotedPiece(movingPiece.type)) {
      newBoard[toRow][toCol] = {
        ...movingPiece,
        type: promotePiece(movingPiece.type as any),
        isPromoted: true,
      };
    } else {
      newBoard[toRow][toCol] = movingPiece;
    }
  }
  
  return { newBoard, captured };
}

/**
 * 駒を打つ手を適用（新しい盤面を返す）
 */
export function applyDrop(
  board: Board,
  drop: DropAction,
  player: Player
): Board {
  const newBoard = cloneBoard(board);
  const { rowIndex, colIndex } = positionToIndex(drop.to);
  
  newBoard[rowIndex][colIndex] = {
    type: drop.piece,
    owner: player,
    isPromoted: false,
  };
  
  return newBoard;
}

// ========================================
// 合法手判定
// ========================================

/**
 * 駒を動かす手が合法かチェック（自玉を王手に晒さない）
 */
export function isLegalMove(
  board: Board,
  move: MoveAction,
  player: Player
): boolean {
  const { newBoard } = applyMove(board, move);
  return !isInCheck(newBoard, player);
}

/**
 * 駒を打つ手が合法かチェック
 */
export function isLegalDrop(
  board: Board,
  drop: DropAction,
  player: Player,
  hand: Hand
): boolean {
  // 持ち駒を持っているか
  if (hand[drop.piece] <= 0) return false;
  
  // 打つ位置が空いているか
  const targetPiece = getPieceAt(board, drop.to);
  if (targetPiece) return false;
  
  // 移動不能位置への打ちは禁止
  if (isDeadPosition(drop.piece, drop.to, player)) return false;
  
  // 二歩チェック
  if (drop.piece === 'pawn') {
    const { colIndex } = positionToIndex(drop.to);
    for (let row = 0; row < 9; row++) {
      const piece = board[row][colIndex];
      if (piece && piece.type === 'pawn' && piece.owner === player && !piece.isPromoted) {
        return false; // 同じ筋に自分の歩がある
      }
    }
  }
  
  // 打ち歩詰めチェック
  if (drop.piece === 'pawn') {
    const newBoard = applyDrop(board, drop, player);
    const opponent = player === 'sente' ? 'gote' : 'sente';
    
    // 相手の玉が詰みになるかチェック
    if (isCheckmate(newBoard, opponent)) {
      return false; // 打ち歩詰め
    }
  }
  
  // 自玉を王手に晒さないかチェック
  const newBoard = applyDrop(board, drop, player);
  return !isInCheck(newBoard, player);
}

// ========================================
// 合法手生成
// ========================================

/**
 * 指定駒の全合法手を生成
 */
export function getLegalMovesForPiece(
  board: Board,
  from: Position,
  player: Player
): MoveAction[] {
  const piece = getPieceAt(board, from);
  if (!piece || piece.owner !== player) return [];
  
  const rawMoves = getRawMoves(board, from, piece.type, player);
  const legalMoves: MoveAction[] = [];
  
  for (const to of rawMoves) {
    const targetPiece = getPieceAt(board, to);
    const captured = targetPiece?.type;
    
    // 成れるかどうか
    const canProm = canPromote(piece.type) && 
                    !isPromotedPiece(piece.type) && 
                    canPromoteMove(from, to, player);
    
    // 成らないと進めない場合
    const mustProm = mustPromote(piece.type, to, player);
    
    if (canProm) {
      // 成りの手
      const promoteMove: MoveAction = {
        type: 'move',
        from,
        to,
        piece: piece.type,
        captured,
        promote: true,
      };
      if (isLegalMove(board, promoteMove, player)) {
        legalMoves.push(promoteMove);
      }
      
      // 成らない手（成り必須でない場合）
      if (!mustProm) {
        const noPromoteMove: MoveAction = {
          type: 'move',
          from,
          to,
          piece: piece.type,
          captured,
          promote: false,
        };
        if (isLegalMove(board, noPromoteMove, player)) {
          legalMoves.push(noPromoteMove);
        }
      }
    } else {
      // 成れない手
      const move: MoveAction = {
        type: 'move',
        from,
        to,
        piece: piece.type,
        captured,
        promote: false,
      };
      if (isLegalMove(board, move, player)) {
        legalMoves.push(move);
      }
    }
  }
  
  return legalMoves;
}

/**
 * 持ち駒を打つ全合法手を生成
 */
export function getLegalDrops(
  board: Board,
  player: Player,
  hand: Hand
): DropAction[] {
  const drops: DropAction[] = [];
  const handPieces: HandPieceType[] = ['rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn'];
  
  for (const pieceType of handPieces) {
    if (hand[pieceType] <= 0) continue;
    
    for (let row = 1; row <= 9; row++) {
      for (let col = 1; col <= 9; col++) {
        const to: Position = { col: col as Column, row: row as Row };
        const drop: DropAction = {
          type: 'drop',
          to,
          piece: pieceType,
        };
        
        if (isLegalDrop(board, drop, player, hand)) {
          drops.push(drop);
        }
      }
    }
  }
  
  return drops;
}

/**
 * 全合法手を生成
 */
export function getAllLegalMoves(state: GameState): Move[] {
  const { board, hands, currentPlayer } = state;
  const moves: Move[] = [];
  
  // 盤上の駒を動かす手
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece && piece.owner === currentPlayer) {
        const from = indexToPosition(row, col);
        const pieceMoves = getLegalMovesForPiece(board, from, currentPlayer);
        moves.push(...pieceMoves);
      }
    }
  }
  
  // 持ち駒を打つ手
  const drops = getLegalDrops(board, currentPlayer, hands[currentPlayer]);
  moves.push(...drops);
  
  return moves;
}

// ========================================
// 詰み判定
// ========================================

/**
 * 詰みかどうかチェック（持ち駒を打つ手も考慮した完全版）
 */
export function isCheckmate(board: Board, player: Player, hand?: Hand): boolean {
  // 王手されているか
  if (!isInCheck(board, player)) return false;
  
  // 1. 駒を動かして王手を回避できるかチェック
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece && piece.owner === player) {
        const from = indexToPosition(row, col);
        const rawMoves = getRawMoves(board, from, piece.type, player);
        
        for (const to of rawMoves) {
          const move: MoveAction = {
            type: 'move',
            from,
            to,
            piece: piece.type,
            promote: false,
          };
          
          if (isLegalMove(board, move, player)) {
            return false; // 逃げる手がある
          }
          
          // 成りの手もチェック
          if (canPromote(piece.type) && !isPromotedPiece(piece.type)) {
            const promoteMove: MoveAction = {
              type: 'move',
              from,
              to,
              piece: piece.type,
              promote: true,
            };
            if (isLegalMove(board, promoteMove, player)) {
              return false; // 成って逃げる手がある
            }
          }
        }
      }
    }
  }
  
  // 2. 持ち駒を打って王手を回避できるかチェック
  if (hand) {
    const handPieces: HandPieceType[] = ['rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn'];
    
    for (const pieceType of handPieces) {
      if (hand[pieceType] <= 0) continue;
      
      for (let row = 1; row <= 9; row++) {
        for (let col = 1; col <= 9; col++) {
          const to: Position = { col: col as Column, row: row as Row };
          const drop: DropAction = {
            type: 'drop',
            to,
            piece: pieceType,
          };
          
          // 打てる場所かチェック（打ち歩詰めチェックは除外して判定）
          if (isLegalDropForCheckEscape(board, drop, player, hand)) {
            return false; // 駒を打って逃げる手がある
          }
        }
      }
    }
  }
  
  return true; // 逃げる手がない = 詰み
}

/**
 * 王手回避のための駒打ちが合法かチェック（打ち歩詰めチェックは行わない）
 * isCheckmateから呼ばれる際に、無限ループを防ぐため
 */
function isLegalDropForCheckEscape(
  board: Board,
  drop: DropAction,
  player: Player,
  hand: Hand
): boolean {
  // 持ち駒を持っているか
  if (hand[drop.piece] <= 0) return false;
  
  // 打つ位置が空いているか
  const targetPiece = getPieceAt(board, drop.to);
  if (targetPiece) return false;
  
  // 移動不能位置への打ちは禁止
  if (isDeadPosition(drop.piece, drop.to, player)) return false;
  
  // 二歩チェック
  if (drop.piece === 'pawn') {
    const { colIndex } = positionToIndex(drop.to);
    for (let row = 0; row < 9; row++) {
      const piece = board[row][colIndex];
      if (piece && piece.type === 'pawn' && piece.owner === player && !piece.isPromoted) {
        return false;
      }
    }
  }
  
  // 自玉を王手から救えるかチェック
  const newBoard = applyDrop(board, drop, player);
  return !isInCheck(newBoard, player);
}

/**
 * ステイルメート（手番側が王手されていないが合法手がない）
 */
export function isStalemate(state: GameState): boolean {
  const { board, currentPlayer } = state;
  
  // 王手されている場合はステイルメートではない
  if (isInCheck(board, currentPlayer)) return false;
  
  // 合法手があるかチェック
  const moves = getAllLegalMoves(state);
  return moves.length === 0;
}

// ========================================
// 指定位置への合法手があるか（UI用）
// ========================================

/**
 * 指定駒が移動できる合法な位置リストを取得（UI表示用）
 */
export function getLegalDestinations(
  board: Board,
  from: Position,
  player: Player
): Position[] {
  const moves = getLegalMovesForPiece(board, from, player);
  // 重複を除去（成り/不成で同じ位置が複数回出る可能性）
  const destinations = new Map<string, Position>();
  for (const move of moves) {
    const key = `${move.to.col}-${move.to.row}`;
    if (!destinations.has(key)) {
      destinations.set(key, move.to);
    }
  }
  return Array.from(destinations.values());
}
