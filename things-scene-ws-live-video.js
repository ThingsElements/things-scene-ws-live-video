(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// Shaders for accelerated WebGL YCbCrToRGBA conversion
var SHADER_FRAGMENT_YCBCRTORGBA = '\n  precision mediump float;\n\n  uniform sampler2D YTexture1;\n  uniform sampler2D CBTexture1;\n  uniform sampler2D CRTexture1;\n\n  uniform sampler2D YTexture2;\n  uniform sampler2D CBTexture2;\n  uniform sampler2D CRTexture2;\n\n  uniform sampler2D YTexture3;\n  uniform sampler2D CBTexture3;\n  uniform sampler2D CRTexture3;\n\n  uniform sampler2D YTexture4;\n  uniform sampler2D CBTexture4;\n  uniform sampler2D CRTexture4;\n\n  uniform vec3 control;\n\n  varying vec2 texCoord;\n\n  vec4 fragcolor(sampler2D Y, sampler2D Cr, sampler2D Cb, vec2 uv) {\n    float zoom = control.x;\n    float rotate_x = control.y;\n    float rotate_y = control.z;\n\n    /* zoom이 클수록 실질적으로 원본 이미지 상의 거리는 가까와지므로 zoom으로 나눔. */\n    vec2 xy = vec2(uv.x - 0.5, uv.y - 0.5) / zoom;\n    xy = vec2(xy.x - rotate_y, xy.y - rotate_x);\n\n    /* 원점으로부터의 거리를 구함 */\n    float r = sqrt(xy.x * xy.x + xy.y * xy.y);\n    float rr = r * r;\n\n    float k1 = 0.50;\n    float k2 = 0.70;\n    float k3 = 0.01;\n\n    xy = xy / (1.0 + k1 * r + k2 * rr + k3 * rr * rr);\n\n    /* 최종 가져올 포지션을 결정되면, 원점의 위치를 재조정함 */\n    xy = vec2(xy.x + 0.5, xy.y + 0.5);\n\n    float y = texture2D(Y, xy).r;\n    float cr = texture2D(Cr, xy).r - 0.5;\n    float cb = texture2D(Cb, xy).r - 0.5;\n\n    return vec4(\n      y + 1.4 * cr,\n      y + -0.343 * cb - 0.711 * cr,\n      y + 1.765 * cb,\n      1.0\n    );\n  }\n\n  void main() {\n\n    vec2 uv;\n    vec4 color;\n\n    if(texCoord.x < 0.5) {\n      if(texCoord.y < 0.5) {\n        /* 화면의 상하를 바꾸기 위해서 y값을 1.0에서 빼줌. */\n        uv = vec2(texCoord.x * 2.0, 1.0 - texCoord.y * 2.0);\n        color = fragcolor(YTexture1, CRTexture1, CBTexture1, uv);\n      } else {\n        uv = vec2(texCoord.x * 2.0, 1.0 - (texCoord.y * 2.0 - 1.0));\n        color = fragcolor(YTexture2, CRTexture2, CBTexture2, uv);\n      }\n    } else {\n      if(texCoord.y < 0.5) {\n        uv = vec2(texCoord.x * 2.0 - 1.0, 1.0 - texCoord.y * 2.0);\n        color = fragcolor(YTexture3, CRTexture3, CBTexture3, uv);\n      } else {\n        uv = vec2(texCoord.x * 2.0 - 1.0, 1.0 - (texCoord.y * 2.0 - 1.0));\n        color = fragcolor(YTexture4, CRTexture4, CBTexture4, uv);\n      }\n    }\n\n    gl_FragColor = color;\n  }\n';

var SHADER_VERTEX_IDENTITY = '\n  attribute vec2 vertex;\n  varying vec2 texCoord;\n\n  void main() {\n    texCoord = vertex;\n    gl_Position = vec4((vertex * 2.0 - 1.0) * vec2(1, -1), 0.0, 1.0);\n  }\n';

var GLDriver = function () {
  function GLDriver(width, height) {
    _classCallCheck(this, GLDriver);

    this.width = width;
    this.height = height;

    this.mbWidth = this.width + 15 >> 4;
    this.codedWidth = this.mbWidth << 4;
    this.halfWidth = this.mbWidth << 3;

    this.canvas = document.createElement('canvas');

    this.canvas.width = this.width;
    this.canvas.height = this.height;

    this._rotate_x = 0;
    this._rotate_y = 0;
    this._fov = 1.0;

    this.gl = this.canvas.getContext('webgl') || this.canvas.getContext('experimental-webgl');
    if (!this.gl) throw new Error('WebGL not supported');

    this.initGL();
  }

  _createClass(GLDriver, [{
    key: 'dispose',
    value: function dispose() {
      this.canvas = null;
      this.gl = null;
    }
  }, {
    key: 'createTexture',
    value: function createTexture(index, name) {
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
  }, {
    key: 'compileShader',
    value: function compileShader(type, source) {
      var gl = this.gl;
      var shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);

      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        throw new Error(gl.getShaderInfoLog(shader));
      }

      return shader;
    }
  }, {
    key: 'renderFrameGL',
    value: function renderFrameGL(buffer_Y1, buffer_Cr1, buffer_Cb1, buffer_Y2, buffer_Cr2, buffer_Cb2, buffer_Y3, buffer_Cr3, buffer_Cb3, buffer_Y4, buffer_Cr4, buffer_Cb4) {
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
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.codedWidth / 2, this.height / 2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Y1);

      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, this.CRTexture1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth / 2, this.height / 4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cr1);

      gl.activeTexture(gl.TEXTURE2);
      gl.bindTexture(gl.TEXTURE_2D, this.CBTexture1);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth / 2, this.height / 4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cb1);

      gl.activeTexture(gl.TEXTURE3);
      gl.bindTexture(gl.TEXTURE_2D, this.YTexture2);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.codedWidth / 2, this.height / 2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Y2);

      gl.activeTexture(gl.TEXTURE4);
      gl.bindTexture(gl.TEXTURE_2D, this.CRTexture2);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth / 2, this.height / 4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cr2);

      gl.activeTexture(gl.TEXTURE5);
      gl.bindTexture(gl.TEXTURE_2D, this.CBTexture2);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth / 2, this.height / 4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cb2);

      gl.activeTexture(gl.TEXTURE6);
      gl.bindTexture(gl.TEXTURE_2D, this.YTexture3);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.codedWidth / 2, this.height / 2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Y3);

      gl.activeTexture(gl.TEXTURE7);
      gl.bindTexture(gl.TEXTURE_2D, this.CRTexture3);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth / 2, this.height / 4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cr3);

      gl.activeTexture(gl.TEXTURE8);
      gl.bindTexture(gl.TEXTURE_2D, this.CBTexture3);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth / 2, this.height / 4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cb3);

      gl.activeTexture(gl.TEXTURE9);
      gl.bindTexture(gl.TEXTURE_2D, this.YTexture4);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.codedWidth / 2, this.height / 2, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Y4);

      gl.activeTexture(gl.TEXTURE10);
      gl.bindTexture(gl.TEXTURE_2D, this.CRTexture4);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth / 2, this.height / 4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cr4);

      gl.activeTexture(gl.TEXTURE11);
      gl.bindTexture(gl.TEXTURE_2D, this.CBTexture4);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, this.halfWidth / 2, this.height / 4, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, uint8Cb4);

      gl.uniform3f(this.controlLoc, this.fov, this.rotateX, this.rotateY);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
  }, {
    key: 'initGL',
    value: function initGL() {
      var gl = this.gl;

      // init buffers
      this.buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, this.buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([0, 0, 0, 1, 1, 0, 1, 1]), gl.STATIC_DRAW);

      // The main YCbCrToRGBA Shader
      this.program = gl.createProgram();
      gl.attachShader(this.program, this.compileShader(gl.VERTEX_SHADER, SHADER_VERTEX_IDENTITY));
      gl.attachShader(this.program, this.compileShader(gl.FRAGMENT_SHADER, SHADER_FRAGMENT_YCBCRTORGBA));
      gl.linkProgram(this.program);

      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
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

      this.controlLoc = gl.getUniformLocation(this.program, 'control');

      gl.viewport(0, 0, this.width, this.height);

      return true;
    }
  }, {
    key: 'fov',
    get: function get() {
      return this._fov;
    },
    set: function set(fov) {
      this._fov = fov;
    }
  }, {
    key: 'rotateX',
    get: function get() {
      return this._rotate_x;
    },
    set: function set(rotate_x) {
      this._rotate_x = rotate_x;
    }
  }, {
    key: 'rotateY',
    get: function get() {
      return this._rotate_y;
    },
    set: function set(rotate_y) {
      this._rotate_y = rotate_y;
    }
  }]);

  return GLDriver;
}();

exports.default = GLDriver;

},{}],2:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _wsLiveVideo = require('./ws-live-video');

Object.defineProperty(exports, 'WSLiveVideo', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_wsLiveVideo).default;
  }
});

var _ws4chVideo = require('./ws-4ch-video');

Object.defineProperty(exports, 'WSWideVideo', {
  enumerable: true,
  get: function get() {
    return _interopRequireDefault(_ws4chVideo).default;
  }
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

},{"./ws-4ch-video":6,"./ws-live-video":7}],3:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ----------------------------------------------------------------------------
// Bit Reader

var BitReader = function () {
  function BitReader(arrayBuffer) {
    _classCallCheck(this, BitReader);

    this.bytes = new Uint8Array(arrayBuffer);
    this.length = this.bytes.length;
    this.writePos = this.bytes.length;
    this.index = 0;
  }

  _createClass(BitReader, [{
    key: "findNextMPEGStartCode",
    value: function findNextMPEGStartCode() {
      for (var i = this.index + 7 >> 3; i < this.writePos; i++) {
        if (this.bytes[i] === 0x00 && this.bytes[i + 1] === 0x00 && this.bytes[i + 2] === 0x01) {
          this.index = i + 4 << 3;
          return this.bytes[i + 3];
        }
      }
      this.index = this.writePos << 3;
      return BitReader.NOT_FOUND;
    }
  }, {
    key: "nextBytesAreStartCode",
    value: function nextBytesAreStartCode() {
      var i = this.index + 7 >> 3;
      return i >= this.writePos || this.bytes[i] === 0x00 && this.bytes[i + 1] === 0x00 && this.bytes[i + 2] === 0x01;
    }
  }, {
    key: "nextBits",
    value: function nextBits(count) {
      var byteOffset = this.index >> 3,
          room = 8 - this.index % 8;

      if (room >= count) {
        return this.bytes[byteOffset] >> room - count & 0xff >> 8 - count;
      }

      var leftover = (this.index + count) % 8,
          // Leftover bits in last byte
      end = this.index + count - 1 >> 3,
          value = this.bytes[byteOffset] & 0xff >> 8 - room; // Fill out first byte

      for (byteOffset++; byteOffset < end; byteOffset++) {
        value <<= 8; // Shift and
        value |= this.bytes[byteOffset]; // Put next byte
      }

      if (leftover > 0) {
        value <<= leftover; // Make room for remaining bits
        value |= this.bytes[byteOffset] >> 8 - leftover;
      } else {
        value <<= 8;
        value |= this.bytes[byteOffset];
      }

      return value;
    }
  }, {
    key: "getBits",
    value: function getBits(count) {
      var value = this.nextBits(count);
      this.index += count;
      return value;
    }
  }, {
    key: "advance",
    value: function advance(count) {
      return this.index += count;
    }
  }, {
    key: "rewind",
    value: function rewind(count) {
      return this.index -= count;
    }
  }]);

  return BitReader;
}();

exports.default = BitReader;


BitReader.NOT_FOUND = -1;

},{}],4:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// ----------------------------------------------------------------------------
// VLC Tables and Constants

var DECODE_SKIP_OUTPUT = 1,
    PICTURE_RATE = [0.000, 23.976, 24.000, 25.000, 29.970, 30.000, 50.000, 59.940, 60.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000, 0.000],
    ZIG_ZAG = new Uint8Array([0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27, 20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58, 59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63]),
    DEFAULT_INTRA_QUANT_MATRIX = new Uint8Array([8, 16, 19, 22, 26, 27, 29, 34, 16, 16, 22, 24, 27, 29, 34, 37, 19, 22, 26, 27, 29, 34, 34, 38, 22, 22, 26, 27, 29, 34, 37, 40, 22, 26, 27, 29, 32, 35, 40, 48, 26, 27, 29, 32, 35, 40, 48, 58, 26, 27, 29, 34, 38, 46, 56, 69, 27, 29, 35, 38, 46, 56, 69, 83]),
    DEFAULT_NON_INTRA_QUANT_MATRIX = new Uint8Array([16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16]),
    PREMULTIPLIER_MATRIX = new Uint8Array([32, 44, 42, 38, 32, 25, 17, 9, 44, 62, 58, 52, 44, 35, 24, 12, 42, 58, 55, 49, 42, 33, 23, 12, 38, 52, 49, 44, 38, 30, 20, 10, 32, 44, 42, 38, 32, 25, 17, 9, 25, 35, 33, 30, 25, 20, 14, 7, 17, 24, 23, 20, 17, 14, 9, 5, 9, 12, 12, 10, 9, 7, 5, 2]),


// MPEG-1 VLC

//  macroblock_stuffing decodes as 34.
//  macroblock_escape decodes as 35.

MACROBLOCK_ADDRESS_INCREMENT = new Int16Array([1 * 3, 2 * 3, 0, //   0
3 * 3, 4 * 3, 0, //   1  0
0, 0, 1, //   2  1.
5 * 3, 6 * 3, 0, //   3  00
7 * 3, 8 * 3, 0, //   4  01
9 * 3, 10 * 3, 0, //   5  000
11 * 3, 12 * 3, 0, //   6  001
0, 0, 3, //   7  010.
0, 0, 2, //   8  011.
13 * 3, 14 * 3, 0, //   9  0000
15 * 3, 16 * 3, 0, //  10  0001
0, 0, 5, //  11  0010.
0, 0, 4, //  12  0011.
17 * 3, 18 * 3, 0, //  13  0000 0
19 * 3, 20 * 3, 0, //  14  0000 1
0, 0, 7, //  15  0001 0.
0, 0, 6, //  16  0001 1.
21 * 3, 22 * 3, 0, //  17  0000 00
23 * 3, 24 * 3, 0, //  18  0000 01
25 * 3, 26 * 3, 0, //  19  0000 10
27 * 3, 28 * 3, 0, //  20  0000 11
-1, 29 * 3, 0, //  21  0000 000
-1, 30 * 3, 0, //  22  0000 001
31 * 3, 32 * 3, 0, //  23  0000 010
33 * 3, 34 * 3, 0, //  24  0000 011
35 * 3, 36 * 3, 0, //  25  0000 100
37 * 3, 38 * 3, 0, //  26  0000 101
0, 0, 9, //  27  0000 110.
0, 0, 8, //  28  0000 111.
39 * 3, 40 * 3, 0, //  29  0000 0001
41 * 3, 42 * 3, 0, //  30  0000 0011
43 * 3, 44 * 3, 0, //  31  0000 0100
45 * 3, 46 * 3, 0, //  32  0000 0101
0, 0, 15, //  33  0000 0110.
0, 0, 14, //  34  0000 0111.
0, 0, 13, //  35  0000 1000.
0, 0, 12, //  36  0000 1001.
0, 0, 11, //  37  0000 1010.
0, 0, 10, //  38  0000 1011.
47 * 3, -1, 0, //  39  0000 0001 0
-1, 48 * 3, 0, //  40  0000 0001 1
49 * 3, 50 * 3, 0, //  41  0000 0011 0
51 * 3, 52 * 3, 0, //  42  0000 0011 1
53 * 3, 54 * 3, 0, //  43  0000 0100 0
55 * 3, 56 * 3, 0, //  44  0000 0100 1
57 * 3, 58 * 3, 0, //  45  0000 0101 0
59 * 3, 60 * 3, 0, //  46  0000 0101 1
61 * 3, -1, 0, //  47  0000 0001 00
-1, 62 * 3, 0, //  48  0000 0001 11
63 * 3, 64 * 3, 0, //  49  0000 0011 00
65 * 3, 66 * 3, 0, //  50  0000 0011 01
67 * 3, 68 * 3, 0, //  51  0000 0011 10
69 * 3, 70 * 3, 0, //  52  0000 0011 11
71 * 3, 72 * 3, 0, //  53  0000 0100 00
73 * 3, 74 * 3, 0, //  54  0000 0100 01
0, 0, 21, //  55  0000 0100 10.
0, 0, 20, //  56  0000 0100 11.
0, 0, 19, //  57  0000 0101 00.
0, 0, 18, //  58  0000 0101 01.
0, 0, 17, //  59  0000 0101 10.
0, 0, 16, //  60  0000 0101 11.
0, 0, 35, //  61  0000 0001 000. -- macroblock_escape
0, 0, 34, //  62  0000 0001 111. -- macroblock_stuffing
0, 0, 33, //  63  0000 0011 000.
0, 0, 32, //  64  0000 0011 001.
0, 0, 31, //  65  0000 0011 010.
0, 0, 30, //  66  0000 0011 011.
0, 0, 29, //  67  0000 0011 100.
0, 0, 28, //  68  0000 0011 101.
0, 0, 27, //  69  0000 0011 110.
0, 0, 26, //  70  0000 0011 111.
0, 0, 25, //  71  0000 0100 000.
0, 0, 24, //  72  0000 0100 001.
0, 0, 23, //  73  0000 0100 010.
0, 0, 22 //  74  0000 0100 011.
]),


