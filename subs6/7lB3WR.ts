import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
vec4 HueShift (in vec3 Color, in float Shift)
{
    vec3 P = vec3(0.55735)*dot(vec3(0.55735),Color);
    
    vec3 U = Color-P;
    
    vec3 V = cross(vec3(0.55735),U);    

    Color = U*cos(Shift*6.2832) + V*sin(Shift*6.2832) + P;
    
    return vec4(Color,1.0);
}
`;

const buffA = `
#define pmod(p,a) mod(p,a) - 0.5*a
#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))
#define pi radians(90.)
#define iTime (iTime + 20.)

float sdBox(vec2 p, vec2 s){p = abs(p) - s; return max(p.x,p.y);}



float text(vec2 p, float[4] chars, float spacing, float s, bool isAbs, float absWidth, float opacity, bool scrobble) {
	p *= s;  
    
    p.x *= 1. - spacing;
    vec2 id = floor(p*8.*2.);
    p = mod(p,1./16.);
    p.x = p.x/(1. - spacing) + 1./16./8.;
    float char = chars[int(id.x) ];
    char -= 32. ;
    float t;
    if(abs(id.y) < 1. && id.x >= 0. && id.x < 4.  && char < 200.){
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
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    
    vec3 col = vec3(1,1.,0.9);
    vec3 c = vec3(0.4,0.41,0.4)*0.;
    vec3 cb = vec3(0.,0.7,0.3);
    
    vec2 md = vec2(0.1,0.2);    
    {
        vec2 p = uv;
        
        p.x += iTime*0.1;
        
        vec2 id = floor(p/md);
        p = pmod(p,md);
        
        float die = fract(sin(id.x*10.*sin(id.y*10.) + cos(id.x*6.)*id.y + id.x));
        if (die < 0.35){
            p = pmod(p,md.x/4.);
            //float d = length(p) - 0.003 + sin(die*20. + iTime*5.)*0.002;
            p = abs(p)*rot(0.5*pi);
            float d = sdBox(p,vec2(0.004,0.003+ sin(die*20. + iTime*5.)*0.002));
            
            
            col = mix(col,c,smoothstep(fwidth(d),0.,d));
            
        } else if (die < 0.6){
            //p = abs(p);
            p[int(die*2000. + iTime)%2] -= 0.4;
            float d = sdBox(p,vec2(0.07))+ sin(die*20. + iTime*5.)*0.0;
            d = abs(d);
            d = pmod(d + iTime*0.,0.01);
            col = mix(col,cb,smoothstep(fwidth(uv.y),0.,d));
        } else if (die < 0.8){
            //p = pmod(p,md.x/4.);
            //float d = sdBox(p,vec2(0.003));
            float d = abs(p.x);
            //d = min(d,abs(p.y));
            //d -= 0.00;
            //col = vec3(0);
            //col = mix(col,1.-col,smoothstep(fwidth(uv.y),0.,d));
        }
    }
    {
        md = md.yx;
        md.x *= 1.;
        vec2 p = uv;
        
        p.x += iTime*0.1;
        
        vec2 id = floor(p/md);
        p = pmod(p,md);
        
        float die = fract(sin(id.x*10.*sin(id.y*10.) + cos(id.x*6.)*id.y + id.x));
        if (die < 0.35){
            p = pmod(p,md.x/4.);
            float d = length(p) - 0.003 + sin(die*20. + iTime*5.)*0.002;
            col = mix(col,c,smoothstep(fwidth(d),0.,d));
            
        } else if (die < 0.5){
            col -= col*1. - vec3(0.,0.4,0.2);
        }
    
    }
    
    {
        for(float i = 0.; i < 250.; i++){
            float sp = (1. + sin(i*114.5)*0.5)*0.1;
            float T = iTime + sin(iTime + i)*0.5;
            vec2 p = uv + vec2(-1.5 + mod(T*sp,1.)*4.,sin(i*4.5 + T*0.1));
            float s = 0.2 + sin(i)*0.1;
            s *= 0.5;
            float d = 10e4;
            
            if(sp < 0.1){
                d = length(p) - s;

                d = pmod(abs(d),0.01);
                d = max(d,length(p) - s);
                d = abs(d) - 0.002;

            } else if (sp < 0.14) {
                float outer = length(p) - s;
                
                p = pmod(p,0.01);
                d = length(p) - 0.003;

                //d = pmod(abs(d),0.01);
                //d = abs(d) - 0.002;
                d = max(d,outer);
            } else {
                //float outer = length(p) - s;
                
                d = length(p) - s;

                //d = max(d,outer);
            }
            
            col = mix(col,c,smoothstep(fwidth(uv.y),0.,d));
        
        }
    
    }
    {
        for(float i = 0.; i < 10.; i++){
            float t = iTime + sin(iTime + i);
            float sp = (1. + sin(i*114.5)*0.5)*0.1;
            vec2 p = uv + vec2(-1.5 + mod(t*sp,1.)*4.,sin(i*4.5 + t*0.));
            p *= 2. + sin(i);
            float d = text(p, float[4](114.,130.,133.,120.), -0.5 , 0.2 , false, 0., 0.54 , false);
            
            vec3 cc = vec3(0);
            col = mix(col,cc,smoothstep(fwidth(d)*(1.-step(0.01,d)),0.,d));

        }
        //vec2 p = uv;
        
    
    }
    
    
    {
        if(abs(uv.y) > 0.45)
            col = 1.-length(col)*vec3(1);
    
    }
    {
        vec2 p = uv;
        p.x += iTime;
        p.x = pmod(p.x,15.);
        
        float sz = .1;
        //p.y = abs(p.y);
        p *= rot(0.5*pi);
        float d = abs(p.x);
        d = max(pmod(d,sz*(0.25 + 0.01)),abs(p.x - sz*0.5 ) - sz);
        //col = mix(col,vec3(1,1,1.) - col*(0.5+0.5*vec3(0.5,0.6,0.9)), smoothstep(fwidth(uv.y),0.,d));
        
    
    }
    vec3 ccc = col.zyx;
    
    //ccc -= 1.;
    //ccc.zx *= rot(5.4);
    ccc = HueShift ( ccc, -.2).xyz;
    //ccc += 1.;
    col = mix(col,ccc, smoothstep(0.8,0.85,sin(iTime*0.5 + uv.x*0.25)));
        
    col = mix(col,col.xzy, smoothstep(0.7,0.76,sin(iTime*0.5 + 3. + uv.x*0.25)));
        
    
    col = pow(col,vec3(0.4545));
    fragColor = vec4(col,1.0);
}
`;

const fragment = `
// hueshift from https://www.shadertoy.com/view/MsjXRt

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;

    vec3 col = vec3(0);
    
    //fragCoord += 650.*noise(vec3(uv*0.5,5.))/iResolution.xy;
    col = texture(iChannel0,fragCoord/iResolution.xy).xyz;

    //col += smoothstep(0.,5.,max(noise(vec3(uv*2.,5.)) - 0.5,0.))*0.25;
    
    
    float n1d = texelFetch(iChannel2,ivec2(mod(fragCoord + vec2(float(iFrame),0.),256.)),0).x;
    vec3 n  = texelFetch(iChannel2,ivec2(mod(fragCoord + n1d*200. ,256.)),0).xyz;
    
    
    //C = smoothstep(0.,1.,C);z
    
    //col.xyz = pow(max(col.xyz,0.), vec3(0.55) + n*0.1);
    
    
    
    col = pow(max(col,0.),vec3(0.4545));

    col.xyz += smoothstep(0.5,0.,length(col))*n*0.1;
    
    col.xyz -= smoothstep(0.4,1.,length(col))*n*0.1;
    
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return '7lB3WR';
  }
  name(): string {
    return 'Day 543';
  }
  // sort() {
  //   return 0;
  // }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
  }
  common() {
    return common;
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
      { type: 1, f: buffA, fi: 0 }, //
      webglUtils.DEFAULT_NOISE,
      webglUtils.DEFAULT_NOISE,
      webglUtils.FONT_TEXTURE,
    ];
  }
}
