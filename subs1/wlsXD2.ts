import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
const float xscale = .25;
const float yscale = .2;
const float xspeed = 1.0;
const float timeMult = .17;
const float sluggishness = 10.;
const float camShakiness = 0.05;
const float camZoom = 0.1;

//---------------------------------------------

const float PI = atan(1.)*4.;
const float PI2 = PI*2.;

vec3 hash32(vec2 p) {
	vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+19.19);
    return fract((p3.xxy+p3.yzz)*p3.zyx);
}

float dtoa(float d, float amount){
    return 1. / clamp(d*amount, 1., amount);
}
float sdSquare(vec2 p, vec2 pos, vec2 origin, float a, float s) {
	vec2 d = abs(((p-pos) * mat2(cos(a), sin(a), -sin(a), cos(a))) - origin) - s;
	return min(max(d.x, d.y), 0.0) + length(max(d, 0.0));
}

// returns { x:orig, y:height, z:position 0-1 within this cell }
vec3 cell(float x) {
    float pos = fract(x/xscale);
    float orig = (x/xscale-pos)*xscale;
    float h = hash32(vec2(orig)).r;
    return vec3(orig, h * yscale, pos);
}

void scene(out vec4 o, vec2 N, vec2 uv, float t, float xpos, float xcam) {
    vec3 sqCellPrev = cell(xpos-xscale);
    
    // ground
    vec3 bigCellThis = cell(uv.x);
    vec3 bigCellNext = cell(uv.x + xscale);
    float bigHeightThis = mix(bigCellThis.y, bigCellNext.y, bigCellThis.z);// terrain height
    float sd = uv.y - bigHeightThis;

    // walking square; interpolate between positions
    float sdsq = 1e7;
    vec3 sqCellThis = cell(xpos);
    vec3 sqCellNext = cell(xpos+xscale);
    float aThis = atan(sqCellPrev.y - sqCellThis.y, sqCellPrev.x - sqCellThis.x);
    float aNext = atan(sqCellThis.y - sqCellNext.y, sqCellThis.x - sqCellNext.x) - PI*.5;
    if(aNext > aThis+PI) aNext -= PI2;
    if(aNext < aThis-PI) aNext += PI2;

    float szThis = distance(sqCellPrev.xy, sqCellThis.xy);
    float szNext = distance(sqCellThis.xy, sqCellNext.xy);

    float asq = mix(aThis, aNext, pow(sqCellNext.z, sluggishness));
    float sz = mix(szThis, szNext, pow(sqCellNext.z, sluggishness));
    sdsq = sdSquare(uv,
                                  vec2(sqCellThis.x, sqCellThis.y),
                                  vec2(-sz*.5,sz*.5), asq+PI, sz*.5);

    // parallax bg
    o=vec4(0);
    vec2 uvtemp =uv;
    for (float i = 1.; i <= 9.; ++i) {
        uvtemp.x -= xpos;
        uvtemp*=vec2(2.,1.8);
        //uvtemp *= 2.;
        uvtemp.y -= .3;
        uvtemp.x += xpos + 1e3;
        vec3 cellThis = cell(uvtemp.x);
        vec3 cellNext = cell(uvtemp.x + xscale);
        float heightThis = mix(cellThis.y, cellNext.y, cellThis.z);
        float sd = uvtemp.y - heightThis;
        o.rgb = max(o.rgb, dtoa(sd,1e4)*.2/i);
        
        float amt = 25.+heightThis*500.;
        //amt = 1000./((uvtemp.y)*100.);
      	o.rgb = max(o.rgb, dtoa(abs(sd)+.01,amt)*.4/i);
    }
    o +=vec4(.8-uv.y*1.1);
    o.g *= o.r;
    o.r *=.6;
    o.b += N.y;

    // square
    float alphasq = dtoa(sdsq, 1000.);
    o.rgb = mix(o.rgb, vec3(.9,.1,.1), alphasq);
    
    // ground
    float alphagr = dtoa(sd, 300.);
    o.rgb = mix(o.rgb, vec3(1), alphagr);
    
    // snow
    float amt = 25.+bigHeightThis*500.;
    alphagr = dtoa(abs(sd+.01), amt);
    o.rgb = mix(o.rgb, vec3(.8,.9,1), alphagr);
}

void mainImage( out vec4 o, vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy-.5;
    vec2 N = uv;
    uv.x *= iResolution.x / iResolution.y;
    float t = iTime*timeMult;
    float xpos = t*xspeed;
    float xcam = sin(t)*sin(t*9.)*camShakiness;// shaky cam
    uv *=.7+sin(t*2.)*camZoom;//zoomy cam
    uv.x += xpos + xcam;
	uv.y += .3;

    // calc scene twice & motion blur
    vec3 sqCellPrev = cell(xpos-xscale);
    float bounce = abs(sin(sqCellPrev.z*26.))*pow(1.-sqCellPrev.z, 7.) * .03;
    uv.y += bounce;
    scene(o, N, uv, t, xpos, xcam);
    uv.y -= bounce;
    vec4 o2;
    scene(o2, N, uv, t, xpos, xcam);
    o = mix(o2, o, .5);
    
    o.b *= .9;
    o.rgb += (hash32(fragCoord+iTime)-.5)*.08;
    o *= 1.1-dot(N,N);
    o=clamp(o,0.,1.);
    o.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'wlsXD2';
  }
  name(): string {
    return 'Keep up little square';
  }
  sort() {
    return 157;
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
