// 将棋AI - 定石データベース
// LLMの知識を活用しつつ、代表的な定石を構造化

// ========================================
// 定石の型定義
// ========================================

export interface JosekiEntry {
  id: string
  name: string
  category: 'ibisha' | 'furibisha' | 'kakugawari' | 'other'
  description: string
  openingMoves: string[]  // "76歩", "34歩" 形式
  strategicGoals: string[]
  keyPoints: string[]
  counterStrategies: string[]
  recommendedFor: 'beginner' | 'intermediate' | 'advanced' | 'all'
  popularity: number  // 1-10
}

// ========================================
// 定石データベース（拡充版）
// ========================================

export const JOSEKI_DATABASE: JosekiEntry[] = [
  // ========== 居飛車系 ==========
  {
    id: 'yagura',
    name: '矢倉',
    category: 'ibisha',
    description: '堅固な矢倉囲いを築き、じっくり攻める相居飛車の代表戦法。プロでも頻繁に指される。',
    openingMoves: ['76歩', '84歩', '68銀', '34歩', '66歩', '62銀', '56歩', '54歩', '48銀', '42銀'],
    strategicGoals: [
      '矢倉囲い完成（77銀-67金-78玉）',
      '銀の繰り出し（46銀または36銀）',
      '角頭攻め（35歩-34歩）',
      '中央制圧',
      '端攻めの準備（96歩-97香）'
    ],
    keyPoints: [
      '囲いを完成させてから攻める',
      '銀を効率的に使う',
      '角の活用を考える',
      '玉の堅さで勝負'
    ],
    counterStrategies: [
      '急戦矢倉（早めに仕掛ける）',
      '右四間飛車',
      '矢倉中飛車'
    ],
    recommendedFor: 'all',
    popularity: 9
  },
  {
    id: 'kakugawari',
    name: '角換わり',
    category: 'kakugawari',
    description: '序盤で角を交換し、持ち角を活かした激しい攻め合いになる戦法。',
    openingMoves: ['76歩', '84歩', '26歩', '32金', '78金', '34歩', '22角成', '同銀'],
    strategicGoals: [
      '角打ちの隙を作らせる',
      '持ち角の効果的な打ち込み',
      '手得を活かした攻め',
      '相手陣への角打ち'
    ],
    keyPoints: [
      '角打ちの隙を作らない',
      '銀の動きに注意',
      '腰掛け銀の形を目指す',
      '右玉も視野に入れる'
    ],
    counterStrategies: [
      '角交換を避ける',
      '早繰り銀',
      '棒銀'
    ],
    recommendedFor: 'intermediate',
    popularity: 8
  },
  {
    id: 'bougin',
    name: '棒銀',
    category: 'ibisha',
    description: '銀を真っすぐ繰り出し、飛車先を突破する直線的な攻め。初心者に最適。',
    openingMoves: ['76歩', '84歩', '26歩', '34歩', '25歩', '33角', '38銀', '32金', '27銀'],
    strategicGoals: [
      '銀を26に進める',
      '飛車先突破（24歩から）',
      '端攻めとの連携',
      'シンプルな攻めで優位を築く'
    ],
    keyPoints: [
      '銀を一直線に繰り出す',
      '相手の反撃に注意',
      '飛車と銀の連携',
      '攻めが止まったら持久戦へ'
    ],
    counterStrategies: [
      '早めの銀対抗',
      '角交換から反撃',
      '持久戦に持ち込む'
    ],
    recommendedFor: 'beginner',
    popularity: 7
  },
  
  // ========== 振り飛車系 ==========
  {
    id: 'shikenbisha',
    name: '四間飛車',
    category: 'furibisha',
    description: '飛車を6筋に振り、美濃囲いで堅く守る。カウンター狙いの戦法。',
    openingMoves: ['76歩', '84歩', '68飛', '34歩', '66歩', '62銀', '78銀', '54歩', '48玉'],
    strategicGoals: [
      '美濃囲い完成（38玉-48金-58金）',
      '角道を活かした反撃',
      '相手の攻めを受け止める',
      '端攻めの準備',
      '堅い守りからの逆襲'
    ],
    keyPoints: [
      '囲いを固めてから反撃',
      '角の働きを最大化',
      '相手の仕掛けのタイミングを見極める',
      '玉を28まで入城'
    ],
    counterStrategies: [
      '居飛車穴熊',
      '急戦（棒銀、斜め棒銀）',
      '右四間飛車'
    ],
    recommendedFor: 'all',
    popularity: 9
  },
  {
    id: 'nakabisha',
    name: '中飛車',
    category: 'furibisha',
    description: '飛車を5筋に振り、中央から豪快に攻める。攻守のバランスが良い。',
    openingMoves: ['76歩', '84歩', '56歩', '34歩', '58飛', '62銀', '55歩'],
    strategicGoals: [
      '5筋の歩を活かした中央突破',
      '左右への柔軟な展開',
      '銀の繰り出し（46銀）',
      '相手陣を中央から崩す'
    ],
    keyPoints: [
      '5筋の歩を伸ばす',
      '銀を効率的に使う',
      '角の活用',
      '玉の囲いを怠らない'
    ],
    counterStrategies: [
      '超急戦',
      '居飛車穴熊',
      '5筋を固める'
    ],
    recommendedFor: 'intermediate',
    popularity: 8
  },
  {
    id: 'sankenbisha',
    name: '三間飛車',
    category: 'furibisha',
    description: '飛車を7筋に振る。石田流への発展が期待できる。',
    openingMoves: ['76歩', '84歩', '78飛', '34歩', '66歩', '62銀', '48玉', '54歩'],
    strategicGoals: [
      '石田流への発展',
      '75歩からの飛車の活用',
      '美濃囲い完成',
      '角の転換'
    ],
    keyPoints: [
      '75歩を決める',
      '玉を囲う',
      '角をうまく使う',
      '飛車の活用'
    ],
    counterStrategies: [
      '居飛車穴熊',
      '急戦',
      '角交換から反撃'
    ],
    recommendedFor: 'intermediate',
    popularity: 7
  },
  {
    id: 'migiyonkenbisha',
    name: '右四間飛車',
    category: 'other',
    description: '飛車を4筋に振り、急戦で一気に攻め込む破壊力抜群の戦法。',
    openingMoves: ['76歩', '34歩', '26歩', '44歩', '25歩', '33角', '48銀', '32銀', '68玉', '42飛'],
    strategicGoals: [
      '45歩からの急戦',
      '角頭攻め',
      '速攻で優位を築く',
      '相手の囲いが完成する前に仕掛ける'
    ],
    keyPoints: [
      '45歩を決める',
      '角と飛車の連携',
      '銀を繰り出す',
      '攻めが止まったら持久戦'
    ],
    counterStrategies: [
      '44歩を突かない',
      '急戦で迎え撃つ',
      '銀で受ける'
    ],
    recommendedFor: 'beginner',
    popularity: 6
  },
  
  // ========== 囲い関連 ==========
  {
    id: 'minogakoi',
    name: '美濃囲い',
    category: 'furibisha',
    description: '振り飛車の基本囲い。玉を28まで移動させ、金銀で守る。',
    openingMoves: ['48玉', '38玉', '28玉', '38銀', '58金', '68金'],
    strategicGoals: [
      '玉を28に入城',
      '金銀を効率的に配置',
      '端の守りを固める',
      '堅い守りからの反撃'
    ],
    keyPoints: [
      '玉は必ず28まで',
      '58金-68金の形',
      '38銀で玉頭を守る',
      '端歩を受ける'
    ],
    counterStrategies: [
      '端攻め',
      '玉頭攻め',
      'コビン攻め'
    ],
    recommendedFor: 'beginner',
    popularity: 10
  },
  {
    id: 'anaguma',
    name: '穴熊',
    category: 'ibisha',
    description: '玉を19まで囲う最も堅い囲い。終盤の入玉も視野に。',
    openingMoves: ['78金', '68玉', '59玉', '49玉', '39玉', '29玉', '19玉', '28銀'],
    strategicGoals: [
      '玉を19まで囲う',
      '金銀を集中させる',
      '圧倒的な堅さで勝負',
      '終盤まで粘れる'
    ],
    keyPoints: [
      '完成までに時間がかかる',
      '囲いながら攻めの態勢も整える',
      '端歩の扱いに注意',
      '相手の急戦に警戒'
    ],
    counterStrategies: [
      '急戦で崩しにかかる',
      '藤井システム',
      'Z（絶対に詰まない形）を崩す'
    ],
    recommendedFor: 'advanced',
    popularity: 8
  }
]

