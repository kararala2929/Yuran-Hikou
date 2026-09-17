/**
 * water.js — アニメーション海面シェーダー
 *
 * 複数のsin波を合成した頂点変位と、
 * きらめき・泡のフラグメントシェーダーで海を表現する。
 */
import * as THREE from 'three';

const WATER_SIZE = 6000;
const WATER_SEGS = 180;

const VERT = /* glsl */ `
    uniform float uTime;
    varying vec2  vUv;
    varying float vWave;
    varying vec3  vWorld;

    void main() {
        vUv = uv;
        vec3 p = position;

        float w  = sin(p.x * 0.012 + uTime * 0.75) * 3.5;
              w += sin(p.z * 0.018 + uTime * 1.05)  * 2.8;
              w += cos((p.x + p.z) * 0.008 + uTime * 0.55) * 4.5;
              w += sin(p.x * 0.035 - p.z * 0.025 + uTime * 1.6) * 1.2;

        vWave  = w;
        p.y   += w;

        vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
    }
`;

const FRAG = /* glsl */ `
    uniform float uTime;
    uniform vec3  uDeep;
    uniform vec3  uMid;
    uniform vec3  uShallow;
    varying vec2  vUv;
    varying float vWave;
    varying vec3  vWorld;

    void main() {
        /* 深さに応じたグラデーション */
        float t = smoothstep(-7.0, 7.0, vWave);
        vec3 col = mix(uDeep, uMid, t * 0.6);
        col = mix(col, uShallow, t * t * 0.5);

        /* きらめき */
        float sp = sin(vUv.x * 260.0 + uTime * 2.8)
                  * sin(vUv.y * 260.0 + uTime * 2.2);
        col += smoothstep(0.92, 1.0, sp) * 0.35;

        /* 波頭の泡 */
        float foam = smoothstep(5.0, 8.5, vWave);
        col = mix(col, vec3(0.82, 0.93, 0.96), foam * 0.5);

        gl_FragColor = vec4(col, 0.80);
    }
`;

export class Water {
    constructor() {
        const geo = new THREE.PlaneGeometry(WATER_SIZE, WATER_SIZE, WATER_SEGS, WATER_SEGS);
        geo.rotateX(-Math.PI / 2);

        this.mat = new THREE.ShaderMaterial({
            uniforms: {
                uTime:    { value: 0 },
                uDeep:    { value: new THREE.Color(0x003d66) },
                uMid:     { value: new THREE.Color(0x0077aa) },
                uShallow: { value: new THREE.Color(0x40c4e8) },
            },
            vertexShader:   VERT,
            fragmentShader: FRAG,
            transparent: true,
            side: THREE.DoubleSide,
            depthWrite: false,
        });

        this.mesh = new THREE.Mesh(geo, this.mat);
        this.mesh.position.y = -0.5;
    }

    addToScene(scene) {
        scene.add(this.mesh);
    }

    update(elapsed) {
        this.mat.uniforms.uTime.value = elapsed;
    }
}
