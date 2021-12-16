import { GlMatrix } from "../../core/gl-matrix";
import { GlModel } from "../../core/gl-model";
import { ModelRenderOptions } from "../../types/model-data";

export class BusModel extends GlModel {
  public readonly uri: string = "http://localhost:8080/paz3205.glb";
  public position: [number, number, number] = [10, 0.4, 25];
  public wheels: {
    translation: [number, number, number];
    rotation?: [number, number, number, number];
  }[] = [
    { translation: [3.9, 0.7, 2.2] },
    { translation: [3.9, 0.7, -2.2], rotation: [180, 0, 1, 0] },
    { translation: [-2.2, 0.7, 2.2], rotation: [180, 0, 1, 0] },
    { translation: [-2.2, 0.7, 1.7] },
    { translation: [-2.2, 0.7, -2.2] },
    { translation: [-2.2, 0.7, -1.7], rotation: [180, 0, 1, 0] },
    { translation: [3.9, 0.7, -2.2], rotation: [180, 0, 1, 0] },
  ];
  public render({ viewMatrix }: ModelRenderOptions) {
    const modelMatrix = new GlMatrix()
      // .rotate(180, 1, 0, 0)
      // .translate(0, 10, 0)
      .translate(...this.position);
    for (const primitiveKey in this.webGlPrimitiveBuffers) {
      const webGlPrimitiveBuffer = this.webGlPrimitiveBuffers[primitiveKey];

      if (primitiveKey === "wheel") {
        for (const wheel of this.wheels) {
          const modelViewMatrix = new GlMatrix()
            .multiplyRight(viewMatrix.m)
            .multiplyRight(modelMatrix.m);
          const translationMatrix = new GlMatrix().translate(
            ...wheel.translation
          );

          modelViewMatrix.multiplyRight(translationMatrix.m);
          let rotationMatrix = new GlMatrix();
          if (wheel.rotation) {
            rotationMatrix.rotate(...wheel.rotation);
          }
          modelViewMatrix.multiplyRight(rotationMatrix.m);
          if (webGlPrimitiveBuffer.transformationMatrix) {
            modelViewMatrix.multiplyRight(
              webGlPrimitiveBuffer.transformationMatrix.m
            );
          }
          // Set the shader uniforms
          this.gl.uniformMatrix4fv(
            this.programInfo.uniformLocations.modelViewMatrix,
            false,
            modelViewMatrix.m
          );
          this.renderPrimitive(webGlPrimitiveBuffer);
        }
      } else {
        const modelViewMatrix = new GlMatrix()
          .multiplyRight(viewMatrix.m)
          .multiplyRight(modelMatrix.m);
        if (webGlPrimitiveBuffer.transformationMatrix) {
          modelViewMatrix.multiplyRight(
            webGlPrimitiveBuffer.transformationMatrix.m
          );
        }
        // Set the shader uniforms
        this.gl.uniformMatrix4fv(
          this.programInfo.uniformLocations.modelViewMatrix,
          false,
          modelViewMatrix.m
        );
        this.renderPrimitive(webGlPrimitiveBuffer);
      }
    }
  }
}