//  macroblock_type bitmap:
//    0x10  macroblock_quant
//    0x08  macroblock_motion_forward
//    0x04  macroblock_motion_backward
//    0x02  macrobkock_pattern
//    0x01  macroblock_intra
//

MACROBLOCK_TYPE_I = new Int8Array([1 * 3, 2 * 3, 0, //   0
-1, 3 * 3, 0, //   1  0
0, 0, 0x01, //   2  1.
0, 0, 0x11 //   3  01.
]),
    MACROBLOCK_TYPE_P = new Int8Array([1 * 3, 2 * 3, 0, //  0
3 * 3, 4 * 3, 0, //  1  0
0, 0, 0x0a, //  2  1.
5 * 3, 6 * 3, 0, //  3  00
0, 0, 0x02, //  4  01.
7 * 3, 8 * 3, 0, //  5  000
0, 0, 0x08, //  6  001.
9 * 3, 10 * 3, 0, //  7  0000
11 * 3, 12 * 3, 0, //  8  0001
-1, 13 * 3, 0, //  9  00000
0, 0, 0x12, // 10  00001.
0, 0, 0x1a, // 11  00010.
0, 0, 0x01, // 12  00011.
0, 0, 0x11 // 13  000001.
]),
    MACROBLOCK_TYPE_B = new Int8Array([1 * 3, 2 * 3, 0, //  0
3 * 3, 5 * 3, 0, //  1  0
4 * 3, 6 * 3, 0, //  2  1
8 * 3, 7 * 3, 0, //  3  00
0, 0, 0x0c, //  4  10.
9 * 3, 10 * 3, 0, //  5  01
0, 0, 0x0e, //  6  11.
13 * 3, 14 * 3, 0, //  7  001
12 * 3, 11 * 3, 0, //  8  000
0, 0, 0x04, //  9  010.
0, 0, 0x06, // 10  011.
18 * 3, 16 * 3, 0, // 11  0001
15 * 3, 17 * 3, 0, // 12  0000
0, 0, 0x08, // 13  0010.
0, 0, 0x0a, // 14  0011.
-1, 19 * 3, 0, // 15  00000
0, 0, 0x01, // 16  00011.
20 * 3, 21 * 3, 0, // 17  00001
0, 0, 0x1e, // 18  00010.
0, 0, 0x11, // 19  000001.
0, 0, 0x16, // 20  000010.
0, 0, 0x1a // 21  000011.
]),
    CODE_BLOCK_PATTERN = new Int16Array([2 * 3, 1 * 3, 0, //   0
3 * 3, 6 * 3, 0, //   1  1
4 * 3, 5 * 3, 0, //   2  0
8 * 3, 11 * 3, 0, //   3  10
12 * 3, 13 * 3, 0, //   4  00
9 * 3, 7 * 3, 0, //   5  01
10 * 3, 14 * 3, 0, //   6  11
20 * 3, 19 * 3, 0, //   7  011
18 * 3, 16 * 3, 0, //   8  100
23 * 3, 17 * 3, 0, //   9  010
27 * 3, 25 * 3, 0, //  10  110
21 * 3, 28 * 3, 0, //  11  101
15 * 3, 22 * 3, 0, //  12  000
24 * 3, 26 * 3, 0, //  13  001
0, 0, 60, //  14  111.
35 * 3, 40 * 3, 0, //  15  0000
44 * 3, 48 * 3, 0, //  16  1001
38 * 3, 36 * 3, 0, //  17  0101
42 * 3, 47 * 3, 0, //  18  1000
29 * 3, 31 * 3, 0, //  19  0111
39 * 3, 32 * 3, 0, //  20  0110
0, 0, 32, //  21  1010.
45 * 3, 46 * 3, 0, //  22  0001
33 * 3, 41 * 3, 0, //  23  0100
43 * 3, 34 * 3, 0, //  24  0010
0, 0, 4, //  25  1101.
30 * 3, 37 * 3, 0, //  26  0011
0, 0, 8, //  27  1100.
0, 0, 16, //  28  1011.
0, 0, 44, //  29  0111 0.
50 * 3, 56 * 3, 0, //  30  0011 0
0, 0, 28, //  31  0111 1.
0, 0, 52, //  32  0110 1.
0, 0, 62, //  33  0100 0.
61 * 3, 59 * 3, 0, //  34  0010 1
52 * 3, 60 * 3, 0, //  35  0000 0
0, 0, 1, //  36  0101 1.
55 * 3, 54 * 3, 0, //  37  0011 1
0, 0, 61, //  38  0101 0.
0, 0, 56, //  39  0110 0.
57 * 3, 58 * 3, 0, //  40  0000 1
0, 0, 2, //  41  0100 1.
0, 0, 40, //  42  1000 0.
51 * 3, 62 * 3, 0, //  43  0010 0
0, 0, 48, //  44  1001 0.
64 * 3, 63 * 3, 0, //  45  0001 0
49 * 3, 53 * 3, 0, //  46  0001 1
0, 0, 20, //  47  1000 1.
0, 0, 12, //  48  1001 1.
80 * 3, 83 * 3, 0, //  49  0001 10
0, 0, 63, //  50  0011 00.
77 * 3, 75 * 3, 0, //  51  0010 00
65 * 3, 73 * 3, 0, //  52  0000 00
84 * 3, 66 * 3, 0, //  53  0001 11
0, 0, 24, //  54  0011 11.
0, 0, 36, //  55  0011 10.
0, 0, 3, //  56  0011 01.
69 * 3, 87 * 3, 0, //  57  0000 10
81 * 3, 79 * 3, 0, //  58  0000 11
68 * 3, 71 * 3, 0, //  59  0010 11
70 * 3, 78 * 3, 0, //  60  0000 01
67 * 3, 76 * 3, 0, //  61  0010 10
72 * 3, 74 * 3, 0, //  62  0010 01
86 * 3, 85 * 3, 0, //  63  0001 01
88 * 3, 82 * 3, 0, //  64  0001 00
-1, 94 * 3, 0, //  65  0000 000
95 * 3, 97 * 3, 0, //  66  0001 111
0, 0, 33, //  67  0010 100.
0, 0, 9, //  68  0010 110.
106 * 3, 110 * 3, 0, //  69  0000 100
102 * 3, 116 * 3, 0, //  70  0000 010
0, 0, 5, //  71  0010 111.
0, 0, 10, //  72  0010 010.
93 * 3, 89 * 3, 0, //  73  0000 001
0, 0, 6, //  74  0010 011.
0, 0, 18, //  75  0010 001.
0, 0, 17, //  76  0010 101.
0, 0, 34, //  77  0010 000.
113 * 3, 119 * 3, 0, //  78  0000 011
103 * 3, 104 * 3, 0, //  79  0000 111
90 * 3, 92 * 3, 0, //  80  0001 100
109 * 3, 107 * 3, 0, //  81  0000 110
117 * 3, 118 * 3, 0, //  82  0001 001
101 * 3, 99 * 3, 0, //  83  0001 101
98 * 3, 96 * 3, 0, //  84  0001 110
100 * 3, 91 * 3, 0, //  85  0001 011
114 * 3, 115 * 3, 0, //  86  0001 010
105 * 3, 108 * 3, 0, //  87  0000 101
112 * 3, 111 * 3, 0, //  88  0001 000
121 * 3, 125 * 3, 0, //  89  0000 0011
0, 0, 41, //  90  0001 1000.
0, 0, 14, //  91  0001 0111.
0, 0, 21, //  92  0001 1001.
124 * 3, 122 * 3, 0, //  93  0000 0010
120 * 3, 123 * 3, 0, //  94  0000 0001
0, 0, 11, //  95  0001 1110.
0, 0, 19, //  96  0001 1101.
0, 0, 7, //  97  0001 1111.
0, 0, 35, //  98  0001 1100.
0, 0, 13, //  99  0001 1011.
0, 0, 50, // 100  0001 0110.
0, 0, 49, // 101  0001 1010.
0, 0, 58, // 102  0000 0100.
0, 0, 37, // 103  0000 1110.
0, 0, 25, // 104  0000 1111.
0, 0, 45, // 105  0000 1010.
0, 0, 57, // 106  0000 1000.
0, 0, 26, // 107  0000 1101.
0, 0, 29, // 108  0000 1011.
0, 0, 38, // 109  0000 1100.
0, 0, 53, // 110  0000 1001.
0, 0, 23, // 111  0001 0001.
0, 0, 43, // 112  0001 0000.
0, 0, 46, // 113  0000 0110.
0, 0, 42, // 114  0001 0100.
0, 0, 22, // 115  0001 0101.
0, 0, 54, // 116  0000 0101.
0, 0, 51, // 117  0001 0010.
0, 0, 15, // 118  0001 0011.
0, 0, 30, // 119  0000 0111.
0, 0, 39, // 120  0000 0001 0.
0, 0, 47, // 121  0000 0011 0.
0, 0, 55, // 122  0000 0010 1.
0, 0, 27, // 123  0000 0001 1.
0, 0, 59, // 124  0000 0010 0.
0, 0, 31 // 125  0000 0011 1.
]),
    MOTION = new Int16Array([1 * 3, 2 * 3, 0, //   0
4 * 3, 3 * 3, 0, //   1  0
0, 0, 0, //   2  1.
6 * 3, 5 * 3, 0, //   3  01
8 * 3, 7 * 3, 0, //   4  00
0, 0, -1, //   5  011.
0, 0, 1, //   6  010.
9 * 3, 10 * 3, 0, //   7  001
12 * 3, 11 * 3, 0, //   8  000
0, 0, 2, //   9  0010.
0, 0, -2, //  10  0011.
14 * 3, 15 * 3, 0, //  11  0001
16 * 3, 13 * 3, 0, //  12  0000
20 * 3, 18 * 3, 0, //  13  0000 1
0, 0, 3, //  14  0001 0.
0, 0, -3, //  15  0001 1.
17 * 3, 19 * 3, 0, //  16  0000 0
-1, 23 * 3, 0, //  17  0000 00
27 * 3, 25 * 3, 0, //  18  0000 11
26 * 3, 21 * 3, 0, //  19  0000 01
24 * 3, 22 * 3, 0, //  20  0000 10
32 * 3, 28 * 3, 0, //  21  0000 011
29 * 3, 31 * 3, 0, //  22  0000 101
-1, 33 * 3, 0, //  23  0000 001
36 * 3, 35 * 3, 0, //  24  0000 100
0, 0, -4, //  25  0000 111.
30 * 3, 34 * 3, 0, //  26  0000 010
0, 0, 4, //  27  0000 110.
0, 0, -7, //  28  0000 0111.
0, 0, 5, //  29  0000 1010.
37 * 3, 41 * 3, 0, //  30  0000 0100
0, 0, -5, //  31  0000 1011.
0, 0, 7, //  32  0000 0110.
38 * 3, 40 * 3, 0, //  33  0000 0011
42 * 3, 39 * 3, 0, //  34  0000 0101
0, 0, -6, //  35  0000 1001.
0, 0, 6, //  36  0000 1000.
51 * 3, 54 * 3, 0, //  37  0000 0100 0
50 * 3, 49 * 3, 0, //  38  0000 0011 0
45 * 3, 46 * 3, 0, //  39  0000 0101 1
52 * 3, 47 * 3, 0, //  40  0000 0011 1
43 * 3, 53 * 3, 0, //  41  0000 0100 1
44 * 3, 48 * 3, 0, //  42  0000 0101 0
0, 0, 10, //  43  0000 0100 10.
0, 0, 9, //  44  0000 0101 00.
0, 0, 8, //  45  0000 0101 10.
0, 0, -8, //  46  0000 0101 11.
57 * 3, 66 * 3, 0, //  47  0000 0011 11
0, 0, -9, //  48  0000 0101 01.
60 * 3, 64 * 3, 0, //  49  0000 0011 01
56 * 3, 61 * 3, 0, //  50  0000 0011 00
55 * 3, 62 * 3, 0, //  51  0000 0100 00
58 * 3, 63 * 3, 0, //  52  0000 0011 10
0, 0, -10, //  53  0000 0100 11.
59 * 3, 65 * 3, 0, //  54  0000 0100 01
0, 0, 12, //  55  0000 0100 000.
0, 0, 16, //  56  0000 0011 000.
0, 0, 13, //  57  0000 0011 110.
0, 0, 14, //  58  0000 0011 100.
0, 0, 11, //  59  0000 0100 010.
0, 0, 15, //  60  0000 0011 010.
0, 0, -16, //  61  0000 0011 001.
0, 0, -12, //  62  0000 0100 001.
0, 0, -14, //  63  0000 0011 101.
0, 0, -15, //  64  0000 0011 011.
0, 0, -11, //  65  0000 0100 011.
0, 0, -13 //  66  0000 0011 111.
]),
    DCT_DC_SIZE_LUMINANCE = new Int8Array([2 * 3, 1 * 3, 0, //   0
6 * 3, 5 * 3, 0, //   1  1
3 * 3, 4 * 3, 0, //   2  0
0, 0, 1, //   3  00.
0, 0, 2, //   4  01.
9 * 3, 8 * 3, 0, //   5  11
7 * 3, 10 * 3, 0, //   6  10
0, 0, 0, //   7  100.
12 * 3, 11 * 3, 0, //   8  111
0, 0, 4, //   9  110.
0, 0, 3, //  10  101.
13 * 3, 14 * 3, 0, //  11  1111
0, 0, 5, //  12  1110.
0, 0, 6, //  13  1111 0.
16 * 3, 15 * 3, 0, //  14  1111 1
17 * 3, -1, 0, //  15  1111 11
0, 0, 7, //  16  1111 10.
0, 0, 8 //  17  1111 110.
]),
    DCT_DC_SIZE_CHROMINANCE = new Int8Array([2 * 3, 1 * 3, 0, //   0
4 * 3, 3 * 3, 0, //   1  1
6 * 3, 5 * 3, 0, //   2  0
8 * 3, 7 * 3, 0, //   3  11
0, 0, 2, //   4  10.
0, 0, 1, //   5  01.
0, 0, 0, //   6  00.
10 * 3, 9 * 3, 0, //   7  111
0, 0, 3, //   8  110.
12 * 3, 11 * 3, 0, //   9  1111
0, 0, 4, //  10  1110.
14 * 3, 13 * 3, 0, //  11  1111 1
0, 0, 5, //  12  1111 0.
16 * 3, 15 * 3, 0, //  13  1111 11
0, 0, 6, //  14  1111 10.
17 * 3, -1, 0, //  15  1111 111
0, 0, 7, //  16  1111 110.
0, 0, 8 //  17  1111 1110.
]),


//  dct_coeff bitmap:
//    0xff00  run
//    0x00ff  level

//  Decoded values are unsigned. Sign bit follows in the stream.

