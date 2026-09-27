/**
 * sky.js — リアル大気・雲・ライティング
 *
 * 大気散乱風グラデーション天球、地平線の霞みフォグ、
 * ボリュメトリック風雲、リアルなライティングセットアップ。
 */
import * as THREE from 'three';

/* ── 色定義（南国の夏空） ── */
const SKY_TOP     = 0x0a3d91;    // 濃い青空
const SKY_MID     = 0x4a90d9;    // 中間の青
const SKY_HORIZON = 0xc8dff0;    // 地平線（霞み）
const FOG_COLOR   = 0xc8dff0;
const SUN_COLOR   = 0xfffaed;    // 温かみのある夏の日差し（温白色）

export class Sky {
    constructor() {
        this.clouds = [];
    }

    setup(scene, renderer) {
        /* ── 天球ドーム（大気散乱風シェーダー） ── */
        const skyGeo = new THREE.SphereGeometry(2800, 48, 32);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                uTop:      { value: new THREE.Color(SKY_TOP) },
                uMid:      { value: new THREE.Color(SKY_MID) },
                uHorizon:  { value: new THREE.Color(SKY_HORIZON) },
                uSunDir:   { value: new THREE.Vector3(400, 700, 250).normalize() },
                uSunColor: { value: new THREE.Color(SUN_COLOR) },
            },
            vertexShader: /* glsl */ `
                varying vec3 vDir;
                varying vec3 vWorldPos;
                void main() {
                    vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
                    vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform vec3 uTop, uMid, uHorizon;
                uniform vec3 uSunDir, uSunColor;
                varying vec3 vDir;
                varying vec3 vWorldPos;

                void main() {
                    float h = max(vDir.y, 0.0);

                    /* ── 大気散乱風のグラデーション ── */
                    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.15, h));
                    col = mix(col, uTop, smoothstep(0.15, 0.55, h));

                    /* ── 地平線の霞み（大気遠近法） ── */
                    float haze = exp(-h * 6.0) * 0.35;
                    col = mix(col, uHorizon, haze);

                    /* ── 太陽の光芒 ── */
                    vec3 dir = normalize(vDir);
                    float sunDot = max(dot(dir, uSunDir), 0.0);

                    /* 太陽ディスク */
                    float sunDisc = pow(sunDot, 800.0) * 3.0;
                    col += uSunColor * sunDisc;

                    /* 太陽周囲のグロー */
                    float sunGlow = pow(sunDot, 8.0) * 0.25;
                    col += uSunColor * sunGlow;

                    /* 太陽周囲のハロー */
                    float sunHalo = pow(sunDot, 3.0) * 0.08;
                    col += vec3(1.0, 0.95, 0.8) * sunHalo;

                    /* ── 地平線近くの暖色 ── */
                    float horizonWarm = smoothstep(0.05, 0.0, h) * 0.15;
                    col += vec3(0.9, 0.7, 0.4) * horizonWarm;

                    gl_FragColor = vec4(col, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
        });
        scene.add(new THREE.Mesh(skyGeo, skyMat));

        /* ── ライティング（真夏の南国リゾート） ── */
        /* 太陽光（DirectionalLight）: 温かみのある温白色、光量をアップして眩しい日差しを表現 */
        const sun = new THREE.DirectionalLight(SUN_COLOR, 3.2);
        sun.position.set(400, 700, 250);
        sun.castShadow = false;
        scene.add(sun);

        /* 空からの環境光（上: 夏空ブルー / 下: 南国の緑の地面反射） */
        scene.add(new THREE.HemisphereLight(0x87ceeb, 0x4a7c35, 0.65));

        /* 明るく開放感のある温白色の環境光（AmbientLight） */
        scene.add(new THREE.AmbientLight(0xfff4e6, 0.65));

        /* 補助光（影の部分を暖かく柔らかに照らす） */
        const fill = new THREE.DirectionalLight(0xffecd0, 0.45);
        fill.position.set(-300, 200, -400);
        scene.add(fill);

        /* ── フォグ（大気遠近法） ── */
        scene.fog = new THREE.FogExp2(FOG_COLOR, 0.00042);
        renderer.setClearColor(FOG_COLOR);

        /* ── 雲 ── */
        this._buildClouds(scene);
    }

    /* ── ボリュメトリック風 雲クラスター生成 ── */
    _buildClouds(scene) {
        /* 雲のマテリアル（複数バリエーション） */
        const cloudColors = [
            new THREE.Color(0.95, 0.95, 0.97),
            new THREE.Color(0.90, 0.91, 0.94),
            new THREE.Color(0.85, 0.87, 0.92),
        ];

        for (let i = 0; i < 50; i++) {
            const grp    = new THREE.Group();
            const puffs  = 8 + Math.floor(Math.random() * 10);
            const baseColor = cloudColors[Math.floor(Math.random() * cloudColors.length)];

            /* ── 雲のパフ生成 ── */
            for (let j = 0; j < puffs; j++) {
                const r   = 18 + Math.random() * 35;
                const geo = new THREE.SphereGeometry(r, 10, 8);
                const variation = 0.95 + Math.random() * 0.05;
                const puffColor = baseColor.clone().multiplyScalar(variation);

                const mat = new THREE.MeshStandardMaterial({
                    color: puffColor,
                    roughness: 1.0,
                    metalness: 0.0,
                    transparent: true,
                    opacity: 0.7 + Math.random() * 0.15,
                });

                const m = new THREE.Mesh(geo, mat);
                m.position.set(
                    (Math.random() - 0.5) * 110,
                    (Math.random() - 0.5) * 16,
                    (Math.random() - 0.5) * 70,
                );
                m.scale.set(
                    0.8 + Math.random() * 0.5,
                    0.25 + Math.random() * 0.2,
                    1.2 + Math.random() * 0.6,
                );
                grp.add(m);
            }

            const a = Math.random() * Math.PI * 2;
            const d = 300 + Math.random() * 900;
            grp.position.set(
                Math.cos(a) * d,
                300 + Math.random() * 300,
                Math.sin(a) * d,
            );

            scene.add(grp);
            this.clouds.push(grp);
        }
    }

    /* ── 雲のドリフト ── */
    update(dt) {
        for (const c of this.clouds) {
            c.position.x += dt * 3;
            if (c.position.x > 1300) c.position.x = -1300;
        }
    }
}
