import { GUI } from 'dat.gui';
import * as Stats from 'stats.js';
import {
  iSub,
  fragment,
  vertex,
  PRECISION_MEDIUMP,
  WEBGL_1,
  WEBGL_2,
  vertex2,
  fragment2,
} from './libs';
import * as webglUtils from './webgl-utils';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { startSound, stopSound } from './sound-utils';

// const context = (require as any).context('./subs', false, /.ts$/);
const context = (require as any).context('./subs1', false, /.ts$/);
// const context = (require as any).context('./subs2', false, /.ts$/);
// const context = (require as any).context('./subs3', false, /.ts$/);
// const context = (require as any).context('./subs4', false, /.ts$/);
// const context = (require as any).context('./subs5', false, /.ts$/);
// const context = (require as any).context('./subs6', false, /.ts$/);
// const context = (require as any).context('./subs7', false, /.ts$/);
const keys = context.keys();

const gui = new GUI();
gui.domElement.style.marginTop = '50px';
const stats = new Stats();
stats.dom.style.left = '';
stats.dom.style.right = '0';
document.body.appendChild(stats.dom);

const link = document.createElement('a');
document.body.appendChild(link);
link.href = 'https://www.shadertoy.com';
link.textContent = 'SHADERTOY';
document.body.appendChild(document.createElement('br'));
const filelink = document.createElement('span');
document.body.appendChild(filelink);
const imgs = document.createElement('div');
document.body.appendChild(imgs);
document.body.appendChild(document.createElement('hr'));

const mainFolder = gui.addFolder('主菜单');
const soundFolder = gui.addFolder('声音');
let soundCanvas: HTMLCanvasElement;
const api: any = {
  menu: '',
  run: true,
  localIndex: window.localStorage.getItem('localIndex')
    ? parseInt(window.localStorage.getItem('localIndex'))
    : 0,
  soundPlay: false,
};
soundFolder.add(api, 'soundPlay').onChange((v) => {
  if (v) {
    soundCanvas = startSound();
  } else {
    stopSound();
  }
});
soundFolder.open();

const menuList: { name: string; sort: number }[] = [];
const menuMap: any = {};

let uuid: number = -1;
let _sub: iSub = null;
let canvas: HTMLCanvasElement = null;
let gl: WebGLRenderingContext = null;

keys.forEach((key: string) => {
  const Cls = context(key).default;
  const sub: iSub = new Cls();
  if (sub.name) {
    if (sub.ignore && sub.ignore()) {
    } else {
      const sort = sub.sort ? sub.sort() : Number.MAX_SAFE_INTEGER;
      const name = `(${
        sort == Number.MAX_SAFE_INTEGER ? '失败' : sort
      }) ${sub.name()}`;
      menuList.push({ name, sort });
      menuMap[name] = sub;
    }
  }
});
menuList.sort((a, b) => a.sort - b.sort);
api.menu = menuList[api.localIndex].name;
destoryPrev();
activeSub(api.menu);

mainFolder
  .add(
    api,
    'menu',
    menuList.map((v) => v.name)
  )
  .onChange((name) => {
    destoryPrev();
    activeSub(name);
  });

mainFolder.add(api, 'run');
mainFolder.add(api, 'localIndex', 0, menuList.length, 1).onChange((v) => {
  window.localStorage.setItem('localIndex', v);
});

mainFolder.open();

function destoryPrev() {
  uuid = -1;
  if (canvas) {
    canvas.removeEventListener('mousemove', mouseMove);
    canvas.removeEventListener('mousedown', mouseDown);
    canvas.removeEventListener('mouseup', mouseUp);
    document.body.removeChild(canvas);
    canvas = null;
  }
  if (_sub) {
    _sub.destory();
    _sub = null;
  }
  gl = null;
}

let threeRenderer: THREE.WebGLRenderer;
let threeScene: THREE.Scene;
let threeCamera: THREE.PerspectiveCamera;
let threeMesh: THREE.Mesh;
let threeSM: THREE.ShaderMaterial;

