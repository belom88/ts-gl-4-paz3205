import { GltfAsset, GltfLoader } from "gltf-loader-ts";
import { Node } from "gltf-loader-ts/lib/gltf";
import { COMPONENTS_MAP, COMPONENT_TYPE_MAP } from "../tools/constants";
import {
  GltfPrimitiveData,
  ModelRenderOptions,
  ModelWebGlBuffer,
  ModelWebGlBuffers,
} from "../types/model-data";
import { GltfArray } from "../types/gltf";
import { ProgramInfo } from "../types/program-info";
import { GlMatrix } from "./gl-matrix";
import { isPowerOf2 } from "../tools/math";

export abstract class GlModel {
  abstract readonly uri: string;
  private asset: GltfAsset | null = null;
  protected webGlPrimitiveBuffers: ModelWebGlBuffers | null = null;

  constructor(
    public gl: WebGLRenderingContext,
    public programInfo: ProgramInfo
  ) {}

  public async load(): Promise<void> {
    const loader = new GltfLoader();
    const asset: GltfAsset = await loader.load(this.uri);
    this.asset = asset;
    const primitives: { [key: string]: GltfPrimitiveData } = await this.parse();
    this.initBuffers(primitives);
  }

  public abstract render(options: ModelRenderOptions): void;

  protected renderPrimitives(modelViewMatrix: GlMatrix) {
    for (const primitiveKey in this.webGlPrimitiveBuffers) {
      const webGlPrimitiveBuffer = this.webGlPrimitiveBuffers[primitiveKey];
      const matrix = new GlMatrix().multiplyRight(modelViewMatrix.m);
      if (webGlPrimitiveBuffer.transformationMatrix) {
        matrix.multiplyRight(webGlPrimitiveBuffer.transformationMatrix.m);
      }
      // Set the shader uniforms
      this.gl.uniformMatrix4fv(
        this.programInfo.uniformLocations.modelViewMatrix,
        false,
        matrix.m
      );
      this.renderPrimitive(webGlPrimitiveBuffer);
    }
  }

  protected renderPrimitive(webGlPrimitiveBuffer: ModelWebGlBuffer) {
    // Tell WebGL how to pull out the positions from the position
    // buffer into the vertexPosition attribute
    {
      const numComponents = 3;
      const type = this.gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, webGlPrimitiveBuffer.position);
      this.gl.vertexAttribPointer(
        this.programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset
      );
      this.gl.enableVertexAttribArray(
        this.programInfo.attribLocations.vertexPosition
      );
    }

