import * as THREE from 'three';
import { ExtendOrbitControls, getVector2Position, scaleView } from '../../packages';

export class BaseRender {
  container?: HTMLElement;
  perspectiveCamera: THREE.PerspectiveCamera;
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  orbitControls?: ExtendOrbitControls;
  raycaster: THREE.Raycaster;
  isDrawing?: boolean;
  constructor() {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x141414);
    this.scene.add(new THREE.AmbientLight(0xffffff, 0.8));
    this.perspectiveCamera = new THREE.PerspectiveCamera();
    this.raycaster = new THREE.Raycaster();
  }
  init(container: HTMLElement) {
    if (this.isDrawing || container.childNodes.length > 0) {
      this.animate();
      return;
    }
    this.isDrawing = true;
    this.container = container;
    this.container.appendChild(this.renderer.domElement);

    this.onWindowResize();
    this.resetControls();
    this.animate();
    window.addEventListener('resize', () => this.onWindowResize(), false);
  }
  onWindowResize() {
    const canvas = this.container;
    const clientWidth = canvas ? canvas.clientWidth : document.documentElement.clientWidth;
    const clientHeight = canvas ? canvas.clientHeight : document.documentElement.clientHeight;
    this.perspectiveCamera = new THREE.PerspectiveCamera(60, clientWidth / clientHeight, 1, 2000);
    this.perspectiveCamera.up = new THREE.Vector3(0, 0, 1);
    this.perspectiveCamera.lookAt(0, 0, 0);
    this.perspectiveCamera.position.set(0, 0, 100);
    this.perspectiveCamera.updateProjectionMatrix();
    this.renderer.setSize(clientWidth, clientHeight);
  }
  resetControls() {
    this.orbitControls = new ExtendOrbitControls(this.perspectiveCamera, this.renderer.domElement);
    this.orbitControls.target.set(0, 0, 0);
    Reflect.set(this.orbitControls, 'mouseButtons', {
      LEFT: THREE.MOUSE.PAN,
      MIDDLE: THREE.MOUSE.DOLLY,
      RIGHT: THREE.MOUSE.ROTATE,
    });
    this.orbitControls.enabled = true;
    this.orbitControls.minDistance = 0;
    this.orbitControls.maxDistance = 3840;
    this.orbitControls.update();
    // reset control target
    window.addEventListener('dblclick', (event: MouseEvent) => {
      const element = event.target as HTMLElement;
      if (element.tagName === 'CANVAS' && this.orbitControls) {
        const intersects = getVector2Position(
          event,
          this.renderer.domElement,
          this.perspectiveCamera,
          this.scene.children,
        );
        intersects && intersects[0] && scaleView(this.orbitControls, intersects[0].point);
      }
    });
  }
  animate() {
    requestAnimationFrame(() => this.animate());
    this.renderer.render(this.scene, this.perspectiveCamera);
  }
}
