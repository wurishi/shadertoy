import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// Created by evilryu
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

	
#define PI 3.1415926535898
float matid = 0.0;
float tdist = 0.0;
vec3 hash(float n)
{ 
    return fract(sin(vec3(n,n+1.0,n+2.0))*vec3(43758.5453123, 22578.1459123, 19642.3490423)); 
} 

float box(vec3 p, vec3 b)
{
  	vec3 d = abs(p) - b;
  	return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

float infi_box(vec3 p, vec2 b)
{
    vec2 d = abs(p.xy) - b;
    return min(max(d.x, d.y), 0.0) + length(max(d,0.0));
}

vec3 path(float p)
{
    return vec3(sin(p*0.05)*cos(p*0.025)*18., 0.,0.);
}

float infi_cylinder(vec3 p, vec2 h)
{
	p.yz=p.zy;
    float d = abs(length(p.xz)-h.x);
    return min(d,0.0)+max(d,0.0);
}

float cylinder(vec3 p, vec2 h)
{
	p.yz=p.zy;
  	vec2 d = abs(vec2(length(p.xz),p.y)) - h;
  	return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

vec3 map(vec3 pos)
{
    vec3 p=pos-path(pos.z);
    float d = 2.0 - length(p.xy);
    float d0 = length(vec3(p.x,-0.5,p.z)-p);
    float d1 = length(vec3(p.x,1.2,p.z)-p);
    float d2 = cylinder(vec3(abs(p.x)-1.6,p.y-1.15,mod(p.z,2.0)-1.), 
                   vec2(0.06,0.2));
    float d3 = infi_box(vec3(abs(p.x)-1.8,p.y+0.5,p.z), 
                   vec2(0.5,0.03));
    float d4 = infi_box(vec3(abs(p.x)-1.3,p.y+0.5,p.z), 
                   vec2(0.015,0.04));
    float d5 = box(vec3(abs(p.x)-1.99,p.y+0.2,mod(p.z,8.0)-4.), 
                   vec3(0.02,0.02,0.02));

    matid=0.0;
    if(d0 < d){d=d0;matid=1.0;}
    if(d1 < d){d=d1;matid=2.0;}
    if(d2 < d){d=d2;matid=3.0;}
    if(d3 < d){d=d3;matid=1.0;}
    if(d4 < d){d=d4;matid=1.0;}
    if(d5 < d){d=d5;matid=4.0;}

	return vec3(d);
}

vec3 get_normal(vec3 p) {
	const vec2 e = vec2(0.002, 0);
	return normalize(vec3(map(p + e.xyy).x-map(p - e.xyy).x, 
                          map(p + e.yxy).x-map(p - e.yxy).x,	
                          map(p + e.yyx).x-map(p - e.yyx).x));
}

float get_ao(vec3 p, vec3 n)
{
    float r = 0.0, w = 1.0, d;
    for(float i=1.0; i<5.0+1.1; i++)
    {
        d = i/5.0;
        r += w*(d - map(p + n*d).x);
        w *= 0.5;
    }
    return 1.0-clamp(r,0.0,1.0);
}

float intersect(vec3 ro, vec3 rd)
{
    vec3 res;
    float t = 0.01;
    for(int i = 0; i < 128; ++i)
    {
        vec3 p = ro + rd * t;
        res = map(p);
        if(res.x < 0.005 * t || res.x > 20.)
            break;
        t += res.x;
        tdist=t;
    }
    
    if(res.x > 20.) t = -1.;
    return t;
}

vec4 texcube( sampler2D sam, in vec3 p, in vec3 n )
{
	vec4 x = texture( sam, p.yz );
	vec4 y = texture( sam, p.zx );
	vec4 z = texture( sam, p.xy );
	return x*abs(n.x) + y*abs(n.y) + z*abs(n.z);
}

vec3 lighting(vec3 rd, vec3 ro, vec3 lp0, vec3 pos, vec3 n)
{
    vec3 p=pos-path(pos.z);

    float r = sqrt(p.x*p.x + p.y*p.y);
    float a = atan(p.y, p.x);
    vec2 uv=vec2(p.z*0.1,a*0.1);

    vec3 mate = vec3(1.0);
    
    if(matid < 0.9)
    	mate=(0.35+3.5*pow(p.y,5.0))*texture(iChannel0, uv).xxx;
    else if(matid < 1.9 || matid < 2.9)
    {
        mate=0.5*texcube(iChannel1, p,n).xxx;
    }
    else if(matid < 3.9)
    	mate=10.0*vec3(0.7,0.8,1.2);
    else if(matid < 4.9)
        mate=10.0*vec3(1.0,1.0,0.1);
 
    if(p.y<0.5)
    {
    	mate+=(1.-smoothstep(0.05,0.06,abs(abs(p.x)-1.1)))*vec3(1);
		mate=mix(mate,vec3(1.),
                 floor(fract(p.z*.5)+.5)*(1.-smoothstep(0.04,0.05,abs(p.x)-0.001)));
    }  

    if(matid > 1.9 && matid < 2.9)
    	mate+=.5*smoothstep(0.8,1.5,abs(p.x));
        
    vec3 ld0 = normalize(lp0 - pos);

    float dif = max(0.0, dot(n, ld0));
    float spe = max(0.0, pow(clamp(dot(ld0, reflect(rd, n)), 0.0, 1.0), 20.0));
    float ao = get_ao(pos, n);
    vec3 lin = 4.0*vec3(0.1, 0.5, 1.0) * dif * ao * ao;
    lin += 2.5 * vec3(1.0)*spe;
   	lin = lin*0.2*mate;

    return lin;
}

vec3 shade(vec3 ro, vec3 rd, vec3 l0_pos)
{
    vec3 col = rd;
    
    float res = intersect(ro, rd);
    
    if(res > -0.5)
    {
        vec3 pos = ro + rd * res;
        vec3 n = get_normal(pos);
        col = lighting(rd,ro, l0_pos, pos, n);
    }
    return col;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = (fragCoord.xy - iResolution.xy * 0.5)/ iResolution.xy;
    uv.x *= iResolution.x / iResolution.y;
    
    float velocity = 8.0;
    
    float fov = PI / 3.;

    vec3 look_at = vec3(0.0, 0.0, iTime * velocity);
	vec3 ro = look_at + vec3(0.0, 0.0, -0.5);
    
    vec3 l0_pos = ro + vec3(0.0, 0.0, 2.0);

	look_at += path(look_at.z);
	ro += path(ro.z);
   	l0_pos += path(l0_pos.z);

    vec3 forward = normalize(look_at - ro);
 	vec3 right = normalize(cross(forward, vec3(0.0, 1.0, 0.0)));   
    vec3 up = cross(right, forward);
    
    vec3 rd = normalize(uv.x * right + uv.y * up + fov * forward);
    
    vec3 col = shade(ro, rd, l0_pos);
   	col=mix(col, 0.15*vec3(0.4,0.75,1.0), 1.0-exp(-0.002*tdist*tdist) );

	fragColor = vec4(col, tdist);
}`;

const fragment = `
//Motion blur from mu6k: https://www.shadertoy.com/view/lsyXRK

vec2 totex(vec2 p)
{
    p.x=p.x*iResolution.y/iResolution.x+0.5;
    p.y+=0.5;
    return p; 
}

vec3 sample_color(vec2 p)
{
    return texture(iChannel2, totex(p)).xyz;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;
	vec2 p = (fragCoord.xy - iResolution.xy*.5) / iResolution.yy;
    
    if (abs(p.y)>.41) {
        fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        return;
    }
    
    vec4 fb = texture(iChannel2, uv);
    
    float amp =1./fb.w*0.1;
    vec4 noise = texture(iChannel3, (fragCoord+floor(iTime*vec2(12.0,56.0)))/64.0);
	
   	vec3 col = vec3(0.0);
    col += sample_color(p*((noise.x+2.0)*amp+1.0));
    col += sample_color(p*((noise.y+1.0)*amp+1.0));
    col +=sample_color(p*((noise.z+0.0)*amp+1.0));
    col += sample_color(p*((noise.w-1.0)*amp+1.0));
    col += sample_color( p*((noise.x-2.0)*amp+1.0));
    col *= 0.2;
    col.y*=1.2;
    col=pow(clamp(col,0.0,1.0),vec3(0.45)); 
    col=mix(col, vec3(dot(col, vec3(0.33))), -0.5);
    
    fragColor = vec4(col, 1.0);
}
`;

export default class implements iSub {
    key(): string {
        return '4lcGWr';
    }
    name(): string {
        return '[SH16B]Escape';
    }
    webgl() {
        return WEBGL_2;
    }
    sort() {
        return 727;
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
        return [
            { ...webglUtils.TEXTURE9, ...webglUtils.TEXTURE_MIPMAPS },
            { ...webglUtils.TEXTURE8, ...webglUtils.TEXTURE_NEAREST }, //
            { type: 1, f: buffA, fi: 2 },
            { ...webglUtils.DEFAULT_NOISE, ...webglUtils.TEXTURE_MIPMAPS },
        ];
    }
}
