import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
//Marching parameters
#define MAXSTEPS 50
#define HITTHRESHOLD 0.009
#define FAR 25.
//AA : change to 1 to turn it off
#define AA 2
//IFS iterations : try 2 or 3
#define NIFS 6
//scale and translate for the IFS in-loop transformation
#define SCALE 2.3
#define TRANSLATE 3.5

mat2x2 rot(float angle)
{
    float c = cos(angle);
    float s = sin(angle);
    return mat2x2(c, -s,
				  s, c);
}

vec4 sd2d(vec2 p, float o)
{
    float time = 0.2*o+0.6*iTime;
 	float s =0.5;
    p*= s;
    float RADIUS =(1.+sin(iTime));
    int i;
    vec3 col;  
    p = p*rot(-0.4*time);// twist

    for ( i = 0; i<NIFS; i++)
    {        
        if (p.x<0.) {p.x = -p.x;col.r++;}
		p = p*rot(0.9*sin(time));
        if (p.y<0.) {p.y = -p.y;col.g++; }
        if (p.x-p.y<0.){ p.xy = p.yx;col.b++;}        
      	p = p*SCALE-TRANSLATE;
        p = p*rot(0.3*(iTime));
    }
    
    float d = 0.425*(length(p)-RADIUS) * pow(SCALE, float(-i))/s;
    col/=float(NIFS);
    vec3 oc = mix(vec3(0.7,col.g,0.2),vec3(0.2,col.r,0.7), col.b);
    
    return vec4(oc,d);
}

vec4 map (vec3 p)
{
	return sd2d(p.xz,p.y);
}

float shadow(vec3 ro, vec3 rd)
{
    float h = 0.;
    float k =3.5;//shadowSmooth
    float res = 1.;
    float t = 0.2; //bias
    for (int i = 0; t < 15.; i++) // t < shadowMaxDist
    {
        h = map(ro + rd * t).w;
		res = min(res, k*h / t);
        if (h < HITTHRESHOLD)
        {
           break;
        }
        t = t + h;
    }
    return clamp(res+0.05,0.,1.);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{ 
    //camera
    float height = -0.4;
    float rot=iTime*0.1;
    float dist= 9.+1.*sin(0.5*iTime);
    vec3 ro = dist * vec3(cos(rot),height,sin(rot));
   	vec3 lookAt = vec3 (0.,0.,0.);
    vec3 fw = normalize(lookAt-ro);
    //tilting camera for a "weirder" feel when rotating around Y axis
    vec3 right = normalize(cross(vec3(0.,1.,1.0), fw));
    vec3 up = normalize(cross (fw, right));
    right = normalize(cross(up,fw));
    
    //light
    rot+=sin(iTime)*0.2;
    vec3 lightPos =  dist * vec3(cos(rot),height,sin(rot));
    
    //raymarch
    vec3 pos, closest;
    float t;
    float smallest;
    int i;
    vec3 sdfCol; 
    vec3 col;
    
    for (int x=0; x<AA;x++)
    for (int y=0; y<AA;y++)
    {
        t = 0.; smallest = 500.;
        vec2 o = vec2(float(x),float(y)) / float(AA) - 0.5;
        vec2 uv = (fragCoord+o)/iResolution.xy;
        uv -= 0.5;
        uv.x *= iResolution.x/iResolution.y; 
        vec3 rd = normalize( fw *0.5 + right * uv.x + up * uv.y);  
        
        for ( i=0; i<MAXSTEPS; i++)
        {
            pos = ro + rd *t;   
            vec4 mr = map(pos);
            float d = mr.w;
            if (d < smallest) smallest = d; closest = pos; sdfCol = mr.rgb;
            if (abs(d)<HITTHRESHOLD || t> FAR) {break;}
            t +=d;
        }   
        pos = closest;
        vec3 c;
        if (t<FAR)
        { 
            c = sdfCol; 
            vec3 toLight = normalize(lightPos-pos);
            float s = shadow(pos,toLight);
            c*=s; 
          	c = mix(c, 1.5*c,1.-s);
        }
        else 
        {
            c = vec3(0.);                
        }     
        col += c;
    }
    col/=float(AA*AA);
    
    fragColor = vec4 (col,t);
}

`;

const fragment = `
//bloom and DOF. Check buffer's #define to tweak the shape
float [] blurWeights = float[](0.002216,
   0.008764,
   0.026995,
   0.064759,
   0.120985,
   0.176033,
   0.199471,
   0.176033,
   0.120985,
   0.064759,
   0.026995,
   0.008764,
   0.002216);

vec4 blur (vec2 uv)
{
    vec4 res;
	for (int x = - 6; x < 6; x ++)
    {
    	for (int y = -6 ; y < 6; y ++)
        {
            res += blurWeights[x+6]*blurWeights[y+6] * texture( iChannel0, ( uv * iResolution.xy + vec2 (x,y) ) / iResolution.xy);
        }
    }
    return res;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;
  
   	vec4 buf = texture( iChannel0, ( uv));
    vec3 blr = blur(uv).rgb;
    float near =3.; float mid = 9.; float far = 15.;
    float curve = smoothstep(0.,near,buf.w)* smoothstep(far,mid,buf.w);
    vec3 col = mix (blr,buf.rgb,curve);
    col.rgb += 0.5*blr;

    fragColor = vec4 (col,1.);
}
`;

export default class implements iSub {
  key(): string {
    return 'tsBSWD';
  }
  name(): string {
    return 'Colored lines';
  }
  sort() {
    return 529;
  }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
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
    ];
  }
}
