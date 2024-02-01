import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Fork of "Day 45 - Isometric" by jeyko. https://shadertoy.com/view/WltXR7
// 2020-02-04 12:31:12

vec3 glow = vec3(0);

#define rot(x) mat2(cos(x),-sin(x),sin(x),cos(x))

#define pmod(p, x) mod(p, x) - x*0.5
#define pi acos(-1.)

#define modDist vec2(1.42,1.)

#define xOffs 0.71
#define yOffs 0.7

#define ZOOM 5.
#define mx (50.*iMouse.x/iResolution.x)
#define my (-iTime + 50.*iMouse.y/iResolution.x)
float sdBox(vec3 p, vec3 r){
	p = abs(p) - r;
	return max(p.x, max(p.y, p.z));
}
float sdBoxIQ( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

float sdOcta(vec3 p, vec3 s, vec2 id){
	p = abs(p) - s;
    float d = max(p.x, max(p.y, p.z));
    
    d =  dot(p.xz + s.zx*0.5, normalize(vec2(1)));
    
    d = max(d, dot(p.xy + s.xy*0.5, normalize(vec2(1))));
    
    d = max(d, dot(p.yz + s.xy*0.5, normalize(vec2(1))));
    
    return d;
}
float sdMain(vec3 p, vec2 idD){
	float d = 10e6;
    vec3 q = p;
    float steps = 5.;
    float m = sin(iTime + idD.x + idD.y*4.);
    for(float i = 0.; i < steps; i++){
    	d = min(d,sdBoxIQ(p, vec3(0.51 - 0.5*i/steps)) - .02);	
        p.y -= 0.25 + m*0.15;
    }
    
    vec3 s = vec3(0.77);
    
    d = max(d, -max(sdOcta(q, s, idD), q.y - 0.5));
	return d;
}


vec2 id;

float sdIso(vec3 p, vec2 id){
	float d = 10e6;
    //p.z -= 0.;
    vec3 q = p;
    
    // ME
    p.x -= id.y*xOffs;
    p.y += id.y*yOffs;
    p.xz = pmod(p.xz, modDist);
    p.xy *= rot(pi*0.25);
    d = min(d, sdMain(p, id));
    
    vec2 idD = id;
    
    // BOTTOM
    p = q;
    idD.y += 1.;
    p.x -= idD.y*xOffs;
    p.y += idD.y*yOffs;
    p.xz = pmod(p.xz + vec2(0,0. - id.y), vec2(modDist.x,modDist.y*3.));
    
    if (p.x > 0.){
        idD.x -= 1.;
    }
    p.xy *= rot(pi*0.25);
    d = min(d, sdMain(p, idD));
    

    // RIGHT
    p = q;
    idD = id;
    idD.x -= 1.;
    p.x -= idD.y*xOffs;
    p.y += idD.y*yOffs;
    p.xz = pmod(p.xz + vec2(modDist.x*1.- idD.x*modDist.x*1.,0), vec2(modDist.x*3.,modDist.y));
    p.xy *= rot(pi*.25);
    d = min(d, sdMain(p, idD));
    
    // LEFT
    p = q;
    idD = id;
    idD.x += 1.;
    p.x -= idD.y*xOffs;
    p.y += idD.y*yOffs;
    p.xz = pmod(p.xz + vec2(modDist.x*1.- idD.x*modDist.x*1.,0), vec2(modDist.x*3.,modDist.y));
    p.xy *= rot(pi*.25);
    d = min(d, sdMain(p, idD));
    
    // TOP
    idD = id;
    idD.y -= 1.;
    p = q;
    p.x -= idD.y*xOffs;
    p.y += idD.y*yOffs;
    p.xz = pmod(p.xz + vec2(0.,-1. - id.y), vec2(modDist.x,modDist.y*3.));
    if (p.x < 0.){
      idD.x += 1.;
    }
    p.xy *= rot(pi*0.25);
    d = min(d, sdMain(p, idD));
    
    
	return d;
}

vec2 map(vec3 p){
	vec2 d = vec2(10e6);
    id = floor(p.xz/modDist);
    id.x = floor((p.x - modDist.x*0.5*id.y)/modDist.x);
    d.x = min(d.x, sdIso(p, id));
    d.x *= 0.7;
    return d;
}

vec2 march(vec3 ro, vec3 rd, inout vec3 p, inout float t, inout bool hit){
	p = ro;
    vec2 d;
    hit = false;
    for(int i = 0; i < 100 ;i++){
    	d = map(p);
        //glow += exp(-d.x*60.);
        if(d.x < 0.001){
        	hit = true;
            break;
        }
        if(t > 10.){
        	//hit = true;
            break;
        }
    	t += d.x;
        p = ro + rd*t;
    }

	return d;
}

vec3 getNormal(vec3 p){
	vec2 t = vec2(0.0001,0);
	return normalize(map(p).x - vec3(
    	map(p - t.xyy).x,
    	map(p - t.yxy).x,
    	map(p - t.yyx).x
    ));
}

vec3 getRd(inout vec3 ro, vec3 lookAt, vec2 uv){
    vec3 dir = normalize(lookAt - ro );
    vec3 right = normalize(cross(vec3(0,1,0), dir));
    vec3 up = normalize(cross(dir, right));
    ro -= ZOOM*dir;
	return dir + right*uv.x + up*uv.y;
}
vec3 getRdIsometric(inout vec3 ro, vec3 lookAt, vec2 uv){
    vec3 rd = normalize(
        lookAt -
        ro
    );
    
    vec3 right = normalize(cross(vec3(0,1,0), rd));
    vec3 up = normalize(cross(rd, right));
    
    
    ro += right*uv.x*ZOOM;
    ro += up*uv.y*ZOOM;
 	return rd;

}
float calcSoftshadow( in vec3 ro, in vec3 rd, in float mint, in float tmax, int technique )
{
	float res = 1.0;
    float t = mint;
    float ph = 1e10; // big, such that y = 0 on the first iteration
    for( int i=0; i<32; i++ )
    {
		float h = map( ro + rd*t ).x;

        // traditional technique
        if( technique==0 )
        {
        	res = min( res, 10.0*h/t );
        }
        // improved technique
        else
        {
            // use this if you are getting artifact on the first iteration, or unroll the
            // first iteration out of the loop
            //float y = (i==0) ? 0.0 : h*h/(2.0*ph); 

            float y = h*h/(2.0*ph);
            float d = sqrt(h*h-y*y);
            res = min( res, 10.0*d/max(0.0,t-y) );
            ph = h;
        }
        
        t += h;
        
        if( res<0.001 || t>tmax ) break;
        
    }
    return clamp( res, 0.4, 1.0 );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
	vec2 quv = uv;
    uv.xy *= rot(0.7);
    vec3 col = vec3(0.0);
    vec3 lookAt = vec3(0,-1,-2);
    
    
    vec3 ro = vec3(0,8,0);
   
    vec3 rd = getRdIsometric(ro, lookAt, uv); 
    //vec3 rd = getRd(ro, lookAt, uv); 
        
    vec3 p;
    
    //ro.x += mx;
    ro.z += my;
    ro.y -= my*0.65;
    //ro += rd*5.4;
    
    float t = 0.; bool hit;
    
    vec2 d = march(ro, rd, p, t, hit);
    
    vec3 l = normalize(vec3(1.9,1.,.7));
    
    if (hit){
        vec3 n = getNormal(p);
        n.y *= -1.;
        n.g*=0.4;
        n.xy *= rot(0.2 + sin(iTime)*0.2 + uv.x*0.6);
        float s = calcSoftshadow(p,l,0.01,2.4, 0);
    	col += 0.5 + n*0.6;
        
        col = clamp(col, 0., 1.);

        
        col *= s;
    	
    } else {
    	col = mix(
            vec3(0.8,0.1,0.1)*1.9,
            vec3(0.4,0.6,0.5)*1.7,    
			abs(sin(iTime*0.5))
                 );
        ;
        col.xy *= rot(0.1 - uv.x*0.3);
    }
    
    
    //col -= glow*0.01;
    
    col = max(col, 0.);
    
    col = clamp(col, 0., 1.);
    //col = pow(col, vec3(0.45));
    col = pow(col, vec3(0.7));
    
    
    //col = pow(col, vec3(1.7));
    
    
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return 'WtcXD8';
    }
    name(): string {
        return 'Day 47 - Isometric 2';
    }
    webgl() {
        return WEBGL_2;
    }
    sort() {
        return 751;
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
