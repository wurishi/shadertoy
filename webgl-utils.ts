enum ShaderType {
  VERTEX_SHADER = WebGLRenderingContext.VERTEX_SHADER,
  FRAGMENT_SHADER = WebGLRenderingContext.FRAGMENT_SHADER,
}

/**
 * 创建并编译一个着色器
 * @param gl WebGL上下文
 * @param shaderSource GLSL 格式的着色器代码
 * @param shaderType 着色器类型(VERTEX_SHADER / FRAGMENT_SHADER)
 * @return 着色器
 */
export function compileShader(
  gl: WebGLRenderingContext,
  shaderSource: string,
  shaderType: ShaderType
): WebGLShader {
  // 创建着色器程序
  const shader = gl.createShader(shaderType);

  // 设置着色器的源码
  gl.shaderSource(shader, shaderSource);

  // 编译着色器
  gl.compileShader(shader);

  // 检测编译是否成功
  const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    // 编译过程出错, 获取错误信息
    throw new Error('着色器未编译成功: ' + gl.getShaderInfoLog(shader));
  }

  return shader;
}

/**
 * 将2个着色器链接并创建一个着色器程序
 * @param gl WebGL 上下文
 * @param vertexShader 顶点着色器
 * @param fragmentShader 片断着色器
 * @return 着色器程序
 */
export function createProgram(
  gl: WebGLRenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader
): WebGLProgram {
  // 创建一个程序
  const program = gl.createProgram();

  // 附上着色器
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  // 链接到程序
  gl.linkProgram(program);

  // 检查链接是否成功
  const success = gl.getProgramParameter(program, gl.LINK_STATUS);
  if (!success) {
    // 链接过程出现问题
    throw new Error('链接失败: ' + gl.getProgramInfoLog(program));
  }

  return program;
}

/**
 * 用 script 标签的内容创建着色器
 * @param gl WebGL 上下文
 * @param scriptId script标签的id
 * @param opt_shaderType 着色器类型 (如果没有指定, 则使用script标签的type属性)
 */
export function createShaderFromScript(
  gl: WebGLRenderingContext,
  scriptId: string,
  opt_shaderType?: ShaderType
): WebGLShader {
  // 通过 id 找到 script 标签
  const shaderScript = document.getElementById(scriptId) as HTMLScriptElement;
  if (!shaderScript) {
    throw new Error('未找到 script 标签: ' + scriptId);
  }

  // 提取标签内容
  const shaderSource = shaderScript.text;

  // 如果没有指定着色器类型, 就使用标签的 'type' 属性
  if (!opt_shaderType) {
    if (shaderScript.type == 'x-shader/x-vertex') {
      opt_shaderType = WebGLRenderingContext.VERTEX_SHADER;
    } else if (shaderScript.type == 'x-shader/x-fragment') {
      opt_shaderType = WebGLRenderingContext.FRAGMENT_SHADER;
    } else {
      throw new Error('shader 类型没有正确指定');
    }
  }

  return compileShader(gl, shaderSource, opt_shaderType);
}

/**
 * 通过两个 script 标签创建着色器程序
 * @param gl WebGL 上下文
 * @param vertexShaderId 顶点着色器的标签 id
 * @param fragmentShaderId 片断着色器的标签 id
 * @returns 着色器程序
 */
export function createProgramFromScripts(
  gl: WebGLRenderingContext,
  vertexShaderId: string,
  fragmentShaderId: string
) {
  const vertexShader = createShaderFromScript(
    gl,
    vertexShaderId,
    WebGLRenderingContext.VERTEX_SHADER
  );
  const fragmentShader = createShaderFromScript(
    gl,
    fragmentShaderId,
    WebGLRenderingContext.FRAGMENT_SHADER
  );
  return createProgram(gl, vertexShader, fragmentShader);
}

export function createProgram2(
  gl: WebGLRenderingContext,
  vertex: string,
  fragment: string
) {
  const vertexShader = compileShader(
    gl,
    vertex,
    WebGLRenderingContext.VERTEX_SHADER
  );
  const fragmentShader = compileShader(
    gl,
    fragment,
    WebGLRenderingContext.FRAGMENT_SHADER
  );
  return createProgram(gl, vertexShader, fragmentShader);
}

