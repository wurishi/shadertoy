import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
//#define GIF_EXPORT
#ifdef GIF_EXPORT
	#define fTime mod(iTime / 4., 1.)
#else
	#define fTime (iTime / 24.)
#endif


/*

    '3D' Texture Utils
    ------------------

	These allow reading and writing to a cubemap texture that's
    repurposed as a 3D texture of one channel float values.

    The structure can be thought of as a stack of 1 voxel thick slices,
    where each slice is distributed throughout our 6 cubemap textures.

    The resolution of each slice is small enough that multiple slices
    can fit into one texture, like a sheet of postage stamps. As we only
    need to store a single float for each voxel, we can also distribute
    slices across the 4 rgba channels.

*/

vec2 texSubdivisions = vec2(8,2);

#define MIRROR
#define SCALE (vec3(4.1,1.73,1.75)/1.1)
#define OFFSET vec3(.95, .094, -.088)

// #define SCALE vec3(1)
// #define OFFSET vec3(0)

// Cubemap face ID from direction (normal)
// 0 x
// 1 y
// 2 z
// 3 -x
// 4 -y
// 5 -z
int faceIdFromDir(vec3 v) {
    vec3 va = abs(v);
    int id = 0;
    float m = va.x;
    if (va.y > m) id = 1, m = va.y;
    if (va.z > m) id = 2;
    if (v[id] < 0.) id += 3;
    return id;
}


// Direction from uv and cube face ID
// uv : vec2(0,0) to vec2(1,1)
// id : 0 to 5

vec3 dirFromFaceId(vec2 uv, int id) {
    vec3 dir = vec3(.5, .5 - uv.yx);
    dir = normalize(dir);
    if (id == 4) dir.yz *= -1.;
    if (id > 2) dir.xz *= -1., id -= 3;
    if (id == 1) return (dir * vec3(1,-1,-1)).zxy;
    if (id == 2) return (dir * vec3(1,1,-1)).zyx;    
    return dir;
}


// Assign a 3D position to a texture coordinate and channel

// xy is split for each z slice, and further slices
// are split across channels and cube map faces

// Divide texture into 3d space coordinates
// uv : 2d texture coordinates vec2(0) - vec2(1)
// c : rgba channel 0 - 3
// id : cubemap face id 0 - 6
// size : cubemap resolution

vec3 texToSpace(vec2 coord, int c, int id, vec2 size) {
    vec2 sub = texSubdivisions;
    vec2 subSize = floor(size / sub);
    vec2 subCoord = floor(coord / subSize);
    float z = 0.;
    z += float(id) * 4. * sub.y * sub.x; // face offset
    z += float(c) * sub.y * sub.x; // channel offset
    z += subCoord.y * sub.x; // y offset
    z += subCoord.x; // x offset
    float zRange = sub.x * sub.y * 4. * 6. - 1.;
    z /= zRange;
    vec2 subUv = mod(coord / subSize, 1.);
    vec3 p = vec3(subUv, z);
    p = p * 2. - 1.; // range -1:1
    return p;
}


// As above, but returns four 3D positions,
// ready for use when writing to each rgba channel.

// See mainCubemap in the Cube A tab

mat4 texToSpace(vec2 coord, int id, vec2 size) {
    return mat4(
        vec4(texToSpace(coord, 0, id, size), 0),
        vec4(texToSpace(coord, 1, id, size), 0),
        vec4(texToSpace(coord, 2, id, size), 0),
        vec4(texToSpace(coord, 3, id, size), 0)
    );
}


// Transform 3D position into it's corresponding cubemap texture
// ray direction (normal) and channel, so we can lookup its
// stored value

// p : 3D position in range vec2(-1) to vec2(1)
// size : cubemap texture resolution

// This is the inverse of texToSpace

vec4 spaceToTex(vec3 p, vec2 size) {
    p = clamp(p, -1., 1.);
    p = p * .5 + .5; // range 0:1

    vec2 sub = texSubdivisions;
    vec2 subSize = floor(size / sub);

    // Work out the z index
    float zRange = sub.x * sub.y * 4. * 6. - 1.;
    float i = round(p.z * zRange);

    // return vec3(mod(i, sub.x)/sub.x);
    // translate uv into the micro offset in the z block
    vec2 coord = p.xy * subSize;

    int faceId = int(floor(i / (4. * sub.y * sub.x)));
    float channel = mod(floor(i / (sub.x * sub.y)), 4.);
    float y = mod(floor(i / sub.x), sub.y);
    float x = mod(i, sub.x);
    
    // Work out the macro offset for the xy block from the z block
    coord += vec2(x,y) * subSize;
	coord /= size;
    
    vec3 dir = dirFromFaceId(coord, faceId);

    return vec4(dir, channel);
}


