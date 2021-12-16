export function degreesToRadians(angle: number) {
  return (angle * Math.PI) / 180;
}

export function isPowerOf2(x: number) {
  return x != 0 && !(x & (x - 1));
}
