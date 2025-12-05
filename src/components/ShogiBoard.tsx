// 将棋盤コンポーネント
// 伝統的な木目テクスチャと座標表示を備えたレスポンシブ9x9盤面

import React, { useMemo } from 'react'
import type { Board, Position, Column, Row } from '../types'

// 盤面スタイルの型
type BoardStyle = 'kaya' | 'dark' | 'classic'

interface ShogiBoardProps {
  board: Board
  selectedPosition: Position | null
  legalMoves: Position[]
  lastMove: { from: Position; to: Position } | null
  onSquareClick: (position: Position) => void
  children: (position: Position, rowIndex: number, colIndex: number) => React.ReactNode
  cellSize?: number // オプション: セルサイズを外部から指定可能
  boardStyle?: BoardStyle // 盤面スタイル
}

// 列番号（筋）のラベル: 9 8 7 6 5 4 3 2 1 (右から左)
const COLUMN_LABELS = ['９', '８', '７', '６', '５', '４', '３', '２', '１']

// 行番号（段）のラベル: 一 二 三 四 五 六 七 八 九 (上から下)
const ROW_LABELS = ['一', '二', '三', '四', '五', '六', '七', '八', '九']

// デフォルトマスサイズ
const DEFAULT_CELL_SIZE = 60

// 盤面スタイルの設定
const BOARD_STYLES: Record<BoardStyle, {
  frameBackground: string
  boardBackground: string
  boardShadow: string
  labelColor: string
  borderColor: string
  lineColor: string
  starColor: string
}> = {
  kaya: {
    frameBackground: 'linear-gradient(145deg, #8b7355 0%, #6b5344 100%)',
    boardBackground: `linear-gradient(135deg,
      #e8d4a8 0%,
      #d9c48c 20%,
      #c9b47c 40%,
      #d4bc7c 60%,
      #dcc48c 80%,
      #e4d098 100%
    )`,
    boardShadow: 'inset 0 0 40px rgba(139, 90, 43, 0.3), inset 0 0 100px rgba(139, 90, 43, 0.15), 0 0 0 2px rgba(0,0,0,0.2)',
    labelColor: '#f5e6d3',
    borderColor: '#4a3728',
    lineColor: 'rgba(74, 55, 40, 0.6)',
    starColor: '#5d4037',
  },
  dark: {
    frameBackground: 'linear-gradient(145deg, #2d2d2d 0%, #1a1a1a 100%)',
    boardBackground: 'linear-gradient(135deg, #3d3d3d 0%, #2a2a2a 50%, #333333 100%)',
    boardShadow: 'inset 0 0 40px rgba(0, 0, 0, 0.5), 0 0 0 2px rgba(255,255,255,0.1)',
    labelColor: '#a0a0a0',
    borderColor: '#555555',
    lineColor: 'rgba(100, 100, 100, 0.5)',
    starColor: '#666666',
  },
  classic: {
    frameBackground: 'linear-gradient(145deg, #5d4037 0%, #3e2723 100%)',
    boardBackground: 'linear-gradient(135deg, #d7ccc8 0%, #bcaaa4 50%, #c7b9ae 100%)',
    boardShadow: 'inset 0 0 30px rgba(62, 39, 35, 0.2), 0 0 0 2px rgba(0,0,0,0.3)',
    labelColor: '#efebe9',
    borderColor: '#3e2723',
    lineColor: 'rgba(62, 39, 35, 0.5)',
    starColor: '#4e342e',
  },
}

/**
 * 位置が選択されているかチェック
 */
function isSelected(pos: Position, selected: Position | null): boolean {
  return selected !== null && pos.col === selected.col && pos.row === selected.row
}

/**
 * 位置が合法手かチェック
 */
function isLegalMove(pos: Position, legalMoves: Position[]): boolean {
  return legalMoves.some(m => m.col === pos.col && m.row === pos.row)
}

/**
 * 位置が最後の手に関係するかチェック
 */
function isLastMovePos(pos: Position, lastMove: { from: Position; to: Position } | null): boolean {
  if (!lastMove) return false
  return (
    (pos.col === lastMove.from.col && pos.row === lastMove.from.row) ||
    (pos.col === lastMove.to.col && pos.row === lastMove.to.row)
  )
}

/**
 * 将棋盤コンポーネント
 * 9x9の盤面を描画し、駒の配置とクリックイベントを管理
 */
