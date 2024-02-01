import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define T(a) texture(iChannel1,(a)/iResolution.xy)
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))

#define pmod(p,a) mod(p,a) - 0.5*a
#define xorb(a,b,c) min(max(a + c,-(b)),max(b,-(a)))
#define pi acos(-1.)

mat3 orthogonalBasis(vec3 ro, vec3 lookAt){
    vec3 dir = normalize(lookAt - ro);
    vec3 right = normalize(cross(vec3(0,1,0),dir));
    vec3 up = normalize(cross(dir, right));
    return mat3(right, up, dir);
}
mat3  rotationMatrix3(vec3 v, float angle)
{
	float c = cos(radians(angle));
	float s = sin(radians(angle));

	return mat3(c + (1.0 - c) * v.x * v.x, (1.0 - c) * v.x * v.y - s * v.z, (1.0 - c) * v.x * v.z + s * v.y,
		(1.0 - c) * v.x * v.y + s * v.z, c + (1.0 - c) * v.y * v.y, (1.0 - c) * v.y * v.z - s * v.x,
		(1.0 - c) * v.x * v.z - s * v.y, (1.0 - c) * v.y * v.z + s * v.x, c + (1.0 - c) * v.z * v.z
		);
}

float eass(float p, float g) {
    float s = p*0.45;
    for(float i = 0.; i < g; i++){
    	s = smoothstep(0.,1.,s);
    }
    return s;
}



float sdBox(vec2 p, vec2 s){p = abs(p) -s; return max(p.y,p.x);}

#define xor(a,b) min(max(a,-(b)),max(b,-(a) +0.02))

vec3 pal(float m){
    vec3 c = 0.5+0.5*sin(m + vec3(1.5,0.,-0.5));
    c = pow(c, vec3( .5));
    
    return c;
}



float plaIntersect( in vec3 ro, in vec3 rd, in vec4 p )
{
    return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
}
`;

const buffA = `


mat3 fracRotation1;


float glow = 0.;
float DE(vec3 z)
{
vec3 p = z;
    float m = sin(iTime+sin(iTime)*1.)*0.5 + sin(iTime);
    z.yz*=rot(.5 );
    int Iterations = 5;
    vec3 Offset = vec3(1.376,1.1,1.);
    vec3 Offset2 = vec3(1.4+(m)*.4,.58,-0.4); 
    float Angle1 = -33.513514 + 5.*sin(m+iTime);
    vec3 Rot1 = vec3(.96, -2.38 + (m), .19);
    float Scale = 1.3686;

	fracRotation1 = Scale* rotationMatrix3(normalize(Rot1), Angle1);
    float t; int n = 0;
    float scalep = 1.;
    float DE1 = 1e4;
    vec3 z0=z;
    for(int n = 0; n < Iterations; n++){
        z *= fracRotation1;
        //z = abs(z);
           z -= Offset;
        if (z.y>z.x) z.xy =z.yx;
        if (z.z>z.x) z.xz = z.zx;
        if (z.y>z.x) z.xy =z.yx;
           z -= Offset2;
        if (z.y>z.x) z.xy =z.yx;
        if (z.z>z.x) z.xz = z.zx;
        if (z.y>z.x) z.xy =z.yx;
        
        scalep *= Scale;
        if(n == 3 || n == 1)
            glow += exp(-length(z.z+ vec2(1.5,sin(m+iTime + p.x)*1. -0.))/scalep*16.);
        if(n<3)
            DE1 = min(DE1,abs(z.x/scalep));
        else {
            DE1 = max(DE1,-(z.x/scalep) );
        
        
            //DE1 = max(DE1,-length(z.yz/scalep) + 0.1 );
        
        }
        
    }
	
		
	//Distance to the plane going through vec3(Size,0.,0.) and which normal is plnormal
	return DE1;
}

vec2 map(vec3 _p){
    vec2 d = vec2(10e4);
    
    //vec4 p = vec4(_p,1.);
    
    _p = abs(_p);
    _p.xz *= rot(-3.);
    _p.yz *= rot(3.);
    //d.x = length(_p) - 1.;
    d.x = DE(_p);

    return d;
}
// fast normals, by tdhooper i think.
const int NORMAL_STEPS = 6;
vec3 getNormal(vec3 pos) {

    vec3 eps = vec3(.0001, 0, 0);
	
	vec3 nor = vec3(0);
	float invert = 1.;
	for (int i = 0; i < NORMAL_STEPS; i++) {
		nor += map(pos + eps * invert).x * eps * invert;
		eps = eps.zxy;
		invert *= -1.;
	}
	return normalize(nor);
}

