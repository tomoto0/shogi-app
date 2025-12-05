// 将棋ゲーム 型定義ファイル

// ========================================
// 駒の種類
// ========================================

/** 駒の種類（成り前） */
export type PieceType =
  | 'king'    // 玉将/王将
  | 'rook'    // 飛車
  | 'bishop'  // 角行
  | 'gold'    // 金将
  | 'silver'  // 銀将
  | 'knight'  // 桂馬
  | 'lance'   // 香車
  | 'pawn';   // 歩兵

/** 成り駒の種類 */
export type PromotedPieceType =
  | 'promotedRook'    // 龍王（竜）
  | 'promotedBishop'  // 龍馬（馬）
  | 'promotedSilver'  // 成銀
  | 'promotedKnight'  // 成桂
  | 'promotedLance'   // 成香
  | 'promotedPawn';   // と金

/** 全ての駒の種類 */
export type AllPieceType = PieceType | PromotedPieceType;

// ========================================
// プレイヤー
// ========================================

/** プレイヤー（先手/後手） */
export type Player = 'sente' | 'gote';

// ========================================
// 盤面座標
// ========================================

/** 列（筋）: 1-9 (右から左) */
export type Column = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 行（段）: 1-9 (上から下) */
export type Row = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

/** 盤面上の位置 */
export interface Position {
  col: Column;
  row: Row;
}

// ========================================
// 駒
// ========================================

/** 盤上の駒 */
export interface Piece {
  type: AllPieceType;
  owner: Player;
  isPromoted: boolean;
}

/** 盤面のマス（駒があるかnull） */
export type Square = Piece | null;

// ========================================
// 持ち駒
// ========================================

/** 持ち駒の種類（成り駒は持てないので成り前のみ） */
export type HandPieceType = Exclude<PieceType, 'king'>;

/** 持ち駒 */
export type Hand = {
  [K in HandPieceType]: number;
};

// ========================================
// 盤面
// ========================================

/** 9x9盤面 [row][col] でアクセス (0-indexed internally) */
export type Board = Square[][];

// ========================================
// 指し手
// ========================================

/** 駒を動かす手 */
export interface MoveAction {
  type: 'move';
  from: Position;
  to: Position;
  piece: AllPieceType;
  captured?: AllPieceType;
  promote: boolean;
}

/** 持ち駒を打つ手 */
export interface DropAction {
  type: 'drop';
  to: Position;
  piece: HandPieceType;
}

/** 指し手 */
export type Move = MoveAction | DropAction;

// ========================================
// ゲーム状態
// ========================================

/** ゲームの進行状態 */
export type GamePhase = 'opening' | 'middlegame' | 'endgame';

/** ゲーム終了状態 */
export type GameResult = 
  | { type: 'ongoing' }
  | { type: 'checkmate'; winner: Player }
  | { type: 'stalemate'; winner: Player }
  | { type: 'repetition'; result: 'draw' | Player }
  | { type: 'resignation'; winner: Player };

/** ゲーム全体の状態 */
export interface GameState {
  board: Board;
  hands: {
    sente: Hand;
    gote: Hand;
  };
  currentPlayer: Player;
  moveHistory: Move[];
  positionHistory: string[]; // SFEN形式で保存（千日手判定用）
  moveCount: number;
  gamePhase: GamePhase;
  result: GameResult;
  isCheck: boolean;
}

// ========================================
// AI関連
// ========================================

/** AI難易度レベル */
export type AILevel = 'beginner' | 'intermediate' | 'advanced' | 'llm';

/** AI思考ステージ */
export type ThinkingStage = 
  | 'position_analysis'
  | 'strategic_planning'
  | 'opening_book'
  | 'tactical_calculation'
  | 'move_selection';

/** AI思考ログエントリ */
export interface ThinkingLogEntry {
  stage: ThinkingStage;
  content: string;
  timestamp: number;
}