float range(float vmin, float vmax, float value) {
  return clamp((value - vmin) / (vmax - vmin), 0., 1.);
}


// Lookup value from the '3D' texture

// See mHead in the Image tab

float mapTex(samplerCube tex, vec3 p, vec2 size) {
    // stop x bleeding into the next cell as it's the mirror cut
    #ifdef MIRROR
        p.x = clamp(p.x, -.95, .95);
    #endif
    vec2 sub = texSubdivisions;
    float zRange = sub.x * sub.y * 4. * 6. - 1.;
    float z = p.z * .5 + .5; // range 0:1
    float zFloor = (floor(z * zRange) / zRange) * 2. - 1.;
    float zCeil = (ceil(z * zRange) / zRange) * 2. - 1.;
    vec4 uvcA = spaceToTex(vec3(p.xy, zFloor), size);
    vec4 uvcB = spaceToTex(vec3(p.xy, zCeil), size);
    float a = texture(tex, uvcA.xyz)[int(uvcA.w)];
    float b = texture(tex, uvcB.xyz)[int(uvcB.w)];
    return mix(a, b, range(zFloor, zCeil, p.z));
}
`;

const buffA = `
/*

    FBM Domain Warp Texture
    -----------------------

	Based on "bp Turbulence" by blackpolygon https://shadertoy.com/view/Ml3SRf

	I've picked a nice looking area of the texture for the default loop,
    if you get bored of that, press 'l' and it'll show more variation.

*/


#define PI 3.14159265359
#define TWO_PI 6.28318530718

float random (in vec2 _st) { 
    #ifdef GIF_EXPORT
    	return fract(sin(dot(_st.xy, vec2(12.9898,78.233))) * 43758.54531237);
   	#endif
    return texture(iChannel0, _st / iChannelResolution[0].xy).r;
}

// Based on Morgan McGuire @morgan3d
// https://www.shadertoy.com/view/4dS3Wd
float noise (in vec2 _st) {
    vec2 i = floor(_st);
    vec2 f = fract(_st);

    // Four corners in 2D of a tile
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    vec2 u = f * f * (3. - 2.0 * f);

    return mix(a, b, u.x) + 
            (c - a)* u.y * (1. - u.x) + 
            (d - b) * u.x * u.y;
}

#define NUM_OCTAVES 9

float fbm ( in vec2 _st) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(20.0);
    // Rotate to reduce axial bias
    mat2 rot = mat2(cos(0.5), sin(0.5), 
                    -sin(0.5), cos(0.50));
    for (int i = 0; i < NUM_OCTAVES; ++i) {
        v += a * noise(_st);
        _st = rot * _st * 2.2 + shift;
        a *= 0.5;
    }
    return v;
}

const int KEY_L = 76;

vec3 pattern(vec2 st) {
    
    #ifdef GIF_EXPORT
        st = st.yx * .42;
    	st.x -= .015;
        st += vec2(9.24,9.-.07);
   	#else
        st *= .3;
        st += vec2(-6.7,4.7);// + ((iMouse.xy / iResolution.xy) - .5) * -1.5;
   	#endif
    
    vec3 color = vec3(0.);
    vec2 a = vec2(0.);
    vec2 b = vec2(0.);
    vec2 c = vec2(60.,800.);
    
    a.x = fbm( st);
    a.y = fbm( st + vec2(1.0));
    
    b.x = fbm( st + 4.*a);
    b.y = fbm( st);

    #ifdef GIF_EXPORT
    	c.x = fbm( sin(mod(st + 7.0 * b + fTime, 1.) * PI * 2.)*.3 );
    	c.y = fbm( sin(mod(st + 3.944 * b + fTime, 1.) * PI * 2.)*.3 );
   	#else
        bool loop = ! bool(texelFetch( iChannel1, ivec2(KEY_L,2),0 ).x);
        if (loop) {
            c.x = fbm( sin(mod(st + 7.0 * b + fTime, 1.) * PI * 2.) );
            c.y = fbm( sin(mod(st + 3.944 * b + fTime, 1.) * PI * 2.) );
        } else {
            c.x = fbm( st + 7.0 * b + fTime * 2. );
            c.y = fbm( st + 3.944 * b + fTime );
        }
   	#endif

    float f = fbm(st+b+c);

    f *= 1.3;
    f = pow(f, 3.)*1.9;
    
    color = mix(vec3(0.445,0.002,0.419), vec3(1.000,0.467,0.174), clamp((f*f),0.2, 1.0));
    color = mix(color, vec3(0.413,0.524,0.880), clamp(length(c.x),0.480, 0.92));
    color *= f * 1.9;
    return color;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 ir = iResolution.xy;
    vec2 p = (fragCoord.xy - 0.5*ir.xy )/min(ir.x,ir.y);
    p.x /= (ir.x/ir.y) / (640./360.);
    fragColor = vec4(pattern(p), 1.);
}
`;

const cubeA = `
/*

    Head SDF
    --------

	This gets written into a "3D" texture using the utilities in Common.
	
	For other appearances see:

    * https://www.shadertoy.com/view/wlf3WX
	* https://www.shadertoy.com/view/wtf3RM

*/

