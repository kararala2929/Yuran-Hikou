/**
 * island.js — 島の構造物（町・木・灯台・風車）
 *
 * Terrainの高さデータを使い、地形に合わせて
 * プロシージャルに建物やヤシの木を配置する。
 */
import * as THREE from 'three';
import { createNoise2D } from 'simplex-noise';

const ROOF_COLORS = [0xe63946, 0xf4a261, 0x2a9d8f, 0x264653, 0xe9c46a, 0x5e60ce];
const noise = createNoise2D();

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

        for (let i = 0; i < 70; i++) {
            const x = cx + (Math.random() - 0.5) * 350;
            const z = cz + (Math.random() - 0.5) * 280;
            const h = this.terrain.getHeightAt(x, z);
            if (h < 4 || h > 38) continue;

            const w  = 3 + Math.random() * 5;
            const d  = 3 + Math.random() * 5;
            const bh = 4 + Math.random() * 8;

            // 壁
            const wall = new THREE.Mesh(
                new THREE.BoxGeometry(w, bh, d),
                new THREE.MeshLambertMaterial({ color: 0xf1faee }),
            );
            wall.position.set(x, h + bh / 2, z);
            scene.add(wall);

            // 屋根
            const roofR = Math.max(w, d) * 0.75;
            const roof  = new THREE.Mesh(
                new THREE.ConeGeometry(roofR, 2.5, 4),
                new THREE.MeshLambertMaterial({
                    color: ROOF_COLORS[Math.floor(Math.random() * ROOF_COLORS.length)],
                }),
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
                new THREE.MeshLambertMaterial({ color: 0xf5f0e8 }),
            );
            steeple.position.set(chx, chH + 9, chz);
            scene.add(steeple);
            const spire = new THREE.Mesh(
                new THREE.ConeGeometry(2, 6, 4),
                new THREE.MeshLambertMaterial({ color: 0x6d6875 }),
            );
            spire.rotation.y = Math.PI / 4;
            spire.position.set(chx, chH + 21, chz);
            scene.add(spire);
        }
    }

    /* ════════════════ 🌴 ヤシの木 ════════════════ */
    _palms(scene) {
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x8B6914 });
        const leafMat  = new THREE.MeshLambertMaterial({ color: 0x2d8a4e });

        for (let i = 0; i < 180; i++) {
            const a = Math.random() * Math.PI * 2;
            const r = 420 + Math.random() * 380;
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;
            const h = this.terrain.getHeightAt(x, z);
            if (h < 1 || h > 22) continue;

            const tH = 5 + Math.random() * 7;

            // 幹
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.18, 0.38, tH, 5), trunkMat,
            );
            trunk.position.set(x, h + tH / 2, z);
            trunk.rotation.x = (Math.random() - 0.5) * 0.18;
            trunk.rotation.z = (Math.random() - 0.5) * 0.18;
            scene.add(trunk);

            // 葉（5枚の扁平球）
            for (let j = 0; j < 5; j++) {
                const fa = (j / 5) * Math.PI * 2 + Math.random() * 0.4;
                const leaf = new THREE.Mesh(
                    new THREE.SphereGeometry(2.2 + Math.random(), 5, 4), leafMat,
                );
                leaf.position.set(
                    x + Math.cos(fa) * 1.6,
                    h + tH + 0.5,
                    z + Math.sin(fa) * 1.6,
                );
                leaf.scale.set(1, 0.35, 1.6);
                scene.add(leaf);
            }
        }
    }

    /* ════════════════ 🌲 針葉樹の森 ════════════════ */
    _forest(scene) {
        const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5C4033 });

        for (let i = 0; i < 250; i++) {
            const x = (Math.random() - 0.5) * 1300;
            const z = (Math.random() - 0.5) * 1300;
            const h = this.terrain.getHeightAt(x, z);
            if (h < 18 || h > 110) continue;
            // ノイズで密度を変える
            if (noise(x * 0.008, z * 0.008) < -0.1) continue;

            const tH = 4 + Math.random() * 5;
            const trunk = new THREE.Mesh(
                new THREE.CylinderGeometry(0.25, 0.4, tH, 5), trunkMat,
            );
            trunk.position.set(x, h + tH / 2, z);
            scene.add(trunk);

            const gv   = 0.18 + Math.random() * 0.25;
            const canopy = new THREE.Mesh(
                new THREE.ConeGeometry(2.5 + Math.random() * 1.8, tH * 1.2, 6),
                new THREE.MeshLambertMaterial({ color: new THREE.Color(0.08, gv + 0.2, 0.04) }),
            );
            canopy.position.set(x, h + tH + tH * 0.35, z);
            scene.add(canopy);
        }
    }

    /* ════════════════ 🏗️ 灯台 ════════════════ */
    _lighthouse(scene) {
        const x = 620, z = -30;
        const h = this.terrain.getHeightAt(x, z);
        if (h < 0) return;

        // 塔
        scene.add(this._cyl(x, h, z, 2.8, 2, 22, 0xfafafa));
        // 赤帯
        scene.add(this._cyl(x, h + 14, z, 2.6, 2.3, 4, 0xe63946));
        // ライトハウス
        const light = this._cyl(x, h + 23, z, 2.5, 2.5, 3, 0xfff4e0);
        light.material.emissive = new THREE.Color(0xffd700);
        light.material.emissiveIntensity = 0.6;
        scene.add(light);
        // ドーム
        const dome = new THREE.Mesh(
            new THREE.SphereGeometry(2.5, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.5),
            new THREE.MeshLambertMaterial({ color: 0x444444 }),
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
        scene.add(this._cyl(x, h, z, 1.4, 2.2, 14, 0xf5f0e0));

        // ブレード
        const blades = new THREE.Group();
        blades.position.set(x, h + 15, z - 1.8);
        const bMat = new THREE.MeshLambertMaterial({ color: 0xf8f8f8 });
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
            new THREE.SphereGeometry(0.5, 6, 6),
            new THREE.MeshLambertMaterial({ color: 0x888888 }),
        ));
        scene.add(blades);
        this.animated.push({ type: 'windmill', obj: blades });
    }

    /* ════════════════ ⚓ 桟橋 ════════════════ */
    _pier(scene) {
        const px = 360, pz = 500;
        const woodMat = new THREE.MeshLambertMaterial({ color: 0x8B6E4E });

        // メインデッキ
        const deck = new THREE.Mesh(new THREE.BoxGeometry(6, 0.6, 35), woodMat);
        deck.position.set(px, 2, pz);
        scene.add(deck);

        // 支柱
        for (let i = 0; i < 6; i++) {
            const pil = new THREE.Mesh(
                new THREE.CylinderGeometry(0.25, 0.25, 4, 5), woodMat,
            );
            pil.position.set(
                px + (i % 2 === 0 ? -2.2 : 2.2),
                0.5,
                pz - 14 + i * 6,
            );
            scene.add(pil);
        }
    }

    /* ── ヘルパー: シリンダー配置 ── */
    _cyl(x, baseY, z, rTop, rBot, h, color) {
        const m = new THREE.Mesh(
            new THREE.CylinderGeometry(rTop, rBot, h, 8),
            new THREE.MeshLambertMaterial({ color }),
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
