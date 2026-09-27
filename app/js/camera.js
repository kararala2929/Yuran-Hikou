/**
 * camera.js — 三人称スムースフォローカメラ
 *
 * 飛行機の後方上方にオフセットを取り、
 * Lerpで滑らかに追従する。マウスで視点微調整が可能。
 */
import * as THREE from 'three';

const OFFSET_BEHIND = 22;
const OFFSET_UP     = 7;
const LOOK_AHEAD    = 18;
const POS_SMOOTH    = 4.5;
const LOOK_SMOOTH   = 6.0;

const _idealPos  = new THREE.Vector3();
const _idealLook = new THREE.Vector3();
const _off       = new THREE.Vector3();
const _rgt       = new THREE.Vector3();

export class GameCamera {
    constructor(cam) {
        this.cam        = cam;
        this.lookTarget = new THREE.Vector3();
        this.mouseX     = 0;
        this.mouseY     = 0;
        this._first     = true;
    }

    /** マウスオフセット更新（-1 〜 +1） */
    setMouse(x, y) {
        this.mouseX = x;
        this.mouseY = y;
    }

    /** カメラ追従状態をリセット */
    reset() {
        this.mouseX = 0;
        this.mouseY = 0;
        this._first = true;
    }

    /** 毎フレーム更新 */
    update(dt, airplane) {
        /* 後方上方オフセット（ローカル→ワールド） */
        _off.set(0, OFFSET_UP, OFFSET_BEHIND);
        _off.applyQuaternion(airplane.quaternion);
        _idealPos.copy(airplane.position).add(_off);

        /* マウスによる左右・上下の微調整 */
        _rgt.set(1, 0, 0).applyQuaternion(airplane.quaternion);
        _idealPos.addScaledVector(_rgt, this.mouseX * 12);
        _idealPos.y += this.mouseY * -5;

        /* 注視先（機体の前方） */
        _off.set(0, 1.5, -LOOK_AHEAD);
        _off.applyQuaternion(airplane.quaternion);
        _idealLook.copy(airplane.position).add(_off);

        if (this._first) {
            /* 初回は即座にスナップ */
            this.cam.position.copy(_idealPos);
            this.lookTarget.copy(_idealLook);
            this._first = false;
        } else {
            /* 指数減衰 lerp */
            const a = 1 - Math.exp(-POS_SMOOTH  * dt);
            const b = 1 - Math.exp(-LOOK_SMOOTH * dt);
            this.cam.position.lerp(_idealPos, a);
            this.lookTarget.lerp(_idealLook, b);
        }

        this.cam.lookAt(this.lookTarget);
    }
}
