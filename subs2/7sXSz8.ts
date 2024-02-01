import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float fOpIntersectionRound(float a, float b, float r) {
	vec2 u = max(vec2(r + a,r + b), vec2(0));
	return min(-r, max (a, b)) + length(u);
}

float fOpDifferenceRound (float a, float b, float r) {
	return fOpIntersectionRound(a, -b, r);
}

float sdBox(vec2 p, vec2 s){p = abs(p) -s; return max(p.y,p.x);}


vec3 pal(float m){
    vec3 c = 0.5+0.5*sin(m + vec3(1.5,0.,-0.5));
    c = pow(c, vec3( .5));
    
    return c;
}

#define xor(a,b) min(max(a,-(b)),max(b,-(a)))

#define xorb(a,b,c) min(max(a + c,-(b)),max(b,-(a)))

float plaIntersect( in vec3 ro, in vec3 rd, in vec4 p )
{
    return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
}

// it's like the last one but uninspired! 
// lol, still okay looking tho

#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define pmod(p,a) mod(p,a) - 0.5*a

// cyclic noise by nimitz. i have a tutorial on it on shadertoy

float noise(vec3 p_){
    float n = 0.;
    float amp = 1.;
    vec4 p = vec4(p_,-(iTime + sin(iTime))*0.2);
    for(float i = 0.; i < 6.; i++){
        p.yz *= rot(.5);
        p.xz *= rot(2.5 + i);
        p.wy *= rot(2.5-i);
        p += cos(p*1. + vec4(3,2,1,1.+iTime*1.5) )*amp*.5;
        n += dot(sin(p),cos(p))*amp;
    
        amp *= 0.7;
        p *= 1.5;
    }
    
    //n = sin(n*1.);
    return n;
}

