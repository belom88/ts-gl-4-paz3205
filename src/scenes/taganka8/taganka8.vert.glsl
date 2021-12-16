attribute vec3 aVertexPosition;
attribute vec4 aVertexColor;
attribute vec3 aVertexNormal;
attribute vec2 aVertexTexCoord;
uniform mat4 uModelViewMatrix;
uniform mat4 uProjectionMatrix;
varying vec3 vPosition;
varying vec4 vColor;
varying vec3 vNormal;
varying highp vec2 vTextureCoord;
void main(void) {
  vPosition = vec3( uModelViewMatrix * vec4(aVertexPosition, 1.0) );
  vNormal = vec3( uModelViewMatrix * vec4(aVertexNormal, 0.0) );
  vColor = aVertexColor;

  gl_Position = uProjectionMatrix * uModelViewMatrix * vec4(aVertexPosition, 1.0);
  vTextureCoord = aVertexTexCoord;
}