//  Interpretation of the value 0x0001
//    for dc_coeff_first:  run=0, level=1
//    for dc_coeff_next:   If the next bit is 1: run=0, level=1
//                         If the next bit is 0: end_of_block

//  escape decodes as 0xffff.

DCT_COEFF = new Int32Array([1 * 3, 2 * 3, 0, //   0
4 * 3, 3 * 3, 0, //   1  0
0, 0, 0x0001, //   2  1.
7 * 3, 8 * 3, 0, //   3  01
6 * 3, 5 * 3, 0, //   4  00
13 * 3, 9 * 3, 0, //   5  001
11 * 3, 10 * 3, 0, //   6  000
14 * 3, 12 * 3, 0, //   7  010
0, 0, 0x0101, //   8  011.
20 * 3, 22 * 3, 0, //   9  0011
18 * 3, 21 * 3, 0, //  10  0001
16 * 3, 19 * 3, 0, //  11  0000
0, 0, 0x0201, //  12  0101.
17 * 3, 15 * 3, 0, //  13  0010
0, 0, 0x0002, //  14  0100.
0, 0, 0x0003, //  15  0010 1.
27 * 3, 25 * 3, 0, //  16  0000 0
29 * 3, 31 * 3, 0, //  17  0010 0
24 * 3, 26 * 3, 0, //  18  0001 0
32 * 3, 30 * 3, 0, //  19  0000 1
0, 0, 0x0401, //  20  0011 0.
23 * 3, 28 * 3, 0, //  21  0001 1
0, 0, 0x0301, //  22  0011 1.
0, 0, 0x0102, //  23  0001 10.
0, 0, 0x0701, //  24  0001 00.
0, 0, 0xffff, //  25  0000 01. -- escape
0, 0, 0x0601, //  26  0001 01.
37 * 3, 36 * 3, 0, //  27  0000 00
0, 0, 0x0501, //  28  0001 11.
35 * 3, 34 * 3, 0, //  29  0010 00
39 * 3, 38 * 3, 0, //  30  0000 11
33 * 3, 42 * 3, 0, //  31  0010 01
40 * 3, 41 * 3, 0, //  32  0000 10
52 * 3, 50 * 3, 0, //  33  0010 010
54 * 3, 53 * 3, 0, //  34  0010 001
48 * 3, 49 * 3, 0, //  35  0010 000
43 * 3, 45 * 3, 0, //  36  0000 001
46 * 3, 44 * 3, 0, //  37  0000 000
0, 0, 0x0801, //  38  0000 111.
0, 0, 0x0004, //  39  0000 110.
0, 0, 0x0202, //  40  0000 100.
0, 0, 0x0901, //  41  0000 101.
51 * 3, 47 * 3, 0, //  42  0010 011
55 * 3, 57 * 3, 0, //  43  0000 0010
60 * 3, 56 * 3, 0, //  44  0000 0001
59 * 3, 58 * 3, 0, //  45  0000 0011
61 * 3, 62 * 3, 0, //  46  0000 0000
0, 0, 0x0a01, //  47  0010 0111.
0, 0, 0x0d01, //  48  0010 0000.
0, 0, 0x0006, //  49  0010 0001.
0, 0, 0x0103, //  50  0010 0101.
0, 0, 0x0005, //  51  0010 0110.
0, 0, 0x0302, //  52  0010 0100.
0, 0, 0x0b01, //  53  0010 0011.
0, 0, 0x0c01, //  54  0010 0010.
76 * 3, 75 * 3, 0, //  55  0000 0010 0
67 * 3, 70 * 3, 0, //  56  0000 0001 1
73 * 3, 71 * 3, 0, //  57  0000 0010 1
78 * 3, 74 * 3, 0, //  58  0000 0011 1
72 * 3, 77 * 3, 0, //  59  0000 0011 0
69 * 3, 64 * 3, 0, //  60  0000 0001 0
68 * 3, 63 * 3, 0, //  61  0000 0000 0
66 * 3, 65 * 3, 0, //  62  0000 0000 1
81 * 3, 87 * 3, 0, //  63  0000 0000 01
91 * 3, 80 * 3, 0, //  64  0000 0001 01
82 * 3, 79 * 3, 0, //  65  0000 0000 11
83 * 3, 86 * 3, 0, //  66  0000 0000 10
93 * 3, 92 * 3, 0, //  67  0000 0001 10
84 * 3, 85 * 3, 0, //  68  0000 0000 00
90 * 3, 94 * 3, 0, //  69  0000 0001 00
88 * 3, 89 * 3, 0, //  70  0000 0001 11
0, 0, 0x0203, //  71  0000 0010 11.
0, 0, 0x0104, //  72  0000 0011 00.
0, 0, 0x0007, //  73  0000 0010 10.
0, 0, 0x0402, //  74  0000 0011 11.
0, 0, 0x0502, //  75  0000 0010 01.
0, 0, 0x1001, //  76  0000 0010 00.
0, 0, 0x0f01, //  77  0000 0011 01.
0, 0, 0x0e01, //  78  0000 0011 10.
105 * 3, 107 * 3, 0, //  79  0000 0000 111
111 * 3, 114 * 3, 0, //  80  0000 0001 011
104 * 3, 97 * 3, 0, //  81  0000 0000 010
125 * 3, 119 * 3, 0, //  82  0000 0000 110
96 * 3, 98 * 3, 0, //  83  0000 0000 100
-1, 123 * 3, 0, //  84  0000 0000 000
95 * 3, 101 * 3, 0, //  85  0000 0000 001
106 * 3, 121 * 3, 0, //  86  0000 0000 101
99 * 3, 102 * 3, 0, //  87  0000 0000 011
113 * 3, 103 * 3, 0, //  88  0000 0001 110
112 * 3, 116 * 3, 0, //  89  0000 0001 111
110 * 3, 100 * 3, 0, //  90  0000 0001 000
124 * 3, 115 * 3, 0, //  91  0000 0001 010
117 * 3, 122 * 3, 0, //  92  0000 0001 101
109 * 3, 118 * 3, 0, //  93  0000 0001 100
120 * 3, 108 * 3, 0, //  94  0000 0001 001
127 * 3, 136 * 3, 0, //  95  0000 0000 0010
139 * 3, 140 * 3, 0, //  96  0000 0000 1000
130 * 3, 126 * 3, 0, //  97  0000 0000 0101
145 * 3, 146 * 3, 0, //  98  0000 0000 1001
128 * 3, 129 * 3, 0, //  99  0000 0000 0110
0, 0, 0x0802, // 100  0000 0001 0001.
132 * 3, 134 * 3, 0, // 101  0000 0000 0011
155 * 3, 154 * 3, 0, // 102  0000 0000 0111
0, 0, 0x0008, // 103  0000 0001 1101.
137 * 3, 133 * 3, 0, // 104  0000 0000 0100
143 * 3, 144 * 3, 0, // 105  0000 0000 1110
151 * 3, 138 * 3, 0, // 106  0000 0000 1010
142 * 3, 141 * 3, 0, // 107  0000 0000 1111
0, 0, 0x000a, // 108  0000 0001 0011.
0, 0, 0x0009, // 109  0000 0001 1000.
0, 0, 0x000b, // 110  0000 0001 0000.
0, 0, 0x1501, // 111  0000 0001 0110.
0, 0, 0x0602, // 112  0000 0001 1110.
0, 0, 0x0303, // 113  0000 0001 1100.
0, 0, 0x1401, // 114  0000 0001 0111.
0, 0, 0x0702, // 115  0000 0001 0101.
0, 0, 0x1101, // 116  0000 0001 1111.
0, 0, 0x1201, // 117  0000 0001 1010.
0, 0, 0x1301, // 118  0000 0001 1001.
148 * 3, 152 * 3, 0, // 119  0000 0000 1101
0, 0, 0x0403, // 120  0000 0001 0010.
153 * 3, 150 * 3, 0, // 121  0000 0000 1011
0, 0, 0x0105, // 122  0000 0001 1011.
131 * 3, 135 * 3, 0, // 123  0000 0000 0001
0, 0, 0x0204, // 124  0000 0001 0100.
149 * 3, 147 * 3, 0, // 125  0000 0000 1100
172 * 3, 173 * 3, 0, // 126  0000 0000 0101 1
162 * 3, 158 * 3, 0, // 127  0000 0000 0010 0
170 * 3, 161 * 3, 0, // 128  0000 0000 0110 0
168 * 3, 166 * 3, 0, // 129  0000 0000 0110 1
157 * 3, 179 * 3, 0, // 130  0000 0000 0101 0
169 * 3, 167 * 3, 0, // 131  0000 0000 0001 0
174 * 3, 171 * 3, 0, // 132  0000 0000 0011 0
178 * 3, 177 * 3, 0, // 133  0000 0000 0100 1
156 * 3, 159 * 3, 0, // 134  0000 0000 0011 1
164 * 3, 165 * 3, 0, // 135  0000 0000 0001 1
183 * 3, 182 * 3, 0, // 136  0000 0000 0010 1
175 * 3, 176 * 3, 0, // 137  0000 0000 0100 0
0, 0, 0x0107, // 138  0000 0000 1010 1.
0, 0, 0x0a02, // 139  0000 0000 1000 0.
0, 0, 0x0902, // 140  0000 0000 1000 1.
0, 0, 0x1601, // 141  0000 0000 1111 1.
0, 0, 0x1701, // 142  0000 0000 1111 0.
0, 0, 0x1901, // 143  0000 0000 1110 0.
0, 0, 0x1801, // 144  0000 0000 1110 1.
0, 0, 0x0503, // 145  0000 0000 1001 0.
0, 0, 0x0304, // 146  0000 0000 1001 1.
0, 0, 0x000d, // 147  0000 0000 1100 1.
0, 0, 0x000c, // 148  0000 0000 1101 0.
0, 0, 0x000e, // 149  0000 0000 1100 0.
0, 0, 0x000f, // 150  0000 0000 1011 1.
0, 0, 0x0205, // 151  0000 0000 1010 0.
0, 0, 0x1a01, // 152  0000 0000 1101 1.
0, 0, 0x0106, // 153  0000 0000 1011 0.
180 * 3, 181 * 3, 0, // 154  0000 0000 0111 1
160 * 3, 163 * 3, 0, // 155  0000 0000 0111 0
196 * 3, 199 * 3, 0, // 156  0000 0000 0011 10
0, 0, 0x001b, // 157  0000 0000 0101 00.
203 * 3, 185 * 3, 0, // 158  0000 0000 0010 01
202 * 3, 201 * 3, 0, // 159  0000 0000 0011 11
0, 0, 0x0013, // 160  0000 0000 0111 00.
0, 0, 0x0016, // 161  0000 0000 0110 01.
197 * 3, 207 * 3, 0, // 162  0000 0000 0010 00
0, 0, 0x0012, // 163  0000 0000 0111 01.
191 * 3, 192 * 3, 0, // 164  0000 0000 0001 10
188 * 3, 190 * 3, 0, // 165  0000 0000 0001 11
0, 0, 0x0014, // 166  0000 0000 0110 11.
184 * 3, 194 * 3, 0, // 167  0000 0000 0001 01
0, 0, 0x0015, // 168  0000 0000 0110 10.
186 * 3, 193 * 3, 0, // 169  0000 0000 0001 00
0, 0, 0x0017, // 170  0000 0000 0110 00.
204 * 3, 198 * 3, 0, // 171  0000 0000 0011 01
0, 0, 0x0019, // 172  0000 0000 0101 10.
0, 0, 0x0018, // 173  0000 0000 0101 11.
200 * 3, 205 * 3, 0, // 174  0000 0000 0011 00
0, 0, 0x001f, // 175  0000 0000 0100 00.
0, 0, 0x001e, // 176  0000 0000 0100 01.
0, 0, 0x001c, // 177  0000 0000 0100 11.
0, 0, 0x001d, // 178  0000 0000 0100 10.
0, 0, 0x001a, // 179  0000 0000 0101 01.
0, 0, 0x0011, // 180  0000 0000 0111 10.
0, 0, 0x0010, // 181  0000 0000 0111 11.
189 * 3, 206 * 3, 0, // 182  0000 0000 0010 11
187 * 3, 195 * 3, 0, // 183  0000 0000 0010 10
218 * 3, 211 * 3, 0, // 184  0000 0000 0001 010
0, 0, 0x0025, // 185  0000 0000 0010 011.
215 * 3, 216 * 3, 0, // 186  0000 0000 0001 000
0, 0, 0x0024, // 187  0000 0000 0010 100.
210 * 3, 212 * 3, 0, // 188  0000 0000 0001 110
0, 0, 0x0022, // 189  0000 0000 0010 110.
213 * 3, 209 * 3, 0, // 190  0000 0000 0001 111
221 * 3, 222 * 3, 0, // 191  0000 0000 0001 100
219 * 3, 208 * 3, 0, // 192  0000 0000 0001 101
217 * 3, 214 * 3, 0, // 193  0000 0000 0001 001
223 * 3, 220 * 3, 0, // 194  0000 0000 0001 011
0, 0, 0x0023, // 195  0000 0000 0010 101.
0, 0, 0x010b, // 196  0000 0000 0011 100.
0, 0, 0x0028, // 197  0000 0000 0010 000.
0, 0, 0x010c, // 198  0000 0000 0011 011.
0, 0, 0x010a, // 199  0000 0000 0011 101.
0, 0, 0x0020, // 200  0000 0000 0011 000.
0, 0, 0x0108, // 201  0000 0000 0011 111.
0, 0, 0x0109, // 202  0000 0000 0011 110.
0, 0, 0x0026, // 203  0000 0000 0010 010.
0, 0, 0x010d, // 204  0000 0000 0011 010.
0, 0, 0x010e, // 205  0000 0000 0011 001.
0, 0, 0x0021, // 206  0000 0000 0010 111.
0, 0, 0x0027, // 207  0000 0000 0010 001.
0, 0, 0x1f01, // 208  0000 0000 0001 1011.
0, 0, 0x1b01, // 209  0000 0000 0001 1111.
0, 0, 0x1e01, // 210  0000 0000 0001 1100.
0, 0, 0x1002, // 211  0000 0000 0001 0101.
0, 0, 0x1d01, // 212  0000 0000 0001 1101.
0, 0, 0x1c01, // 213  0000 0000 0001 1110.
0, 0, 0x010f, // 214  0000 0000 0001 0011.
0, 0, 0x0112, // 215  0000 0000 0001 0000.
0, 0, 0x0111, // 216  0000 0000 0001 0001.
0, 0, 0x0110, // 217  0000 0000 0001 0010.
0, 0, 0x0603, // 218  0000 0000 0001 0100.
0, 0, 0x0b02, // 219  0000 0000 0001 1010.
0, 0, 0x0e02, // 220  0000 0000 0001 0111.
0, 0, 0x0d02, // 221  0000 0000 0001 1000.
0, 0, 0x0c02, // 222  0000 0000 0001 1001.
0, 0, 0x0f02 // 223  0000 0000 0001 0110.
]),
    PICTURE_TYPE_I = 1,
    PICTURE_TYPE_P = 2,
    PICTURE_TYPE_B = 3,
    START_SEQUENCE = 0xB3,
    START_SLICE_FIRST = 0x01,
    START_SLICE_LAST = 0xAF,
    START_EXTENSION = 0xB5,
    START_USER_DATA = 0xB2,
    MACROBLOCK_TYPE_TABLES = [null, MACROBLOCK_TYPE_I, MACROBLOCK_TYPE_P, MACROBLOCK_TYPE_B];

