/**
 * チュートリアル・ルール説明ダイアログ
 */
import React, { useState } from 'react'

interface TutorialDialogProps {
  isOpen: boolean
  onClose: () => void
}

// チュートリアルのセクション
type TutorialSection = 'basics' | 'pieces' | 'promotion' | 'capture' | 'check' | 'special'

interface SectionInfo {
  title: string
  icon: string
}

const SECTIONS: Record<TutorialSection, SectionInfo> = {
  basics: { title: '基本ルール', icon: '📜' },
  pieces: { title: '駒の動き', icon: '♟️' },
  promotion: { title: '成り', icon: '⬆️' },
  capture: { title: '駒を取る', icon: '🎯' },
  check: { title: '王手と詰み', icon: '👑' },
  special: { title: '特殊ルール', icon: '⚡' },
}

/**
 * チュートリアル・ルール説明ダイアログ
 */
export const TutorialDialog: React.FC<TutorialDialogProps> = ({ isOpen, onClose }) => {
  const [activeSection, setActiveSection] = useState<TutorialSection>('basics')

  if (!isOpen) return null

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="bg-amber-700 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-2xl font-bold" style={{ fontFamily: '"Yu Mincho", serif' }}>
            📖 将棋のルール
          </h2>
          <button 
            onClick={onClose}
            className="text-2xl hover:bg-amber-800 rounded-full w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="flex h-[calc(85vh-64px)]">
          {/* サイドナビ */}
          <nav className="w-48 bg-amber-200/50 p-2 flex flex-col gap-1 overflow-y-auto">
            {(Object.entries(SECTIONS) as [TutorialSection, SectionInfo][]).map(([key, { title, icon }]) => (
              <button
                key={key}
                onClick={() => setActiveSection(key)}
                className={`px-4 py-3 rounded-lg text-left transition-all ${
                  activeSection === key
                    ? 'bg-amber-700 text-white shadow-md'
                    : 'hover:bg-amber-300/50 text-amber-900'
                }`}
              >
                <span className="mr-2">{icon}</span>
                {title}
              </button>
            ))}
          </nav>

          {/* コンテンツ */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeSection === 'basics' && <BasicsSection />}
            {activeSection === 'pieces' && <PiecesSection />}
            {activeSection === 'promotion' && <PromotionSection />}
            {activeSection === 'capture' && <CaptureSection />}
            {activeSection === 'check' && <CheckSection />}
            {activeSection === 'special' && <SpecialSection />}
          </div>
        </div>
      </div>
    </div>
  )
}

// 基本ルールセクション
const BasicsSection: React.FC = () => (
  <div className="space-y-4 text-amber-900">
    <h3 className="text-xl font-bold border-b-2 border-amber-400 pb-2">基本ルール</h3>
    
    <div className="space-y-3">
      <p className="leading-relaxed">
        将棋は日本の伝統的なボードゲームです。2人のプレイヤーが対局し、相手の玉将（王将）を詰ませることを目指します。
      </p>
      
      <div className="bg-amber-100 p-4 rounded-lg">
        <h4 className="font-bold mb-2">🎯 勝利条件</h4>
        <p>相手の玉将を「詰み」の状態にすれば勝ちです。詰みとは、相手の玉将がどこにも逃げられず、王手を解除できない状態です。</p>
      </div>
      
      <div className="bg-amber-100 p-4 rounded-lg">
        <h4 className="font-bold mb-2">🔄 手番</h4>
        <p>先手（下側）と後手（上側）が交互に1手ずつ指します。先手が最初に動きます。</p>
      </div>
      
      <div className="bg-amber-100 p-4 rounded-lg">
        <h4 className="font-bold mb-2">📏 盤面</h4>
        <p>9×9の81マスの盤面で対局します。縦の列を「筋」（1〜9）、横の行を「段」（一〜九）と呼びます。</p>
      </div>
    </div>
  </div>
)

