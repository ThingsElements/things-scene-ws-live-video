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

export default class MpegFile {
  constructor(url, opts) {

    opts = opts || {};
    this.progressive = (opts.progressive !== false);
    this.benchmark = !!opts.benchmark;
    // this.canvas = opts.canvas || document.createElement('canvas');
    this.autoplay = !!opts.autoplay;
    this.wantsToPlay = this.autoplay;
    this.loop = !!opts.loop;
    this.seekable = !!opts.seekable;
    this.externalLoadCallback = opts.onload || null;
  	this.externalDecodeCallback = opts.ondecodeframe || null;
  	this.externalFinishedCallback = opts.onfinished || null;

    this._gl_driver = opts.glDriver

    this.renderFrame = this.renderFrameGL;

    this.pictureRate = 30;
    this.lateTime = 0;
    this.firstSequenceHeader = 0;
    this.targetTime = 0;

    this.benchmark = false;
    this.benchFrame = 0;
    this.benchDecodeTimes = 0;
    this.benchAvgFrameTime = 0;

    this.customIntraQuantMatrix = new Uint8Array(64);
  	this.customNonIntraQuantMatrix = new Uint8Array(64);

    this.renderFrame = this.renderFrameGL;

    // // use WebGL for YCbCrToRGBA conversion if possible (much faster)
  	// if( !opts.forceCanvas2D && this.initWebGL() ) {
    //
  	// } else {
  	// 	this.canvasContext = this.canvas.getContext('2d');
  	// 	this.renderFrame = this.renderFrame2D;
  	// }

    this.load(url)
  }

  load(url) {
  	this.url = url;

  	var that = this;
  	if(
  		this.progressive &&
  		window.fetch &&
  		window.ReadableByteStream
  	) {
  		var reqHeaders = new Headers();
  		reqHeaders.append('Content-Type', 'video/mpeg');
  		fetch(url, {headers: reqHeaders}).then(function (res) {
  			var contentLength = res.headers.get('Content-Length');
  			var reader = res.body.getReader();

  			that.buffer = new BitReader(new ArrayBuffer(contentLength));
  			that.buffer.writePos = 0;
  			that.fetchReaderPump(reader);
      });
  	}
  	else {
  		var request = new XMLHttpRequest();
  		request.onreadystatechange = function() {
  			if( request.readyState === request.DONE && request.status === 200 ) {
  				that.loadCallback(request.response);
  			}
  		};

  		// request.onprogress = this.gl
  		// 	? this.updateLoaderGL.bind(this)
  		// 	: this.updateLoader2D.bind(this);

  		request.open('GET', url);
      request.withCredentials = true;
  		request.responseType = 'arraybuffer';
  		request.send();
  	}
  }

  fetchReaderPump(reader) {
  	var that = this;
  	reader.read().then(function (result) {
  		that.fetchReaderReceive(reader, result);
  	});
  };

