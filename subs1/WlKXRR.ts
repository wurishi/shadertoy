import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const f = `

vec3 getRd(vec3 ro, vec3 lookAt, vec2 uv){
	vec3 dir = normalize(lookAt - ro);
    vec3 right = normalize(cross(vec3(0,1,0), dir));
    vec3 up = normalize(cross(dir, right));
    return normalize(dir + right*uv.x + up * uv.y);
}
#define pmod(p,x) mod(p,x) - 0.5*x
#define mx (iTime*0. + 20.*iMouse.x/iResolution.x)

#define pi acos(-1.)
#define tau (2.*pi)
#define T (iTime*0.125)
#define rot(x) mat2(cos(x),-sin(x),sin(x),cos(x))
#define pal(a,b,c,d,e) (a + b*cos(tau*(c*d + e)))

vec3 pA = vec3(0);

vec2 map(vec3 p){
	vec2 d = vec2(10e6);
	
    float sc = 2.4;
    float dp = dot(p,p);
    p /= dp;
    p*= sc;
    p=sin(p+vec3(T*tau,1.4 - 1.*T*tau,.1 + sin(iTime*0.5)*0.6));
    pA = p;
    d.x = 0.;
    d.x = max(d.x,-length(p) + 1.4);
	return d*dp/sc;
}

vec3 glow = vec3(0);
vec2 trace(vec3 ro, vec3 rd,inout vec3 p,inout float t, inout bool hit){
	vec2 d = vec2(10e6);
	t = 0.; hit = false; p = ro;
    
    for(int i = 0; i < 100; i++){
    	d = map(p);
        glow += exp(-d.x*90.);
        if(d.x < 0.0001){
        	hit = true;
            break;
        }
        t += d.x;
        p = ro + rd*t;
    }
    
    
    return d;
}

vec3 getNormal(vec3 p){
    vec2 t = vec2(0.001,0);
	return normalize(map(p).x - vec3(
    	map(p - t.xyy).x,
    	map(p - t.yxy).x,
    	map(p - t.yyx).x
    ));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    vec3 col = vec3(0);
    
    uv *= 1. + dot(uv,uv)*1.9;
    vec3 ro = vec3(0.,0.,1.)*0.9;

    ro.x += sin(mx)*0.;
    vec3 lookAt = vec3(0.);
    vec3 rd = getRd(ro, lookAt, uv);
    rd.xy *= rot(sin(iTime*0.5)*0.6);
    rd.xz *= rot(sin(iTime*0.75)*0.2);
    vec3 p; float t; bool hit;
    vec2 d = trace(ro, rd, p, t, hit);
    
    if(hit){
        vec3 pAA = pA;
        float modD = 0.1;
        float id = floor(pA.x/modD);
        pA = pmod(pA, modD);
        col += pal(0.12,vec3(1,0.7 + sin(id + iTime*0.25)*0.24,1.1)*1., vec3(5.,3.75 + cos(iTime + length(p))*0.04,1.1 ), 1.5, id*0.3 + pAA.z*0.5 + pAA.y*0.2 + iTime*0.12);
        col *= 0.26 + step(abs(sin(id*4.))*1., 0.7);
        col -= exp((abs(pA.x) - modD*0.5)*100.);

        col -= exp(-length(p)*20.)*10.;
        //col += smoothstep(0.01,0., length(pA.x) - modD*0.175);
    }
    
    col -= glow*0.016;
    col = clamp(col, 0., 1.);

    col *= 1.;
    //col = pow(col, vec3(0.45));
    col = pow(col, vec3(0.45));
    col *= 1. - 1.*pow(abs(uv.x)*0.55,2.9)*0.5;
    col *= 1. - 1.*pow(abs(uv.y)*1.0,2.9)*0.5;
    
    fragColor = vec4(col,1.0);
}`;

const fragment = `
// thanks to mla and Kali!
// They have super nice examples on inversion

// it's really simple, basically
// p /= dot(p,p);
// p = sin(p);
// SDFs
// return distance*dot(p,p);


// and ofc Inigo quilez for pallete!



void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord/iResolution.xy;
	vec2 uvn = (fragCoord - 0.5*iResolution.xy)/iResolution.xy;
    
    
    //float m = pow(abs(sin(p.z*0.03)),10.);

    // Radial blur
    float steps = 20.;
    float scale = 0.00 + pow(length(uv - 0.5)*1.2,3.)*0.4;
    //float chromAb = smoothstep(0.,1.,pow(length(uv - 0.5), 0.3))*1.1;
    float chromAb = pow(length(uv - 0.5),1.4)*2.1;
    vec2 offs = vec2(0);
    vec4 radial = vec4(0);
    for(float i = 0.; i < steps; i++){
    
        scale *= 0.91;
        vec2 target = uv + offs;
        offs -= normalize(uvn)*scale/steps;
    	radial.r += texture(iChannel0, target + chromAb*1./iResolution.xy).x;
    	radial.g += texture(iChannel0, target).y;
    	radial.b += texture(iChannel0, target - chromAb*1./iResolution.xy).z;
    }
    radial /= steps;
    
    
    fragColor = radial*1.; 
    
    fragColor *= 1.3;
    fragColor = mix(fragColor,smoothstep(0.,1.,fragColor), 0.2);
    
    fragColor = max(fragColor, 0.);
    fragColor.xyz = pow(fragColor.xyz, vec3(2.,1. + sin(iTime)*0.2,1. - sin(iTime)*0.2));

    //fragColor = pow(fragColor, vec4(0.4545 + dot(uvn,uvn)*1.7));
    fragColor *= 1. - dot(uvn,uvn)*1.8;
    fragColor.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'WlKXRR';
  }
  name(): string {
    return 'Day 61';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 198;
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
  channels() {
    return [{ type: 1, fi: 0, f: f }];
  }
}
