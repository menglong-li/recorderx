import _classCallCheck from '@babel/runtime/helpers/esm/classCallCheck';
import _createClass from '@babel/runtime/helpers/esm/createClass';
import _defineProperty from '@babel/runtime/helpers/esm/defineProperty';

function merge(bufferList, length) {
  var data = new Float32Array(length);

  for (var i = 0, offset = 0; i < bufferList.length; offset += bufferList[i].length, i += 1) {
    data.set(bufferList[i], offset);
  }

  return data;
}
function compress(buffer, inputSampleRate, outputSampleRate) {
  if (inputSampleRate < outputSampleRate) {
    throw new Error('Invalid parameter: "inputSampleRate" must be greater than "outputSampleRate"');
  }

  var bufferLength = buffer.length;
  inputSampleRate += 0.0;
  outputSampleRate += 0.0;
  var compression = inputSampleRate / outputSampleRate;
  var outLength = Math.ceil(bufferLength * outputSampleRate / inputSampleRate);
  var data = new Float32Array(outLength);
  var s = 0;

  for (var i = 0; i < outLength; i += 1) {
    data[i] = buffer[Math.floor(s)];
    s += compression;
  }

  return data;
}
function encodeToPCM(bytes, sampleBits) {
  if ([8, 16].indexOf(sampleBits) === -1) {
    throw new Error('Invalid parameter: "sampleBits" must be 8 or 16');
  }

  var dataLength = bytes.length * (sampleBits / 8);
  var buffer = new ArrayBuffer(dataLength);
  var view = new DataView(buffer);

  for (var i = 0, offset = 0; i < bytes.length; i += 1, offset += sampleBits / 8) {
    var s = Math.max(-1, Math.min(1, bytes[i]));
    var val = s < 0 ? s * 0x8000 : s * 0x7fff;

    if (sampleBits === 8) {
      view.setInt8(offset, parseInt(255 / (65535 / (val + 32768)), 10), true);
    } else {
      view.setInt16(offset, val, true);
    }
  }

  return view.buffer;
}
function encodeToWAV(bytes, sampleBits, sampleRate) {
  if ([8, 16].indexOf(sampleBits) === -1) {
    throw new Error('Invalid parameter: "sampleBits" must be 8 or 16');
  }

  var dataLength = bytes.length * (sampleBits / 8);
  var buffer = new ArrayBuffer(44 + dataLength);
  var view = new DataView(buffer);
  var channelCount = 1;
  var offset = 0;

  var writeString = function writeString(str) {
    for (var i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }; // WAV HEAD


  writeString('RIFF');
  offset += 4;
  view.setUint32(offset, 36 + dataLength, true);
  offset += 4;
  writeString('WAVE');
  offset += 4;
  writeString('fmt ');
  offset += 4;
  view.setUint32(offset, 16, true);
  offset += 4;
  view.setUint16(offset, 1, true);
  offset += 2;
  view.setUint16(offset, channelCount, true);
  offset += 2;
  view.setUint32(offset, sampleRate, true);
  offset += 4;
  view.setUint32(offset, channelCount * sampleRate * (sampleBits / 8), true);
  offset += 4;
  view.setUint16(offset, channelCount * (sampleBits / 8), true);
  offset += 2;
  view.setUint16(offset, sampleBits, true);
  offset += 2;
  writeString('data');
  offset += 4;
  view.setUint32(offset, dataLength, true);
  offset += 4; // write PCM

  for (var i = 0; i < bytes.length; i += 1, offset += sampleBits / 8) {
    var s = Math.max(-1, Math.min(1, bytes[i]));
    var val = s < 0 ? s * 0x8000 : s * 0x7fff;

    if (sampleBits === 8) {
      view.setInt8(offset, parseInt(255 / (65535 / (val + 32768)), 10), true);
    } else {
      view.setInt16(offset, val, true);
    }
  }

  return new Blob([view], {
    type: 'audio/wav'
  });
}

function environmentCheck() {
  if (window === undefined || navigator === undefined) {
    return;
  }

  if (navigator.mediaDevices === undefined) {
    navigator.mediaDevices = {};
  }

  if (navigator.mediaDevices.getUserMedia === undefined) {
    navigator.mediaDevices.getUserMedia = function (constraints) {
      var getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

      if (!getUserMedia) {
        return Promise.reject(new Error('getUserMedia is not implemented in this environment'));
      }

      return new Promise(function (resolve, reject) {
        getUserMedia.call(navigator, constraints, resolve, reject);
      });
    };
  }
}

var DEFAULT_CONFIG = {
  recordable: true,
  sampleRate: 16000,
  sampleBits: 16,
  bufferSize: 16384
};

var RECORDER_STATE = {
  READY: 0,
  RECORDING: 1
};
var ENCODE_TYPE = {
  RAW: 'raw',
  PCM: 'pcm',
  WAV: 'wav'
};

var Recorderx = /*#__PURE__*/function () {
  function Recorderx() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : DEFAULT_CONFIG,
        _ref$recordable = _ref.recordable,
        recordable = _ref$recordable === void 0 ? DEFAULT_CONFIG.recordable : _ref$recordable,
        _ref$bufferSize = _ref.bufferSize,
        bufferSize = _ref$bufferSize === void 0 ? DEFAULT_CONFIG.bufferSize : _ref$bufferSize,
        _ref$sampleRate = _ref.sampleRate,
        sampleRate = _ref$sampleRate === void 0 ? DEFAULT_CONFIG.sampleRate : _ref$sampleRate,
        _ref$sampleBits = _ref.sampleBits,
        sampleBits = _ref$sampleBits === void 0 ? DEFAULT_CONFIG.sampleBits : _ref$sampleBits;

    _classCallCheck(this, Recorderx);

    _defineProperty(this, "state", RECORDER_STATE.READY);

    _defineProperty(this, "ctx", new (window.AudioContext || window.webkitAudioContext)());

    _defineProperty(this, "sampleRate", DEFAULT_CONFIG.sampleRate);

    _defineProperty(this, "sampleBits", DEFAULT_CONFIG.sampleBits);

    _defineProperty(this, "recordable", DEFAULT_CONFIG.recordable);

    _defineProperty(this, "recorder", null);

    _defineProperty(this, "source", null);

    _defineProperty(this, "stream", null);

    _defineProperty(this, "buffer", []);

    _defineProperty(this, "bufferSize", 0);

    var ctx = this.ctx;
    var creator = ctx.createScriptProcessor || ctx.createJavaScriptNode;
    this.recorder = creator.call(ctx, bufferSize, 1, 1);
    this.recordable = recordable;
    this.sampleRate = sampleRate;
    this.sampleBits = sampleBits;
  }

  _createClass(Recorderx, [{
    key: "start",
    value: function start(audioprocessCallback) {
      var _this = this;

      this.clear();
      return new Promise(function (resolve, reject) {
        navigator.mediaDevices.getUserMedia({
          audio: true
        }).then(function (stream) {
          var recorder = _this.recorder;

          var source = _this.ctx.createMediaStreamSource(stream);

          _this.stream = stream;
          _this.source = source;

          recorder.onaudioprocess = function (e) {
            var channelData = e.inputBuffer.getChannelData(0);

            if (_this.recordable) {
              _this.buffer.push(channelData.slice(0));

              _this.bufferSize += channelData.length;
            }

            if (typeof audioprocessCallback === 'function') {
              audioprocessCallback(channelData);
            }
          };

          source.connect(recorder);
          recorder.connect(_this.ctx.destination);
          _this.state = RECORDER_STATE.RECORDING;
          resolve(stream);
        })["catch"](function (error) {
          reject(error);
        });
      });
    }
  }, {
    key: "pause",
    value: function pause() {
      this.stream.getAudioTracks().forEach(function (track) {
        track.stop();
      });
      this.recorder.disconnect();
      this.source.disconnect(); // this.ctx.suspend();

      this.state = RECORDER_STATE.READY;
    }
  }, {
    key: "clear",
    value: function clear() {
      this.buffer = [];
      this.bufferSize = 0;
    }
  }, {
    key: "getRecord",
    value: function getRecord() {
      var _ref2 = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {
        encodeTo: ENCODE_TYPE.RAW,
        compressible: false
      },
          _ref2$encodeTo = _ref2.encodeTo,
          encodeTo = _ref2$encodeTo === void 0 ? ENCODE_TYPE.RAW : _ref2$encodeTo,
          _ref2$compressible = _ref2.compressible,
          compressible = _ref2$compressible === void 0 ? false : _ref2$compressible;

      if (this.recordable) {
        var buffer = merge(this.buffer, this.bufferSize);
        var inputSampleRate = this.ctx.sampleRate;
        compressible = compressible && this.sampleRate < inputSampleRate;
        var outSampleRate = compressible ? this.sampleRate : inputSampleRate;

        if (compressible) {
          buffer = compress(buffer, inputSampleRate, outSampleRate);
        }

        switch (encodeTo) {
          case ENCODE_TYPE.RAW:
            return buffer;

          case ENCODE_TYPE.PCM:
            return encodeToPCM(buffer, this.sampleBits);

          case ENCODE_TYPE.WAV:
            return encodeToWAV(buffer, this.sampleBits, outSampleRate);

          default:
            throw new Error('Invalid parameter: "encodeTo" must be ENCODE_TYPE');
        }
      }

      throw new Error('Configuration error: "recordable" must be set to true');
    }
  }]);

  return Recorderx;
}();

environmentCheck();
var audioTools = {
  merge: merge,
  compress: compress,
  encodeToPCM: encodeToPCM,
  encodeToWAV: encodeToWAV
};

export default Recorderx;
export { ENCODE_TYPE, RECORDER_STATE, audioTools };
