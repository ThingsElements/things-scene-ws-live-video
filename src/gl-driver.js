// Shaders for accelerated WebGL YCbCrToRGBA conversion
const SHADER_FRAGMENT_YCBCRTORGBA = `
  precision mediump float;

  uniform sampler2D YTexture1;
  uniform sampler2D CBTexture1;
  uniform sampler2D CRTexture1;

  uniform sampler2D YTexture2;
  uniform sampler2D CBTexture2;
  uniform sampler2D CRTexture2;

  uniform sampler2D YTexture3;
  uniform sampler2D CBTexture3;
  uniform sampler2D CRTexture3;

  uniform sampler2D YTexture4;
  uniform sampler2D CBTexture4;
  uniform sampler2D CRTexture4;

  varying vec2 texCoord;

  vec4 fragcolor(sampler2D Y, sampler2D Cr, sampler2D Cb, vec2 uv) {
    float rotate_x = -0.0;
    float rotate_y = -0.0;

    float zoom = 1.0;

    /* zoom이 클수록 실질적으로 원본 이미지 상의 거리는 가까와지므로 zoom으로 나눔. */
    vec2 xy = vec2(uv.x - 0.5, uv.y - 0.5) / zoom;
    xy = vec2(xy.x - rotate_y, xy.y - rotate_x);

    /* 원점으로부터의 거리를 구함 */
    float r = sqrt(xy.x * xy.x + xy.y * xy.y);
    float rr = r * r;

    float k1 = 0.50;
    float k2 = 0.70;
    float k3 = 0.01;

    xy = xy / (1.0 + k1 * r + k2 * rr + k3 * rr * rr);

    /* 최종 가져올 포지션을 결정되면, 원점의 위치를 재조정함 */
    xy = vec2(xy.x + 0.5, xy.y + 0.5);

    float y = texture2D(Y, xy).r;
    float cr = texture2D(Cr, xy).r - 0.5;
    float cb = texture2D(Cb, xy).r - 0.5;

    return vec4(
      y + 1.4 * cr,
      y + -0.343 * cb - 0.711 * cr,
      y + 1.765 * cb,
      1.0
    );
  }

  void main() {

    vec2 uv;
    vec4 color;

    if(texCoord.x < 0.5) {
      if(texCoord.y < 0.5) {
        /* 화면의 상하를 바꾸기 위해서 y값을 1.0에서 빼줌. */
        uv = vec2(texCoord.x * 2.0, 1.0 - texCoord.y * 2.0);
        color = fragcolor(YTexture1, CRTexture1, CBTexture1, uv);
      } else {
        uv = vec2(texCoord.x * 2.0, 1.0 - (texCoord.y * 2.0 - 1.0));
        color = fragcolor(YTexture2, CRTexture2, CBTexture2, uv);
      }
    } else {
      if(texCoord.y < 0.5) {
        uv = vec2(texCoord.x * 2.0 - 1.0, 1.0 - texCoord.y * 2.0);
        color = fragcolor(YTexture3, CRTexture3, CBTexture3, uv);
      } else {
        uv = vec2(texCoord.x * 2.0 - 1.0, 1.0 - (texCoord.y * 2.0 - 1.0));
        color = fragcolor(YTexture4, CRTexture4, CBTexture4, uv);
      }
    }

    gl_FragColor = color;
  }
`

const SHADER_VERTEX_IDENTITY = `
  attribute vec2 vertex;
  varying vec2 texCoord;

  void main() {
    texCoord = vertex;
    gl_Position = vec4((vertex * 2.0 - 1.0) * vec2(1, -1), 0.0, 1.0);
  }
`

export default class GLDriver {
  constructor(width, height) {
    this.width = width
    this.height = height

    this.mbWidth = (this.width + 15) >> 4;
    this.codedWidth = this.mbWidth << 4;
    this.halfWidth = this.mbWidth << 3;

    this.canvas = document.createElement('canvas')

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl')
    if(!this.gl)
      throw new Error('WebGL not supported')

    this.initGL()
  }

  dispose() {
    this.canvas = null
    this.gl = null
  }

  createTexture(index, name) {
    var gl = this.gl;
    var texture = gl.createTexture();

    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.uniform1i(gl.getUniformLocation(this.program, name), index);

    return texture;
  }

  compileShader(type, source) {
    var gl = this.gl;
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if( !gl.getShaderParameter(shader, gl.COMPILE_STATUS) ) {
      throw new Error(gl.getShaderInfoLog(shader));
    }

    return shader;
  }

