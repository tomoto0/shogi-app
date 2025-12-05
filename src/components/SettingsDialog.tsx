/**
 * 設定ダイアログコンポーネント
 */
import React from 'react'

export interface GameSettings {
  soundEnabled: boolean
  soundVolume: number
  showLegalMoves: boolean
  showLastMove: boolean
  autoPromote: boolean
  confirmBeforeMove: boolean
  boardStyle: 'kaya' | 'dark' | 'classic'
}

export const DEFAULT_SETTINGS: GameSettings = {
  soundEnabled: true,
  soundVolume: 0.7,
  showLegalMoves: true,
  showLastMove: true,
  autoPromote: false,
  confirmBeforeMove: false,
  boardStyle: 'kaya',
}

interface SettingsDialogProps {
  isOpen: boolean
  onClose: () => void
  settings: GameSettings
  onSettingsChange: (settings: GameSettings) => void
}

/**
 * 設定ダイアログ
 */
export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
}) => {
  if (!isOpen) return null

  const handleChange = <K extends keyof GameSettings>(
    key: K,
    value: GameSettings[K]
  ) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    })
  }

  return (
    <div 
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl shadow-2xl max-w-md w-full overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ヘッダー */}
        <div className="bg-amber-700 text-white px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            ⚙️ 設定
          </h2>
          <button 
            onClick={onClose}
            className="text-2xl hover:bg-amber-800 rounded-full w-8 h-8 flex items-center justify-center"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* サウンド設定 */}
          <section className="space-y-3">
            <h3 className="font-bold text-amber-900 border-b border-amber-300 pb-1">
              🔊 サウンド
            </h3>
            
            <label className="flex items-center justify-between">
              <span className="text-amber-800">効果音</span>
              <ToggleSwitch
                checked={settings.soundEnabled}
                onChange={(v) => handleChange('soundEnabled', v)}
              />
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-amber-800">音量</span>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={settings.soundVolume}
                onChange={(e) => handleChange('soundVolume', parseFloat(e.target.value))}
                disabled={!settings.soundEnabled}
                className="w-32 h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer disabled:opacity-50"
              />
            </label>
          </section>

          {/* 表示設定 */}
          <section className="space-y-3">
            <h3 className="font-bold text-amber-900 border-b border-amber-300 pb-1">
              👁️ 表示
            </h3>
            
            <label className="flex items-center justify-between">
              <span className="text-amber-800">合法手を表示</span>
              <ToggleSwitch
                checked={settings.showLegalMoves}
                onChange={(v) => handleChange('showLegalMoves', v)}
              />
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-amber-800">最終手をハイライト</span>
              <ToggleSwitch
                checked={settings.showLastMove}
                onChange={(v) => handleChange('showLastMove', v)}
              />
            </label>
            
            <label className="flex items-center justify-between">
              <span className="text-amber-800">盤面スタイル</span>
              <select
                value={settings.boardStyle}
                onChange={(e) => handleChange('boardStyle', e.target.value as GameSettings['boardStyle'])}
                className="px-3 py-1 rounded-lg bg-amber-100 border border-amber-400 text-amber-800"
              >
                <option value="kaya">榧（標準）</option>
                <option value="classic">クラシック</option>
                <option value="dark">ダーク</option>
              </select>
            </label>
          </section>

          {/* ゲームプレイ設定 */}
          <section className="space-y-3">
            <h3 className="font-bold text-amber-900 border-b border-amber-300 pb-1">
              🎮 ゲームプレイ
            </h3>
            
            <label className="flex items-center justify-between">
              <div>
                <span className="text-amber-800">自動成り</span>
                <p className="text-xs text-amber-600">成れる時は常に成る</p>
              </div>
              <ToggleSwitch
                checked={settings.autoPromote}
                onChange={(v) => handleChange('autoPromote', v)}
              />
            </label>
          </section>

          {/* リセットボタン */}
          <div className="pt-4 border-t border-amber-300">
            <button
              onClick={() => onSettingsChange(DEFAULT_SETTINGS)}
              className="w-full py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
            >
              初期設定に戻す
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// トグルスイッチコンポーネント
interface ToggleSwitchProps {
  checked: boolean
  onChange: (checked: boolean) => void
}

const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={() => onChange(!checked)}
    className={`
      relative w-12 h-6 rounded-full transition-colors
      ${checked ? 'bg-amber-600' : 'bg-gray-300'}
    `}
  >
    <span
      className={`
        absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform
        ${checked ? 'left-6' : 'left-0.5'}
      `}
    />
  </button>
)

export default SettingsDialog