// ========================================
// 定石検索機能
// ========================================

/**
 * 現在の棋譜から適用可能な定石を検索
 */
export function findApplicableJoseki(moveHistory: string[]): JosekiEntry[] {
  if (moveHistory.length === 0) {
    // 初手からすべての定石を返す
    return JOSEKI_DATABASE.filter(j => j.popularity >= 7)
  }
  
  const applicable: JosekiEntry[] = []
  
  for (const joseki of JOSEKI_DATABASE) {
    let matches = 0
    for (let i = 0; i < Math.min(moveHistory.length, joseki.openingMoves.length); i++) {
      // 簡易マッチング（厳密ではない）
      if (moveHistory[i] === joseki.openingMoves[i]) {
        matches++
      }
    }
    // 50%以上一致すれば適用可能とみなす
    if (matches >= Math.min(moveHistory.length, joseki.openingMoves.length) * 0.5) {
      applicable.push(joseki)
    }
  }
  
  // 人気順でソート
  return applicable.sort((a, b) => b.popularity - a.popularity)
}

/**
 * カテゴリで定石を検索
 */
export function getJosekiByCategory(category: JosekiEntry['category']): JosekiEntry[] {
  return JOSEKI_DATABASE.filter(j => j.category === category)
}

/**
 * レベルに応じた定石を取得
 */
export function getJosekiForLevel(level: 'beginner' | 'intermediate' | 'advanced'): JosekiEntry[] {
  return JOSEKI_DATABASE.filter(j => 
    j.recommendedFor === level || j.recommendedFor === 'all'
  ).sort((a, b) => b.popularity - a.popularity)
}

/**
 * 定石の説明テキストを生成
 */
export function describeJoseki(joseki: JosekiEntry): string {
  return `【${joseki.name}】
${joseki.description}

◆ 狙い
${joseki.strategicGoals.map((g, i) => `${i + 1}. ${g}`).join('\n')}

◆ ポイント
${joseki.keyPoints.map((k, i) => `${i + 1}. ${k}`).join('\n')}

◆ 相手の対策
${joseki.counterStrategies.join('、')}
`
}

/**
 * 定石データベースをLLMプロンプト用にフォーマット
 */
export function formatJosekiForPrompt(josekiList: JosekiEntry[], maxCount: number = 3): string {
  const selected = josekiList.slice(0, maxCount)
  
  return selected.map(j => 
    `【${j.name}】${j.description}\n  目標: ${j.strategicGoals.slice(0, 3).join('、')}\n  ポイント: ${j.keyPoints.slice(0, 2).join('、')}`
  ).join('\n\n')
}
