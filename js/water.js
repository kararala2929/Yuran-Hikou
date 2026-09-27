/**
 * water.js — リアル海面シェーダー
 *
 * 法線マップ風のプロシージャル波、太陽のスペキュラ反射、
 * フレネル効果、深度グラデーション、ソフトフォームを表現する。
 */
import * as THREE from 'three';

const WATER_SIZE = 6000;
const WATER_SEGS = 220;

const VERT = /* glsl */ `
    uniform float uTime;
    varying vec2  vUv;
    varying float vWave;
    varying vec3  vWorldPos;
    varying vec3  vWorldNormal;

    void main() {
        vUv = uv;
        vec3 p = position;

        /* ── 島の海岸減衰（Shore Damping） ──
         * 島の海岸付近(d < 850m)では波の上下動を穏やかに減衰させ、
         * y=0.8の砂浜メッシュを波が貫通してチラつく(Z-Fighting)のを完全に防止する
         */
        float dist = length(p.xz);
        float shoreDamp = smoothstep(650.0, 1100.0, dist);
        float waveAmp = mix(0.15, 1.0, shoreDamp);

        /* ── 複数波の合成（頂点変位） ── */
        float w  = sin(p.x * 0.012 + uTime * 0.75) * 1.5;
              w += sin(p.z * 0.018 + uTime * 1.05) * 1.2;
              w += cos((p.x + p.z) * 0.008 + uTime * 0.55) * 1.8;
              w += sin(p.x * 0.035 - p.z * 0.025 + uTime * 1.6) * 0.6;
              w += sin(p.x * 0.06 + p.z * 0.04 + uTime * 2.3) * 0.3;
        w *= waveAmp;

        vWave = w;
        p.y  += w;

        /* ── 解析的法線（偏微分から計算） ── */
        float dWdx = (cos(p.x * 0.012 + uTime * 0.75) * 1.5 * 0.012
                    + cos(p.x * 0.035 - p.z * 0.025 + uTime * 1.6) * 0.6 * 0.035
                    - sin((p.x + p.z) * 0.008 + uTime * 0.55) * 1.8 * 0.008
                    + cos(p.x * 0.06 + p.z * 0.04 + uTime * 2.3) * 0.3 * 0.06) * waveAmp;
        float dWdz = (cos(p.z * 0.018 + uTime * 1.05) * 1.2 * 0.018
                    - sin((p.x + p.z) * 0.008 + uTime * 0.55) * 1.8 * 0.008
                    - cos(p.x * 0.035 - p.z * 0.025 + uTime * 1.6) * 0.6 * 0.025
                    + cos(p.x * 0.06 + p.z * 0.04 + uTime * 2.3) * 0.3 * 0.04) * waveAmp;

        vec3 norm = normalize(vec3(-dWdx, 1.0, -dWdz));
        vWorldNormal = normalize((modelMatrix * vec4(norm, 0.0)).xyz);
        vWorldPos = (modelMatrix * vec4(p, 1.0)).xyz;

        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
`;

const FRAG = /* glsl */ `
    uniform float uTime;
    uniform vec3  uSunDir;
    uniform vec3  uSunColor;
    uniform vec3  uDeep;
    uniform vec3  uMid;
    uniform vec3  uShallow;
    uniform vec3  uCameraPos;
    varying vec2  vUv;
    varying float vWave;
    varying vec3  vWorldPos;
    varying vec3  vWorldNormal;

    /* ── プロシージャル法線マップの擾乱（滑らかな波紋） ── */
    vec3 perturbNormal(vec3 N, vec3 worldPos, float time) {
        /* 大きなうねり */
        float nx = sin(worldPos.x * 0.04 + time * 0.7)
                 * cos(worldPos.z * 0.06 + time * 0.5) * 0.10;
        float nz = cos(worldPos.x * 0.05 - time * 0.45)
                 * sin(worldPos.z * 0.07 + time * 0.8) * 0.10;
        /* 中程度の波紋 */
        nx += sin(worldPos.x * 0.12 + worldPos.z * 0.08 + time * 1.2) * 0.05;
        nz += cos(worldPos.x * 0.09 - worldPos.z * 0.11 + time * 1.0) * 0.05;
        /* 細かいさざ波 */
        nx += sin(worldPos.x * 0.22 - time * 1.6) * cos(worldPos.z * 0.18 + time * 1.3) * 0.025;
        nz += cos(worldPos.x * 0.19 + time * 1.4) * sin(worldPos.z * 0.24 - time * 1.1) * 0.025;
        return normalize(N + vec3(nx, 0.0, nz));
    }

    void main() {
        vec3 N = perturbNormal(vWorldNormal, vWorldPos, uTime);
        vec3 V = normalize(uCameraPos - vWorldPos);
        vec3 L = normalize(uSunDir);
        vec3 H = normalize(L + V);

        /* ── 深度カラーグラデーション ── */
        float depth = smoothstep(-7.0, 7.0, vWave);
        vec3 baseColor = mix(uDeep, uMid, depth * 0.7);
        baseColor = mix(baseColor, uShallow, depth * depth * 0.5);

        /* ── フレネル効果 ── */
        float fresnel = pow(1.0 - max(dot(V, N), 0.0), 4.0);
        vec3 skyReflect = vec3(0.55, 0.72, 0.88);
        baseColor = mix(baseColor, skyReflect, fresnel * 0.55);

        /* ── 拡散反射 ── */
        float diff = max(dot(N, L), 0.0) * 0.25;
        baseColor += uSunColor * diff * 0.1;

        /* ── スペキュラ反射（太陽の鏡面反射） ── */
        float spec = pow(max(dot(N, H), 0.0), 350.0);
        vec3 specular = uSunColor * spec * 2.0;
        /* 低い入射角での広いスペキュラ（滑らかなグロー） */
        float specBroad = pow(max(dot(N, H), 0.0), 24.0);
        specular += uSunColor * specBroad * 0.08;

        /* ── 波頭の泡（控えめ） ── */
        float foam = smoothstep(6.0, 9.0, vWave);
        vec3 foamColor = vec3(0.85, 0.92, 0.96);

        /* ── 最終合成（sparkle除去 → 滑らかな反射のみ） ── */
        vec3 col = baseColor + specular;
        col = mix(col, foamColor, foam * 0.3);

        /* ── 軽いトーンマッピング ── */
        col = col / (col + 0.6) * 1.1;

        gl_FragColor = vec4(col, 0.90);
    }
`;

export class Water {
    constructor() {
        const geo = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGS, WATER_SEGS);
        geo.rotateX(-Math.PI / 2);

        /* 太陽方向 (skyのDirectionalLightと一致) */
        const sunDir = new THREE.Vector3(400, 700, 250).normalize();

        this.mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime:      { value: 0 },
                uSunDir:    { value: sunDir },
                uSunColor:  { value: new THREE.Color(1.0, 0.95, 0.85) },
                uDeep:      { value: new THREE.Color(0x003050) },
                uMid:       { value: new THREE.Color(0x005577) },
                uShallow:   { value: new THREE.Color(0x1a8fa8) },
                uCameraPos: { value: new THREE.Vector3() },
            },
            vertexShader:   VERT,
            fragmentShader: FRAG,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        this.mesh = new THREE.Mesh(geo, this.mat);
        this.mesh.position.y = 0.0;
    }

    addToScene(scene) {
        scene.add(this.mesh);
    }

    update(elapsed, camera) {
        this.mat.uniforms.uTime.value = elapsed;
        if (camera) {
            this.mat.uniforms.uCameraPos.value.copy(camera.position);
        }
    }
}
