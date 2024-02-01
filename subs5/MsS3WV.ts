import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define OBJ_ORIGINAL
//#define BG_ORIGINAL

//#define LOW_Q

#ifdef LOW_Q
    #define MARCHSTEPS 60
#else
    #define MARCHSTEPS 30
    #define AMBIENT_OCCLUSION
    #define DOUBLE_SIDED_TRANSPARENCY
#endif

#define maxDist 10.0

#define SPECULAR
#define REFLECTIONS
#define TRANSPARENCY
#define SHADOWS
#define FOG

#define DIRECTIONAL_LIGHT
#define DIRECTIONAL_LIGHT_FLARE

#define PI 3.141592654

#define kNt  -1.0		//no trans
#define kTt  1.0		//yes trans
#define kIt  0.0		//inverse trans

const float mate1 = 1.0;

struct sRay { vec3 ro; vec3 rd; float sd; float rl; };
struct sHit { vec3 hp; float hd; vec3 oid; };
struct sSurf { vec3 nor; vec3 ref; vec3 tra; };
struct sMat { vec3 ctc; float frs; float smt; vec2 par; float trs; float fri; };
struct sShade { vec3 dfs; vec3 spc; };
struct sLight { vec3 rd; vec3 col; };


/***********************************************/
float sdTorus(vec3 p, vec2 t) {
    vec2 q = vec2(length(p.xy)-t.x,p.z);
    return length(q)-t.y;
}
/***********************************************/
float sdBox(vec3 p, vec3 b, float r) {
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.0)-r + length(max(d,0.0)) ;
}
/***********************************************/
float sminp(float a, float b, float k) {
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}
/***********************************************/
float smine(float a, float b, float k) {
    float res = exp( -k*a ) + exp( -k*b );
    return -log( res )/k;
}
/***********************************************/
#ifdef OBJ_ORIGINAL
float skull(vec3 p) {
    vec3 q=p;
    p.y+=sin(p.y*1.6)*0.2;
    p.z-=p.x*0.05;
    float e=sdTorus(p+vec3(-0.4,0.0,0.0),vec2(0.3,0.1));   //eye
    p.z=q.z;
    p.z+=p.x*0.05;
    float f=sdTorus(p+vec3( 0.4,0.0,0.0),vec2(0.3,0.1));   //eye
    p.x+=sin(p.x);
    float n=sdTorus(p+vec3( 0.0,0.45,0.19),vec2(0.2,0.05));  //nose
    p=q;
    p.x+=sin(p.x*0.07);
    p.x*= cos(p.y*0.6+abs(cos(3.7+p.y)*0.2)*1.1) ;
    float s=length(p+vec3( 0.0,-0.14,-0.79))-0.98; //back
    p=q;
    p.y+=sin(p.y*1.7)*0.3;
    float d=length(p+vec3(-0.4,0.0,0.1))-0.25; //eyehole
        s=max(s,-d);
          d=length(p+vec3( 0.4,0.0,0.1))-0.25;  //eyehole  
        s=max(s,-d);
    p=q;
    p.z+=p.z-p.y*0.4;
    float v=sdBox(p+vec3(0.0,0.68,-0.7),vec3(0.02,0.07,0.8), 0.27);   //chin
    float o=sminp(e,f,0.5);
    o=smine(o,n,14.0);
    o=sminp(o,s,0.09);
    return smine(o,v,12.0);
}
#else
float skull(vec3 p) {
	p.x = -abs(p.x);
    vec3 q=p;
    p.y+=sin(p.y*1.6)*0.2;
    p.z=q.z;
    p.z+=p.x*0.05;
    float f=sdTorus(p+vec3( 0.4,0.0,0.0),vec2(0.3,0.1));   //eye
    p.x+=sin(p.x);
    float n=sdTorus(p+vec3( .03,0.45,0.19),vec2(0.2,0.05));  //nose
    p=q;
    p.x+=sin(p.x*0.07);
    p.x*= cos(p.y*0.6+abs(cos(3.7+p.y)*0.2)*1.1) ;
    float s=length(p+vec3( 0.0,-0.14,-0.79))-0.98; //back
    p=q;
    p.y+=sin(p.y*1.7)*0.3;
    float d=length(p+vec3( 0.4,0.0,0.1))-0.25;  
    s=max(s,-d);
    p=q;
    float o = sminp(length(p+vec3(.42,.35,-.05))-.15,f,0.08);
    p.z+=p.z-p.y*0.4;
    float v=sdBox(p+vec3(0.0,0.68,-0.7),vec3(0.02,0.07,0.8), 0.27);   //chin
    o=smine(o,n,14.0);
    o=sminp(o,s,0.09);
    return smine(o,v,12.0);
}
#endif
/***********************************************/
vec4 opU( vec4 a, vec4 b ) {
    return mix(a, b, step(b.x, a.x));
}
/***********************************************/
vec4 opUt( vec4 a, vec4 b, float fts ){    
    vec4 vScaled = vec4(b.x * (fts * 2.0 - 1.0), b.yzw);
    return mix(a, vScaled, step(vScaled.x, a.x) * step(0.0, fts));
}
/***********************************************/
vec4 DE( vec3 hp, float fts ) {          
    vec4 vResult = vec4(maxDist, -1.0, 0.0, 0.0);
    vec4 vDistSkull = vec4(skull(hp), mate1, hp.xz);  
    return opUt(vResult, vDistSkull, fts);
}
/***********************************************/
sMat getMat( sHit hitInfo ) {
    sMat mat;
 //   if(hitInfo.oid.x == mate1) {
        mat.frs = 0.31;
        mat.smt = 1.0;
        mat.trs = 1.0;
        mat.fri = 0.75;
        const float fExtinctionScale = 2.0;
            vec3 tc = vec3(0.93,0.96,1.0);        //tex/col
        mat.ctc = (vec3(1.0) - tc) * fExtinctionScale; 
//    }
    return mat;
}
/***********************************************/
vec3 getbg( vec3 rd ) {
#ifdef BG_ORIGINAL
    const vec3 tc = vec3(0.65, 0.78, 1.0);
    const vec3 cc = tc * 0.5;
    float f = clamp(rd.y, 0.0, 1.0);
    return mix(cc, tc, f);
#else
	// return texture(iChannel0, rd).xyz;
  return texture(iChannel0, rd.xy).xyz;
#endif	
}
/***********************************************/
sLight GetDLight() {
    sLight result;
    result.rd = normalize(vec3(-0.2, -0.3, 0.5));
    result.col = vec3(8.0, 7.5, 7.0);
    return result;
}
/***********************************************/
vec3 GetAmb(vec3 nor) {
    return getbg(nor);
}
/***********************************************/
vec3 normal(vec3 p, float fts) {
	vec3 e=vec3(0.01,-0.01,0.0);
	return normalize( vec3(	e.xyy*DE(p+e.xyy,fts).x +	e.yyx*DE(p+e.yyx,fts).x +	e.yxy*DE(p+e.yxy,fts).x +	e.xxx*DE(p+e.xxx,fts).x));
}
/***********************************************/
void march( sRay ray, out sHit res, int maxIter, float fts ) {        
    res.hd = ray.sd;
    res.oid.x = 0.0;
        
    for(int i=0;i<=MARCHSTEPS;i++) {
        res.hp = ray.ro + ray.rd * res.hd;
        vec4 r = DE( res.hp, fts );
        res.oid = r.yzw;
        if((abs(r.x) <= 0.01) || (res.hd >= ray.rl) || (i > maxIter)) break;
        res.hd = res.hd + r.x; 
    }
    if(res.hd >= ray.rl) {
        res.hd = maxDist;
        res.hp = ray.ro + ray.rd * res.hd;
        res.oid.x = 0.0;
    }
}
/***********************************************/
float csh( vec3 hp, vec3 nor, vec3 lrd, float d ) {
    #ifdef SHADOWS
        sRay ray;
        ray.rd = lrd;
        ray.ro = hp;
        ray.sd = 0.05 / abs(dot(lrd, nor));
        ray.rl = d - ray.sd;
        sHit si;
        march(ray, si, 32, kNt);
        float s = step(0.0, si.hd) * step(d, si.hd );
        return s;          
    #else
            return 1.0;
    #endif
}

