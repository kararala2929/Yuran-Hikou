/**
 * terrain.js — プロシージャル島地形生成（リアルテクスチャ版）
 * 
 * Simplex Noiseで地形ハイトマップを生成し、
 * MeshStandardMaterialとスムースシェーディング、
 * 傾斜・高度に応じた自然なテクスチャカラーリングを実現する。
 */
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

const SIZE     = 2000;
const HALF     = SIZE / 2;
const SEGMENTS = 256;
const SEG1     = SEGMENTS + 1;       // 257
const MAX_H    = 320;                // 最大高さ

/* ── 地形カラーパレット（南国リゾート・夏版） ── */
const C_SAND_WET        = new THREE.Color(0.85, 0.74, 0.48);  // 濡れたサンドベージュ
const C_SAND_DRY        = new THREE.Color(0.965, 0.898, 0.553); // 温かいサンドベージュ (#f6e58d)
const C_GRASS_LOW       = new THREE.Color(0.18, 0.80, 0.44);  // 鮮やかなエメラルドグリーン (#2ecc71)
const C_GRASS_MID       = new THREE.Color(0.15, 0.68, 0.38);  // みずみずしい緑 (#27ae60)
const C_GRASS_HIGH      = new THREE.Color(0.12, 0.51, 0.30);  // 南国の深緑 (#1e824c)
const C_GRASS_PEAK      = new THREE.Color(0.10, 0.44, 0.24);  // 山頂の豊かな緑 (#196f3d)
const C_ROCK_BROWN_LIGHT = new THREE.Color(0.55, 0.43, 0.39); // 明るい茶褐色の岩肌 (#8d6e63)
const C_ROCK_BROWN_MID   = new THREE.Color(0.47, 0.33, 0.28); // 温かみのある茶褐色の岩肌 (#795548)
const C_ROCK_BROWN_DARK  = new THREE.Color(0.36, 0.25, 0.22); // 陰影のある茶褐色岩肌 (#5d4037)
const C_LAVA_DARK       = new THREE.Color(0.22, 0.10, 0.06);
const C_LAVA_MID        = new THREE.Color(0.38, 0.18, 0.10);
const _tmpA = new THREE.Color();
const _tmpB = new THREE.Color();

export class Terrain {
    constructor() {
        this.noise2D    = createNoise2D();
        this.detailNoise = createNoise2D();
        this.heightData = new Float32Array(SEG1 * SEG1);
        this.mesh       = null;
    }

