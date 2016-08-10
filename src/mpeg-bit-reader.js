// ----------------------------------------------------------------------------
// Bit Reader

export default class BitReader {

  constructor(arrayBuffer) {
    this.bytes = new Uint8Array(arrayBuffer);
    this.length = this.bytes.length;
    this.writePos = this.bytes.length;
    this.index = 0;
  }

  findNextMPEGStartCode() {
    for( var i = (this.index+7 >> 3); i < this.writePos; i++ ) {
      if(
        this.bytes[i] === 0x00 &&
        this.bytes[i+1] === 0x00 &&
        this.bytes[i+2] === 0x01
      ) {
        this.index = (i+4) << 3;
        return this.bytes[i+3];
      }
    }
    this.index = (this.writePos << 3);
    return BitReader.NOT_FOUND;
  }

  nextBytesAreStartCode() {
    var i = (this.index+7 >> 3);
    return (
      i >= this.writePos || (
        this.bytes[i] === 0x00 &&
        this.bytes[i+1] === 0x00 &&
        this.bytes[i+2] === 0x01
      )
    );
  }

  nextBits(count) {
    var
      byteOffset = this.index >> 3,
      room = (8 - this.index % 8);

    if( room >= count ) {
      return (this.bytes[byteOffset] >> (room - count)) & (0xff >> (8-count));
    }

    var
      leftover = (this.index + count) % 8, // Leftover bits in last byte
      end = (this.index + count -1) >> 3,
      value = this.bytes[byteOffset] & (0xff >> (8-room)); // Fill out first byte

    for( byteOffset++; byteOffset < end; byteOffset++ ) {
      value <<= 8; // Shift and
      value |= this.bytes[byteOffset]; // Put next byte
    }

    if (leftover > 0) {
      value <<= leftover; // Make room for remaining bits
      value |= (this.bytes[byteOffset] >> (8 - leftover));
    }
    else {
      value <<= 8;
      value |= this.bytes[byteOffset];
    }

    return value;
  }

  getBits(count) {
    var value = this.nextBits(count);
    this.index += count;
    return value;
  }

  advance(count) {
    return (this.index += count);
  }

  rewind(count) {
    return (this.index -= count);
  }

  static get NOT_FOUND() {
    return -1
  }
}

// BitReader.NOT_FOUND = -1