vec3 getNormala(vec3 p){
    vec2 t = vec2(0.001,0.);
    return normalize(vec3( 
        map(p+t.xyy).x -map(p-t.xyy).x,
        map(p+t.yxy).x -map(p-t.yxy).x,
        map(p+t.yyx).x -map(p-t.yyx).x
    ));
}


float cyclicNoise(vec3 _p){
    float n = 0.;
    float amp = 1.;
    vec4 p = vec4(_p,1.+iTime*1.);
    for(int i = 0; i < 4; i++){
        p.xw *= rot(0.5);
        p.yw *= rot(.5);
        p.yz*= rot(1.5);
        p -= sin(p + vec4(3,2,1.,3. + iTime))*.05*amp;
        n += dot(sin(p),cos(p))*amp;
        p *= 1.5;
        amp *= 0.8;
    }
    return n;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord-iResolution.xy*0.5)/iResolution.y;

    vec3 col = vec3(0,0.004,0.004);
    
    vec3 ro = vec3(0.907761491,4.,3.55399078);
    vec3 lookAt = vec3(-1.0086998,.8070591066,1.223318864);
    ro.xz *= rot(sin(iTime*0.5 + cos(iTime/2.)*0.5)*.4 + 2.1  + 0.*(iMouse.x/iResolution.y*2. - 1.));
    ro.z += 1.7;
    vec3 rd = orthogonalBasis(ro, lookAt)*normalize(vec3(uv,1.));
    
    rd.yz *= rot(0.);
    vec3 p = ro; float t = 0.; bool hit = false;
    vec2 d;
    for(int i = 0; i < 110; i++){
        d = map(p);
        if(d.x < 0.0006){
            hit = true;
            break;
        }
        p = ro + rd*(t+=d.x*0.4);
    }
    float fog = 0.;
    vec3 fp = ro;
    float ft = 0.;
    float fogStSz = 0.05;
    for(int i = 0; i < 0; i++){
        float dens = cyclicNoise(fp*6.);
        dens = max(dens,0.);
        fog += (1.-fog)*dens*fogStSz;
        if(ft > t){
            break;
        }
        fp = ro + rd*(ft+=fogStSz);
    }
    
    col += mix(vec3(0.,0.1,1.),vec3(1. + sin(iTime +uv.x*0.4)*0.2,0.5,1.),glow*1.6)*glow*0.1;
    
    
    //col += fog*0.1*vec3(0.1,0.5,0.6);
    if(hit){
        vec3 n = getNormal(p);
        
        bool debug = false;
        if(debug){
            col = 0.5 + 0.5*n;
        }else {
            vec3 albedo = vec3(.1,0.9,.5);
            vec3 lCol = vec3(0.2,0.5,0.9);
            vec3 ldir = normalize(vec3(-1,1.,4.));
            vec3 hf = normalize(n+ldir);
            float diff = max(dot(ldir,n),0.);
            float spec = pow(max(dot(hf,-rd),0.),15.)*1.4;
            float fres = pow(1.-max(dot(-rd,n),0.),3.);
            //spec = fres;
            spec = mix(spec,fres,fres);
            #define ao(a) smoothstep(0.,1.,map(p+n*a).x/a)
            float AO = ao(0.3)*ao(4.1)*ao(0.9)+0.;
            
            col += 16.*mix(diff*0.02*albedo,lCol*spec,spec)*AO;
        
        }
    
        
    } else{
    
        //col += sin(rd + vec3(3,4,1))*0.004;
    }
    
    {
        float pl = plaIntersect(  ro - 4.,  rd, vec4(1,0.,0,0) );
        vec3 pp = ro +rd*pl;

        vec2 p = pp.yz;
        p.y += iTime*0. + sin(iTime)*0.0;
        float md = 1.;
        vec2 id = floor(p/md);
        p = pmod(p,md);
        float d = abs(p.y);
        d = min(d,abs(p.x));
        float m = sin(id.y + iTime + cos(id.x*20. +sin(id.y + iTime*0.5)*13.))*0.0;
        d -= m*0.1;
        d = max(d,-abs(length(p) - 0.01 -m) + 0.2);
        //col = mix(col,vec3(0.6,0.7,0.4)*2.*col,col*smoothstep(pxsz,0.,uv.y + 0.3 + 0.04*7.*noise(vec3(uv*4.,1. + iTime))));
        
    }
    
    //col = clamp(col,0.,1.);
    
    col =0.5 - col*4.;
    
    //col = pow(col,vec3(0.4545));
    fragColor = vec4(col,1.0);
}`;

const buffB = `
void mainImage( out vec4 C, in vec2 U )
{
    C -= C;
    vec2 kernSz = vec2(4.);
    float iters = kernSz.x * kernSz.y;
    float thresh = 0.1;
    for(float x = 0.; x < iters; x++){
            vec2 offs = vec2(
                mod(x,kernSz.x) - 0.5*kernSz.x,
                floor(x/kernSz.x) - 0.5*kernSz.y
                );
            vec4 t = texture(iChannel0,(U + offs*14.)/iResolution.xy,1.); 
            C += smoothstep(thresh,thresh+1.,t)*(1.-3.*dot(offs/kernSz,offs/kernSz));
    

    }
    C = max(C,0.);
    C /= iters;
    //C = T(a);
    
}`;

const fragment = `
// THE FRACTAL FORMULA IN THE BACKGROUND IS MODIFIED "FoldcutToy.frag" from Fragmentarium by DarkBeam


