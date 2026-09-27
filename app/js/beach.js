/**
 * beach.js — 独立した海岸線砂浜リングメッシュ
 *
 * 海と山の間に配置され、海面(y=0)より確実に高い位置(y=0.8〜)で
 * 外側に向かってなだらかに広がる独立した滑らかな砂浜リング。
 * 島の起伏によるカクカクした海との重なり・干渉を完全に防ぎ、
 * 温かみのあるサンドベージュ(#f6e58d)のリアルなトロピカルビーチを表現する。
 */
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

/* ── 設定定数 ── */
const ANGULAR_SEGS = 480;       // 周方向の分割数（極めて滑らかな海岸曲線）
const RADIAL_SEGS  = 24;        // 半径方向の分割数（滑らかな傾斜）
const BEACH_WIDTH  = 160;       // 砂浜の幅 (m)

/* ── 砂浜カラーパレット ── */
// 温かみのある明るいサンドベージュ (#f6e58d, #fef08a)
const C_FOAM_CREST  = new THREE.Color(0.96, 0.98, 1.00); // 波打ち際の白い泡
const C_SAND_SHORE  = new THREE.Color(0.84, 0.73, 0.46); // 水際の湿った砂
const C_SAND_MAIN   = new THREE.Color(0.965, 0.898, 0.553); // 温かいサンドベージュ (#f6e58d)
const C_SAND_BRIGHT = new THREE.Color(0.996, 0.941, 0.541); // 太陽光に照らされた明るい砂 (#fef08a)
const C_SAND_INLAND = new THREE.Color(0.90, 0.84, 0.56); // 内陸側の乾いた砂
const C_GRASS_EDGE  = new THREE.Color(0.18, 0.80, 0.44); // 鮮やかなエメラルドグリーン (#2ecc71 と完全一致)

export class Beach {
    constructor(terrain) {
        this.terrain = terrain;
        this.noise2D = createNoise2D();
        this.mesh = null;
    }

    /**
     * 角度 theta における海岸線の基準半径を計算
     * （低周波の滑らかなノイズで自然な入り江・岬のアーチを描く）
     */
    _getCoastRadius(theta) {
        const cosT = Math.cos(theta);
        const sinT = Math.sin(theta);

        // 基本半径 780m
        let r = 780;

        // なだらかな湾曲（入り江と岬のうねり）
        r += Math.sin(theta * 2.0 + 0.4) * 50.0;
        r += Math.cos(theta * 3.0 - 0.5) * 32.0;
        r += Math.sin(theta * 5.0) * 15.0;

        // 広域の緩やかなゆらぎ（Simplex noise）
        const n = this.noise2D(cosT * 0.85, sinT * 0.85);
        r += n * 40.0;

        return r;
    }

