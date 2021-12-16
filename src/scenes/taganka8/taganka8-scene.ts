import { GlMatrix } from "../../core/gl-matrix";
import { initShaderProgram } from "../../core/gl-shader";
import { ProgramInfo } from "../../types/program-info";
import { Taganka8Model } from "./taganka8-model";
import vertexShaderSource from "./taganka8.vert.glsl";
import fragmentShaderSource from "./taganka8.frag.glsl";
import { GlCamera } from "../../core/gl-camera";
import { ProjectionData } from "../../types/projection";
import { BusModel } from "./bus-model";

export class Taganka8Scene {
  private vsSource: string = vertexShaderSource;
  private fsSource: string = fragmentShaderSource;
  terrain: Taganka8Model | null = null;
  bus: BusModel | null = null;

  private programInfo: ProgramInfo | null = null;

  constructor(
    public gl: WebGLRenderingContext,
    public camera: GlCamera,
    public projectionData: ProjectionData
  ) {
    const program = initShaderProgram(gl, this.vsSource, this.fsSource);
    if (!program) {
      return;
    }
    this.programInfo = {
      program,
      attribLocations: {
        vertexPosition: gl.getAttribLocation(program, "aVertexPosition"),
        vertexColor: gl.getAttribLocation(program, "aVertexColor"),
        vertexNormal: gl.getAttribLocation(program, "aVertexNormal"),
        vertexTexCoord: gl.getAttribLocation(program, "aVertexTexCoord"),
      },
      uniformLocations: {
        projectionMatrix: gl.getUniformLocation(program, "uProjectionMatrix"),
        modelViewMatrix: gl.getUniformLocation(program, "uModelViewMatrix"),
        hasTexture: gl.getUniformLocation(program, "uHasTexture"),
        sample: gl.getUniformLocation(program, "uSample"),
      },
    };
  }

  public async loadModel() {
    if (!this.programInfo) {
      throw Error("Shaders haven't been compiled correctly");
    }
    this.bus = new BusModel(this.gl, this.programInfo);
    await this.bus.load();
    this.terrain = new Taganka8Model(this.gl, this.programInfo);
    await this.terrain.load();
  }

  public prepareScene() {
    this.gl.clearColor(0.0, 0.0, 0.0, 1.0);
    this.gl.clearDepth(1.0); // Clear everything
    this.gl.enable(this.gl.DEPTH_TEST); // Enable depth testing
    this.gl.depthFunc(this.gl.LEQUAL); // Near things obscure far things

    if (!this.programInfo) {
      throw Error("Shaders haven't been compiled correctly");
    }

    // Tell WebGL to use our program when drawing
    this.gl.useProgram(this.programInfo.program);

    const { fieldOfView, aspect, zNear, zFar } = this.projectionData;
    const projectionMatrix = new GlMatrix().perspective(
      fieldOfView,
      aspect,
      zNear,
      zFar
    );
    this.gl.uniformMatrix4fv(
      this.programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix.m
    );

    this.gl.uniform1i(this.programInfo.uniformLocations.sample, 0);
  }

  public drawScene(deltaTime: number) {
    // Clear the canvas before we start drawing on it.
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);

    if (!this.programInfo) {
      throw Error("Shaders has't been compiled correctly");
    }

    const viewMatrix = new GlMatrix().lookAt(
      this.camera.eye,
      this.camera.center,
      this.camera.up
    );
    this.bus?.render({ viewMatrix });
    this.terrain?.render({ viewMatrix });
  }
}
