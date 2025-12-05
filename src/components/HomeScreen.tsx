/**
 * ホーム画面コンポーネント
 * 美しいスタート画面と設定オプション
 */
import { useState } from 'react'
import type { AILevel } from '../types'

type GameMode = 'pvp' | 'pvc'

interface HomeScreenProps {
  onStartGame: (settings: GameSettings) => void
}

export interface GameSettings {
  gameMode: GameMode
  aiLevel: AILevel
  playerColor: 'sente' | 'gote'
  soundEnabled: boolean
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onStartGame }) => {
  const [gameMode, setGameMode] = useState<GameMode>('pvc')
  const [aiLevel, setAiLevel] = useState<AILevel>('beginner')
  const [playerColor, setPlayerColor] = useState<'sente' | 'gote'>('sente')
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [showTutorial, setShowTutorial] = useState(false)

  const handleStart = () => {
    onStartGame({
      gameMode,
      aiLevel,
      playerColor,
      soundEnabled,
    })
  }

  // モバイル判定
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 500

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? '12px' : '16px',
      background: 'linear-gradient(135deg, #d4c088 0%, #a89968 100%)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* 背景装飾 - モバイルでは小さく */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.08, pointerEvents: 'none' }}>
        <span style={{ position: 'absolute', top: isMobile ? '20px' : '40px', left: isMobile ? '20px' : '40px', fontSize: isMobile ? '60px' : '120px', color: '#78350f', fontFamily: 'serif' }}>王</span>
        <span style={{ position: 'absolute', bottom: isMobile ? '20px' : '40px', right: isMobile ? '20px' : '40px', fontSize: isMobile ? '60px' : '120px', color: '#78350f', fontFamily: 'serif' }}>飛</span>
        {!isMobile && <span style={{ position: 'absolute', top: '25%', right: '25%', fontSize: '100px', color: '#78350f', fontFamily: 'serif' }}>角</span>}
        {!isMobile && <span style={{ position: 'absolute', bottom: '25%', left: '25%', fontSize: '100px', color: '#78350f', fontFamily: 'serif' }}>金</span>}
      </div>

      {/* メインカード */}
      <div style={{
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: isMobile ? '16px' : '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        padding: isMobile ? '20px' : '32px',
        maxWidth: '420px',
        width: '100%',
        position: 'relative',
        zIndex: 10,
      }}>
        {/* タイトル */}
        <div style={{ textAlign: 'center', marginBottom: isMobile ? '20px' : '32px' }}>
          <h1 style={{ 
            fontSize: isMobile ? '40px' : '56px', 
            fontWeight: 'bold', 
            color: '#78350f', 
            marginBottom: '8px',
            fontFamily: '"Yu Mincho", "Hiragino Mincho Pro", serif',
            textShadow: '2px 2px 4px rgba(0,0,0,0.1)'
          }}>
            将棋
          </h1>
          <p style={{ color: '#92400e', fontSize: '14px' }}>Professional Shogi Game</p>
        </div>

        {/* ゲームモード */}
        <div style={{ marginBottom: '24px' }}>
          <label style={{ display: 'block', color: '#78350f', fontWeight: 'bold', marginBottom: '12px', fontSize: '16px' }}>
            🎮 ゲームモード
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <button
              onClick={() => setGameMode('pvc')}
              style={{
                backgroundColor: gameMode === 'pvc' ? '#b45309' : '#fef3c7',
                color: gameMode === 'pvc' ? 'white' : '#92400e',
                padding: '16px',
                borderRadius: '12px',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer',
                boxShadow: gameMode === 'pvc' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              🤖 対CPU
            </button>
            <button
              onClick={() => setGameMode('pvp')}
              style={{
                backgroundColor: gameMode === 'pvp' ? '#b45309' : '#fef3c7',
                color: gameMode === 'pvp' ? 'white' : '#92400e',
                padding: '16px',
                borderRadius: '12px',
                fontWeight: 'bold',
                border: 'none',
                cursor: 'pointer',
                boxShadow: gameMode === 'pvp' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                transition: 'all 0.2s',
              }}
            >
              👥 対人戦
            </button>
          </div>
        </div>

        {/* CPU設定（対CPU選択時のみ表示） */}
        {gameMode === 'pvc' && (
          <>
            {/* AI難易度 - 多段階LLM推論システム */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#78350f', fontWeight: 'bold', marginBottom: '12px', fontSize: '16px' }}>
                🧠 AI思考レベル
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {[
                  { value: 'beginner', label: '初級', subLabel: '2段階推論', icon: '🔰', desc: 'クイック分析' },
                  { value: 'intermediate', label: '中級', subLabel: '3段階推論', icon: '⭐', desc: 'ミニマックス+LLM' },
                  { value: 'advanced', label: '上級', subLabel: '4段階推論', icon: '💪', desc: '定石+深い読み' },
                  { value: 'llm', label: '最強', subLabel: '4段階フル', icon: '🤖', desc: 'GPT-4o完全版' },
                ].map(({ value, label, subLabel, icon, desc }) => (
                  <button
                    key={value}
                    onClick={() => setAiLevel(value as AILevel)}
                    style={{
                      padding: '14px 12px',
                      borderRadius: '12px',
                      fontWeight: 'bold',
                      fontSize: '13px',
                      border: aiLevel === value ? '2px solid #1d4ed8' : '2px solid transparent',
                      cursor: 'pointer',
                      background: aiLevel === value 
                        ? 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)'
                        : 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
                      color: aiLevel === value ? 'white' : '#374151',
                      transition: 'all 0.3s ease',
                      boxShadow: aiLevel === value 
                        ? '0 4px 12px rgba(59, 130, 246, 0.4)' 
                        : '0 2px 4px rgba(0, 0, 0, 0.05)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <div style={{ fontSize: '18px' }}>{icon}</div>
                    <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{label}</div>
                    <div style={{ 
                      fontSize: '10px', 
                      opacity: aiLevel === value ? 1 : 0.7,
                      background: aiLevel === value ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      marginTop: '2px'
                    }}>
                      {subLabel}
                    </div>
                    <div style={{ 
                      fontSize: '9px', 
                      opacity: 0.7,
                      marginTop: '2px'
                    }}>
                      {desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* 手番選択 */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', color: '#78350f', fontWeight: 'bold', marginBottom: '12px', fontSize: '16px' }}>
                ♟️ あなたの手番
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <button
                  onClick={() => setPlayerColor('sente')}
                  style={{
                    backgroundColor: playerColor === 'sente' ? '#b45309' : '#fef3c7',
                    color: playerColor === 'sente' ? 'white' : '#92400e',
                    padding: '16px',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: playerColor === 'sente' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                  }}
                >
                  ☗ 先手（黒）
                </button>
                <button
                  onClick={() => setPlayerColor('gote')}
                  style={{
                    backgroundColor: playerColor === 'gote' ? '#b45309' : '#fef3c7',
                    color: playerColor === 'gote' ? 'white' : '#92400e',
                    padding: '16px',
                    borderRadius: '12px',
                    fontWeight: 'bold',
                    border: 'none',
                    cursor: 'pointer',
                    boxShadow: playerColor === 'gote' ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none',
                  }}
                >
                  ☖ 後手（白）
                </button>
              </div>
            </div>
          </>
        )}

        {/* サウンド設定 */}
        <div style={{ marginBottom: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ color: '#78350f', fontWeight: 'bold', fontSize: '16px' }}>🔊 効果音</span>
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              style={{
                width: '56px',
                height: '28px',
                borderRadius: '14px',
                border: 'none',
                cursor: 'pointer',
                backgroundColor: soundEnabled ? '#d97706' : '#d1d5db',
                position: 'relative',
                transition: 'background-color 0.2s',
              }}
            >
              <span
                style={{
                  position: 'absolute',
                  top: '2px',
                  left: soundEnabled ? '30px' : '2px',
                  width: '24px',
                  height: '24px',
                  borderRadius: '12px',
                  backgroundColor: 'white',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                  transition: 'left 0.2s',
                }}
              />
            </button>
          </div>
        </div>

        {/* スタートボタン */}
        <button 
          onClick={handleStart} 
          style={{
            width: '100%',
            padding: '20px',
            background: 'linear-gradient(to right, #d97706, #b45309)',
            color: 'white',
            fontSize: '24px',
            fontWeight: 'bold',
            borderRadius: '16px',
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
            marginTop: '24px',
            fontFamily: '"Yu Mincho", "Hiragino Mincho Pro", serif',
          }}
        >
          ▶ ゲームスタート
        </button>

        {/* ルールボタン */}
        <button
          onClick={() => setShowTutorial(true)}
          style={{
            width: '100%',
            marginTop: '12px',
            padding: '14px',
            backgroundColor: 'rgba(255,255,255,0.6)',
            color: '#92400e',
            fontWeight: 'bold',
            borderRadius: '12px',
            border: '1px solid #fcd34d',
            cursor: 'pointer',
          }}
        >
          📖 ルールを見る
        </button>
      </div>

      {/* チュートリアルモーダル */}
      {showTutorial && (
        <TutorialModal onClose={() => setShowTutorial(false)} />
      )}
    </div>
  )
}

// チュートリアルモーダル
const TutorialModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div 
    style={{
      position: 'fixed',
      inset: 0,
      backgroundColor: 'rgba(0,0,0,0.6)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 50,
      padding: '16px',
    }}
    onClick={onClose}
  >
    <div 
      style={{
        backgroundColor: 'white',
        borderRadius: '24px',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        maxWidth: '600px',
        width: '100%',
        maxHeight: '80vh',
        overflow: 'auto',
        padding: '24px',
      }}
      onClick={e => e.stopPropagation()}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h2 style={{ fontSize: '24px', fontWeight: 'bold', color: '#78350f' }}>📖 将棋のルール</h2>
        <button onClick={onClose} style={{ fontSize: '24px', color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
      </div>
      
      <div style={{ color: '#78350f' }}>
        <section style={{ marginBottom: '16px' }}>
          <h3 style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '8px' }}>🎯 目的</h3>
          <p>相手の玉将（王将）を詰ませれば勝ちです。</p>
        </section>
        
        <section style={{ marginBottom: '16px' }}>
          <h3 style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '8px' }}>♟️ 駒の動き</h3>
          <ul style={{ paddingLeft: '20px', fontSize: '14px', lineHeight: '1.8' }}>
            <li><strong>玉将</strong>：全方向に1マス</li>
            <li><strong>飛車</strong>：縦横に何マスでも</li>
            <li><strong>角行</strong>：斜めに何マスでも</li>
            <li><strong>金将</strong>：斜め後ろ以外に1マス</li>
            <li><strong>銀将</strong>：前3方向と斜め後ろに1マス</li>
            <li><strong>桂馬</strong>：前に2マス+左右に1マス（飛び越え可）</li>
            <li><strong>香車</strong>：前に何マスでも</li>
            <li><strong>歩兵</strong>：前に1マス</li>
          </ul>
        </section>
        
        <section style={{ marginBottom: '16px' }}>
          <h3 style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '8px' }}>⬆️ 成り</h3>
          <p>敵陣（相手側3段）に入ると駒を裏返して強化できます。</p>
        </section>
        
        <section>
          <h3 style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '8px' }}>✋ 持ち駒</h3>
          <p>取った駒は自分の持ち駒になり、空いているマスに打てます。</p>
        </section>
      </div>
      
      <button
        onClick={onClose}
        style={{
          marginTop: '24px',
          width: '100%',
          padding: '14px',
          backgroundColor: '#d97706',
          color: 'white',
          fontWeight: 'bold',
          borderRadius: '12px',
          border: 'none',
          cursor: 'pointer',
        }}
      >
        閉じる
      </button>
    </div>
  </div>
)

export default HomeScreen
