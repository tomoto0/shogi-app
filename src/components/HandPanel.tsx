// 持ち駒パネルコンポーネント
// モバイル対応の美しいデザインで持ち駒を表示

import { useMemo } from 'react'
import type { Hand, HandPieceType, Player, Piece } from '../types'
import { ShogiPiece } from './ShogiPiece'

interface HandPanelProps {
  hand: Hand
  player: Player
  isCurrentPlayer: boolean
  onPieceClick?: (pieceType: HandPieceType) => void
  selectedPiece?: HandPieceType | null
  compact?: boolean // モバイル用コンパクトモード
}

// 持ち駒の表示順序（価値の高い順）
const HAND_PIECE_ORDER: HandPieceType[] = [
  'rook',
  'bishop', 
  'gold',
  'silver',
  'knight',
  'lance',
  'pawn',
]

export function HandPanel({
  hand,
  player,
  isCurrentPlayer,
  onPieceClick,
  selectedPiece,
  compact = false,
}: HandPanelProps) {
  // 持っている駒だけをフィルタ
  const handPieces = HAND_PIECE_ORDER.filter(type => hand[type] > 0)
  
  // 駒の情報を作成
  const createPiece = (type: HandPieceType): Piece => ({
    type,
    owner: player,
    isPromoted: false,
  })

  const isGote = player === 'gote'

  // レスポンシブなサイズを計算
  const sizes = useMemo(() => {
    if (typeof window === 'undefined') return { pieceSize: 40, padding: 16, minWidth: 100, fontSize: '14px', countSize: '20px' }
    const screenWidth = window.innerWidth
    if (screenWidth < 500 || compact) {
      return { pieceSize: 28, padding: 8, minWidth: 70, fontSize: '11px', countSize: '14px' }
    }
    if (screenWidth < 768) {
      return { pieceSize: 32, padding: 12, minWidth: 85, fontSize: '12px', countSize: '16px' }
    }
    return { pieceSize: 40, padding: 16, minWidth: 100, fontSize: '14px', countSize: '20px' }
  }, [compact])

  return (
    <div 
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? '4px' : '8px',
        padding: `${sizes.padding}px`,
        borderRadius: compact ? '8px' : '12px',
        minWidth: `${sizes.minWidth}px`,
        transform: isGote ? 'rotate(180deg)' : 'none',
        background: isCurrentPlayer
          ? 'linear-gradient(145deg, rgba(180, 140, 90, 0.7) 0%, rgba(150, 110, 60, 0.8) 100%)'
          : 'linear-gradient(145deg, rgba(160, 130, 100, 0.5) 0%, rgba(130, 100, 70, 0.5) 100%)',
        border: isCurrentPlayer 
          ? (compact ? '2px solid rgba(217, 119, 6, 0.8)' : '3px solid rgba(217, 119, 6, 0.8)')
          : '2px solid rgba(139, 90, 43, 0.4)',
        boxShadow: isCurrentPlayer
          ? '0 0 20px rgba(217, 119, 6, 0.4), inset 0 2px 4px rgba(255,255,255,0.2)'
          : 'inset 0 1px 3px rgba(255,255,255,0.1)',
      }}
    >
      {/* プレイヤー表示 */}
      <div 
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          padding: compact ? '4px 8px' : '6px 12px',
          borderRadius: '8px',
          background: 'rgba(74, 55, 40, 0.3)',
          transform: isGote ? 'rotate(180deg)' : 'none',
          fontFamily: '"Yu Mincho", "Hiragino Mincho Pro", serif',
          fontSize: sizes.fontSize,
          fontWeight: 'bold',
          color: isCurrentPlayer ? '#fef3c7' : '#d4c4a8',
          textShadow: '0 1px 2px rgba(0,0,0,0.3)',
        }}
      >
        <span>{player === 'sente' ? '☗' : '☖'}</span>
        <span>{player === 'sente' ? '先手' : '後手'}</span>
        {isCurrentPlayer && (
          <span style={{ 
            marginLeft: '4px',
            padding: '2px 6px',
            background: 'rgba(217, 119, 6, 0.6)',
            borderRadius: '4px',
            fontSize: compact ? '9px' : '11px',
          }}>
            手番
          </span>
        )}
      </div>
      
      {/* 持ち駒リスト */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: compact ? '3px' : '6px',
        minHeight: compact ? '120px' : '200px',
      }}>
        {handPieces.length === 0 ? (
          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: compact ? '20px 8px' : '40px 16px',
              color: 'rgba(180, 150, 100, 0.6)',
              fontSize: compact ? '11px' : '13px',
              fontFamily: '"Yu Mincho", "Hiragino Mincho Pro", serif',
              transform: isGote ? 'rotate(180deg)' : 'none',
            }}
          >
            持ち駒なし
          </div>
        ) : (
          handPieces.map(pieceType => {
            const isSelected = selectedPiece === pieceType
            const count = hand[pieceType]
            
            return (
              <div
                key={pieceType}
                onClick={() => isCurrentPlayer && onPieceClick?.(pieceType)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: compact ? '4px' : '8px',
                  padding: compact ? '3px 6px' : '6px 10px',
                  borderRadius: '8px',
                  cursor: isCurrentPlayer ? 'pointer' : 'default',
                  transform: isGote ? 'rotate(180deg)' : 'none',
                  background: isSelected 
                    ? 'rgba(34, 197, 94, 0.4)' 
                    : 'rgba(255, 255, 255, 0.1)',
                  border: isSelected 
                    ? '2px solid rgba(34, 197, 94, 0.8)' 
                    : '1px solid transparent',
                  boxShadow: isSelected 
                    ? '0 0 12px rgba(34, 197, 94, 0.4)' 
                    : 'none',
                  transition: 'all 0.15s ease',
                  opacity: isCurrentPlayer ? 1 : 0.7,
                }}
                onMouseEnter={(e) => {
                  if (isCurrentPlayer && !isSelected) {
                    e.currentTarget.style.background = 'rgba(217, 119, 6, 0.3)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (isCurrentPlayer && !isSelected) {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'
                  }
                }}
              >
                {/* 駒画像 */}
                <div style={{ flexShrink: 0 }}>
                  <ShogiPiece
                    piece={createPiece(pieceType)}
                    size={sizes.pieceSize}
                    isSelected={isSelected}
                  />
                </div>
                
                {/* 枚数表示 */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '1px',
                }}>
                  <span style={{
                    fontSize: sizes.countSize,
                    fontWeight: 'bold',
                    color: '#fef3c7',
                    fontFamily: '"Yu Mincho", "Hiragino Mincho Pro", serif',
                    textShadow: '0 1px 2px rgba(0,0,0,0.4)',
                    lineHeight: 1,
                  }}>
                    {count}
                  </span>
                  {!compact && (
                    <span style={{
                      fontSize: '10px',
                      color: 'rgba(254, 243, 199, 0.7)',
                      fontFamily: 'sans-serif',
                    }}>
                      枚
                    </span>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
