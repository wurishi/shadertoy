import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';
//FINISH
const fragment = `
uniform float u_layers_count;

float PI = 3.1415;
uniform float u_min_divide;
uniform float u_max_divide;

mat2 Rotate(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

float Star(vec2 uv, float flaresize, float rotAngle, float randomN) {
    float d = length(uv);

    float starcore = 0.05/d;
    uv *= Rotate(-2.0 * PI * rotAngle);
    float flareMax = 1.0;

    float starflares = max(0.0, flareMax - abs(uv.x * uv.y * 3000.0));
    starcore += starflares * flaresize;
    uv *= Rotate(PI * 0.25);

    starflares = max(0.0, flareMax - abs(uv.x * uv.y * 3000.0));
    starcore += starflares * 0.3 * flaresize;
    starcore *= smoothstep(1.0, 0.05, d);

    return starcore;
}

float PseudoRandomizer(vec2 p) {
    p = fract(p*vec2(123.45, 345.67));
    p += dot(p, p+45.32);

    return (fract(p.x * p.y));
}

vec3 StarFieldLayer(vec2 uv, float rotAngle) {
    vec3 col = vec3(0);
    vec2 gv = fract(uv) -0.5;
    vec2 id = floor(uv);

    float deltaTimeTwinkle = iTime * 0.35;

    for (int y = -1; y <= 1; y++) {
        for (int x = -1; x <= 1; x++) {
            vec2 offset = vec2(x, y);

            float randomN = PseudoRandomizer(id + offset);
            float randoX = randomN - 0.5;
            float randoY = fract(randomN * 45.0) - 0.5;
            vec2 randomPosition = gv - offset - vec2(randoX, randoY);

            float size = fract(randomN * 1356.33);
            float flareSwitch = smoothstep(0.9, 1.0, size);

            float star = Star(randomPosition, flareSwitch, rotAngle, randomN);

            float randomStarColorSeed = fract(randomN * 2150.0) * (3.0 * PI) * deltaTimeTwinkle;
            vec3 color = sin(vec3(0.7, 0.3, 0.9) * randomStarColorSeed);

            color = color * (0.4 * sin(deltaTimeTwinkle)) + 0.6;

            color = color * vec3(1, 0.1,  0.9 + size);
            float dimByDensity = 15.0/u_layers_count;
            col += star * size * color * dimByDensity;
         }
    }
    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;

    fragColor = texture(iChannel0, uv);

    float deltaTime = iTime * 0.01;
    vec3 col = vec3(0.0);
    float rotAngle = deltaTime * 0.09;

    for (float i=0.0; i < 1.0; i += (1.0/u_layers_count)) {
        float layerDepth = fract(i + deltaTime);
        float layerScale = mix(u_min_divide,u_max_divide,layerDepth);
        float layerFader = layerDepth * smoothstep(0.1, 1.1, layerDepth);
        float layerOffset = i * (3430.00 + fract(i));
        mat2 layerRot = Rotate(rotAngle * i * -10.0);
        uv *= layerRot;
        vec2 starfieldUv = uv * layerScale + layerOffset;
        col += StarFieldLayer(starfieldUv, rotAngle) * layerFader;
    }

    fragColor += vec4(col, 1.0);
}
`;

let gui: GUI;
const api = {
  u_layers_count: 12,
  u_min_divide: 64,
  u_max_divide: 0.01,
};
export default class implements iSub {
  key(): string {
    return '7dsGWS';
  }
  name(): string {
    return '7dsGWS';
  }
  sort() {
    return 98;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_layers_count', 1, 100, 1);
    gui.add(api, 'u_min_divide', 0.01, 100, 1);
    gui.add(api, 'u_max_divide', 0.01, 100, 0.01);
    return createCanvas();
  }
  userFragment(): string {
    return fragment;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {
    if (gui) {
      gui.destroy();
      gui = null;
    }
  }
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    const u_layers_count = webglUtils.getUniformLocation(
      gl,
      program,
      'u_layers_count'
    );
    const u_min_divide = webglUtils.getUniformLocation(
      gl,
      program,
      'u_min_divide'
    );
    const u_max_divide = webglUtils.getUniformLocation(
      gl,
      program,
      'u_max_divide'
    );
    return () => {
      u_layers_count.uniform1f(api.u_layers_count);
      u_min_divide.uniform1f(api.u_min_divide);
      u_max_divide.uniform1f(api.u_max_divide);
    };
  }
}
