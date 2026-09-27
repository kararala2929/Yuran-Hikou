/**
 * hud.js — HUD 表示更新
 *
 * DOM要素の速度・高度・コンパスを毎フレーム更新する。
 */

const DIR_LABELS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export class HUD {
    constructor() {
        this.speedEl   = document.getElementById('val-speed');
        this.altEl     = document.getElementById('val-alt');
        this.headingEl = document.getElementById('val-heading');
        this.helpEl    = document.getElementById('help-panel');
        this.barEl     = document.getElementById('speed-bar');
        this.helpVisible = true;
    }

    /**
     * @param {number} speed    – 内部速度値
     * @param {number} altitude – Y座標
     * @param {number} heading  – 度数 (0-360)
     */
    update(speed, altitude, heading) {
        /* 速度: 内部単位 → 表示 km/h（スケール 1.8） */
        const kph = Math.round(speed * 1.8);
        if (this.speedEl) this.speedEl.textContent = kph;

        /* 高度 */
        const alt = Math.max(0, Math.round(altitude));
        if (this.altEl) this.altEl.textContent = alt;

        /* コンパス */
        const deg  = ((Math.round(heading) % 360) + 360) % 360;
        const dIdx = Math.round(deg / 45) % 8;
        if (this.headingEl) {
            this.headingEl.textContent = `${String(deg).padStart(3, '0')}° ${DIR_LABELS[dIdx]}`;
        }

        /* 速度バー */
        if (this.barEl) {
            const pct = Math.round(((speed - 55) / (250 - 55)) * 100);
            this.barEl.style.height = `${Math.max(5, Math.min(100, pct))}%`;
        }
    }

    toggleHelp() {
        this.helpVisible = !this.helpVisible;
        if (this.helpEl) {
            this.helpEl.classList.toggle('hidden', !this.helpVisible);
        }
    }
}
