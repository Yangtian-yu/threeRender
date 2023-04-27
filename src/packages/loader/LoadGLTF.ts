import { GLTF, GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

export function LoadGLTF(gltfFile: string): Promise<GLTF> {
  const gltfLoader = new GLTFLoader();
  return new Promise((resolve, reject) => {
    gltfLoader.load(
      gltfFile,
      (gltf) => {
        resolve(gltf);
      },
      () => {},
      (err) => {
        reject(err);
      }
    );
  });
}