#define PI 3.14159265359

void pR(inout vec2 p, float a) {
    p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

vec2 pRi(vec2 p, float a) {
    pR(p, a);
    return p;
}

#define saturate(x) clamp(x, 0., 1.)

float vmax(vec2 v) {
    return max(v.x, v.y);
}

float vmax(vec3 v) {
    return max(max(v.x, v.y), v.z);
}

float vmin(vec3 v) {
    return min(min(v.x, v.y), v.z);
}

float vmin(vec2 v) {
    return min(v.x, v.y);
}

float fBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, vec3(0))) + vmax(min(d, vec3(0)));
}

float fCorner2(vec2 p) {
    return length(max(p, vec2(0))) + vmax(min(p, vec2(0)));
}

float fDisc(vec3 p, float r) {
    float l = length(p.xz) - r;
    return l < 0. ? abs(p.y) : length(vec2(p.y, l));
}


float fHalfCapsule(vec3 p, float r) {
    return mix(length(p.xz) - r, length(p) - r, step(0., p.y));
}


// IQ https://www.shadertoy.com/view/Xds3zN
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

float smin2(float a, float b, float r) {
    vec2 u = max(vec2(r - a,r - b), vec2(0));
    return max(r, min (a, b)) - length(u);
}

float smax2(float a, float b, float r) {
    vec2 u = max(vec2(r + a,r + b), vec2(0));
    return min(-r, max (a, b)) + length(u);
}

float smin(float a, float b, float k){
    float f = clamp(0.5 + 0.5 * ((a - b) / k), 0., 1.);
    return (1. - f) * a + f  * b - f * (1. - f) * k;
}

float smax(float a, float b, float k) {
    return -smin(-a, -b, k);
}

float smin3(float a, float b, float k){
    return min(
        smin(a, b, k),
        smin2(a, b, k)
    );
}

float smax3(float a, float b, float k){
    return max(
        smax(a, b, k),
        smax2(a, b, k)
    );
}


// Modelling

float ellip(vec3 p, vec3 s) {
    float r = vmin(s);
    p *= r / s;
    return length(p) - r;
}

float ellip(vec2 p, vec2 s) {
    float r = vmin(s);
    p *= r / s;
    return length(p) - r;
}

float helix(vec3 p, float lead, float thick) {
    // p.z += iTime * .1;
    float d = (mod(atan(p.y, p.x) - p.z * lead, PI * 2.) - PI) / lead;
    d = abs(d) - thick;
    return d;
}

void fMouth(inout float d, vec3 pp) {
    vec3 p;
    // mouth base
    p = pp;
    p += vec3(-.0,.29,-.29);
    pR(p.yz, -.3);
    d = smin(d, ellip(p, vec3(.13,.15,.1)), .18);

    p = pp;
    p += vec3(0,.37,-.4);
    d = smin(d, ellip(p, vec3(.03,.03,.02) * .5), .1);

    p = pp;
    p += vec3(-.09,.37,-.31);
    d = smin(d, ellip(p, vec3(.04)), .18);

    // bottom lip
    p = pp;
    p += vec3(0,.455,-.455);
    p.z += smoothstep(.0, .2, p.x) * .05;
    float lb = mix(.035, .03, smoothstep(.05, .15, length(p)));
    vec3 ls = vec3(.055,.028,.022) * 1.25;
    float w = .192;
    vec2 pl2 = vec2(p.x, length(p.yz * vec2(.79,1)));
    float bottomlip = length(pl2 + vec2(0,w-ls.z)) - w;
    bottomlip = smax(bottomlip, length(pl2 - vec2(0,w-ls.z)) - w, .055);
    d = smin(d, bottomlip, lb);
    
    // top lip
    p = pp;
    p += vec3(0,.38,-.45);
    pR(p.xz, -.3);
    ls = vec3(.065,.03,.05);
    w = ls.x * (-log(ls.y/ls.x) + 1.);
    vec3 pl = p * vec3(.78,1,1);
    float toplip = length(pl + vec3(0,w-ls.y,0)) - w;
    toplip = smax(toplip, length(pl - vec3(0,w-ls.y,0)) - w, .065);
    p = pp;
    p += vec3(0,.33,-.45);
    pR(p.yz, .7);
    float cut;
    cut = dot(p, normalize(vec3(.5,.25,0))) - .056;
    float dip = smin(
        dot(p, normalize(vec3(-.5,.5,0))) + .005,
        dot(p, normalize(vec3(.5,.5,0))) + .005,
        .025
    );
    cut = smax(cut, dip, .04);
    cut = smax(cut, p.x - .1, .05);
    toplip = smax(toplip, cut, .02);

    d = smin(d, toplip, .07);


    // seam
    p = pp;
    p += vec3(0,.425,-.44);
    lb = length(p);
    float lr = mix(.04, .02, smoothstep(.05, .12, lb));
    pR(p.yz, .1);
    p.y -= smoothstep(0., .03, p.x) * .002;
    p.y += smoothstep(.03, .1, p.x) * .007;
    p.z -= .133;
    float seam = fDisc(p, .2);
    seam = smax(seam, -d - .015, .01); // fix inside shape
    d = mix(d, smax(d, -seam, lr), .65);

}

