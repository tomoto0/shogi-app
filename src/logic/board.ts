// 将棋盤の初期化と基本操作
import type {
  Board,
  Piece,
  Square,
  Position,
  Hand,
  HandPieceType,
  GameState,
  Player,
  Column,
  Row,
} from '../types';

// ========================================
// 初期配置
// ========================================

/**
 * 空の持ち駒を作成
 */
export function createEmptyHand(): Hand {
  return {
    rook: 0,
    bishop: 0,
    gold: 0,
    silver: 0,
    knight: 0,
    lance: 0,
    pawn: 0,
  };
}

/**
 * 駒を作成
 */
export function createPiece(
  type: Piece['type'],
  owner: Player,
  isPromoted: boolean = false
): Piece {
  return { type, owner, isPromoted };
}

/**
 * 初期盤面を作成
 * 
 * 将棋の初期配置:
 * 
 *   9   8   7   6   5   4   3   2   1
 * +---+---+---+---+---+---+---+---+---+
 * | 香| 桂| 銀| 金| 玉| 金| 銀| 桂| 香|  1段目 (後手)
 * +---+---+---+---+---+---+---+---+---+
 * |   | 飛|   |   |   |   |   | 角|   |  2段目
 * +---+---+---+---+---+---+---+---+---+
 * | 歩| 歩| 歩| 歩| 歩| 歩| 歩| 歩| 歩|  3段目
 * +---+---+---+---+---+---+---+---+---+
 * |   |   |   |   |   |   |   |   |   |  4段目
 * +---+---+---+---+---+---+---+---+---+
 * |   |   |   |   |   |   |   |   |   |  5段目
 * +---+---+---+---+---+---+---+---+---+
 * |   |   |   |   |   |   |   |   |   |  6段目
 * +---+---+---+---+---+---+---+---+---+
 * | 歩| 歩| 歩| 歩| 歩| 歩| 歩| 歩| 歩|  7段目
 * +---+---+---+---+---+---+---+---+---+
 * |   | 角|   |   |   |   |   | 飛|   |  8段目
 * +---+---+---+---+---+---+---+---+---+
 * | 香| 桂| 銀| 金| 王| 金| 銀| 桂| 香|  9段目 (先手)
 * +---+---+---+---+---+---+---+---+---+
 */
export function createInitialBoard(): Board {
  // 9x9の空盤面を作成 (row: 0-8, col: 0-8)
  // board[row][col] でアクセス
  // row: 0 = 1段目, row: 8 = 9段目
  // col: 0 = 9筋, col: 8 = 1筋
  const board: Board = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  // ========================================
  // 後手の駒 (1-3段目)
  // ========================================

  // 1段目: 香 桂 銀 金 玉 金 銀 桂 香
  board[0][0] = createPiece('lance', 'gote');   // 9一香
  board[0][1] = createPiece('knight', 'gote');  // 8一桂
  board[0][2] = createPiece('silver', 'gote');  // 7一銀
  board[0][3] = createPiece('gold', 'gote');    // 6一金
  board[0][4] = createPiece('king', 'gote');    // 5一玉
  board[0][5] = createPiece('gold', 'gote');    // 4一金
  board[0][6] = createPiece('silver', 'gote');  // 3一銀
  board[0][7] = createPiece('knight', 'gote');  // 2一桂
  board[0][8] = createPiece('lance', 'gote');   // 1一香

  // 2段目: 飛車と角
  board[1][1] = createPiece('rook', 'gote');    // 8二飛
  board[1][7] = createPiece('bishop', 'gote');  // 2二角

  // 3段目: 歩
  for (let col = 0; col < 9; col++) {
    board[2][col] = createPiece('pawn', 'gote');
  }

  // ========================================
  // 先手の駒 (7-9段目)
  // ========================================

  // 7段目: 歩
  for (let col = 0; col < 9; col++) {
    board[6][col] = createPiece('pawn', 'sente');
  }

  // 8段目: 角と飛車
  board[7][1] = createPiece('bishop', 'sente'); // 8八角
  board[7][7] = createPiece('rook', 'sente');   // 2八飛

  // 9段目: 香 桂 銀 金 王 金 銀 桂 香
  board[8][0] = createPiece('lance', 'sente');  // 9九香
  board[8][1] = createPiece('knight', 'sente'); // 8九桂
  board[8][2] = createPiece('silver', 'sente'); // 7九銀
  board[8][3] = createPiece('gold', 'sente');   // 6九金
  board[8][4] = createPiece('king', 'sente');   // 5九王
  board[8][5] = createPiece('gold', 'sente');   // 4九金
  board[8][6] = createPiece('silver', 'sente'); // 3九銀
  board[8][7] = createPiece('knight', 'sente'); // 2九桂
  board[8][8] = createPiece('lance', 'sente');  // 1九香

  return board;
}

/**
 * 初期ゲーム状態を作成
 */
export function createInitialGameState(): GameState {
  return {
    board: createInitialBoard(),
    hands: {
      sente: createEmptyHand(),
      gote: createEmptyHand(),
    },
    currentPlayer: 'sente',
    moveHistory: [],
    positionHistory: [],
    moveCount: 0,
    gamePhase: 'opening',
    result: { type: 'ongoing' },
    isCheck: false,
  };
}

// ========================================
// 座標変換ユーティリティ
// ========================================