var MpegDecoder = function () {
  function MpegDecoder(buffer, width, height) {
    _classCallCheck(this, MpegDecoder);

    this.buffer = buffer;
    this.width = width;
    this.height = height;

    this.macroblockAddress = 0;
    this.mbRow = 0;
    this.mbCol = 0;

    this.macroblockType = 0;
    this.macroblockIntra = false;
    this.macroblockMotFw = false;

    this.motionFwH = 0;
    this.motionFwV = 0;
    this.motionFwHPrev = 0;
    this.motionFwVPrev = 0;

    this.quantizerScale = 0;
    this.sliceBegin = false;

    this.blockData = new Int32Array(64);
    this.zeroBlockData = new Int32Array(64);
    this.fillArray(this.zeroBlockData, 0);

    this.intraQuantMatrix = DEFAULT_INTRA_QUANT_MATRIX;
    this.nonIntraQuantMatrix = DEFAULT_NON_INTRA_QUANT_MATRIX;

    this.mbWidth = this.width + 15 >> 4;
    this.mbHeight = this.height + 15 >> 4;
    this.mbSize = this.mbWidth * this.mbHeight;

    this.codedWidth = this.mbWidth << 4;
    this.codedHeight = this.mbHeight << 4;
    this.codedSize = this.codedWidth * this.codedHeight;

    this.halfWidth = this.mbWidth << 3;

    // Manually clamp values when writing macroblocks for shitty browsers
    // that don't support Uint8ClampedArray
    var MaybeClampedUint8Array = window.Uint8ClampedArray || window.Uint8Array;
    if (!window.Uint8ClampedArray) {
      this.copyBlockToDestination = this.copyBlockToDestinationClamp;
      this.addBlockToDestination = this.addBlockToDestinationClamp;
    }

    // Allocated buffers and resize the canvas
    this.currentY = new MaybeClampedUint8Array(this.codedSize);
    this.currentY32 = new Uint32Array(this.currentY.buffer);

    this.currentCr = new MaybeClampedUint8Array(this.codedSize >> 2);
    this.currentCr32 = new Uint32Array(this.currentCr.buffer);

    this.currentCb = new MaybeClampedUint8Array(this.codedSize >> 2);
    this.currentCb32 = new Uint32Array(this.currentCb.buffer);

    this.forwardY = new MaybeClampedUint8Array(this.codedSize);
    this.forwardY32 = new Uint32Array(this.forwardY.buffer);

    this.forwardCr = new MaybeClampedUint8Array(this.codedSize >> 2);
    this.forwardCr32 = new Uint32Array(this.forwardCr.buffer);

    this.forwardCb = new MaybeClampedUint8Array(this.codedSize >> 2);
    this.forwardCb32 = new Uint32Array(this.forwardCb.buffer);
  }

  _createClass(MpegDecoder, [{
    key: "fillArray",
    value: function fillArray(a, value) {
      for (var i = 0, length = a.length; i < length; i++) {
        a[i] = value;
      }
    }
  }, {
    key: "readCode",
    value: function readCode(codeTable) {
      var state = 0;
      do {
        state = codeTable[state + this.buffer.getBits(1)];
      } while (state >= 0 && codeTable[state] !== 0);
      return codeTable[state + 2];
    }
  }, {
    key: "copyBlockToDestination",
    value: function copyBlockToDestination(blockData, destArray, destIndex, scan) {
      for (var n = 0; n < 64; n += 8, destIndex += scan + 8) {
        destArray[destIndex + 0] = blockData[n + 0];
        destArray[destIndex + 1] = blockData[n + 1];
        destArray[destIndex + 2] = blockData[n + 2];
        destArray[destIndex + 3] = blockData[n + 3];
        destArray[destIndex + 4] = blockData[n + 4];
        destArray[destIndex + 5] = blockData[n + 5];
        destArray[destIndex + 6] = blockData[n + 6];
        destArray[destIndex + 7] = blockData[n + 7];
      }
    }
  }, {
    key: "addBlockToDestination",
    value: function addBlockToDestination(blockData, destArray, destIndex, scan) {
      for (var n = 0; n < 64; n += 8, destIndex += scan + 8) {
        destArray[destIndex + 0] += blockData[n + 0];
        destArray[destIndex + 1] += blockData[n + 1];
        destArray[destIndex + 2] += blockData[n + 2];
        destArray[destIndex + 3] += blockData[n + 3];
        destArray[destIndex + 4] += blockData[n + 4];
        destArray[destIndex + 5] += blockData[n + 5];
        destArray[destIndex + 6] += blockData[n + 6];
        destArray[destIndex + 7] += blockData[n + 7];
      }
    }
  }, {
    key: "copyValueToDestination",
    value: function copyValueToDestination(value, destArray, destIndex, scan) {
      for (var n = 0; n < 64; n += 8, destIndex += scan + 8) {
        destArray[destIndex + 0] = value;
        destArray[destIndex + 1] = value;
        destArray[destIndex + 2] = value;
        destArray[destIndex + 3] = value;
        destArray[destIndex + 4] = value;
        destArray[destIndex + 5] = value;
        destArray[destIndex + 6] = value;
        destArray[destIndex + 7] = value;
      }
    }
  }, {
    key: "addValueToDestination",
    value: function addValueToDestination(value, destArray, destIndex, scan) {
      for (var n = 0; n < 64; n += 8, destIndex += scan + 8) {
        destArray[destIndex + 0] += value;
        destArray[destIndex + 1] += value;
        destArray[destIndex + 2] += value;
        destArray[destIndex + 3] += value;
        destArray[destIndex + 4] += value;
        destArray[destIndex + 5] += value;
        destArray[destIndex + 6] += value;
        destArray[destIndex + 7] += value;
      }
    }

    // Clamping version for sitty browsers (IE) that don't support Uint8ClampedArray

  }, {
    key: "copyBlockToDestinationClamp",
    value: function copyBlockToDestinationClamp(blockData, destArray, destIndex, scan) {
      var n = 0;
      for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
          var p = blockData[n++];
          destArray[destIndex++] = p > 255 ? 255 : p < 0 ? 0 : p;
        }
        destIndex += scan;
      }
    }
  }, {
    key: "addBlockToDestinationClamp",
    value: function addBlockToDestinationClamp(blockData, destArray, destIndex, scan) {
      var n = 0;
      for (var i = 0; i < 8; i++) {
        for (var j = 0; j < 8; j++) {
          var p = blockData[n++] + destArray[destIndex];
          destArray[destIndex++] = p > 255 ? 255 : p < 0 ? 0 : p;
        }
        destIndex += scan;
      }
    }
  }, {
    key: "IDCT",
    value: function IDCT() {
      // See http://vsr.informatik.tu-chemnitz.de/~jan/MPEG/HTML/IDCT.html
      // for more info.

      var b1,
          b3,
          b4,
          b6,
          b7,
          tmp1,
          tmp2,
          m0,
          x0,
          x1,
          x2,
          x3,
          x4,
          y3,
          y4,
          y5,
          y6,
          y7,
          i,
          blockData = this.blockData;

      // Transform columns
      for (i = 0; i < 8; ++i) {
        b1 = blockData[4 * 8 + i];
        b3 = blockData[2 * 8 + i] + blockData[6 * 8 + i];
        b4 = blockData[5 * 8 + i] - blockData[3 * 8 + i];
        tmp1 = blockData[1 * 8 + i] + blockData[7 * 8 + i];
        tmp2 = blockData[3 * 8 + i] + blockData[5 * 8 + i];
        b6 = blockData[1 * 8 + i] - blockData[7 * 8 + i];
        b7 = tmp1 + tmp2;
        m0 = blockData[0 * 8 + i];
        x4 = (b6 * 473 - b4 * 196 + 128 >> 8) - b7;
        x0 = x4 - ((tmp1 - tmp2) * 362 + 128 >> 8);
        x1 = m0 - b1;
        x2 = ((blockData[2 * 8 + i] - blockData[6 * 8 + i]) * 362 + 128 >> 8) - b3;
        x3 = m0 + b1;
        y3 = x1 + x2;
        y4 = x3 + b3;
        y5 = x1 - x2;
        y6 = x3 - b3;
        y7 = -x0 - (b4 * 473 + b6 * 196 + 128 >> 8);
        blockData[0 * 8 + i] = b7 + y4;
        blockData[1 * 8 + i] = x4 + y3;
        blockData[2 * 8 + i] = y5 - x0;
        blockData[3 * 8 + i] = y6 - y7;
        blockData[4 * 8 + i] = y6 + y7;
        blockData[5 * 8 + i] = x0 + y5;
        blockData[6 * 8 + i] = y3 - x4;
        blockData[7 * 8 + i] = y4 - b7;
      }

      // Transform rows
      for (i = 0; i < 64; i += 8) {
        b1 = blockData[4 + i];
        b3 = blockData[2 + i] + blockData[6 + i];
        b4 = blockData[5 + i] - blockData[3 + i];
        tmp1 = blockData[1 + i] + blockData[7 + i];
        tmp2 = blockData[3 + i] + blockData[5 + i];
        b6 = blockData[1 + i] - blockData[7 + i];
        b7 = tmp1 + tmp2;
        m0 = blockData[0 + i];
        x4 = (b6 * 473 - b4 * 196 + 128 >> 8) - b7;
        x0 = x4 - ((tmp1 - tmp2) * 362 + 128 >> 8);
        x1 = m0 - b1;
        x2 = ((blockData[2 + i] - blockData[6 + i]) * 362 + 128 >> 8) - b3;
        x3 = m0 + b1;
        y3 = x1 + x2;
        y4 = x3 + b3;
        y5 = x1 - x2;
        y6 = x3 - b3;
        y7 = -x0 - (b4 * 473 + b6 * 196 + 128 >> 8);
        blockData[0 + i] = b7 + y4 + 128 >> 8;
        blockData[1 + i] = x4 + y3 + 128 >> 8;
        blockData[2 + i] = y5 - x0 + 128 >> 8;
        blockData[3 + i] = y6 - y7 + 128 >> 8;
        blockData[4 + i] = y6 + y7 + 128 >> 8;
        blockData[5 + i] = x0 + y5 + 128 >> 8;
        blockData[6 + i] = y3 - x4 + 128 >> 8;
        blockData[7 + i] = y4 - b7 + 128 >> 8;
      }
    }
  }, {
    key: "copyMacroblock",
    value: function copyMacroblock(motionH, motionV, sY, sCr, sCb) {
      var width, scan, H, V, oddH, oddV, src, dest, last;

      // We use 32bit writes here
      var dY = this.currentY32;
      var dCb = this.currentCb32;
      var dCr = this.currentCr32;

      // Luminance
      width = this.codedWidth;
      scan = width - 16;

      H = motionH >> 1;
      V = motionV >> 1;
      oddH = (motionH & 1) === 1;
      oddV = (motionV & 1) === 1;

      src = ((this.mbRow << 4) + V) * width + (this.mbCol << 4) + H;
      dest = this.mbRow * width + this.mbCol << 2;
      last = dest + (width << 2);

      var x;
      var y1, y2, y;
      if (oddH) {
        if (oddV) {
          while (dest < last) {
            y1 = sY[src] + sY[src + width];src++;
            for (x = 0; x < 4; x++) {
              y2 = sY[src] + sY[src + width];src++;
              y = y1 + y2 + 2 >> 2 & 0xff;

              y1 = sY[src] + sY[src + width];src++;
              y |= y1 + y2 + 2 << 6 & 0xff00;

              y2 = sY[src] + sY[src + width];src++;
              y |= y1 + y2 + 2 << 14 & 0xff0000;

              y1 = sY[src] + sY[src + width];src++;
              y |= y1 + y2 + 2 << 22 & 0xff000000;

              dY[dest++] = y;
            }
            dest += scan >> 2;src += scan - 1;
          }
        } else {
          while (dest < last) {
            y1 = sY[src++];
            for (x = 0; x < 4; x++) {
              y2 = sY[src++];
              y = y1 + y2 + 1 >> 1 & 0xff;

              y1 = sY[src++];
              y |= y1 + y2 + 1 << 7 & 0xff00;

              y2 = sY[src++];
              y |= y1 + y2 + 1 << 15 & 0xff0000;

              y1 = sY[src++];
              y |= y1 + y2 + 1 << 23 & 0xff000000;

              dY[dest++] = y;
            }
            dest += scan >> 2;src += scan - 1;
          }
        }
      } else {
        if (oddV) {
          while (dest < last) {
            for (x = 0; x < 4; x++) {
              y = sY[src] + sY[src + width] + 1 >> 1 & 0xff;src++;
              y |= sY[src] + sY[src + width] + 1 << 7 & 0xff00;src++;
              y |= sY[src] + sY[src + width] + 1 << 15 & 0xff0000;src++;
              y |= sY[src] + sY[src + width] + 1 << 23 & 0xff000000;src++;

              dY[dest++] = y;
            }
            dest += scan >> 2;src += scan;
          }
        } else {
          while (dest < last) {
            for (x = 0; x < 4; x++) {
              y = sY[src];src++;
              y |= sY[src] << 8;src++;
              y |= sY[src] << 16;src++;
              y |= sY[src] << 24;src++;

              dY[dest++] = y;
            }
            dest += scan >> 2;src += scan;
          }
        }
      }

      // Chrominance

      width = this.halfWidth;
      scan = width - 8;

      H = motionH / 2 >> 1;
      V = motionV / 2 >> 1;
      oddH = (motionH / 2 & 1) === 1;
      oddV = (motionV / 2 & 1) === 1;

      src = ((this.mbRow << 3) + V) * width + (this.mbCol << 3) + H;
      dest = this.mbRow * width + this.mbCol << 1;
      last = dest + (width << 1);

      var cr1, cr2, cr;
      var cb1, cb2, cb;
      if (oddH) {
        if (oddV) {
          while (dest < last) {
            cr1 = sCr[src] + sCr[src + width];
            cb1 = sCb[src] + sCb[src + width];
            src++;
            for (x = 0; x < 2; x++) {
              cr2 = sCr[src] + sCr[src + width];
              cb2 = sCb[src] + sCb[src + width];src++;
              cr = cr1 + cr2 + 2 >> 2 & 0xff;
              cb = cb1 + cb2 + 2 >> 2 & 0xff;

              cr1 = sCr[src] + sCr[src + width];
              cb1 = sCb[src] + sCb[src + width];src++;
              cr |= cr1 + cr2 + 2 << 6 & 0xff00;
              cb |= cb1 + cb2 + 2 << 6 & 0xff00;

              cr2 = sCr[src] + sCr[src + width];
              cb2 = sCb[src] + sCb[src + width];src++;
              cr |= cr1 + cr2 + 2 << 14 & 0xff0000;
              cb |= cb1 + cb2 + 2 << 14 & 0xff0000;

              cr1 = sCr[src] + sCr[src + width];
              cb1 = sCb[src] + sCb[src + width];src++;
              cr |= cr1 + cr2 + 2 << 22 & 0xff000000;
              cb |= cb1 + cb2 + 2 << 22 & 0xff000000;

              dCr[dest] = cr;
              dCb[dest] = cb;
              dest++;
            }
            dest += scan >> 2;src += scan - 1;
          }
        } else {
          while (dest < last) {
            cr1 = sCr[src];
            cb1 = sCb[src];
            src++;
            for (x = 0; x < 2; x++) {
              cr2 = sCr[src];
              cb2 = sCb[src++];
              cr = cr1 + cr2 + 1 >> 1 & 0xff;
              cb = cb1 + cb2 + 1 >> 1 & 0xff;

              cr1 = sCr[src];
              cb1 = sCb[src++];
              cr |= cr1 + cr2 + 1 << 7 & 0xff00;
              cb |= cb1 + cb2 + 1 << 7 & 0xff00;

              cr2 = sCr[src];
              cb2 = sCb[src++];
              cr |= cr1 + cr2 + 1 << 15 & 0xff0000;
              cb |= cb1 + cb2 + 1 << 15 & 0xff0000;

              cr1 = sCr[src];
              cb1 = sCb[src++];
              cr |= cr1 + cr2 + 1 << 23 & 0xff000000;
              cb |= cb1 + cb2 + 1 << 23 & 0xff000000;

              dCr[dest] = cr;
              dCb[dest] = cb;
              dest++;
            }
            dest += scan >> 2;src += scan - 1;
          }
        }
      } else {
        if (oddV) {
          while (dest < last) {
            for (x = 0; x < 2; x++) {
              cr = sCr[src] + sCr[src + width] + 1 >> 1 & 0xff;
              cb = sCb[src] + sCb[src + width] + 1 >> 1 & 0xff;src++;

              cr |= sCr[src] + sCr[src + width] + 1 << 7 & 0xff00;
              cb |= sCb[src] + sCb[src + width] + 1 << 7 & 0xff00;src++;

              cr |= sCr[src] + sCr[src + width] + 1 << 15 & 0xff0000;
              cb |= sCb[src] + sCb[src + width] + 1 << 15 & 0xff0000;src++;

              cr |= sCr[src] + sCr[src + width] + 1 << 23 & 0xff000000;
              cb |= sCb[src] + sCb[src + width] + 1 << 23 & 0xff000000;src++;

              dCr[dest] = cr;
              dCb[dest] = cb;
              dest++;
            }
            dest += scan >> 2;src += scan;
          }
        } else {
          while (dest < last) {
            for (x = 0; x < 2; x++) {
              cr = sCr[src];
              cb = sCb[src];src++;

              cr |= sCr[src] << 8;
              cb |= sCb[src] << 8;src++;

              cr |= sCr[src] << 16;
              cb |= sCb[src] << 16;src++;

              cr |= sCr[src] << 24;
              cb |= sCb[src] << 24;src++;

              dCr[dest] = cr;
              dCb[dest] = cb;
              dest++;
            }
            dest += scan >> 2;src += scan;
          }
        }
      }
    }
  }, {
    key: "decodeMotionVectors",
    value: function decodeMotionVectors() {
      var code,
          d,
          r = 0;

      // Forward
      if (this.macroblockMotFw) {
        // Horizontal forward
        code = this.readCode(MOTION);
        if (code !== 0 && this.forwardF !== 1) {
          r = this.buffer.getBits(this.forwardRSize);
          d = (Math.abs(code) - 1 << this.forwardRSize) + r + 1;
          if (code < 0) {
            d = -d;
          }
        } else {
          d = code;
        }

        this.motionFwHPrev += d;
        if (this.motionFwHPrev > (this.forwardF << 4) - 1) {
          this.motionFwHPrev -= this.forwardF << 5;
        } else if (this.motionFwHPrev < -this.forwardF << 4) {
          this.motionFwHPrev += this.forwardF << 5;
        }

        this.motionFwH = this.motionFwHPrev;
        if (this.fullPelForward) {
          this.motionFwH <<= 1;
        }

        // Vertical forward
        code = this.readCode(MOTION);
        if (code !== 0 && this.forwardF !== 1) {
          r = this.buffer.getBits(this.forwardRSize);
          d = (Math.abs(code) - 1 << this.forwardRSize) + r + 1;
          if (code < 0) {
            d = -d;
          }
        } else {
          d = code;
        }

        this.motionFwVPrev += d;
        if (this.motionFwVPrev > (this.forwardF << 4) - 1) {
          this.motionFwVPrev -= this.forwardF << 5;
        } else if (this.motionFwVPrev < -this.forwardF << 4) {
          this.motionFwVPrev += this.forwardF << 5;
        }

        this.motionFwV = this.motionFwVPrev;
        if (this.fullPelForward) {
          this.motionFwV <<= 1;
        }
      } else if (this.pictureCodingType === PICTURE_TYPE_P) {
        // No motion information in P-picture, reset vectors
        this.motionFwH = this.motionFwHPrev = 0;
        this.motionFwV = this.motionFwVPrev = 0;
      }
    }
  }, {
    key: "decodeBlock",
    value: function decodeBlock(block) {

      var n = 0,
          quantMatrix;

      // Decode DC coefficient of intra-coded blocks
      if (this.macroblockIntra) {
        var predictor, dctSize;

        // DC prediction

        if (block < 4) {
          predictor = this.dcPredictorY;
          dctSize = this.readCode(DCT_DC_SIZE_LUMINANCE);
        } else {
          predictor = block === 4 ? this.dcPredictorCr : this.dcPredictorCb;
          dctSize = this.readCode(DCT_DC_SIZE_CHROMINANCE);
        }

        // Read DC coeff
        if (dctSize > 0) {
          var differential = this.buffer.getBits(dctSize);
          if ((differential & 1 << dctSize - 1) !== 0) {
            this.blockData[0] = predictor + differential;
          } else {
            this.blockData[0] = predictor + (-1 << dctSize | differential + 1);
          }
        } else {
          this.blockData[0] = predictor;
        }

        // Save predictor value
        if (block < 4) {
          this.dcPredictorY = this.blockData[0];
        } else if (block === 4) {
          this.dcPredictorCr = this.blockData[0];
        } else {
          this.dcPredictorCb = this.blockData[0];
        }

        // Dequantize + premultiply
        this.blockData[0] <<= 3 + 5;

        quantMatrix = this.intraQuantMatrix;
        n = 1;
      } else {
        quantMatrix = this.nonIntraQuantMatrix;
      }

      // Decode AC coefficients (+DC for non-intra)
      var level = 0;
      while (true) {
        var run = 0,
            coeff = this.readCode(DCT_COEFF);

        if (coeff === 0x0001 && n > 0 && this.buffer.getBits(1) === 0) {
          // end_of_block
          break;
        }
        if (coeff === 0xffff) {
          // escape
          run = this.buffer.getBits(6);
          level = this.buffer.getBits(8);
          if (level === 0) {
            level = this.buffer.getBits(8);
          } else if (level === 128) {
            level = this.buffer.getBits(8) - 256;
          } else if (level > 128) {
            level = level - 256;
          }
        } else {
          run = coeff >> 8;
          level = coeff & 0xff;
          if (this.buffer.getBits(1)) {
            level = -level;
          }
        }

        n += run;
        var dezigZagged = ZIG_ZAG[n];
        n++;

        // Dequantize, oddify, clip
        level <<= 1;
        if (!this.macroblockIntra) {
          level += level < 0 ? -1 : 1;
        }
        level = level * this.quantizerScale * quantMatrix[dezigZagged] >> 4;
        if ((level & 1) === 0) {
          level -= level > 0 ? 1 : -1;
        }
        if (level > 2047) {
          level = 2047;
        } else if (level < -2048) {
          level = -2048;
        }

        // Save premultiplied coefficient
        this.blockData[dezigZagged] = level * PREMULTIPLIER_MATRIX[dezigZagged];
      }

      // Move block to its place
      var destArray, destIndex, scan;

      if (block < 4) {
        destArray = this.currentY;
        scan = this.codedWidth - 8;
        destIndex = this.mbRow * this.codedWidth + this.mbCol << 4;
        if ((block & 1) !== 0) {
          destIndex += 8;
        }
        if ((block & 2) !== 0) {
          destIndex += this.codedWidth << 3;
        }
      } else {
        destArray = block === 4 ? this.currentCb : this.currentCr;
        scan = (this.codedWidth >> 1) - 8;
        destIndex = (this.mbRow * this.codedWidth << 2) + (this.mbCol << 3);
      }

      if (this.macroblockIntra) {
        // Overwrite (no prediction)
        if (n === 1) {
          this.copyValueToDestination(this.blockData[0] + 128 >> 8, destArray, destIndex, scan);
          this.blockData[0] = 0;
        } else {
          this.IDCT();
          this.copyBlockToDestination(this.blockData, destArray, destIndex, scan);
          this.blockData.set(this.zeroBlockData);
        }
      } else {
        // Add data to the predicted macroblock
        if (n === 1) {
          this.addValueToDestination(this.blockData[0] + 128 >> 8, destArray, destIndex, scan);
          this.blockData[0] = 0;
        } else {
          this.IDCT();
          this.addBlockToDestination(this.blockData, destArray, destIndex, scan);
          this.blockData.set(this.zeroBlockData);
        }
      }

      n = 0;
    }
  }, {
    key: "decodeMacroblock",
    value: function decodeMacroblock() {
      // Decode macroblock_address_increment
      var increment = 0,
          t = this.readCode(MACROBLOCK_ADDRESS_INCREMENT);

      while (t === 34) {
        // macroblock_stuffing
        t = this.readCode(MACROBLOCK_ADDRESS_INCREMENT);
      }
      while (t === 35) {
        // macroblock_escape
        increment += 33;
        t = this.readCode(MACROBLOCK_ADDRESS_INCREMENT);
      }
      increment += t;

      // Process any skipped macroblocks
      if (this.sliceBegin) {
        // The first macroblock_address_increment of each slice is relative
        // to beginning of the preverious row, not the preverious macroblock
        this.sliceBegin = false;
        this.macroblockAddress += increment;
      } else {
        if (this.macroblockAddress + increment >= this.mbSize) {
          // Illegal (too large) macroblock_address_increment
          return;
        }
        if (increment > 1) {
          // Skipped macroblocks reset DC predictors
          this.dcPredictorY = 128;
          this.dcPredictorCr = 128;
          this.dcPredictorCb = 128;

          // Skipped macroblocks in P-pictures reset motion vectors
          if (this.pictureCodingType === PICTURE_TYPE_P) {
            this.motionFwH = this.motionFwHPrev = 0;
            this.motionFwV = this.motionFwVPrev = 0;
          }
        }

        // Predict skipped macroblocks
        while (increment > 1) {
          this.macroblockAddress++;
          this.mbRow = this.macroblockAddress / this.mbWidth | 0;
          this.mbCol = this.macroblockAddress % this.mbWidth;
          this.copyMacroblock(this.motionFwH, this.motionFwV, this.forwardY, this.forwardCr, this.forwardCb);
          increment--;
        }
        this.macroblockAddress++;
      }
      this.mbRow = this.macroblockAddress / this.mbWidth | 0;
      this.mbCol = this.macroblockAddress % this.mbWidth;

      // Process the current macroblock
      this.macroblockType = this.readCode(MACROBLOCK_TYPE_TABLES[this.pictureCodingType]);
      this.macroblockIntra = this.macroblockType & 0x01;
      this.macroblockMotFw = this.macroblockType & 0x08;

      // Quantizer scale
      if ((this.macroblockType & 0x10) !== 0) {
        this.quantizerScale = this.buffer.getBits(5);
      }

      if (this.macroblockIntra) {
        // Intra-coded macroblocks reset motion vectors
        this.motionFwH = this.motionFwHPrev = 0;
        this.motionFwV = this.motionFwVPrev = 0;
      } else {
        // Non-intra macroblocks reset DC predictors
        this.dcPredictorY = 128;
        this.dcPredictorCr = 128;
        this.dcPredictorCb = 128;

        this.decodeMotionVectors();
        this.copyMacroblock(this.motionFwH, this.motionFwV, this.forwardY, this.forwardCr, this.forwardCb);
      }

      // Decode blocks
      var cbp = (this.macroblockType & 0x02) !== 0 ? this.readCode(CODE_BLOCK_PATTERN) : this.macroblockIntra ? 0x3f : 0;

      for (var block = 0, mask = 0x20; block < 6; block++) {
        if ((cbp & mask) !== 0) {
          this.decodeBlock(block);
        }
        mask >>= 1;
      }
    }
  }, {
    key: "decodeSlice",
    value: function decodeSlice(slice) {
      this.sliceBegin = true;
      this.macroblockAddress = (slice - 1) * this.mbWidth - 1;

      // Reset motion vectors and DC predictors
      this.motionFwH = this.motionFwHPrev = 0;
      this.motionFwV = this.motionFwVPrev = 0;
      this.dcPredictorY = 128;
      this.dcPredictorCr = 128;
      this.dcPredictorCb = 128;

      this.quantizerScale = this.buffer.getBits(5);

      // skip extra bits
      while (this.buffer.getBits(1)) {
        this.buffer.advance(8);
      }

      do {
        this.decodeMacroblock();
        // We may have to ignore Video Stream Start Codes here (0xE0)!?
      } while (!this.buffer.nextBytesAreStartCode());
    }
  }, {
    key: "decodePicture",
    value: function decodePicture(decodeCallback, skipOutput) {
      this.currentFrame++;
      this.currentTime = this.currentFrame / this.pictureRate;

      this.buffer.advance(10); // skip temporalReference
      this.pictureCodingType = this.buffer.getBits(3);
      this.buffer.advance(16); // skip vbv_delay

      // Skip B and D frames or unknown coding type
      if (this.pictureCodingType <= 0 || this.pictureCodingType >= PICTURE_TYPE_B) {
        return;
      }

      // full_pel_forward, forward_f_code
      if (this.pictureCodingType === PICTURE_TYPE_P) {
        this.fullPelForward = this.buffer.getBits(1);
        this.forwardFCode = this.buffer.getBits(3);
        if (this.forwardFCode === 0) {
          // Ignore picture with zero forward_f_code
          return;
        }
        this.forwardRSize = this.forwardFCode - 1;
        this.forwardF = 1 << this.forwardRSize;
      }

      var code = 0;
      do {
        code = this.buffer.findNextMPEGStartCode();
      } while (code === START_EXTENSION || code === START_USER_DATA);

      while (code >= START_SLICE_FIRST && code <= START_SLICE_LAST) {
        this.decodeSlice(code & 0x000000FF);
        code = this.buffer.findNextMPEGStartCode();
      }

      // We found the next start code; rewind 32bits and let the main loop handle it.
      this.buffer.rewind(32);

      if (skipOutput !== DECODE_SKIP_OUTPUT && decodeCallback) {
        decodeCallback();
      }

      // // Record this frame, if the recorder wants it
      // this.recordFrameFromCurrentBuffer();


      // if( skipOutput !== DECODE_SKIP_OUTPUT ) {
      //   this.renderFrame();

      //   if(this.externalDecodeCallback) {
      //     this.externalDecodeCallback(this, this.canvas);
      //   }
      // }

      // If this is a reference picutre then rotate the prediction pointers
      if (this.pictureCodingType === PICTURE_TYPE_I || this.pictureCodingType === PICTURE_TYPE_P) {
        var tmpY = this.forwardY,
            tmpY32 = this.forwardY32,
            tmpCr = this.forwardCr,
            tmpCr32 = this.forwardCr32,
            tmpCb = this.forwardCb,
            tmpCb32 = this.forwardCb32;

        this.forwardY = this.currentY;
        this.forwardY32 = this.currentY32;
        this.forwardCr = this.currentCr;
        this.forwardCr32 = this.currentCr32;
        this.forwardCb = this.currentCb;
        this.forwardCb32 = this.currentCb32;

        this.currentY = tmpY;
        this.currentY32 = tmpY32;
        this.currentCr = tmpCr;
        this.currentCr32 = tmpCr32;
        this.currentCb = tmpCb;
        this.currentCb32 = tmpCb32;
      }
    }
  }]);

  return MpegDecoder;
}();