// 駒の動きセクション
const PiecesSection: React.FC = () => (
  <div className="space-y-4 text-amber-900">
    <h3 className="text-xl font-bold border-b-2 border-amber-400 pb-2">駒の動き</h3>
    
    <p className="text-sm text-amber-700 mb-2">
      ● = 1マス移動可能　｜　★ = 何マスでも移動可能　｜　◎ = 駒の位置
    </p>
    
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <PieceCard 
        name="玉将・王将" 
        moves="全方向に1マス移動できる最も重要な駒"
      >
        <MoveDiagram pattern={[
          ['●', '●', '●'],
          ['●', '◎', '●'],
          ['●', '●', '●'],
        ]} />
      </PieceCard>
      
      <PieceCard 
        name="飛車（ひしゃ）" 
        moves="縦横に何マスでも移動可能（途中に駒があると止まる）"
      >
        <MoveDiagram pattern={[
          ['　', '★', '　'],
          ['★', '◎', '★'],
          ['　', '★', '　'],
        ]} />
      </PieceCard>
      
      <PieceCard 
        name="角行（かくぎょう）" 
        moves="斜めに何マスでも移動可能（途中に駒があると止まる）"
      >
        <MoveDiagram pattern={[
          ['★', '　', '★'],
          ['　', '◎', '　'],
          ['★', '　', '★'],
        ]} />
      </PieceCard>
      
      <PieceCard 
        name="金将（きんしょう）" 
        moves="斜め後ろ以外の6方向に1マス移動可能"
      >
        <MoveDiagram pattern={[
          ['●', '●', '●'],
          ['●', '◎', '●'],
          ['　', '●', '　'],
        ]} />
      </PieceCard>
      
      <PieceCard 
        name="銀将（ぎんしょう）" 
        moves="前方3方向と斜め後ろに1マス（横と真後ろは×）"
      >
        <MoveDiagram pattern={[
          ['●', '●', '●'],
          ['　', '◎', '　'],
          ['●', '　', '●'],
        ]} />
      </PieceCard>
      
      <PieceCard 
        name="桂馬（けいま）" 
        moves="前に2マス＋左右に1マスの位置へジャンプ（途中の駒を飛び越せる）"
      >
        <MoveDiagram pattern={[
          ['●', '　', '●'],
          ['　', '　', '　'],
          ['　', '◎', '　'],
        ]} />
      </PieceCard>
      
      <PieceCard 
        name="香車（きょうしゃ）" 
        moves="前方に何マスでも移動可能（後退不可）"
      >
        <MoveDiagram pattern={[
          ['　', '★', '　'],
          ['　', '◎', '　'],
          ['　', '　', '　'],
        ]} />
      </PieceCard>
      
      <PieceCard 
        name="歩兵（ふひょう）" 
        moves="前に1マスのみ移動可能"
      >
        <MoveDiagram pattern={[
          ['　', '●', '　'],
          ['　', '◎', '　'],
          ['　', '　', '　'],
        ]} />
      </PieceCard>
    </div>
  </div>
)

// 移動パターン図
interface MoveDiagramProps {
  pattern: string[][]
}

const MoveDiagram: React.FC<MoveDiagramProps> = ({ pattern }) => (
  <div className="flex justify-center">
    <div className="inline-grid grid-cols-3 gap-0 bg-amber-200 p-1 rounded">
      {pattern.flat().map((cell, idx) => (
        <div 
          key={idx} 
          className={`w-6 h-6 flex items-center justify-center text-xs font-bold
            ${cell === '◎' ? 'bg-amber-600 text-white rounded' : ''}
            ${cell === '●' ? 'text-green-600' : ''}
            ${cell === '★' ? 'text-blue-600' : ''}
          `}
        >
          {cell}
        </div>
      ))}
    </div>
  </div>
)

// 駒カード
interface PieceCardProps {
  name: string
  moves: string
  children: React.ReactNode
}

const PieceCard: React.FC<PieceCardProps> = ({ name, moves, children }) => (
  <div className="bg-amber-100 p-3 rounded-lg">
    <h4 className="font-bold text-lg">{name}</h4>
    <p className="text-sm text-amber-700 mb-2">{moves}</p>
    {children}
  </div>
)

// 成りセクション
const PromotionSection: React.FC = () => (
  <div className="space-y-4 text-amber-900">
    <h3 className="text-xl font-bold border-b-2 border-amber-400 pb-2">成り</h3>
    
    <p className="leading-relaxed">
      敵陣（相手側から3段目まで）に駒が入る、出る、または敵陣内で動くとき、駒を裏返して「成る」ことができます。
    </p>
    
    <div className="bg-amber-100 p-4 rounded-lg">
      <h4 className="font-bold mb-2">⬆️ 成ることができる駒</h4>
      <ul className="space-y-2">
        <li>• <strong>飛車 → 龍王</strong>：縦横に加え、斜め1マスも移動可能</li>
        <li>• <strong>角行 → 龍馬</strong>：斜めに加え、縦横1マスも移動可能</li>
        <li>• <strong>銀将 → 成銀</strong>：金将と同じ動きになる</li>
        <li>• <strong>桂馬 → 成桂</strong>：金将と同じ動きになる</li>
        <li>• <strong>香車 → 成香</strong>：金将と同じ動きになる</li>
        <li>• <strong>歩兵 → と金</strong>：金将と同じ動きになる</li>
      </ul>
    </div>
    
    <div className="bg-red-100 p-4 rounded-lg">
      <h4 className="font-bold mb-2 text-red-800">⚠️ 強制成り</h4>
      <p className="text-red-800">
        歩・香車は最奥段、桂馬は奥から2段目まで到達したら、必ず成らなければなりません。
      </p>
    </div>
  </div>
)

