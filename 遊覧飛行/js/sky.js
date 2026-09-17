/**
 * sky.js — 空・雲・ライティング
 *
 * グラデーション天球ドーム、プロシージャル雲クラスター、
 * ディレクショナルライト・アンビエント・フォグを設定する。
 */
import * as THREE from 'three';

const FOG_COLOR = 0xc4ddf0;

export class Sky {
    constructor() {
        this.clouds = [];
    }

    setup(scene, renderer) {
        /* ── 天球ドーム ── */
        const skyGeo = new THREE.SphereGeometry(2800, 32, 24);
        const skyMat = new THREE.ShaderMaterial({
            uniforms: {
                uTop:     { value: new THREE.Color(0x1565c0) },
                uMid:     { value: new THREE.Color(0x64b5f6) },
                uHorizon: { value: new THREE.Color(0xc4ddf0) },
            },
            vertexShader: /* glsl */ `
                varying vec3 vDir;
                void main() {
                    vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: /* glsl */ `
                uniform vec3 uTop, uMid, uHorizon;
                varying vec3 vDir;
                void main() {
                    float h = max(vDir.y, 0.0);
                    vec3 col = mix(uHorizon, uMid, smoothstep(0.0, 0.25, h));
                    col = mix(col, uTop, smoothstep(0.25, 0.7, h));
                    gl_FragColor = vec4(col, 1.0);
                }
            `,
            side: THREE.BackSide,
            depthWrite: false,
        });
        scene.add(new THREE.Mesh(skyGeo, skyMat));

        /* ── ライティング ── */
        const sun = new THREE.DirectionalLight(0xfff5e0, 2.0);
        sun.position.set(400, 700, 250);
        scene.add(sun);

        scene.add(new THREE.AmbientLight(0x8cb8d8, 0.55));
        scene.add(new THREE.HemisphereLight(0x87ceeb, 0x3a7d44, 0.35));

        /* ── フォグ ── */
        scene.fog = new THREE.FogExp2(FOG_COLOR, 0.00032);
        renderer.setClearColor(FOG_COLOR);

        /* ── 雲 ── */
        this._buildClouds(scene);
    }

    /* ── 雲クラスター生成 ── */
    _buildClouds(scene) {
        const mat = new THREE.MeshLambertMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.82,
        });

        for (let i = 0; i < 40; i++) {
            const grp    = new THREE.Group();
            const puffs  = 5 + Math.floor(Math.random() * 7);

            for (let j = 0; j < puffs; j++) {
                const r   = 14 + Math.random() * 28;
                const geo = new THREE.SphereGeometry(r, 7, 5);
                const m   = new THREE.Mesh(geo, mat);
                m.position.set(
                    (Math.random() - 0.5) * 90,
                    (Math.random() - 0.5) * 12,
                    (Math.random() - 0.5) * 55,
                );
                m.scale.y = 0.35 + Math.random() * 0.25;
                grp.add(m);
            }

            const a = Math.random() * Math.PI * 2;
            const d = 250 + Math.random() * 850;
            grp.position.set(
                Math.cos(a) * d,
                280 + Math.random() * 280,
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
