/**
 * minimap.js — 航空GPSミニマップ / レーダー
 *
 * 島の全景・現在地・進行方位・ランドマークを表示する。
 * - 2D Canvas による超軽量描画（地形テクスチャは起動時に事前レンダリング）
 * - モード切替: 「島全体 (ALL)」 と 「自機中心追従 (ZOOM)」 （Mキーまたはクリックで切替）
 * - 飛行軌跡（フライトトレイル）の描画
 * - 進行方位ビーム & ランドマーク表示（火山・町・灯台・風車・桟橋・離陸地）
 */

const WORLD_HALF = 1250;      // 全体マップの表示半径 (±1250m)
const ZOOM_HALF  = 400;       // ズーム追従モードの表示半径 (±400m)
const MAX_TRAIL  = 45;        // 軌跡の最大記録点数

export class Minimap {
    constructor(terrain, containerId = 'minimap-container', canvasId = 'minimap-canvas') {
        this.terrain   = terrain;
        this.container = document.getElementById(containerId);
        this.canvas    = document.getElementById(canvasId);
        this.ctx       = this.canvas ? this.canvas.getContext('2d') : null;

        // 内部解像度（Retina対応）
        this.size = 280;
        if (this.canvas) {
            this.canvas.width  = this.size;
            this.canvas.height = this.size;
        }

        // モード: 'global' (島全体) または 'follow' (自機ズーム追従)
        this.mode = 'global';
        this.modeBadge = document.getElementById('minimap-mode-badge');

        // フライト軌跡ログ [ { x, z, alt } ]
        this.trail = [];
        this.lastTrailTime = 0;

        // ランドマーク定義
        this.landmarks = [
            { icon: '🌋', name: '火山', x: -380, z: -330, color: '#ff6b4a' },
            { icon: '🏘️', name: 'タウン', x: 250,  z: 220,  color: '#4cc9f0' },
            { icon: '🗼', name: '灯台', x: 620,  z: -30,  color: '#ffd166' },
            { icon: '🌀', name: '風車', x: -120, z: 320,  color: '#06d6a0' },
            { icon: '⚓', name: '桟橋', x: 360,  z: 500,  color: '#118ab2' },
            { icon: '🛫', name: '離陸地', x: 220, z: 250,  color: '#f72585' },
        ];

        // 高解像度事前レンダリング用Canvas (島全域マスター画像)
        this.masterRes = 360;
        this.masterCanvas = document.createElement('canvas');
        this.masterCanvas.width  = this.masterRes;
        this.masterCanvas.height = this.masterRes;

        this._renderMasterMap();
        this._setupEvents();
    }

    /** クリックやキーでモード切り替え */
    _setupEvents() {
        if (this.container) {
            this.container.addEventListener('click', () => {
                this.toggleMode();
            });
        }
    }

    toggleMode() {
        this.mode = this.mode === 'global' ? 'follow' : 'global';
        if (this.modeBadge) {
            this.modeBadge.textContent = this.mode === 'global' ? '全体 (ALL)' : '追従 (ZOOM)';
            this.modeBadge.classList.toggle('badge-zoom', this.mode === 'follow');
        }
    }

