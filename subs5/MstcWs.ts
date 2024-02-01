import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
/*

Helix Distance
--------------

I've been wanting to create nice even helix shapes, most of the methods
I've seen usually twist some geometry around an axis, but this leads to
a squashed cross-section with large radiuses.

Instead, here I'm finding an approximate closest point on the helix and
using that to calculate the distance. To see how this looks, enable
VISUALISE_CLOSEST below and click around the canvas.

I'm also constructing 'helix coordinates' which you can see visualised
as the uv texture. These can also be used for twisting regular geometry
around the helix.

There's a seam that appears for small radii, for which I don't think
there's a neat solution. The problem is, as you approach the central
axis of a helix, the closest point could be on the opposite side, this
varies with the thickness of the pipe geometry too.

These Wikipedia pages are helpful when thinking about the geometry
of helices:

* https://en.wikipedia.org/wiki/Helix_angle
* https://en.wikipedia.org/wiki/Lead_(engineering)

*/

//#define VISUALISE_CLOSEST

// --------------------------------------------------------
// Structs
// --------------------------------------------------------

struct Model {
    float dist;
    vec2 uv;
    int id;
};

struct Hit {
    Model model;
    vec3 pos;
    bool isBackground;
    vec3 normal;
    vec3 rayOrigin;
    vec3 rayDirection;
};


// --------------------------------------------------------
// Utilities
// --------------------------------------------------------

#define PI 3.14159265359

#define saturate(x) clamp(x, 0., 1.)

void pR(inout vec2 p, float a) {
    p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}
    
// Repeat space along one axis
float pMod1(inout float p, float size) {
    float halfsize = size*0.5;
    float c = floor((p + halfsize)/size);
    p = mod(p + halfsize, size) - halfsize;
    return c;
}

// Distance to line segment between <a> and <b>, used for fCapsule() version 2below
float fLineSegment(vec3 p, vec3 a, vec3 b) {
    vec3 ab = b - a;
    float t = saturate(dot(p - a, ab) / dot(ab, ab));
    return length((ab*t + a) - p);
}

// Capsule version 2: between two end points <a> and <b> with radius r 
float fCapsule(vec3 p, vec3 a, vec3 b, float r) {
    return fLineSegment(p, a, b) - r;
}

// A circular disc with no thickness (i.e. a cylinder with no height).
float fDisc(vec3 p, float r) {
 float l = length(p.xz) - r;
	return l < 0. ? abs(p.y) : length(vec2(p.y, l));
}

vec3 intersectPlane(vec3 rayOrigin, vec3 rayDirection, vec3 normal, float offset) {
	float dist = dot(normal, normal * offset - rayOrigin) / dot(normal, rayDirection);
	return rayOrigin + rayDirection * dist;
}

// Cartesian to polar coordinates
vec3 cartToPolar(vec3 p) {
    float x = p.x; // distance from the plane it lies on
    float a = atan(p.y, p.z); // angle around center
    float r = length(p.zy); // distance from center
    return vec3(x, a, r);
}

// Polar to cartesian coordinates
vec3 polarToCart(vec3 p) {
    return vec3(
        p.x,
        sin(p.y) * p.z,
        cos(p.y) * p.z
    );
}

// Closest of two points
vec3 closestPoint(vec3 pos, vec3 p1, vec3 p2) {
    if (length(pos - p1) < length(pos - p2)) {
        return p1;
    } else {
        return p2;
    }
}

// http://www.neilmendoza.com/glsl-rotation-about-an-arbitrary-axis/
mat3 rotationMatrix(vec3 axis, float angle)
{
    axis = normalize(axis);
    float s = sin(angle);
    float c = cos(angle);
    float oc = 1.0 - c;
    
    return mat3(
        oc * axis.x * axis.x + c,           oc * axis.x * axis.y - axis.z * s,  oc * axis.z * axis.x + axis.y * s,
        oc * axis.x * axis.y + axis.z * s,  oc * axis.y * axis.y + c,           oc * axis.y * axis.z - axis.x * s,
        oc * axis.z * axis.x - axis.y * s,  oc * axis.y * axis.z + axis.x * s,  oc * axis.z * axis.z + c
    );
}