bool isMap = true;
bool isEye = false;

float mHead(vec3 p) {

    pR(p.yz, -.1);
    //p.y -= .13;

    vec3 pa = p;
    p.x = abs(p.x);
    vec3 pp = p;

    float d = 1e12;

    // skull back
    p += vec3(0,-.135,.09);
    d = ellip(p, vec3(.395, .385, .395));

    // skull base
    p = pp;
    p += vec3(0,-.135,.09) + vec3(0,.1,.07);
    d = smin(d, ellip(p, vec3(.38, .36, .35)), .05);

    // forehead
    p = pp;
    p += vec3(0,-.145,-.175);
    d = smin(d, ellip(p, vec3(.315, .3, .33)), .18);

    p = pp;
    pR(p.yz, -.5);
    float bb = fBox(p, vec3(.5,.67,.7));
    d = smax(d, bb, .2);

    // face base
    p = pp;
    p += vec3(0,.25,-.13);
    d = smin(d, length(p) - .28, .1);

    // behind ear
    p = pp;
    p += vec3(-.15,.13,.06);
    d = smin(d, ellip(p, vec3(.15,.15,.15)), .15);

    p = pp;
    p += vec3(-.07,.18,.1);
    d = smin(d, length(p) - .2, .18);

    // cheek base
    p = pp;
    p += vec3(-.2,.12,-.14);
    d = smin(d, ellip(p, vec3(.15,.22,.2) * .8), .15);

    // jaw base
    p = pp;
    p += vec3(0,.475,-.16);
    pR(p.yz, .8);
    d = smin(d, ellip(p, vec3(.19,.1,.2)), .1);

    // brow
    p = pp;
    p += vec3(0,-.0,-.18);
    vec3 bp = p;
    float brow = fHalfCapsule(p * vec3(.65,1,.9), .27);
    brow = length(p) - .36;
    p.x -= .37;
    brow = smax(brow, dot(p, normalize(vec3(1,.2,-.2))), .2);
    p = bp;
    brow = smax(brow, dot(p, normalize(vec3(0,.6,1))) - .43, .25);
    p = bp;
    pR(p.yz, -.5);
    float peak = -p.y - .165;
    peak += smoothstep(.0, .2, p.x) * .01;
    peak -= smoothstep(.12, .29, p.x) * .025;
    brow = smax(brow, peak, .07);
    p = bp;
    pR(p.yz, .5);
    brow = smax(brow, -p.y - .06, .15);
    d = smin(d, brow, .06);

    // nose
    p = pp;
    p += vec3(0,.03,-.45);
    pR(p.yz, 3.);
    d = smin(d, sdRoundCone(p, .008, .05, .18), .1);

    p = pp;
    p += vec3(0,.06,-.47);
    pR(p.yz, 2.77);
    d = smin(d, sdRoundCone(p, .005, .04, .225), .05);

    // jaw

    p = pp;
    vec3 jo = vec3(-.25,.4,-.07);
    p = pp + jo;
    float jaw = dot(p, normalize(vec3(1,-.2,-.05))) - .069;
    jaw = smax(jaw, dot(p, normalize(vec3(.5,-.25,.35))) - .13, .12);
    jaw = smax(jaw, dot(p, normalize(vec3(-.0,-1.,-.8))) - .12, .15);
    jaw = smax(jaw, dot(p, normalize(vec3(.98,-1.,.15))) - .13, .08);
    jaw = smax(jaw, dot(p, normalize(vec3(.6,-.2,-.45))) - .19, .15);
    jaw = smax(jaw, dot(p, normalize(vec3(.5,.1,-.5))) - .26, .15);
    jaw = smax(jaw, dot(p, normalize(vec3(1,.2,-.3))) - .22, .15);

    p = pp;
    p += vec3(0,.63,-.2);
    pR(p.yz, .15);
    float cr = .5;
    jaw = smax(jaw, length(p.xy - vec2(0,cr)) - cr, .05);

    p = pp + jo;
    jaw = smax(jaw, dot(p, normalize(vec3(0,-.4,1))) - .35, .1);
    jaw = smax(jaw, dot(p, normalize(vec3(0,1.5,2))) - .3, .2);
    jaw = max(jaw, length(pp + vec3(0,.6,-.3)) - .7);

    p = pa;
    p += vec3(.2,.5,-.1);
    float jb = length(p);
    jb = smoothstep(.0, .4, jb);
    float js = mix(0., -.005, jb);
    jb = mix(.01, .04, jb);

    d = smin(d, jaw - js, jb);

    // chin
    p = pp;
    p += vec3(0,.585,-.395);
    p.x *= .7;
    d = smin(d, ellip(p, vec3(.028,.028,.028)*1.2), .15);

    // return d;

    // cheek

    p = pp;
    p += vec3(-.2,.2,-.28);
    pR(p.xz, .5);
    pR(p.yz, .4);
    float ch = ellip(p, vec3(.1,.1,.12)*1.05);
    d = smin(d, ch, .1);

    p = pp;
    p += vec3(-.26,.02,-.1);
    pR(p.xz, .13);
    pR(p.yz, .5);
    float temple = ellip(p, vec3(.1,.1,.15));
    temple = smax(temple, p.x - .07, .1);
    d = smin(d, temple, .1);

    p = pp;
    p += vec3(.0,.2,-.32);
    ch = ellip(p, vec3(.1,.08,.1));
    d = smin(d, ch, .1);

    p = pp;
    p += vec3(-.17,.31,-.17);
    ch = ellip(p, vec3(.1));
    d = smin(d, ch, .1);

    fMouth(d, pp);

    // nostrils base
    p = pp;
    p += vec3(0,.3,-.43);
    d = smin(d, length(p) - .05, .07);

    // nostrils
    p = pp;
    p += vec3(0,.27,-.52);
    pR(p.yz, .2);
    float nostrils = ellip(p, vec3(.055,.05,.06));

    p = pp;
    p += vec3(-.043,.28,-.48);
    pR(p.xy, .15);
    p.z *= .8;
    nostrils = smin(nostrils, sdRoundCone(p, .042, .0, .12), .02);

    d = smin(d, nostrils, .02);

    p = pp;
    p += vec3(-.033,.3,-.515);
    pR(p.xz, .5);
    d = smax(d, -ellip(p, vec3(.011,.03,.025)), .015);

    // return d;

    // eyelids
    p = pp;
    p += vec3(-.16,.07,-.34);
    float eyelids = ellip(p, vec3(.08,.1,.1));

    p = pp;
    p += vec3(-.16,.09,-.35);
    float eyelids2 = ellip(p, vec3(.09,.1,.07));

    // edge top
    p = pp;
    p += vec3(-.173,.148,-.43);
    p.x *= .97;
    float et = length(p.xy) - .09;

    // edge bottom
    p = pp;
    p += vec3(-.168,.105,-.43);
    p.x *= .9;
    float eb = dot(p, normalize(vec3(-.1,-1,-.2))) + .001;
    eb = smin(eb, dot(p, normalize(vec3(-.3,-1,0))) - .006, .01);
    eb = smax(eb, dot(p, normalize(vec3(.5,-1,-.5))) - .018, .05);

    float edge = max(max(eb, et), -d);

    d = smin(d, eyelids, .01);
    d = smin(d, eyelids2, .03);
    d = smax(d, -edge, .005);

    // eyeball
    p = pp;
    p += vec3(-.165,.0715,-.346);
    float eyeball = length(p) - .088;
    if (isMap) isEye = eyeball < d;
    d = min(d, eyeball);

    // tear duct
    p = pp;
    p += vec3(-.075,.1,-.37);
    d = min(d, length(p) - .05);

    
 	// ear
    p = pp;
    p += vec3(-.405,.12,.10);
    pR(p.xy, -.12);
    pR(p.xz, .35);
    pR(p.yz, -.3);
    vec3 pe = p;

    // base
    float ear = p.s + smoothstep(-.05, .1, p.y) * .015 - .005;
    float earback = -ear - mix(.001, .025, smoothstep(.3, -.2, p.y));

    // inner
    pR(p.xz, -.5);
    float iear = ellip(p.zy - vec2(.01,-.03), vec2(.045,.05));
    iear = smin(iear, length(p.zy - vec2(.04,-.09)) - .02, .09);
    float ridge = iear;
    iear = smin(iear, length(p.zy - vec2(.1,-.03)) - .06, .07);
    ear = smax2(ear, -iear, .04);
    earback = smin(earback, iear - .04, .02);

    // ridge
    p = pe;
    pR(p.xz, .2);
    ridge = ellip(p.zy - vec2(.01,-.03), vec2(.045,.055));
    ridge = smin3(ridge, -pRi(p.zy, .2).x - .01, .015);
    ridge = smax3(ridge, -ellip(p.zy - vec2(-.01,.1), vec2(.12,.08)), .02);

    float ridger = .01;

    ridge = max(-ridge, ridge - ridger);

    ridge = smax2(ridge, abs(p.x) - ridger/2., ridger/2.);

    ear = smin(ear, ridge, .045);

    p = pe;

    // outline
    float outline = ellip(pRi(p.yz, .2), vec2(.12,.09));
    outline = smin(outline, ellip(p.yz + vec2(.155,-.02), vec2(.035, .03)), .14);

    // edge
    float eedge = p.x + smoothstep(.2, -.4, p.y) * .06 - .03;

    float edgeo = ellip(pRi(p.yz, .1), vec2(.095,.065));
    edgeo = smin(edgeo, length(p.zy - vec2(0,-.1)) - .03, .1);
    float edgeoin = smax(abs(pRi(p.zy, .15).y + .035) - .01, -p.z-.01, .01);
    edgeo = smax(edgeo, -edgeoin, .05);

    float eedent = smoothstep(-.05, .05, -p.z) * smoothstep(.06, 0., fCorner2(vec2(-p.z, p.y)));
    eedent += smoothstep(.1, -.1, -p.z) * .2;
    eedent += smoothstep(.1, -.1, p.y) * smoothstep(-.03, .0, p.z) * .3;
    eedent = min(eedent, 1.);

    eedge += eedent * .06;

    eedge = smax(eedge, -edgeo, .01);
    ear = smin(ear, eedge, .01);
    ear = max(ear, earback);

    ear = smax2(ear, outline, .015);

    d = smin(d, ear, .015);

    // hole
    p = pp;
    p += vec3(-.36,.19,.06);
    pR(p.xz, -.5);
    pR(p.xy, -.2);
    p.x += .02;

    // targus
    p = pp;
    p += vec3(-.34,.2,.02);
    d = smin2(d, ellip(p, vec3(.015,.025,.015)), .035);
    p = pp;
    p += vec3(-.37,.18,.03);
    pR(p.xz, .5);
    pR(p.yz, -.4);
    d = smin(d, ellip(p, vec3(.01,.03,.015)), .015);
    
    return d;
}