/** AI思考状態 */
export interface AIThinkingState {
  isThinking: boolean;
  currentStage: ThinkingStage | null;
  logs: ThinkingLogEntry[];
  strategicGoals: string[];
  positionEvaluation: number;
  candidateMoves: Array<{
    move: Move;
    evaluation: number;
    reasoning: string;
  }>;
  selectedMove: Move | null;
  selectedMoveReasoning: string;
}

/** 永続的な思考ログ（上級AIのみ） */
export interface PersistentThinkingLog {
  gamePhase: GamePhase;
  strategicGoals: string[];
  threatLog: Array<{
    move: number;
    threat: string;
    response: string;
  }>;
  positionEvaluations: Array<{
    move: number;
    evaluation: number;
    reasoning: string;
  }>;
  planHistory: Array<{
    plan: string;
    status: 'active' | 'completed' | 'abandoned';
    startMove: number;
    endMove?: number;
  }>;
  reflectionNotes: string[];
}

// ========================================
// 定跡・囲い
// ========================================

/** 定跡手順 */
export interface Joseki {
  name: string;
  nameJp: string;
  moves: Move[];
  description: string;
}

/** 囲いパターン */
export interface CastlePattern {
  name: string;
  nameJp: string;
  pieces: Array<{
    piece: PieceType;
    position: Position;
  }>;
  description: string;
  strengths: string[];
  weaknesses: string[];
}

// ========================================
// UI関連
// ========================================

/** 言語設定 */
export type Language = 'ja' | 'en';

/** 設定 */
export interface Settings {
  language: Language;
  soundEnabled: boolean;
  boardRotation: boolean; // 後手視点で反転するか
  thinkingSpeed: 'slow' | 'normal' | 'fast';
  showLegalMoves: boolean;
  showLastMove: boolean;
}

/** ドラッグ中の駒情報 */
export interface DragState {
  piece: Piece | HandPieceType;
  from: Position | 'hand';
  legalMoves: Position[];
}

// ========================================
// 棋譜表記
// ========================================

/** 日本語棋譜表記用の数字 */
export const JAPANESE_NUMBERS = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九'] as const;

/** 日本語棋譜表記用の筋 */
export const JAPANESE_COLUMNS = ['', '１', '２', '３', '４', '５', '６', '７', '８', '９'] as const;

/** 駒の日本語名称 */
export const PIECE_NAMES_JP: Record<AllPieceType, string> = {
  king: '玉',
  rook: '飛',
  bishop: '角',
  gold: '金',
  silver: '銀',
  knight: '桂',
  lance: '香',
  pawn: '歩',
  promotedRook: '龍',
  promotedBishop: '馬',
  promotedSilver: '成銀',
  promotedKnight: '成桂',
  promotedLance: '成香',
  promotedPawn: 'と',
};

/** 駒の英語名称 */
export const PIECE_NAMES_EN: Record<AllPieceType, string> = {
  king: 'King',
  rook: 'Rook',
  bishop: 'Bishop',
  gold: 'Gold',
  silver: 'Silver',
  knight: 'Knight',
  lance: 'Lance',
  pawn: 'Pawn',
  promotedRook: 'Dragon',
  promotedBishop: 'Horse',
  promotedSilver: '+Silver',
  promotedKnight: '+Knight',
  promotedLance: '+Lance',
  promotedPawn: '+Pawn',
};

/** 駒の漢字表記（駒の表面） */
export const PIECE_KANJI: Record<AllPieceType, string> = {
  king: '玉',
  rook: '飛',
  bishop: '角',
  gold: '金',
  silver: '銀',
  knight: '桂',
  lance: '香',
  pawn: '歩',
  promotedRook: '龍',
  promotedBishop: '馬',
  promotedSilver: '全',
  promotedKnight: '圭',
  promotedLance: '杏',
  promotedPawn: 'と',
};

/** 王将の漢字（先手は「王」、後手は「玉」を使うことも） */
export const KING_KANJI = {
  sente: '王',
  gote: '玉',
} as const;
