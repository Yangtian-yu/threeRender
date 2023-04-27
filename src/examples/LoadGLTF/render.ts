import { LoadGLTF } from "../../packages";
import { BaseRender } from "../../packages";

class RenderGLTF extends BaseRender {
  constructor() {
    super();
    this.drawGLTF();
  }
  async drawGLTF() {
    const glb = await LoadGLTF("/container.glb");
    this.scene.add(glb.scene);
  }
}
const renderProgrem = new RenderGLTF();
export default renderProgrem;