float map(vec3 p) {
    p -= OFFSET;
    p /= SCALE;
   	return mHead(p);
	return length(p) - .3;
}

void mainCubemap( out vec4 fragColor, in vec2 fragCoord, in vec3 rayOri, in vec3 rayDir )
{
    
    int id = faceIdFromDir(rayDir);
    
    vec2 coord = fragCoord.xy;
    vec2 size = iResolution.xy;
    vec2 uv = coord / size;
    
    vec4 lastFrame = texture(iChannel0, rayDir);
    if (lastFrame.x != 0. && iFrame > 2) {
        fragColor = lastFrame;
    	return;
    }
    
    mat4 space = texToSpace(coord, id, size);
    
    vec3 p0 = space[0].xyz;
    vec3 p1 = space[1].xyz;
    vec3 p2 = space[2].xyz;
    vec3 p3 = space[3].xyz;

    fragColor = vec4(
        map(p0),
        map(p1),
        map(p2),
        map(p3)
    );
}`;

const fragment = `
/*

    Copper / Flesh
    --------------

    Press 'f' for the gory flesh version.
	Press 'l' to disable the texture loop.
	Mouse click for a closeup.

	I was introduced to volume displacement a few weeks ago, which works
    wonderfully for ray marched SDFs:

	https://docs.arnoldrenderer.com/display/A5AFMUG/Polymesh+to+Volume

	An FBM domain warp texture is created in Buffer A, and used to adjust
    the surface distance while marching.

	The model is quite slow to march, so I've stored it in a 3D texture.
	Shadertoy doesn't support writing to 3D textures, so I've used the
    cubemap feature, and subdivided the 6 2D textures to get another
    dimension.

*/

