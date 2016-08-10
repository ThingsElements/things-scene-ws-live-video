import MpegWs from './mpeg-ws'
import GLDriver from './gl-driver'

const WIDTH = 640
const HEIGHT = 480

var { Component, Rect } = scene

function roundSet(round, width, height){
  var max = width > height ? (height / width) * 100 : 100

  if(round >= max)
    round = max
  else if(round <= 0)
    round = 0

  return round
}

export default class WSLiveVideo extends Rect {

  _draw(ctx) {

    this._ctx = ctx


    if(!this._player) {
      this._isPlaying = false;
      this._gl_driver = new GLDriver(WIDTH, HEIGHT)

      if(this.model.url && this.model.url.match(/^ws[s]?:\/\//)) {
        this.isLive = true;

        this._player = new MpegWs(this.model.url, {
          glDriver : this._gl_driver,
          ondecodeframe: this.drawDecoded.bind(this)
        })
      }

      if(this.model.autoplay) {
        this._isPlaying = true;
      }

    }

    var { left, top, width, height, round } = this.model

    super._draw(ctx);
    if(this._isPlaying){
      ctx.save();

      round = roundSet(round, width, height)
      if (round > 0) {
        this.drawRoundedImage(ctx)
      }

      ctx.drawImage(
        this._gl_driver.canvas,
        0,
        0,
        this._gl_driver.width,
        this._gl_driver.height,
        this.model.left,
        this.model.top,
        this.model.width,
        this.model.height
      )

      if(this._isHover) {
        this.drawStopButton(ctx)
      }

      ctx.restore();
    } else {
      this.drawPlayButton(ctx)
    }

  }

  drawRoundedImage(ctx) {
    var {left, top, width, height, round} = this.model

    var tmpRound = (round / 100) * (width / 2)
    ctx.beginPath()

    ctx.moveTo(left + tmpRound, top);
    ctx.lineTo(left + width - tmpRound, top);
    ctx.quadraticCurveTo(left + width, top, left + width, top + tmpRound);
    ctx.lineTo(left + width, top + height - tmpRound);
    ctx.quadraticCurveTo(left + width, top + height, left + width - tmpRound, top + height);
    ctx.lineTo(left + tmpRound, top + height);
    ctx.quadraticCurveTo(left, top + height, left, top + height - tmpRound);
    ctx.lineTo(left, top + tmpRound);
    ctx.quadraticCurveTo(left, top, left + tmpRound, top);
    ctx.closePath()

    ctx.clip()
  }

  drawSymbol(ctx) {
    var image = new Image();
    image.src = 'data:image/svg+xml;utf8;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iaXNvLTg4NTktMSI/Pgo8IS0tIEdlbmVyYXRvcjogQWRvYmUgSWxsdXN0cmF0b3IgMTYuMC4wLCBTVkcgRXhwb3J0IFBsdWctSW4gLiBTVkcgVmVyc2lvbjogNi4wMCBCdWlsZCAwKSAgLS0+CjwhRE9DVFlQRSBzdmcgUFVCTElDICItLy9XM0MvL0RURCBTVkcgMS4xLy9FTiIgImh0dHA6Ly93d3cudzMub3JnL0dyYXBoaWNzL1NWRy8xLjEvRFREL3N2ZzExLmR0ZCI+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgdmVyc2lvbj0iMS4xIiBpZD0iQ2FwYV8xIiB4PSIwcHgiIHk9IjBweCIgd2lkdGg9IjUxMnB4IiBoZWlnaHQ9IjUxMnB4IiB2aWV3Qm94PSIwIDAgMzQ3Ljg0NiAzNDcuODQ2IiBzdHlsZT0iZW5hYmxlLWJhY2tncm91bmQ6bmV3IDAgMCAzNDcuODQ2IDM0Ny44NDY7IiB4bWw6c3BhY2U9InByZXNlcnZlIj4KPGc+Cgk8Zz4KCQk8Zz4KCQkJPHBhdGggZD0iTTI1OS4wOTUsMjcwLjkxM2MzOC40OS0yNi45NjIsNjMuNzExLTcxLjU5LDYzLjcxMS0xMjIuMDQyQzMyMi44MDYsNjYuNzg2LDI1Ni4wMzIsMCwxNzMuOTIzLDAgICAgIEM5MS44MjgsMCwyNS4wNCw2Ni43ODYsMjUuMDQsMTQ4Ljg3MWMwLDUwLjk1LDI1LjcxNiw5NS45NjMsNjQuODIyLDEyMi44MUM3MCwyNzkuNzg4LDU5LjE4OSwyOTAuNjIsNTkuMTg5LDMwMi44MSAgICAgYzAsMjkuMjQ0LDU5Ljg5OCw0NS4wMzYsMTE2LjI2NSw0NS4wMzZjNTYuMzQ5LDAsMTE2LjIzNS0xNS43OTIsMTE2LjIzNS00NS4wMzYgICAgIEMyOTEuNjg4LDI5MC4xODIsMjgwLjIxMywyNzkuMDkxLDI1OS4wOTUsMjcwLjkxM3ogTTE3My41NjUsNDYuMjIyYzYuOTQ3LDAsMTIuNTU5LDUuNjI2LDEyLjU1OSwxMi41NjggICAgIGMwLDYuOTM2LTUuNjExLDEyLjU2OC0xMi41NTksMTIuNTY4Yy02LjkyNCwwLTEyLjU1Ni01LjYzMy0xMi41NTYtMTIuNTY4QzE2MS4wMDksNTEuODQ5LDE2Ni42NDIsNDYuMjIyLDE3My41NjUsNDYuMjIyeiAgICAgIE0xNzMuOTIzLDg1LjAyMmMzNS4yMjQsMCw2My44NjYsMjguNjQ4LDYzLjg2Niw2My44NTRzLTI4LjY0Myw2My44NzMtNjMuODY2LDYzLjg3M2MtMzUuMjE1LDAtNjMuODY0LTI4LjY1NS02My44NjQtNjMuODczICAgICBDMTEwLjA1OSwxMTMuNjY1LDEzOC43MDgsODUuMDIyLDE3My45MjMsODUuMDIyeiBNMTc1LjQ1NCwzMzUuMjg0Yy02NC4yMzYsMC0xMDMuNjgyLTE4LjkyMi0xMDMuNjgyLTMyLjQ3NSAgICAgYzAtNy44MywxMi4xOTMtMTYuNDQsMzEuODY4LTIyLjczM2MyMC45NTEsMTEuMjg5LDQ0Ljg4MywxNy42OSw3MC4yODksMTcuNjljMjUuODYyLDAsNTAuMTc2LTYuNjQyLDcxLjM3OS0xOC4yNzkgICAgIGMyMC42MDMsNi4yODEsMzMuODMxLDE1LjI4OCwzMy44MzEsMjMuMzIyQzI3OS4xMjcsMzE2LjM2MiwyMzkuNjg4LDMzNS4yODQsMTc1LjQ1NCwzMzUuMjg0eiIgZmlsbD0iIzAwMDAwMCIvPgoJCTwvZz4KCQk8Zz4KCQkJPHBhdGggZD0iTTE3My45MjMsMTkxLjM3OWMyMy40MzEsMCw0Mi41MDItMTkuMDY4LDQyLjUwMi00Mi40OTZjMC0yMy40MjQtMTkuMDcxLTQyLjQ5My00Mi41MDItNDIuNDkzICAgICBjLTIzLjQyOCwwLTQyLjQ4NCwxOS4wNjgtNDIuNDg0LDQyLjQ5M0MxMzEuNDM4LDE3Mi4zMTEsMTUwLjQ5NSwxOTEuMzc5LDE3My45MjMsMTkxLjM3OXoiIGZpbGw9IiMwMDAwMDAiLz4KCQk8L2c+Cgk8L2c+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPGc+CjwvZz4KPC9zdmc+Cg==';
    ctx.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
      this.model.left + this.model.width * 0.25,
      this.model.top + this.model.height * 0.25,
      this.model.width * 0.5,
      this.model.height * 0.5
    );

  }