exports.default = MpegDecoder;

},{}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _mpegBitReader = require('./mpeg-bit-reader');

var _mpegBitReader2 = _interopRequireDefault(_mpegBitReader);

var _mpegDecoder = require('./mpeg-decoder');

var _mpegDecoder2 = _interopRequireDefault(_mpegDecoder);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

// import GLDriver from './gl-driver'

var BUFFER_SIZE = 512 * 1024;
var HEADER = 'jsmp';
var HJ = HEADER.charCodeAt(0);
var HS = HEADER.charCodeAt(1);
var HM = HEADER.charCodeAt(2);
var HP = HEADER.charCodeAt(3);

var START_PICTURE = 0x00;
var DECODE_SKIP_OUTPUT = 1;

var requestAnimFrame = function () {
  return window.requestAnimationFrame || window.webkitRequestAnimationFrame || window.mozRequestAnimationFrame || function (callback) {
    window.setTimeout(callback, 1000 / 60);
  };
}();

function now() {
  return window.performance ? window.performance.now() : Date.now();
}

var MpegWs = function () {
  function MpegWs(url, opts) {
    _classCallCheck(this, MpegWs);

    opts = opts || {};
    // this.progressive = (opts.progressive !== false);
    // this.benchmark = !!opts.benchmark;
    // this.canvas = opts.canvas || document.createElement('canvas');
    // this.autoplay = !!opts.autoplay;
    // this.wantsToPlay = this.autoplay;
    // this.loop = !!opts.loop;
    // this.seekable = !!opts.seekable;
    this.externalDecodeCallback = opts.ondecodeframe || null;

    // this.renderFrame = this.renderFrameGL;

    // this.pictureRate = 30;
    // this.lateTime = 0;
    // this.firstSequenceHeader = 0;
    // this.targetTime = 0;

    // this.benchmark = false;
    // this.benchFrame = 0;
    // this.benchDecodeTimes = 0;
    // this.benchAvgFrameTime = 0;

    this.client = new WebSocket(url);
    this.client.onopen = this.initSocketClient.bind(this);
  }

  _createClass(MpegWs, [{
    key: 'dispose',
    value: function dispose() {
      this.client && this.client.close();
      // this._gl_driver = null
    }
  }, {
    key: 'initSocketClient',
    value: function initSocketClient() {

      this.buffer = new _mpegBitReader2.default(new ArrayBuffer(BUFFER_SIZE));

      this.nextPictureBuffer = new _mpegBitReader2.default(new ArrayBuffer(BUFFER_SIZE));
      this.nextPictureBuffer.writePos = 0;
      this.nextPictureBuffer.chunkBegin = 0;
      this.nextPictureBuffer.lastWriteBeforeWrap = 0;

      this.client.binaryType = 'arraybuffer';
      this.client.onmessage = this.receiveSocketMessage.bind(this);
    }
  }, {
    key: 'decodeSocketHeader',
    value: function decodeSocketHeader(data) {
      // Custom header sent to all newly connected clients when streaming
      // over websockets:
      // struct { char magic[4] = 'jsmp'; unsigned short width, height; };
      if (data[0] === HJ && data[1] === HS && data[2] === HM && data[3] === HP) {
        this.width = data[4] * 256 + data[5];
        this.height = data[6] * 256 + data[7];
        this.initBuffers();

        // this._gl_driver = new GLDriver(this.width, this.height)
      }
    }
  }, {
    key: 'scheduleDecoding',
    value: function scheduleDecoding() {
      this.decoder.decodePicture(this.decodeCallback.bind(this));
      this.currentPictureDecoded = true;
    }
  }, {
    key: 'decodeCallback',
    value: function decodeCallback() {
      // console.log('decode callback')
      // if(this._gl_driver) {
      //   var buffer_Y = this.decoder.currentY.buffer
      //   var buffer_Cr = this.decoder.currentCr.buffer
      //   var buffer_Cb = this.decoder.currentCb.buffer

      //   this._gl_driver.renderFrameGL(buffer_Y, buffer_Cr, buffer_Cb)
      // }
      if (this.externalDecodeCallback) {
        var buffer_Y = this.decoder.currentY.buffer;
        var buffer_Cr = this.decoder.currentCr.buffer;
        var buffer_Cb = this.decoder.currentCb.buffer;

        // this.externalDecodeCallback(this, this._gl_driver.canvas);
        this.externalDecodeCallback(this, buffer_Y, buffer_Cr, buffer_Cb);
      }
    }
  }, {
    key: 'initBuffers',
    value: function initBuffers() {

      // Sequence already started? Don't allocate buffers again
      if (this.sequenceStarted) {
        return;
      }
      this.sequenceStarted = true;

      this.decoder = new _mpegDecoder2.default(this.buffer, this.width, this.height);

      // this.canvas.width = this.width;
      // this.canvas.height = this.height;

      // this.gl.useProgram(this.program);
      // this.gl.viewport(0, 0, this.width, this.height);
    }
  }, {
    key: 'receiveSocketMessage',
    value: function receiveSocketMessage(event) {

      var messageData = new Uint8Array(event.data);

      if (!this.sequenceStarted) {
        this.decodeSocketHeader(messageData);
      }

      var current = this.buffer;
      var next = this.nextPictureBuffer;

      if (next.writePos + messageData.length > next.length) {
        next.lastWriteBeforeWrap = next.writePos;
        next.writePos = 0;
        next.index = 0;
      }

      next.bytes.set(messageData, next.writePos);
      next.writePos += messageData.length;

      var startCode = 0;
      while (true) {
        startCode = next.findNextMPEGStartCode();
        if (startCode === _mpegBitReader2.default.NOT_FOUND || next.index >> 3 > next.writePos) {
          // We reached the end with no picture found yet; move back a few bytes
          // in case we are at the beginning of a start code and exit.
          next.index = Math.max(next.writePos - 3, 0) << 3;
          return;
        } else if (startCode === START_PICTURE) {
          break;
        }
      }

      // If we are still here, we found the next picture start code!

      // Skip picture decoding until we find the first intra frame?
      if (this.waitForIntraFrame) {
        next.advance(10); // skip temporalReference
        if (next.getBits(3) === PICTURE_TYPE_I) {
          this.waitForIntraFrame = false;
          next.chunkBegin = next.index - 13 >> 3;
        }
        return;
      }

      // Last picture hasn't been decoded yet? Decode now but skip output
      // before scheduling the next one
      if (!this.currentPictureDecoded) {
        this.decoder.decodePicture(undefined, DECODE_SKIP_OUTPUT);
      }

      // Copy the picture chunk over to 'this.buffer' and schedule decoding.
      var chunkEnd = next.index >> 3;

      if (chunkEnd > next.chunkBegin) {
        // Just copy the current picture chunk
        current.bytes.set(next.bytes.subarray(next.chunkBegin, chunkEnd));
        current.writePos = chunkEnd - next.chunkBegin;
      } else {
        // We wrapped the nextPictureBuffer around, so we have to copy the last part
        // till the end, as well as from 0 to the current writePos
        current.bytes.set(next.bytes.subarray(next.chunkBegin, next.lastWriteBeforeWrap));
        var written = next.lastWriteBeforeWrap - next.chunkBegin;
        current.bytes.set(next.bytes.subarray(0, chunkEnd), written);
        current.writePos = chunkEnd + written;
      }

      current.index = 0;
      next.chunkBegin = chunkEnd;

      // Decode!
      this.currentPictureDecoded = false;
      requestAnimFrame(this.scheduleDecoding.bind(this));
    }
  }]);

  return MpegWs;
}();