vec4 n14(float f){ return texture(iChannel0,vec2(mod(floor(f),256.),floor(f/256.))/256.); }


float text(vec2 p, float[8] chars, float spacing, float s, bool isAbs, float absWidth, float opacity, bool scrobble) {
	p *= s;  
    
    p.x *= 1. - spacing;
    vec2 id = floor(p*8.*2.);
    p = mod(p,1./16.);
    p.x = p.x/(1. - spacing) + 1./16./8.;
    float char = chars[int(id.x)];
    //char += 112. ;
    if(scrobble)
        char += floor(15. * n14(id.x + (iTime + sin(id.x))*24.).y*pow(abs(sin(iTime + id.x*0.2)),14.) ) ;
    
    if(scrobble)
        char += 0.*floor(15. * n14(id.x + (iTime + sin(id.x))*24.).y * (2. - 1.)* (1. - eass((iTime - + id.x*1./16. - 3.)*1.,3.)) ) ;
    
    float t;
    if(abs(id.y) < 1. && id.x >= 0. && id.x < 8.  && char < 200.){
        vec4 letter = texture(iChannel3,p + vec2(mod(char,16.),-floor(char/16.) )/16.);
        t = letter.w - opacity;
        if(abs(p.x-1./16./2.)>1./16./2.)
            t = 10e4;
    
        t /= s*10.1;
    } else {
        t = 10e5;
    
	 }
    if (isAbs)
        t = abs(t) - absWidth;
    return t;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord-iResolution.xy*0.5)/iResolution.y;
    vec2 uvn = fragCoord/iResolution.xy;
    float pxsz = fwidth(uvn.x);

    
    vec3 col = texture(iChannel0,uvn).xyz;
    
    
    col += 3.6*texture(iChannel1,uvn).xyz;
    
    col = pow(col,vec3(0.9,1.4,0.8));
    
    col = max(col,0.003);
    
    
    
