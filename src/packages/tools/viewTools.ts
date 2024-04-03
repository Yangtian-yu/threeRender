import * as THREE from 'three';
import { ExtendOrbitControls } from '../';

const raycaster = new THREE.Raycaster();

/**
 * 根据鼠标事件和相机视角，获取鼠标在三维场景中指向的物体位置。
 * @param event 鼠标事件，用于获取鼠标的位置信息。
 * @param dom HTMLCanvasElement，用于计算鼠标在画布上的相对位置。
 * @param camera THREE.Camera，当前的相机对象，用于定义视线。
 * @param objects THREE.Object3D<THREE.Event>[], 一组可能与光线相交的三维物体。
 * @returns 与光线相交的物体数组。如果没有物体与光线相交，则返回一个空数组。
 */
export function getVector2Position(
  event: MouseEvent,
  dom: HTMLCanvasElement,
  camera: THREE.Camera,
  objects: THREE.Object3D<THREE.Event>[],
) {
  // 创建一个二维向量，用于存储鼠标在屏幕上的位置
  const mouse = new THREE.Vector2();
  // 根据鼠标事件和画布尺寸，计算鼠标在归一化屏幕坐标系中的位置
  mouse.x = (event.offsetX / dom.clientWidth) * 2 - 1;
  mouse.y = -(event.offsetY / dom.clientHeight) * 2 + 1;
  // 根据相机和鼠标位置设置光线投射器的起点和方向
  raycaster.setFromCamera(mouse, camera);
  // 计算光线与场景中物体的交点
  const intersects = raycaster.intersectObjects(objects);
  return intersects;
}
/**
 * 缩放视图功能，通过调整相机位置来实现对目标物体的缩放。
 * @param control ExtendOrbitControls 实例，用于控制相机运动和位置。
 * @param target 需要进行缩放的目标物体的位置向量。
 * @param scale 缩放的比例向量，默认为 (0.1, 0.1, 0.1)。
 * @param offset 缩放后位置的偏移量，默认为原点。
 */
export function scaleView(
  control: ExtendOrbitControls,
  target: THREE.Vector3,
  scale: THREE.Vector3 = new THREE.Vector3(0.1, 0.1, 0.1),
  offset: THREE.Vector3 = new THREE.Vector3(),
) {
  // 提取目标位置的坐标
  const { x, y, z } = target;
  // 提取当前相机位置的坐标
  const { x: cameraX, Y: cameraY, Z: cameraZ } = control.object.position;
  // 创建当前相机位置的向量
  const cameraPos = new THREE.Vector3(cameraX, cameraY, cameraZ);
  // 计算相机到目标位置的距离向量，并根据缩放比例进行缩放
  const distanceVector = cameraPos.sub(target).multiply(scale);
  // 获取当前的水平角度和极角
  const theta = control.getAzimuthalAngle();
  const phi = control.getPolarAngle();
  // 计算缩放和偏移后的新相机位置
  const newCameraPos = target.add(distanceVector).add(offset);
  // 设置相机的新位置，并更新相机的投影矩阵
  control.object.position.set(newCameraPos.x, newCameraPos.y, newCameraPos.z);
  control.object.updateProjectionMatrix();

  // 更新目标位置，并根据新角度更新控制对象
  control.target.set(x, y, z);
  control.update(theta, phi);
}
