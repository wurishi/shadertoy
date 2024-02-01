import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// MIT License: https://opensource.org/licenses/MIT
const float pi = 3.14159;
mat3 rotate( in vec3 v, in float angle){
	float c = cos(angle);
	float s = sin(angle);
	return mat3(c + (1.0 - c) * v.x * v.x, (1.0 - c) * v.x * v.y - s * v.z, (1.0 - c) * v.x * v.z + s * v.y,
		(1.0 - c) * v.x * v.y + s * v.z, c + (1.0 - c) * v.y * v.y, (1.0 - c) * v.y * v.z - s * v.x,
		(1.0 - c) * v.x * v.z - s * v.y, (1.0 - c) * v.y * v.z + s * v.x, c + (1.0 - c) * v.z * v.z
		);
}

vec3 hash(vec3 p){
	p = vec3( dot(p,vec3(127.1,311.7, 74.7)),
			  dot(p,vec3(269.5,183.3,246.1)),
			  dot(p,vec3(113.5,271.9,124.6)));
	return -1.0 + 2.0*fract(sin(p)*43758.5453123);
}

// Gradient noise from iq
// return value noise (in x) and its derivatives (in yzw)
vec4 noised(vec3 x){
    vec3 p = floor(x);
    vec3 w = fract(x);
    vec3 u = w*w*w*(w*(w*6.0-15.0)+10.0);
    vec3 du = 30.0*w*w*(w*(w-2.0)+1.0);
    
    vec3 ga = hash( p+vec3(0.0,0.0,0.0) );
    vec3 gb = hash( p+vec3(1.0,0.0,0.0) );
    vec3 gc = hash( p+vec3(0.0,1.0,0.0) );
    vec3 gd = hash( p+vec3(1.0,1.0,0.0) );
    vec3 ge = hash( p+vec3(0.0,0.0,1.0) );
	vec3 gf = hash( p+vec3(1.0,0.0,1.0) );
    vec3 gg = hash( p+vec3(0.0,1.0,1.0) );
    vec3 gh = hash( p+vec3(1.0,1.0,1.0) );
    
    float va = dot( ga, w-vec3(0.0,0.0,0.0) );
    float vb = dot( gb, w-vec3(1.0,0.0,0.0) );
    float vc = dot( gc, w-vec3(0.0,1.0,0.0) );
    float vd = dot( gd, w-vec3(1.0,1.0,0.0) );
    float ve = dot( ge, w-vec3(0.0,0.0,1.0) );
    float vf = dot( gf, w-vec3(1.0,0.0,1.0) );
    float vg = dot( gg, w-vec3(0.0,1.0,1.0) );
    float vh = dot( gh, w-vec3(1.0,1.0,1.0) );
	
    return vec4( va + u.x*(vb-va) + u.y*(vc-va) + u.z*(ve-va) + u.x*u.y*(va-vb-vc+vd) + u.y*u.z*(va-vc-ve+vg) + u.z*u.x*(va-vb-ve+vf) + (-va+vb+vc-vd+ve-vf-vg+vh)*u.x*u.y*u.z,    // value
                 ga + u.x*(gb-ga) + u.y*(gc-ga) + u.z*(ge-ga) + u.x*u.y*(ga-gb-gc+gd) + u.y*u.z*(ga-gc-ge+gg) + u.z*u.x*(ga-gb-ge+gf) + (-ga+gb+gc-gd+ge-gf-gg+gh)*u.x*u.y*u.z +   // derivatives
                 du * (vec3(vb,vc,ve) - va + u.yzx*vec3(va-vb-vc+vd,va-vc-ve+vg,va-vb-ve+vf) + u.zxy*vec3(va-vb-ve+vf,va-vb-vc+vd,va-vc-ve+vg) + u.yzx*u.zxy*(-va+vb+vc-vd+ve-vf-vg+vh) ));
}

float map(vec3 p){
    // ugly hacky slow distance field with bad gradients
    float d = p.y;
    float c = max(0.0, pow(distance(p.xz, vec2(0,16)), 1.0));
    float cc = pow(smoothstep(20.0, 5.0, c), 2.0);
    //p.xz *= cc;
    vec4 n = noised(vec3(p.xz*0.07, iTime*0.5));
    float nn = n.x * (length((n.yzw)));
    n = noised(vec3(p.xz*0.173, iTime*0.639));
    nn += 0.25*n.x * (length((n.yzw)));
    nn = smoothstep(-0.5, 0.5, nn);
    d = d-6.0*nn*(cc);
    return d;
}

float err(float dist){
    dist = dist/100.0;
    return min(0.01, dist*dist);
}

vec3 dr(vec3 origin, vec3 direction, vec3 position){
    const int iterations = 3;
    for(int i = 0; i < iterations; i++){
        position = position + direction * (map(position) - err(distance(origin, position)));
    }
    return position;
}

