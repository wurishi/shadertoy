import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define PI	3.14159265359
#define PI2	( PI * 2.0 )

vec2 rotate(in vec2 p, in float t)
{
	return p * cos(-t) + vec2(p.y, -p.x) * sin(-t);
}

float tetrahedron(in vec3 p) // 4
{
    vec3 v = vec3(0.0, 1.0, 0.0);
    float d = dot(p, (v));
    v.xy = rotate(v.xy, 1.91063); // ?
    for(float i = 0.0; i < 3.0; i++)
    {
        d = max(d, dot(p, vec3(rotate(v.xz, i * PI2 / 3.0), v.y).xzy));
    }
    return d;
}


float hexahedron(in vec3 p) // 6
{
    vec3 v = vec3(0.0, 1.0, 0.0);
    float d = abs(dot(p, (v)));
    v.xy = rotate(v.xy, PI / 2.0);
    d = max(d, abs(dot(p, (v))));
    v.xz = rotate(v.xz, PI / 2.0);
    d = max(d, abs(dot(p, (v))));
    return d;
}

float octahedron(in vec3 p) // 8
{
    vec3 v = vec3(0.0, 1.0, 0.0);
	float a = atan(1.0, sin(PI / 4.0));
    v.xy = rotate(v.xy, a);
    float d = 1.0;    
    for(float i = 0.0; i < 4.0; i++)
    {
    	d = max(d, abs(dot(p, vec3(rotate(v.xz, i * PI2 / 4.0), v.y).xzy)));
    }
    return d;
}

float dodecahedron(in vec3 p) // 12
{    
    vec3 v = vec3(0.0, 1.0, 0.0);
    float d = abs(dot(p, (v)));
    v.xy = rotate(v.xy, PI2 / 6.0);
    for(float i = 0.0; i < 5.0; i++)
    {
        d = max(d, abs(dot(p, vec3(rotate(v.xz, i * PI2 / 5.0), v.y).xzy)));
    }
    return d;
}

float icosahedron(in vec3 p) // 20
{
    vec3 v = vec3(0.0, 1.0, 0.0);
    float n =  0.69; // ?
    vec3 v1 = vec3(rotate(v.xy, n), v.z);
    vec3 v2 = vec3(rotate(v.xy, n * 2.0), v.z);
    float d = 1.0;    
    for(float i = 0.0; i < 5.0; i++)
    {
    	d = max(d, abs(dot(p, vec3(rotate(v1.xz, i * PI2 / 5.0), v1.y).xzy)));
    	d = max(d, abs(dot(p, vec3(rotate(v2.xz, i * PI2 / 5.0), v2.y).xzy)));
    }
    return d;
}


float map(in vec3 p)
{
    float t = mod(iTime * 0.5, 15.0);
    if (t < 3.0)  return mix(tetrahedron(p) - 0.5, hexahedron(p)  -1.0, smoothstep( 1.0,  2.0, t));
    if (t < 6.0)  return mix(hexahedron(p)  - 1.0, octahedron(p)  -1.0, smoothstep( 4.0,  5.0, t));
    if (t < 9.0)  return mix(octahedron(p)  - 1.0, dodecahedron(p)-1.0, smoothstep( 7.0,  8.0, t));
    if (t < 12.0) return mix(dodecahedron(p)- 1.0, icosahedron(p) -1.0, smoothstep(10.0, 11.0, t));
    if (t < 15.0) return mix(icosahedron(p) - 1.0, tetrahedron(p) -0.5, smoothstep(13.0, 14.0, t));
    return 1.0;
}

vec3 calcNormal(in vec3 p)
{
	const vec2 e = vec2(0.0001, 0.0);
	return normalize(vec3(
		map(p + e.xyy) - map(p - e.xyy),
		map(p + e.yxy) - map(p - e.yxy),
		map(p + e.yyx) - map(p - e.yyx)));
}

float march(in vec3 ro, in vec3 rd)
{
	const float maxd = 50.0;
	const float precis = 0.001;
    float h = precis * 2.0;
    float t = 0.0;
	float res = -1.0;
    for(int i = 0; i < 64; i++)
    {
        if(h < precis || t > maxd) break;
	    h = map(ro + rd * t);
        t += h;
    }
    if(t < maxd) res = t;
    return res;
}

vec3 transform(in vec3 p)
{
    p.yz = rotate(p.yz, iTime * 0.8);
    p.zx = rotate(p.zx, iTime * 0.5);
    return p;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (2.0 * fragCoord.xy - iResolution.xy) / iResolution.y;
	vec3 col = vec3(0.1 + p.y * 0.15);
   	vec3 rd = normalize(vec3(p, -1.8));
	vec3 ro = vec3(0.0, 0.0, 4.5);
    vec3 li = normalize(vec3(0.5, 0.8, 3.0));
    ro = transform(ro);
	rd = transform(rd);
	li = transform(li);
    float t = march(ro, rd);
    if(t > -0.001)
    {
        vec3 pos = ro + t * rd;
        vec3 n = calcNormal(pos);
		float dif = clamp((dot(n, li) + 0.5) * 0.7, 0.3, 1.0);
        col = vec3(0.95, 0.9, 0.7) * dif;
    }
   	fragColor = vec4(col, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'XtXGRS';
  }
  name(): string {
    return 'Polyhedron DE';
  }
  sort() {
    return 278;
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
