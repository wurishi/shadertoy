let audioContext: AudioContext;
let sourceNode: AudioBufferSourceNode;
let analyserNode: AnalyserNode;
let javascriptNode: ScriptProcessorNode;
let amplitudeArray: Uint8Array;

let soundPlay = false;
let canvas: HTMLCanvasElement;
let context: CanvasRenderingContext2D;

window.AudioContext = (function () {
  return (
    (window as any).webkitAudioContext ||
    window.AudioContext ||
    (window as any).mozAudioContext
  );
})();

export function startSound() {
  soundPlay = true;
  if (!audioContext) {
    canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    context = canvas.getContext('2d');
    document.body.appendChild(canvas);

    audioContext = new AudioContext();
    sourceNode = audioContext.createBufferSource();
    analyserNode = audioContext.createAnalyser();
    javascriptNode = audioContext.createScriptProcessor(1024, 1, 1);
    amplitudeArray = new Uint8Array(analyserNode.frequencyBinCount);
    sourceNode.connect(audioContext.destination);
    sourceNode.connect(analyserNode);
    analyserNode.connect(javascriptNode);
    javascriptNode.connect(audioContext.destination);

    javascriptNode.onaudioprocess = (evt) => {
      analyserNode.getByteTimeDomainData(amplitudeArray);

      if (soundPlay) {
        draw();
      }
    };

    const request = new XMLHttpRequest();
    request.open('GET', './media/sound.mp3');
    request.responseType = 'arraybuffer';
    request.onload = () => {
      audioContext.decodeAudioData(request.response, (buffer) => {
        sourceNode.buffer = buffer;
        sourceNode.start();
        sourceNode.loop = true;
      });
    };
    request.send();
  }
  audioContext.resume();
  return canvas;
}

export function stopSound() {
  soundPlay = false;
  audioContext.suspend();
}

let index = 0;
let nums: number[] = [];
function draw() {
  const len = amplitudeArray.length;
  if (index >= len) {
    index = 0;
  }
  if (index == 0) {
    for (let i = 0; i < len; i++) {
      nums[i] = amplitudeArray[i] * 2;
      nums[i] = Math.min(nums[i], 255);
      nums[i] = Math.max(nums[i], 0);
    }
  }
  const lg = context.createLinearGradient(0, 0, 32, 1);
  context.clearRect(0, 0, 32, 32);
  let r = nums[index];
  let g = nums[index + 1];
  let b = nums[index + 2];
  let a = nums[index + 3] / 255;
  lg.addColorStop(0, `rgba(${r},${g},${b},${a})`);
  lg.addColorStop(1, `rgba(${r},${g},${b},0)`);
  context.fillStyle = lg;
  for (let i = 0; i < 32; i++) {
    context.fillRect(0, i, 32, 1);
  }
  index += 4;
}