vec3 intersect(vec3 ro, vec3 rd){
	vec3 p = ro+rd;
	float t = 0.;
	for(int i = 0; i < 150; i++){
        float d = 0.5*map(p);
        t += d;
        p += rd*d;
		if(d < 0.01 || t > 60.0) break;
	}
    
    // discontinuity reduction as described (somewhat) in
    // their 2014 sphere tracing paper
    p = dr(ro, rd, p);
    return p;
}

vec3 normal(vec3 p){
	float e=0.01;
	return normalize(vec3(map(p+vec3(e,0,0))-map(p-vec3(e,0,0)),
	                      map(p+vec3(0,e,0))-map(p-vec3(0,e,0)),
	                      map(p+vec3(0,0,e))-map(p-vec3(0,0,e))));
}

float G1V(float dnv, float k){
    return 1.0/(dnv*(1.0-k)+k);
}

float ggx(vec3 n, vec3 v, vec3 l, float rough, float f0){
    float alpha = rough*rough;
    vec3 h = normalize(v+l);
    float dnl = clamp(dot(n,l), 0.0, 1.0);
    float dnv = clamp(dot(n,v), 0.0, 1.0);
    float dnh = clamp(dot(n,h), 0.0, 1.0);
    float dlh = clamp(dot(l,h), 0.0, 1.0);
    float f, d, vis;
    float asqr = alpha*alpha;
    const float pi = 3.14159;
    float den = dnh*dnh*(asqr-1.0)+1.0;
    d = asqr/(pi * den * den);
    dlh = pow(1.0-dlh, 5.0);
    f = f0 + (1.0-f0)*dlh;
    float k = alpha/1.0;
    vis = G1V(dnl, k)*G1V(dnv, k);
    float spec = dnl * d * f * vis;
    return spec;
}

float subsurface(vec3 p, vec3 v, vec3 n){
    //vec3 d = normalize(mix(v, -n, 0.5));
    // suggested by Shane
    vec3 d = refract(v, n, 1.0/1.5);
    vec3 o = p;
    float a = 0.0;
    
    const float max_scatter = 2.5;
    for(float i = 0.1; i < max_scatter; i += 0.2)
    {
        o += i*d;
        float t = map(o);
        a += t;
    }
    float thickness = max(0.0, -a);
    const float scatter_strength = 16.0;
	return scatter_strength*pow(max_scatter*0.5, 3.0)/thickness;
}

vec3 shade(vec3 p, vec3 v){
    vec3 lp = vec3(50,20,10);
    vec3 ld = normalize(p+lp);
    
    vec3 n = normal(p);
    float fresnel = pow( max(0.0, 1.0+dot(n, v)), 5.0 );
    
    vec3 final = vec3(0);
    vec3 ambient = vec3(0.1, 0.06, 0.035);
    vec3 albedo = vec3(0.75, 0.9, 0.35);
    vec3 sky = vec3(0.5,0.65,0.8)*2.0;
    
    float lamb = max(0.0, dot(n, ld));
    float spec = ggx(n, v, ld, 3.0, fresnel);
    float ss = max(0.0, subsurface(p, v, n));
    
    // artistic license
    lamb = mix(lamb, 3.5*smoothstep(0.0, 2.0, pow(ss, 0.6)), 0.7);
    final = ambient + albedo*lamb+ 25.0*spec + fresnel*sky;
    return vec3(final*0.5);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord){
    vec2 uv = fragCoord / iResolution.xy;
    vec3 a = vec3(0);
    
    // leftover stuff from something else, too lazy to remove
    // don't ask
    const float campos = 5.1;
    float lerp = 0.5+0.5*cos(campos*0.4-pi);
    lerp = smoothstep(0.13, 1.0, lerp);
    vec3 c = mix(vec3(-0,217,0), vec3(0,4.4,-190), pow(lerp,1.0));
    mat3 rot = rotate(vec3(1,0,0), pi/2.0);
    mat3 ro2 = rotate(vec3(1,0,0), -0.008*pi/2.0);
    
    vec2 u2 = -1.0+2.0*uv;
    u2.x *= iResolution.x/iResolution.y;

    vec3 d = mix(normalize(vec3(u2, 20)*rot), normalize(vec3(u2, 20))*ro2, pow(lerp,1.11));
    d = normalize(d);

    vec3 ii = intersect(c+145.0*d, d);
    vec3 ss = shade(ii, d);
    a += ss;
    
    fragColor.rgb = a*(0.99+0.02*hash(vec3(uv,0.001*iTime)));
    fragColor.a = 1.;
}
`;

const buffB = `
// FXAA implementation by mudlord (I think?)
void mainImage(out vec4 fragColor, vec2 fragCoord){
    vec2 p = fragCoord.xy/iResolution.xy;
    vec2 pp = 1.0 / iResolution.xy;
    vec4 color = texture(iChannel0, vec2(fragCoord.xy * pp));
    vec3 luma = vec3(0.299, 0.587, 0.114);
    float lumaNW = dot(texture(iChannel0, (fragCoord.xy + vec2(-1.0, -1.0)) * pp).xyz, luma);
    float lumaNE = dot(texture(iChannel0, (fragCoord.xy + vec2(1.0, -1.0)) * pp).xyz, luma);
    float lumaSW = dot(texture(iChannel0, (fragCoord.xy + vec2(-1.0, 1.0)) * pp).xyz, luma);
    float lumaSE = dot(texture(iChannel0, (fragCoord.xy + vec2(1.0, 1.0)) * pp).xyz, luma);
    float lumaM  = dot(color.xyz,  luma);
    float lumaMin = min(lumaM, min(min(lumaNW, lumaNE), min(lumaSW, lumaSE)));
    float lumaMax = max(lumaM, max(max(lumaNW, lumaNE), max(lumaSW, lumaSE)));

    vec2 dir = vec2(-((lumaNW + lumaNE) - (lumaSW + lumaSE)), ((lumaNW + lumaSW) - (lumaNE + lumaSE)));

    float dirReduce = max((lumaNW + lumaNE + lumaSW + lumaSE) *
                          (0.25 * (1.0/8.0)), (1.0/128.0));

    float rcpDirMin = 2.5 / (min(abs(dir.x), abs(dir.y)) + dirReduce);
    dir = min(vec2(8.0, 8.0),
              max(vec2(-8.0, -8.0),
              dir * rcpDirMin)) * pp;

    vec3 rgbA = 0.5 * (
        texture(iChannel0, fragCoord.xy * pp + dir * (1.0 / 3.0 - 0.5)).xyz +
        texture(iChannel0, fragCoord.xy * pp + dir * (2.0 / 3.0 - 0.5)).xyz);
    vec3 rgbB = rgbA * 0.5 + 0.25 * (
        texture(iChannel0, fragCoord.xy * pp + dir * -0.5).xyz +
        texture(iChannel0, fragCoord.xy * pp + dir * 0.5).xyz);

    float lumaB = dot(rgbB, luma);
    if ((lumaB < lumaMin) || (lumaB > lumaMax)){
        fragColor = vec4(rgbA, color.w);
    } else {
        fragColor = vec4(rgbB, color.w);
    }
    fragColor.a = 1.;
}
`;

const fragment = `
// Tone mapping and post processing
float hash(float c){return fract(sin(dot(c,12.9898))*43758.5453);}