bool FLESH = false;

#define PI 3.14159265359

void pR(inout vec2 p, float a) {
    p = cos(a)*p + sin(a)*vec2(p.y, -p.x);
}

float vmax(vec3 v) {
    return max(max(v.x, v.y), v.z);
}

float fBox(vec3 p, vec3 b) {
    vec3 d = abs(p) - b;
    return length(max(d, vec3(0))) + vmax(min(d, vec3(0)));
}

bool isMapPass = false;
bool isBound = false;

// Read head sdf from '3D' texture
float mHead(vec3 p) {
    p.x = -abs(p.x);
    p += OFFSET / SCALE;
    if (isMapPass) {
    	float bound = fBox(p, 1./SCALE);
        isBound = bound > .01;
    	if (isBound) return bound;
    }
    p *= SCALE;
    return 0.;
    // float d = mapTex(iChannel0, p, iChannelResolution[0].xy);
    // return d;
}

float g_disp;

vec3 projectOnPlane(vec3 v, vec3 n) {
	float scalar = dot(n, v) / length(n);
	vec3 v1 = n * scalar;
	return v - v1;
}

// Wrap the fbm texture around the model, focus on getting as
// much detail as possible on the visible parts.
// Triplanar mapping would be worth trying here.
float calcDisplacement(vec3 p) {
    float disp;
    vec2 uv;
    p.y += .1;
    
    vec3 focus = vec3(.0,.1,1.);
    vec3 center = -focus * .7;
    vec3 up = vec3(0,1,0);
    vec2 rad = vec2(PI/1.25,PI/2.5)/1.5;
    
    center *= length(p);
    
    p = normalize(p - center);
    focus = normalize(focus - center);
    
    vec3 yPlane = cross(focus, up);
    vec3 xPlane = cross(focus, yPlane);
    
    vec3 xp = normalize(projectOnPlane(p, xPlane));
    vec3 yp = normalize(projectOnPlane(p, yPlane));
	
    float xa = acos(dot(focus, xp)) * sign(dot(p, yPlane));
    float ya = acos(dot(focus, yp)) * sign(dot(p, xPlane));
        
    uv = .5 - (vec2(xa, ya) / rad / 2.);

    vec4 tex = texture(iChannel2, uv);
    disp = tex.r;
    disp = disp * 3. - 1.3;
    disp = smoothstep(-.5, 5., disp) * 10.;
	disp *= .3;
  	
    if (isMapPass) {
        g_disp = disp;
    }
   
    // create slight ridges around the edges of holes
    // I can't decide if I like this
 	disp = abs(disp - .1) - .1;

    return disp;
}

