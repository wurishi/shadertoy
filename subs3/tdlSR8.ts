import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
vec2 hash2(uint x)
{
    uvec2 p = x * uvec2(3266489917U, 668265263U);
    p = (p.x ^ p.y) *  uvec2(2654435761U, 2246822519U);
    return vec2(p)*2.3283064365386962890625e-10;
}

float hash12(vec2 p)
{
    p  = 50.*fract( p*0.3183099 + vec2(0.71,0.113));
    return fract( p.x*p.y*(p.x+p.y) )*1.8-0.6;
}

vec3 hash33(vec3 p)
{
    p = fract(p * vec3(443.8975,397.2973, 491.1871));
    p += dot(p.zxy, p.yxz+19.27);
    return fract(vec3(p.x * p.y, p.z*p.x, p.y*p.z));
}

float valueNoise(vec2 p)
{
    vec2 ip = floor(p);
    vec2 fp = fract(p);
	vec2 ramp = fp*fp*(3.0-2.0*fp);

    float rz= mix( mix( hash12(ip + vec2(0.0,0.0)), hash12(ip + vec2(1.0,0.0)), ramp.x),
                   mix( hash12(ip + vec2(0.0,1.0)), hash12(ip + vec2(1.0,1.0)), ramp.x), ramp.y);
    
    return rz;
}

`;

let fragment = `
#define ITR 60
#define FAR 10.
//#define BOUNDED
#define ORTHOGRAPHIC

//Voxel size
const float scl = 0.014;
const float hscl = scl*0.5;