function initTHREE() {
  if (!threeRenderer) {
    threeRenderer = new THREE.WebGLRenderer({ antialias: true });
    threeRenderer.setPixelRatio(400 / 300);
    threeRenderer.setSize(400, 300);

    threeScene = new THREE.Scene();

    threeCamera = new THREE.PerspectiveCamera(60, 1, 0.1, 10000);
    threeCamera.position.z = -100;

    const controls = new OrbitControls(threeCamera, threeRenderer.domElement);
    controls.update();

    // const light = new THREE.HemisphereLight(0xffffff, 0x444444);
    // light.position.set(0, 20, 0);
    // threeScene.add(light);
  }
  threeRenderer.domElement.parentElement &&
    document.body.removeChild(threeRenderer.domElement);
  document.body.appendChild(threeRenderer.domElement);
}

function addThreeBox(fragment: string, webglV: string): void {
  threeMesh && threeScene.remove(threeMesh);

  if (webglV === WEBGL_2) {
    console.log('webgl2 three 当前未完成');
  } else {
    const shaderMaterial = new THREE.ShaderMaterial({
      fragmentShader: fragment,
      uniforms: {
        iResolution: { value: [400, 300, 1] },
        iTime: { value: 0 },
        iMouse: { value: [mouseX, mouseY, clickX, clickY] },
        iFrameRate: { value: 30 },
        iFrame: { value: 0 },
      },
    });

    threeMesh = new THREE.Mesh(
      new THREE.BoxGeometry(10, 10, 10),
      shaderMaterial
    );
    threeScene.add(threeMesh);

    threeSM = shaderMaterial;
  }
}

let mouseX = 0;
let mouseY = 0;
let clickX = 0;
let clickY = 0;

function mouseMove(e: MouseEvent) {
  // mouseX = e.clientX > 400 ? 400 : e.clientX;
  // mouseY = e.clientY > 300 ? 300 : e.clientY;
  mouseX = e.clientX;
  mouseY = 300 - e.clientY;
  if (canvas) {
    const rect = canvas.getBoundingClientRect();
    mouseY += rect.top;
  }
}

function mouseDown(e: MouseEvent) {
  if (e.button == 0) {
    clickX = e.clientX;
    clickY = 300 - e.clientY;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      clickY += rect.top;
    }
  }
}

function mouseUp() {
  clickX = 0;
  clickY = 0;
}