float map(vec3 p) {
    p.y -= .14;
    #ifndef GIF_EXPORT
        pR(p.xz, sin(4. * fTime * PI * .5) * .05);
        pR(p.zy, sin(4. * fTime * PI * 2.) * .03 + .05);
        if (iMouse.x > 0. && iMouse.y > 0.) {
            pR(p.zx, ((iMouse.x/iResolution.x)*2.-1.)*.5);
            pR(p.zy, ((iMouse.y/iResolution.y)*2.-1.)*.5);
        }
   	#else
    	pR(p.zy, .05);
   	#endif
    float d = mHead(p);
    if (d < .1 && ! isBound) {
        float ds = calcDisplacement(p);
        d += ds * .03;
    }
    return d;
}


const int NORMAL_STEPS = 6;
vec3 calcNormal(vec3 pos){
    vec3 eps = vec3(.0005,0,0);
    vec3 nor = vec3(0);
    float invert = 1.;
    vec3 npos;
    for (int i = 0; i < NORMAL_STEPS; i++){
        npos = pos + eps * invert;
        nor += map(npos) * eps * invert;
        eps = eps.zxy;
        invert *= -1.;
    }
    return normalize(nor);
}

// https://www.shadertoy.com/view/lsKcDD
float softshadow( in vec3 ro, in vec3 rd, in float mint, in float tmax )
{
    float res = 1.0;
    float t = mint;
    float ph = 1e10;
    
    for( int i=0; i<32; i++ )
    {
        float h = map( ro + rd*t );
        res = min( res, 10.0*h/t );
        t += h;
        if( res<0.0001 || t>tmax ) break;
        
    }
    return clamp( res, 0.0, 1.0 );
}

// https://www.shadertoy.com/view/Xds3zN
float calcAO( in vec3 pos, in vec3 nor )
{
    float occ = 0.0;
    float sca = 1.0;
    for( int i=0; i<5; i++ )
    {
        float hr = 0.01 + 0.12*float(i)/4.0;
        vec3 aopos =  nor * hr + pos;
        float dd = map( aopos );
        occ += -(dd-hr)*sca;
        sca *= 0.95;
    }
    return clamp( 1.0 - 3.0*occ, 0.0, 1.0 );    
}

mat3 calcLookAtMatrix( in vec3 ro, in vec3 ta, in float roll )
{
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(sin(roll),cos(roll),0.0) ) );
    vec3 vv = normalize( cross(uu,ww));
    return mat3( uu, vv, ww );
}

