import * as THREE from 'three';
import { ExtendOrbitControls } from '../';

const raycaster = new THREE.Raycaster();

export function getVector2Position(
  event: MouseEvent,
  dom: HTMLCanvasElement,
  camera: THREE.Camera,
  objects: THREE.Object3D<THREE.Event>[],
) {
  const mouse = new THREE.Vector2();
  mouse.x = (event.offsetX / dom.clientWidth) * 2 - 1;
  mouse.y = -(event.offsetY / dom.clientHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(objects);
  return intersects;
}
export function scaleView(
  control: ExtendOrbitControls,
  target: THREE.Vector3,
  scale: THREE.Vector3 = new THREE.Vector3(0.1, 0.1, 0.1),
  offset: THREE.Vector3 = new THREE.Vector3(),
) {
  const { x, y, z } = target;
  const { x: cameraX, Y: cameraY, Z: cameraZ } = control.object.position;
  const cameraPos = new THREE.Vector3(cameraX, cameraY, cameraZ);
  const distanceVector = cameraPos.sub(target).multiply(scale);
  const theta = control.getAzimuthalAngle();
  const phi = control.getPolarAngle();
  const newCameraPos = target.add(distanceVector).add(offset);
  control.object.position.set(newCameraPos.x, newCameraPos.y, newCameraPos.z);
  control.object.updateProjectionMatrix();

  control.target.set(x, y, z);
  control.update(theta, phi);
}
