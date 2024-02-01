import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define MAX_STEPS (1<<7)
#define MAX_DIST 100.
#define SURF_DIST .01
#define LIGHT_RADIUS 1000.

const float TorusMat = 1.;
const float CapsuleMat = 2.;
const float ShpereMat = 3.;
const float CubeMat = 4.;
const float PlaneMat = 5.;

vec3 GetMatColor(float mat, vec3 currentPoint)
{
    vec3 col = vec3(0);
    if(mat == TorusMat)
    {
        col = vec3(1,sin(iTime),cos(iTime));
    }else if(mat == CapsuleMat)
    {
        col = vec3(0,0.5,cos(iTime));
    }else if(mat == CubeMat)
    {
        col = vec3(.1);
    } else {col = vec3(1);}
    return col;
}

float GetMatSpec(float mat)
{
    if(mat == ShpereMat)
    {
        return 5.;
    } else if(mat == CubeMat)
    {
        return 5.;
    } else if(mat == PlaneMat)
    {
        return 1.;
    }
    return 0.2;
}

float sdCapsule(vec3 p, vec3 a, vec3 b, float r)
{
    vec3 ab = b-a;
    vec3 ap = p-a;
    
    float t = dot(ab, ap) / dot(ab,ab);
    t = clamp(t,0.,1.);
    
    vec3 c= a + t * ab;
    return length(p-c)-r;
}

float sdBox(vec3 p, vec3 s) {
    p = abs(p)-s;
	return length(max(p, 0.))+min(max(p.x, max(p.y, p.z)), 0.);
}

float sdTorus (vec3 p, vec2 r)
{
    float x = length(p.xz)-r.x;
    return length(vec2(x, p.y)) -r.y;
}

vec2 GetDist (vec3 p) {
    vec4 s = vec4(sin(iTime), 1,cos(iTime) + 4., 1);
    
    float sphereDist = length(p-s.xyz ) - s.w;
    float torusDist = sdTorus(p - vec3(0,sin(iTime)/5. + 1.,-3), vec2(1,sin(iTime)/6. + 0.5));
    float planeDist = p.y;
    float boxDist = sdBox(p - vec3(-4,1.2,0), vec3(1));
    
    float cd = sdCapsule(p - vec3(4,0,0), vec3(-cos(iTime),-sin(iTime) + 2.,0), vec3(cos(iTime),sin(iTime) + 2.,0),.6);
    float d = min(cd, planeDist);
    d = min(d, sphereDist);
    d = min(d, torusDist);
    d = min(d, boxDist);
    
    float mat = 0.;
    if(d == torusDist) {mat = TorusMat;}
    else if(d == cd) {mat = CapsuleMat;}
    else if(d == sphereDist) {mat = ShpereMat;}
    else if(d == planeDist) 
    {
        mat = PlaneMat;
    }
    else if(d == boxDist) {mat = CubeMat;}
    return vec2(d,mat);
}

vec3 GetNormal (vec3 p) {
    float d = GetDist (p).x;
    vec2 e = vec2 (.0003, 0);
    
    vec3 left = vec3(GetDist(p - e.xyy).x,
                     GetDist(p - e.yxy).x,
                     GetDist(p - e.yyx).x),
        right = vec3(GetDist(p + e.xyy).x,
                     GetDist(p + e.yxy).x,
                     GetDist(p + e.yyx).x);
        
    vec3 n = normalize(-left + right);
    return normalize(n);
}

vec3 GetPlaneTexture (vec3 point)
{
    vec3 normal = abs(GetNormal(point));
    vec3 texXZ = texture(iChannel0, point.xz * .5+.5).rgb;
    vec3 texYZ = texture(iChannel0, point.yz * .5+.5).rgb;
    vec3 texXY = texture(iChannel0, point.xy * .5+.5).rgb;
    vec3 disp = vec3(0);
    disp += texXY * normal.z;
    disp += texYZ * normal.x;
    disp += texXZ * normal.y;
    return disp;
}

vec3 RayMarch (vec3 ro, vec3 rd) 
{
    float dO=0.;
    float smallestDist = 1.;
    float mat = 0.;
    for(int i=0; i<MAX_STEPS; i++)
    {
        vec3 currentPoint = ro + rd * dO;
        vec2 Distance = GetDist(currentPoint);
        mat = Distance.y;
        if(mat == PlaneMat)
        {
            Distance.x -= GetPlaneTexture (currentPoint).b * .05;
        }
        float dS = Distance.x;
        dO += dS;
        smallestDist = min(smallestDist,dS/dO);
        if(dS <= 0.01) 
        {
            smallestDist = 0.;
        }
        if(dO>MAX_DIST || dS<SURF_DIST)
        {
         float fadeRatio =
         1.0 - clamp(SURF_DIST / LIGHT_RADIUS, 0., 1.);
         float distanceFactor = pow(fadeRatio, 2.);
         smallestDist *= distanceFactor;
         break;
        }
    }
    smallestDist = clamp(smallestDist,0.,1.);
    return vec3(dO,smallestDist,mat);
}

vec3 GetLight(float material,vec3 rayDir,vec3 p, vec3 pos,float power, vec3 color) 
{
    vec3 lightPos = pos;
    vec3 l = normalize(lightPos-p);
    vec3 n = GetNormal (p);
    
    float dif = clamp(dot(n, l), 0.,1.);
    float specAmount = GetMatSpec(material);
    float spec = 0.;
    if(specAmount != .0)
    {
        spec = pow(max( dot( reflect(-l, n), -rayDir ), 0.), 8.);
    }
    vec3 d = RayMarch(p+n*SURF_DIST * 2.,l);
    return clamp(d.y * dif + (vec3(1., .6, .2)*spec*specAmount),0.002,1.) * color * power;
}

vec3 GetRayDir(vec2 uv, vec3 p, vec3 l, float z) {
    vec3 f = normalize(l-p),
        r = normalize(cross(vec3(0,1,0), f)),
        u = cross(f,r),
        c = f*z,
        i = c + uv.x*r + uv.y*u,
        d = normalize(i);
    return d;
}

mat2 Rot(float a) {
    float s=sin(a), c=cos(a);
    return mat2(c, -s, s, c);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - .5 * iResolution.xy)/iResolution.y;
    vec2 mouse = iMouse.xy/iResolution.xy;
    vec3 pos = vec3(0, 6, -6);
    vec3 ro = pos;
    ro.yz *= Rot(-mouse.y*3.14+1.);
    ro.xz *= Rot(-mouse.x*6.2831);
    ro.y = clamp(ro.y,1.2,10.);
    
    vec3 rd = GetRayDir(uv, ro, vec3(0,0.,0), 1.);
    
    vec3 d = RayMarch(ro, rd);
    
    vec3 p = ro + rd * d.x;
    
    vec3 normal = abs(GetNormal(p));
    
    vec3 col = vec3(0);
    if(d.x < MAX_DIST)
    {
        col = vec3(1);
        if(d.z == PlaneMat)
        {
            col = vec3(0);
            col += GetPlaneTexture(p);
        } else {col = GetMatColor(d.z,p);}


        col *= 
           GetLight(d.z,rd,p,vec3(0,5,-6),1.,vec3(1,1,1))
        + GetLight(d.z,rd,p,vec3(sin(iTime) * 3.,5,cos(iTime) * 3.),1.,vec3(1,0,1));
    }
    
    col = pow(col, vec3(.4545));
    //Fade to black
    col *= 1./(MAX_DIST/(MAX_DIST-d.x));
    // Output to screen
    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'NtSGDR';
  }
  name(): string {
    return "Bunch o' random shapes";
  }
  sort() {
    return 638;
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
