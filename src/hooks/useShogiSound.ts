// 将棋ゲームの効果音管理
// 木の駒を盤に打つリアルな「パチッ」という音をWeb Audio APIで合成

export type SoundType = 'move' | 'capture' | 'drop' | 'promote' | 'check' | 'gameEnd';

class ShogiSoundManager {
  private audioContext: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.8;

  /**
   * AudioContextを初期化（ユーザーインタラクション後に呼び出す必要あり）
   */
  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
  }

  /**
   * 効果音の有効/無効を切り替え
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
  }

  /**
   * 音量を設定 (0.0 - 1.0)
   */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * ノイズバッファを生成（駒音の質感用）
   */
  private createNoiseBuffer(duration: number): AudioBuffer {
    const ctx = this.audioContext!;
    const sampleRate = ctx.sampleRate;
    const bufferSize = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const data = buffer.getChannelData(0);
    
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    
    return buffer;
  }

  /**
   * リアルな将棋の駒音「パチッ」を合成
   * 木の駒が木の盤に当たる音を再現
   */
  private playRealisticPieceSound(intensity: number = 1.0): void {
    if (!this.audioContext || !this.isEnabled) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const masterVol = this.volume * intensity;

    // === 1. インパクト音（駒が盤に当たる瞬間） ===
    // 木の衝撃音は複数の周波数が混在
    const impactFrequencies = [1800, 2400, 3200, 4500];
    impactFrequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      // 急速に減衰する周波数
      osc.frequency.exponentialRampToValueAtTime(freq * 0.3, now + 0.015);

      filter.type = 'bandpass';
      filter.frequency.value = freq;
      filter.Q.value = 8;

      // 非常に短いアタックと急速な減衰
      const vol = masterVol * 0.15 * (1 - i * 0.15);
      oscGain.gain.setValueAtTime(vol, now);
      oscGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

      osc.connect(filter);
      filter.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    });

    // === 2. 木の共鳴音（盤が振動する音） ===
    const resonanceFreq = 400 + Math.random() * 100; // 少しランダム性
    const resonance = ctx.createOscillator();
    const resGain = ctx.createGain();
    const resFilter = ctx.createBiquadFilter();

    resonance.type = 'triangle';
    resonance.frequency.setValueAtTime(resonanceFreq, now);
    resonance.frequency.exponentialRampToValueAtTime(resonanceFreq * 0.6, now + 0.08);

    resFilter.type = 'lowpass';
    resFilter.frequency.value = 800;
    resFilter.Q.value = 2;

    resGain.gain.setValueAtTime(masterVol * 0.12, now + 0.003);
    resGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    resonance.connect(resFilter);
    resFilter.connect(resGain);
    resGain.connect(ctx.destination);
    resonance.start(now);
    resonance.stop(now + 0.12);

    // === 3. ノイズ成分（木の質感） ===
    const noiseBuffer = this.createNoiseBuffer(0.05);
    const noiseSource = ctx.createBufferSource();
    const noiseGain = ctx.createGain();
    const noiseFilter = ctx.createBiquadFilter();
    const noiseHipass = ctx.createBiquadFilter();

    noiseSource.buffer = noiseBuffer;

    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 2500;
    noiseFilter.Q.value = 1.5;

    noiseHipass.type = 'highpass';
    noiseHipass.frequency.value = 1000;

    noiseGain.gain.setValueAtTime(masterVol * 0.25, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseHipass);
    noiseHipass.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start(now);

    // === 4. 低音のボディ（重厚感） ===
    const body = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    const bodyFilter = ctx.createBiquadFilter();

    body.type = 'sine';
    body.frequency.setValueAtTime(180, now);
    body.frequency.exponentialRampToValueAtTime(100, now + 0.05);

    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.value = 300;

    bodyGain.gain.setValueAtTime(masterVol * 0.18, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

    body.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(ctx.destination);
    body.start(now);
    body.stop(now + 0.08);
  }

  /**
   * 駒を取る音（より強い衝撃音）
   */
  private playCaptureSound(): void {
    // 駒を取る時はより強いインパクト
    this.playRealisticPieceSound(1.3);
    
    // 追加の「パン」という残響
    if (!this.audioContext || !this.isEnabled) return;
    
    const ctx = this.audioContext;
    
    setTimeout(() => {
      const tail = ctx.createOscillator();
      const tailGain = ctx.createGain();
      const tailFilter = ctx.createBiquadFilter();

      tail.type = 'sine';
      tail.frequency.setValueAtTime(600, ctx.currentTime);
      tail.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.06);

      tailFilter.type = 'lowpass';
      tailFilter.frequency.value = 400;

      tailGain.gain.setValueAtTime(this.volume * 0.08, ctx.currentTime);
      tailGain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.1);

      tail.connect(tailFilter);
      tailFilter.connect(tailGain);
      tailGain.connect(ctx.destination);
      tail.start(ctx.currentTime);
      tail.stop(ctx.currentTime + 0.12);
    }, 15);
  }

  /**
   * 持ち駒を打つ音（少し違う響き）
   */
  private playDropSound(): void {
    // 打つ音は少し軽め
    this.playRealisticPieceSound(0.9);
  }

  /**
   * 王手の音（警告音）
   */
  private playCheckSound(): void {
    // まず駒音
    this.playRealisticPieceSound(1.1);
    
    if (!this.audioContext || !this.isEnabled) return;

    const ctx = this.audioContext;
    const vol = this.volume * 0.3;

    // 少し遅れて和風の警告音
    setTimeout(() => {
      const t = ctx.currentTime;
      [0, 0.12].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();

        osc.type = 'sine';
        osc.frequency.value = i === 0 ? 660 : 880;

        filter.type = 'lowpass';
        filter.frequency.value = 1200;

        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(vol, t + delay + 0.015);
        gain.gain.linearRampToValueAtTime(0, t + delay + 0.1);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + delay);
        osc.stop(t + delay + 0.12);
      });
    }, 50);
  }

  /**
   * ゲーム終了音
   */
  private playGameEndSound(): void {
    if (!this.audioContext || !this.isEnabled) return;

    const ctx = this.audioContext;
    const now = ctx.currentTime;
    const vol = this.volume * 0.25;

    // 和風の終了音（五音音階を使用）
    const notes = [440, 523.25, 659.25, 783.99]; // A4, C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const filter = ctx.createBiquadFilter();

      osc.type = 'sine';
      osc.frequency.value = freq;

      filter.type = 'lowpass';
      filter.frequency.value = 2000;

      const delay = i * 0.08;
      gain.gain.setValueAtTime(0, now + delay);
      gain.gain.linearRampToValueAtTime(vol * (1 - i * 0.1), now + delay + 0.03);
      gain.gain.setValueAtTime(vol * (1 - i * 0.1), now + delay + 0.25);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.8);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.9);
    });
  }

  /**
   * 成りの音（駒音 + キラキラ音）
   */
  private playPromoteSound(): void {
    // 駒音
    this.playRealisticPieceSound(1.1);

    if (!this.audioContext || !this.isEnabled) return;

    const ctx = this.audioContext;
    const vol = this.volume * 0.2;

    // キラキラした上昇音（成りの演出）
    setTimeout(() => {
      const t = ctx.currentTime;
      [0, 0.06, 0.12].forEach((delay, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.value = 1000 + i * 350;

        gain.gain.setValueAtTime(0, t + delay);
        gain.gain.linearRampToValueAtTime(vol * (1 - i * 0.15), t + delay + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, t + delay + 0.12);

        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + delay);
        osc.stop(t + delay + 0.15);
      });
    }, 30);
  }

  /**
   * 効果音を再生
   */
  play(type: SoundType): void {
    if (!this.isEnabled) return;

    // AudioContextがない場合は初期化を試みる
    if (!this.audioContext) {
      this.initialize();
    }

    // サスペンド状態の場合はレジュームを試みる
    if (this.audioContext?.state === 'suspended') {
      this.audioContext.resume();
    }

    switch (type) {
      case 'move':
        this.playRealisticPieceSound(1.0);
        break;
      case 'capture':
        this.playCaptureSound();
        break;
      case 'drop':
        this.playDropSound();
        break;
      case 'promote':
        this.playPromoteSound();
        break;
      case 'check':
        this.playCheckSound();
        break;
      case 'gameEnd':
        this.playGameEndSound();
        break;
    }
  }
}

// シングルトンインスタンス
export const soundManager = new ShogiSoundManager();

/**
 * 将棋の効果音を使用するためのカスタムフック
 */
export function useShogiSound() {
  const playSound = (type: SoundType): void => {
    soundManager.play(type);
  };

  const initialize = (): void => {
    soundManager.initialize();
  };

  const setEnabled = (enabled: boolean): void => {
    soundManager.setEnabled(enabled);
  };

  const setVolume = (volume: number): void => {
    soundManager.setVolume(volume);
  };

  return {
    playSound,
    initialize,
    setEnabled,
    setVolume,
  };
}
