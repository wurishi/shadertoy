import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float DistLine(vec3 ro, vec3 rd, vec3 p)
{
    vec3 d = normalize(rd);
    vec3 rp = p - ro;
    vec3 proj = d * dot(rp,d);
    return length(rp - proj);
}

float DrawPoint(vec3 ro, vec3 rd, vec3 p)
{
    float d = DistLine(ro,rd,p);
    d = smoothstep(.1,0.099,d);
    return d;
}

vec3 rotY(vec3 p, float a)
{
   p.x = p.x * sin(a) + p.z * cos(a);
   p.y = p.y;
   p.z = p.z * sin(a) - p.x * cos(a);
   return p;
}

vec3 rotZ(vec3 p, float a)
{
    p.x = p.x * cos(a) - p.y * sin(a);
    p.y = p.y * sin(a) + p.x * cos(a);
    p.z = p.z;
    return p;
}

vec3 rotX(vec3 p, float a)
{
    p.x = p.x;
    p.y = p.y * cos(a) - p.z * sin(a);
    p.z = p.y * sin(a) + p.z * cos(a);
    return p;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float t = iTime;

    vec2 uv = fragCoord/iResolution.xy;
    uv -= 0.5;
    uv.x *= iResolution.x / iResolution.y;
    
    vec3 lookat = vec3(0.);
    vec3 ro = vec3(0.,-3.,-5.);
    
    vec3 f = normalize(lookat - ro);
    vec3 r = cross(vec3(0.,1.,0.),f);
    vec3 u = cross(r,f);
    
    float zoom = 1.;
    vec3 c = f * zoom + ro;
    vec3 planepoint = c + u * uv.y + r * uv.x;
    vec3 rd = planepoint - ro;
    
    int m = 100;
    float d = 0.;
    
    // problem right here...
    for(int j=0; j<m; j++)
    {
        float a = (float(j) / float(m))* 2.* 3.14159;
        for (int l=0; l<20; l++)
        {
            float a1 = (float(l) / 20.) * 3.14159 * 2. ;
            float x = cos(a);
            float y = sin(a);
            vec3 p = rotY( vec3(4.+x,y,0.),a1);
            d += DrawPoint(ro,rd,rotY(p,cos(t*.4)*2.));
        }
    } 
    
    fragColor = vec4(d, d, d, 1);
}
`;

export default class implements iSub {
  key(): string {
    return 'fsSGWy';
  }
  name(): string {
    return 'Rotating donut';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 204;
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