    // Tell WebGL how to pull out the colors from the color buffer
    // into the vertexColor attribute.
    {
      if (webGlPrimitiveBuffer.color) {
        const numComponents = 4;
        const type = this.gl.UNSIGNED_SHORT;
        const normalize = true;
        const stride = 0;
        const offset = 0;
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, webGlPrimitiveBuffer.color);
        this.gl.vertexAttribPointer(
          this.programInfo.attribLocations.vertexColor,
          numComponents,
          type,
          normalize,
          stride,
          offset
        );
        this.gl.enableVertexAttribArray(
          this.programInfo.attribLocations.vertexColor
        );
      } else {
        this.gl.vertexAttrib4f(
          this.programInfo.attribLocations.vertexColor,
          1,
          1,
          1,
          1
        );
        this.gl.disableVertexAttribArray(
          this.programInfo.attribLocations.vertexColor
        );
      }
    }

    // Tell WebGL how to pull out the normals from the normal buffer
    // into the vertexNormal attribute.
    {
      const numComponents = 3;
      const type = this.gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, webGlPrimitiveBuffer.normal);
      this.gl.vertexAttribPointer(
        this.programInfo.attribLocations.vertexNormal,
        numComponents,
        type,
        normalize,
        stride,
        offset
      );
      this.gl.enableVertexAttribArray(
        this.programInfo.attribLocations.vertexNormal
      );
    }

    this.gl.uniform1f(
      this.programInfo.uniformLocations.hasTexture,
      Boolean(webGlPrimitiveBuffer.texture) ? 1 : 0
    );

    if (webGlPrimitiveBuffer.texture) {
      this.gl.bindTexture(this.gl.TEXTURE_2D, webGlPrimitiveBuffer.texture);
      const numComponents = 2;
      const type = this.gl.FLOAT;
      const normalize = false;
      const stride = 0;
      const offset = 0;
      this.gl.bindBuffer(this.gl.ARRAY_BUFFER, webGlPrimitiveBuffer.texCoord);
      this.gl.vertexAttribPointer(
        this.programInfo.attribLocations.vertexTexCoord,
        numComponents,
        type,
        normalize,
        stride,
        offset
      );
      this.gl.enableVertexAttribArray(
        this.programInfo.attribLocations.vertexTexCoord
      );
    } else {
      this.gl.disableVertexAttribArray(
        this.programInfo.attribLocations.vertexTexCoord
      );
    }

    const offset = 0;
    const vertexCount = webGlPrimitiveBuffer.vertexCount;
    if (webGlPrimitiveBuffer.index) {
      this.gl.bindBuffer(
        this.gl.ELEMENT_ARRAY_BUFFER,
        webGlPrimitiveBuffer.index.buffer
      );
      const type = webGlPrimitiveBuffer.index.type;
      this.gl.drawElements(
        this.gl.TRIANGLES,
        webGlPrimitiveBuffer.vertexCount,
        type,
        offset
      );
    } else {
      this.gl.drawArrays(this.gl.TRIANGLES, offset, vertexCount);
    }
  }

  private async parse(): Promise<{ [key: string]: GltfPrimitiveData }> {
    if (!this.asset) {
      throw new Error("Data has not been loaded");
    }
    const primitives: { [key: string]: GltfPrimitiveData } =
      await this.parseBufferViews(this.asset);

    return primitives;
  }

  private async parseBufferViews(
    asset: GltfAsset
  ): Promise<{ [key: string]: GltfPrimitiveData }> {
    const gltf = asset.gltf;
    const binaryChunk = asset.glbData?.binaryChunk;
    if (!binaryChunk) {
      throw new Error("The gltf doesn't contain binary chunk");
    }
    const bufferViews = gltf.bufferViews || [];
    const buffers = [];
    for (let index = 0; index < bufferViews.length; index++) {
      buffers.push(await asset.bufferViewData(index));
    }

    if (buffers.length < 5) {
      throw new Error("Wrong set of buffers");
    }

    const result: { [key: string]: GltfPrimitiveData } = {};
    const accessors = gltf.accessors || [];

    if (!gltf.nodes) {
      throw new Error("There aren't nodes in the model file");
    }
    if (!gltf.meshes) {
      throw new Error("There aren't meshes in the model file");
    }

    for (const node of gltf.nodes) {
      if (node.mesh === undefined) {
        continue;
      }
      const { name, primitives } = gltf.meshes[node.mesh];
      const transformationMatrix = this.calcNodeTransformation(node);
      if (!primitives.length) {
        throw new Error("Empty primitive");
      }
      const {
        attributes = {},
        indices = -1,
        material: materialIndex = -1,
      } = primitives[0] || {};
      let texture: HTMLImageElement | undefined;
      if (materialIndex !== -1) {
        const material = gltf.materials![materialIndex];
        const { baseColorTexture } = material.pbrMetallicRoughness || {};
        if (baseColorTexture) {
          const imageIndex = baseColorTexture.index;
          texture = await asset.imageData.get(imageIndex);
        }
      }
      const primitiveGeometry: GltfPrimitiveData = {
        attributes: {},
        vertexCount: 0,
        texture,
        transformationMatrix,
      };
      for (const attrKey in attributes) {
        const accessor = accessors[attributes[attrKey]];
        if (accessor === undefined) {
          throw new Error("An accessor has not been found");
        }
        const bufferViewIndex = accessor.bufferView;
        if (bufferViewIndex === undefined) {
          throw new Error("An accessor doesn't contain bufferView");
        }
        const TypedArrayConstructor =
          COMPONENT_TYPE_MAP[accessor.componentType] || Uint8Array;
        const buffer = buffers[bufferViewIndex];
        primitiveGeometry.attributes[attrKey] = {
          ctor: TypedArrayConstructor,
          components: COMPONENTS_MAP[accessor.type],
          buffer: new TypedArrayConstructor(
            buffer.buffer,
            buffer.byteOffset,
            buffer.byteLength / TypedArrayConstructor.BYTES_PER_ELEMENT
          ),
        };
      }
      if (indices >= 0) {
        const accessor = accessors[indices];
        const bufferViewIndex = accessor.bufferView;
        if (bufferViewIndex === undefined) {
          throw new Error("An accessor has not been found");
        }
        const TypedArrayConstructor =
          COMPONENT_TYPE_MAP[accessor.componentType] || Uint8Array;
        const buffer = buffers[bufferViewIndex];
        primitiveGeometry.indices = new TypedArrayConstructor(
          binaryChunk.buffer,
          buffer.byteOffset,
          buffer.byteLength / TypedArrayConstructor.BYTES_PER_ELEMENT
        );
        primitiveGeometry.vertexCount = primitiveGeometry.indices.length;
      } else {
        const positionAttribute = primitiveGeometry.attributes.POSITION;
        if (!positionAttribute) {
          throw new Error("Model doesn't contain POSITION attribute");
        }
        primitiveGeometry.vertexCount =
          positionAttribute.buffer.length / positionAttribute.components;
      }
      result[name] = primitiveGeometry;
    }

    return result;
  }

  private calcNodeTransformation(node: Node): GlMatrix {
    const result = new GlMatrix();
    if (node.scale) {
      result.scale(node.scale[0], node.scale[1], node.scale[2]);
    }
    if (node.rotation) {
      result.rotateWithQuaternion(
        node.rotation[0],
        node.rotation[1],
        node.rotation[2],
        node.rotation[3]
      );
    }
    if (node.translation) {
      result.translate(
        node.translation[0],
        node.translation[1],
        node.translation[2]
      );
    }

    if (node.matrix) {
      result.multiplyRight(new Float32Array(node.matrix));
    }
    return result;
  }

  private initBuffers(primitives: { [key: string]: GltfPrimitiveData }) {
    this.webGlPrimitiveBuffers = {};
    for (const primitiveKey in primitives) {
      const primitive = primitives[primitiveKey];
      const {
        attributes: { POSITION, COLOR_0, NORMAL, TEXCOORD_0 },
        indices,
        texture: textureImage,
        transformationMatrix = new GlMatrix(),
      } = primitive;
      if (!(POSITION && NORMAL)) {
        throw new Error("A primitive doesn't contain necessary attributes");
      }

      this.webGlPrimitiveBuffers[primitiveKey] = {
        position: this.gl.createBuffer(),
        color: null,
        normal: this.gl.createBuffer(),
        index: null,
        texture: null,
        texCoord: null,
        vertexCount: primitive.vertexCount,
        transformationMatrix,
      };

      this.gl.bindBuffer(
        this.gl.ARRAY_BUFFER,
        this.webGlPrimitiveBuffers[primitiveKey].position
      );
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        POSITION.buffer,
        this.gl.STATIC_DRAW
      );

      if (COLOR_0) {
        this.webGlPrimitiveBuffers[primitiveKey].color = this.gl.createBuffer();
        this.gl.bindBuffer(
          this.gl.ARRAY_BUFFER,
          this.webGlPrimitiveBuffers[primitiveKey].color
        );
        this.gl.bufferData(
          this.gl.ARRAY_BUFFER,
          COLOR_0.buffer,
          this.gl.STATIC_DRAW
        );
      }

      if (textureImage) {
        const texture = this.gl.createTexture();
        this.webGlPrimitiveBuffers[primitiveKey].texture = texture;
        this.gl.bindTexture(this.gl.TEXTURE_2D, texture);
        const level = 0;
        const internalFormat = this.gl.RGBA;
        const format = this.gl.RGBA;
        const type = this.gl.UNSIGNED_BYTE;
        this.gl.texImage2D(
          this.gl.TEXTURE_2D,
          level,
          internalFormat,
          format,
          type,
          textureImage
        );
        // WebGL1 has different requirements for power of 2 images
        // vs non power of 2 images so check if the image is a
        // power of 2 in both dimensions.
        if (isPowerOf2(textureImage.width) && isPowerOf2(textureImage.height)) {
          // Yes, it's a power of 2. Generate mips.
          this.gl.generateMipmap(this.gl.TEXTURE_2D);
        } else {
          // No, it's not a power of 2. Turn off mips and set
          // wrapping to clamp to edge
          this.gl.texParameteri(
            this.gl.TEXTURE_2D,
            this.gl.TEXTURE_WRAP_S,
            this.gl.CLAMP_TO_EDGE
          );
          this.gl.texParameteri(
            this.gl.TEXTURE_2D,
            this.gl.TEXTURE_WRAP_T,
            this.gl.CLAMP_TO_EDGE
          );
          this.gl.texParameteri(
            this.gl.TEXTURE_2D,
            this.gl.TEXTURE_MIN_FILTER,
            this.gl.LINEAR
          );
        }

        if (TEXCOORD_0) {
          this.webGlPrimitiveBuffers[primitiveKey].texCoord =
            this.gl.createBuffer();
          this.gl.bindBuffer(
            this.gl.ARRAY_BUFFER,
            this.webGlPrimitiveBuffers[primitiveKey].texCoord
          );
          this.gl.bufferData(
            this.gl.ARRAY_BUFFER,
            TEXCOORD_0.buffer,
            this.gl.STATIC_DRAW
          );
        }
      }

      this.gl.bindBuffer(
        this.gl.ARRAY_BUFFER,
        this.webGlPrimitiveBuffers[primitiveKey].normal
      );
      this.gl.bufferData(
        this.gl.ARRAY_BUFFER,
        NORMAL.buffer,
        this.gl.STATIC_DRAW
      );

      if (indices) {
        this.webGlPrimitiveBuffers[primitiveKey].index = {
          buffer: this.gl.createBuffer(),
          type: this.getGlTypeByTypedArray(indices),
        };
        this.gl.bindBuffer(
          this.gl.ELEMENT_ARRAY_BUFFER,
          this.webGlPrimitiveBuffers[primitiveKey].index!.buffer
        );
        this.gl.bufferData(
          this.gl.ELEMENT_ARRAY_BUFFER,
          indices,
          this.gl.STATIC_DRAW
        );
      }
    }
  }

  private getGlTypeByTypedArray(typedArray: GltfArray): number {
    switch (typedArray.constructor) {
      case Uint8Array:
        return this.gl.UNSIGNED_BYTE;
      case Uint16Array:
        return this.gl.UNSIGNED_SHORT;
      case Uint32Array:
        return this.gl.UNSIGNED_INT;
      default:
        return this.gl.UNSIGNED_SHORT;
    }
  }
}