  fetchReaderReceive(reader, result) {
  	if( result.done ) {
  		if( this.seekable ) {
  			var currentBufferPos = this.buffer.index;
  			this.collectIntraFrames();
  			this.buffer.index = currentBufferPos;
  		}

  		this.duration = this.frameCount / this.pictureRate;
  		this.lastFrameIndex = this.buffer.writePos << 3;
  		return;
  	}

  	this.buffer.bytes.set(result.value, this.buffer.writePos);
  	this.buffer.writePos += result.value.byteLength;

  	// Find the last picture start code - we have to be careful not trying
  	// to decode any frames that aren't fully loaded yet.
  	this.lastFrameIndex =  this.findLastPictureStartCode();

  	// Initialize the sequence headers and start playback if we have enough data
  	// (at least 128kb)
  	if( !this.sequenceStarted && this.buffer.writePos >= this.progressiveMinSize ) {
  		this.findStartCode(START_SEQUENCE);
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

  	// If the player starved previously, restart playback now
  	else if( this.sequenceStarted && this.wantsToPlay && !this.playing ) {
  		this.play();
  	}

  	// Not enough data to start playback yet - show loading progress
  	else if( !this.sequenceStarted ) {
  		var status = {loaded: this.buffer.writePos, total: this.progressiveMinSize};
  		if( this.gl ) {
  			this.updateLoaderGL(status);
  		}
  		else {
  			this.updateLoader2D(status);
  		}
  	}

  	this.fetchReaderPump(reader);
  }

  collectIntraFrames() {
  	// Loop through the whole buffer and collect all intraFrames to build our seek index.
  	// We also keep track of total frame count here
  	var frame;
  	for( frame = 0; this.findStartCode(START_PICTURE) !== BitReader.NOT_FOUND; frame++ ) {

  		// Check if the found picture is an intra frame and remember the position
  		this.buffer.advance(10); // skip temporalReference
  		if( this.buffer.getBits(3) === PICTURE_TYPE_I ) {
  			// Remember index 13 bits back, before temporalReference and picture type
  			this.intraFrames.push({frame: frame, index: this.buffer.index - 13});
  		}
  	}

  	this.frameCount = frame;
  }


  loadCallback(file) {
  	this.buffer = new BitReader(file);

  	if( this.seekable ) {
  		this.collectIntraFrames();
  		this.buffer.index = 0;
  	}

  	this.findStartCode(MpegDecoder.START_SEQUENCE);
  	this.firstSequenceHeader = this.buffer.index;
  	this.decodeSequenceHeader();

  	// Calculate the duration. This only works if the video is seekable and we have a frame count
  	this.duration = this.decoder.frameCount / this.pictureRate;

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

  	var i;

  	if( this.buffer.getBits(1) ) { // load custom intra quant matrix?
  		for( i = 0; i < 64; i++ ) {
  			this.customIntraQuantMatrix[MpegDecoder.ZIG_ZAG[i]] = this.buffer.getBits(8);
  		}
  		this.intraQuantMatrix = this.customIntraQuantMatrix;
  	}

  	if( this.buffer.getBits(1) ) { // load custom non intra quant matrix?
  		for( i = 0; i < 64; i++ ) {
  			this.customNonIntraQuantMatrix[MpegDecoder.ZIG_ZAG[i]] = this.buffer.getBits(8);
  		}
  		this.nonIntraQuantMatrix = this.customNonIntraQuantMatrix;
  	}
  }

  initBuffers() {
    // Sequence already started? Don't allocate buffers again
    if( this.sequenceStarted ) { return; }
    this.sequenceStarted = true;

    this.decoder = new MpegDecoder(this.buffer, this.width, this.height)
    this.decoder.pictureRate = this.pictureRate

  }

  findStartCode( code ) {
  	var current = 0;
  	while( true ) {
  		current = this.buffer.findNextMPEGStartCode();
  		if( current === code || current === BitReader.NOT_FOUND ) {
  			return current;
  		}
  	}
  	return BitReader.NOT_FOUND;
  }

  nextFrame() {
  	if( !this.buffer ) { return; }

  	var frameStart = this.now();
  	while(true) {
  		var code = this.buffer.findNextMPEGStartCode();

  		if( code === MpegDecoder.START_SEQUENCE ) {
  			this.decodeSequenceHeader();
  		}
  		else if( code === MpegDecoder.START_PICTURE ) {
  			if( this.progressive && this.buffer.index >= this.lastFrameIndex ) {
  				// Starved
  				this.playing = false;
  				return;
  			}
  			if( this.playing ) {
  				this.scheduleNextFrame();
  			}
  			this.decoder.decodePicture();
  			this.benchDecodeTimes += this.now() - frameStart;
  			return this._gl_driver.canvas;
  		}
  		else if( code === BitReader.NOT_FOUND ) {
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

  scheduleNextFrame() {
  	this.lateTime = this.now() - this.targetTime;
  	var wait = Math.max(0, (1000/this.pictureRate) - this.lateTime);
  	this.targetTime = this.now() + wait;

  	if( this.benchmark ) {
  		this.benchFrame++;
  		if( this.benchFrame >= 120 ) {
  			this.benchAvgFrameTime = this.benchDecodeTimes / this.benchFrame;
  			this.benchFrame = 0;
  			this.benchDecodeTimes = 0;
  			if( window.console ) { console.log('Average time per frame:', this.benchAvgFrameTime, 'ms'); }
  		}
  		setTimeout( this.nextFrame.bind(this), 0);
  	}
  	else if( wait < 18) {
  		this.scheduleAnimation();
  	}
  	else {
  		setTimeout( this.scheduleAnimation.bind(this), wait );
  	}
  }

  scheduleAnimation() {
  	requestAnimFrame( this.nextFrame.bind(this), this._gl_driver.canvas );
  }

  play() {
  	if( this.playing ) { return; }
  	this.targetTime = this.now();
  	this.playing = true;
  	this.wantsToPlay = true;
  	this.scheduleNextFrame();
  }

  pause() {
  	this.playing = false;
  	this.wantsToPlay = false;
  }

  stop() {
  	this.currentFrame = -1;
  	if( this.buffer ) {
  		this.buffer.index = this.firstSequenceHeader;
  	}
  	this.playing = false;
  	if( this.client ) {
  		this.client.close();
  		this.client = null;
  	}
  	this.wantsToPlay = false;
  }

  now() {
    return window.performance
      ? window.performance.now()
      : Date.now();
  }

}
