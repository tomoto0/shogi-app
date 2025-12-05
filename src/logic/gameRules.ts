// ゲームルール判定ロジック
// 王手・詰み・千日手・反則判定

import type {
  Board,
  Player,
  Hand,
  GameState,
  GameResult,
  AllPieceType,
  Piece,
} from '../types';
import {
  isInCheck,
  isCheckmate,
  isStalemate,
} from './legalMoves';

// ========================================
// SFEN変換（局面表記）
// ========================================

/**
 * 駒をSFEN形式の文字に変換
 */
function pieceToSfen(piece: Piece): string {
  const pieceMap: Record<AllPieceType, string> = {
    king: 'K',
    rook: 'R',
    bishop: 'B',
    gold: 'G',
    silver: 'S',
    knight: 'N',
    lance: 'L',
    pawn: 'P',
    promotedRook: '+R',
    promotedBishop: '+B',
    promotedSilver: '+S',
    promotedKnight: '+N',
    promotedLance: '+L',
    promotedPawn: '+P',
  };
  
  const sfenChar = pieceMap[piece.type];
  // 後手は小文字
  return piece.owner === 'sente' ? sfenChar : sfenChar.toLowerCase();
}

/**
 * 盤面をSFEN形式に変換
 */
export function boardToSfen(board: Board): string {
  const rows: string[] = [];
  
  for (let row = 0; row < 9; row++) {
    let rowStr = '';
    let emptyCount = 0;
    
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece === null) {
        emptyCount++;
      } else {
        if (emptyCount > 0) {
          rowStr += emptyCount.toString();
          emptyCount = 0;
        }
        rowStr += pieceToSfen(piece);
      }
    }
    
    if (emptyCount > 0) {
      rowStr += emptyCount.toString();
    }
    
    rows.push(rowStr);
  }
  
  return rows.join('/');
}

/**
 * 持ち駒をSFEN形式に変換
 */
export function handsToSfen(hands: { sente: Hand; gote: Hand }): string {
  const pieces = ['rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn'] as const;
  const sfenMap = {
    rook: 'R',
    bishop: 'B',
    gold: 'G',
    silver: 'S',
    knight: 'N',
    lance: 'L',
    pawn: 'P',
  };
  
  let result = '';
  
  // 先手の持ち駒
  for (const piece of pieces) {
    const count = hands.sente[piece];
    if (count > 0) {
      if (count > 1) {
        result += count.toString();
      }
      result += sfenMap[piece];
    }
  }
  
  // 後手の持ち駒
  for (const piece of pieces) {
    const count = hands.gote[piece];
    if (count > 0) {
      if (count > 1) {
        result += count.toString();
      }
      result += sfenMap[piece].toLowerCase();
    }
  }
  
  return result || '-';
}

/**
 * ゲーム状態をSFEN形式に変換（千日手判定用）
 * 形式: 盤面 手番 持ち駒
 */
export function gameStateToSfen(state: GameState): string {
  const boardSfen = boardToSfen(state.board);
  const turn = state.currentPlayer === 'sente' ? 'b' : 'w';
  const handsSfen = handsToSfen(state.hands);
  
  return `${boardSfen} ${turn} ${handsSfen}`;
}

// ========================================
// 千日手判定
// ========================================

/**
 * 同一局面が指定回数以上繰り返されているかチェック
 */
export function countPositionRepetitions(
  positionHistory: string[],
  currentPosition: string
): number {
  let count = 0;
  for (const pos of positionHistory) {
    if (pos === currentPosition) {
      count++;
    }
  }
  // 現在の局面もカウント
  return count + 1;
}

/**
 * 千日手かどうかチェック（同一局面4回で千日手成立）
 */
export function isRepetition(state: GameState): boolean {
  const currentSfen = gameStateToSfen(state);
  const repetitionCount = countPositionRepetitions(state.positionHistory, currentSfen);
  return repetitionCount >= 4;
}

/**
 * 連続王手の千日手かチェック
 * 同一局面4回が全て王手をかけている側の手番だった場合、
 * 王手をかけている側の反則負け
 */
