import {
  EventDispatcher,
  MOUSE,
  Quaternion,
  Spherical,
  TOUCH,
  Vector2,
  Vector3,
} from "three";

const _changeEvent = { type: "change" };
const _startEvent = { type: "start" };
const _endEvent = { type: "end" };

export class ExtendOrbitControls extends EventDispatcher {
  constructor(object, domElement) {
    super();
    // object - 需要被控制的对象。
    this.object = object;
    // domElement - 与对象控制相关的DOM元素。
    this.domElement = domElement;
    this.domElement.style.touchAction = "none"; // 禁用触摸滚动

    // 设置为false以禁用此控制
    this.enabled = true;

    // "target"设置了焦点的位置，对象围绕该焦点轨道运动
    this.target = new Vector3();

    // 设置透视相机的最大最小缩放距离
    this.minDistance = 0;
    this.maxDistance = Infinity;

    // 设置正交相机的最大最小缩放距离（仅适用于正交相机）
    this.minZoom = 0;
    this.maxZoom = Infinity;

    // 设置垂直轨道的最大最小角度（范围为0到Math.PI弧度）
    this.minPolarAngle = 0; // 弧度
    this.maxPolarAngle = Math.PI; // 弧度

    // 设置水平轨道的最大最小角度（需保证在-2PI到2PI的子区间内）
    this.minAzimuthAngle = -Infinity; // 弧度
    this.maxAzimuthAngle = Infinity; // 弧度

    // 启用阻尼（惯性），需在动画循环中调用controls.update()
    this.enableDamping = false;
    this.dampingFactor = 0.05;

    // 启用缩放控制
    this.enableZoom = true;
    this.zoomSpeed = 1.0;

    // 启用旋转控制
    this.enableRotate = true;
    this.rotateSpeed = 1.0;

    // 启用平移控制
    this.enablePan = true;
    this.panSpeed = 1.0;
    this.screenSpacePanning = true; // 如果为false，则按照与世界空间方向camera.up正交的方式平移
    this.keyPanSpeed = 7.0; // 每次按压箭头键移动的像素数

    // 自动绕目标旋转，需在动画循环中调用controls.update()
    this.autoRotate = false;
    this.autoRotateSpeed = 2.0; // 当fps为60时，每轨道30秒

    // 定义四个方向键
    this.keys = {
      LEFT: "ArrowLeft",
      UP: "ArrowUp",
      RIGHT: "ArrowRight",
      BOTTOM: "ArrowDown",
    };

    // 鼠标按钮控制映射
    this.mouseButtons = {
      LEFT: MOUSE.ROTATE,
      MIDDLE: MOUSE.DOLLY,
      RIGHT: MOUSE.PAN,
    };

    // 触摸控制映射
    this.touches = { ONE: TOUCH.ROTATE, TWO: TOUCH.DOLLY_PAN };

    // 用于重置状态
    this.target0 = this.target.clone();
    this.position0 = this.object.position.clone();
    this.zoom0 = this.object.zoom;

    // 用于键盘事件的target DOM元素
    this._domElementKeyEvents = null;

    //
    // 公共方法
    //

    /**
     * 获取极角（向上的角度）
     * @returns {Number} 返回当前的极角值
     */
    this.getPolarAngle = function () {
      return spherical.phi;
    };

    /**
     * 获取方位角（水平旋转角度）
     * @returns {Number} 返回当前的方位角值
     */
    this.getAzimuthalAngle = function () {
      return spherical.theta;
    };

    /**
     * 获取当前对象到目标点的距离
     * @returns {Number} 返回对象到目标点的距离
     */
    this.getDistance = function () {
      return this.object.position.distanceTo(this.target);
    };

    /**
     * 监听键盘事件
     * @param {HTMLElement} domElement - 要监听键盘事件的DOM元素
     */
    this.listenToKeyEvents = function (domElement) {
      domElement.addEventListener("keydown", onKeyDown);
      this._domElementKeyEvents = domElement;
    };

    /**
     * 保存当前状态（目标位置、对象位置、缩放等级）
     */
    this.saveState = function () {
      scope.target0.copy(scope.target);
      scope.position0.copy(scope.object.position);
      scope.zoom0 = scope.object.zoom;
    };

    /**
     * 重置控制器到初始状态
     */
    this.reset = function () {
      scope.target.copy(scope.target0);
      scope.object.position.copy(scope.position0);
      scope.object.zoom = scope.zoom0;

      scope.object.updateProjectionMatrix();
      scope.dispatchEvent(_changeEvent);

      scope.update();

      state = STATE.NONE;
    };

    // this method is exposed, but perhaps it would be better if we can make it private...
    this.update = (function (inTheta, inPhi) {    /**
     * 更新相机位置和朝向的方法。
     * @param {number} inTheta - 新的theta值，代表绕目标点的水平旋转角度。
     * @param {number} inPhi - 新的phi值，代表绕目标点的垂直旋转角度。
     * @returns {Function} 返回一个函数，该函数接受theta和phi参数，用于更新相机状态。
     */
      this.update = (function (inTheta, inPhi) {
        const offset = new Vector3(); // 用于存储相机位置相对于目标点的偏移量

        // 根据相机的"up"向量和全球"y-up"向量计算旋转矩阵，用于将相机坐标系转换为全球坐标系
        const quat = new Quaternion().setFromUnitVectors(
          object.up,
          new Vector3(0, 1, 0)
        );
        const quatInverse = quat.clone().invert(); // 计算其逆矩阵，用于将全球坐标系转换回相机坐标系

        const lastPosition = new Vector3(); // 上一帧相机的位置
        const lastQuaternion = new Quaternion(); // 上一帧相机的旋转状态

        const twoPI = 2 * Math.PI; // 圆周率的两倍，用于角度的计算和转换

        // 返回的函数更新相机的位置和朝向
        return function update(inTheta, inPhi) {
          const position = scope.object.position; // 当前相机位置

          offset.copy(position).sub(scope.target); // 计算相机相对于目标点的偏移

          // 将偏移量从相机坐标系转换为全球坐标系
          offset.applyQuaternion(quat);

          // 根据偏移量计算新的相机朝向（theta和phi角）
          spherical.setFromVector3(offset);

          // 如果提供了新的theta和phi值，则更新相机的朝向
          if (inTheta !== undefined && inPhi !== undefined) {
            spherical.theta = inTheta;
            spherical.phi = inPhi;
            sphericalDelta.set(0, 0, 0); // 重置旋转增量
          }

          // 自动旋转相机
          if (scope.autoRotate && state === STATE.NONE) {
            rotateLeft(getAutoRotationAngle());
          }

          // 如果启用了阻尼效果，平滑地更新相机朝向
          if (scope.enableDamping) {
            spherical.theta += sphericalDelta.theta * scope.dampingFactor;
            spherical.phi += sphericalDelta.phi * scope.dampingFactor;
          } else {
            // 如果未启用阻尼，直接更新相机朝向
            spherical.theta += sphericalDelta.theta;
            spherical.phi += sphericalDelta.phi;
          }

          // 限制相机的水平旋转范围
          let min = scope.minAzimuthAngle;
          let max = scope.maxAzimuthAngle;

          if (isFinite(min) && isFinite(max)) {
            // 确保角度在有效范围内
            if (min < -Math.PI) min += twoPI;
            else if (min > Math.PI) min -= twoPI;

            if (max < -Math.PI) max += twoPI;
            else if (max > Math.PI) max -= twoPI;

            spherical.theta = Math.max(min, Math.min(max, spherical.theta));
          }

          // 限制相机的垂直旋转范围
          spherical.phi = Math.max(
            scope.minPolarAngle,
            Math.min(scope.maxPolarAngle, spherical.phi)
          );

          spherical.makeSafe(); // 确保phi值在安全范围内

          spherical.radius *= scale; // 应用缩放因子

          // 限制相机到目标点的距离范围
          spherical.radius = Math.max(
            scope.minDistance,
            Math.min(scope.maxDistance, spherical.radius)
          );

          // 根据平移增量更新目标点的位置
          if (scope.enableDamping === true) {
            scope.target.addScaledVector(panOffset, scope.dampingFactor);
          } else {
            scope.target.add(panOffset);
          }

          // 根据新的朝向和距离计算相机位置
          offset.setFromSpherical(spherical);

          // 将相机位置从全球坐标系转换回相机坐标系
          offset.applyQuaternion(quatInverse);

          position.copy(scope.target).add(offset); // 更新相机位置

          scope.object.lookAt(scope.target); // 让相机朝向目标点

          // 如果启用了阻尼效果，更新旋转和缩放增量
          if (scope.enableDamping === true) {
            sphericalDelta.theta *= 1 - scope.dampingFactor;
            sphericalDelta.phi *= 1 - scope.dampingFactor;

            panOffset.multiplyScalar(1 - scope.dampingFactor);
          } else {
            // 如果未启用阻尼，重置旋转和缩放增量
            sphericalDelta.set(0, 0, 0);

            panOffset.set(0, 0, 0);
          }

          scale = 1; // 重置缩放因子

          // 检查是否需要触发相机更新事件
          if (
            zoomChanged ||
            lastPosition.distanceToSquared(scope.object.position) > EPS ||
            8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS
          ) {
            scope.dispatchEvent(_changeEvent); // 触发更新事件

            lastPosition.copy(scope.object.position); // 更新上一帧相机位置
            lastQuaternion.copy(scope.object.quaternion); // 更新上一帧相机旋转状态
            zoomChanged = false; // 重置缩放改变标志

            return true; // 表示相机状态已更新
          }

          return false; // 表示相机状态未更新
        };
      })();
      const offset = new Vector3();

      // so camera.up is the orbit axis
      const quat = new Quaternion().setFromUnitVectors(
        object.up,
        new Vector3(0, 1, 0)
      );
      const quatInverse = quat.clone().invert();

      const lastPosition = new Vector3();
      const lastQuaternion = new Quaternion();

      const twoPI = 2 * Math.PI;

      return function update(inTheta, inPhi) {
        const position = scope.object.position;

        offset.copy(position).sub(scope.target);

        // rotate offset to "y-axis-is-up" space
        offset.applyQuaternion(quat);

        // angle from z-axis around y-axis
        spherical.setFromVector3(offset);

        if (inTheta !== undefined && inPhi !== undefined) {
          spherical.theta = inTheta;
          spherical.phi = inPhi;
          sphericalDelta.set(0, 0, 0);
        }

        if (scope.autoRotate && state === STATE.NONE) {
          rotateLeft(getAutoRotationAngle());
        }

        if (scope.enableDamping) {
          spherical.theta += sphericalDelta.theta * scope.dampingFactor;
          spherical.phi += sphericalDelta.phi * scope.dampingFactor;
        } else {
          spherical.theta += sphericalDelta.theta;
          spherical.phi += sphericalDelta.phi;
        }

        // restrict theta to be between desired limits

        let min = scope.minAzimuthAngle;
        let max = scope.maxAzimuthAngle;

        if (isFinite(min) && isFinite(max)) {
          if (min < -Math.PI) min += twoPI;
          else if (min > Math.PI) min -= twoPI;

          if (max < -Math.PI) max += twoPI;
          else if (max > Math.PI) max -= twoPI;

          if (min <= max) {
            spherical.theta = Math.max(min, Math.min(max, spherical.theta));
          } else {
            spherical.theta =
              spherical.theta > (min + max) / 2
                ? Math.max(min, spherical.theta)
                : Math.min(max, spherical.theta);
          }
        }

        // restrict phi to be between desired limits
        spherical.phi = Math.max(
          scope.minPolarAngle,
          Math.min(scope.maxPolarAngle, spherical.phi)
        );

        spherical.makeSafe();

        spherical.radius *= scale;

        // restrict radius to be between desired limits
        spherical.radius = Math.max(
          scope.minDistance,
          Math.min(scope.maxDistance, spherical.radius)
        );

        // move target to panned location

        if (scope.enableDamping === true) {
          scope.target.addScaledVector(panOffset, scope.dampingFactor);
        } else {
          scope.target.add(panOffset);
        }

        offset.setFromSpherical(spherical);

        // rotate offset back to "camera-up-vector-is-up" space
        offset.applyQuaternion(quatInverse);

        position.copy(scope.target).add(offset);

        scope.object.lookAt(scope.target);

        if (scope.enableDamping === true) {
          sphericalDelta.theta *= 1 - scope.dampingFactor;
          sphericalDelta.phi *= 1 - scope.dampingFactor;

          panOffset.multiplyScalar(1 - scope.dampingFactor);
        } else {
          sphericalDelta.set(0, 0, 0);

          panOffset.set(0, 0, 0);
        }

        scale = 1;

        // update condition is:
        // min(camera displacement, camera rotation in radians)^2 > EPS
        // using small-angle approximation cos(x/2) = 1 - x^2 / 8

        if (
          zoomChanged ||
          lastPosition.distanceToSquared(scope.object.position) > EPS ||
          8 * (1 - lastQuaternion.dot(scope.object.quaternion)) > EPS
        ) {
          scope.dispatchEvent(_changeEvent);

          lastPosition.copy(scope.object.position);
          lastQuaternion.copy(scope.object.quaternion);
          zoomChanged = false;

          return true;
        }

        return false;
      };
    })();

    /**
    * 释放函数，用于移除所有监听器。
    * 该函数不接受参数，也不返回任何值。
    */
    this.dispose = function () {
      // 从dom元素上移除右键菜单事件监听
      scope.domElement.removeEventListener("contextmenu", onContextMenu);

      // 从dom元素上移除各种指针事件监听
      scope.domElement.removeEventListener("pointerdown", onPointerDown);
      scope.domElement.removeEventListener("pointercancel", onPointerCancel);
      scope.domElement.removeEventListener("wheel", onMouseWheel);

      scope.domElement.removeEventListener("pointermove", onPointerMove);
      scope.domElement.removeEventListener("pointerup", onPointerUp);

      // 如果定义了键盘事件的dom元素，则移除键盘事件监听
      if (scope._domElementKeyEvents !== null) {
        scope._domElementKeyEvents.removeEventListener("keydown", onKeyDown);
      }

      // 注释掉的代码，可能是用于触发dispose事件的
      //scope.dispatchEvent( { type: 'dispose' } ); // should this be added here?
    };

    //
    // 内部变量和常量定义
    //

    const scope = this; // 当前上下文

    const STATE = { // 操作状态枚举
      NONE: -1,
      ROTATE: 0,
      DOLLY: 1,
      PAN: 2,
      TOUCH_ROTATE: 3,
      TOUCH_PAN: 4,
      TOUCH_DOLLY_PAN: 5,
      TOUCH_DOLLY_ROTATE: 6,
    };

    let state = STATE.NONE; // 当前操作状态

    const EPS = 0.000001; // 容差值，用于比较浮点数

    // 球面坐标中的当前位置
    const spherical = new Spherical();
    const sphericalDelta = new Spherical();

    let scale = 1; // 缩放比例
    const panOffset = new Vector3(); // 平移偏移量
    let zoomChanged = false; // 缩放是否改变

    const rotateStart = new Vector2(); // 旋转开始位置
    const rotateEnd = new Vector2(); // 旋转结束位置
    const rotateDelta = new Vector2(); // 旋转变化量

    const panStart = new Vector2(); // 平移开始位置
    const panEnd = new Vector2(); // 平移结束位置
    const panDelta = new Vector2(); // 平移变化量

    const dollyStart = new Vector2(); // 放大/缩小开始位置
    const dollyEnd = new Vector2(); // 放大/缩小结束位置
    const dollyDelta = new Vector2(); // 放大/缩小变化量

    const pointers = []; // 触摸点数组
    const pointerPositions = {}; // 触摸点位置对象

    /**
     * 计算自动旋转的角度
     * @returns {number} 自动旋转的角度
     */
    function getAutoRotationAngle() {
      return ((2 * Math.PI) / 60 / 60) * scope.autoRotateSpeed;
    }

    /**
     * 计算缩放比例
     * @returns {number} 缩放比例
     */
    function getZoomScale() {
      return Math.pow(0.95, scope.zoomSpeed);
    }

    /**
     * 向左旋转
     * @param {number} angle 旋转角度
     */
    function rotateLeft(angle) {
      sphericalDelta.theta -= angle;
    }

    /**
     * 向上旋转
     * @param {number} angle 旋转角度
     */
    function rotateUp(angle) {
      sphericalDelta.phi -= angle;
    }

    // 向左平移的实现
    const panLeft = (function () {
      const v = new Vector3();

      return function panLeft(distance, objectMatrix) {
        v.setFromMatrixColumn(objectMatrix, 0); // 从对象矩阵中获取X轴向量
        v.multiplyScalar(-distance); // 负距离表示向左平移

        panOffset.add(v); // 更新平移偏移量
      };
    })();

    // 向上平移的实现
    const panUp = (function () {
      const v = new Vector3();

      return function panUp(distance, objectMatrix) {
        if (scope.screenSpacePanning === true) {
          // 屏幕空间内平移
          v.setFromMatrixColumn(objectMatrix, 1);
        } else {
          // 世界空间内平移
          v.setFromMatrixColumn(objectMatrix, 0);
          v.crossVectors(scope.object.up, v); // 使平移与摄像机向上方向垂直
        }

        v.multiplyScalar(distance); // 根据距离缩放平移向量

        panOffset.add(v); // 更新平移偏移量
      };
    })();

    /**
     * 根据鼠标或触摸移动平移视图
     * @param {number} deltaX 鼠标或触摸点在水平方向上的位移
     * @param {number} deltaY 鼠标或触摸点在垂直方向上的位移
     */
    const pan = (function () {
      const offset = new Vector3();

      return function pan(deltaX, deltaY) {
        const element = scope.domElement; // DOM元素

        if (scope.object.isPerspectiveCamera) {
          // 如果是透视相机
          const position = scope.object.position; // 相机位置
          offset.copy(position).sub(scope.target); // 计算相机与目标点的距离

          let targetDistance = offset.length();
          // 计算基于FOV的平移量
          targetDistance *= Math.tan(
            ((scope.object.fov / 2) * Math.PI) / 180.0
          );

          // 根据鼠标位移和平移距离更新视图
          panLeft(
            (2 * deltaX * targetDistance) / element.clientHeight,
            scope.object.matrix
          );
          panUp(
            (2 * deltaY * targetDistance) / element.clientHeight,
            scope.object.matrix
          );
        } else if (scope.object.isOrthographicCamera) {
          // 如果是正交相机
          panLeft(
            (deltaX * (scope.object.right - scope.object.left)) /
            scope.object.zoom /
            element.clientWidth,
            scope.object.matrix
          );
          panUp(
            (deltaY * (scope.object.top - scope.object.bottom)) /
            scope.object.zoom /
            element.clientHeight,
            scope.object.matrix
          );
        } else {
          // 不支持的相机类型
          console.warn(
            "WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."
          );
          scope.enablePan = false; // 禁用平移
        }
      };
    })();

    /**
   * 根据dollyScale缩放视图。
   * 如果是透视相机，则改变缩放比例。
   * 如果是正交相机，则调整相机的缩放级别并在需要时更新投影矩阵。
   * 如果相机类型未知，则打印警告并禁用缩放。
   * @param {number} dollyScale - 缩放因子。
   */
    function dollyOut(dollyScale) {
      if (scope.object.isPerspectiveCamera) {
        scale /= dollyScale;
      } else if (scope.object.isOrthographicCamera) {
        scope.object.zoom = Math.max(
          scope.minZoom,
          Math.min(scope.maxZoom, scope.object.zoom * dollyScale)
        );
        scope.object.updateProjectionMatrix();
        zoomChanged = true;
      } else {
        console.warn(
          "WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."
        );
        scope.enableZoom = false;
      }
    }

    /**
     * 根据dollyScale靠近视图。
     * 如果是透视相机，则增加缩放比例。
     * 如果是正交相机，则调整相机的缩放级别并在需要时更新投影矩阵。
     * 如果相机类型未知，则打印警告并禁用缩放。
     * @param {number} dollyScale - 缩放因子。
     */
    function dollyIn(dollyScale) {
      if (scope.object.isPerspectiveCamera) {
        scale *= dollyScale;
      } else if (scope.object.isOrthographicCamera) {
        scope.object.zoom = Math.max(
          scope.minZoom,
          Math.min(scope.maxZoom, scope.object.zoom / dollyScale)
        );
        scope.object.updateProjectionMatrix();
        zoomChanged = true;
      } else {
        console.warn(
          "WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."
        );
        scope.enableZoom = false;
      }
    }

    // 事件回调 - 更新对象状态

    /**
     * 处理鼠标按下时的旋转操作。
     * @param {MouseEvent} event - 鼠标事件。
     */
    function handleMouseDownRotate(event) {
      rotateStart.set(event.clientX, event.clientY);
    }

    /**
     * 处理鼠标按下时的缩放操作。
     * @param {MouseEvent} event - 鼠标事件。
     */
    function handleMouseDownDolly(event) {
      dollyStart.set(event.clientX, event.clientY);
    }

    /**
     * 处理鼠标按下时的推拉操作。
     * @param {MouseEvent} event - 鼠标事件。
     */
    function handleMouseDownPan(event) {
      panStart.set(event.clientX, event.clientY);
    }

    /**
     * 处理鼠标移动时的旋转操作。
     * @param {MouseEvent} event - 鼠标事件。
     */
    function handleMouseMoveRotate(event) {
      rotateEnd.set(event.clientX, event.clientY);

      rotateDelta
        .subVectors(rotateEnd, rotateStart)
        .multiplyScalar(scope.rotateSpeed);

      const element = scope.domElement;

      rotateLeft((2 * Math.PI * rotateDelta.x) / element.clientHeight); // yes, height

      rotateUp((2 * Math.PI * rotateDelta.y) / element.clientHeight);

      rotateStart.copy(rotateEnd);

      scope.update();
    }

    /**
     * 处理鼠标移动时的缩放操作。
     * @param {MouseEvent} event - 鼠标事件。
     */
    function handleMouseMoveDolly(event) {
      dollyEnd.set(event.clientX, event.clientY);

      dollyDelta.subVectors(dollyEnd, dollyStart);

      if (dollyDelta.y > 0) {
        dollyOut(getZoomScale());
      } else if (dollyDelta.y < 0) {
        dollyIn(getZoomScale());
      }

      dollyStart.copy(dollyEnd);

      scope.update();
    }

    /**
     * 处理鼠标移动时的推拉操作。
     * @param {MouseEvent} event - 鼠标事件。
     */
    function handleMouseMovePan(event) {
      panEnd.set(event.clientX, event.clientY);

      panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

      pan(panDelta.x, panDelta.y);

      panStart.copy(panEnd);

      scope.update();
    }

    /**
     * 处理鼠标滚轮事件，用于缩放。
     * @param {WheelEvent} event - 鼠标滚轮事件。
     */
    function handleMouseWheel(event) {
      if (event.deltaY < 0) {
        dollyIn(getZoomScale());
      } else if (event.deltaY > 0) {
        dollyOut(getZoomScale());
      }

      scope.update();
    }

    /**
     * 处理键盘按下事件，用于平移。
     * @param {KeyboardEvent} event - 键盘事件。
     */
    function handleKeyDown(event) {
      let needsUpdate = false;

      switch (event.code) {
        case scope.keys.UP:
          pan(0, scope.keyPanSpeed);
          needsUpdate = true;
          break;

        case scope.keys.BOTTOM:
          pan(0, -scope.keyPanSpeed);
          needsUpdate = true;
          break;

        case scope.keys.LEFT:
          pan(scope.keyPanSpeed, 0);
          needsUpdate = true;
          break;

        case scope.keys.RIGHT:
          pan(-scope.keyPanSpeed, 0);
          needsUpdate = true;
          break;
      }

      if (needsUpdate) {
        // 阻止浏览器在光标键上滚动
        event.preventDefault();

        scope.update();
      }
    }

    /**
   * 处理触摸开始时的旋转操作。
   * 检测触摸点数量，根据单点或双点触控来初始化旋转起始位置。
   */
    function handleTouchStartRotate() {
      if (pointers.length === 1) {
        rotateStart.set(pointers[0].pageX, pointers[0].pageY);
      } else {
        const x = 0.5 * (pointers[0].pageX + pointers[1].pageX);
        const y = 0.5 * (pointers[0].pageY + pointers[1].pageY);

        rotateStart.set(x, y);
      }
    }

    /**
     * 处理触摸开始时的平移操作。
     * 检测触摸点数量，根据单点或双点触控来初始化平移起始位置。
     */
    function handleTouchStartPan() {
      if (pointers.length === 1) {
        panStart.set(pointers[0].pageX, pointers[0].pageY);
      } else {
        const x = 0.5 * (pointers[0].pageX + pointers[1].pageX);
        const y = 0.5 * (pointers[0].pageY + pointers[1].pageY);

        panStart.set(x, y);
      }
    }

    /**
     * 处理触摸开始时的缩放操作。
     * 根据双点触控的距离来初始化缩放起始状态。
     */
    function handleTouchStartDolly() {
      const dx = pointers[0].pageX - pointers[1].pageX;
      const dy = pointers[0].pageY - pointers[1].pageY;

      const distance = Math.sqrt(dx * dx + dy * dy);

      dollyStart.set(0, distance);
    }

    /**
     * 处理触摸开始时同时进行缩放和平移的操作。
     * 根据设置决定是否启用缩放和/或平移。
     */
    function handleTouchStartDollyPan() {
      if (scope.enableZoom) handleTouchStartDolly();

      if (scope.enablePan) handleTouchStartPan();
    }

    /**
     * 处理触摸开始时同时进行缩放和旋转的操作。
     * 根据设置决定是否启用缩放和/或旋转。
     */
    function handleTouchStartDollyRotate() {
      if (scope.enableZoom) handleTouchStartDolly();

      if (scope.enableRotate) handleTouchStartRotate();
    }

    /**
     * 处理触摸移动时的旋转操作。
     * 根据触摸点数量和移动距离更新旋转角度。
     * @param {Event} event 触摸事件对象。
     */
    function handleTouchMoveRotate(event) {
      if (pointers.length == 1) {
        rotateEnd.set(event.pageX, event.pageY);
      } else {
        const position = getSecondPointerPosition(event);

        const x = 0.5 * (event.pageX + position.x);
        const y = 0.5 * (event.pageY + position.y);

        rotateEnd.set(x, y);
      }

      rotateDelta
        .subVectors(rotateEnd, rotateStart)
        .multiplyScalar(scope.rotateSpeed);

      const element = scope.domElement;

      rotateLeft((2 * Math.PI * rotateDelta.x) / element.clientHeight); // yes, height

      rotateUp((2 * Math.PI * rotateDelta.y) / element.clientHeight);

      rotateStart.copy(rotateEnd);
    }

    /**
     * 处理触摸移动时的平移操作。
     * 根据触摸点数量和移动距离更新平移位置。
     * @param {Event} event 触摸事件对象。
     */
    function handleTouchMovePan(event) {
      if (pointers.length === 1) {
        panEnd.set(event.pageX, event.pageY);
      } else {
        const position = getSecondPointerPosition(event);

        const x = 0.5 * (event.pageX + position.x);
        const y = 0.5 * (event.pageY + position.y);

        panEnd.set(x, y);
      }

      panDelta.subVectors(panEnd, panStart).multiplyScalar(scope.panSpeed);

      pan(panDelta.x, panDelta.y);

      panStart.copy(panEnd);
    }

    /**
     * 处理触摸移动时的缩放操作。
     * 根据两点触控的距离变化来更新缩放级别。
     * @param {Event} event 触摸事件对象。
     */
    function handleTouchMoveDolly() {
      const position = getSecondPointerPosition(event);

      const dx = event.pageX - position.x;
      const dy = event.pageY - position.y;

      const distance = Math.sqrt(dx * dx + dy * dy);

      dollyEnd.set(0, distance);

      dollyDelta.set(0, Math.pow(dollyEnd.y / dollyStart.y, scope.zoomSpeed));

      dollyOut(dollyDelta.y);

      dollyStart.copy(dollyEnd);
    }

    /**
  * 处理触摸移动时的缩放和平移操作。
  * @param event 事件对象
  */
    function handleTouchMoveDollyPan(event) {
      if (scope.enableZoom) handleTouchMoveDolly(event); // 如果允许缩放，则处理缩放

      if (scope.enablePan) handleTouchMovePan(event); // 如果允许平移，则处理平移
    }

    /**
     * 处理触摸移动时的缩放和旋转操作。
     * @param event 事件对象
     */
    function handleTouchMoveDollyRotate(event) {
      if (scope.enableZoom) handleTouchMoveDolly(event); // 如果允许缩放，则处理缩放

      if (scope.enableRotate) handleTouchMoveRotate(event); // 如果允许旋转，则处理旋转
    }

    //
    // 事件处理程序 - 状态机：监听事件并重置状态
    //

    /**
     * 处理指针按下事件。
     * @param event 事件对象
     */
    function onPointerDown(event) {
      if (scope.enabled === false) return; // 如果禁用了控制器，则不进行任何操作

      if (pointers.length === 0) {
        scope.domElement.setPointerCapture(event.pointerId); // 获取指针捕获

        scope.domElement.addEventListener("pointermove", onPointerMove); // 监听指针移动事件
        scope.domElement.addEventListener("pointerup", onPointerUp); // 监听指针释放事件
      }

      //

      addPointer(event); // 添加指针

      if (event.pointerType === "touch") {
        onTouchStart(event); // 如果是触摸事件，则处理触摸开始
      } else {
        onMouseDown(event); // 否则，处理鼠标按下
      }
    }

    /**
     * 处理指针移动事件。
     * @param event 事件对象
     */
    function onPointerMove(event) {
      if (scope.enabled === false) return; // 如果控制器被禁用，则不进行任何操作

      if (event.pointerType === "touch") {
        onTouchMove(event); // 如果是触摸事件，则处理触摸移动
      } else {
        onMouseMove(event); // 否则，处理鼠标移动
      }
    }

    /**
     * 处理指针释放事件。
     * @param event 事件对象
     */
    function onPointerUp(event) {
      removePointer(event); // 移除指针

      if (pointers.length === 0) {
        scope.domElement.releasePointerCapture(event.pointerId); // 释放指针捕获

        scope.domElement.removeEventListener("pointermove", onPointerMove); // 移除指针移动事件监听
        scope.domElement.removeEventListener("pointerup", onPointerUp); // 移除指针释放事件监听
      }

      scope.dispatchEvent(_endEvent); // 分发结束事件

      state = STATE.NONE; // 重置状态为NONE
    }

    /**
     * 处理指针取消事件。
     * @param event 事件对象
     */
    function onPointerCancel(event) {
      removePointer(event); // 移除指针
    }

    /**
     * 处理鼠标按下事件。
     * @param event 事件对象
     */
    function onMouseDown(event) {
      let mouseAction;

      switch (event.button) { // 根据鼠标按钮确定操作
        case 0:
          mouseAction = scope.mouseButtons.LEFT;
          break;

        case 1:
          mouseAction = scope.mouseButtons.MIDDLE;
          break;

        case 2:
          mouseAction = scope.mouseButtons.RIGHT;
          break;

        default:
          mouseAction = -1;
      }

      switch (mouseAction) { // 根据操作类型执行相应的处理函数
        case MOUSE.DOLLY:
          if (scope.enableZoom === false) return;

          handleMouseDownDolly(event);

          state = STATE.DOLLY;

          break;

        case MOUSE.ROTATE:
          if (event.ctrlKey || event.metaKey || event.shiftKey) {
            if (scope.enablePan === false) return;

            handleMouseDownPan(event);

            state = STATE.PAN;
          } else {
            if (scope.enableRotate === false) return;

            handleMouseDownRotate(event);

            state = STATE.ROTATE;
          }

          break;

        case MOUSE.PAN:
          if (event.ctrlKey || event.metaKey || event.shiftKey) {
            if (scope.enableRotate === false) return;

            handleMouseDownRotate(event);

            state = STATE.ROTATE;
          } else {
            if (scope.enablePan === false) return;

            handleMouseDownPan(event);

            state = STATE.PAN;
          }

          break;

        default:
          state = STATE.NONE;
      }

      if (state !== STATE.NONE) {
        scope.dispatchEvent(_startEvent); // 分发开始事件
      }
    }

    /**
     * 处理鼠标移动事件。
     * @param event 事件对象
     */
    function onMouseMove(event) {
      switch (state) { // 根据当前状态执行相应的处理函数
        case STATE.ROTATE:
          if (scope.enableRotate === false) return;

          handleMouseMoveRotate(event);

          break;

        case STATE.DOLLY:
          if (scope.enableZoom === false) return;

          handleMouseMoveDolly(event);

          break;

        case STATE.PAN:
          if (scope.enablePan === false) return;

          handleMouseMovePan(event);

          break;
      }
    }

    /**
     * 处理鼠标滚轮事件。
     * @param event 事件对象
     */
    function onMouseWheel(event) {
      if (
        scope.enabled === false ||
        scope.enableZoom === false ||
        state !== STATE.NONE
      )
        return;

      event.preventDefault(); // 阻止默认行为

      scope.dispatchEvent(_startEvent); // 分发开始事件

      handleMouseWheel(event); // 处理滚轮事件

      scope.dispatchEvent(_endEvent); // 分发结束事件
    }

    /**
     * 处理键盘按下事件。
     * @param event 事件对象
     */
    function onKeyDown(event) {
      if (scope.enabled === false || scope.enablePan === false) return;

      handleKeyDown(event); // 处理键盘按下事件
    }

    /**
     * 处理触摸开始事件。
     * @param event 事件对象
     */
    function onTouchStart(event) {
      trackPointer(event); // 跟踪指针

      switch (pointers.length) { // 根据触摸点数量确定操作
        case 1:
          switch (scope.touches.ONE) {
            case TOUCH.ROTATE:
              if (scope.enableRotate === false) return;

              handleTouchStartRotate();

              state = STATE.TOUCH_ROTATE;

              break;

            case TOUCH.PAN:
              if (scope.enablePan === false) return;

              handleTouchStartPan();

              state = STATE.TOUCH_PAN;

              break;

            default:
              state = STATE.NONE;
          }

          break;

        case 2:
          switch (scope.touches.TWO) {
            case TOUCH.DOLLY_PAN:
              if (scope.enableZoom === false && scope.enablePan === false)
                return;

              handleTouchStartDollyPan();

              state = STATE.TOUCH_DOLLY_PAN;

              break;

            case TOUCH.DOLLY_ROTATE:
              if (scope.enableZoom === false && scope.enableRotate === false)
                return;

              handleTouchStartDollyRotate();

              state = STATE.TOUCH_DOLLY_ROTATE;

              break;

            default:
              state = STATE.NONE;
          }

          break;

        default:
          state = STATE.NONE;
      }

      if (state !== STATE.NONE) {
        scope.dispatchEvent(_startEvent); // 分发开始事件
      }
    }

    /**
     * 处理触摸移动事件。
     * @param event 事件对象
     */
    function onTouchMove(event) {
      trackPointer(event); // 跟踪指针

      switch (state) { // 根据当前状态执行相应的处理函数
        case STATE.TOUCH_ROTATE:
          if (scope.enableRotate === false) return;

          handleTouchMoveRotate(event);

          scope.update(); // 更新状态

          break;

        case STATE.TOUCH_PAN:
          if (scope.enablePan === false) return;

          handleTouchMovePan(event);

          scope.update(); // 更新状态

          break;

        case STATE.TOUCH_DOLLY_PAN:
          if (scope.enableZoom === false && scope.enablePan === false) return;

          handleTouchMoveDollyPan(event);

          scope.update(); // 更新状态

          break;

        case STATE.TOUCH_DOLLY_ROTATE:
          if (scope.enableZoom === false && scope.enableRotate === false)
            return;

          handleTouchMoveDollyRotate(event);

          scope.update(); // 更新状态

          break;

        default:
          state = STATE.NONE;
      }
    }

    /**
   * 右键菜单事件处理器，用于阻止默认右键菜单出现。
   * @param {Event} event - 鼠标右键点击事件。
   */
    function onContextMenu(event) {
      // 如果禁止状态为true，则不执行任何操作
      if (scope.enabled === false) return;

      // 阻止默认右键菜单出现
      event.preventDefault();
    }

    /**
     * 添加一个指针事件到指针数组中。
     * @param {Event} event - 指针事件，如鼠标点击或触摸事件。
     */
    function addPointer(event) {
      pointers.push(event);
    }

    /**
     * 从指针数组和指针位置对象中移除指定的指针事件。
     * @param {Event} event - 需要被移除的指针事件。
     */
    function removePointer(event) {
      // 从指针位置对象中删除对应的指针ID
      delete pointerPositions[event.pointerId];

      // 在指针数组中查找并移除对应的指针事件
      for (let i = 0; i < pointers.length; i++) {
        if (pointers[i].pointerId == event.pointerId) {
          pointers.splice(i, 1);
          return;
        }
      }
    }

    /**
     * 跟踪指针事件，更新指针的位置信息。
     * @param {Event} event - 指针事件，包含指针ID和页面位置信息。
     */
    function trackPointer(event) {
      // 获取或创建对应指针ID的位置对象
      let position = pointerPositions[event.pointerId];

      if (position === undefined) {
        position = new Vector2();
        pointerPositions[event.pointerId] = position;
      }

      // 更新指针的位置信息
      position.set(event.pageX, event.pageY);
    }

    /**
     * 获取第二个指针的位置信息。
     * @param {Event} event - 当前的指针事件，用于判断是获取哪个指针的位置。
     * @returns {Vector2} - 第二个指针的位置对象。
     */
    function getSecondPointerPosition(event) {
      // 根据当前事件的指针ID，获取另一个指针的信息
      const pointer =
        event.pointerId === pointers[0].pointerId ? pointers[1] : pointers[0];

      return pointerPositions[pointer.pointerId];
    }

    //

    // 为DOM元素添加事件监听器
    scope.domElement.addEventListener("contextmenu", onContextMenu);

    scope.domElement.addEventListener("pointerdown", onPointerDown);
    scope.domElement.addEventListener("pointercancel", onPointerCancel);
    scope.domElement.addEventListener("wheel", onMouseWheel, {
      passive: false,
    });

    // 在开始时强制更新
    this.update();
  }
}