// --------------------------------------------------------
// Helix
// --------------------------------------------------------

vec2 closestPointOnRepeatedLine(vec2 line, vec2 point){

    // Angle of the line
    float a = atan(line.x, line.y);

    // Rotate space so we can easily repeat along
    // one dimension
    pR(point, -a);

    // Repeat to create parallel lines at the corners
    // of the vec2(lead, radius) polar bounding area
    float repeatSize = sin(a) * line.y;
    float cell = pMod1(point.x, repeatSize);

    // Rotate space back to where it was
    pR(point, a);

    // Closest point on a line
    line = normalize(line);
    float d = dot(point, line);
    vec2 closest = line * d;

    // Part 2 of the repeat, move the line along it's
    // perpendicular by the repeat cell
    vec2 perpendicular = vec2(line.y, -line.x);
    closest += cell * repeatSize * perpendicular;

    return closest;
}

// Closest point on a helix
vec3 closestHelix(vec3 p, float lead, float radius) {

    p = cartToPolar(p);
    p.y *= radius;

    vec2 line = vec2(lead, radius * PI * 2.);
    vec2 closest = closestPointOnRepeatedLine(line, p.xy);

    closest.y /= radius;
    vec3 closestCart = polarToCart(vec3(closest, radius));

    return closestCart;
}


// Cartesian to helix coordinates
vec3 helixCoordinates(vec3 p, vec3 closest, float lead, float radius) {
    float helixAngle = atan((2. * PI * radius) / lead);
    vec3 normal = normalize(closest - vec3(closest.x,0,0));
    vec3 tangent = vec3(1,0,0) * rotationMatrix(normal, helixAngle);
    float x = (closest.x / lead) * radius * PI * 2.;
    float y = dot(p - closest, cross(tangent, normal));
    float z = dot(p - closest, normal);
    return vec3(x,y,z);
}

vec3 mousePos;
bool mouseDown;

Model visualiseClosest(vec3 p) {
    float lead = 3.;
    float radius = 1.5;
    
    vec3 helix = closestHelix(p, lead, radius);
    float d = length(p - helix) - .1;
    
    vec3 testPoint = vec3(sin(iTime * .75) * 3., cos(iTime * .75) * .8, 0.);
    if (mouseDown) {
    	testPoint = mousePos;
    }

    vec3 testHelix = closestHelix(testPoint, lead, radius);

    d = min(d, length(p - testHelix) - .2);
    d = min(d, length(p - testPoint) - .1);
    d = min(d, fCapsule(p, testPoint, testHelix, .05));

    return Model(d, vec2(0), 0);
}

Model map(vec3 p) {
    #ifdef VISUALISE_CLOSEST
		return visualiseClosest(p);
   	#endif
    
    float phase = iTime * PI * 2. / 8. - .5;
    float lead = mix(1., 8., sin(phase) * .5 + .5);
    float radius = mix(0.001, 1.8, cos(phase) * .5 + .5);

    vec3 helix = closestHelix(p, lead, radius);
    float d = length(p - helix) - .5;
    
    vec3 hp = helixCoordinates(p, helix, lead, radius);
	vec2 uv = vec2(hp.x, atan(hp.y, hp.z) / PI / 2.);
    
    return Model(d, uv, 0);
}        


// --------------------------------------------------------
// Rendering
// --------------------------------------------------------