// 駒を取るセクション
const CaptureSection: React.FC = () => (
  <div className="space-y-4 text-amber-900">
    <h3 className="text-xl font-bold border-b-2 border-amber-400 pb-2">駒を取る・持ち駒</h3>
    
    <p className="leading-relaxed">
      将棋の大きな特徴は「持ち駒」制度です。取った駒を自分の駒として使えます。
    </p>
    
    <div className="bg-amber-100 p-4 rounded-lg">
      <h4 className="font-bold mb-2">🎯 駒を取る</h4>
      <p>自分の駒の移動先に相手の駒があれば、その駒を取って自分の「持ち駒」にできます。</p>
    </div>
    
    <div className="bg-amber-100 p-4 rounded-lg">
      <h4 className="font-bold mb-2">✋ 持ち駒を打つ</h4>
      <p>持ち駒は、自分の番に盤上の空いているマスに「打つ」ことで使えます。打った駒は成っていない状態になります。</p>
    </div>
    
    <div className="bg-red-100 p-4 rounded-lg">
      <h4 className="font-bold mb-2 text-red-800">⚠️ 打てない場所</h4>
      <ul className="text-red-800 space-y-1">
        <li>• 二歩：同じ筋に2枚以上の歩は打てない</li>
        <li>• 行き場のない場所：歩・香は最奥段、桂は奥から2段目には打てない</li>
        <li>• 打ち歩詰め：歩を打って相手を詰ますのは反則</li>
      </ul>
    </div>
  </div>
)

// 王手と詰みセクション
const CheckSection: React.FC = () => (
  <div className="space-y-4 text-amber-900">
    <h3 className="text-xl font-bold border-b-2 border-amber-400 pb-2">王手と詰み</h3>
    
    <div className="bg-amber-100 p-4 rounded-lg">
      <h4 className="font-bold mb-2">👑 王手</h4>
      <p>相手の玉将を取れる状態になっていることを「王手」といいます。王手をかけられたら、必ず王手を解除しなければなりません。</p>
    </div>
    
    <div className="bg-amber-100 p-4 rounded-lg">
      <h4 className="font-bold mb-2">🎯 王手の解除方法</h4>
      <ul className="space-y-1">
        <li>• 玉将を逃げる</li>
        <li>• 王手をかけている駒を取る</li>
        <li>• 王手の利きを遮る駒を間に入れる</li>
      </ul>
    </div>
    
    <div className="bg-red-100 p-4 rounded-lg">
      <h4 className="font-bold mb-2 text-red-800">❌ 詰み</h4>
      <p className="text-red-800">
        王手を解除する手段がない状態を「詰み」といいます。詰まされた側の負けとなります。
      </p>
    </div>
  </div>
)

// 特殊ルールセクション
const SpecialSection: React.FC = () => (
  <div className="space-y-4 text-amber-900">
    <h3 className="text-xl font-bold border-b-2 border-amber-400 pb-2">特殊ルール</h3>
    
    <div className="bg-amber-100 p-4 rounded-lg">
      <h4 className="font-bold mb-2">🔄 千日手</h4>
      <p>同一局面が4回出現すると「千日手」となり、原則として引き分けになります。ただし、連続王手の千日手は王手をかけた側の負けです。</p>
    </div>
    
    <div className="bg-amber-100 p-4 rounded-lg">
      <h4 className="font-bold mb-2">🏃 入玉</h4>
      <p>自分の玉将が相手陣に入ることを「入玉」といいます。お互いが入玉すると、通常の詰みが困難になるため、持将棋（引き分け）となることがあります。</p>
    </div>
    
    <div className="bg-red-100 p-4 rounded-lg">
      <h4 className="font-bold mb-2 text-red-800">❌ 反則</h4>
      <ul className="text-red-800 space-y-1">
        <li>• <strong>二歩</strong>：同じ筋に2枚の歩を置く</li>
        <li>• <strong>打ち歩詰め</strong>：歩を打って詰ます</li>
        <li>• <strong>王手放置</strong>：王手を解除しない</li>
        <li>• <strong>自殺手</strong>：自玉が取られる場所に動かす</li>
      </ul>
    </div>
  </div>
)

export default TutorialDialog
