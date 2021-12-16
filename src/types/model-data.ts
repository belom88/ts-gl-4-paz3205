import { GlMatrix } from "../core/gl-matrix";
import { Buffers, GltfArray } from "./gltf";

export interface GltfPrimitiveData {
  attributes: Buffers;
  indices?: GltfArray;
  texture?: HTMLImageElement;
  vertexCount: number;
  transformationMatrix: GlMatrix;
}

export interface ModelWebGlBuffer {
  position: WebGLBuffer | null;
  color: WebGLBuffer | null;
  normal: WebGLBuffer | null;
  texCoord: WebGLBuffer | null;
  texture: WebGLTexture | null;
  index: {
    buffer: WebGLBuffer | null;
    type: number;
  } | null;
  vertexCount: number;
  transformationMatrix: GlMatrix;
}

export interface ModelWebGlBuffers {
  [key: string]: ModelWebGlBuffer;
}

export interface ModelRenderOptions {
  viewMatrix: GlMatrix;
  [key: string]: any;
}