float sdBox( vec3 p, vec3 b )
{
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

float sdRoundCone( in vec3 p, in float r1, float r2, float h )
{
    vec2 q = vec2( length(p.xz), p.y );
    float b = (r1-r2)/h;
    float a = sqrt(1.0-b*b);
    float k = dot(q,vec2(-b,a));
    if( k < 0.0 ) return length(q) - r1;
    if( k > a*h ) return length(q-vec2(0.0,h)) - r2;
    return dot(q, vec2(a,b) ) - r1;
}

float sdCyl( vec3 p, vec2 h )
{
  vec2 d = abs(vec2(length(p.xz),p.y)) - h;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

//------------------------------------------------------------
//------------------------------------------------------------
//------------------------------------------------------------

mat2 rot(in float a){float c = cos(a), s = sin(a);return mat2(c,s,-s,c);}
float slength(in vec3 p){ return max(abs(p.x), max(abs(p.y), abs(p.z))); }

//2d triangle domain folding
vec2 foldTri(in vec2 p)
{
    p.x = abs(p.x);
    vec2 v = vec2(-0.5, -0.8660254);
  	p -= 2.0*min(0.0, dot(p, v))*v;
 	return p;    
}

vec2 dUnion(vec2 a, vec2 b)
{
	return (a.x < b.x)?a:b;
}

float rocket(in vec3 p)
{
    p.y -= 0.37;
    float core = sdCyl(p + vec3(0,-0.3,0), vec2(0.09,1.2));
    core += mix(sin(p.y*1.1 - .0)*0.3, sin(p.y*4.8 + 6.3)*0.019, step(p.y, 0.));
    p.xz *= mat2(0.70711, -0.70711, 0.70711, 0.70711);
    p.xz = foldTri(p.xz);
    float fins = sdRoundCone(p + vec3(0.,1.1,0.27), 0.05,0.03,0.25) - sin(p.y*20. + 3.)*0.01;
    p.y += (p.z+0.05)*p.z*4.2;
    fins = min(fins, sdBox(p + vec3(0.,.72,0.17), vec3(0.003,0.1 - (p.z+0.15)*0.25,0.1))-0.008);
    return min(core, fins);    
}

vec2 tank(in vec3 p)
{
    p +=  vec3(0.5, -0.22 , .85);
    p.xz *= mat2(0.940, 0.342, -0.342, 0.940);
    float front = smoothstep(0.01,0.0, abs(p.x-0.2)-0.04)*sin(p.y*100. + 0.5)*0.03;
    float core  = sdBox(p + vec3(-0.2,.93,-2.3), vec3(0.08,0.04,0.115 + (p.y+1.)*0.5 + front));
    core = min(core, sdBox(p + vec3(-0.2,.91,-2.28), vec3(0.06 - (p.y+.9)*0.2, 0.04, 0.1 - (p.y+.9)*0.4)));
    core = min(core, sdBox(p + vec3(-0.2,.87,-2.28), vec3(0.05 - (p.y+.9)*0.3, 0.02, 0.09 - (p.y+.9)*0.5)));
    float ports = length(p + vec3(-.205,0.875,-2.3))-0.035;
    p.x = abs(p.x-0.2)+0.16;
    ports = min(ports, length(p + vec3(-.19,0.92,-2.4))-0.035);
    return dUnion(vec2(core, 3.), vec2(ports, 4.));
}

float linstep(in float mn, in float mx, in float x)
{
	return clamp((x - mn)/(mx - mn), 0., 1.);
}

vec3 tri(vec3 p) { return abs(fract(p)-0.5)-0.222; }

const mat3 m3 = mat3(0.75425, 0.41613, -0.50788, -0.61539, 0.71772, -0.32585, 0.22892, 0.55832, 0.79742);

float terrain(vec3 p)
{
    vec3 bp = p;
    float d = 0.;
    float frq = 0.245;
    float z = 4.86;
    for(int i = 0; i < 7; i++)
    {
        p += vec3(.2, 1.43,0.45);
        d += dot(tri(p*frq), tri(p.yzx*frq + 0.43))*z;     
        frq *= 1.89;
        z *= 0.46;
        p *= m3;
    }
    
    d += 0.05;
    d *= clamp(dot(bp.xz,bp.xz)*0.65,0.25,1.); //flat near rocket
    return linstep(.8, 0.15,d)*1.1 + linstep(0.15,-.15, d)*0.09 + linstep(-0.17,-3., d);
}


vec2 map(vec3 p)
{   
    float d = terrain(p) + p.y - 0.4;
    
    //bounding box
    #ifdef BOUNDED
    d = max(d, sdBox(p + vec3(0,-1.25,0), vec3(2.4,2.3,2.4)));
    #endif

    vec2 rez = dUnion(vec2(d, 1.), vec2(rocket(p),2.));
    rez = dUnion(rez, tank(p));
    
    //crates
    p.xz = foldTri(p.xz+vec2(0.4,0.45))+0.27;
    float crates = sdBox(p + vec3(0.,.71,.0), vec3(0.042, 0.04, 0.037));
    
    rez = dUnion(rez, vec2(crates, 5.));
    
    return rez;
}

vec3 normal(const in vec3 p)
{  
    vec2 e = vec2(-1., 1.)*0.005;   
	return normalize(e.yxx*map(p + e.yxx).x + e.xxy*map(p + e.xxy).x + 
					 e.xyx*map(p + e.xyx).x + e.yyy*map(p + e.yyy).x );   
}

float dBox(vec3 ro, vec3 invRd, float size) 
{
    vec3 t = -ro*invRd + abs(invRd)*size;
	return min(min(t.x, t.y), t.z);
}

//Sphere-tracing (raymarching) / box-tracing hybrid
//allows to march thousands of voxels deep
vec2 marchVxl(in vec3 ro, in vec3 rd, float near, float far, out vec3 alig, out vec3 vPos)
{
    float lastD = 0.0001;
    float travel = near;
    
    float gridStride = 0.;
    vec3 ip = vec3(0);
    vec3 invRd = 1./rd;
    vec2 bxNfo = vec2(0.);
    
    for( int i=0; i<ITR; i++ )
    {
        travel += lastD*.8 + gridStride;
        if(travel > far) break;
        vec3 pos = ro + rd*travel;
        float mapD = map(pos).x;
        
        if (mapD < (scl*1.2))
        {
            travel -= lastD*0.6;
            pos = ro + rd*travel;
            ip = (floor(pos/scl) + 0.5)*scl;
        	bxNfo = map(ip);
            if (bxNfo.x < 0.0) break;
            vec3 q  = fract(pos/scl)*scl - hscl;
            gridStride = dBox(q, invRd, hscl + 1e-6);
            mapD = 0.;
        }
        else gridStride= 0.;
        lastD = mapD;
    }
    
    vec3 intc = -(fract((ro + rd*travel)/scl)*scl - hscl)*invRd - abs(invRd)*hscl;
    alig = step(intc.yzx, intc.xyz)*step(intc.zxy, intc.xyz);
    vPos = ip;
    
	return vec2(travel, bxNfo.y);
}

float vxlAO(vec3 vp, vec3 sp, vec3 nor, vec3 alig) 
{
    sp = fract(sp/scl);
    vec2 uv = sp.yz*alig.x + sp.zx*alig.y + sp.xy*alig.z;
    vec3 p = vp + nor*scl;
    alig *= scl;
    vec4 side = step(vec4(map(p + alig.zxy).x, map(p + alig.yzx).x, map(p - alig.zxy).x, map(p - alig.yzx).x), vec4(0));
    vec4 cornr = vec4(map(p + alig.zxy + alig.yzx).x, map(p - alig.zxy + alig.yzx).x,
                      map(p - alig.zxy - alig.yzx).x, map(p + alig.zxy - alig.yzx).x);
    vec4 faceOcc = 1.0 - (side + side.yzwx + max(step(cornr, vec4(0)), side*side.yzwx))/3.;
    return mix(mix(faceOcc.z, faceOcc.w, uv.x), mix(faceOcc.y, faceOcc.x, uv.x), uv.y);
}

vec3 lgt = normalize( vec3(-.5, 0.19, -0.2) );
vec3 lcol = vec3(1.,0.86,0.77)*1.3;

float curv(in vec3 p, in float w)
{
    vec2 e = vec2(-1., 1.)*w;
    float t1 = map(p + e.yxx).x, t2 = map(p + e.xxy).x;
    float t3 = map(p + e.xyx).x, t4 = map(p + e.yyy).x; 
    return .125/(e.x*e.x) *(t1 + t2 + t3 + t4 - 4.*map(p).x);
}

vec3 shade(in vec3 pos, vec3 nor, in vec3 rd, float ao, float matID)
{
    //mtl m;
    
    vec3 ip = (floor(pos/scl) + 0.5)*scl;
    
    float rn = clamp(valueNoise(ip.xz*4.)-0.5,0.,1.);
    //vec3 alb = sin(vec3(.2,.25,.4) + pos.y*pos.y*5. + rn*3.)*0.12+0.2;
    vec3 alb = sin(vec3(.25,.35,.4) + pos.y*pos.y*5. + rn*3.)*0.13+0.2;
    
    //landing dust
    vec2 pl = vec2(atan(pos.z, pos.x), length(pos.xz));
    float nzpl = valueNoise(pl*vec2(8.5,5));
    alb *= mix(1.,nzpl*1.2+.1, smoothstep(1.9,-.5,pl.y)*smoothstep(-0.05,.23,pl.y));
    
    //overly complex tank tracks
    vec2 trCoords = pos.xz;
    trCoords.y += 0.15;
    trCoords *= rot(-trCoords.y*0.2 + .925);
    trCoords.x = abs(trCoords.x) -0.05;
    alb *= (smoothstep(0.0,1.,sin(mix(trCoords.y,pos.z,0.0 - pos.x*0.25)*130.))-.5)*smoothstep(0.05,0.00, abs(trCoords.x))*
        smoothstep(.8,0.6, abs(trCoords.y-1.2)) + 1.;    
    
    alb += (hash33(ip).x*2.0-1.0)*0.06 + 0.04;
    
    ip.y -= 0.21;
    //shade rocket
    if (matID == 2.)
    {
        //polar
        vec2 ppol = vec2(atan(ip.z,ip.x)*0.95, ip.y*8.3);
        float f = mod(floor(ppol.x - 0.1) + floor(ppol.y + .8), 2.);
        f *= step(abs(ip.y+0.16)-.3, 0.);
        alb = mix(vec3(.6,0.03,0.03), vec3(0.75,0.75,0.7), f);
    }
    else if (matID == 3.)
    {
        alb = mix(vec3(0.04,0.17,.5)*1.1, vec3(0.07), step(ip.y,-.915));
    }
    else if (matID == 5.)
    {
        alb = vec3(0.55,0.32,0.1);
        alb *= smoothstep(-1.5,-0.5,sin(ip.y*400. + 0.5));
    }
    
    alb *= curv(pos, 0.05)*0.07+.7;
    if (matID == 1.) alb *= smoothstep(-1.,-.1,pos.y) + 1.;
    
    const float numcol = 18.;
    alb = floor(alb*numcol)/numcol;
    
    
	float nl = clamp(dot(nor,lgt), 0., 1.);
	vec3 col = vec3(0.);
    
    if (nl > 0.)
    {
        float shd2 = 0.;
        vec3 tm1, tm2;
        if(nl>0.01)
        {
            shd2 = marchVxl(pos + nor*0.0001, lgt, 0., 3., tm1, tm2).x;
            shd2 = step(3., shd2);
        }
        nl *= shd2*0.75+0.25;
        float fre = pow( clamp(1.0+dot(nor,rd),0.0,1.0), 2.0 );
        col = lcol*nl*alb + fre*nl*0.05;
    }
    col += 0.01*alb;
    col *= ao;
    return col;
}

vec3 bg(in vec3 p, in vec3 ro)
{
    vec3 c = vec3(0.);
    float res = iResolution.y*2.1;
    
	for (float i=0.;i<3.;i++)
    {
        vec3 q = fract(p*(.15*res))-0.5;
        vec3 id = floor(p*(.15*res));
        vec2 rn = hash33(id).xy;
        float c2 = 1.-smoothstep(0.,.6,length(q));
        c2 *= step(rn.x,.001+i*i*0.0017);
        c += c2*(mix(vec3(1.0,0.49,0.1),vec3(0.75,0.9,1.),rn.y)*0.25+0.75);
        p *= 1.26;
    }
    return c*c;
}

mat3 rot_x(float a){float sa = sin(a); float ca = cos(a); return mat3(1.,.0,.0,    .0,ca,sa,   .0,-sa,ca);}
mat3 rot_y(float a){float sa = sin(a); float ca = cos(a); return mat3(ca,.0,sa,    .0,1.,.0,   -sa,.0,ca);}
mat3 rot_z(float a){float sa = sin(a); float ca = cos(a); return mat3(ca,sa,.0,    -sa,ca,.0,  .0,.0,1.);}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    vec2 ofst = hash2(uint(iFrame)) - 0.5;
    ofst*= .25;
    vec2 r = fragCoord.xy / iResolution.xy;
	vec2 q = (fragCoord.xy+ofst) / iResolution.xy;
    vec2 p = q - 0.5;
	p.x*=iResolution.x/iResolution.y;
	vec2 mo = iMouse.xy / iResolution.xy-.5;
    mo = (mo==vec2(-.5))?mo=vec2(0.3,-0.1):mo;
	mo.x *= iResolution.x/iResolution.y;
	mo.y = clamp(mo.y*0.8-.45,-.8 ,-0.25 );
	
    //orthographic camera
    #ifdef ORTHOGRAPHIC
    vec3 ro = vec3(p*(3.3+sin(iTime*0.1)*0.2) + vec2(0,-.5), 5.);
    vec3 rd = vec3(p*1e-20,-1.0);
    #else
    vec3 ro = vec3(0.,-0.8,5.2);
    vec3 rd = normalize(vec3(p,-1.6));
    #endif
    vec3 rd2 = normalize(vec3(p, -1.));
    
    mat3 cam = rot_x(-mo.y)*rot_y(-mo.x + sin(iTime*0.05)*0.4 - 0.5);
   	ro *= cam;
	rd *= cam;
    rd2 *= cam;
    
    vec3 invRd = 1./rd;
    vec3 t = -ro*invRd - abs(invRd)*2.41;
    #ifdef BOUNDED
	float near =  max(max(t.x, t.y), t.z);
    #else
    float near = 0.;
    #endif
    vec3 vPos, alig;
    vec2 rz = marchVxl(ro, rd, near, FAR, alig, vPos);
    vec3 nor = -sign(rd)*alig;
    vec3 col = bg(rd2, ro);
    
    if ( rz.x < FAR )
    {
        vec3 pos = ro + rd*rz.x;
        vec3 nor2 = normal(pos);
        float ao = vxlAO(vPos, pos, nor, alig);
        nor = mix(nor2, nor, .6);
        col = shade(pos, nor, rd, ao, rz.y);
    }
    
	col = pow(clamp(col,0.,1.), vec3(0.416667))*1.055 - 0.055; //Correct gamma
    
    col = mix(col, textureLod(iChannel0, r, 0.).rgb, 0.65);

    col = 1.12*pow( col, vec3(0.96,0.95,1.0) ) + vec3(-0.04,-0.04, -0.01); //Correction
    
	fragColor = vec4( col, 1.0 );

}

`;

fragment = common + fragment;

export default class implements iSub {
  key(): string {
    return 'tdlSR8';
  }
  name(): string {
    return 'Moon voxels';
  }
  sort() {
    return 344;
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