  drawComponentFrame(ctx) {
    ctx.beginPath();
    ctx.moveTo(this.model.left, this.model.top);
    ctx.lineTo(this.model.left+ this.model.width, this.model.top);
    ctx.lineTo(this.model.left+ this.model.width, this.model.top + this.model.height);
    ctx.lineTo(this.model.left, this.model.top + this.model.height);
    ctx.lineTo(this.model.left, this.model.top);
    ctx.stroke();
    ctx.closePath();
  }

  drawPlayButton(ctx) {
    this.drawActionButton(ctx, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoyNThCQUYyNDMyMTYxMUU2QjY1QUUzMjAyRjNBQUJEMSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoyNThCQUYyNTMyMTYxMUU2QjY1QUUzMjAyRjNBQUJEMSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjBEMUU5RDgxMzIwNDExRTZCNjVBRTMyMDJGM0FBQkQxIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjBEMUU5RDgyMzIwNDExRTZCNjVBRTMyMDJGM0FBQkQxIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+tES3iAAAEldJREFUeNrknQlw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");
  }

  drawStopButton(ctx) {
    this.drawActionButton(ctx, "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGAAAABgCAYAAADimHc4AAAAGXRFWHRTb2Z0d2FyZQBBZG9iZSBJbWFnZVJlYWR5ccllPAAAAyRpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADw/eHBhY2tldCBiZWdpbj0i77u/IiBpZD0iVzVNME1wQ2VoaUh6cmVTek5UY3prYzlkIj8+IDx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IkFkb2JlIFhNUCBDb3JlIDUuMy1jMDExIDY2LjE0NTY2MSwgMjAxMi8wMi8wNi0xNDo1NjoyNyAgICAgICAgIj4gPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4gPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIgeG1sbnM6eG1wPSJodHRwOi8vbnMuYWRvYmUuY29tL3hhcC8xLjAvIiB4bWxuczp4bXBNTT0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wL21tLyIgeG1sbnM6c3RSZWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20veGFwLzEuMC9zVHlwZS9SZXNvdXJjZVJlZiMiIHhtcDpDcmVhdG9yVG9vbD0iQWRvYmUgUGhvdG9zaG9wIENTNiAoTWFjaW50b3NoKSIgeG1wTU06SW5zdGFuY2VJRD0ieG1wLmlpZDoyNThCQUYyODMyMTYxMUU2QjY1QUUzMjAyRjNBQUJEMSIgeG1wTU06RG9jdW1lbnRJRD0ieG1wLmRpZDoyNThCQUYyOTMyMTYxMUU2QjY1QUUzMjAyRjNBQUJEMSI+IDx4bXBNTTpEZXJpdmVkRnJvbSBzdFJlZjppbnN0YW5jZUlEPSJ4bXAuaWlkOjI1OEJBRjI2MzIxNjExRTZCNjVBRTMyMDJGM0FBQkQxIiBzdFJlZjpkb2N1bWVudElEPSJ4bXAuZGlkOjI1OEJBRjI3MzIxNjExRTZCNjVBRTMyMDJGM0FBQkQxIi8+IDwvcmRmOkRlc2NyaXB0aW9uPiA8L3JkZjpSREY+IDwveDp4bXBtZXRhPiA8P3hwYWNrZXQgZW5kPSJyIj8+8iPbzgAAEPNJREFUeNrsXXtQ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");
  }

  drawActionButton(ctx, imageData) {
    var image = new Image()
    image.src = imageData;
    ctx.drawImage(
      image,
      0,
      0,
      image.width,
      image.height,
      this.model.left + this.model.width / 2 - image.width /2 ,
      this.model.top + this.model.height /2 - image.height/2,
      image.width,
      image.height
    );

    this._playButtonArea = {
      left : this.model.left + this.model.width / 2 - image.width /2 ,
      top : this.model.top + this.model.height /2 - image.height/2,
      width : image.width,
      height : image.height
    }
  }

  onLoaded(){
    this.loaded = true;
  }

  drawDecoded(scope, buffer_Y, buffer_Cr, buffer_Cb) {
    if(this._isPlaying) {
      this.buffer_Y = buffer_Y
      this.buffer_Cr = buffer_Cr
      this.buffer_Cb = buffer_Cb

      this._gl_driver.renderFrameGL(
        this.buffer_Y,
        this.buffer_Cr,
        this.buffer_Cb
      )

      this.invalidate();
    }
  }

  play() {
    if(!this._player) {
      return;
    }

    this._isPlaying = true;

    if (this.isLive) {
      this.playLive()
      return
    }

    if(this.loaded)
      this._player.play()
    else {
      this._isPlaying = false;
      this.reconnect()
    }

  }

  playLive() {
    if(!this._player || !this._player.client){
      return
    }

    if(this._player.client.readyState === WebSocket.CLOSED) {
      this.reconnect();
    }
  }

  stop() {
    this._isPlaying = false;
    this.invalidate();

    if(!this.isLive) {
      this._player.pause()
    }
  }

  reconnect() {
    try{
      if(this._player) {
        this._player.stop();
      }
    } catch(e) {

    } finally {
      this._player = null
    }

  }

  onchange(after, before) {
    var self = this

    if(after.hasOwnProperty('url')) {
      var isChanged = after.url != before.url

      if(isChanged) {
        self.reconnect()
      }
    }

    if(after.hasOwnProperty('autoplay')) {
      var isChanged = after.autoplay != before.autoplay

      if(isChanged) {
        self.reconnect();
      }
    }

  }

  onclick(e) {

    var point = this.transcoordC2S(e.offsetX, e.offsetY)
    var playButtonArea = this._playButtonArea

    if(!(point.x >= playButtonArea.left && point.x <= playButtonArea.left + playButtonArea.width )) {
      return;
    }

    if(!(point.y >= playButtonArea.top && point.y <= playButtonArea.top + playButtonArea.height )) {
      return;
    }

    if(this._isPlaying) {
      this.stop();
    } else {
      this.play();
    }


  }

  onmouseenter(e) {
    this._isHover = true;
  }

  onmouseleave(e) {
    this._isHover = false;
  }

}

Component.register('ws-live-video', WSLiveVideo)