const int KEY_F = 70;

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    vec2 p = (-iResolution.xy + 2. * fragCoord.xy) / iResolution.y;
    
    //fragColor = texture(iChannel2,fragCoord / iResolution.xy); return;
    
    vec3 col;

    vec2 bguv = p + (texture(iChannel2, fragCoord / iResolution.xy).rb* 2. - 1.);
    
    float delay = 10. * 1.5;
    //FLESH = dot(p, vec2(.5)) > sin(clamp(abs(mod(iTime * 1.5, delay * 2.) - delay) - (delay - 1.) / 2., 0., 1.) * PI * .5) * 3. - 1.5;
    FLESH = bool(texelFetch( iChannel3, ivec2(KEY_F,2),0 ).x);
    if (FLESH) {
    	col = vec3(0);
    } else {
        #ifndef GIF_EXPORT
    		col = mix(vec3(.05,.2,.2), vec3(.1,.12,.11), range(2., 1., length(bguv - vec2(1,0))));
    		col = mix(col, vec3(.7,.4,.28) * .7, range(4., 1., length(bguv - vec2(-1,3))));
       	#else
        	col = vec3(.05,.2,.2);
        #endif
    }
    
    if (iMouse.z > 0. && iMouse.w > 0.) {
    	p /= 1.8;
    }

    p /= 1.15;

    vec3 camPos = vec3(0,.05,3.2);
    vec3 rayDirection = normalize(vec3(p + vec2(0,-0),-4));        
    vec3 rayPosition = camPos;
    float rayLength = 0.;
    float dist = 0.;
    bool bg = false;

    isMapPass = true;

    for (int i = 0; i < 600; i++) {
        rayLength += dist * .5;
        
        rayPosition = camPos + rayDirection * rayLength;
        dist = map(rayPosition);

        if (abs(dist) < .0001) {
        	break;
        }
        
        if (rayLength > 5.) {
            bg = true;
            break;
        }
    }

    isMapPass = false;    
            
    if ( ! bg) {
        vec3 pos = rayPosition;
        vec3 rd = rayDirection;
        vec3 nor = calcNormal(rayPosition);
        vec3 ref = reflect(rd, nor);
        vec3 up = normalize(vec3(1));

        // lighitng
        // IQ - Raymarching - Primitives 
        // https://www.shadertoy.com/view/Xds3zN
        float hole = range(4., 1., g_disp);
        float occ = calcAO( pos, nor ) * mix(.5, 1., hole);
		vec3  lig = normalize( vec3(-.5, 1., .5) );
        vec3  lba = normalize( vec3(.5, -1., -.5) );
        vec3  hal = normalize( lig-rd );
		float amb = sqrt(clamp( 0.5+0.5*nor.y, 0.0, 1.0 ));
        float dif = clamp( dot( nor, lig ), 0.0, 1.0 );
        float bac = clamp( dot( nor, lba ), 0.0, 1.0 )*clamp( 1.0-pos.y,0.0,1.0);
        float fre = pow( clamp(1.0+dot(nor,rd),0.0,1.0), 2.0 );
        
        dif *= softshadow( pos, lig, 0.01, .5 ) * hole;

		float spe = pow( clamp( dot( nor, hal ), 0.0, 1.0 ),16.0)*
                    dif *
                    (0.04 + 0.96*pow( clamp(1.0+dot(hal,rd),0.0,1.0), 5.0 ));

		vec3 lin = vec3(0.0);
        lin += 2.80*dif*vec3(1.30,1.00,0.70);
        lin += 0.55*amb*vec3(0.40,0.60,1.15)*occ;
        lin += 1.55*bac*vec3(0.25,0.25,0.25)*occ;
        lin += 0.25*fre*vec3(1.00,1.00,1.00)*occ;
        if (FLESH) {
        	col = vec3(1, 0.8, 0.78) * .3;
        	col = mix(col, vec3(.4,.05,.03) * .5, range(.0, .15, g_disp));
        	col = mix(col, vec3(1,.0,.05) * .2, range(.2, .5, g_disp));
        	col = mix(col, vec3(.05,0,0), range(.4, .5, g_disp));
        } else {
			// col = pow(texture(iChannel1, ref).rgb, vec3(2.2)) * vec3(1,1,.9);
      col = pow(texture(iChannel1, ref.xy).rgb, vec3(2.2)) * vec3(1,1,.9);
        	col = mix(col, vec3(0,.3,.2), range(.02, .5, g_disp));
        	col = mix(col, vec3(0,.1,.12), range(.3, .5, g_disp));
        }
        col = col*lin;
		col += 5.00*spe*vec3(1.10,0.90,0.70);
    }

    #ifndef GIF_EXPORT
    	col *= range(1.5, .4, length(fragCoord.xy / iResolution.xy - .5));
   	#endif
    col = pow( col, vec3(0.4545) );
    fragColor = vec4(col,1);
}
`;

export default class implements iSub {
  key(): string {
    return 'WljSWz';
  }
  name(): string {
    return 'Copper / Flesh';
  }
  // sort() {
  //   return 0;
  // }
  tags?(): string[] {
    return [];
  }
  common() {
    return common;
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
      webglUtils.DEFAULT_NOISE, //
      webglUtils.DEFAULT_NOISE,
      {type:1,f:buffA,fi:2}
    ];
  }
}