  renderFrameGL(buffer_Y1, buffer_Cr1, buffer_Cb1, buffer_Y2, buffer_Cr2, buffer_Cb2,
    buffer_Y3, buffer_Cr3, buffer_Cb3, buffer_Y4, buffer_Cr4, buffer_Cb4) {
    var gl = this.gl;

    // WebGL doesn't like Uint8ClampedArrays, so we have to create a Uint8Array view for
    // each plane
    var uint8Y1 = new Uint8Array(buffer_Y1),
      uint8Cr1 = new Uint8Array(buffer_Cr1),
      uint8Cb1 = new Uint8Array(buffer_Cb1),
      uint8Y2 = new Uint8Array(buffer_Y2),
      uint8Cr2 = new Uint8Array(buffer_Cr2),
      uint8Cb2 = new Uint8Array(buffer_Cb2),
      uint8Y3 = new Uint8Array(buffer_Y3),
      uint8Cr3 = new Uint8Array(buffer_Cr3),
      uint8Cb3 = new Uint8Array(buffer_Cb3),
      uint8Y4 = new Uint8Array(buffer_Y4),
      uint8Cr4 = new Uint8Array(buffer_Cr4),
      uint8Cb4 = new Uint8Array(buffer_Cb4);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.YTexture1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.codedWidth/2, this.height/2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Y1);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.CRTexture1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth/2, this.height/4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cr1);

    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, this.CBTexture1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth/2, this.height/4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cb1);

    gl.activeTexture(gl.TEXTURE3);
    gl.bindTexture(gl.TEXTURE_2D, this.YTexture2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.codedWidth/2, this.height/2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Y2);

    gl.activeTexture(gl.TEXTURE4);
    gl.bindTexture(gl.TEXTURE_2D, this.CRTexture2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth/2, this.height/4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cr2);

    gl.activeTexture(gl.TEXTURE5);
    gl.bindTexture(gl.TEXTURE_2D, this.CBTexture2);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth/2, this.height/4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cb2);

    gl.activeTexture(gl.TEXTURE6);
    gl.bindTexture(gl.TEXTURE_2D, this.YTexture3);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.codedWidth/2, this.height/2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Y3);

    gl.activeTexture(gl.TEXTURE7);
    gl.bindTexture(gl.TEXTURE_2D, this.CRTexture3);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth/2, this.height/4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cr3);

    gl.activeTexture(gl.TEXTURE8);
    gl.bindTexture(gl.TEXTURE_2D, this.CBTexture3);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth/2, this.height/4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cb3);

    gl.activeTexture(gl.TEXTURE9);
    gl.bindTexture(gl.TEXTURE_2D, this.YTexture4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.codedWidth/2, this.height/2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Y4);

    gl.activeTexture(gl.TEXTURE10);
    gl.bindTexture(gl.TEXTURE_2D, this.CRTexture4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth/2, this.height/4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cr4);

    gl.activeTexture(gl.TEXTURE11);
    gl.bindTexture(gl.TEXTURE_2D, this.CBTexture4);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth/2, this.height/4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cb4);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  initGL() {
    var gl = this.gl

    // init buffers
    this.buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);

    // The main YCbCrToRGBA Shader
    this.program = gl.createProgram();
    gl.attachShader(this.program, this.compileShader(gl.VERTEX_SHADER, SHADER_VERTEX_IDENTITY));
    gl.attachShader(this.program, this.compileShader(gl.FRAGMENT_SHADER, SHADER_FRAGMENT_YCBCRTORGBA));
    gl.linkProgram(this.program);

    if( !gl.getProgramParameter(this.program, gl.LINK_STATUS) ) {
      throw new Error(gl.getProgramInfoLog(this.program));
    }

    gl.useProgram(this.program);

    // setup textures
    this.YTexture1 = this.createTexture(0, 'YTexture1');
    this.CRTexture1 = this.createTexture(1, 'CRTexture1');
    this.CBTexture1 = this.createTexture(2, 'CBTexture1');

    this.YTexture2 = this.createTexture(3, 'YTexture2');
    this.CRTexture2 = this.createTexture(4, 'CRTexture2');
    this.CBTexture2 = this.createTexture(5, 'CBTexture2');

    this.YTexture3 = this.createTexture(6, 'YTexture3');
    this.CRTexture3 = this.createTexture(7, 'CRTexture3');
    this.CBTexture3 = this.createTexture(8, 'CBTexture3');

    this.YTexture4 = this.createTexture(9, 'YTexture4');
    this.CRTexture4 = this.createTexture(10, 'CRTexture4');
    this.CBTexture4 = this.createTexture(11, 'CBTexture4');

    var vertexAttr = gl.getAttribLocation(this.program, 'vertex');
    gl.enableVertexAttribArray(vertexAttr);
    gl.vertexAttribPointer(vertexAttr, 2, gl.FLOAT, false, 0, 0);

    gl.viewport(0, 0, this.width, this.height);

    return true;
  }
}