export function isPerpeturalCheck(state: GameState): { isPerpetual: boolean; loser?: Player } {
  const currentSfen = gameStateToSfen(state);
  
  // 現在のプレイヤーが王手されているかチェック
  const opponent = state.currentPlayer === 'sente' ? 'gote' : 'sente';
  const isOpponentChecking = isInCheck(state.board, state.currentPlayer);
  
  if (!isOpponentChecking) {
    return { isPerpetual: false };
  }
  
  // 履歴から同一局面を探す
  let checkCount = 0;
  for (let i = 0; i < state.positionHistory.length; i++) {
    if (state.positionHistory[i] === currentSfen) {
      // この局面でも王手されていたかを確認するのは複雑なため、
      // 簡易版として同一局面の繰り返しのみチェック
      checkCount++;
    }
  }
  
  // 4回以上繰り返しで、かつ王手されている場合は連続王手の千日手
  if (checkCount >= 3) {
    return { isPerpetual: true, loser: opponent };
  }
  
  return { isPerpetual: false };
}

// ========================================
// ゲーム終了判定
// ========================================

/**
 * ゲーム結果を判定
 */
export function checkGameResult(state: GameState): GameResult {
  const { board, currentPlayer } = state;
  const opponent = currentPlayer === 'sente' ? 'gote' : 'sente';
  
  // 詰みチェック
  if (isCheckmate(board, currentPlayer)) {
    return { type: 'checkmate', winner: opponent };
  }
  
  // ステイルメートチェック（将棋では稀）
  if (isStalemate(state)) {
    return { type: 'stalemate', winner: opponent };
  }
  
  // 連続王手の千日手チェック
  const perpetualResult = isPerpeturalCheck(state);
  if (perpetualResult.isPerpetual && perpetualResult.loser) {
    const winner = perpetualResult.loser === 'sente' ? 'gote' : 'sente';
    return { type: 'repetition', result: winner };
  }
  
  // 千日手チェック（引き分け）
  if (isRepetition(state)) {
    return { type: 'repetition', result: 'draw' };
  }
  
  return { type: 'ongoing' };
}

// ========================================
// 王手関連（再エクスポート）
// ========================================

export { isInCheck, isCheckmate, isStalemate } from './legalMoves';

// ========================================
// ゲーム状態更新用ユーティリティ
// ========================================

/**
 * ゲーム進行フェーズを判定
 */
export function determineGamePhase(moveCount: number): GameState['gamePhase'] {
  if (moveCount < 30) {
    return 'opening';
  } else if (moveCount < 80) {
    return 'middlegame';
  } else {
    return 'endgame';
  }
}

/**
 * 王手状態を更新
 */
export function updateCheckStatus(state: GameState): boolean {
  return isInCheck(state.board, state.currentPlayer);
}

/**
 * 入玉判定（玉が敵陣に入っているか）
 */
export function isKingInEnemyTerritory(board: Board, player: Player): boolean {
  // 玉の位置を探す
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece && piece.type === 'king' && piece.owner === player) {
        // 先手なら1-3段目、後手なら7-9段目が敵陣
        if (player === 'sente') {
          return row <= 2; // 0, 1, 2 = 1, 2, 3段目
        } else {
          return row >= 6; // 6, 7, 8 = 7, 8, 9段目
        }
      }
    }
  }
  return false;
}

/**
 * 入玉宣言勝ちの条件を満たしているかチェック
 * （簡易版：両者入玉で点数計算）
 */
export function checkNyugyokuConditions(state: GameState): {
  sentePoints: number;
  gotePoints: number;
  senteInEnemyTerritory: boolean;
  goteInEnemyTerritory: boolean;
} {
  const { board, hands } = state;
  
  // 各プレイヤーの入玉状態
  const senteInEnemyTerritory = isKingInEnemyTerritory(board, 'sente');
  const goteInEnemyTerritory = isKingInEnemyTerritory(board, 'gote');
  
  // 点数計算（敵陣にある駒 + 持ち駒）
  // 飛車・角 = 5点、その他 = 1点
  const calculatePoints = (player: Player): number => {
    let points = 0;
    const promotionZone = player === 'sente' ? [0, 1, 2] : [6, 7, 8];
    
    // 敵陣の駒をカウント
    for (const row of promotionZone) {
      for (let col = 0; col < 9; col++) {
        const piece = board[row][col];
        if (piece && piece.owner === player && piece.type !== 'king') {
          if (piece.type === 'rook' || piece.type === 'bishop' ||
              piece.type === 'promotedRook' || piece.type === 'promotedBishop') {
            points += 5;
          } else {
            points += 1;
          }
        }
      }
    }
    
    // 持ち駒をカウント
    const hand = hands[player];
    points += (hand.rook + hand.bishop) * 5;
    points += hand.gold + hand.silver + hand.knight + hand.lance + hand.pawn;
    
    return points;
  };
  
  return {
    sentePoints: calculatePoints('sente'),
    gotePoints: calculatePoints('gote'),
    senteInEnemyTerritory,
    goteInEnemyTerritory,
  };
}