/**
 * 盤面座標(Position)から配列インデックスに変換
 * Position: col=1-9 (右から左), row=1-9 (上から下)
 * Array: [row][col] where row=0-8, col=0-8
 */
export function positionToIndex(pos: Position): { rowIndex: number; colIndex: number } {
  // col: 1→8, 2→7, ..., 9→0 (9-col)
  // row: 1→0, 2→1, ..., 9→8 (row-1)
  return {
    rowIndex: pos.row - 1,
    colIndex: 9 - pos.col,
  };
}

/**
 * 配列インデックスから盤面座標(Position)に変換
 */
export function indexToPosition(rowIndex: number, colIndex: number): Position {
  return {
    col: (9 - colIndex) as Column,
    row: (rowIndex + 1) as Row,
  };
}

/**
 * 盤面から駒を取得
 */
export function getPieceAt(board: Board, pos: Position): Square {
  const { rowIndex, colIndex } = positionToIndex(pos);
  return board[rowIndex][colIndex];
}

/**
 * 盤面に駒を配置（新しい盤面を返す）
 */
export function setPieceAt(board: Board, pos: Position, piece: Square): Board {
  const newBoard = board.map(row => [...row]);
  const { rowIndex, colIndex } = positionToIndex(pos);
  newBoard[rowIndex][colIndex] = piece;
  return newBoard;
}

/**
 * 位置が盤内かチェック
 */
export function isValidPosition(col: number, row: number): boolean {
  return col >= 1 && col <= 9 && row >= 1 && row <= 9;
}

/**
 * Position同士が等しいかチェック
 */
export function positionsEqual(a: Position, b: Position): boolean {
  return a.col === b.col && a.row === b.row;
}

// ========================================
// 持ち駒操作
// ========================================

/**
 * 持ち駒に追加（新しいHandを返す）
 */
export function addToHand(hand: Hand, pieceType: HandPieceType): Hand {
  return {
    ...hand,
    [pieceType]: hand[pieceType] + 1,
  };
}

/**
 * 持ち駒から減らす（新しいHandを返す）
 */
export function removeFromHand(hand: Hand, pieceType: HandPieceType): Hand {
  if (hand[pieceType] <= 0) {
    throw new Error(`Cannot remove ${pieceType} from hand: none available`);
  }
  return {
    ...hand,
    [pieceType]: hand[pieceType] - 1,
  };
}

/**
 * 持ち駒の種類リストを取得（個数順）
 */
export function getHandPieces(hand: Hand): HandPieceType[] {
  const order: HandPieceType[] = ['rook', 'bishop', 'gold', 'silver', 'knight', 'lance', 'pawn'];
  return order.filter(type => hand[type] > 0);
}

// ========================================
// 駒の成り
// ========================================

import type { PieceType, PromotedPieceType, AllPieceType } from '../types';

/** 成り前→成り後のマッピング */
const PROMOTION_MAP: Partial<Record<PieceType, PromotedPieceType>> = {
  rook: 'promotedRook',
  bishop: 'promotedBishop',
  silver: 'promotedSilver',
  knight: 'promotedKnight',
  lance: 'promotedLance',
  pawn: 'promotedPawn',
};

/** 成り後→成り前のマッピング */
const UNPROMOTE_MAP: Record<PromotedPieceType, PieceType> = {
  promotedRook: 'rook',
  promotedBishop: 'bishop',
  promotedSilver: 'silver',
  promotedKnight: 'knight',
  promotedLance: 'lance',
  promotedPawn: 'pawn',
};

/**
 * 駒が成れるかどうか
 */
export function canPromote(pieceType: AllPieceType): boolean {
  return pieceType in PROMOTION_MAP;
}

/**
 * 駒を成らせる
 */
export function promotePiece(pieceType: PieceType): PromotedPieceType {
  const promoted = PROMOTION_MAP[pieceType];
  if (!promoted) {
    throw new Error(`Cannot promote ${pieceType}`);
  }
  return promoted;
}

/**
 * 成り駒かどうか
 */
export function isPromotedPiece(pieceType: AllPieceType): pieceType is PromotedPieceType {
  return pieceType in UNPROMOTE_MAP;
}

/**
 * 成り駒を成り前に戻す（持ち駒にする時用）
 */
export function unpromotePiece(pieceType: AllPieceType): PieceType {
  if (isPromotedPiece(pieceType)) {
    return UNPROMOTE_MAP[pieceType];
  }
  return pieceType as PieceType;
}

/**
 * 持ち駒として持てる駒種類に変換
 */
export function toHandPieceType(pieceType: AllPieceType): HandPieceType {
  const base = unpromotePiece(pieceType);
  if (base === 'king') {
    throw new Error('King cannot be captured');
  }
  return base;
}

// ========================================
// 盤面コピー
// ========================================

/**
 * 盤面のディープコピー
 */
export function cloneBoard(board: Board): Board {
  return board.map(row => row.map(square => (square ? { ...square } : null)));
}

/**
 * ゲーム状態のディープコピー
 */
export function cloneGameState(state: GameState): GameState {
  return {
    board: cloneBoard(state.board),
    hands: {
      sente: { ...state.hands.sente },
      gote: { ...state.hands.gote },
    },
    currentPlayer: state.currentPlayer,
    moveHistory: [...state.moveHistory],
    positionHistory: [...state.positionHistory],
    moveCount: state.moveCount,
    gamePhase: state.gamePhase,
    result: { ...state.result },
    isCheck: state.isCheck,
  };
}
