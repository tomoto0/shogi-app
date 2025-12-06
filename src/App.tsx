import { useState, useEffect, useMemo, useCallback } from 'react'
import './App.css'
import { ShogiBoard } from './components/ShogiBoard'
import { ShogiPiece } from './components/ShogiPiece'
import type { PieceAnimation } from './components/ShogiPiece'
import { HandPanel } from './components/HandPanel'
import { PromotionDialog } from './components/PromotionDialog'
import { TutorialDialog } from './components/TutorialDialog'
import { SettingsDialog, DEFAULT_SETTINGS, type GameSettings as DisplaySettings } from './components/SettingsDialog'
import { HomeScreen, type GameSettings as HomeGameSettings } from './components/HomeScreen'
import { resetLLMContext } from './api/llm'
import { 
  createInitialGameState, 
  getPieceAt,
  toHandPieceType,
  addToHand,
  removeFromHand,
  canPromote,
  isPromotedPiece,
} from './logic/board'
import { 
  getLegalDestinations, 
  applyMove, 
  applyDrop, 
  isInCheck,
  isLegalDrop,
} from './logic/legalMoves'
import {
  canPromoteMove,
  mustPromote,
} from './logic/moves'
import {
  gameStateToSfen,
  checkGameResult,
  countPositionRepetitions,
  determineGamePhase,
} from './logic/gameRules'
import { thinkMove } from './ai'
import { useShogiSound } from './hooks/useShogiSound'
import { useGameHistory } from './hooks/useGameHistory'
import type { Position, GameState, MoveAction, Move, DropAction, HandPieceType, Column, Row, Piece, AILevel } from './types'

// 画面状態
type ScreenState = 'home' | 'game'

// ゲームモード
type GameMode = 'pvp' | 'pvc'

// 成り選択中の状態
interface PendingPromotion {
  from: Position
  to: Position
  piece: Piece
}

// アニメーション状態
interface AnimationState {
  position: Position | null
  type: PieceAnimation
}