    /**
     * 砂浜リングメッシュの生成
     */
    generate(scene) {
        const vertexCount = (ANGULAR_SEGS + 1) * (RADIAL_SEGS + 1);
        const positions = new Float32Array(vertexCount * 3);
        const colors    = new Float32Array(vertexCount * 3);
        const uvs       = new Float32Array(vertexCount * 2);

        const indices = [];
        const tmpColor = new THREE.Color();

        let vIdx = 0;
        let uvIdx = 0;

        for (let i = 0; i <= ANGULAR_SEGS; i++) {
            const theta = (i / ANGULAR_SEGS) * Math.PI * 2;
            const cosT = Math.cos(theta);
            const sinT = Math.sin(theta);

            const baseR = this._getCoastRadius(theta);
            // 海側（外側）は baseR + 35m、陸側（内側）は baseR - 125m（島の内陸へ深く重なる）
            const rOuter = baseR + 35.0;
            const rInner = baseR - 125.0;

            for (let j = 0; j <= RADIAL_SEGS; j++) {
                // t: 0.0 (海側の一番外側のフチ) → 1.0 (島の内陸側)
                const t = j / RADIAL_SEGS;
                const r = rOuter + (rInner - rOuter) * t;

                const x = cosT * r;
                const z = sinT * r;

                /* ── 高度 Y の計算 ──
                 * 海側フチ (t=0) は y = 0.80（海面 y=0 より確実に高く、Z-Fighting完全解消）
                 * 内陸側 (t=1) は地形の高さ terrain.getHeightAt(x, z) と滑らかに合流
                 */
                const terrainH = this.terrain ? this.terrain.getHeightAt(x, z) : 6.0;

                // tに応じたなだらかな傾斜補間
                // t=0 で 0.8m、t=1 で 内陸地面高さ（最低でも4.5m）
                const targetInlandH = Math.max(4.5, terrainH);
                const blendCurve = Math.pow(t, 1.35);
                const finalY = THREE.MathUtils.lerp(0.80, targetInlandH, blendCurve);

                positions[vIdx * 3 + 0] = x;
                positions[vIdx * 3 + 1] = finalY;
                positions[vIdx * 3 + 2] = z;

                uvs[uvIdx * 2 + 0] = (i / ANGULAR_SEGS) * 12.0;
                uvs[uvIdx * 2 + 1] = t;

                /* ── リアルな砂浜カラーリング ──
                 * 温かみのある明るいサンドベージュ (#f6e58d / #fef08a)
                 */
                const sandGrain = this.noise2D(x * 0.06, z * 0.06) * 0.035;
                const microNoise = this.noise2D(x * 0.20, z * 0.20) * 0.015;

                if (t < 0.03) {
                    // 波打ち際の一番外縁: 白い波泡のフォームライン
                    const foamFactor = 1.0 - (t / 0.03);
                    tmpColor.copy(C_SAND_SHORE).lerp(C_FOAM_CREST, foamFactor * 0.85);
                } else if (t < 0.14) {
                    // 水際の湿った砂（しっとりとしたゴールデンサンド）
                    const wetBlend = (t - 0.03) / 0.11;
                    tmpColor.copy(C_SAND_SHORE).lerp(C_SAND_MAIN, wetBlend);
                } else if (t < 0.60) {
                    // 太陽光が降り注ぐメインの明るいサンドベージュ (#f6e58d 〜 #fef08a)
                    const midBlend = (t - 0.14) / 0.46;
                    tmpColor.copy(C_SAND_MAIN).lerp(C_SAND_BRIGHT, midBlend);
                } else if (t < 0.82) {
                    // 内陸寄りの乾いた砂
                    const dryBlend = (t - 0.60) / 0.22;
                    tmpColor.copy(C_SAND_BRIGHT).lerp(C_SAND_INLAND, dryBlend);
                } else {
                    // 島の草地（C_GRASS_LOW）へと完璧に溶け込むシームレスブレンド
                    const grassBlend = (t - 0.82) / 0.18;
                    tmpColor.copy(C_SAND_INLAND).lerp(C_GRASS_EDGE, grassBlend);
                }

                // 砂の自然なムラを追加（内陸の草地ブレンド領域以外）
                if (t < 0.85) {
                    tmpColor.r += sandGrain + microNoise;
                    tmpColor.g += (sandGrain + microNoise) * 0.9;
                    tmpColor.b += (sandGrain + microNoise) * 0.6;
                }

                colors[vIdx * 3 + 0] = tmpColor.r;
                colors[vIdx * 3 + 1] = tmpColor.g;
                colors[vIdx * 3 + 2] = tmpColor.b;

                vIdx++;
                uvIdx++;
            }
        }

        /* ── インデックス（グリッドトポロジー） ── */
        const stride = RADIAL_SEGS + 1;
        for (let i = 0; i < ANGULAR_SEGS; i++) {
            for (let j = 0; j < RADIAL_SEGS; j++) {
                const a = i * stride + j;
                const b = (i + 1) * stride + j;
                const c = i * stride + (j + 1);
                const d = (i + 1) * stride + (j + 1);

                indices.push(a, b, c);
                indices.push(b, d, c);
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('uv',       new THREE.BufferAttribute(uvs, 2));
        geometry.setIndex(indices);
        geometry.computeVertexNormals();

        /* ── 砂浜マテリアル（自然な粗さを持たせた温かいサンド） ── */
        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            roughness: 0.93,
            metalness: 0.01,
            flatShading: false,     // スムースシェーディング
            side: THREE.DoubleSide,
        });

        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.receiveShadow = true;
        scene.add(this.mesh);
    }
}
