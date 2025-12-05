// 成り選択ダイアログ
import type { Piece, AllPieceType } from '../types'
import { ShogiPiece } from './ShogiPiece'
import { promotePiece } from '../logic/board'

interface PromotionDialogProps {
  piece: Piece
  onChoice: (promote: boolean) => void
}

export function PromotionDialog({ piece, onChoice }: PromotionDialogProps) {
  // 成った駒
  const promotedType = promotePiece(piece.type as any) as AllPieceType
  const promotedPiece: Piece = {
    ...piece,
    type: promotedType,
    isPromoted: true,
  }

  return (
    <div 
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      onClick={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-amber-100 rounded-xl p-6 shadow-2xl border-4 border-amber-700"
        style={{
          background: `
            linear-gradient(135deg, 
              rgba(245, 230, 200, 0.95) 0%, 
              rgba(225, 200, 160, 0.95) 50%,
              rgba(200, 170, 130, 0.95) 100%
            )
          `,
        }}
      >
        <h3 
          className="text-xl font-bold text-amber-900 text-center mb-4"
          style={{ fontFamily: '"Yu Mincho", "Hiragino Mincho Pro", serif' }}
        >
          成りますか？
        </h3>
        
        <div className="flex gap-6 justify-center">
          {/* 成る */}
          <button
            onClick={() => onChoice(true)}
            className="flex flex-col items-center gap-2 p-4 rounded-lg
                       bg-amber-200/50 hover:bg-amber-300/70 
                       border-2 border-amber-600 transition-all
                       hover:scale-105 active:scale-95"
          >
            <div className="w-14 h-16">
              <ShogiPiece
                piece={promotedPiece}
                size={56}
                isSelected={false}
              />
            </div>
            <span 
              className="text-lg font-bold text-red-700"
              style={{ fontFamily: '"Yu Mincho", "Hiragino Mincho Pro", serif' }}
            >
              成る
            </span>
          </button>
          
          {/* 成らない */}
          <button
            onClick={() => onChoice(false)}
            className="flex flex-col items-center gap-2 p-4 rounded-lg
                       bg-amber-200/50 hover:bg-amber-300/70 
                       border-2 border-amber-600 transition-all
                       hover:scale-105 active:scale-95"
          >
            <div className="w-14 h-16">
              <ShogiPiece
                piece={piece}
                size={56}
                isSelected={false}
              />
            </div>
            <span 
              className="text-lg font-bold text-amber-900"
              style={{ fontFamily: '"Yu Mincho", "Hiragino Mincho Pro", serif' }}
            >
              不成
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