{
        vec2 p = uv;
        vec2 md = vec2(0.08,0.05);
        
        p.x += 0.67 + md.x*1.;
        p.y += md.y*0.5+0.2;
        
        vec3 c = vec3(1.3,1.35,1.46)*col*2. + (0.4-col*0.5)*1.4;
        c = c*1.*(0.1-col);
        //c = min(c,1.);
        
        {
            vec2 id = floor(p/md);
            vec2 q = pmod(p,md);
            float d = sdBox(q, vec2(0.1,0.002));
            
            d = xor(d,sdBox(q + vec2(+ sin(14.*id.y + iTime*3. + sin(id.y + iTime))*0.04,0.), vec2(0.01 ,0.01)));
            
            //d = xor(d,0.0+sdBox(p - 0.0 , vec2(0.01 ,0.6)));
            
            
            float cnd = float(abs(id.x) == 0. && abs(id.y) < 4.);
            
            //col = mix(col,c,cnd*smoothstep(pxsz,0.,d));
        
            float od = d;
            
            d = sdBox(p - vec2(-0.062,0) , vec2(0.001 ,0.2));
            
            
            
            //col = mix(col,c,smoothstep(pxsz,0.,d));
        
            float db = sdBox(uv + vec2(0.01,0.401) , vec2(0.6 ,0.415));
            //col = mix(col,c,smoothstep(pxsz,0.,db));
            
        }
        
        //d = min(d, sdBox(uv + vec2(0.1), vec2(0.0,0.04)));
        
    }

    {
        float oo = 10e5;
    
            float ob = (sdBox(uv,vec2(1.45,0.46)));
            
            float cutout = sdBox(uv - vec2(0.5,0.4),vec2(0.6 + sin(iTime)*0.1,0.5));
            
            cutout = xor(cutout, sdBox(uv + vec2(0.3,0.4),vec2(0.6 + sin(iTime)*0.2,0.5)));
            
            float outerBox = max(abs(ob),-cutout);
            outerBox = min(outerBox, max(abs(ob + 0.04), -cutout + 0.3));
            
            outerBox = min(outerBox, max(abs(ob + 0.01), -cutout + 0.3));
            
            oo = min(oo,outerBox) - 0.001;
            {
                vec2 p = uv;
                float m = sin(iTime*0.4 + sin(iTime));
                float b = sdBox(p - vec2(0.5 + m*0.1,0.4),vec2(0.3,0.5));
                b = xorb(b,(sdBox(p - vec2(0.2,0.4),vec2(0.2,0.5))),0.1);
                b = xorb(b,(sdBox(p - vec2(0.2,0.4),vec2(0.4,0.2))),0.1);
                b = xorb(b,abs(sdBox(p - vec2(0.+m*0.2,0.4),vec2(0.4,0.1))),0.1);
                b = xorb(b,(sdBox(p - vec2(0.-m*0.2 - 0.1,0.4),vec2(0.6,0.005))),0.1);
                
                oo = min(oo,abs(b) - 0.004);
            
                
            }
            {
                vec2 p = uv + vec2(0.1,0.5);
                p.x += iTime*0.2+ sin(iTime)*0.5;
                p.x = pmod(p.x,2.);
                float m = sin(iTime*0.3 + sin(iTime) );
                float b = sdBox(p - vec2(0.5 + m*0.1,0.4),vec2(0.3,0.5));
                b = xorb(b,(sdBox(p - vec2(0.2,0.4),vec2(0.2,0.5))),0.1);
                b = xorb(b,(sdBox(p - vec2(0.1,0.4),vec2(0.4,0.2))),0.1);
                b = xorb(b,abs(sdBox(p - vec2(0.+m*0.2,0.4),vec2(0.4,0.1))),0.1);
                b = xorb(b,(sdBox(p - vec2(0.-m*0.2 - 0.1,0.4),vec2(0.6,0.00))),0.1);
                
                oo = min(oo,abs(b) - 0.03);
            
                
            }   
            {
                vec2 p = uv + vec2(0.1,0.76);
                p *= rot(0.*pi);
                float m = sin(iTime*0.3 + 4. + sin(iTime+1.) );
                float b = sdBox(p - vec2(0.5 + m*0.1,0.4),vec2(0.3,0.5));
                b = xorb(b,(sdBox(p - vec2(0.4,0.4),vec2(0.,0.6))),0.1);
                b = xorb(b,(sdBox(p - vec2(0.1,0.4),vec2(0.4,0.4))),0.1);
                b = xorb(b,abs(sdBox(p - vec2(0.+m*0.2,0.4),vec2(0.4,0.1))),0.1);
                b = xorb(b,(sdBox(p - vec2(0.-m*0.2 - 0.1,0.4),vec2(0.6,0.00))),0.1);
                
                oo = min(oo,abs(b) - 0.001);
            
                
            }            
            col = mix(col,(0.5-col) ,smoothstep(pxsz*2.,0., oo));
            
            float t = 10e5;
            
            for(float i = 0.; i < 4.; i++){
                float m = sin(iTime*0.4 + sin(iTime)+i);
                t = min(t,text(uv + vec2(0,sin(i+ m)*0.1), float[8](135.,130.,121.,119.,120.,132.,117.,130.), 0.04 +m*0.5 , 0.5 , true, 0.004, 0.3 + 0.1*sin(iTime+i*0.4), false));
                
                
            }
            {
                float m = sin(iTime*0.4 + sin(iTime));
                vec2 p = uv + vec2(0.7,-0.2);
                p *= rot(0.5*pi);
                p.x += (iTime + sin(iTime))*0.3;
                p.x = pmod(p.x,2.);
                t = min(t,text(p, float[8](128.,127.,132.,113.,132.,117.,1117.,1130.), 0.01 +m*0.4 , 0.4 , true, 0.0001, 0.4 + 0.*sin(iTime*0.3 + 0.4), true));
            }   
             
            
            col = mix(col,(0.5-col) ,smoothstep(pxsz + 0.054,0., t));
            

            
    }
     
    
    if(mod(iTime,6.)>5.5)
        col = 1. - col*vec3(1,1,1.5);
    col = pow(col,vec3(0.4545));
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
    key(): string {
        return 'NslSRM';
    }
    name(): string {
        return 'Day 482';
    }
    common() {
        return common;
    }
    sort() {
        return 767;
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
    webgl() {
        return WEBGL_2;
    }
    channels() {
        return [
            { type: 1, f: buffA, fi: 0 },
            { type: 1, f: buffB, fi: 1 },
            webglUtils.DEFAULT_NOISE,
            { ...webglUtils.FONT_TEXTURE, ...webglUtils.TEXTURE_MIPMAPS },
        ];
    }
}
