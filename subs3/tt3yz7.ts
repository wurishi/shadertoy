import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float sdEllipse( vec2 p, vec2 e )
{
    vec2 pAbs = abs(p);
    vec2 ei = 1.0 / e;
    vec2 e2 = e*e;
    vec2 ve = ei * vec2(e2.x - e2.y, e2.y - e2.x);
    
    vec2 t = vec2(0.70710678118654752, 0.70710678118654752);
    for (int i = 0; i < 3; i++) {
        vec2 v = ve*t*t*t;
        vec2 u = normalize(pAbs - v) * length(t * e - v);
        vec2 w = ei * (v + u);
        t = normalize(clamp(w, 0.0, 1.0));
    }
    
    vec2 nearestAbs = t * e;
    float dist = length(pAbs - nearestAbs);
    return dot(pAbs, pAbs) < dot(nearestAbs, nearestAbs) ? -dist : dist;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = (2.0*fragCoord-iResolution.xy)/iResolution.y;
	
    vec2 m = iMouse.xy/iResolution.xy;
	m.x *= iResolution.x/iResolution.y;
    
    if (iMouse.xy == vec2(0.0, 0.0)) {
        m = vec2(0.9, 0.6);
    }
	
    float d = sdEllipse( uv, m + vec2(0.01, 0.01) );
    vec3 col = vec3(1.0) - sign(d)*vec3(0.1,0.4,0.7);
	col *= 1.0 - exp(-2.0*abs(d));
	col *= 0.8 + 0.2*cos(120.0*d);
	col = mix( col, vec3(1.0), 1.0-smoothstep(0.0,0.02,abs(d)) );

	fragColor = vec4( col, 1.0 );;
}
`;

export default class implements iSub {
  key(): string {
    return 'tt3yz7';
  }
  name(): string {
    return 'Ellipse - SDF (trigless, 3 iter)';
  }
  sort() {
    return 371;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  userFragment(): string {
    return fragment;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {}
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    return () => {};
  }
}