/**
 *
 * @param canvas
 * @param pixelRatio
 */
export function resizeCanvasToDisplaySize(
  canvas: HTMLCanvasElement,
  pixelRatio: boolean = true
): boolean {
  // 1个CSS像素对应多少个实际像素
  const realToCSSPixels = pixelRatio ? window.devicePixelRatio : 1;

  // 获取浏览器中画布的显示尺寸
  const displayWidth = Math.floor(canvas.clientWidth * realToCSSPixels);
  const displayHeight = Math.floor(canvas.clientHeight * realToCSSPixels);

  // 检测尺寸是否相同
  if (canvas.width != displayWidth || canvas.height != displayHeight) {
    // 设置为相同尺寸
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    return true;
  }
  return false;
}

export function createCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.id = 'c';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  document.body.appendChild(canvas);
  return canvas;
}

export function setRectangle(
  gl: WebGLRenderingContext,
  target: number,
  x: number,
  y: number,
  width: number,
  height: number
) {
  const x1 = x,
    x2 = x + width;
  const y1 = y,
    y2 = y + height;
  gl.bufferData(
    target,
    new Float32Array([x1, y1, x2, y1, x1, y2, x1, y2, x2, y1, x2, y2]),
    gl.STATIC_DRAW
  );
}

export function setTexcoord(gl: WebGLRenderingContext, target: number) {
  gl.bufferData(
    target,
    new Float32Array([
      0.0,
      0.0,
      1.0,
      0.0,
      0.0,
      1.0,
      0.0,
      1.0,
      1.0,
      0.0,
      1.0,
      1.0,
    ]),
    gl.STATIC_DRAW
  );
}

export function createAndSetupTexture(
  gl: WebGLRenderingContext,
  texParams?: any
) {
  texParams = texParams || {};
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);

  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_WRAP_S,
    texParams.hasOwnProperty(gl.TEXTURE_WRAP_S)
      ? texParams[gl.TEXTURE_WRAP_S]
      : gl.REPEAT
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_WRAP_T,
    texParams.hasOwnProperty(gl.TEXTURE_WRAP_T)
      ? texParams[gl.TEXTURE_WRAP_T]
      : gl.REPEAT
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MIN_FILTER,
    texParams.hasOwnProperty(gl.TEXTURE_MIN_FILTER)
      ? texParams[gl.TEXTURE_MIN_FILTER]
      : gl.NEAREST
  );
  gl.texParameteri(
    gl.TEXTURE_2D,
    gl.TEXTURE_MAG_FILTER,
    texParams.hasOwnProperty(gl.TEXTURE_MAG_FILTER)
      ? texParams[gl.TEXTURE_MAG_FILTER]
      : gl.NEAREST
  );

  return texture;
}

export function getAttribLocation(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string
) {
  const loc = gl.getAttribLocation(program, name);
  let buffer: WebGLBuffer = null;
  let size: number;
  let type: number;
  let normalize = false;
  return {
    setFloat32(arr: Float32Array) {
      if (!buffer) {
        size = 2;
        type = gl.FLOAT;
        normalize = false;
        buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW);
      }
    },
    bindBuffer() {
      if (buffer) {
        gl.enableVertexAttribArray(loc);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.vertexAttribPointer(loc, size, type, normalize, 0, 0);
      }
    },
  };
}

export function getUniformLocation(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string
) {
  const loc = gl.getUniformLocation(program, name);
  return {
    uniform2f(x: number, y: number) {
      gl.uniform2f(loc, x, y);
    },
    uniform3f(x: number, y: number, z: number) {
      gl.uniform3f(loc, x, y, z);
    },
    uniform4fv(v: Float32List) {
      gl.uniform4fv(loc, v);
    },
    uniform2fv(v: Float32List) {
      gl.uniform2fv(loc, v);
    },
    uniform1f(x: number) {
      gl.uniform1f(loc, x);
    },
    uniform1i(x: number) {
      gl.uniform1i(loc, x);
    },
    uniformFloatArray(v: Float32Array) {
      gl.uniform1fv(loc, v);
    },
    uniformB(v: boolean) {
      gl.uniform1i(loc, v ? 1 : 0);
    },
  };
}