async function activeSub(name: string) {
  uuid = Date.now();
  const sub = menuMap[name] as iSub;
  _sub = sub;

  for (let i = imgs.childNodes.length - 1; i >= 0; i--) {
    imgs.removeChild(imgs.childNodes[i]);
  }

  const key = sub.key();
  if (key) {
    link.href = 'https://www.shadertoy.com/view/' + key;
    link.textContent = `${key} (${
      sub.webgl ? sub.webgl() : WEBGL_1
    }) shader 字符: ${sub.userFragment().length}`;
    filelink.textContent = key + '|';
  } else {
    link.href = '';
    link.textContent = 'shader 字符: ' + sub.userFragment().length;
    filelink.textContent = name;
  }

  sub.channels &&
    sub.channels().forEach((v) => {
      if (v.type == 0) {
        const img = document.createElement('img');
        img.src = v.path;
        img.width = 50;
        img.height = 50;
        img.alt = v.path;
        img.title = v.path;
        imgs.appendChild(img);
      }
    });

  canvas = sub.main();
  document.body.appendChild(canvas);
  canvas.addEventListener('mousemove', mouseMove);
  canvas.addEventListener('mousedown', mouseDown);
  canvas.addEventListener('mouseup', mouseUp);

  const webglV = sub.webgl ? sub.webgl() : WEBGL_1;

  gl = canvas.getContext(webglV) as WebGLRenderingContext;
  console.log(gl.getParameter(gl.SHADING_LANGUAGE_VERSION));

  let _uuid = uuid;

  if (!gl) return;

  initTHREE();

  const v = webglV === WEBGL_2 ? vertex2 : vertex;

  let f = webglV === WEBGL_2 ? fragment2 : fragment;
  f = f.replace('{COMMON}', sub.common ? sub.common() : '');
  f = f.replace(
    '{PRECISION}',
    sub.fragmentPrecision ? sub.fragmentPrecision() : PRECISION_MEDIUMP
  );
  f = f.replace('{USER_FRAGMENT}', sub.userFragment());

  const program = webglUtils.createProgram2(gl, v, f);

  const a_position = webglUtils.getAttribLocation(gl, program, 'a_position');
  a_position.setFloat32(
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
  );

  const iResolution = webglUtils.getUniformLocation(gl, program, 'iResolution');
  const iTime = webglUtils.getUniformLocation(gl, program, 'iTime');
  const iMouse = webglUtils.getUniformLocation(gl, program, 'iMouse');
  const iFrameRate = webglUtils.getUniformLocation(gl, program, 'iFrameRate');
  const iFrame = webglUtils.getUniformLocation(gl, program, 'iFrame');
  const iDate = webglUtils.getUniformLocation(gl, program, 'iDate');
  const iChannelTime0 = webglUtils.getUniformLocation(
    gl,
    program,
    'iChannelTime[0]'
  );
  const iChannelTime1 = webglUtils.getUniformLocation(
    gl,
    program,
    'iChannelTime[1]'
  );
  const iChannelTime2 = webglUtils.getUniformLocation(
    gl,
    program,
    'iChannelTime[2]'
  );
  const iChannelTime3 = webglUtils.getUniformLocation(
    gl,
    program,
    'iChannelTime[3]'
  );
  const iTimeDelta = webglUtils.getUniformLocation(gl, program, 'iTimeDelta');

  const iChannelResolution = [0, 1, 2, 3].map((i) => {
    return webglUtils.getUniformLocation(
      gl,
      program,
      `iChannelResolution[${i}]`
    );
  });

  const channelList = await createChannelList(gl, program, sub);

  let fn = sub.initial ? sub.initial(gl, program) : null;

  addThreeBox(f, webglV);

  requestAnimationFrame(render);

  const setFramebuffer = (
    program: WebGLProgram,
    fbo: WebGLFramebuffer,
    other: any
  ) => {
    const {
      a_position,
      iResolution,
      iDate,
      iTime,
      iMouse,
      iFrameRate,
      iFrame,
      fn,
      iChannelTime,
      iTimeDelta,
    } = other;
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);

    a_position ? a_position.bindBuffer() : console.log('a_position');

    iResolution
      ? iResolution.uniform3f(canvas.width, canvas.height, 1)
      : console.log('iResolution');
    iTime.uniform1f(time);
    iMouse.uniform4fv([mouseX, mouseY, clickX, clickY]);
    iFrameRate.uniform1f(30);
    iFrame.uniform1i(iframe);
    const now = new Date();
    iDate.uniform4fv([
      now.getFullYear(),
      now.getMonth(),
      now.getDay(),
      now.getSeconds() + now.getMilliseconds() / 1000,
    ]);
    if (Array.isArray(iChannelTime)) {
      iChannelTime.forEach((tmp) => {
        tmp.uniform1f(time);
      });
    }
    iTimeDelta.uniform1f(30);

    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);

    fn && fn();

    // gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // gl.clear(0);
    // gl.enable()

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  };

  let then = 0;
  let time = 0;
  let iframe = 0;
  function render(now: number) {
    if (_uuid !== uuid) {
      return;
    }

    now *= 0.001;
    const elapsedTime = Math.min(now - then, 0.1);
    then = now;
    iframe++;

    if (api.run) {
      time += elapsedTime;

      webglUtils.resizeCanvasToDisplaySize(canvas);

      const fns: any[] = [];
      channelList.forEach((fn, i) => {
        const { width, height, bindTexture } = fn({ setFramebuffer });
        iChannelResolution[i].uniform3f(width, height, 1);
        bindTexture && fns.push(bindTexture);
      });

      setFramebuffer(program, null, {
        a_position,
        iResolution,
        iTime,
        iMouse,
        iFrameRate,
        iFrame,
        iDate,
        iChannelTime: [
          iChannelTime0,
          iChannelTime1,
          iChannelTime2,
          iChannelTime3,
        ],
        iTimeDelta,
        fn: () => {
          fn && fn();
          fns.forEach((f) => f());
        },
      });

      if (threeSM) {
        threeSM.uniforms.iTime.value = time;
        threeSM.uniforms.iMouse.value = [mouseX, mouseY, clickX, clickY];
        threeSM.uniforms.iFrameRate.value = 30;
        threeSM.uniforms.iFrame.value = iframe;
      }

      threeRenderer.render(threeScene, threeCamera);
    }

    stats.update();
    requestAnimationFrame(render);
  }
}

