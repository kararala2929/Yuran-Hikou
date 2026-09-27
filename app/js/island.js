/**
 * island.js — 島の構造物（町・木・灯台・風車）
 *
 * Terrainの高さデータを使い、地形に合わせて
 * プロシージャルに建物やリアルな樹木を配置する。
 */
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

const ROOF_COLORS = [0xb83028, 0xd4845a, 0x2a7d6f, 0x1e3a40, 0xc9a64a, 0x4a4dae];
const noise = createNoise2D();

/* ── 共有マテリアル（PBR風） ── */
function M_std(color, roughness = 0.8, metalness = 0.0) {
    return new THREE.MeshStandardMaterial({ color, roughness, metalness });
}

export class IslandStructures {
    constructor(terrain) {
        this.terrain = terrain;
        this.animated = [];     // { type, obj }
    }

    generate(scene) {
        this._town(scene);
        this._palms(scene);
        this._forest(scene);
        this._lighthouse(scene);
        this._windmill(scene);
        this._pier(scene);
    }

    /* ════════════════ 🏘️ リゾートタウン ════════════════ */
    _town(scene) {
        const cx = 250, cz = 220;

        const wallMats = [
            M_std(0xf0ece4, 0.9), M_std(0xe8e0d0, 0.85),
            M_std(0xfaf5eb, 0.9), M_std(0xddd5c5, 0.85),
        ];

        for (let i = 0; i < 70; i++) {
            const x = cx + (Math.random() - 0.5) * 350;
            const z = cz + (Math.random() - 0.5) * 280;
            const h = this.terrain.getHeightAt(x, z);
            if (h < 4 || h > 38) continue;

            const w  = 3 + Math.random() * 5;
            const d  = 3 + Math.random() * 5;
            const bh = 4 + Math.random() * 8;

            // 壁
            const wallMat = wallMats[Math.floor(Math.random() * wallMats.length)];
            const wall = new THREE.Mesh(
                new THREE.BoxGeometry(w, bh, d), wallMat,
            );
            wall.position.set(x, h + bh / 2, z);
            scene.add(wall);

            // 屋根（瓦風）
            const roofR = Math.max(w, d) * 0.75;
            const roofColor = ROOF_COLORS[Math.floor(Math.random() * ROOF_COLORS.length)];
            const roof  = new THREE.Mesh(
                new THREE.ConeGeometry(roofR, 2.5, 4),
                M_std(roofColor, 0.7),
            );
            roof.rotation.y = Math.PI / 4;
            roof.position.set(x, h + bh + 1.25, z);
            scene.add(roof);
        }

        // 教会（尖塔）
        const chx = cx + 30, chz = cz - 20;
        const chH = this.terrain.getHeightAt(chx, chz);
        if (chH > 3) {
            const steeple = new THREE.Mesh(
                new THREE.BoxGeometry(5, 18, 5),
                M_std(0xf0ebe0, 0.9),
            );
            steeple.position.set(chx, chH + 9, chz);
            scene.add(steeple);
            const spire = new THREE.Mesh(
                new THREE.ConeGeometry(2, 6, 4),
                M_std(0x5a5565, 0.5, 0.15),
            );
            spire.rotation.y = Math.PI / 4;
            spire.position.set(chx, chH + 21, chz);
            scene.add(spire);
        }
    }

    /* ════════════════ 🌴 ヤシの木（リアル版） ════════════════ */
    _palms(scene) {
        const trunkMat = M_std(0x6b5020, 0.95);
        const leafMats = [
            M_std(0x1a6632, 0.7),
            M_std(0x1f7a38, 0.7),
            M_std(0x268040, 0.7),
        ];

        for (let i = 0; i < 180; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 420 + Math.random() * 380;
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;
            const h = this.terrain.getHeightAt(x, z);
            if (h < 1 || h > 22) continue;

            const tH = 5 + Math.random() * 7;

            // 幹（微妙に湾曲した円筒）
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.15, 0.35, tH, 6), trunkMat,
            );
            trunk.position.set(x, h + tH / 2, z);
            trunk.rotation.x = (Math.random() - 0.5) * 0.2;
            trunk.rotation.z = (Math.random() - 0.5) * 0.2;
            scene.add(trunk);

            // 葉（扇状のリーフクラスター）
            const leafCount = 6 + Math.floor(Math.random() * 3);
            for (let j = 0; j < leafCount; j++) {
                const fa = (j / leafCount) * Math.PI * 2 + Math.random() * 0.3;
                const leafMat = leafMats[Math.floor(Math.random() * leafMats.length)];
                const leafLen = 2.5 + Math.random() * 1.5;

                // 葉を細長い楕円体で表現
                const leaf = new THREE.Mesh(
                    new THREE.SphereGeometry(leafLen, 6, 4), leafMat,
                );
                const dropAngle = 0.3 + Math.random() * 0.5;  // 垂れ下がり
                leaf.position.set(
                    x + Math.cos(fa) * 1.8,
                    h + tH + 0.3 - dropAngle * 0.8,
                    z + Math.sin(fa) * 1.8,
                );
                leaf.scale.set(0.4, 0.15, 1.4);
                leaf.rotation.y = fa;
                leaf.rotation.z = dropAngle;
                scene.add(leaf);
            }