export function getTexture(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
  image: HTMLImageElement,
  i: number,
  texParams?: any
) {
  texParams = texParams || {};
  const loc = gl.getUniformLocation(program, name);
  const texture = gl.createTexture();
  let tmp = image;
  return {
    updateTexture(image: any) {
      tmp = image;
    },
    bindTexture() {
      if (!tmp) {
        return;
      }
      gl.uniform1i(loc, i);
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, texture);

      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_S,
        texParams.hasOwnProperty(gl.TEXTURE_WRAP_S)
          ? texParams[gl.TEXTURE_WRAP_S]
          : gl.REPEAT
      );
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_WRAP_T,
        texParams.hasOwnProperty(gl.TEXTURE_WRAP_T)
          ? texParams[gl.TEXTURE_WRAP_T]
          : gl.REPEAT
      );
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MIN_FILTER,
        texParams.hasOwnProperty(gl.TEXTURE_MIN_FILTER)
          ? texParams[gl.TEXTURE_MIN_FILTER]
          : gl.NEAREST
      );
      gl.texParameteri(
        gl.TEXTURE_2D,
        gl.TEXTURE_MAG_FILTER,
        texParams.hasOwnProperty(gl.TEXTURE_MAG_FILTER)
          ? texParams[gl.TEXTURE_MAG_FILTER]
          : gl.NEAREST
      );

      if (needGenerateMipmap(texParams)) {
        gl.generateMipmap(gl.TEXTURE_2D);
      }

      gl.pixelStorei(
        gl.UNPACK_FLIP_Y_WEBGL,
        texParams.hasOwnProperty(gl.UNPACK_FLIP_Y_WEBGL)
          ? texParams[gl.UNPACK_FLIP_Y_WEBGL]
          : 1
      );

      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tmp);
    },
  };
}

export function needGenerateMipmap(params: any): boolean {
  const mipmapArr = [
    WebGLRenderingContext.LINEAR_MIPMAP_LINEAR,
    WebGLRenderingContext.LINEAR_MIPMAP_NEAREST,
    WebGLRenderingContext.NEAREST_MIPMAP_LINEAR,
    WebGLRenderingContext.NEAREST_MIPMAP_NEAREST,
  ];
  if (params) {
    if (
      mipmapArr.indexOf(params[WebGLRenderingContext.TEXTURE_MIN_FILTER]) >= 0
    ) {
      return true;
    }
    if (
      mipmapArr.indexOf(params[WebGLRenderingContext.TEXTURE_MAG_FILTER]) >= 0
    ) {
      return true;
    }
  }
  return false;
}

export const DEFAULT_NOISE = { type: 0, path: './textures/noise.png' };

export const DEFAULT_NOISE_BW = { type: 0, path: './textures/noise2.png' };

export const DEFAULT_NOISE3 = { type: 0, path: './textures/noise3.png' };

export const FONT_TEXTURE = { type: 0, path: './textures/font.png' };

export const TEXTURE_NEAREST = {
  [WebGLRenderingContext.TEXTURE_MIN_FILTER]: WebGLRenderingContext.NEAREST,
  [WebGLRenderingContext.TEXTURE_MAG_FILTER]: WebGLRenderingContext.NEAREST,
};

export const TEXTURE_LINEAR = {
  [WebGLRenderingContext.TEXTURE_MIN_FILTER]: WebGLRenderingContext.LINEAR,
  [WebGLRenderingContext.TEXTURE_MAG_FILTER]: WebGLRenderingContext.LINEAR,
};

export const TEXTURE_LINEAR_MIPMAPS = {
  [WebGLRenderingContext.TEXTURE_MIN_FILTER]:
    WebGLRenderingContext.LINEAR_MIPMAP_NEAREST,
  [WebGLRenderingContext.TEXTURE_MAG_FILTER]:
    WebGLRenderingContext.LINEAR_MIPMAP_NEAREST,
};

