/*
 * Copyright © HatioLab Inc. All rights reserved.
 */
import BitReader from './mpeg-bit-reader'
import MpegDecoder from './mpeg-decoder'
// import GLDriver from './gl-driver'

const BUFFER_SIZE = 512 * 1024
const HEADER = 'jsmp'
const HJ = HEADER.charCodeAt(0)
const HS = HEADER.charCodeAt(1)
const HM = HEADER.charCodeAt(2)
const HP = HEADER.charCodeAt(3)

const START_PICTURE = 0x00
const DECODE_SKIP_OUTPUT = 1

var requestAnimFrame = (function(){
  return window.requestAnimationFrame ||
    window.webkitRequestAnimationFrame ||
    window.mozRequestAnimationFrame ||
    function( callback ){
      window.setTimeout(callback, 1000 / 60);
    };
})();

function now() {
  return window.performance
    ? window.performance.now()
    : Date.now();
}

export default class MpegWs {
  constructor(url, opts) {

    opts = opts || {};
    // this.progressive = (opts.progressive !== false);
    // this.benchmark = !!opts.benchmark;
    // this.canvas = opts.canvas || document.createElement('canvas');
    // this.autoplay = !!opts.autoplay;
    // this.wantsToPlay = this.autoplay;
    // this.loop = !!opts.loop;
    // this.seekable = !!opts.seekable;

    this.gl_driver = opts.glDriver || null;

    this.externalDecodeCallback = opts.ondecodeframe || null;

    this.renderFrame = this.renderFrameGL;

    // this.pictureRate = 30;
    // this.lateTime = 0;
    // this.firstSequenceHeader = 0;
    // this.targetTime = 0;

    // this.benchmark = false;
    // this.benchFrame = 0;
    // this.benchDecodeTimes = 0;
    // this.benchAvgFrameTime = 0;

    this.client = new WebSocket(url)
    this.client.onopen = this.initSocketClient.bind(this);
  }

  dispose() {
    this.client && this.client.close()
    // this._gl_driver = null
  }

  initSocketClient() {

    this.buffer = new BitReader(new ArrayBuffer(BUFFER_SIZE));

    this.nextPictureBuffer = new BitReader(new ArrayBuffer(BUFFER_SIZE));
    this.nextPictureBuffer.writePos = 0;
    this.nextPictureBuffer.chunkBegin = 0;
    this.nextPictureBuffer.lastWriteBeforeWrap = 0;

    this.client.binaryType = 'arraybuffer';
    this.client.onmessage = this.receiveSocketMessage.bind(this);
  }

  decodeSocketHeader( data ) {
    // Custom header sent to all newly connected clients when streaming
    // over websockets:
    // struct { char magic[4] = 'jsmp'; unsigned short width, height; };
    if(data[0] === HJ && data[1] === HS && data[2] === HM && data[3] === HP) {
      this.width = (data[4] * 256 + data[5]);
      this.height = (data[6] * 256 + data[7]);
      this.initBuffers();

      // this._gl_driver = new GLDriver(this.width, this.height)
    }
  }

  scheduleDecoding() {
    this.decoder.decodePicture(this.decodeCallback.bind(this));
    this.currentPictureDecoded = true;
  }

  decodeCallback() {
    // console.log('decode callback')
    // if(this._gl_driver) {
    //   var buffer_Y = this.decoder.currentY.buffer
    //   var buffer_Cr = this.decoder.currentCr.buffer
    //   var buffer_Cb = this.decoder.currentCb.buffer

    //   this._gl_driver.renderFrameGL(buffer_Y, buffer_Cr, buffer_Cb)
    // }
    if(this.externalDecodeCallback) {
      var buffer_Y = this.decoder.currentY.buffer
      var buffer_Cr = this.decoder.currentCr.buffer
      var buffer_Cb = this.decoder.currentCb.buffer

      // this.externalDecodeCallback(this, this._gl_driver.canvas);
      this.externalDecodeCallback(this, buffer_Y, buffer_Cr, buffer_Cb);
    }
  }

  initBuffers() {

    // Sequence already started? Don't allocate buffers again
    if( this.sequenceStarted ) { return; }
    this.sequenceStarted = true;

    this.decoder = new MpegDecoder(this.buffer, this.width, this.height)

    // this.gl_driver.canvas.width = this.width;
    // this.gl_driver.canvas.height = this.height;

    // this.canvas.width = this.width;
    // this.canvas.height = this.height;

    // this.gl.useProgram(this.program);
    // this.gl.viewport(0, 0, this.width, this.height);
  }

  receiveSocketMessage(event) {

    var messageData = new Uint8Array(event.data);

    if( !this.sequenceStarted ) {
      this.decodeSocketHeader(messageData);
    }

    var current = this.buffer;
    var next = this.nextPictureBuffer;

    if( next.writePos + messageData.length > next.length ) {
      next.lastWriteBeforeWrap = next.writePos;
      next.writePos = 0;
      next.index = 0;
    }

    next.bytes.set( messageData, next.writePos );
    next.writePos += messageData.length;

    var startCode = 0;
    while( true ) {
      startCode = next.findNextMPEGStartCode();
      if(
        startCode === BitReader.NOT_FOUND ||
        ((next.index >> 3) > next.writePos)
      ) {
        // We reached the end with no picture found yet; move back a few bytes
        // in case we are at the beginning of a start code and exit.
        next.index = Math.max((next.writePos-3), 0) << 3;
        return;
      }
      else if( startCode === START_PICTURE ) {
        break;
      }
    }

    // If we are still here, we found the next picture start code!

    // Skip picture decoding until we find the first intra frame?
    if( this.waitForIntraFrame ) {
      next.advance(10); // skip temporalReference
      if( next.getBits(3) === PICTURE_TYPE_I ) {
        this.waitForIntraFrame = false;
        next.chunkBegin = (next.index-13) >> 3;
      }
      return;
    }

    // Last picture hasn't been decoded yet? Decode now but skip output
    // before scheduling the next one
    if( !this.currentPictureDecoded ) {
      this.decoder.decodePicture(undefined, DECODE_SKIP_OUTPUT);
    }

    // Copy the picture chunk over to 'this.buffer' and schedule decoding.
    var chunkEnd = ((next.index) >> 3);

    if( chunkEnd > next.chunkBegin ) {
      // Just copy the current picture chunk
      current.bytes.set( next.bytes.subarray(next.chunkBegin, chunkEnd) );
      current.writePos = chunkEnd - next.chunkBegin;
    }
    else {
      // We wrapped the nextPictureBuffer around, so we have to copy the last part
      // till the end, as well as from 0 to the current writePos
      current.bytes.set( next.bytes.subarray(next.chunkBegin, next.lastWriteBeforeWrap) );
      var written = next.lastWriteBeforeWrap - next.chunkBegin;
      current.bytes.set( next.bytes.subarray(0, chunkEnd), written );
      current.writePos = chunkEnd + written;
    }

    current.index = 0;
    next.chunkBegin = chunkEnd;

    // Decode!
    this.currentPictureDecoded = false;
    requestAnimFrame( this.scheduleDecoding.bind(this) );
  }
}