function App() {
  // 画面状態
  const [screenState, setScreenState] = useState<ScreenState>('home')
  
  const [gameMode, setGameMode] = useState<GameMode>('pvc')
  const [aiLevel, setAiLevel] = useState<AILevel>('beginner')
  const [playerColor, setPlayerColor] = useState<'sente' | 'gote'>('sente')
  const [isAiThinking, setIsAiThinking] = useState(false)
  const [animationState, setAnimationState] = useState<AnimationState>({ position: null, type: 'none' })
  
  // 初期状態を作成
  const createInitialState = useCallback(() => {
    const initialState = createInitialGameState()
    initialState.positionHistory = [gameStateToSfen(initialState)]
    return initialState
  }, [])
  
  // ゲーム履歴管理（Undo機能付き）
  const { 
    gameState, 
    setGameState, 
    undoTwice, 
    canUndoTwice, 
    reset: resetHistory 
  } = useGameHistory(createInitialState())
  
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null)
  const [selectedHandPiece, setSelectedHandPiece] = useState<HandPieceType | null>(null)
  const [lastMove, setLastMove] = useState<Move | null>(null)
  const [pendingPromotion, setPendingPromotion] = useState<PendingPromotion | null>(null)
  const [showTutorial, setShowTutorial] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<DisplaySettings>(DEFAULT_SETTINGS)
  const { playSound, initialize, setEnabled: setSoundEnabled, setVolume: setSoundVolume } = useShogiSound()

  // 設定変更時にサウンド設定を適用
  useEffect(() => {
    setSoundEnabled(settings.soundEnabled)
    setSoundVolume(settings.soundVolume)
  }, [settings.soundEnabled, settings.soundVolume, setSoundEnabled, setSoundVolume])

  const { board, currentPlayer, result, isCheck } = gameState

  // ホーム画面からのゲーム開始処理
  const handleStartGame = useCallback((homeSettings: HomeGameSettings) => {
    setGameMode(homeSettings.gameMode)
    setAiLevel(homeSettings.aiLevel)
    setPlayerColor(homeSettings.playerColor)
    resetHistory(createInitialState())
    setSelectedPosition(null)
    setSelectedHandPiece(null)
    setPendingPromotion(null)
    setLastMove(null)
    setScreenState('game')
    initialize() // 音声初期化
  }, [resetHistory, createInitialState, initialize])

  // アニメーションをトリガーする関数
  const triggerAnimation = useCallback((position: Position, type: PieceAnimation, duration: number = 300) => {
    setAnimationState({ position, type })
    setTimeout(() => {
      setAnimationState({ position: null, type: 'none' })
    }, duration)
  }, [])

  // 初回クリック時に音声を初期化（ブラウザのポリシー対応）
  useEffect(() => {
    const handleFirstInteraction = () => {
      initialize()
      window.removeEventListener('click', handleFirstInteraction)
    }
    window.addEventListener('click', handleFirstInteraction)
    return () => window.removeEventListener('click', handleFirstInteraction)
  }, [initialize])

  // 選択中の駒の合法手を計算
  const legalMoves = useMemo(() => {
    if (!selectedPosition) return []
    const piece = getPieceAt(board, selectedPosition)
    if (!piece || piece.owner !== currentPlayer) return []
    return getLegalDestinations(board, selectedPosition, currentPlayer)
  }, [board, selectedPosition, currentPlayer])

  // 持ち駒を打てる位置を計算
  const legalDropPositions = useMemo(() => {
    if (!selectedHandPiece) return []
    const positions: Position[] = []
    const hand = gameState.hands[currentPlayer]
    
    for (let row = 1; row <= 9; row++) {
      for (let col = 1; col <= 9; col++) {
        const pos: Position = { col: col as Column, row: row as Row }
        const drop: DropAction = {
          type: 'drop',
          to: pos,
          piece: selectedHandPiece,
        }
        if (isLegalDrop(board, drop, currentPlayer, hand)) {
          positions.push(pos)
        }
      }
    }
    return positions
  }, [board, selectedHandPiece, currentPlayer, gameState.hands])

  // 駒を動かす処理（成りフラグ付き）
  const executeMoveWithPromotion = useCallback((from: Position, to: Position, promote: boolean) => {
    const piece = getPieceAt(board, from)
    if (!piece) return

    const targetPiece = getPieceAt(board, to)
    const isCapture = targetPiece !== null

    // MoveActionを作成
    const moveAction: MoveAction = {
      type: 'move',
      from,
      to,
      piece: piece.type,
      captured: targetPiece?.type,
      promote,
    }

    // 手を適用
    const { newBoard, captured } = applyMove(board, moveAction)
    
    // 持ち駒を更新（取った駒を持ち駒に追加）
    let newHands = { ...gameState.hands }
    if (captured) {
      const handPieceType = toHandPieceType(captured.type)
      newHands = {
        ...newHands,
        [currentPlayer]: addToHand(newHands[currentPlayer], handPieceType),
      }
    }
    
    // 新しい手番
    const nextPlayer = currentPlayer === 'sente' ? 'gote' : 'sente'
    
    // 新しいGameStateを作成
    const newState: GameState = {
      ...gameState,
      board: newBoard,
      hands: newHands,
      currentPlayer: nextPlayer,
      moveHistory: [...gameState.moveHistory, moveAction],
      moveCount: gameState.moveCount + 1,
      gamePhase: determineGamePhase(gameState.moveCount + 1),
      isCheck: isInCheck(newBoard, nextPlayer),
    }
    
    // SFEN履歴に追加
    const newSfen = gameStateToSfen(newState)
    newState.positionHistory = [...gameState.positionHistory, newSfen]
    
    // ゲーム結果を判定
    newState.result = checkGameResult(newState)

    // 状態を更新
    setGameState(newState)
    setLastMove(moveAction)
    setSelectedPosition(null)
    setSelectedHandPiece(null)

    // アニメーションをトリガー
    if (promote) {
      triggerAnimation(to, 'promote', 500)
    } else if (isCapture) {
      triggerAnimation(to, 'capture', 400)
    } else {
      triggerAnimation(to, 'slide', 300)
    }

    // 効果音
    if (newState.result.type !== 'ongoing') {
      playSound('gameEnd')
    } else if (newState.isCheck) {
      playSound('check')
    } else if (isCapture) {
      playSound('capture')
    } else if (promote) {
      playSound('promote')
    } else {
      playSound('move')
    }
  }, [board, currentPlayer, gameState, playSound, triggerAnimation])

  // 成りの判定と実行
  const tryMove = useCallback((from: Position, to: Position) => {
    const piece = getPieceAt(board, from)
    if (!piece) return

    // 成れるかチェック
    const pieceCanPromote = canPromote(piece.type) && !isPromotedPiece(piece.type)
    const moveCanPromote = pieceCanPromote && canPromoteMove(from, to, currentPlayer)
    const moveMustPromote = mustPromote(piece.type, to, currentPlayer)

    if (moveCanPromote && !moveMustPromote) {
      // 自動成り設定がONなら自動で成る
      if (settings.autoPromote) {
        executeMoveWithPromotion(from, to, true)
      } else {
        // 成れるが強制ではない → 選択ダイアログを表示
        setPendingPromotion({ from, to, piece })
      }
    } else {
      // 成り強制または成れない → 直接実行
      executeMoveWithPromotion(from, to, moveMustPromote)
    }
  }, [board, currentPlayer, executeMoveWithPromotion, settings.autoPromote])

  // 成り選択の結果を処理
  const handlePromotionChoice = useCallback((promote: boolean) => {
    if (!pendingPromotion) return
    
    executeMoveWithPromotion(pendingPromotion.from, pendingPromotion.to, promote)
    setPendingPromotion(null)
  }, [pendingPromotion, executeMoveWithPromotion])

  // 持ち駒を打つ処理
  const executeDrop = useCallback((pieceType: HandPieceType, to: Position) => {
    // DropActionを作成
    const dropAction: DropAction = {
      type: 'drop',
      to,
      piece: pieceType,
    }

    // 手を適用
    const newBoard = applyDrop(board, dropAction, currentPlayer)
    
    // 持ち駒を減らす
    const newHands = {
      ...gameState.hands,
      [currentPlayer]: removeFromHand(gameState.hands[currentPlayer], pieceType),
    }
    
    // 新しい手番
    const nextPlayer = currentPlayer === 'sente' ? 'gote' : 'sente'
    
    // 新しいGameStateを作成
    const newState: GameState = {
      ...gameState,
      board: newBoard,
      hands: newHands,
      currentPlayer: nextPlayer,
      moveHistory: [...gameState.moveHistory, dropAction],
      moveCount: gameState.moveCount + 1,
      gamePhase: determineGamePhase(gameState.moveCount + 1),
      isCheck: isInCheck(newBoard, nextPlayer),
    }
    
    // SFEN履歴に追加
    const newSfen = gameStateToSfen(newState)
    newState.positionHistory = [...gameState.positionHistory, newSfen]
    
    // ゲーム結果を判定
    newState.result = checkGameResult(newState)

    // 状態を更新
    setGameState(newState)
    setLastMove(dropAction)
    setSelectedPosition(null)
    setSelectedHandPiece(null)

    // アニメーションをトリガー
    triggerAnimation(to, 'slide', 300)

    // 効果音
    if (newState.result.type !== 'ongoing') {
      playSound('gameEnd')
    } else if (newState.isCheck) {
      playSound('check')
    } else {
      playSound('drop')
    }
  }, [board, currentPlayer, gameState, playSound, triggerAnimation, setGameState])

  // AIの手を実行
  const executeAiMove = useCallback(async () => {
    if (gameMode !== 'pvc') return
    if (currentPlayer === playerColor) return // プレイヤーの手番
    if (result.type !== 'ongoing') return
    if (isAiThinking) return

    setIsAiThinking(true)
    
    // 少し待ってから手を打つ（考えている感を出す）
    await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 500))
    
    try {
      const aiResult = await thinkMove(gameState, aiLevel)
      
      if (aiResult) {
        const { move } = aiResult
        
        if (move.type === 'move') {
          // 成りの判定
          const piece = getPieceAt(board, move.from)
          if (piece) {
            const pieceCanPromote = canPromote(piece.type) && !isPromotedPiece(piece.type)
            const moveCanPromote = pieceCanPromote && canPromoteMove(move.from, move.to, currentPlayer)
            const moveMustPromote = mustPromote(piece.type, move.to, currentPlayer)
            
            // AIは成れる時は常に成る（初級版）
            const shouldPromote = moveMustPromote || (moveCanPromote && Math.random() > 0.2)
            executeMoveWithPromotion(move.from, move.to, shouldPromote)
          }
        } else {
          // 駒を打つ
          executeDrop(move.piece, move.to)
        }
      } else {
        // AIに合法手がない場合 → 詰みまたはステイルメート
        // プレイヤーの勝利として処理
        const newState: GameState = {
          ...gameState,
          result: {
            type: 'checkmate',
            winner: playerColor,
          }
        }
        setGameState(newState)
        playSound('gameEnd')
      }
    } catch (error) {
      console.error('AI error:', error)
    } finally {
      setIsAiThinking(false)
    }
  }, [gameMode, currentPlayer, playerColor, result, isAiThinking, gameState, aiLevel, board, executeMoveWithPromotion, executeDrop, setGameState, playSound])

  // AIの手番になったら自動的に手を打つ
  useEffect(() => {
    if (gameMode === 'pvc' && currentPlayer !== playerColor && result.type === 'ongoing') {
      executeAiMove()
    }
  }, [gameMode, currentPlayer, playerColor, result, executeAiMove])

  const handleSquareClick = (position: Position) => {
    // ゲーム終了時は操作不可
    if (result.type !== 'ongoing') return
    
    // AI思考中は操作不可
    if (isAiThinking) return
    
    // AIの手番は操作不可（対CPU戦の場合）
    if (gameMode === 'pvc' && currentPlayer !== playerColor) return
    
    const piece = getPieceAt(board, position)
    
    // 持ち駒を打つモードの場合
    if (selectedHandPiece) {
      const isLegalDropPosition = legalDropPositions.some(
        p => p.col === position.col && p.row === position.row
      )
      if (isLegalDropPosition) {
        // 合法な打ち場所 → 駒を打つ
        executeDrop(selectedHandPiece, position)
      } else {
        // 打てない場所 → 選択解除
        setSelectedHandPiece(null)
      }
      return
    }
    
    if (piece && piece.owner === currentPlayer) {
      // 自分の駒があるマスをクリック → 選択
      setSelectedPosition(position)
      setSelectedHandPiece(null)
      playSound('move') // クリック音
    } else if (selectedPosition) {
      // 選択中に空きマスまたは敵駒をクリック
      const isLegal = legalMoves.some(m => m.col === position.col && m.row === position.row)
      if (isLegal) {
        // 合法手 → 成り判定して移動実行
        tryMove(selectedPosition, position)
      } else {
        setSelectedPosition(null)
      }
    }
  }

  // 持ち駒をクリック
  const handleHandPieceClick = useCallback((pieceType: HandPieceType) => {
    setSelectedPosition(null)
    setSelectedHandPiece(prev => prev === pieceType ? null : pieceType)
    playSound('move')
  }, [playSound])

  // ゲームリセット
  const resetGame = useCallback(() => {
    resetHistory(createInitialState())
    setSelectedPosition(null)
    setSelectedHandPiece(null)
    setPendingPromotion(null)
    setLastMove(null)
    // LLM AIの戦略コンテキストもリセット
    resetLLMContext()
  }, [resetHistory, createInitialState])

  // 待った（2手戻す：自分の手 + 相手の手）
  const handleUndo = useCallback(() => {
    if (!canUndoTwice) return
    undoTwice()
    setSelectedPosition(null)
    setSelectedHandPiece(null)
    setPendingPromotion(null)
    setLastMove(null)
    playSound('move')
  }, [canUndoTwice, undoTwice, playSound])

  // 千日手カウント表示
  const repetitionCount = useMemo(() => {
    const currentSfen = gameStateToSfen(gameState)
    return countPositionRepetitions(gameState.positionHistory.slice(0, -1), currentSfen)
  }, [gameState])

  // ホームに戻る
  const handleBackToHome = useCallback(() => {
    setScreenState('home')
    resetHistory(createInitialState())
    setSelectedPosition(null)
    setSelectedHandPiece(null)
    setPendingPromotion(null)
    setLastMove(null)
    setIsAiThinking(false)
  }, [resetHistory, createInitialState])

  // ホーム画面を表示
  if (screenState === 'home') {
    return <HomeScreen onStartGame={handleStartGame} />
  }

  // モバイル判定
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 500

  // ゲーム画面
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-1 sm:p-2 md:p-4">
      {/* ヘッダー */}
      <div className="flex items-center gap-1 sm:gap-2 md:gap-4 mb-2 flex-wrap justify-center">
        <button
          onClick={handleBackToHome}
          style={{
            padding: isMobile ? '6px 10px' : '8px 16px',
            background: 'linear-gradient(135deg, #78350f 0%, #a16207 50%, #78350f 100%)',
            color: '#fef3c7',
            borderRadius: '8px',
            border: '1px solid #d4a574',
            boxShadow: '0 2px 8px rgba(120, 53, 15, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            fontWeight: '600',
            fontSize: isMobile ? '12px' : '14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontFamily: '"Yu Gothic", "Hiragino Sans", sans-serif',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #92400e 0%, #b45309 50%, #92400e 100%)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #78350f 0%, #a16207 50%, #78350f 100%)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {isMobile ? '←' : '← ホーム'}
        </button>
        <h1 
          className="text-xl sm:text-2xl md:text-4xl font-bold text-amber-900" 
          style={{ fontFamily: '"Yu Mincho", "Hiragino Mincho Pro", serif' }}
        >
          将棋
        </h1>
        <button
          onClick={() => setShowTutorial(true)}
          style={{
            padding: isMobile ? '6px 10px' : '8px 16px',
            background: 'linear-gradient(135deg, #166534 0%, #22c55e 50%, #166534 100%)',
            color: '#f0fdf4',
            borderRadius: '8px',
            border: '1px solid #86efac',
            boxShadow: '0 2px 8px rgba(22, 101, 52, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)',
            fontWeight: '600',
            fontSize: isMobile ? '12px' : '14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontFamily: '"Yu Gothic", "Hiragino Sans", sans-serif',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #15803d 0%, #4ade80 50%, #15803d 100%)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #166534 0%, #22c55e 50%, #166534 100%)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {isMobile ? '📖' : '📖 ルール'}
        </button>
        <button
          onClick={() => setShowSettings(true)}
          style={{
            padding: isMobile ? '6px 10px' : '8px 16px',
            background: 'linear-gradient(135deg, #374151 0%, #6b7280 50%, #374151 100%)',
            color: '#f9fafb',
            borderRadius: '8px',
            border: '1px solid #9ca3af',
            boxShadow: '0 2px 8px rgba(55, 65, 81, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            fontWeight: '600',
            fontSize: isMobile ? '12px' : '14px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontFamily: '"Yu Gothic", "Hiragino Sans", sans-serif',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #4b5563 0%, #9ca3af 50%, #4b5563 100%)';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #374151 0%, #6b7280 50%, #374151 100%)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          {isMobile ? '⚙️' : '⚙️ 設定'}
        </button>
      </div>
      
      {/* ゲーム情報バッジ - 高級デザイン */}
      <div className="mb-1 sm:mb-2 flex flex-wrap gap-1 sm:gap-2 justify-center text-xs sm:text-sm">
        <span style={{
          padding: isMobile ? '4px 10px' : '6px 14px',
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          borderRadius: '20px',
          color: '#78350f',
          border: '1px solid #d4a574',
          boxShadow: '0 2px 4px rgba(120, 53, 15, 0.1)',
          fontWeight: '600',
          fontFamily: '"Yu Gothic", "Hiragino Sans", sans-serif',
          fontSize: isMobile ? '11px' : '14px',
        }}>
          {gameMode === 'pvc' 
            ? `🎯 ${isMobile ? '' : '対CPU '}(${
                aiLevel === 'beginner' ? '初級' : 
                aiLevel === 'intermediate' ? '中級' : 
                aiLevel === 'advanced' ? '上級' : 
                'GPT-4o'
              })` 
            : '👥 対人戦'}
        </span>
        {gameMode === 'pvc' && (
          <span style={{
            padding: isMobile ? '4px 10px' : '6px 14px',
            background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
            borderRadius: '20px',
            color: '#78350f',
            border: '1px solid #d4a574',
            boxShadow: '0 2px 4px rgba(120, 53, 15, 0.1)',
            fontWeight: '600',
            fontFamily: '"Yu Gothic", "Hiragino Sans", sans-serif',
            fontSize: isMobile ? '11px' : '14px',
          }}>
            {playerColor === 'sente' ? '☗ 先手' : '☖ 後手'}{isMobile ? '' : '（あなた）'}
          </span>
        )}
      </div>
      
      {/* ゲーム情報 */}
      <div className="mb-1 sm:mb-2 text-center">
        <div className="text-sm sm:text-lg text-amber-800 font-semibold">
          {isAiThinking ? (
            <span className="flex items-center justify-center gap-2">
              <span className="animate-spin">🤔</span>
              {isMobile ? 'AI思考中...' : 'AIが考え中...'}
            </span>
          ) : result.type === 'ongoing' 
            ? `${currentPlayer === 'sente' ? '先手' : '後手'}の番${gameMode === 'pvc' && currentPlayer === playerColor && !isMobile ? '（あなた）' : ''}`
            : result.type === 'checkmate' 
              ? `${result.winner === 'sente' ? '先手' : '後手'}の勝ち${isMobile ? '' : '（詰み）'}`
              : result.type === 'stalemate'
                ? `${result.winner === 'sente' ? '先手' : '後手'}の勝ち`
                : result.type === 'repetition'
                  ? result.result === 'draw' 
                    ? '千日手 - 引き分け'
                    : `${result.result === 'sente' ? '先手' : '後手'}の勝ち`
                  : ''
          }
        </div>
        
        {isCheck && result.type === 'ongoing' && (
          <div className="text-red-600 font-bold text-lg sm:text-xl animate-pulse">
            王手！
          </div>
        )}
        
        {repetitionCount > 1 && result.type === 'ongoing' && (
          <div className="text-orange-600 text-sm">
            同一局面 {repetitionCount}/4回
          </div>
        )}
        
        <div className="text-sm text-amber-700 mt-1">
          {gameState.moveCount}手目 / {gameState.gamePhase === 'opening' ? '序盤' : gameState.gamePhase === 'middlegame' ? '中盤' : '終盤'}
        </div>
      </div>
      
      {/* メインゲームエリア */}
      <div className="flex flex-col md:flex-row items-center gap-2 sm:gap-4 md:gap-6">
        {/* 後手の持ち駒（モバイルでは上、デスクトップでは左側） */}
        <div className="order-1 md:order-1">
          <HandPanel
            hand={gameState.hands.gote}
            player="gote"
            isCurrentPlayer={currentPlayer === 'gote'}
            onPieceClick={currentPlayer === 'gote' ? handleHandPieceClick : undefined}
            selectedPiece={currentPlayer === 'gote' ? selectedHandPiece : null}
            compact={isMobile}
          />
        </div>
        
        {/* 盤面 */}
        <div className="order-2 md:order-2">
          <ShogiBoard
          board={board}
          selectedPosition={selectedPosition}
          legalMoves={settings.showLegalMoves ? (selectedHandPiece ? legalDropPositions : legalMoves) : []}
          lastMove={settings.showLastMove && lastMove && lastMove.type === 'move' ? { from: lastMove.from, to: lastMove.to } : null}
          boardStyle={settings.boardStyle}
          onSquareClick={handleSquareClick}
        >
          {(position, rowIndex, colIndex) => {
            const piece = board[rowIndex][colIndex]
            if (!piece) return null
            
            const isSelected = selectedPosition?.col === position.col && 
                              selectedPosition?.row === position.row
            
            // このマスのアニメーション状態を取得
            const animation = animationState.position && 
                              animationState.position.col === position.col && 
                              animationState.position.row === position.row 
                              ? animationState.type 
                              : 'none'

            // レスポンシブな駒サイズ
            const pieceSize = isMobile ? Math.floor((window.innerWidth - 60) / 9) - 6 : 52
            
            return (
              <ShogiPiece
                piece={piece}
                size={pieceSize}
                isSelected={isSelected}
                animation={animation}
              />
            )
          }}
        </ShogiBoard>
        </div>
        
        {/* 先手の持ち駒（モバイルでは下、デスクトップでは右側） */}
        <div className="order-3 md:order-3">
          <HandPanel
            hand={gameState.hands.sente}
            player="sente"
            isCurrentPlayer={currentPlayer === 'sente'}
            onPieceClick={currentPlayer === 'sente' ? handleHandPieceClick : undefined}
            selectedPiece={currentPlayer === 'sente' ? selectedHandPiece : null}
            compact={isMobile}
          />
        </div>
      </div>
      
      <div className="mt-2 sm:mt-4 flex gap-2 sm:gap-4 flex-wrap justify-center">
        {/* 待った ボタン - 高級デザイン */}
        <button
          onClick={handleUndo}
          disabled={!canUndoTwice || isAiThinking}
          style={{
            padding: isMobile ? '8px 14px' : '10px 20px',
            borderRadius: '10px',
            transition: 'all 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? '4px' : '8px',
            fontWeight: '600',
            fontSize: isMobile ? '12px' : '14px',
            fontFamily: '"Yu Gothic", "Hiragino Sans", sans-serif',
            cursor: canUndoTwice && !isAiThinking ? 'pointer' : 'not-allowed',
            background: canUndoTwice && !isAiThinking
              ? 'linear-gradient(135deg, #1e3a5f 0%, #3b82f6 50%, #1e3a5f 100%)'
              : 'linear-gradient(135deg, #d1d5db 0%, #e5e7eb 50%, #d1d5db 100%)',
            color: canUndoTwice && !isAiThinking ? '#e0f2fe' : '#9ca3af',
            border: canUndoTwice && !isAiThinking ? '1px solid #60a5fa' : '1px solid #d1d5db',
            boxShadow: canUndoTwice && !isAiThinking 
              ? '0 3px 10px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)'
              : 'none',
          }}
          onMouseOver={(e) => {
            if (canUndoTwice && !isAiThinking) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #1e40af 0%, #60a5fa 50%, #1e40af 100%)';
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 5px 15px rgba(59, 130, 246, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)';
            }
          }}
          onMouseOut={(e) => {
            if (canUndoTwice && !isAiThinking) {
              e.currentTarget.style.background = 'linear-gradient(135deg, #1e3a5f 0%, #3b82f6 50%, #1e3a5f 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 3px 10px rgba(59, 130, 246, 0.3), inset 0 1px 0 rgba(255,255,255,0.15)';
            }
          }}
        >
          <span style={{ fontSize: isMobile ? '14px' : '16px' }}>↶</span>
          待った
        </button>
        
        {result.type !== 'ongoing' && (
          <button
            onClick={resetGame}
            style={{
              padding: isMobile ? '8px 16px' : '10px 24px',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: isMobile ? '13px' : '15px',
              fontFamily: '"Yu Gothic", "Hiragino Sans", sans-serif',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #7c2d12 100%)',
              color: '#fff7ed',
              border: '1px solid #fb923c',
              boxShadow: '0 4px 12px rgba(234, 88, 12, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #9a3412 0%, #f97316 50%, #9a3412 100%)';
              e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, #7c2d12 0%, #ea580c 50%, #7c2d12 100%)';
              e.currentTarget.style.transform = 'translateY(0) scale(1)';
            }}
          >
            🎮 もう一度
          </button>
        )}
        
        <button
          onClick={resetGame}
          style={{
            padding: isMobile ? '8px 14px' : '10px 20px',
            borderRadius: '10px',
            fontWeight: '600',
            fontSize: isMobile ? '12px' : '14px',
            fontFamily: '"Yu Gothic", "Hiragino Sans", sans-serif',
            cursor: 'pointer',
            background: 'linear-gradient(135deg, #4a4a4a 0%, #737373 50%, #4a4a4a 100%)',
            color: '#fafafa',
            border: '1px solid #a3a3a3',
            boxShadow: '0 3px 10px rgba(0, 0, 0, 0.2), inset 0 1px 0 rgba(255,255,255,0.1)',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #525252 0%, #8b8b8b 50%, #525252 100%)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.background = 'linear-gradient(135deg, #4a4a4a 0%, #737373 50%, #4a4a4a 100%)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          🔄 リセット
        </button>
      </div>
      
      <div className="mt-4 text-amber-800 text-sm">
        {selectedHandPiece
          ? `持ち駒を選択中 (打てる場所: ${legalDropPositions.length}箇所)`
          : selectedPosition 
            ? `選択中: ${selectedPosition.col}${selectedPosition.row} (合法手: ${legalMoves.length}箇所)` 
            : result.type === 'ongoing' ? '駒をクリックしてください' : ''}
      </div>
      
      {/* 成り選択ダイアログ */}
      {pendingPromotion && (
        <PromotionDialog
          piece={pendingPromotion.piece}
          onChoice={handlePromotionChoice}
        />
      )}
      
      {/* チュートリアルダイアログ */}
      <TutorialDialog
        isOpen={showTutorial}
        onClose={() => setShowTutorial(false)}
      />
      
      {/* 設定ダイアログ */}
      <SettingsDialog
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={settings}
        onSettingsChange={setSettings}
      />
    </div>
  )
}

export default App