// linear white point
const float W = 1.2;
const float T2 = 7.5;

float filmic_reinhard_curve (float x) {
    float q = (T2*T2 + 1.0)*x*x;    
	return q / (q + x + T2*T2);
}

vec3 filmic_reinhard(vec3 x) {
    float w = filmic_reinhard_curve(W);
    return vec3(
        filmic_reinhard_curve(x.r),
        filmic_reinhard_curve(x.g),
        filmic_reinhard_curve(x.b)) / w;
}

const int N = 8;
vec3 ca(sampler2D t, vec2 UV, vec4 sampl){
	vec2 uv = 1.0 - 2.0 * UV;
	vec3 c = vec3(0);
	float rf = 1.0;
	float gf = 1.0;
    float bf = 1.0;
	float f = 1.0/float(N);
	for(int i = 0; i < N; ++i){
		c.r += f*texture(t, 0.5-0.5*(uv*rf) ).r;
		c.g += f*texture(t, 0.5-0.5*(uv*gf) ).g;
		c.b += f*texture(t, 0.5-0.5*(uv*bf) ).b;
		rf *= 0.9972;
		gf *= 0.998;
        bf /= 0.9988;
		c = clamp(c,0.0, 1.0);
	}
	return c;
}

void mainImage(out vec4 fragColor,vec2 fragCoord){
    const float brightness = 1.0;
    vec2 pp = fragCoord.xy/iResolution.xy;
    vec2 r = iResolution.xy;
    vec2 p = 1.-2.*fragCoord.xy/r.xy;
    p.y *= r.y/r.x;
   
    // a little chromatic aberration
    vec4 sampl = texture(iChannel1, pp);
    vec3 color = ca(iChannel1, pp, sampl).rgb;
    
    // final output
    float vignette = 1.25 / (1.1 + 1.1*dot(p, p));
    vignette *= vignette;
    vignette = mix(1.0, smoothstep(0.1, 1.1, vignette), 0.25);
    float noise = .012*vec3(hash(length(p)*iTime)).x;
    color = color*vignette+noise;
    color = filmic_reinhard(brightness*color);
    
    color = smoothstep(-0.025, 1.0,color);
    
    color = pow(color, vec3(1.0/2.2));
    fragColor = vec4(color, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'lllBDM';
  }
  name(): string {
    return '(未完成) Goo';
  }
  sort() {
    return 416;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  userFragment(): string {
    return buffA;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {}
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    return () => {};
  }
  channels() {
    return [
      { type: 1, f: buffA, fi: 0 }, //
      { type: 1, f: buffB, fi: 0 }, //
    ];
  }
}