            // ヤシの木の頭頂にタフト（小さな球）
            const tuft = new THREE.Mesh(
                new THREE.SphereGeometry(0.6, 6, 4),
                leafMats[0],
            );
            tuft.position.set(x, h + tH + 0.6, z);
            tuft.scale.set(1, 0.5, 1);
            scene.add(tuft);
        }
    }

    /* ════════════════ 🌲 針葉樹の森（リアル版） ════════════════ */
    _forest(scene) {
        const trunkMat = M_std(0x3d2a1a, 0.95);

        for (let i = 0; i < 250; i++) {
            const x = (Math.random() - 0.5) * 1300;
            const z = (Math.random() - 0.5) * 1300;
            const h = this.terrain.getHeightAt(x, z);
            if (h < 18 || h > 110) continue;
            // ノイズで密度を変える
            if (noise(x * 0.008, z * 0.008) < -0.1) continue;

            const tH = 4 + Math.random() * 5;

            // 幹
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.2, 0.38, tH, 6), trunkMat,
            );
            trunk.position.set(x, h + tH / 2, z);
            scene.add(trunk);

            /* ── 複数層のキャノピー（自然な樹形） ── */
            const layers = 3 + Math.floor(Math.random() * 2);
            const baseGreenVal = 0.15 + Math.random() * 0.2;

            for (let layer = 0; layer < layers; layer++) {
                const t = layer / layers;
                const layerR = (2.8 + Math.random() * 1.5) * (1 - t * 0.5);
                const layerH = (tH * 0.4) * (1 - t * 0.3);
                const layerY = h + tH * 0.5 + tH * t * 0.55;

                // 各レイヤーに明度変化
                const brightness = baseGreenVal + t * 0.08;
                const canopyColor = new THREE.Color(0.05, brightness + 0.2, 0.03);

                const canopy = new THREE.Mesh(
                    new THREE.ConeGeometry(layerR, layerH, 7),
                    new THREE.MeshStandardMaterial({
                        color: canopyColor,
                        roughness: 0.8,
                        metalness: 0.0,
                    }),
                );
                canopy.position.set(
                    x + (Math.random() - 0.5) * 0.3,
                    layerY,
                    z + (Math.random() - 0.5) * 0.3,
                );
                scene.add(canopy);
            }
        }
    }

    /* ════════════════ 🏗️ 灯台 ════════════════ */
    _lighthouse(scene) {
        const x = 620, z = -30;
        const h = this.terrain.getHeightAt(x, z);
        if (h < 0) return;

        // 塔
        scene.add(this._cyl(x, h, z, 2.8, 2, 22, 0xf5f2ed, 0.85));
        // 赤帯
        scene.add(this._cyl(x, h + 14, z, 2.6, 2.3, 4, 0xc42e33, 0.6));
        // ライトハウス
        const light = this._cyl(x, h + 23, z, 2.5, 2.5, 3, 0xfff4e0, 0.5);
        light.material.emissive = new THREE.Color(0xffd700);
        light.material.emissiveIntensity = 0.6;
        scene.add(light);
        // ドーム
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(2.5, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5),
            M_std(0x3a3a3a, 0.4, 0.3),
        );
        dome.position.set(x, h + 24.5, z);
        scene.add(dome);

        // 点灯
        const pl = new THREE.PointLight(0xfff4c0, 80, 200);
        pl.position.set(x, h + 24, z);
        scene.add(pl);
    }

    /* ════════════════ 🏟️ 風車 ════════════════ */
    _windmill(scene) {
        const x = -120, z = 320;
        const h = this.terrain.getHeightAt(x, z);
        if (h < 5) return;

        // 塔
        scene.add(this._cyl(x, h, z, 1.4, 2.2, 14, 0xf0ebe0, 0.85));

        // ブレード
        const blades = new THREE.Group();
        blades.position.set(x, h + 15, z - 1.8);
        const bMat = M_std(0xf0f0f0, 0.6, 0.05);
        for (let i = 0; i < 4; i++) {
            const arm = new THREE.Group();
            const blade = new THREE.Mesh(new THREE.BoxGeometry(0.8, 7, 0.15), bMat);
            blade.position.y = 3.8;
            arm.add(blade);
            arm.rotation.z = (i * Math.PI) / 2;
            blades.add(arm);
        }
        // ハブ
        blades.add(new THREE.Mesh(
            new THREE.SphereGeometry(0.5, 8, 8),
            M_std(0x666666, 0.5, 0.2),
        ));
        scene.add(blades);
        this.animated.push({ type: 'windmill', obj: blades });
    }

    /* ════════════════ ⚓ 桟橋 ════════════════ */
    _pier(scene) {
        const px = 360, pz = 500;
        const woodMat = M_std(0x7a5e3e, 0.9);

        // メインデッキ
        const deck = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 35), woodMat);
        deck.position.set(px, 2, pz);
        scene.add(deck);

        // 支柱
        for (let i = 0; i < 6; i++) {
            const pil = new THREE.Mesh(
                new THREE.CylinderGeometry(0.25, 0.25, 4, 6), woodMat,
            );
            pil.position.set(
                px + (i % 2 === 0 ? -2.2 : 2.2),
                0.5,
                pz - 14 + i * 6,
            );
            scene.add(pil);
        }
    }

    /* ── ヘルパー: シリンダー配置（PBR版） ── */
    _cyl(x, baseY, z, rTop, rBot, h, color, roughness = 0.8) {
        const m = new THREE.Mesh(
            new THREE.CylinderGeometry(rTop, rBot, h, 10),
            M_std(color, roughness),
        );
        m.position.set(x, baseY + h / 2, z);
        return m;
    }

    /* ── アニメーション更新 ── */
    update(dt) {
        for (const a of this.animated) {
            if (a.type === 'windmill') a.obj.rotation.z += dt * 0.6;
        }
    }
}
