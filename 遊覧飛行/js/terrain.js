/**
 * terrain.js — プロシージャル島地形生成
 * 
 * Simplex Noiseで地形ハイトマップを生成し、
 * 放射マスクで島形状、火山・山脈・丘陵を合成する。
 */
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

const SIZE     = 2000;
const HALF     = SIZE / 2;
const SEGMENTS = 256;
const SEG1     = SEGMENTS + 1;       // 257
const MAX_H    = 320;                // 最大高さ

/* ── 地形カラーパレット ── */
const C_SAND       = new THREE.Color(0.82, 0.76, 0.56);
const C_GRASS_LOW  = new THREE.Color(0.35, 0.68, 0.22);
const C_GRASS_HIGH = new THREE.Color(0.20, 0.48, 0.10);
const C_ROCK       = new THREE.Color(0.52, 0.47, 0.40);
const C_SNOW       = new THREE.Color(0.94, 0.93, 0.96);
const C_LAVA_DARK  = new THREE.Color(0.28, 0.13, 0.08);
const C_LAVA_MID   = new THREE.Color(0.45, 0.22, 0.12);
const _tmpA = new THREE.Color();
const _tmpB = new THREE.Color();

export class Terrain {
    constructor() {
        this.noise2D    = createNoise2D();
        this.heightData = new Float32Array(SEG1 * SEG1);
        this.mesh       = null;
    }

    /* ── 地形メッシュの生成 ── */
    generate(scene) {
        const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
        geo.rotateX(-Math.PI / 2);

        const pos    = geo.attributes.position;
        const colors = new Float32Array(pos.count * 3);
        const col    = new THREE.Color();

        for (let i = 0; i < pos.count; i++) {
            const wx = pos.getX(i);
            const wz = pos.getZ(i);
            const h  = this._height(wx, wz);

            pos.setY(i, h);

            // グリッドに格納
            const row = Math.floor(i / SEG1);
            const c   = i % SEG1;
            this.heightData[row * SEG1 + c] = h;

            // 色
            this._color(h, wx, wz, col);
            colors[i * 3]     = col.r;
            colors[i * 3 + 1] = col.g;
            colors[i * 3 + 2] = col.b;
        }

        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geo.computeVertexNormals();

        this.mesh = new THREE.Mesh(
            geo,
            new THREE.MeshLambertMaterial({ vertexColors: true })
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

        return h * MAX_H;
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

    /* ── 高さ → 頂点色 ── */
    _color(h, wx, wz, out) {
        const nx = wx / HALF;
        const nz = wz / HALF;

        // 火山域
        const vd = Math.sqrt((nx + 0.38) ** 2 + (nz + 0.33) ** 2);
        if (vd < 0.12 && h > 260) { out.copy(C_LAVA_DARK); return; }
        if (vd < 0.22 && h > 180) {
            const t = Math.min(1, (h - 180) / 100);
            out.copy(_tmpA.copy(C_LAVA_MID).lerp(C_LAVA_DARK, t));
            return;
        }

        if (h < 1.5) { out.copy(C_SAND); return; }
        if (h < 10) {
            out.copy(_tmpA.copy(C_SAND).lerp(C_GRASS_LOW, (h - 1.5) / 8.5));
            return;
        }
        if (h < 55) { out.copy(C_GRASS_LOW); return; }
        if (h < 110) {
            out.copy(_tmpA.copy(C_GRASS_HIGH).lerp(C_ROCK, (h - 55) / 55));
            return;
        }
        if (h < 220) {
            out.copy(_tmpA.copy(C_ROCK).lerp(C_SNOW, (h - 110) / 110));
            return;
        }
        out.copy(C_SNOW);
    }
}