vec3 render(Hit hit){
    vec3 col;
    if (hit.isBackground) {
        col = vec3(.1);
    } else {
        vec2 uv = hit.model.uv;
        uv *= vec2(4., 8.);
        uv = cos(uv * PI * 2.);
        uv = smoothstep(.5, .55, uv);
        col = vec3(1.-uv.yx, 1.);
        #ifdef VISUALISE_CLOSEST
        col = vec3(1);
        #endif
        vec3 light = normalize(vec3(.5,1,0));
	    vec3 diffuse = vec3(dot(hit.normal, light) * .5 + .5);
		col *= diffuse;
    }
    #ifndef VISUALISE_CLOSEST
    if (hit.isBackground || hit.pos.z > 0.) {
		vec3 debugPlanePos = intersectPlane(
            hit.rayOrigin, hit.rayDirection, vec3(0,0,1), 0.
        );
        float dist = map(debugPlanePos).dist;
        vec3 meter = vec3(mod(dist, 1./4.));
        col = mix(col, meter, .5);
    }
    #endif
	return col;
}


// --------------------------------------------------------
// Ray Marching
// --------------------------------------------------------

const float MAX_TRACE_DISTANCE = 30.;
const float INTERSECTION_PRECISION = .001;
const int NUM_OF_TRACE_STEPS = 100;
const float FUDGE_FACTOR = .1;


vec3 calcNormal(vec3 pos){
    vec3 eps = vec3( 0.001, 0.0, 0.0 );
    vec3 nor = vec3(
        map(pos+eps.xyy).dist - map(pos-eps.xyy).dist,
        map(pos+eps.yxy).dist - map(pos-eps.yxy).dist,
        map(pos+eps.yyx).dist - map(pos-eps.yyx).dist );
    return normalize(nor);
}

Hit raymarch(vec3 rayOrigin, vec3 rayDirection){

    float currentDist = INTERSECTION_PRECISION * 2.0;
    float rayLength = 0.;
    Model model;

    for(int i = 0; i < NUM_OF_TRACE_STEPS; i++){
        if (currentDist < INTERSECTION_PRECISION || rayLength > MAX_TRACE_DISTANCE) {
            break;
        }
        model = map(rayOrigin + rayDirection * rayLength);
        currentDist = model.dist;
        rayLength += currentDist * (1. - FUDGE_FACTOR);
    }

    bool isBackground = false;
    vec3 pos = vec3(0);
    vec3 normal = vec3(0);

    if (rayLength > MAX_TRACE_DISTANCE) {
        isBackground = true;
    } else {
        pos = rayOrigin + rayDirection * rayLength;
        normal = calcNormal(pos);
    }

    return Hit(model, pos, isBackground, normal, rayOrigin, rayDirection);
}


mat3 calcLookAtMatrix(vec3 ro, vec3 ta, vec3 up) {
    vec3 ww = normalize(ta - ro);
    vec3 uu = normalize(cross(ww,up));
    vec3 vv = normalize(cross(uu,ww));
    return mat3(uu, vv, ww);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {

    vec2 p = (-iResolution.xy + 2.0*fragCoord.xy)/iResolution.y;
    vec2 m = (-iResolution.xy + 2.0*iMouse.xy)/iResolution.y;

	vec3 camPos = vec3(0,0,-6);
    vec3 camTar = vec3(0);
    vec3 camUp = vec3(0,1,0);
    mat3 camMat = calcLookAtMatrix(camPos, camTar, camUp);

    float focalLength = 2.;
    vec3 rayDirection = normalize(camMat * vec3(p, focalLength));

    vec3 mouseRayDirection = normalize(camMat * vec3(m, focalLength));
    mousePos = intersectPlane(camPos, mouseRayDirection, vec3(0,0,1), 0.);
    mouseDown = iMouse.z > 0.;
    
    Hit hit = raymarch(camPos, rayDirection);

    vec3 color = render(hit);
   	color = pow(color, vec3(1. / 2.2)); // Gamma
    fragColor = vec4(color,1);
}
`;

export default class implements iSub {
  key(): string {
    return 'MstcWs';
  }
  name(): string {
    return 'Helix Distance';
  }
  sort() {
    return 534;
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
