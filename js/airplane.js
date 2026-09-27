/**
 * airplane.js — 飛行機モデル＋飛行物理
 *
 * プロシージャルなプロペラ機モデルを構築し、
 * Quaternionベースの滑らかな飛行物理を提供する。
 * 機体は Three.js 標準の −Z 方向（前方）を向く。
 */
import * as THREE from 'three';

const BASE_SPEED = 120;
const MIN_SPEED  = 55;
const MAX_SPEED  = 250;
const PITCH_RATE = 1.6;     // rad/s
const ROLL_RATE  = 2.2;
const YAW_RATE   = 0.9;
const BANK_YAW   = 0.5;     // バンク→ヨー変換係数
const CEIL       = 600;
const MIN_ALT    = 4;

/* ── 一時変数（GC 回避） ── */
const _q   = new THREE.Quaternion();
const _v   = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _rgt = new THREE.Vector3();
const _up  = new THREE.Vector3();
const _lZ  = new THREE.Vector3();

export class Airplane {
    constructor() {
        this.group    = new THREE.Group();
        this.speed    = BASE_SPEED;
        this.propeller = null;
        this.shadow    = null;
        this._build();
    }

    /* ═══════════════════ モデル構築 ═══════════════════ */
    _build() {
        const M = (color, roughness = 0.45, metalness = 0.1) =>
            new THREE.MeshStandardMaterial({ color, roughness, metalness });

        // ── 胴体（Z軸方向）
        const bodyGeo = new THREE.CylinderGeometry(1.0, 1.0, 7, 12);
        bodyGeo.rotateX(Math.PI / 2);   // Y軸→Z軸
        const body = new THREE.Mesh(bodyGeo, M(0xd42b38, 0.4, 0.15));
        this.group.add(body);

        // ── コクピット
        const cockGeo = new THREE.SphereGeometry(0.9, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5);
        const cockMat = new THREE.MeshStandardMaterial({
            color: 0x88ddf8, transparent: true, opacity: 0.55,
            roughness: 0.1, metalness: 0.3,
        });
        const cockpit = new THREE.Mesh(cockGeo, cockMat);
        cockpit.scale.set(0.85, 0.7, 1.3);
        cockpit.position.set(0, 0.75, -0.3);
        this.group.add(cockpit);

        // ── ノーズコーン
        const noseGeo = new THREE.ConeGeometry(1.0, 2, 8);
        noseGeo.rotateX(-Math.PI / 2);  // 先端→−Z
        const nose = new THREE.Mesh(noseGeo, M(0xfca311));
        nose.position.z = -4.5;
        this.group.add(nose);

        // ── 主翼
        const wing = new THREE.Mesh(
            new THREE.BoxGeometry(14, 0.18, 1.8), M(0xf1faee)
        );
        wing.position.set(0, -0.15, 0);
        this.group.add(wing);

        // ── 水平尾翼
        const tailH = new THREE.Mesh(
            new THREE.BoxGeometry(5, 0.12, 0.9), M(0xf1faee)
        );
        tailH.position.set(0, 0.15, 3.2);
        this.group.add(tailH);

        // ── 垂直尾翼
        const tailV = new THREE.Mesh(
            new THREE.BoxGeometry(0.12, 2.6, 0.9), M(0x457b9d)
        );
        tailV.position.set(0, 1.4, 3.2);
        this.group.add(tailV);

        // ── プロペラ
        this.propeller = new THREE.Group();
        this.propeller.position.z = -5.5;
        const bladeM = M(0x333333);
        for (let i = 0; i < 2; i++) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.28, 0.12), bladeM);
            b.rotation.z = (i * Math.PI) / 2;
            this.propeller.add(b);
        }
        // ハブ
        this.propeller.add(new THREE.Mesh(new THREE.SphereGeometry(0.28, 6, 6), bladeM));
        this.group.add(this.propeller);

        // ── ランディングギア
        const strutM = M(0x555555);
        const wheelM = M(0x222222);
        for (const zOff of [-1.8, 1.8]) {
            const strut = new THREE.Mesh(
                new THREE.CylinderGeometry(0.07, 0.07, 1.3, 4), strutM
            );
            strut.position.set(0, -1.35, zOff > 0 ? 0.3 : 0.3);
            strut.position.z = zOff > 0 ? 0.3 : 0.3;
            strut.position.x = zOff;
            this.group.add(strut);

            const wGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 8);
            wGeo.rotateZ(Math.PI / 2);
            const wheel = new THREE.Mesh(wGeo, wheelM);
            wheel.position.set(zOff, -1.95, 0.3);
            this.group.add(wheel);
        }

        // ── 地面の影（シンプルな円形）
        const shadowGeo = new THREE.CircleGeometry(3.5, 16);
        shadowGeo.rotateX(-Math.PI / 2);
        this.shadow = new THREE.Mesh(shadowGeo, new THREE.MeshBasicMaterial({
            color: 0x000000, transparent: true, opacity: 0.18, depthWrite: false,
        }));
    }

    /* ═══════════════════ シーンに追加 ═══════════════════ */
    addToScene(scene, startPos) {
        this.group.position.copy(startPos);
        this.group.rotation.y = Math.PI * 0.75;   // 北西（火山方面）を向く
        scene.add(this.group);
        scene.add(this.shadow);
    }

    /* ═══════════════════ 毎フレーム更新 ═══════════════════ */
    update(dt, input, terrain) {
        /* ── プロペラ回転 ── */
        this.propeller.rotation.z += dt * (15 + this.speed * 0.08);

        /* ── 速度制御 ── */
        if (input.boost)      this.speed = Math.min(this.speed + 65 * dt, MAX_SPEED);
        else if (input.brake) this.speed = Math.max(this.speed - 65 * dt, MIN_SPEED);
        else                  this.speed += (BASE_SPEED - this.speed) * dt * 0.8;

        /* ── ローカル軸（ワールド空間） ── */
        _rgt.set(1, 0, 0).applyQuaternion(this.group.quaternion);   // 右
        _up.set(0, 1, 0).applyQuaternion(this.group.quaternion);    // 上
        _lZ.set(0, 0, 1).applyQuaternion(this.group.quaternion);    // 後方（+Z）

        /* ── 操作入力 ── */
        const pi = ((input.down ? 1 : 0) - (input.up   ? 1 : 0)) * PITCH_RATE * dt;
        const ri = ((input.left ? 1 : 0) - (input.right ? 1 : 0)) * ROLL_RATE  * dt;
        const yi = ((input.yawLeft ? 1 : 0) - (input.yawRight ? 1 : 0)) * YAW_RATE * dt;

        /* ── ピッチ・ロール・ヨー回転 ── */
        if (pi) { _q.setFromAxisAngle(_rgt, pi); this.group.quaternion.premultiply(_q); }
        if (ri) { _q.setFromAxisAngle(_lZ,  ri); this.group.quaternion.premultiply(_q); }
        if (yi) { _q.setFromAxisAngle(_up,  yi); this.group.quaternion.premultiply(_q); }

        /* ── バンク旋回（ロール→自動ヨー） ── */
        _rgt.set(1, 0, 0).applyQuaternion(this.group.quaternion);
        const bank = _rgt.y;
        if (Math.abs(bank) > 0.01) {
            _up.set(0, 1, 0).applyQuaternion(this.group.quaternion);
            _q.setFromAxisAngle(_up, bank * BANK_YAW * dt);
            this.group.quaternion.premultiply(_q);
        }

        /* ── オートレベル（入力なし時にゆっくり水平へ） ── */
        if (!input.left && !input.right) {
            _rgt.set(1, 0, 0).applyQuaternion(this.group.quaternion);
            if (Math.abs(_rgt.y) > 0.02) {
                _fwd.set(0, 0, -1).applyQuaternion(this.group.quaternion);
                _q.setFromAxisAngle(_fwd, -_rgt.y * 0.9 * dt);
                this.group.quaternion.premultiply(_q);
            }
        }
        if (!input.up && !input.down) {
            _fwd.set(0, 0, -1).applyQuaternion(this.group.quaternion);
            if (Math.abs(_fwd.y) > 0.04) {
                _rgt.set(1, 0, 0).applyQuaternion(this.group.quaternion);
                _q.setFromAxisAngle(_rgt, _fwd.y * 0.35 * dt);
                this.group.quaternion.premultiply(_q);
            }
        }

        this.group.quaternion.normalize();

        /* ── 前進移動 ── */
        _fwd.set(0, 0, -1).applyQuaternion(this.group.quaternion);
        this.group.position.addScaledVector(_fwd, this.speed * dt);

        /* ── 地形衝突回避 ── */
        if (terrain) {
            const th  = terrain.getHeightAt(this.group.position.x, this.group.position.z);
            const min = Math.max(th + MIN_ALT, MIN_ALT);
            if (this.group.position.y < min) this.group.position.y = min;
        }

        /* ── 天井 ── */
        if (this.group.position.y > CEIL) this.group.position.y = CEIL;

        /* ── 境界ラップ ── */
        const B = 1400;
        if (this.group.position.x >  B) this.group.position.x = -B + 80;
        if (this.group.position.x < -B) this.group.position.x =  B - 80;
        if (this.group.position.z >  B) this.group.position.z = -B + 80;
        if (this.group.position.z < -B) this.group.position.z =  B - 80;

        /* ── 影の位置更新 ── */
        if (this.shadow && terrain) {
            this.shadow.position.set(
                this.group.position.x,
                terrain.getHeightAt(this.group.position.x, this.group.position.z) + 0.5,
                this.group.position.z,
            );
            // 高度に応じて影のサイズと透明度を変化
            const altAboveGround = this.group.position.y - this.shadow.position.y;
            const s = 1 + altAboveGround * 0.005;
            this.shadow.scale.setScalar(s);
            this.shadow.material.opacity = Math.max(0.04, 0.2 - altAboveGround * 0.0006);
        }
    }

    reset(startPos = new THREE.Vector3(220, 160, 250)) {
        this.group.position.copy(startPos);
        this.group.rotation.set(0, Math.PI * 0.75, 0);
        this.group.quaternion.setFromEuler(this.group.rotation);
        this.speed = BASE_SPEED;
        if (this.propeller) {
            this.propeller.rotation.z = 0;
        }
    }

    get position()   { return this.group.position; }
    get quaternion()  { return this.group.quaternion; }
}