async function createChannelList(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  sub: iSub
): Promise<any[]> {
  const res: any[] = [];
  if (sub.channels) {
    const channels = sub.channels();
    if (channels && channels.length > 0) {
      for (let i = 0; i < channels.length; i++) {
        const c = channels[i];
        if (c.type == 0) {
          const image = await createChannelFromImage(c.path);
          const tmp = webglUtils.getTexture(
            gl,
            program,
            'iChannel' + i,
            image,
            i,
            c
          );
          res.push(() => {
            tmp.bindTexture();
            return {
              width: image.width,
              height: image.height,
            };
          });
        } else if (c.type == 1) {
          const texture = webglUtils.createAndSetupTexture(gl, c);
          gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            400,
            300,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
          );
          const fbo = gl.createFramebuffer();
          gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
          gl.framebufferTexture2D(
            gl.FRAMEBUFFER,
            gl.COLOR_ATTACHMENT0,
            gl.TEXTURE_2D,
            texture,
            0
          );
          const webglV = sub.webgl ? sub.webgl() : WEBGL_1;
          const v = webglV ? vertex2 : vertex;

          let f = webglV === WEBGL_2 ? fragment2 : fragment;
          f = f.replace('{COMMON}', sub.common ? sub.common() : '');
          f = f.replace(
            '{PRECISION}',
            sub.fragmentPrecision ? sub.fragmentPrecision() : PRECISION_MEDIUMP
          );
          f = f.replace('{USER_FRAGMENT}', c.f);

          const subp = webglUtils.createProgram2(gl, v, f);
          const loc = gl.getUniformLocation(program, 'iChannel' + c.fi);
          const other: any = {};
          other.a_position = webglUtils.getAttribLocation(
            gl,
            subp,
            'a_position'
          );
          other.a_position.setFloat32(
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
          );
          other.iResolution = webglUtils.getUniformLocation(
            gl,
            subp,
            'iResolution'
          );
          other.iTime = webglUtils.getUniformLocation(gl, subp, 'iTime');
          other.iMouse = webglUtils.getUniformLocation(gl, subp, 'iMouse');
          other.iDate = webglUtils.getUniformLocation(gl, subp, 'iDate');
          other.iFrameRate = webglUtils.getUniformLocation(
            gl,
            subp,
            'iFrameRate'
          );
          other.iFrame = webglUtils.getUniformLocation(gl, subp, 'iFrame');
          other.iTimeDelta = webglUtils.getUniformLocation(
            gl,
            subp,
            'iTimeDelta'
          );

          res.push((p: any) => {
            p.setFramebuffer(subp, fbo, other);

            return {
              width: 400,
              height: 300,
              bindTexture: () => {
                gl.uniform1i(loc, c.fi);
                gl.activeTexture(gl.TEXTURE0 + c.fi);
                gl.bindTexture(gl.TEXTURE_2D, texture);
                if (webglUtils.needGenerateMipmap(c)) {
                  gl.generateMipmap(gl.TEXTURE_2D);
                }
              },
            };
          });
        } else if (c.type == 2) {
          const tmp = webglUtils.getTexture(
            gl,
            program,
            'iChannel' + i,
            c.video,
            i,
            c
          );

          res.push((p: any) => {
            return {
              width: c.video.width,
              height: c.video.height,
              bindTexture: () => {
                tmp.bindTexture();
              },
            };
          });
        } else if (c.type == 3) {
          const tmp = webglUtils.getTexture(
            gl,
            program,
            'iChannel' + i,
            soundCanvas as any,
            i,
            c
          );
          res.push((p: any) => {
            return {
              width: 32,
              height: 32,
              bindTexture: () => {
                tmp.updateTexture(soundCanvas as any);
                tmp.bindTexture();
              },
            };
          });
        }
      }
    }
  }
  return res;
}

function createChannelFromImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const image = new Image();
    image.src = src;
    image.onload = () => {
      // gl.TEXTURE_2D
      resolve(image);
    };
  });
}
