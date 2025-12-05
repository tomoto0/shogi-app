# 🎯 将棋 AI - LLM Multi-Stage Reasoning Shogi Game

美しいUIとLLM（大規模言語モデル）による多段階推論AIを搭載した、プロフェッショナルな将棋ゲームアプリケーションです。

![Shogi Game](https://img.shields.io/badge/Game-Shogi-orange)
![React](https://img.shields.io/badge/React-19.0-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue)
![Vite](https://img.shields.io/badge/Vite-7.2-purple)
![License](https://img.shields.io/badge/License-MIT-green)

## 📋 目次

- [概要](#概要)
- [主な機能](#主な機能)
- [技術仕様](#技術仕様)
- [LLM多段階推論システム](#llm多段階推論システム)
- [アーキテクチャ](#アーキテクチャ)
- [セットアップ](#セットアップ)
- [Manusサーバーへのデプロイ](#manusサーバーへのデプロイ)
- [ディレクトリ構成](#ディレクトリ構成)
- [設定オプション](#設定オプション)

## 概要

本アプリケーションは、伝統的な日本の将棋ゲームをモダンなWebアプリケーションとして実装したものです。特徴的なのは、OpenAI GPT-4oを活用した**多段階推論AI**システムで、人間のように思考過程を経て次の一手を決定します。

### ターゲットユーザー
- 将棋初心者から上級者まで
- AIとの対戦を楽しみたい方
- LLMの将棋への応用に興味がある方

## 主な機能

### 🎨 美しいUI
- **榧（かや）の木目テクスチャ**を再現した盤面
- 伝統的な**五角形の駒**デザイン
- **3種類の盤面スタイル**（榧・ダーク・クラシック）
- レスポンシブデザイン（デスクトップ・タブレット・モバイル対応）

### 🤖 4段階のAI難易度
| レベル | 説明 | 推論段階 |
|--------|------|----------|
| 初級 | クイック分析 | 2段階推論 |
| 中級 | バランス型 | 3段階推論 |
| 上級 | 定石+深い読み | 4段階推論 |
| 最強 | フル深層分析 | 4段階フル推論 |

### 🔊 効果音システム
- 駒を置く音（パチッ）
- 駒を取る音
- 成り音（キラキラ効果）
- 王手警告音
- ゲーム終了音

### ⚙️ カスタマイズ可能な設定
- 効果音ON/OFF・音量調整
- 合法手の表示/非表示
- 最終手ハイライト
- 自動成り機能
- 盤面スタイル選択

### 📖 詳細なルール説明
- 駒の動きを視覚的に表示
- 成り・持ち駒・王手の解説
- 特殊ルール（千日手・入玉）の説明

## 技術仕様

### フロントエンド
| 技術 | バージョン | 用途 |
|------|-----------|------|
| React | 19.2.0 | UIフレームワーク |
| TypeScript | 5.9.3 | 型安全な開発 |
| Vite | 7.2.6 | ビルドツール |
| Tailwind CSS | 4.1.17 | スタイリング |

### バックエンド/AI
| 技術 | 用途 |
|------|------|
| OpenAI GPT-4o API | LLM多段階推論AI |
| Web Audio API | 効果音合成 |

### ビルド出力
- **形式**: 静的サイト（SPA）
- **出力先**: `dist/` ディレクトリ
- **最適化**: terserによるminify、コード分割

## LLM多段階推論システム

本アプリケーションの核心技術である**多段階推論AI**について詳しく説明します。

### 概念

従来のMinimax/Alpha-Beta探索AIとは異なり、LLMを活用して**人間のプロ棋士のような思考過程**を再現します。

### 推論段階（難易度別）

#### Stage 1: 局面分析
```
- 駒の配置状況
- 形勢判断（先手有利/後手有利/互角）
- 玉の安全度評価
```

#### Stage 2: 候補手生成
```
- 攻撃的な手の列挙
- 守備的な手の列挙
- 戦略的な手の列挙
```

#### Stage 3: 手の評価（中級以上）
```
- 各候補手のメリット/デメリット分析
- 相手の応手予測
- 3手先までの読み
```

#### Stage 4: 最終決定（上級以上）
```
- 総合的な判断
- 最善手の選択と理由
- 代替手の提示
```

### 実装コード（抜粋）

```typescript
// src/ai/llmAI.ts
async function multiStageReasoning(
  gameState: GameState,
  stages: number
): Promise<Move> {
  // Stage 1: 局面分析
  const analysis = await analyzePosition(gameState);
  
  // Stage 2: 候補手生成
  const candidates = await generateCandidates(gameState, analysis);
  
  // Stage 3: 手の評価（条件付き）
  if (stages >= 3) {
    candidates = await evaluateMoves(candidates, gameState);
  }
  
  // Stage 4: 最終決定（条件付き）
  if (stages >= 4) {
    return await deepAnalysis(candidates, gameState);
  }
  
  return selectBestMove(candidates);
}
```

### プロンプト設計

AIには詳細なシステムプロンプトが与えられ、以下の要素を含みます：

1. **将棋のルール知識**
2. **定石・戦法のデータベース**
3. **局面評価の基準**
4. **SFEN形式の理解**
5. **合法手チェック機能**

## アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│                    React Application                      │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │  App.tsx    │  │ HomeScreen  │  │ ShogiBoard  │     │
│  │  (Router)   │  │ (Settings)  │  │ (Game View) │     │
│  └──────┬──────┘  └─────────────┘  └──────┬──────┘     │
│         │                                  │            │
│  ┌──────▼──────────────────────────────────▼──────┐    │
│  │              Game Logic Layer                   │    │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────────┐   │    │
│  │  │legalMoves│ │ movePiece│ │ gameResult   │   │    │
│  │  └──────────┘ └──────────┘ └──────────────┘   │    │
│  └────────────────────────┬───────────────────────┘    │
│                           │                             │
│  ┌────────────────────────▼───────────────────────┐    │
│  │                AI Layer                         │    │
│  │  ┌──────────────┐  ┌──────────────────────┐   │    │
│  │  │ minimaxAI.ts │  │     llmAI.ts         │   │    │
│  │  │ (Alpha-Beta) │  │ (GPT-4o Multi-Stage) │   │    │
│  │  └──────────────┘  └──────────┬───────────┘   │    │
│  └───────────────────────────────┼────────────────┘    │
│                                  │                      │
└──────────────────────────────────┼──────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │      OpenAI API             │
                    │      (GPT-4o)               │
                    └─────────────────────────────┘
```

## セットアップ

### 前提条件
- Node.js 18.0以上
- npm または yarn
- OpenAI APIキー（LLM AI使用時）

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/tomoto0/shogi-app.git
cd shogi-app

# 依存関係のインストール
npm install

# 環境変数の設定
cp .env.example .env
# .envファイルを編集してOpenAI APIキーを設定
# VITE_OPENAI_API_KEY=your_api_key_here
```

### 開発サーバーの起動

```bash
npm run dev
```

ブラウザで `http://localhost:5173` にアクセス

### ビルド

```bash
npm run build
```

ビルド成果物は `dist/` ディレクトリに出力されます。

## Manusサーバーへのデプロイ

### 方法1: 静的ファイルデプロイ

1. **ビルドを実行**
```bash
npm run build
```

2. **`dist/` ディレクトリの内容をアップロード**
```
dist/
├── index.html
├── assets/
│   ├── index-XXXXX.js
│   └── index-XXXXX.css
└── sounds/
    └── (音声ファイル)
```

3. **Webサーバー設定**
   - SPAのため、全てのルートを `index.html` にフォールバック
   - 例（nginx）:
   ```nginx
   location / {
     try_files $uri $uri/ /index.html;
   }
   ```

### 方法2: Node.js環境でのデプロイ

1. **previewサーバーを使用**
```bash
npm run build
npm run preview
```

2. **または、serveパッケージを使用**
```bash
npm install -g serve
serve -s dist -l 3000
```

### 環境変数（本番環境）

```env
VITE_OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxx
```

⚠️ **セキュリティ注意**: 本番環境ではAPIキーをフロントエンドに直接埋め込まず、バックエンドプロキシを経由することを推奨します。

### 推奨サーバー構成

| 項目 | 最小要件 | 推奨 |
|------|---------|------|
| CPU | 1 vCPU | 2 vCPU |
| メモリ | 512MB | 1GB |
| ストレージ | 100MB | 500MB |
| ネットワーク | HTTP/HTTPS | HTTPS (SSL) |

## ディレクトリ構成

```
shogi/
├── public/                 # 静的アセット
│   ├── pieces/            # 駒画像
│   └── sounds/            # 効果音
├── src/
│   ├── ai/                # AI関連
│   │   ├── llmAI.ts       # LLM多段階推論AI
│   │   └── minimaxAI.ts   # Minimax AI
│   ├── api/               # API通信
│   │   └── openai.ts      # OpenAI API クライアント
│   ├── components/        # Reactコンポーネント
│   │   ├── App.tsx        # メインコンポーネント
│   │   ├── ShogiBoard.tsx # 将棋盤
│   │   ├── ShogiPiece.tsx # 駒コンポーネント
│   │   ├── HandPanel.tsx  # 持ち駒パネル
│   │   ├── HomeScreen.tsx # ホーム画面
│   │   ├── SettingsDialog.tsx    # 設定画面
│   │   ├── TutorialDialog.tsx    # ルール説明
│   │   └── PromotionDialog.tsx   # 成り選択
│   ├── hooks/             # カスタムフック
│   │   ├── useGameHistory.ts     # Undo/Redo
│   │   └── useShogiSound.ts      # 効果音
│   ├── logic/             # ゲームロジック
│   │   ├── legalMoves.ts  # 合法手生成
│   │   ├── movePiece.ts   # 駒移動処理
│   │   ├── gameResult.ts  # 勝敗判定
│   │   └── sfen.ts        # SFEN変換
│   ├── types/             # 型定義
│   │   └── index.ts       # 全型定義
│   ├── main.tsx           # エントリポイント
│   └── index.css          # グローバルスタイル
├── dist/                  # ビルド出力
├── .env.example           # 環境変数テンプレート
├── package.json           # 依存関係
├── tsconfig.json          # TypeScript設定
├── vite.config.ts         # Vite設定
└── README.md              # このファイル
```

## 設定オプション

### ゲーム設定（ホーム画面）

| 設定 | オプション | 説明 |
|------|-----------|------|
| ゲームモード | AI対戦 / 対人戦 | 対戦相手の選択 |
| 難易度 | 初級〜最強 | AIの強さ |
| 先手/後手 | 先手 / 後手 | プレイヤーの手番 |

### 表示設定（設定画面）

| 設定 | デフォルト | 説明 |
|------|-----------|------|
| 効果音 | ON | 効果音の有効/無効 |
| 音量 | 70% | 効果音の音量 |
| 合法手を表示 | ON | 移動可能なマスを表示 |
| 最終手ハイライト | ON | 直前の手を強調 |
| 自動成り | OFF | 成れる場合は自動で成る |
| 盤面スタイル | 榧 | 盤面の見た目 |

## ライセンス

MIT License

## 作者

tomoto0

---

🎮 **Enjoy playing Shogi with AI!** 🎮
