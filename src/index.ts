import { GlContext } from "./core/gl-context";
import { Taganka8Scene } from "./scenes/taganka8/taganka8-scene";

import "./index.scss";
import { Point } from "./types/point";
import { GlCamera } from "./core/gl-camera";
import { ProjectionData } from "./types/projection";

const glContext: GlContext = new GlContext("canvas");

const canvasElement: HTMLCanvasElement =
  document.getElementsByTagName("canvas")[0];
canvasElement.addEventListener("mousedown", canvasMouseDown);
canvasElement.addEventListener("mousemove", canvasMouseMove);
canvasElement.addEventListener("mouseleave", canvasDragEnd);
canvasElement.addEventListener("mouseup", canvasDragEnd);
canvasElement.addEventListener("wheel", canvasZoom);

if (glContext.gl === null) {
  throw new Error("Gl context hasn't been found");
}
glContext.gl.getExtension('OES_element_index_uint');

const projectionData: ProjectionData = {
  fieldOfView: 45,
  aspect: glContext.gl.canvas.width / glContext.gl.canvas.height,
  zNear: 0.5,
  zFar: 1000.0,
};

// const camera = new GlCamera(30, 20, 50, 0, 0, 5, glContext.gl, projectionData);
const camera = new GlCamera(9, 2, 50, 0, 0, 5, glContext.gl, projectionData);
const scene = new Taganka8Scene(glContext.gl, camera, projectionData);
let thenTime: number = 0;

function render(nowTime: number) {
  nowTime *= 0.1; // convert to seconds
  const deltaTime = nowTime - thenTime;
  thenTime = nowTime;
  scene.drawScene(deltaTime);
  requestAnimationFrame(render);
}

scene.loadModel().then(() => {
  scene.prepareScene();
  // Draw the scene repeatedly
  requestAnimationFrame(render);
});

let inDrag: boolean = false;
let inRotation: boolean = false;
let dragStart: Point = { x: 0, y: 0 };
function canvasMouseDown(event: MouseEvent) {
  dragStart = {
    x: event.clientX,
    y: event.clientY,
  };

  if (event.ctrlKey) {
    inRotation = true;
  } else {
    inDrag = true;
  }
}

function canvasMouseMove(event: MouseEvent) {
  let dragDelta: Point = { x: 0, y: 0 };
  dragDelta = {
    x: event.clientX - dragStart.x,
    y: event.clientY - dragStart.y,
  };
  if (inDrag) {
    if (event.ctrlKey) {
      inRotation = true;
      inDrag = false;
      return;
    }
    camera.move(dragDelta);
  }
  if (inRotation) {
    if (!event.ctrlKey) {
      inRotation = false;
      inDrag = true;
      return;
    }
    camera.rotate(dragDelta);
  }
  dragStart = {
    x: event.clientX,
    y: event.clientY,
  };
}

function canvasDragEnd() {
  inDrag = false;
  inRotation = false;
}

function canvasZoom(event: WheelEvent) {
  event.preventDefault();
  camera.zoom(event.deltaY * 0.1);
}
