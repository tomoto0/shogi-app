// 将棋の駒コンポーネント
// 美しい木目調の画像を使用した駒

import React from 'react'
import type { Piece, AllPieceType, Player } from '../types'

// アニメーションタイプ
export type PieceAnimation = 'none' | 'slide' | 'capture' | 'promote'

interface ShogiPieceProps {
  piece: Piece
  size?: number // ピクセル単位のサイズ
  isSelected?: boolean
  isDragging?: boolean
  isLastMove?: boolean
  animation?: PieceAnimation
  onClick?: () => void
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: (e: React.DragEvent) => void
}

// 駒タイプから画像ファイル名へのマッピング
const PIECE_IMAGE_MAP: Record<AllPieceType, string> = {
  // 通常駒
  pawn: 'pawn',
  lance: 'lance',
  knight: 'knight',
  silver: 'silver',
  gold: 'gold',
  bishop: 'bishop',
  rook: 'rook',
  king: 'king',
  // 成り駒
  promotedPawn: 'prom_pawn',
  promotedLance: 'prom_lance',
  promotedKnight: 'prom_knight',
  promotedSilver: 'prom_silver',
  promotedBishop: 'horse',
  promotedRook: 'dragon',
}

/**
 * 駒の画像パスを取得
 * 全て先手用(black)の画像を使い、後手は回転で対応
 */
function getPieceImagePath(piece: Piece): string {
  // 先手用の画像を常に使用（後手はCSS回転で対応）
  const playerPrefix = 'black'
  const pieceName = PIECE_IMAGE_MAP[piece.type]
  return `/pieces/wood/${playerPrefix}_${pieceName}.png`
}

/**
 * 将棋の駒コンポーネント
 * 木目調の美しい画像を使用
 */
export const ShogiPiece: React.FC<ShogiPieceProps> = ({
  piece,
  size = 44,
  isSelected = false,
  isDragging = false,
  isLastMove = false,
  animation = 'none',
  onClick,
  onDragStart,
  onDragEnd,
}) => {
  const isGote = piece.owner === 'gote'
  const imagePath = getPieceImagePath(piece)

  // アニメーションスタイルを取得
  const getAnimationStyle = (): React.CSSProperties => {
    switch (animation) {
      case 'slide':
        return {
          animation: 'slideIn 0.3s ease-out',
        }
      case 'capture':
        return {
          animation: 'captureFlash 0.4s ease-out',
        }
      case 'promote':
        return {
          animation: 'promoteGlow 0.5s ease-out',
        }
      default:
        return {}
    }
  }

  return (
    <div
      style={{
        width: `${size}px`,
        height: `${size}px`,
        position: 'relative',
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        transform: isGote ? 'rotate(180deg)' : 'none',
        opacity: isDragging ? 0.5 : 1,
        filter: isDragging 
          ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.4))' 
          : isSelected 
            ? 'drop-shadow(0 0 8px rgba(34, 197, 94, 0.8))' 
            : 'drop-shadow(0 2px 3px rgba(0,0,0,0.3))',
        transition: 'transform 0.15s, filter 0.15s',
        ...getAnimationStyle(),
      }}
      onClick={onClick}
      draggable={!!onDragStart}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      <img
        src={imagePath}
        alt={piece.type}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          pointerEvents: 'none',
        }}
        draggable={false}
      />
      
      {/* 選択時のハイライト */}
      {isSelected && (
        <div
          style={{
            position: 'absolute',
            inset: '-2px',
            border: '2px solid #22c55e',
            borderRadius: '4px',
            pointerEvents: 'none',
          }}
        />
      )}
      
      {/* 最後の手のハイライト */}
      {isLastMove && !isSelected && (
        <div
          style={{
            position: 'absolute',
            inset: '-1px',
            border: '1px solid #fbbf24',
            borderRadius: '3px',
            pointerEvents: 'none',
          }}
        />
      )}
    </div>
  )
}

// レガシーサイズ変換（互換性のため）
type LegacySize = 'sm' | 'md' | 'lg'
const LEGACY_SIZE_MAP: Record<LegacySize, number> = {
  sm: 32,
  md: 44,
  lg: 52,
}

/**
 * 持ち駒用の駒コンポーネント
 */
interface HandPieceDisplayProps {
  pieceType: AllPieceType
  owner: Player
  count: number
  isSelected?: boolean
  onClick?: () => void
  size?: LegacySize | number
}

export const HandPiece: React.FC<HandPieceDisplayProps> = ({
  pieceType,
  owner,
  count,
  isSelected = false,
  onClick,
  size = 'sm',
}) => {
  const piece: Piece = {
    type: pieceType,
    owner,
    isPromoted: false,
  }
  
  const numericSize = typeof size === 'number' ? size : LEGACY_SIZE_MAP[size]

  return (
    <div
      style={{
        position: 'relative',
        cursor: 'pointer',
        transition: 'transform 0.15s',
        transform: isSelected ? 'scale(1.1)' : 'scale(1)',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'scale(1.05)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.transform = 'scale(1)'
        }
      }}
    >
      <ShogiPiece piece={piece} size={numericSize} isSelected={isSelected} />
      
      {/* 枚数バッジ */}
      {count > 1 && (
        <div
          style={{
            position: 'absolute',
            bottom: '-4px',
            right: '-4px',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundColor: '#b45309',
            color: 'white',
            fontSize: '11px',
            fontWeight: 'bold',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.3)',
          }}
        >
          {count}
        </div>
      )}
    </div>
  )
}

export default ShogiPiece