export const TEXTURE_NEAREST_MIPMAPS = {
  [WebGLRenderingContext.TEXTURE_MIN_FILTER]:
    WebGLRenderingContext.NEAREST_MIPMAP_LINEAR,
  [WebGLRenderingContext.TEXTURE_MAG_FILTER]:
    WebGLRenderingContext.NEAREST_MIPMAP_LINEAR,
};

export const TEXTURE_MIPMAPS = {
  [WebGLRenderingContext.TEXTURE_MIN_FILTER]:
    WebGLRenderingContext.LINEAR_MIPMAP_NEAREST,
  [WebGLRenderingContext.TEXTURE_MAG_FILTER]: WebGLRenderingContext.LINEAR,
};

export const TEXTURE1 = {
  type: 0,
  path: './textures/texture1.jpg',
  ...TEXTURE_MIPMAPS,
};

export const TEXTURE2 = {
  type: 0,
  path: './textures/texture2.png',
  ...TEXTURE_MIPMAPS,
};

export const TEXTURE3 = {
  type: 0,
  path: './textures/texture3.jpg',
  ...TEXTURE_MIPMAPS,
};

export const TEXTURE4 = {
  type: 0,
  path: './textures/texture4.jpg',
  ...TEXTURE_MIPMAPS,
};

export const TEXTURE5 = {
  type: 0,
  path: './textures/texture5.jpg',
  ...TEXTURE_MIPMAPS,
};

export const TEXTURE6 = {
  type: 0,
  path: './textures/texture6.jpg',
  ...TEXTURE_MIPMAPS,
};

export const TEXTURE7 = {
  type: 0,
  path: './textures/texture7.jpg',
  ...TEXTURE_MIPMAPS,
};

export const TEXTURE8 = {
  type: 0,
  path: './textures/texture8.jpg',
  ...TEXTURE_MIPMAPS,
};

export const TEXTURE9 = {
  type: 0,
  path: './textures/texture9.jpg',
  ...TEXTURE_MIPMAPS,
};

export const TEXTURE10 = {
  type: 0,
  path: './textures/texture10.jpg',
  ...TEXTURE_MIPMAPS,
};

export const TEXTURE11 = {
  type: 0,
  path: './textures/texture11.jpg',
  ...TEXTURE_MIPMAPS,
};

export const TEXTURE12 = {
  type: 0,
  path: './textures/texture12.jpg',
  ...TEXTURE_MIPMAPS,
};

export const TEXTURE13 = {
  type: 0,
  path: './textures/texture13.jpg',
  ...TEXTURE_MIPMAPS,
};

export const NO_FLIP_Y = {
  [WebGLRenderingContext.UNPACK_FLIP_Y_WEBGL]: 0,
};

export const WOOD_TEXTURE = TEXTURE8;

export const ROCK_TEXTURE = TEXTURE5;

export const ROCK2_TEXTURE = TEXTURE4;

export function createVideo(src = './media/video.ogv') {
  const video = document.createElement('video');
  let videoAdded = false;
  return {
    video,
    videoInit: () => {
      video.src = src;
      video.autoplay = true;
      video.muted = true;
      video.width = 400;
      video.height = 300;
    },
    videoAdd: () => {
      if (!videoAdded) {
        videoAdded = true;
        document.body.appendChild(video);
      }
    },
    videoDestory: () => {
      document.body.removeChild(video);
      videoAdded = false;
    },
  };
}

export function numberToRGBA(num: number, normalize = false): number[] {
  let rgba: number[] = [];
  rgba[0] = (num >> 16) & 0xff;
  rgba[1] = (num >> 8) & 0xff;
  rgba[2] = num & 0xff;
  rgba[3] = (num >> 24) & 0xff;
  if (normalize) {
    rgba = rgba.map((v) => v / 255);
  }
  return rgba;
}

export function rgbToNumber(rgb: number[], isNormalize = false): number {
  let num = 0;
  if (isNormalize) {
    rgb = rgb.map((v) => v * 255);
  }
  num = (rgb[0] << 16) & 0xff0000;
  num += (rgb[1] << 8) & 0x00ff00;
  num += rgb[2] & 0x0000ff;

  return num;
}
