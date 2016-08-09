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

export default class MpegFile {
  constructor(url, opts) {

    opts = opts || {};
    this.progressive = (opts.progressive !== false);
    this.benchmark = !!opts.benchmark;
    this.canvas = opts.canvas || document.createElement('canvas');
    this.autoplay = !!opts.autoplay;
    this.wantsToPlay = this.autoplay;
    this.loop = !!opts.loop;
    this.seekable = !!opts.seekable;
    this.externalDecodeCallback = opts.ondecodeframe || null;

    this.renderFrame = this.renderFrameGL;

    this.pictureRate = 30;
    this.lateTime = 0;
    this.firstSequenceHeader = 0;
    this.targetTime = 0;

    this.benchmark = false;
    this.benchFrame = 0;
    this.benchDecodeTimes = 0;
    this.benchAvgFrameTime = 0;

    this.canvasContext = this.canvas.getContext('2d');

    this.load(url)
  }

  load(url) {

  	this.url = url;

  	var request = new XMLHttpRequest();
  	var that = this;
  	request.onreadystatechange = function() {
  		if( request.readyState == request.DONE && request.status == 200 ) {
  			that.loadCallback(request.response);
  		}
  	};
  	// request.onprogress = this.updateLoader.bind(this);

  	request.open('GET', url);
    request.withCredentials = true
  	request.responseType = "arraybuffer";
  	request.send();

  }

  loadCallback(file) {

  	var time = Date.now();
  	this.buffer = new BitReader(file);
    this.decoder = new MpegDecoder(this.buffer, this.width, this.height)

  	this.decoder.findStartCode(MpegDecoder.START_SEQUENCE);
  	this.firstSequenceHeader = this.buffer.index;
  	this.decodeSequenceHeader();

  	// Load the first frame
  	this.nextFrame();

  	if( this.autoplay ) {
  		this.play();
  	}

  	if( this.externalLoadCallback ) {
  		this.externalLoadCallback(this);
  	}

  }

  decodeSequenceHeader() {
  	this.width = this.buffer.getBits(12);
  	this.height = this.buffer.getBits(12);
  	this.buffer.advance(4); // skip pixel aspect ratio
  	this.pictureRate = MpegDecoder.PICTURE_RATE[this.buffer.getBits(4)];
  	this.buffer.advance(18 + 1 + 10 + 1); // skip bitRate, marker, bufferSize and constrained bit

  	this.initBuffers();

  	if( this.buffer.getBits(1) ) { // load custom intra quant matrix?
  		for( var i = 0; i < 64; i++ ) {
  			this.customIntraQuantMatrix[ZIG_ZAG[i]] = this.buffer.getBits(8);
  		}
  		this.intraQuantMatrix = this.customIntraQuantMatrix;
  	}

  	if( this.buffer.getBits(1) ) { // load custom non intra quant matrix?
  		for( var i = 0; i < 64; i++ ) {
  			this.customNonIntraQuantMatrix[ZIG_ZAG[i]] = this.buffer.getBits(8);
  		}
  		this.nonIntraQuantMatrix = this.customNonIntraQuantMatrix;
  	}
  }

  initBuffers() {
  	this.intraQuantMatrix = MpegDecoder.DEFAULT_INTRA_QUANT_MATRIX;
  	this.nonIntraQuantMatrix = MpegDecoder.DEFAULT_NON_INTRA_QUANT_MATRIX;

  	this.mbWidth = (this.width + 15) >> 4;
  	this.mbHeight = (this.height + 15) >> 4;
  	this.mbSize = this.mbWidth * this.mbHeight;

  	this.codedWidth = this.mbWidth << 4;
  	this.codedHeight = this.mbHeight << 4;
  	this.codedSize = this.codedWidth * this.codedHeight;

  	this.halfWidth = this.mbWidth << 3;
  	this.halfHeight = this.mbHeight << 3;
  	this.quarterSize = this.codedSize >> 2;

  	// Sequence already started? Don't allocate buffers again
  	if( this.sequenceStarted ) { return; }
  	this.sequenceStarted = true;


  	// Manually clamp values when writing macroblocks for shitty browsers
  	// that don't support Uint8ClampedArray
  	var MaybeClampedUint8Array = window.Uint8ClampedArray || window.Uint8Array;
  	if( !window.Uint8ClampedArray ) {
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

  	this.canvas.width = this.width;
  	this.canvas.height = this.height;

  	this.currentRGBA = this.canvasContext.getImageData(0, 0, this.width, this.height);

  	if( this.bwFilter ) {
  		// This fails in IE10; don't use the bwFilter if you need to support it.
  		this.currentRGBA32 = new Uint32Array( this.currentRGBA.data.buffer );
  	}
  	this.decoder.fillArray(this.currentRGBA.data, 255);
  }

  nextFrame() {
  	if( !this.buffer ) { return; }
  	while(true) {
  		var code = this.buffer.findNextMPEGStartCode();

  		if( code == MpegDecoder.START_SEQUENCE ) {
  			this.decodeSequenceHeader();
  		}
  		else if( code == MpegDecoder.START_PICTURE ) {
  			if( this.playing ) {
  				this.scheduleNextFrame();
  			}
  			this.decodePicture();
  			return this.canvas;
  		}
  		else if( code == BitReader.NOT_FOUND ) {
  			this.stop(); // Jump back to the beginning

  			if( this.externalFinishedCallback ) {
  				this.externalFinishedCallback(this);
  			}

  			// Only loop if we found a sequence header
  			if( this.loop && this.sequenceStarted ) {
  				this.play();
  			}
  			return null;
  		}
  		else {
  			// ignore (GROUP, USER_DATA, EXTENSION, SLICES...)
  		}
  	}
  }

  stop(file) {
  	if( this.buffer ) {
  		this.buffer.index = this.firstSequenceHeader;
  	}
  	this.playing = false;
  	if( this.client ) {
  		this.client.close();
  		this.client = null;
  	}
  }

}