/***********************************************/
float cao( sHit hi, sSurf s) {
    #ifdef AMBIENT_OCCLUSION    
        vec3 hp = hi.hp;
        vec3 nor = s.nor;
        float ao = 1.0;
        
        float d = 0.0;
        for(int i=0; i<=5; i++) {
            d += 0.1;
            vec4 r = DE(hp + nor * d, kNt);
            ao *= 1.0 - max(0.0, (d - r.x) * 0.2 / d );                                  
        }
        return ao;
    #else
            return 1.0;
    #endif    
}
/***********************************************/

vec3 getfog( vec3 col,  sRay ray, sHit hi) {
    #ifdef FOG
        float a = exp(hi.hd * - 0.05);
        vec3 fog = getbg(ray.rd);

        #ifdef DIRECTIONAL_LIGHT_FLARE
            sLight lig = GetDLight();
            float f = clamp(dot(-lig.rd, ray.rd), 0.0, 1.0);
            fog += lig.col * pow(f, 10.0);
        #endif 

        col = mix(fog, col, a);
    #endif

    return col;    
}
/***********************************************/
float Schlick(vec3 nor, vec3 v, float frs, float sf) {
    float f = dot(nor, -v);
    f = clamp((1.0 - f), 0.0, 1.0);
    float fDotPow = pow(f, 5.0);
    return frs + (1.0 - frs) * fDotPow * sf;
}
/***********************************************/
vec3 Fresnel( vec3 dif, vec3 spe, vec3 nor, vec3 v, sMat m) {
    float f = Schlick(nor, v, m.frs, m.smt * 0.9 + 0.1);
    return mix(dif, spe, f);    
}
/***********************************************/
float Phong( vec3 ird, vec3 lrd, vec3 nor, float smt) {          
    vec3 v = normalize(lrd - ird);
    float f = max(0.0, dot(v, nor));
    float sp = exp2(4.0 + 6.0 * smt);
    float si = (sp + 2.0) * 0.125;
    return pow(f, sp) * si;
}