    /** 島の全景テクスチャを1度だけ生成（高速サンプリング） */
    _renderMasterMap() {
        const ctx = this.masterCanvas.getContext('2d');
        const res = this.masterRes;
        const half = res / 2;
        const imgData = ctx.createImageData(res, res);
        const data = imgData.data;

        // 背景: 海の深いグラデーション
        ctx.fillStyle = '#08172c';
        ctx.fillRect(0, 0, res, res);

        for (let py = 0; py < res; py++) {
            const wz = ((py - half) / half) * WORLD_HALF;
            for (let px = 0; px < res; px++) {
                const wx = ((px - half) / half) * WORLD_HALF;
                const distSq = (wx * wx + wz * wz);
                const d = Math.sqrt(distSq);

                const h = this.terrain.getHeightAt(wx, wz);
                const idx = (py * res + px) * 4;

                if (h > 1.2) {
                    // 地形着色
                    let r, g, b;
                    if (h < 4.0) {
                        // 砂浜 (温かいサンドベージュ)
                        r = 246; g = 229; b = 139;
                    } else if (h < 12) {
                        // 沿岸グリーン
                        r = 72;  g = 212; b = 130;
                    } else if (h < 55) {
                        // 低地平野 (エメラルド)
                        r = 46;  g = 204; b = 113;
                    } else if (h < 120) {
                        // 中腹の緑
                        r = 39;  g = 174; b = 96;
                    } else if (h < 220) {
                        // 深緑・山岳
                        r = 30;  g = 130; b = 76;
                    } else {
                        // 火山・最高峰
                        const vd = Math.hypot(wx + 380, wz + 330);
                        if (vd < 120) {
                            r = 75; g = 38; b = 25; // 火山溶岩岩
                        } else {
                            r = 125; g = 95; b = 80; // 山岳岩肌
                        }
                    }

                    // 浅瀬のソフトエッジ
                    data[idx]     = r;
                    data[idx + 1] = g;
                    data[idx + 2] = b;
                    data[idx + 3] = 255;
                } else {
                    // 海（海岸線に近い部分はエメラルドグリーンの浅瀬グラデーション）
                    if (d < 950) {
                        const shallow = Math.max(0, 1 - (d - 750) / 200);
                        data[idx]     = Math.round(11 + 25 * shallow);
                        data[idx + 1] = Math.round(32 + 75 * shallow);
                        data[idx + 2] = Math.round(58 + 80 * shallow);
                        data[idx + 3] = 255;
                    } else {
                        data[idx]     = 8;
                        data[idx + 1] = 23;
                        data[idx + 2] = 44;
                        data[idx + 3] = 255;
                    }
                }
            }
        }

        ctx.putImageData(imgData, 0, 0);

        // 火山火口の赤熱ハイライト
        const volX = half + (-380 / WORLD_HALF) * half;
        const volZ = half + (-330 / WORLD_HALF) * half;
        const craterGrad = ctx.createRadialGradient(volX, volZ, 1, volX, volZ, 12);
        craterGrad.addColorStop(0, 'rgba(255, 80, 40, 0.9)');
        craterGrad.addColorStop(0.5, 'rgba(200, 40, 10, 0.5)');
        craterGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = craterGrad;
        ctx.beginPath();
        ctx.arc(volX, volZ, 12, 0, Math.PI * 2);
        ctx.fill();
    }

    /** 毎フレーム更新 */
    update(planePos, headingDeg, alt) {
        if (!this.ctx) return;

        // フライト軌跡のサンプリング（0.5秒おき）
        const now = performance.now();
        if (now - this.lastTrailTime > 400) {
            this.trail.push({ x: planePos.x, z: planePos.z, alt: alt });
            if (this.trail.length > MAX_TRAIL) {
                this.trail.shift();
            }
            this.lastTrailTime = now;
        }

        const size = this.size;
        const half = size / 2;
        const ctx  = this.ctx;

        ctx.clearRect(0, 0, size, size);

        // 円形レーダーマスク & クリッピング
        ctx.save();
        ctx.beginPath();
        ctx.arc(half, half, half - 4, 0, Math.PI * 2);
        ctx.clip();

        // ── 描画領域のスケール計算 ──
        if (this.mode === 'global') {
            // 島全体表示: 固定マスターマップ描画
            ctx.drawImage(this.masterCanvas, 0, 0, size, size);

            // 境界線（飛行エリア制限の薄い円）
            ctx.strokeStyle = 'rgba(76, 201, 240, 0.15)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.arc(half, half, (1200 / WORLD_HALF) * half, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);

            // レーダー同心円（距離目盛）
            this._drawRangeRings(ctx, half, [500, 1000], WORLD_HALF);

            // ランドマーク描画
            this._drawLandmarks(ctx, half, WORLD_HALF, 0, 0);

            // 軌跡描画
            this._drawTrail(ctx, half, WORLD_HALF, 0, 0);

            // 自機アイコン
            const px = half + (planePos.x / WORLD_HALF) * half;
            const pz = half + (planePos.z / WORLD_HALF) * half;
            this._drawPlayer(ctx, px, pz, headingDeg, alt);

        } else {
            // 自機ズーム追従モード: 自機を中心にマップをパン描画
            const scale = WORLD_HALF / ZOOM_HALF;
            const sx = (planePos.x / WORLD_HALF) * half;
            const sz = (planePos.z / WORLD_HALF) * half;

            ctx.save();
            ctx.translate(half, half);
            ctx.scale(scale, scale);
            ctx.translate(-half - sx, -half - sz);
            ctx.drawImage(this.masterCanvas, 0, 0, size, size);
            ctx.restore();

            // ズーム追従のレーダー同心円 (100m, 250m)
            this._drawRangeRings(ctx, half, [150, 300], ZOOM_HALF);

            // ランドマーク描画（相対オフセット）
            this._drawLandmarks(ctx, half, ZOOM_HALF, planePos.x, planePos.z);

            // 軌跡描画
            this._drawTrail(ctx, half, ZOOM_HALF, planePos.x, planePos.z);

            // 自機は中央に固定
            this._drawPlayer(ctx, half, half, headingDeg, alt);
        }

        ctx.restore(); // クリップ解除

        // ── 装飾オーバーレイ（クリップ外側のリム・方角・スキャンライン） ──
        this._drawRadarChrome(ctx, half);
    }

