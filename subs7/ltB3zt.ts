import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define PI 3.14159
#define inf 999999.0

vec2 rotate(vec2 point, float angle)
{
    float x = point.x; float y = point.y;
    point.x = x * cos(angle) - y * sin(angle);
    point.y = y * cos(angle) + x * sin(angle);
    return point;
}

bool box2d(vec2 pos, vec2 uv, vec2 pivot, float angle, float w, float h)
{
    uv -= pos;
    uv = rotate(uv, angle) + pivot;
    
    bool x = (w - uv.x) > 0.0 && (-w - uv.x) < 0.0;
    bool y = (h - uv.y) > 0.0 && (-h - uv.y) < 0.0;
    
    return x && y;
}

vec2 angletovec(float angle)
{
    float xn = cos(angle);
    float yn = sin(angle);
    return vec2(xn, yn);
}

struct Joint
{
    vec2 pos;
    float w;
    float h;
    float angle;
};

vec2 endPoint(in Joint j)
{
    return j.pos + vec2(cos(-j.angle), sin(-j.angle)) * j.w * 2.0;
}
    
bool drawJoint(in Joint j, vec2 uv)
{
    return box2d(j.pos, uv, vec2(-j.w, 0.0), j.angle, j.w, j.h);
}

void rotateJoint(inout Joint j1, in vec2 target, float amount)
{	
    vec2 ep = j1.pos;
    vec2 targetv = normalize(target - ep);
    targetv.y *= -1.0;
    // which way to turn?
    // construct a vector normal to direction and check sign of dot product
    float an = (j1.angle) + PI * 0.5;
    vec2 norm = angletovec(an);
    float turn = dot(norm, targetv);
    float dir = turn > 0.0 ? 1.0 : -1.0;
    
    // turn
    vec2 fwd = angletovec(j1.angle);
    float d = clamp(dot(fwd, targetv), -1.0, 1.0);
    float turnangle = acos(d);
      
    j1.angle += turnangle * dir * amount;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    
    fragColor = vec4(0.0);
	vec2 uv = fragCoord.xy / iResolution.xy;
    uv -= vec2(0.5);
    float aspect = iResolution.x / iResolution.y;
    uv.y /= aspect;
    
    float mx = iMouse.x / iResolution.x;
    float my = iMouse.y / iResolution.y;
    vec2 target = vec2(mx, my);
    target -= vec2(0.5);
    target.y /= aspect;

    if(iMouse.wz == vec2(0.0))
    {
        target = vec2(sin(iTime) * 0.45, 0.1 + cos(iTime) * 0.15);
    }
    
    const int JOINTS = 7;
    Joint j[JOINTS];
	
    j[0].pos = vec2(-0.0, -0.3);
    j[0].w = 0.05;
    j[0].h = 0.02;
    j[0].angle = -PI * 0.5;
    float fj = float(JOINTS);
    
    for (int i = 1; i < JOINTS; ++i)
    {
        j[i].pos = endPoint(j[i - 1]);
        float r = (fj - float(i)) / fj;
        j[i].w = 0.03;
        j[i].h = 0.01 * r;
    	j[i].angle = -PI * 0.5;    
    }
	const int iter = 5;
    const float weight = 0.35;
    
    for (int x = 0; x < iter; ++x)
    {	
        for (int i = JOINTS - 1; i >= 1; --i)
        {
            j[i].pos = endPoint(j[i - 1]);
            rotateJoint(j[i], target, weight * (float(i) / float(iter)));
        }
    }
    
    for (int i = 1; i < JOINTS; ++i)
    {
       j[i].pos = endPoint(j[i - 1]);
    }

    bool b = false;
    for (int i = 0; i < JOINTS; ++i)
    {
        b = b || drawJoint(j[i], uv);
    }
    
    fragColor = vec4(0.7, 0.1, uv.y + 0.3, 0.0);
    fragColor -= vec4(b ? 1.0 : 0.0);
    fragColor = max(fragColor, 0.0);
    if(sin(uv.x * 17.0) * 0.01 - uv.y > 0.20)
    {
        fragColor = vec4(0.0);
    }
    
    // target "light";
    fragColor += 1.0 - smoothstep(length(uv - target), 0.0, 0.01);;
    
    fragColor.a = 1.;
}
`;

export default class implements iSub {
    key(): string {
        return 'ltB3zt';
    }
    name(): string {
        return 'BadLand';
    }
    sort() {
        return 774;
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