/***********************************************/
sShade setDLight(sLight l, vec3 p, vec3 d, vec3 nor, sMat m ) {
    sShade s;
    vec3 lrd = -l.rd;
    float sf = csh( p, nor, lrd, 8.0 );
    vec3 il = l.col * sf * max(0.0, dot(lrd, nor));
    s.dfs = il;                                  
    s.spc = Phong( d, lrd, nor, m.smt ) * il;
    return s;
}  
/***********************************************/
vec3 setcol( sRay ray, sHit hi, sSurf sc, sMat m) {
    vec3 col;
    sShade s;
    s.dfs = vec3(0.0);
    s.spc = vec3(0.0);
    float ao = cao(hi, sc);
    vec3 al = GetAmb(sc.nor) * ao;
    s.dfs += al;
    s.spc += sc.ref;

    #ifdef DIRECTIONAL_LIGHT
    sLight dl = GetDLight();
    sShade sh = setDLight(dl, hi.hp, ray.rd, sc.nor, m);
    s.dfs += sh.dfs;
    s.spc += sh.spc;
    #endif

    vec3 dr = s.dfs * m.ctc;              

    dr = mix(dr, sc.tra, m.trs);    

    #ifdef SPECULAR
        col = Fresnel(dr , s.spc, sc.nor, ray.rd, m);
    #else
        col = dr;
    #endif
    
    return col;
}
/***********************************************/
vec3 getcol2(sRay ray ) {
    sHit hi;
    march(ray, hi, 32, kNt);
    vec3 col;

    if(hi.oid.x < 0.5) {
        col = getbg(ray.rd);
    } else {
        sSurf s;        
        s.nor = normal(hi.hp, kNt);
        sMat m = getMat(hi);
        s.ref = getbg(reflect(ray.rd, s.nor));
        m.trs = 0.0;
        col = setcol(ray, hi, s, m);
    }
    col=getfog(col, ray, hi);
    return col;
}
/***********************************************/
vec3 getref( sRay ray, sHit hitInfo, sSurf s ) {
    #ifdef REFLECTIONS    
        sRay rRay;
        rRay.rd = reflect(ray.rd, s.nor);
        rRay.ro = hitInfo.hp;
        rRay.rl = 16.0;
        rRay.sd = 0.1 / abs(dot(rRay.rd, s.nor));
        return getcol2(rRay);      
    #else
        return getbg(reflect(ray.rd, s.nor));                              
    #endif
}
/***********************************************/
vec3 gettrans( sRay ray, sHit hit, sSurf s, sMat m ) {
    #ifdef TRANSPARENCY  
        sRay rRay;
        rRay.rd = refract(ray.rd, s.nor, m.fri);
        rRay.ro = hit.hp;
        rRay.rl = 16.0;
        rRay.sd = 0.05 / abs(dot(rRay.rd, s.nor));
        #ifdef DOUBLE_SIDED_TRANSPARENCY
            sHit hit2;
            march(rRay, hit2, 32, kIt);
            vec3 nor = normal(hit2.hp, kIt);
                sRay rRay2;
                rRay2.rd = refract(rRay.rd, nor, 1.0 / m.fri);
                rRay2.ro = hit2.hp;
                rRay2.rl = 16.0;
                rRay2.sd = 0.0;
            float ed = hit2.hd;
            vec3 col = getcol2(rRay2);
        #else
            vec3 col = getcol2(rRay);                                                                        
            float ed = 0.5;
                
        #endif

        return col * clamp(exp(-(m.ctc * ed)),0.0,1.0);
    #else
        return getbg(reflect(ray.rd, s.nor));                              
    #endif
}
/***********************************************/
vec3 getcol( sRay ray ) {                                                          
    sHit i;
    march(ray, i, MARCHSTEPS, kTt);   //256
    vec3 col;

    if(i.oid.x < 0.5) {
        col = getbg(ray.rd);
    } else  {
        sSurf s;
        s.nor = normal(i.hp, kTt);
        sMat m = getMat(i);
        s.ref = getref(ray, i, s);
        if(m.trs > 0.0) s.tra = gettrans(ray, i, s, m);
        col = setcol(ray, i, s, m);
    }
    getfog(col, ray, i);

    return col;
}
/***********************************************/
sRay setcray( vec3 hp, vec3 i, vec2 fragCoord) {
    sRay ray;
    vec3 f = normalize(i - hp);
    vec3 vUp = vec3(0.0, 1.0, 0.0);

    vec2 vUV = ( fragCoord.xy / iResolution.xy );
    vec2 vvc = vUV * 2.0 - 1.0;
    float fRatio = iResolution.x / iResolution.y;
    vvc.y /= fRatio;                          
    ray.ro = hp;
    vec3 r = normalize(cross(f, vUp));
    vUp = cross(r, f);
    ray.rd = normalize( r * vvc.x + vUp * vvc.y + f); 
    ray.sd = 0.0;
    ray.rl = maxDist;     
    return ray;
}

/***********************************************/
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 m = iMouse.xy / iResolution.xy;    
    
    /* animate */
    float rot=iTime*0.234;
    /* animate */
    
    float h = mix(0.0, PI, m.x+1.0-rot);
    float e = mix(0.0, 2.5, m.y);
    float d = mix(2.5, 2.5, m.y);
    
    vec3 ro = vec3(sin(h) * cos(e), sin(e), cos(h) * cos(e)) * d;
    vec3 ta = vec3(0.0, 0.0, 0.0);

    sRay ray=setcray( ta + ro, ta, fragCoord);

    vec3 col = getcol( ray );  

    vec3 tcol=col*2.0;
    col=tcol/(1.0+tcol);
  
    fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'MsS3WV';
  }
  name(): string {
    return '需要天空盒Crystal Skull';
  }
  sort() {
    return 501;
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
  channels() {
    return [webglUtils.WOOD_TEXTURE];
  }
}