    /** 距離レンジリング */
    _drawRangeRings(ctx, center, distances, currentRange) {
        ctx.strokeStyle = 'rgba(76, 201, 240, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 5]);

        for (const dist of distances) {
            const r = (dist / currentRange) * center;
            if (r < center) {
                ctx.beginPath();
                ctx.arc(center, center, r, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        ctx.setLineDash([]);
    }

    /** ランドマーク描画 */
    _drawLandmarks(ctx, center, range, centerOffsetX, centerOffsetZ) {
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        for (const lm of this.landmarks) {
            const relX = lm.x - centerOffsetX;
            const relZ = lm.z - centerOffsetZ;

            const px = center + (relX / range) * center;
            const pz = center + (relZ / range) * center;

            // マップ円内に収まる場合のみ表示
            const dFromCenter = Math.hypot(px - center, pz - center);
            if (dFromCenter < center - 14) {
                // アイコン
                ctx.font = '13px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
                ctx.fillText(lm.icon, px, pz - 2);

                // ミニラベル
                ctx.font = 'bold 9px "Outfit", sans-serif';
                ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 3;
                ctx.fillText(lm.name, px, pz + 10);
                ctx.shadowBlur = 0;
            }
        }
    }

    /** 飛行軌跡 */
    _drawTrail(ctx, center, range, centerOffsetX, centerOffsetZ) {
        if (this.trail.length < 2) return;

        ctx.save();
        ctx.lineWidth = 2.0;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        for (let i = 1; i < this.trail.length; i++) {
            const p0 = this.trail[i - 1];
            const p1 = this.trail[i];

            const x0 = center + ((p0.x - centerOffsetX) / range) * center;
            const z0 = center + ((p0.z - centerOffsetZ) / range) * center;
            const x1 = center + ((p1.x - centerOffsetX) / range) * center;
            const z1 = center + ((p1.z - centerOffsetZ) / range) * center;

            const alpha = (i / this.trail.length) * 0.45;
            ctx.strokeStyle = `rgba(76, 201, 240, ${alpha})`;

            ctx.beginPath();
            ctx.moveTo(x0, z0);
            ctx.lineTo(x1, z1);
            ctx.stroke();
        }
        ctx.restore();
    }

    /** 自機アイコンと進行方向コーン */
    _drawPlayer(ctx, px, pz, headingDeg, alt) {
        ctx.save();
        ctx.translate(px, pz);

        // 進行方向ビーム (半透明の照射コーン)
        ctx.save();
        ctx.rotate((headingDeg * Math.PI) / 180);

        const beamGrad = ctx.createLinearGradient(0, 0, 0, -38);
        beamGrad.addColorStop(0, 'rgba(76, 201, 240, 0.45)');
        beamGrad.addColorStop(1, 'rgba(76, 201, 240, 0.0)');
        ctx.fillStyle = beamGrad;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(-14, -38);
        ctx.lineTo(14, -38);
        ctx.closePath();
        ctx.fill();

        // 機体シンボル (スタイリッシュなデルタウィング)
        ctx.fillStyle = '#ff3366';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.8;
        ctx.shadowColor = '#ff3366';
        ctx.shadowBlur = 8;

        ctx.beginPath();
        ctx.moveTo(0, -9);      // ノーズ先端
        ctx.lineTo(7, 8);       // 右翼端
        ctx.lineTo(0, 5);       // テール中央インセット
        ctx.lineTo(-7, 8);      // 左翼端
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        ctx.restore(); // 飛行機回転解除

        // 機体中心のパルス発光ドット
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(0, 0, 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    /** レーダー外枠・方位マーカー */
    _drawRadarChrome(ctx, half) {
        // ガラス反射リム
        ctx.save();
        ctx.strokeStyle = 'rgba(76, 201, 240, 0.45)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(half, half, half - 3, 0, Math.PI * 2);
        ctx.stroke();

        // 方位ノッチ (N, E, S, W)
        const dirs = [
            { text: 'N', angle: -Math.PI / 2, color: '#4cc9f0', bold: true },
            { text: 'E', angle: 0,            color: 'rgba(255,255,255,0.6)', bold: false },
            { text: 'S', angle: Math.PI / 2,  color: 'rgba(255,255,255,0.6)', bold: false },
            { text: 'W', angle: Math.PI,       color: 'rgba(255,255,255,0.6)', bold: false },
        ];

        for (const d of dirs) {
            const r = half - 10;
            const x = half + Math.cos(d.angle) * r;
            const y = half + Math.sin(d.angle) * r;

            ctx.font = d.bold ? 'bold 10px "Outfit", sans-serif' : '9px "Outfit", sans-serif';
            ctx.fillStyle = d.color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(d.text, x, y);
        }

        ctx.restore();
    }
}