    /* ── 地形メッシュの生成 ── */
    generate(scene) {
        const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
        geo.rotateX(-Math.PI / 2);

        const pos    = geo.attributes.position;
        const norm   = geo.attributes.normal;
        const colors = new Float32Array(pos.count * 3);
        const col    = new THREE.Color();

        /* ── 高さの設定 ── */
        for (let i = 0; i < pos.count; i++) {
            const wx = pos.getX(i);
            const wz = pos.getZ(i);
            const h  = this._height(wx, wz);

            pos.setY(i, h);

            // グリッドに格納
            const row = Math.floor(i / SEG1);
            const c   = i % SEG1;
            this.heightData[row * SEG1 + c] = h;
        }

        /* ── 法線を再計算（スムースシェーディング用） ── */
        geo.computeVertexNormals();

        /* ── 傾斜・高度に応じた色付け ── */
        for (let i = 0; i < pos.count; i++) {
            const wx = pos.getX(i);
            const wz = pos.getZ(i);
            const h  = pos.getY(i);

            // 法線からスロープ（傾斜）を計算
            const nx = norm ? geo.attributes.normal.getX(i) : 0;
            const ny = norm ? geo.attributes.normal.getY(i) : 1;
            const nz = norm ? geo.attributes.normal.getZ(i) : 0;
            const slope = 1.0 - ny; // 0=平坦, 1=垂直

            this._colorRealistic(h, wx, wz, slope, col);
            colors[i * 3]     = col.r;
            colors[i * 3 + 1] = col.g;
            colors[i * 3 + 2] = col.b;
        }

        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

        /* ── MeshStandardMaterial（PBR風） ── */
        this.mesh = new THREE.Mesh(
            geo,
            new THREE.MeshStandardMaterial({
                vertexColors: true,
                roughness: 0.85,
                metalness: 0.02,
                flatShading: false,   // スムースシェーディング
            })
        );
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);
    }

    /* ── fBm (fractional Brownian motion) ── */
    _fbm(x, z, oct = 6) {
        let v = 0, a = 1, f = 1.8, mx = 0;
        for (let i = 0; i < oct; i++) {
            v  += this.noise2D(x * f, z * f) * a;
            mx += a;
            a  *= 0.48;
            f  *= 2.1;
        }
        return v / mx;                       // -1..1
    }

    /* ── ワールド座標 → 高さ ── */
    _height(wx, wz) {
        const nx = wx / HALF;                // -1..1
        const nz = wz / HALF;

        // ── 島マスク（放射グラデーション）
        const d    = Math.sqrt(nx * nx + nz * nz);
        const mask = Math.max(0, 1 - d * d * 1.35);

        // ── ベース地形
        let h = (this._fbm(nx, nz, 6) + 1) * 0.5;   // 0..1
        h = h * h * 0.8;                              // ピーク強調
        h *= mask;

        // ── 🌋 火山（北西 −0.38, −0.33）
        const vd    = Math.sqrt((nx + 0.38) ** 2 + (nz + 0.33) ** 2);
        const vCone = Math.max(0, 1 - vd * 3.2) ** 1.6 * 1.4;
        const vCrat = Math.max(0, 1 - vd * 14)  ** 2   * 0.35;
        h += (vCone - vCrat) * mask;

        // ── ⛰️ 山脈（中央〜北東へ走る尾根）
        const rn = Math.abs(
            nz * 0.65 + nx * 0.25 + this.noise2D(nx * 4.5, nz * 4.5) * 0.07
        );
        h += Math.max(0, 0.20 - rn) * 3.2 * mask;

        // ── 🏖️ 南側の丘陵
        const hd = Math.sqrt((nx - 0.15) ** 2 + (nz - 0.35) ** 2);
        h += Math.max(0, 1 - hd * 5) * 0.13 * mask;

        let rawH = h * MAX_H;

        /* ── 海中への滑らかな潜り込み ──
         * 独立した砂浜リング(beach.js)が海岸線を綺麗にカバーするため、
         * 地形メッシュは段差を作らず自然に海面下(-8m)へ滑らかにフェード
         */
        if (mask < 0.18) {
            const seaFade = (0.18 - mask) / 0.18;
            rawH = THREE.MathUtils.lerp(rawH, -8.0, Math.pow(seaFade, 1.2));
        }

        return rawH;
    }

    /* ── ワールド座標 → バイリニア補間高さ ── */
    getHeightAt(wx, wz) {
        const gx = ((wx + HALF) / SIZE) * SEGMENTS;
        const gz = ((wz + HALF) / SIZE) * SEGMENTS;
        const ix = Math.floor(gx);
        const iz = Math.floor(gz);
        const fx = gx - ix;
        const fz = gz - iz;

        if (ix < 0 || ix >= SEGMENTS || iz < 0 || iz >= SEGMENTS) return 0;

        const h00 = this.heightData[ iz      * SEG1 + ix    ];
        const h10 = this.heightData[ iz      * SEG1 + ix + 1];
        const h01 = this.heightData[(iz + 1) * SEG1 + ix    ];
        const h11 = this.heightData[(iz + 1) * SEG1 + ix + 1];

        const top = h00 + (h10 - h00) * fx;
        const bot = h01 + (h11 - h01) * fx;
        return top + (bot - top) * fz;
    }

    /* ── 高さ・傾斜 → リアル頂点色 ── */
    _colorRealistic(h, wx, wz, slope, out) {
        const nx = wx / HALF;
        const nz = wz / HALF;

        /* ── ノイズによるテクスチャ変化 ── */
        const detailVal = this.detailNoise(wx * 0.015, wz * 0.015) * 0.5 + 0.5;
        const microDetail = this.detailNoise(wx * 0.06, wz * 0.06) * 0.12;

        /* ── 火山域 ── */
        const vd = Math.sqrt((nx + 0.38) ** 2 + (nz + 0.33) ** 2);
        if (vd < 0.12 && h > 260) {
            out.copy(C_LAVA_DARK);
            out.r += microDetail; out.g += microDetail * 0.3;
            return;
        }
        if (vd < 0.22 && h > 180) {
            const t = Math.min(1, (h - 180) / 100);
            out.copy(_tmpA.copy(C_LAVA_MID).lerp(C_LAVA_DARK, t));
            out.r += microDetail; out.g += microDetail * 0.3;
            return;
        }

        /* ── 波打ち際のフォームライン（海岸線） ── */
        if (h < 2.5) {
            /* h=1.5（最低砂浜）〜2.5 の範囲に白い波打ち際を描画 */
            const foamT = 1.0 - Math.abs(h - 2.0) / 0.8;
            const foam = Math.max(0, foamT);
            const wetSand = _tmpA.copy(C_SAND_WET);
            wetSand.r -= 0.05; wetSand.g -= 0.03; wetSand.b -= 0.02;
            const foamWhite = _tmpB.set(0.90, 0.95, 0.97);
            out.lerpColors(wetSand, foamWhite, foam * 0.65);
            return;
        }

        /* ── 水際の湿った砂浜 ── */
        if (h < 4.0) {
            const t = (h - 2.5) / 1.5;
            const wetSand = _tmpA.copy(C_SAND_WET);
            wetSand.r += microDetail * 0.5; wetSand.g += microDetail * 0.4;
            const drySand = _tmpB.copy(C_SAND_DRY);
            drySand.r += detailVal * 0.03;
            out.lerpColors(wetSand, drySand, t);
            return;
        }

        /* ── 乾いた砂浜 ── */
        if (h < 6.0) {
            out.copy(_tmpA.copy(C_SAND_DRY));
            out.r += microDetail; out.g += microDetail * 0.9; out.b += microDetail * 0.7;
            return;
        }

        /* ── 砂浜→草地の遷移 ── */
        if (h < 14) {
            const t = (h - 6.0) / 8.0;
            const sand = _tmpA.copy(C_SAND_DRY);
            sand.r += detailVal * 0.04; sand.g += detailVal * 0.03;
            const grass = _tmpB.copy(C_GRASS_LOW);
            grass.r += microDetail; grass.g += microDetail * 0.5;
            out.lerpColors(sand, grass, t * t);
            return;
        }

        /* ── 傾斜が急な場所は温かみのある茶褐色の岩肌 ── */
        const isSteep = slope > 0.32;
        const rockBlend = Math.min(1.0, Math.max(0.0, (slope - 0.32) / 0.28));
        const brownRock = _tmpB.copy(C_ROCK_BROWN_MID).lerp(C_ROCK_BROWN_LIGHT, detailVal * 0.7);
        brownRock.lerp(C_ROCK_BROWN_DARK, (1.0 - detailVal) * 0.4);
        brownRock.r += microDetail * 0.4; brownRock.g += microDetail * 0.3; brownRock.b += microDetail * 0.2;

        /* ── 低地の草原（エメラルドグリーン #2ecc71） ── */
        if (h < 55) {
            out.copy(C_GRASS_LOW);
            out.r += microDetail * 0.3;
            out.g += detailVal * 0.05 + microDetail * 0.4;
            out.b += microDetail * 0.2;
            if (isSteep) out.lerpColors(out, brownRock, rockBlend * 0.85);
            return;
        }

        /* ── 中腹のみずみずしい緑（#2ecc71 → #27ae60） ── */
        if (h < 120) {
            const t = (h - 55) / 65;
            const midGreen = _tmpA.copy(C_GRASS_LOW).lerp(C_GRASS_MID, t);
            midGreen.g += detailVal * 0.04 + microDetail * 0.3;
            if (isSteep) {
                out.lerpColors(midGreen, brownRock, rockBlend * 0.9);
            } else {
                out.copy(midGreen);
            }
            return;
        }

        /* ── 高地〜山頂の南国深緑（#27ae60 → #1e824c → #196f3d） ──
         * 雪は一切なく、南国の豊かな大自然が生い茂る山頂
         */
        if (h < 220) {
            const t = (h - 120) / 100;
            const deepGreen = _tmpA.copy(C_GRASS_MID).lerp(C_GRASS_HIGH, t);
            deepGreen.g += detailVal * 0.03 + microDetail * 0.25;
            if (isSteep) {
                out.lerpColors(deepGreen, brownRock, rockBlend * 0.92);
            } else {
                out.copy(deepGreen);
            }
            return;
        }

        /* ── 最高峰の緑（豊かなジャングルピーク） ── */
        const t = Math.min(1.0, (h - 220) / 100);
        const peakGreen = _tmpA.copy(C_GRASS_HIGH).lerp(C_GRASS_PEAK, t);
        peakGreen.g += detailVal * 0.03 + microDetail * 0.2;

        if (slope > 0.25) {
            const steepRock = Math.min(1.0, (slope - 0.25) / 0.30);
            out.lerpColors(peakGreen, brownRock, steepRock * 0.95);
        } else {
            out.copy(peakGreen);
        }
    }
}