exports.default = MpegWs;

},{"./mpeg-bit-reader":3,"./mpeg-decoder":4}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

var _mpegWs = require('./mpeg-ws');

var _mpegWs2 = _interopRequireDefault(_mpegWs);

var _glDriver = require('./gl-driver');

var _glDriver2 = _interopRequireDefault(_glDriver);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _scene = scene;
var Component = _scene.Component;
var Rect = _scene.Rect;


var WIDTH = 1280;
var HEIGHT = 960;

var FOV_MIN = 0.05;
var FOV_MAX = 5.0;

var ROTATE_MIN = -2.0;
var ROTATE_MAX = +2.0;

function roundSet(round, width, height) {
  var max = width > height ? height / width * 100 : 100;

  if (round >= max) round = max;else if (round <= 0) round = 0;

  return round;
}

var WS4ChVideo = function (_Rect) {
  _inherits(WS4ChVideo, _Rect);

  function WS4ChVideo(model, context) {
    _classCallCheck(this, WS4ChVideo);

    var _this = _possibleConstructorReturn(this, Object.getPrototypeOf(WS4ChVideo).call(this, model, context));

    if (_this.model.autoplay) {
      _this._isPlaying = true;
      _this._gl_driver = new _glDriver2.default(WIDTH, HEIGHT);
    }
    return _this;
  }

  _createClass(WS4ChVideo, [{
    key: '_draw',
    value: function _draw(ctx) {

      this._ctx = ctx;

      if (!this._ws1 && this._isPlaying) {

        this._ws1 = new _mpegWs2.default(this.model.url1, {
          ondecodeframe: this.drawDecoded.bind(this)
        });
      }

      if (!this._ws2 && this._isPlaying) {

        this._ws2 = new _mpegWs2.default(this.model.url2, {
          ondecodeframe: this.drawDecoded.bind(this)
        });
      }

      if (!this._ws3 && this._isPlaying) {

        this._ws3 = new _mpegWs2.default(this.model.url3, {
          ondecodeframe: this.drawDecoded.bind(this)
        });
      }

      if (!this._ws4 && this._isPlaying) {

        this._ws4 = new _mpegWs2.default(this.model.url4, {
          ondecodeframe: this.drawDecoded.bind(this)
        });
      }

      var _model = this.model;
      var left = _model.left;
      var top = _model.top;
      var width = _model.width;
      var height = _model.height;
      var round = _model.round;


      _get(Object.getPrototypeOf(WS4ChVideo.prototype), '_draw', this).call(this, ctx);

      if (this._isPlaying) {
        ctx.save();

        round = roundSet(round, width, height);
        if (round > 0) {
          this.drawRoundedImage(ctx);
        }

        ctx.drawImage(this._gl_driver.canvas, 0, 0, WIDTH, HEIGHT, this.model.left, this.model.top, this.model.width, this.model.height);

        if (this._isHover) {
          this.drawStopButton(ctx);
        }

        ctx.restore();
      } else {
        this.drawPlayButton(ctx);
      }
    }
  }, {
    key: 'drawRoundedImage',
    value: function drawRoundedImage(ctx) {
      var _model2 = this.model;
      var left = _model2.left;
      var top = _model2.top;
      var width = _model2.width;
      var height = _model2.height;
      var round = _model2.round;


      var tmpRound = round / 100 * (width / 2);
      ctx.beginPath();

      ctx.moveTo(left + tmpRound, top);
      ctx.lineTo(left + width - tmpRound, top);
      ctx.quadraticCurveTo(left + width, top, left + width, top + tmpRound);
      ctx.lineTo(left + width, top + height - tmpRound);
      ctx.quadraticCurveTo(left + width, top + height, left + width - tmpRound, top + height);
      ctx.lineTo(left + tmpRound, top + height);
      ctx.quadraticCurveTo(left, top + height, left, top + height - tmpRound);
      ctx.lineTo(left, top + tmpRound);
      ctx.quadraticCurveTo(left, top, left + tmpRound, top);
      ctx.closePath();

      ctx.clip();
    }
  }, {
    key: 'drawSymbol',
    value: function drawSymbol(ctx) {
      var image = new Image();
      image.src = 'data:image/svg+xml;utf8;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iaXNvLTg4NTktMSI/Pgo8IS0tIEdlbmVyYXRvcjogQWRvYmUgSWxsdXN0cmF0b3IgMTYuMC4wLCBTVkcgRXhwb3J0IFBsdWctSW4gLiBTVkcgVmVyc2lvbjogNi4wMCBCdWlsZCAwKSAgLS0+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgdmVyc2lvbj0iMS4xIiBpZD0iQ2FwYV8xIiB4PSIwcHgiIHk9IjBweCIgd2lkdGg9IjUxMnB4IiBoZWlnaHQ9IjUxMnB4IiB2aWV3Qm94PSIwIDAgMzQ3Ljg0NiAzNDcuODQ2IiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCAzNDcuODQ2IDM0Ny44NDY7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPGc+Cgk8Zz4KCQk8Zz4KCQkJPHBhdGggZD0iTTI1OS4wOTUsMjcwLjkxM2MzOC40OS0yNi45NjIsNjMuNzExLTcxLjU5LDYzLjcxMS0xMjIuMDQyQzMyMi44MDYsNjYuNzg2LDI1Ni4wMzIsMCwxNzMuOTIzLDAgICAgIEM5MS44MjgsMCwyNS4wNCw2Ni43ODYsMjUuMDQsMTQ4Ljg3MWMwLDUwLjk1LDI1LjcxNiw5NS45NjMsNjQuODIyLDEyMi44MUM3MCwyNzkuNzg4LDU5LjE4OSwyOTAuNjIsNTkuMTg5LDMwMi44MSAgICAgYzAsMjkuMjQ0LDU5Ljg5OCw0NS4wMzYsMTE2LjI2NSw0NS4wMzZjNTYuMzQ5LDAsMTE2LjIzNS0xNS43OTIsMTE2LjIzNS00NS4wMzYgICAgIEMyOTEuNjg4LDI5MC4xODIsMjgwLjIxMywyNzkuMDkxLDI1OS4wOTUsMjcwLjkxM3ogTTE3My41NjUsNDYuMjIyYzYuOTQ3LDAsMTIuNTU5LDUuNjI2LDEyLjU1OSwxMi41NjggICAgIGMwLDYuOTM2LTUuNjExLDEyLjU2OC0xMi41NTksMTIuNTY4Yy02LjkyNCwwLTEyLjU1Ni01LjYzMy0xMi41NTYtMTIuNTY4QzE2MS4wMDksNTEuODQ5LDE2Ni42NDIsNDYuMjIyLDE3My41NjUsNDYuMjIyeiAgICAgIE0xNzMuOTIzLDg1LjAyMmMzNS4yMjQsMCw2My44NjYsMjguNjQ4LDYzLjg2Niw2My44NTRzLTI4LjY0Myw2My44NzMtNjMuODY2LDYzLjg3M2MtMzUuMjE1LDAtNjMuODY0LTI4LjY1NS02My44NjQtNjMuODczICAgICBDMTEwLjA1OSwxMTMuNjY1LDEzOC43MDgsODUuMDIyLDE3My45MjMsODUuMDIyeiBNMTc1LjQ1NCwzMzUuMjg0Yy02NC4yMzYsMC0xMDMuNjgyLTE4LjkyMi0xMDMuNjgyLTMyLjQ3NSAgICAgYzAtNy44MywxMi4xOTMtMTYuNDQsMzEuODY4LTIyLjczM2MyMC45NTEsMTEuMjg5LDQ0Ljg4MywxNy42OSw3MC4yODksMTcuNjljMjUuODYyLDAsNTAuMTc2LTYuNjQyLDcxLjM3OS0xOC4yNzkgICAgIGMyMC42MDMsNi4yODEsMzMuODMxLDE1LjI4OCwzMy44MzEsMjMuMzIyQzI3OS4xMjcsMzE2LjM2MiwyMzkuNjg4LDMzNS4yODQsMTc1LjQ1NCwzMzUuMjg0eiIgZmlsbD0iIzAwMDAwMCIvPgoJCTwvZz4KCQk8Zz4KCQkJPHBhdGggZD0iTTE3My45MjMsMTkxLjM3OWMyMy40MzEsMCw0Mi41MDItMTkuMDY4LDQyLjUwMi00Mi40OTZjMC0yMy40MjQtMTkuMDcxLTQyLjQ5My00Mi41MDItNDIuNDkzICAgICBjLTIzLjQyOCwwLTQyLjQ4NCwxOS4wNjgtNDIuNDg0LDQyLjQ5M0MxMzEuNDM4LDE3Mi4zMTEsMTUwLjQ5NSwxOTEuMzc5LDE3My45MjMsMTkxLjM3OXoiIGZpbGw9IiMwMDAwMDAiLz4KCQk8L2c+Cgk8L2c+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPC9zdmc+Cg==';
      ctx.drawImage(image, 0, 0, image.width, image.height, this.model.left + this.model.width * 0.25, this.model.top + this.model.height * 0.25, this.model.width * 0.5, this.model.height * 0.5);
    }
  }, {
    key: 'drawComponentFrame',
    value: function drawComponentFrame(ctx) {
      ctx.beginPath();
      ctx.moveTo(this.model.left, this.model.top);
      ctx.lineTo(this.model.left + this.model.width, this.model.top);
      ctx.lineTo(this.model.left + this.model.width, this.model.top + this.model.height);
      ctx.lineTo(this.model.left, this.model.top + this.model.height);
      ctx.lineTo(this.model.left, this.model.top);
      ctx.stroke();
      ctx.closePath();
    }
  }, {
    key: 'drawPlayButton',
    value: function drawPlayButton(ctx) {
      this.drawActionButton(ctx, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoyNThCQUYyNDMyMTYxMUU2QjY1QUUzMjAyRjNBQUJEMSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoyNThCQUYyNTMyMTYxMUU2QjY1QUUzMjAyRjNBQUJEMSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjBEMUU5RDgxMzIwNDExRTZCNjVBRTMyMDJGM0FBQkQxIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjBEMUU5RDgyMzIwNDExRTZCNjVBRTMyMDJGM0FBQkQxIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+tES3iAAAEldJREFUeNrknQlw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");
    }
  }, {
    key: 'drawStopButton',
    value: function drawStopButton(ctx) {
      this.drawActionButton(ctx, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoyNThCQUYyODMyMTYxMUU2QjY1QUUzMjAyRjNBQUJEMSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoyNThCQUYyOTMyMTYxMUU2QjY1QUUzMjAyRjNBQUJEMSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjI1OEJBRjI2MzIxNjExRTZCNjVBRTMyMDJGM0FBQkQxIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjI1OEJBRjI3MzIxNjExRTZCNjVBRTMyMDJGM0FBQkQxIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+8iPbzgAAEPNJREFUeNrsXXtQ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");
    }
  }, {
    key: 'drawActionButton',
    value: function drawActionButton(ctx, imageData) {
      var image = new Image();
      image.src = imageData;
      ctx.drawImage(image, 0, 0, image.width, image.height, this.model.left + this.model.width / 2 - image.width / 2, this.model.top + this.model.height / 2 - image.height / 2, image.width, image.height);

      this._playButtonArea = {
        left: this.model.left + this.model.width / 2 - image.width / 2,
        top: this.model.top + this.model.height / 2 - image.height / 2,
        width: image.width,
        height: image.height
      };
    }
  }, {
    key: 'drawDecoded',
    value: function drawDecoded(scope, buffer_Y, buffer_Cr, buffer_Cb) {
      if (this._isPlaying) {
        if (scope === this._ws1) {
          this.buffer_Y1 = buffer_Y;
          this.buffer_Cr1 = buffer_Cr;
          this.buffer_Cb1 = buffer_Cb;
        } else if (scope === this._ws2) {
          this.buffer_Y2 = buffer_Y;
          this.buffer_Cr2 = buffer_Cr;
          this.buffer_Cb2 = buffer_Cb;
        } else if (scope === this._ws3) {
          this.buffer_Y3 = buffer_Y;
          this.buffer_Cr3 = buffer_Cr;
          this.buffer_Cb3 = buffer_Cb;
        } else {
          this.buffer_Y4 = buffer_Y;
          this.buffer_Cr4 = buffer_Cr;
          this.buffer_Cb4 = buffer_Cb;
        }

        this._gl_driver.renderFrameGL(this.buffer_Y1, this.buffer_Cr1, this.buffer_Cb1, this.buffer_Y2, this.buffer_Cr2, this.buffer_Cb2, this.buffer_Y3, this.buffer_Cr3, this.buffer_Cb3, this.buffer_Y4, this.buffer_Cr4, this.buffer_Cb4);

        // this._canvas = canvas
        this.invalidate();
      }
    }
  }, {
    key: 'play',
    value: function play() {
      this._isPlaying = true;
      this.reconnect();
    }
  }, {
    key: 'stop',
    value: function stop() {
      this._isPlaying = false;
      this._gl_driver && this._gl_driver.dispose();
      this._gl_driver = null;
      this.reconnect();
    }
  }, {
    key: 'reconnect',
    value: function reconnect() {
      if (this._ws1 && this._ws1.client) this._ws1.client.close();

      this._ws1 = null;

      if (this._ws2 && this._ws2.client) this._ws2.client.close();

      this._ws2 = null;

      if (this._ws3 && this._ws3.client) this._ws3.client.close();

      this._ws3 = null;

      if (this._ws4 && this._ws4.client) this._ws4.client.close();

      this._ws4 = null;

      this.invalidate();
    }
  }, {
    key: 'onchange',
    value: function onchange(after, before) {
      var self = this;

      if (after.hasOwnProperty('url')) {
        var isChanged = after.url != before.url;

        if (isChanged) {
          self.reconnect();
        }
      }

      if (after.hasOwnProperty('autoplay')) {
        var isChanged = after.autoplay != before.autoplay;

        if (isChanged) {
          self.reconnect();
        }
      }
    }
  }, {
    key: 'onclick',
    value: function onclick(e) {

      var point = this.transcoordC2S(e.offsetX, e.offsetY);
      var playButtonArea = this._playButtonArea;

      if (!(point.x >= playButtonArea.left && point.x <= playButtonArea.left + playButtonArea.width)) {
        return;
      }

      if (!(point.y >= playButtonArea.top && point.y <= playButtonArea.top + playButtonArea.height)) {
        return;
      }

      if (this._isPlaying) {
        this.stop();
      } else {
        this.play();
      }
    }
  }, {
    key: 'onmouseenter',
    value: function onmouseenter(e) {
      this._isHover = true;
    }
  }, {
    key: 'onmouseleave',
    value: function onmouseleave(e) {
      this._isHover = false;
    }
  }, {
    key: 'onwheel',
    value: function onwheel(e) {

      var wheelSpeed = 0.01;

      var fov = this._gl_driver.fov - e.deltaY * wheelSpeed;

      if (fov < FOV_MIN) {
        fov = FOV_MIN;
      } else if (fov > FOV_MAX) {
        fov = FOV_MAX;
      }

      this._gl_driver.fov = fov;

      e.stopPropagation();
    }
  }, {
    key: 'ondragstart',
    value: function ondragstart(e) {
      this._dragStart = {
        x: e.offsetX,
        y: e.offsetY,
        rx: this._gl_driver.rotateX,
        ry: this._gl_driver.rotateY
      };

      e.stopPropagation();
    }
  }, {
    key: 'ondragmove',
    value: function ondragmove(e) {

      if (!this._isPlaying) return;

      var zoom = this._gl_driver.fov;
      var rx = this._dragStart.rx - (e.offsetY - this._dragStart.y) / 500 / zoom;
      var ry = this._dragStart.ry + (e.offsetX - this._dragStart.x) / 500 / zoom;

      this._gl_driver.rotateX = Math.min(ROTATE_MAX, Math.max(ROTATE_MIN, rx));
      this._gl_driver.rotateY = Math.min(ROTATE_MAX, Math.max(ROTATE_MIN, ry));

      e.stopPropagation();
    }
  }, {
    key: 'ondragend',
    value: function ondragend(e) {
      e.stopPropagation();
    }
  }]);

  return WS4ChVideo;
}(Rect);

exports.default = WS4ChVideo;


Component.register('ws-4ch-video', WS4ChVideo);

},{"./gl-driver":1,"./mpeg-ws":5}],7:[function(require,module,exports){
"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _get = function get(object, property, receiver) { if (object === null) object = Function.prototype; var desc = Object.getOwnPropertyDescriptor(object, property); if (desc === undefined) { var parent = Object.getPrototypeOf(object); if (parent === null) { return undefined; } else { return get(parent, property, receiver); } } else if ("value" in desc) { return desc.value; } else { var getter = desc.get; if (getter === undefined) { return undefined; } return getter.call(receiver); } };

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var _scene = scene;
var Component = _scene.Component;
var Rect = _scene.Rect;


function roundSet(round, width, height) {
  var max = width > height ? height / width * 100 : 100;

  if (round >= max) round = max;else if (round <= 0) round = 0;

  return round;
}

var WSLiveVideo = function (_Rect) {
  _inherits(WSLiveVideo, _Rect);

  function WSLiveVideo() {
    _classCallCheck(this, WSLiveVideo);

    return _possibleConstructorReturn(this, Object.getPrototypeOf(WSLiveVideo).apply(this, arguments));
  }

  _createClass(WSLiveVideo, [{
    key: "_draw",
    value: function _draw(ctx) {

      this._ctx = ctx;

      if (!this._player) {
        this._isPlaying = false;

        var client;

        if (this.model.url && this.model.url.match(/^ws[s]?:\/\//)) {
          this.isLive = true;
          client = new WebSocket(this.model.url);
        } else {
          this.isLive = false;
          client = this.app.url(this.model.url);
        }

        this._player = new jsmpeg(client, {
          autoplay: this.model.autoplay || false,
          onload: this.onLoaded.bind(this),
          ondecodeframe: this.drawDecoded.bind(this)
        });

        if (this.model.autoplay) {
          this._isPlaying = true;
        }
      }

      var _model = this.model;
      var left = _model.left;
      var top = _model.top;
      var width = _model.width;
      var height = _model.height;
      var round = _model.round;


      _get(Object.getPrototypeOf(WSLiveVideo.prototype), "_draw", this).call(this, ctx);
      if (this._isPlaying) {
        ctx.save();

        round = roundSet(round, width, height);
        if (round > 0) {
          this.drawRoundedImage(ctx);
        }

        ctx.drawImage(this._player.canvas, 0, 0, this._player.width, this._player.height, this.model.left, this.model.top, this.model.width, this.model.height);

        if (this._isHover) {
          this.drawStopButton(ctx);
        }

        ctx.restore();
      } else {
        this.drawPlayButton(ctx);
      }
    }
  }, {
    key: "drawRoundedImage",
    value: function drawRoundedImage(ctx) {
      var _model2 = this.model;
      var left = _model2.left;
      var top = _model2.top;
      var width = _model2.width;
      var height = _model2.height;
      var round = _model2.round;


      var tmpRound = round / 100 * (width / 2);
      ctx.beginPath();

      ctx.moveTo(left + tmpRound, top);
      ctx.lineTo(left + width - tmpRound, top);
      ctx.quadraticCurveTo(left + width, top, left + width, top + tmpRound);
      ctx.lineTo(left + width, top + height - tmpRound);
      ctx.quadraticCurveTo(left + width, top + height, left + width - tmpRound, top + height);
      ctx.lineTo(left + tmpRound, top + height);
      ctx.quadraticCurveTo(left, top + height, left, top + height - tmpRound);
      ctx.lineTo(left, top + tmpRound);
      ctx.quadraticCurveTo(left, top, left + tmpRound, top);
      ctx.closePath();

      ctx.clip();
    }
  }, {
    key: "drawSymbol",
    value: function drawSymbol(ctx) {
      var image = new Image();
      image.src = 'data:image/svg+xml;utf8;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iaXNvLTg4NTktMSI/Pgo8IS0tIEdlbmVyYXRvcjogQWRvYmUgSWxsdXN0cmF0b3IgMTYuMC4wLCBTVkcgRXhwb3J0IFBsdWctSW4gLiBTVkcgVmVyc2lvbjogNi4wMCBCdWlsZCAwKSAgLS0+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgdmVyc2lvbj0iMS4xIiBpZD0iQ2FwYV8xIiB4PSIwcHgiIHk9IjBweCIgd2lkdGg9IjUxMnB4IiBoZWlnaHQ9IjUxMnB4IiB2aWV3Qm94PSIwIDAgMzQ3Ljg0NiAzNDcuODQ2IiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCAzNDcuODQ2IDM0Ny44NDY7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPGc+Cgk8Zz4KCQk8Zz4KCQkJPHBhdGggZD0iTTI1OS4wOTUsMjcwLjkxM2MzOC40OS0yNi45NjIsNjMuNzExLTcxLjU5LDYzLjcxMS0xMjIuMDQyQzMyMi44MDYsNjYuNzg2LDI1Ni4wMzIsMCwxNzMuOTIzLDAgICAgIEM5MS44MjgsMCwyNS4wNCw2Ni43ODYsMjUuMDQsMTQ4Ljg3MWMwLDUwLjk1LDI1LjcxNiw5NS45NjMsNjQuODIyLDEyMi44MUM3MCwyNzkuNzg4LDU5LjE4OSwyOTAuNjIsNTkuMTg5LDMwMi44MSAgICAgYzAsMjkuMjQ0LDU5Ljg5OCw0NS4wMzYsMTE2LjI2NSw0NS4wMzZjNTYuMzQ5LDAsMTE2LjIzNS0xNS43OTIsMTE2LjIzNS00NS4wMzYgICAgIEMyOTEuNjg4LDI5MC4xODIsMjgwLjIxMywyNzkuMDkxLDI1OS4wOTUsMjcwLjkxM3ogTTE3My41NjUsNDYuMjIyYzYuOTQ3LDAsMTIuNTU5LDUuNjI2LDEyLjU1OSwxMi41NjggICAgIGMwLDYuOTM2LTUuNjExLDEyLjU2OC0xMi41NTksMTIuNTY4Yy02LjkyNCwwLTEyLjU1Ni01LjYzMy0xMi41NTYtMTIuNTY4QzE2MS4wMDksNTEuODQ5LDE2Ni42NDIsNDYuMjIyLDE3My41NjUsNDYuMjIyeiAgICAgIE0xNzMuOTIzLDg1LjAyMmMzNS4yMjQsMCw2My44NjYsMjguNjQ4LDYzLjg2Niw2My44NTRzLTI4LjY0Myw2My44NzMtNjMuODY2LDYzLjg3M2MtMzUuMjE1LDAtNjMuODY0LTI4LjY1NS02My44NjQtNjMuODczICAgICBDMTEwLjA1OSwxMTMuNjY1LDEzOC43MDgsODUuMDIyLDE3My45MjMsODUuMDIyeiBNMTc1LjQ1NCwzMzUuMjg0Yy02NC4yMzYsMC0xMDMuNjgyLTE4LjkyMi0xMDMuNjgyLTMyLjQ3NSAgICAgYzAtNy44MywxMi4xOTMtMTYuNDQsMzEuODY4LTIyLjczM2MyMC45NTEsMTEuMjg5LDQ0Ljg4MywxNy42OSw3MC4yODksMTcuNjljMjUuODYyLDAsNTAuMTc2LTYuNjQyLDcxLjM3OS0xOC4yNzkgICAgIGMyMC42MDMsNi4yODEsMzMuODMxLDE1LjI4OCwzMy44MzEsMjMuMzIyQzI3OS4xMjcsMzE2LjM2MiwyMzkuNjg4LDMzNS4yODQsMTc1LjQ1NCwzMzUuMjg0eiIgZmlsbD0iIzAwMDAwMCIvPgoJCTwvZz4KCQk8Zz4KCQkJPHBhdGggZD0iTTE3My45MjMsMTkxLjM3OWMyMy40MzEsMCw0Mi41MDItMTkuMDY4LDQyLjUwMi00Mi40OTZjMC0yMy40MjQtMTkuMDcxLTQyLjQ5My00Mi41MDItNDIuNDkzICAgICBjLTIzLjQyOCwwLTQyLjQ4NCwxOS4wNjgtNDIuNDg0LDQyLjQ5M0MxMzEuNDM4LDE3Mi4zMTEsMTUwLjQ5NSwxOTEuMzc5LDE3My45MjMsMTkxLjM3OXoiIGZpbGw9IiMwMDAwMDAiLz4KCQk8L2c+Cgk8L2c+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPC9zdmc+Cg==';
      ctx.drawImage(image, 0, 0, image.width, image.height, this.model.left + this.model.width * 0.25, this.model.top + this.model.height * 0.25, this.model.width * 0.5, this.model.height * 0.5);
    }
  }, {
    key: "drawComponentFrame",
    value: function drawComponentFrame(ctx) {
      ctx.beginPath();
      ctx.moveTo(this.model.left, this.model.top);
      ctx.lineTo(this.model.left + this.model.width, this.model.top);
      ctx.lineTo(this.model.left + this.model.width, this.model.top + this.model.height);
      ctx.lineTo(this.model.left, this.model.top + this.model.height);
      ctx.lineTo(this.model.left, this.model.top);
      ctx.stroke();
      ctx.closePath();
    }
  }, {
    key: "drawPlayButton",
    value: function drawPlayButton(ctx) {
      this.drawActionButton(ctx, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoyNThCQUYyNDMyMTYxMUU2QjY1QUUzMjAyRjNBQUJEMSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoyNThCQUYyNTMyMTYxMUU2QjY1QUUzMjAyRjNBQUJEMSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjBEMUU5RDgxMzIwNDExRTZCNjVBRTMyMDJGM0FBQkQxIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjBEMUU5RDgyMzIwNDExRTZCNjVBRTMyMDJGM0FBQkQxIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+tES3iAAAEldJREFUeNrknQlw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");
    }
  }, {
    key: "drawStopButton",
    value: function drawStopButton(ctx) {
      this.drawActionButton(ctx, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoyNThCQUYyODMyMTYxMUU2QjY1QUUzMjAyRjNBQUJEMSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoyNThCQUYyOTMyMTYxMUU2QjY1QUUzMjAyRjNBQUJEMSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjI1OEJBRjI2MzIxNjExRTZCNjVBRTMyMDJGM0FBQkQxIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjI1OEJBRjI3MzIxNjExRTZCNjVBRTMyMDJGM0FBQkQxIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+8iPbzgAAEPNJREFUeNrsXXtQXNUZ3xdvWJYNy5IsSXgUEAJNFMKAMbV56KCtM7GlWvuYdpw2/mN9dKq18ZFqtT7ro3XamWg7bZ36mNqmlqmx1ViNwWgakxAQBFQIu8gubJZ98NiF3dDfFy8UE/Z+d/fuLrtsz8wOjz333PP9vve5535HqYjDVlxcnGaz2Ur9fn/J6dOni/Ev0+zsrAE/9fi7RexalUr1In44lErlKH4O4e8BjUbTbzQaPx4YGPDFG63KeJhERUWF2mw2V83MzNQB4M8D7DJ81EG6X8EM17oooUplAJ+PwJATKSkp761evbq7t7c3kLQMaGhoUHZ0dNROT09fDNAbAbhW4qVhMWARhrjBjHdSU1PfrK2t7Th8+PBsUjBAp9NpJyYmLg0EApcB+IIwhogIA84yWyNqtXpfVlbWv5xOp3tZMiAnJ8cwNTXVAuC3QdrTZAwVcQYs0AofGLE/IyPjRY/HM7osGKDVanMnJye/DofajD81ERgyagxY0Pxw3K9kZmY+73a7XdHERxWtgdesWaOGs9sBSdoD8L8cIfBj1TQ0Z5o70UC0JJQGQIXLfT7fDUIIGekWCw0420cMpKWl/RImtC+uGYD4XT00NHQNwkmK1WVJDeyxF59eEE+hYz9MwlBubq5teHhY1CSsXLky1+VyGSHBJggA5REU0lbgky6TvAC04UWTyfQc8olA3DEgOzs7H7b+VhBcJUPSzPgcEuL0nkjF6UKeUSnkGU34rJYxx274hofGx8ftccOA9PT0Gpic2yBluWFIugeRx+sY4zUQNRALAw9hKfZ6vdsRkW3FnHPCmLMLJukBjNG55AxAIrMNydT1oTpZSJIVwP9Vr9e/brPZlmSJwGg0pjkcjq1gxFegFYWhRkqg/UnQvl/OHNQywb8KE7gulGgK0mPHdU+vXbv2V3a7vRdJ2ZItB9C9AfyHpaWlL+P3EfIX+HemVBkC4xpBC34E3o+5BsBOfxc29ashXDINR7oXEv/nkZGRuFsUo1ZQUEAa8TU48CtJvkLA4i/A4vcx0wDc8DtCpCPV3PQgNP0p/MTBpZR4iRpxAk72bUh1OfxDvpTrcE01MEnFz/aoMwAq1wLwvyGx+ywm9gIimsdHR0cjklG2tLQox8bGcuE/8vHRY3wdAMuGZqmam5unu7q6ZN8D9LlhIveDIQTuOimWgpgAbGbAuK6omSDcYAts/g8l2no3IoWHESkcl+EkM51O5zoQdR6ksRSfInouEGypWlhyHsXHgs/HYNAHOp3ufTj5SRkR3gZo7i1SV2uB0aPA6N8RZwBMSCUywZ9LsY0wORb0vxsSZA2VYEiy1uPxXASJugjAV8sNFCiBAiO6MKeDOTk5B2HjQ17tzMrKKkSOs5sEQIqvA+27gFVPxBiAiechRn8cE9BLAL8X/e9GNhoSoTAjZZC0KwH6piiuG/nBjDZo5l4A+lEoFyILJ8HYDcGokKD9DuQaN6H/mGwfUFNTo0T6v4vSeilZYl5e3m7Y6PEQgC/F2DdAba8Fg4sVUVwgpLHpHrDxzWBEBSTVjN/HpFwI4fBBOw/iR43weFTUYECQStatW/cGIj55DACYVyIsu0wC+H2wt3dBxSXZW/TNwrg7QdD1IMgU64gH91xFjEBorNdqtV3wVTPcNTArMxCwNsx5A65fwYxfCOymIFwfhM0ASGcRbvZjrh9Ubhhm53Y4TEmSD8dWB/9wDyZXq1ja59JKzOFzoHEr5mSGQAxLYQJofQca20TWmYmM1lFIS1FVUMEN9kVTU5MSUvEDzukC/Emo8j1SHlyUlJSoIXHXYtzdUvxJDLVBT3OiudEcuf5EK9FMtHNBEWFIWIasAbBd2yAR3Nq7Ag7tQdykm+sH1c3EmHfANm5RxMlujEW0oQqOsxLm8V3OJJFUg3Yz6PkCw1wD6LahX79kBuTn56cj6rmTnInY4JCYlzAR9gEIIohcSM19lKwo4rwBsJUwL3XwC4fI8YrGt4HAEDDIAl3nMaaoEpjuQ+Tll8QATKAFFzUwTtdsMBgeBKMCHPiQqvuj9HQsWkzIg2BtBBMOckwoKCjoBLAXMkvxGcB0Bhh0sj4AoVYWOLuDmyPU7wmr1TrNJFXpQuy8WpFgjeZMcycaxPoRBoQFYcJoyw7CltUAcJ7WxusZ0/NPcHQflz9YLJZdQqSTkI1CTdBJ8fwBsXgevvIUhbMUUYk5ZGDrRZ/3g2qAyWSixe0ruKgHqfkz3OR7enquxlgbFQneiAaiRcJyxTNcVETYEsZBNQDm7mJ0+iIj/S8gFj7KxPnVkJyb4zTaCccc1YKmdkj6qFimDGzUtLdVDBp0+2RhRKQ6i0PNjPR7EKK1Mk4pDTe5abmAP0c60US0Mdl9K2HEaEHzoiYI2Z0JX4ruaKD9k3a7XVTNHA7HVRTKKZZZI5qINrE+hA1hxDCgirA+hwEwK5s5cwg79w+xDrT/E2q6Q7FMG9FGNDK+gDAKMMsZm89hAGzXJkb6/+NyuRxifRAPX6MI4VlqArZUgcagjTAirBifMo+1RrBdBqfTWcw43/1Qn6DfI2nJR7a7JQKqzkVhrdG4NoSoaAtofRa02hmsGkUYUCxgPnpGAyYmJuq40BMO6Cgj/V9SJNYG3HCbRqBVLBA5yoWkc5ir5sIsZtnhqNlsDpr1lpWVqcHxSxRJ0ohWojnY94QVYcaFtvMMgOpWMQw4IvY9Mt7zw9mWmMARUS7RLAezOcxVBoMhD9wQ9ezZ2dkdTHRwoSLJGkczhxlhTtir4EyKGU46xsbGRhhu1iUbAziaCTPCTqwPYU/7G9cwDlh09wAiAtqHr082BhDNRLsc7Ah7FfdAHIOcZJKKSkWSNo52DjvCnpywgRnEwkhCabIygKOdw46wV3EPx5HVcfbflKwM4GiXgJ2eNEB0z2NKSgq3ccmoSN5mlImdljQgk3GyHmaQ3CRmQK4c7Ah7FeyU6M6HoqIiLzOJzCRmgCjtJpPJy/iIDBUcieiDk8bGRj/DRU2yos/R3tTU5GecuJI0gMv4lIr/t3CzZSWjAQpigOjDgwMHDmiYQaaTFWCOdgnYBSgKErVTw8PDnI2fSGIhn5CJnVfFDeL1erlXc8aSmAFjMrGbIAY4xXrMzMysYNRoJIlN0Igc7Ah78gF2xlMXMJMYTGIGDDLYGZnr7aQBI8wgovs6VSrVx8nKAI52YMe91EdL1iozE+sWi32fnZ3dnawM4GgHdiUMA80qjUbDMaCsvr4+aDzrQKPXUpNQ+i1Ee7DvgZka2Ilt1qXdEydV+fn5tE8xILZe0d3dXcpM5kgSMkCUZmBWzBSJChgMhgGV2Wz2YjDRBwc+n09swym9HX4w2RjA0UxvUjIMPDk4OOhTCd64i3EmotvMJycnezDgUBJJ/xDRzGBWz0RAZ94TUAm26DgzWLVerxddeuU2pS6nxtFKWHGl24B5+zwDdDpdOzgitnKn9ng8ontHtVrtqxhj2S9LEI1Eq1gfYEWbb9UiY/jz8vL+xwCbzUZ+QLTWTSAQuFTs+1OnTtHW7NYkkP5WopXBajtjwtqtVuuZNTjNgn++hQvrRMxQWWZmZgVsX6+IFuwdGxu7PIRC3ItJR+tSXCtxfBfRKBJ9KgSMyhgGvDW30Xl+ezrM0CGx5VW6OS7KEhuY6kSkpKT8YblKP2j7I1cLgzCiWkkiOPoI63lmzP0yOjo6Cc60LXIN1VF+CRddh9DqGDfJ2traVzFO53IDn2gi2rh+hBGw2kmYLZZfYZy3Cet5hpylPlVQn4cW2Lsj6enpv52YmAgp0xUKHD3BPfBPIMc7CWxuDLUAFXAo8nq931to2jHOrcBmfgnjM556ZmbGDg5tpLLBaWlpj+Hv58QqfQRruGYc11tx44uWAwNAy6NTU1NdYeDghhC+ASHugw8tB6626enpP32GuYssMK1EiDSKDNkfAZsZamnLeLT7YZekXNiKioo0TqfTMD4+/pmSOOfEquDQuNvtPh2JydfU1LTb7XY6gGdtgoacB6qrq3+DMF32WIQpYXvOPaJJAE0cnD8M21kiseBdPIH/7qpVqx7p6+s7Hc37hF2fjUwV1PPblZWVolsvyJSBkAdImhJJ8mnOnBkuLy9XEgbAojDse4V6wYoVK9JhE78J734zvZYP1aLNXSc49UMIdwgxdGq81wwim09mR4rkezyebwGLq2FaqPZchl6v71msJlBEGEAPZWDPt8Kc3AkQ6+aupbpoiBJOIuIxc+YIfY9TlSn8vIBojbdQk6IdgPl3KTYffS8UCpeTBaAaEdWIlLanpqa6N27cOGCxSIvcJe16o6KtSDB2itTM9CHU2gWt6JWaJ6DvjWBaTZyYnE7M/wmpcT76VmL+9xEfgiRtvWDQHinFW1kNyMnJKcbEHmMKWWsAZhOSjPegkmzxPsoTGhoaXkdGOCqU+0pfIql3QWL31NXVPdXf3z8uURjXQhh/phDZmEt1hvx+/yVarfZt9HXJ1gDYt+uEk5BYgjDBn8AOmkPwKZkul4sq5l6BiWfFCPgJWtXMzc3dy61sng0+Sb6UV3KBWSsw2xMRH2A0GtsB6gVcsVKSZNx0M1S0k6pISRmb6nBCCzrAiJdxDe00M8pZTWXWcywA5nmdTvc4tPoo3VvqtaCpgiRfCvhkgoDZw3DSrCOXvPOZDunBpB+lgnYSutNSxi8w4XfCAQqmrBwObhM91sNnrUzQT9IDdJiaNghRWMdQgZZG0PKjYDb/LO0ag4+7CRmvI2JOeIEKlkNq7pcyEcWnZwc8i1j5ha6urrAPyszPz6eSl1XCcVRUvp526unIl+N/GgFkCv3oaZyTtgvSy3F0/BVscDcit7DPLUA4qkQ4erVwXoIUrHxkgkM5b0wZhjTUQxrukGq+YGuPQ6Ifgzo6FAnUEHzooTE3wzdtkHiJH9jcC2zei2oihgl9ghtZKOqRkklTEWtIEMXHDlwzkAjg00EVcLZ3hmD+AsDkEYD/btQzYYEJg5ikZCaQ4lBfaEM1tOHDcJa4Y9Fgu1cD9FuEQ3zSQgS/LayITM6EBXN0WwiTPTNhKmgEW/l8rI6MlWBu6KhdOvF1W4hC6aMD3YBB2DsDZb//BSAroK53hVGuhk6zeBPh3d8QXQ0skcTTiXo7oJ0XK0IsNkXRDuZ+LxjXK2cOEXkBDyGqAQ7rduEgtHCWAroRtbyGxOgQohZPNEFHVJWDxI/Ok9zOVYkUCW37YErvR6gpW4Mj9gZkQUFBqsPh+L5wcHO4jbSik+J2qHb7+vXrT7a1tck6633Tpk3K9vZ2ymDXQ0vrhfWnsF+thfnch6TxaZvNFpGXEyP+CiolLXS2ZCQqaNGSAZV8oaojwkmrI/T6Pz5uvV4/VVNTc2bpt7OzUwPmZ8C5a/GhAlQF9GIJPYmj7fWRWOIQ1o2eDDe5jBkDqNEx5rDrO7nDDRKlka+CmX0Kpivix5tH9SVsOgQN2rAzEcvXzy1j0GopzNeJqDE3mgTAH1jLyspeIWcV4kmlS9roND4A/7uSkpJfj4yMWKN6r1gRVVRUlArHNXd278o4lfhhOuPYaDS+ZrFY/DFhdqyJ3LBhg7K7u7se2nE5mHF+tLVQSmII0I8hunm5urr6yLFjx2Zjqm1LSblOp9PDWW+m4wuFJ2Oxms8spP0DOtYQydhbTqdzyRYK46YSCr1VAl9xAZhB8fp5YIgpwuZliF7FAugdiGiOImx1xQPdcVuKprCwMAeSWUKlHak2Gz5Gob4dPS2juD5jrtYRwCWzMaX49JmAmw7TpH2Y+AwB8EFoWr/VavXEI53/FWAAQVN7ZRtll2cAAAAASUVORK5CYII=");
    }
  }, {
    key: "drawActionButton",
    value: function drawActionButton(ctx, imageData) {
      var image = new Image();
      image.src = imageData;
      ctx.drawImage(image, 0, 0, image.width, image.height, this.model.left + this.model.width / 2 - image.width / 2, this.model.top + this.model.height / 2 - image.height / 2, image.width, image.height);

      this._playButtonArea = {
        left: this.model.left + this.model.width / 2 - image.width / 2,
        top: this.model.top + this.model.height / 2 - image.height / 2,
        width: image.width,
        height: image.height
      };
    }
  }, {
    key: "onLoaded",
    value: function onLoaded() {
      this.loaded = true;
    }
  }, {
    key: "drawDecoded",
    value: function drawDecoded(scope, canvas) {
      if (this._isPlaying) {
        this.invalidate();
      }
    }
  }, {
    key: "play",
    value: function play() {
      if (!this._player) {
        return;
      }

      this._isPlaying = true;

      if (this.isLive) {
        this.playLive();
        return;
      }

      if (this.loaded) this._player.play();else {
        this._isPlaying = false;
        this.reconnect();
      }
    }
  }, {
    key: "playLive",
    value: function playLive() {
      if (!this._player || !this._player.client) {
        return;
      }

      if (this._player.client.readyState === WebSocket.CLOSED) {
        this.reconnect();
      }
    }
  }, {
    key: "stop",
    value: function stop() {
      this._isPlaying = false;
      this.invalidate();

      if (!this.isLive) {
        this._player.pause();
      }
    }
  }, {
    key: "reconnect",
    value: function reconnect() {
      if (this._player) {
        this._player.stop();
      }
      this._player = null;
    }
  }, {
    key: "onchange",
    value: function onchange(after, before) {
      var self = this;

      if (after.hasOwnProperty('url')) {
        var isChanged = after.url != before.url;

        if (isChanged) {
          self.reconnect();
        }
      }

      if (after.hasOwnProperty('autoplay')) {
        var isChanged = after.autoplay != before.autoplay;

        if (isChanged) {
          self.reconnect();
        }
      }
    }
  }, {
    key: "onclick",
    value: function onclick(e) {

      var point = this.transcoordC2S(e.offsetX, e.offsetY);
      var playButtonArea = this._playButtonArea;

      if (!(point.x >= playButtonArea.left && point.x <= playButtonArea.left + playButtonArea.width)) {
        return;
      }

      if (!(point.y >= playButtonArea.top && point.y <= playButtonArea.top + playButtonArea.height)) {
        return;
      }

      if (this._isPlaying) {
        this.stop();
      } else {
        this.play();
      }
    }
  }, {
    key: "onmouseenter",
    value: function onmouseenter(e) {
      this._isHover = true;
    }
  }, {
    key: "onmouseleave",
    value: function onmouseleave(e) {
      this._isHover = false;
    }
  }]);

  return WSLiveVideo;
}(Rect);

exports.default = WSLiveVideo;


Component.register('ws-live-video', WSLiveVideo);

},{}]},{},[1,2,3,4,5,6,7]);
