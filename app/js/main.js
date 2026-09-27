/**
 * main.js — ゲームエントリーポイント
 *
 * Three.js の初期化、各モジュールの組み立て、
 * 入力ハンドリング、ゲームループを管理する。
 */
import * as THREE from 'three';
import { Terrain }          from './terrain.js';
import { Beach }            from './beach.js';
import { Water }            from './water.js';
import { Sky }              from './sky.js';
import { IslandStructures } from './island.js';
import { Airplane }         from './airplane.js';
import { GameCamera }       from './camera.js';
import { HUD }              from './hud.js';

/* ════════════════════ グローバル状態 ════════════════════ */
const INITIAL_POSITION = new THREE.Vector3(220, 160, 250);

let renderer, scene, camera;
let terrain, beach, water, sky, island, airplane, gameCam, hud;
let started  = false;
let paused   = false;
let lastTime = 0;

const input = {
    up: false, down: false, left: false, right: false,
    yawLeft: false, yawRight: false,
    boost: false, brake: false,
};

/* ════════════════════ 初期化 ════════════════════ */
function init() {
    /* ── レンダラー ── */
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    document.getElementById('game-container').appendChild(renderer.domElement);

    /* ── シーン & カメラ ── */
    scene  = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
        62, window.innerWidth / window.innerHeight, 0.8, 5000,
    );

    /* ── 地形 ── */
    terrain = new Terrain();
    terrain.generate(scene);

    /* ── 砂浜（独立リング） ── */
    beach = new Beach(terrain);
    beach.generate(scene);

    /* ── 海 ── */
    water = new Water();
    water.addToScene(scene);

    /* ── 空 ── */
    sky = new Sky();
    sky.setup(scene, renderer);

    /* ── 島の構造物 ── */
    island = new IslandStructures(terrain);
    island.generate(scene);

    /* ── 飛行機 ── */
    airplane = new Airplane();
    airplane.addToScene(scene, INITIAL_POSITION);

    /* ── カメラコントローラ ── */
    gameCam = new GameCamera(camera);

    /* ── HUD ── */
    hud = new HUD();

    /* ── 入力 ── */
    setupInput();

    /* ── リサイズ ── */
    window.addEventListener('resize', onResize);

    /* ── ローディング→スタート画面 ── */
    document.getElementById('loading').style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';

    document.getElementById('start-btn').addEventListener('click', startGame);
    document.getElementById('pause-btn').addEventListener('click', pauseGame);
    document.getElementById('resume-btn').addEventListener('click', resumeGame);
    document.getElementById('home-btn').addEventListener('click', returnToHome);

    /* ── ゲームループ開始 ── */
    lastTime = performance.now();
    requestAnimationFrame(loop);
}

/* ════════════════════ ゲーム開始・停止・ホーム ════════════════════ */
function startGame() {
    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    started = true;
    paused = false;
    lastTime = performance.now();
}

function pauseGame() {
    if (!started || paused) return;
    paused = true;
    document.getElementById('pause-screen').style.display = 'flex';
    resetInput();
}

function resumeGame() {
    if (!started || !paused) return;
    paused = false;
    document.getElementById('pause-screen').style.display = 'none';
    lastTime = performance.now();
}

function togglePause() {
    if (!started) return;
    if (paused) resumeGame();
    else pauseGame();
}

function returnToHome() {
    paused = false;
    started = false;
    document.getElementById('pause-screen').style.display = 'none';
    document.getElementById('hud').style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';
    airplane.reset(INITIAL_POSITION);
    gameCam.reset();
    resetInput();
    lastTime = performance.now();
}

function resetInput() {
    for (const k in input) input[k] = false;
}

/* ════════════════════ 入力設定 ════════════════════ */
function setupInput() {
    const map = {
        KeyW: 'up',    ArrowUp:    'up',
        KeyS: 'down',  ArrowDown:  'down',
        KeyA: 'left',  ArrowLeft:  'left',
        KeyD: 'right', ArrowRight: 'right',
        KeyQ: 'yawLeft',  KeyE: 'yawRight',
        ShiftLeft: 'boost', ShiftRight: 'boost',
        ControlLeft: 'brake', ControlRight: 'brake',
    };

    window.addEventListener('keydown', (e) => {
        if (e.code === 'KeyP' || e.code === 'Escape') {
            togglePause();
            e.preventDefault();
            return;
        }

        if (paused) return;

        const a = map[e.code];
        if (a) { input[a] = true; e.preventDefault(); }
        if (e.code === 'KeyH') hud.toggleHelp();
    });

    window.addEventListener('keyup', (e) => {
        const a = map[e.code];
        if (a) { input[a] = false; e.preventDefault(); }
    });

    window.addEventListener('mousemove', (e) => {
        if (paused) return;
        const mx = (e.clientX / window.innerWidth  - 0.5) * 2;
        const my = (e.clientY / window.innerHeight - 0.5) * 2;
        gameCam.setMouse(mx, my);
    });

    // タブ切替時のキー残り防止
    window.addEventListener('blur', () => {
        resetInput();
    });
}

/* ════════════════════ リサイズ ════════════════════ */
function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ════════════════════ ゲームループ ════════════════════ */
const _fwd = new THREE.Vector3();

function loop(now) {
    requestAnimationFrame(loop);

    const dt      = Math.min((now - lastTime) / 1000, 0.1);
    const elapsed = now / 1000;
    lastTime = now;

    if (started) {
        if (!paused) {
            /* ── ゲームプレイ ── */
            airplane.update(dt, input, terrain);
            gameCam.update(dt, airplane);
            sky.update(dt);
            island.update(dt);
            water.update(elapsed, camera);

            /* ── HUD 更新 ── */
            _fwd.set(0, 0, -1).applyQuaternion(airplane.quaternion);
            let heading = Math.atan2(_fwd.x, -_fwd.z) * (180 / Math.PI);
            if (heading < 0) heading += 360;
            hud.update(airplane.speed, airplane.position.y, heading);
        }
    } else {
        /* ── 開始前: 島を俯瞰する回転カメラ ── */
        const t = elapsed * 0.12;
        camera.position.set(
            Math.cos(t) * 750,
            320,
            Math.sin(t) * 750,
        );
        camera.lookAt(0, 40, 0);
        water.update(elapsed, camera);
        sky.update(dt);
    }

    renderer.render(scene, camera);
}

/* ════════════════════ 起動 ════════════════════ */
init();