export function ShogiBoard({
  board,
  selectedPosition,
  legalMoves,
  lastMove,
  onSquareClick,
  children,
  cellSize: propCellSize,
  boardStyle = 'kaya',
}: ShogiBoardProps) {
  // 盤面スタイルを取得
  const style = BOARD_STYLES[boardStyle]

  // レスポンシブなセルサイズを計算
  const cellSize = useMemo(() => {
    if (propCellSize) return propCellSize
    if (typeof window === 'undefined') return DEFAULT_CELL_SIZE
    const screenWidth = window.innerWidth
    // モバイル: 画面幅の約90%を9マスで割る（ラベル分を考慮）
    if (screenWidth < 500) {
      return Math.floor((screenWidth - 60) / 9)
    }
    // タブレット
    if (screenWidth < 768) {
      return Math.floor(Math.min(55, (screenWidth - 80) / 9))
    }
    return DEFAULT_CELL_SIZE
  }, [propCellSize])

  // フォントサイズもセルサイズに応じて調整
  const labelFontSize = cellSize < 40 ? '11px' : cellSize < 50 ? '13px' : '16px'
  const labelHeight = cellSize < 40 ? '18px' : '24px'
  const labelWidth = cellSize < 40 ? '18px' : '24px'

  // マスのクリックハンドラ
  const handleSquareClick = (col: Column, row: Row) => {
    onSquareClick({ col, row })
  }

  return (
    <div style={{ 
      display: 'inline-block', 
      position: 'relative',
      padding: '8px',
      background: style.frameBackground,
      borderRadius: '12px',
      boxShadow: '0 12px 40px rgba(0,0,0,0.4), inset 0 2px 4px rgba(255,255,255,0.1)',
    }}>
      {/* 列ラベル（上部） */}
      <div style={{ 
        display: 'flex', 
        marginLeft: '4px',
        marginBottom: cellSize < 40 ? '3px' : '6px' 
      }}>
        {COLUMN_LABELS.map((label, idx) => (
          <div
            key={`col-${idx}`}
            style={{
              width: `${cellSize}px`,
              height: labelHeight,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: style.labelColor,
              fontSize: labelFontSize,
              fontWeight: 'bold',
              fontFamily: '"Yu Mincho", "Hiragino Mincho Pro", "MS Mincho", serif',
              textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            }}
          >
            {label}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex' }}>
        {/* 盤面 */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(9, ${cellSize}px)`,
            gridTemplateRows: `repeat(9, ${cellSize}px)`,
            border: cellSize < 40 ? `2px solid ${style.borderColor}` : `4px solid ${style.borderColor}`,
            borderRadius: '6px',
            background: style.boardBackground,
            boxShadow: style.boardShadow,
            position: 'relative',
          }}
        >
          {/* 木目パターンオーバーレイ（榧スタイルのみ） */}
          {boardStyle === 'kaya' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: `
                  repeating-linear-gradient(
                    90deg,
                    transparent 0px,
                    rgba(139, 90, 43, 0.03) 1px,
                    transparent 2px,
                    transparent 8px
                  )
                `,
                pointerEvents: 'none',
              }}
            />
          )}
          
          {/* 9行 × 9列のマスを描画 */}
          {Array.from({ length: 9 }, (_, rowIdx) => {
            const row = (rowIdx + 1) as Row
            return Array.from({ length: 9 }, (_, colIdx) => {
              // 列は9から1へ（右から左）、表示用
              const col = (9 - colIdx) as Column
              const position: Position = { col, row }
              const selected = isSelected(position, selectedPosition)
              const legal = isLegalMove(position, legalMoves)
              const wasLastMove = isLastMovePos(position, lastMove)
              
              // board配列のインデックス
              const boardColIdx = colIdx

              // 背景色
              let backgroundColor = 'transparent'
              if (selected) {
                backgroundColor = 'rgba(34, 197, 94, 0.45)'
              } else if (wasLastMove) {
                backgroundColor = 'rgba(253, 224, 71, 0.45)'
              }

              // 星の位置
              const isStar = (row === 3 || row === 7) && (col === 3 || col === 7)

              return (
                <div
                  key={`${col}-${row}`}
                  onClick={() => handleSquareClick(col, row)}
                  style={{
                    width: `${cellSize}px`,
                    height: `${cellSize}px`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    position: 'relative',
                    backgroundColor,
                    borderRight: colIdx < 8 ? `1px solid ${style.lineColor}` : 'none',
                    borderBottom: rowIdx < 8 ? `1px solid ${style.lineColor}` : 'none',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    if (!selected && !wasLastMove) {
                      e.currentTarget.style.backgroundColor = 'rgba(217, 119, 6, 0.25)'
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!selected && !wasLastMove) {
                      e.currentTarget.style.backgroundColor = 'transparent'
                    }
                  }}
                >
                  {/* 合法手マーカー */}
                  {legal && !board[rowIdx][boardColIdx] && (
                    <div style={{
                      position: 'absolute',
                      inset: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}>
                      <div style={{
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: 'rgba(34, 197, 94, 0.6)',
                        boxShadow: '0 0 8px rgba(34, 197, 94, 0.4)',
                      }} />
                    </div>
                  )}

                  {/* 攻撃可能マーカー（敵の駒がある場所） */}
                  {legal && board[rowIdx][boardColIdx] && (
                    <div style={{
                      position: 'absolute',
                      inset: '3px',
                      border: '3px solid rgba(239, 68, 68, 0.7)',
                      borderRadius: '6px',
                      pointerEvents: 'none',
                      boxShadow: '0 0 8px rgba(239, 68, 68, 0.3)',
                    }} />
                  )}

                  {/* 星（盤面の目印） */}
                  {isStar && (
                    <div style={{
                      position: 'absolute',
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: style.starColor,
                      pointerEvents: 'none',
                      zIndex: 0,
                    }} />
                  )}

                  {/* 駒の描画（children経由） */}
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    {children(position, rowIdx, boardColIdx)}
                  </div>
                </div>
              )
            })
          })}
        </div>

        {/* 行ラベル（右側） */}
        <div style={{ display: 'flex', flexDirection: 'column', marginLeft: cellSize < 40 ? '4px' : '8px' }}>
          {ROW_LABELS.map((label, idx) => (
            <div
              key={`row-${idx}`}
              style={{
                width: labelWidth,
                height: `${cellSize}px`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: style.labelColor,
                fontSize: labelFontSize,
                fontWeight: 'bold',
                fontFamily: '"Yu Mincho", "Hiragino Mincho Pro", "MS Mincho", serif',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default ShogiBoard