vec2 map(vec3 p){
    vec2 d = vec2(10e5);
    
    p.xz *= rot((iTime+sin(iTime))*0.5);
    float n = noise(p*1.5);
    d.x = length(p) - 1. + n*0.15;
    d.x*=0.8;
    return d;
}
vec3 getNormal(vec3 p){
    vec2 t = vec2(0.001,0.);
    return normalize(vec3(
        map(p+t.xyy).x - map(p-t.xyy).x,
        map(p+t.yxy).x - map(p-t.yxy).x,
        map(p+t.yyx).x - map(p-t.yyx).x 
    ));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    float pxsz = fwidth(uv.x + uv.y);
    //vec3 col = vec3(0.1,0.6,0.8)*1. + sin(vec3(0.1,0.3,0.1)*uv.x*4. + vec3(5,2,1) + uv.y + sin(iTime))*0.5;
    vec3 col = vec3(0.9,1.,1.);
    
    
    bool hit = false;
    
    vec3 ro = vec3(0,0,-3.);
    vec3 rd = normalize(vec3(uv,1. + sin(iTime)*0.));
    float t = 0.;

    {
    
        float modD = 0.2;
        vec2 p = uv - vec2(0,iTime*0.1 );
        vec2 id = floor(p/modD);
        float n = noise(vec3(id,1. + iTime));
        p = pmod(p,modD);
        float d = length(p) - 0.00 + n*0.004;
        
        col = mix(col,vec3(1.)*pal(n + p.y*144.) + 0.3,smoothstep(pxsz,0.,d));
        
    }

    {
        vec3 p = ro;
        
        vec2 d; 
        for(int i = 0; i < 30; i++){
            d = map(p);
            if(d.x < 0.009){
                hit = true;
                break;
            }
            p = ro + rd * ( t += d.x);
        }
        
        if(hit){
            vec3 n = getNormal(p);
            vec3 r = reflect(rd,n);
            vec3 rfr = refract(rd,n,.5);
            
            //col = 0.501 + 0.5*sin(r*1.4 + dot(-n,rfr)*2. + vec3(1,4,5.) + length(rfr + n)*6.);
            //col = pal();
            col = 0.501 + 0.5*sin(r*.6 + n*vec3(1.5,1.1,0.5)*1. + 0.5*dot(r,n)*13.5 - r*0.5  + vec3(1.5,3.7,5.) + 0.8*length(rfr + n)*4.);
            #define ao(a) smoothstep(0.,1.,map(p+n*a).x/a)
            //col *= ao(0.04);
            //col = max(col,0.);
            //col = smoothstep(0.,1.,col);
            col = pow(col,vec3(0.3,0.35,0.26));
            //col = 0.5 + n*0.5;
        }
    }

    {
        vec2 p = uv;
        vec2 md = vec2(0.11,0.04);
        
        //p.x += 0.67 + md.x*1.;
        //p.y += md.y*0.5+0.2;
        
        vec3 c = vec3(0.1,0.35,0.46)*col*2.5 + (0.4-col*0.5)*1.4 + 0.1*vec3(3,2,1)*sin(p.xyx*14. + iTime);
        c = max(c,0.1);
        
        vec3 oc = c*2.6*(1.-col + 0.4); 
        c = oc;
        
        //c =  (pal(uv.y*11. + iTime*1.) + 0.5)*c*1.5*(col*1.);
    
            {
                
                
                
                for(float i = 0.; i < 115.; i++){
                    float plane = plaIntersect( ro 
                        + vec3(0.,0.,0.6 - .5*sin(i)), rd, vec4(0,0,-1,0) );
                    vec3 p = ro + rd*plane;
                    p.x += sin(i*112.)*2.;
                    p.y += 1.6-mod(0.1*iTime*(1. + sin(i)*0.8),1.)*5.;
                    float db = 10e5;
                    
                
                    float m = sin(iTime + i*1.17);
                    m = m + sin(iTime+i*1.05);
                    
                    p.xy*=rot(m*11.);
        
                vec2 s = 0.5*vec2(0.1*(0.6 + m*0.1) ,0.01+m*0.0255*0.);
                    db = sdBox(p.xy ,s );
                    db = xorb(db,sdBox(p.xy*rot(0.5*3.14) , s),-0.0);
                
                    //db = xor(db, sdBox(uv*rot(m*1.) , vec2(0.1*(0.6 + m*0.5) ,m*0.0155)));
                
                    if(plane < t){
                        //col = mix(col,(1.-col + 0.35)*(4. + pow(pal(p.y*10.),vec3(0.5)))*0.5,smoothstep(0.03,0.0,db));
                
                        col = mix(col,(1.-col + 1.)*pow(pal(p.y*10. + i + iTime),vec3(0.7)),smoothstep(pxsz,0.,db));
                    }
                }
                
                /*
                if(plane < t)
                    col = mix(col,oc,smoothstep(pxsz,0.,db));
                */
            }
        {
            vec2 omd = md;
            vec2 id = floor(p/md);
            
            
            p*=rot(0.);
            md.x *= 2.;
            vec2 idr = floor(p/md);
            vec2 q = pmod(p,md);
            //q.y += sin(idr.y + (iTime + sin(iTime))*2.)*md.y*0.3;
            float d = sdBox(q, vec2(0.1,0.002));
            
            d = xorb(d,0.005+sdBox(q + vec2(+ sin(5.*idr.y + iTime*1. + 3.*sin(idr.y + iTime))*md.x*0.6,0.), vec2(0.5*md.x ,0.01)),0.04);
            
            //d = xor(d,0.0+sdBox(p - 0.0 , vec2(0.01 ,0.6)));
            
            
            //vec2 ca = vec2();
            //cnd += float((id.x) == 6. && abs(id.y - 3.) < 7.);
            
            vec2 pa = vec2(0.77,0.3);
            vec2 pb = - vec2(0.77,0.3);
            
            float wa = 0.03;
            float wb = 0.0001;
            
            float outer = sdBox(uv +pa,vec2(omd.x/2.,md.y*3.5));
            
            vec2 z = uv + pa;
            
            float oo = max(abs(outer - wa) - wb,-sdBox(z - 0.08,vec2(omd.x/2.,md.y*3.5)) ); 
            oo = max(oo,-sdBox(z + 0.08*vec2(0.6,0.45),vec2(omd.x/2.,md.y*3.5)) ); 
            
            float bb = sdBox(uv +pb,vec2(omd.x/4.,md.y*3.5));
            outer = min(outer,bb);
            
            z = uv + pb;
            
            oo = min(oo,max(abs(bb - wa) - wb,-sdBox(z - 0.08,vec2(omd.x*1.,md.y*3.5)) )); 
            oo = max(oo,-sdBox(z + 0.08*vec2(0.1,0.45),vec2(omd.x/2.,md.y*7.5)) ); 
            
            oo = (oo - 0.00) - 0.0001;
            
            
            
            
            float mu = sin(iTime*0.5+sin(iTime))*0.4;
            
            float ob = (sdBox(uv,vec2(0.85,0.46)));
            
            float cutout = sdBox(uv - vec2(0.5,0.4),vec2(0.6 + sin(iTime)*0.2,0.5));
            
            cutout = min(cutout, sdBox(uv + vec2(0.5,0.4),vec2(0.6 + sin(iTime)*0.2,0.5)));
            
            float outerBox = max(abs(ob),-cutout);
            outerBox = min(outerBox, max(abs(ob + 0.04), -cutout + 0.3));
            
            outerBox = min(outerBox, max(abs(ob + 0.06), -cutout + 0.3));
            
            oo = min(oo,outerBox);
            
            
            col = mix(col,c,smoothstep(pxsz,0., oo));
            
            
               
           
            float cnd = smoothstep(pxsz,0., outer);
            
            //col = mix(col,col*c,cnd*smoothstep(0.05,0.,d));
            col = mix(col,c,cnd*smoothstep(pxsz,0.,d));
            
            
            
            float od = d;
            
            d = sdBox(p - vec2(-0.022,0) , vec2(0.01 ,0.2));
            
            
            {
            
                float dmu = 10e4;
                for(float i = 0.; i < 2.; i++){
                    float plane = plaIntersect( ro 
                        + vec3(0.,0.,+1.4 - .5*sin(iTime + i)), rd, vec4(0,0,-1,0) );
                    vec3 p = ro + rd*plane;
                    
                    
                    float dmub = length(uv + vec2(sin(i+iTime)*0.1,0.)) - 0.1;
                    if(plane < t){
                        dmu = min(xorb(dmu,abs(dmub -0.4) - 0. -0.1*sin(iTime*1.+i*0.3),0.0),0.01);
                
                    }     
                }
            
                //oo = min(oo,dmu);
                col = mix(col,c,smoothstep(pxsz,0., dmu));
                        
                //dmu = min(dmu,abs(dmu - 0.02) - 0.01);

                
            
            }
            //d = min(d,xor(d,sdBox(p - vec2(-0.022,0) , vec2(0.001 ,0.5))));
            //d = min(d,xor(d,sdBox(p - vec2(-0.06,0) , vec2(0.001 ,0.3))));
            //d = min(d,xor(d,sdBox(p - vec2(-0.05,0) , vec2(0.046 ,0.3))));
            //d = min(d,xor(d,sdBox(p - vec2(-0.1,0.3) , vec2(0.02 ,0.1))));
            //d = abs(d) - 0.001;
            
            
        }
        
        //d = min(d, sdBox(uv + vec2(0.1), vec2(0.0,0.04)));
        
    }
    
    float doo = -abs(uv.x ) + 0.55;
    
    if(doo <0.){
        col = (1.-col) + 0.3;
        col.xz*=rot(0.3 + sin(uv.y+iTime + sin(iTime))*0.4);
        col = smoothstep(0.,1.,col);
        col = smoothstep(0.,1.,col);
        
    }
    if(mod(iTime,6.)>5. || iMouse.z > 0.)
        col = 1. - col;
        
    col = pow(col,vec3(0.3545));
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '7sXSz8';
  }
  name(): string {
    return 'Days 480';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 286;
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
