import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// SDF functions from mercury : http://mercury.sexy/hg_sdf/ //
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

#define saturate(x) clamp(x, 0.0, 1.0)
#define PI 3.14159265359

////////////////////////////////////////////////////////////////
//
//             PRIMITIVE DISTANCE FUNCTIONS
//
////////////////////////////////////////////////////////////////
//
// Conventions:
//
// Everything that is a distance function is called fSomething.
// The first argument is always a point in 2 or 3-space called <p>.
// Unless otherwise noted, (if the object has an intrinsic "up"
// side or direction) the y axis is "up" and the object is
// centered at the origin.
//
////////////////////////////////////////////////////////////////

float fSphere(vec3 p, float r)
{
    return length(p) - r;
}

// Capsule: A Cylinder with round caps on both sides
float fCapsule(vec3 p, float r, float c)
{
    return mix(length(p.xz) - r, length(vec3(p.x, abs(p.y) - c, p.z)) - r, step(c, abs(p.y)));
}

// Distance to line segment between <a> and <b>, used for fCapsule() version 2below
float fLineSegment(vec3 p, vec3 a, vec3 b)
{
    vec3  ab = b - a;
    float t  = saturate(dot(p - a, ab) / dot(ab, ab));
    return length((ab * t + a) - p);
}

// Capsule version 2: between two end points <a> and <b> with radius r
float fCapsule(vec3 p, vec3 a, vec3 b, float r)
{
    return fLineSegment(p, a, b) - r;
}

// Cone with correct distances to tip and base circle. Y is up, 0 is in the middle of the base.
float fCone(vec3 p, float radius, float height)
{
    vec2  q         = vec2(length(p.xz), p.y);
    vec2  tip       = q - vec2(0.0, height);
    vec2  mantleDir = normalize(vec2(height, radius));
    float mantle    = dot(tip, mantleDir);
    float d         = max(mantle, -q.y);
    float projected = dot(tip, vec2(mantleDir.y, -mantleDir.x));

    // distance to tip
    if((q.y > height) && (projected < 0.0))
    {
        d = max(d, length(tip));
    }

    // distance to base ring
    if((q.x > radius) && (projected > length(vec2(height, radius))))
    {
        d = max(d, length(q - vec2(radius, 0.0)));
    }
    return d;
}


////////////////////////////////////////////////////////////////
//
//                DOMAIN MANIPULATION OPERATORS
//
////////////////////////////////////////////////////////////////
//
// Conventions:
//
// Everything that modifies the domain is named pSomething.
//
// Many operate only on a subset of the three dimensions. For those,
// you must choose the dimensions that you want manipulated
// by supplying e.g. <p.x> or <p.zx>
//
// <inout p> is always the first argument and modified in place.
//
// Many of the operators partition space into cells. An identifier
// or cell index is returned, if possible. This return value is
// intended to be optionally used e.g. as a random seed to change
// parameters of the distance functions inside the cells.
//
// Unless stated otherwise, for cell index 0, <p> is unchanged and cells
// are centered on the origin so objects don't have to be moved to fit.
//
//
////////////////////////////////////////////////////////////////


// Rotate around a coordinate axis (i.e. in a plane perpendicular to that axis) by angle <a>.
// Read like this: R(p.xz, a) rotates "x towards z".
// This is fast if <a> is a compile-time constant and slower (but still practical) if not.
void pR(inout vec2 p, float a)
{
    p = cos(a) * p + sin(a) * vec2(p.y, -p.x);
}

// Repeat around the origin by a fixed angle.
// For easier use, num of repetitions is use to specify the angle.
float pModPolar(inout vec2 p, float repetitions)
{
    float angle = 2.0 * PI / repetitions;
    float a     = atan(p.y, p.x) + angle / 2.;
    float r     = length(p);
    float c     = floor(a / angle);
    a           = mod(a, angle) - angle / 2.;
    p           = vec2(cos(a), sin(a)) * r;
    // For an odd number of repetitions, fix cell index of the cell in -x direction
    // (cell index would be e.g. -5 and 5 in the two halves of the cell):
    if(abs(c) >= (repetitions / 2.0))
        c = abs(c);
    return c;
}

// Repeat in two dimensions
vec2 pMod2(inout vec2 p, vec2 size)
{
    vec2 c = floor((p + size * 0.5) / size);
    p      = mod(p + size * 0.5, size) - size * 0.5;
    return c;
}

// Repeat in three dimensions
vec3 pMod3(inout vec3 p, vec3 size)
{
    vec3 c = floor((p + size * 0.5) / size);
    p      = mod(p + size * 0.5, size) - size * 0.5;
    return c;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Intersectors and other things from IQ
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// http://iquilezles.org/www/articles/smin/smin.htm
float smin( float a, float b, float k )
{
    float h = max(k-abs(a-b),0.0);
    return min(a, b) - h*h*0.25/k;
}

// http://iquilezles.org/www/articles/smin/smin.htm
float smax( float a, float b, float k )
{
    float h = max(k-abs(a-b),0.0);
    return max(a, b) + h*h*0.25/k;
}


// vertical
float sdCone( in vec3 p, in vec3 c )
{
    vec2 q = vec2( length(p.xz), p.y );
    float d1 = -q.y-c.z;
    float d2 = max( dot(q,c.xy), q.y);
    return length(max(vec2(d1,d2),0.0)) + min(max(d1,d2), 0.);
}

float sdOctogon( in vec2 p, in float r )
{
    const vec3 k = vec3(-0.9238795325, 0.3826834323, 0.4142135623 );
    p = abs(p);
    p -= 2.0*min(dot(vec2( k.x,k.y),p),0.0)*vec2( k.x,k.y);
    p -= 2.0*min(dot(vec2(-k.x,k.y),p),0.0)*vec2(-k.x,k.y);
    p -= vec2(clamp(p.x, -k.z*r, k.z*r), r);
    return length(p)*sign(p.y);
}

// plane degined by p (p.xyz must be normalized)
float plaIntersect( in vec3 ro, in vec3 rd, in vec4 p )
{
    return -(dot(ro,p.xyz)+p.w)/dot(rd,p.xyz);
}

float sdTriangleIsosceles( in vec2 p, in vec2 q )
{
    p.x = abs(p.x);
    vec2 a = p - q*clamp( dot(p,q)/dot(q,q), 0.0, 1.0 );
    vec2 b = p - q*vec2( clamp( p.x/q.x, 0.0, 1.0 ), 1.0 );
    float s = -sign( q.y );
    vec2 d = min( vec2( dot(a,a), s*(p.x*q.y-p.y*q.x) ),
                  vec2( dot(b,b), s*(p.y-q.y)  ));
    return -sqrt(d.x)*sign(d.y);
}

float opExtrusion( in vec3 p, in float dist, in float h )
{
    vec2 w = vec2( dist, abs(p.z) - h );
    return min(max(w.x,w.y),0.0) + length(max(w,0.0));
}

//From https://www.iquilezles.org/www/articles/sphereshadow/sphereshadow.htm
float sphSoftShadow( in vec3 ro, in vec3 rd, in vec3 sph, in float ra, in float k )
{
    vec3 oc = ro - sph.xyz;
    float b = dot( oc, rd );
    float c = dot( oc, oc ) - ra*ra;
    float h = b*b - c;

    return (b>0.0) ? step(-0.0001,c) : smoothstep( -0.5, 0.5, h*k/b );
}

vec3 opCheapBend( in vec3 p, float bend )
{
    float k = bend;
    float c = cos(k*p.x);
    float s = sin(k*p.x);
    mat2  m = mat2(c,-s,s,c);
    vec3  q = vec3(m*p.xy,p.z);
    return q;
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Hashes from Dave Hopkins 
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// Hash without Sine
// Creative Commons Attribution-ShareAlike 4.0 International Public License
// Created by David Hoskins.

//----------------------------------------------------------------------------------------
//  1 out, 1 in...
float hash11(float p)
{
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
}

//----------------------------------------------------------------------------------------
//  1 out, 2 in...
float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

//----------------------------------------------------------------------------------------
//  1 out, 3 in...
float hash13(vec3 p3)
{
	p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}


//----------------------------------------------------------------------------------------
///  2 out, 2 in...
vec2 hash22(vec2 p)
{
	vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.xx+p3.yz)*p3.zy);

}

//----------------------------------------------------------------------------------------
///  3 out, 2 in...
vec3 hash32(vec2 p)
{
	vec3 p3 = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yxz+33.33);
    return fract((p3.xxy+p3.yzz)*p3.zyx);
}



/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Common Shader Code
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


#define NON_CONST_ZERO (min(iFrame,0)) 
#define NON_CONST_ZERO_U uint(min(iFrame,0)) 

const vec2 oz = vec2(1.0, 0.0);

const float kGoldenRatio = 1.618;
const float kGoldenRatioConjugate = 0.618;

const float kPI         = 3.14159265359;
const float kTwoPI      = 2.0 * kPI;

const float kMaxDist = 10000.;
const float kTimeScale = 1.0;

float kIsotropicScatteringPhase = (1.0 / (4.0 * kPI));

vec3 roughFresnel(vec3 f0, float cosA, float roughness)
{
    // Schlick approximation
    return f0 + (oz.xxx - f0) * (pow(1.0 - cosA, 5.0)) * (1.0 - roughness);
}

float linearstep(float start, float end, float x)
{
    float range = end - start;
    return saturate((x - start) / range);
}

float henyeyGreensteinPhase_schlick(float cosA, float g)
{
    float k = 1.55*g - 0.55*g*g*g;
    float f = 1.0 - k * cosA;
	return (1.0 - k * k) / (4.0 * kPI * f*f);
}

float henyeyGreensteinPhase(float cosA, float g)
{
    return henyeyGreensteinPhase_schlick(cosA, g);
	/*float g2 = g*g;
    return 1.0 / (4.0 * kPI) *
        ((1.0 - g2)/pow(1.0 + g2 - 2.0*g*cosA, 1.5));*/
}

float rayleighPhase(float rayDotSun)
{
    float k = (3.0 / 4.0) * kIsotropicScatteringPhase;
    return k * (1.0 + rayDotSun * rayDotSun);
}

float rbgToluminance(vec3 rgb)
{
    return (rgb.r * 0.3) + (rgb.g * 0.59) + (rgb.b * 0.11);
}

vec3 fixNormalBackFacingness(vec3 rayDirWS, vec3 normalWS)
{
    normalWS -= max(0.0, dot(normalWS, rayDirWS)) * rayDirWS;
    return normalWS;
}

//This is NOT a good way of converting from wavelgnth to RGB
vec3 wavelengthToRGB(float wavelength)
{
    const float kLambdaR = 680.0;
    const float kLambdaG = 550.0;
    const float kLambdaB = 440.0;
    
    vec3 colour = oz.xxx - saturate(vec3(abs(wavelength-kLambdaR), abs(wavelength-kLambdaG), abs(wavelength-kLambdaB))/150.0);
	return colour;  
}


#define USE_SPHERE 0
#define USE_TUBE 0
#define USE_SKY 1
#define USE_ATM 1
#define USE_SUN 1


const float kSunRadius = 1.0/180.0*kPI;
const float kCosSunRadius = cos(kSunRadius);
const float kTanSunRadius = tan(kSunRadius);
const float kSunDiskSolidAngle = 2.0*kPI*(1.0 - kCosSunRadius);

const float kAtmDensity = 1.0;

const vec3 kRayleighScatteringCoefsKm = vec3(5.8e-3, 1.35e-2, 3.31e-2) * kAtmDensity;
const float kRayleighAtmHeightKm = 8.0;

const float kMieAtmHeightKm = 1.2;
const float kMieScatteringCoefsKm = 0.0075 * kAtmDensity * 2.0;

const float kEarthRadiusKm = 6000.0;

const float kMultipleScatteringFakery = 0.5;


vec3 s_dirToSunWS = normalize(vec3(0.4, -0.01, 0.5));
vec3 s_sunColour = oz.yyy;
vec3 s_cloudSunColour = oz.yyy;
vec3 s_sunRadiance  = oz.yyy;
vec3 s_averageSkyColour = oz.yyy;
float s_timeOfDay = 0.0f;
float s_time = 0.0f;
float s_earthRotationRad = 0.0f;
vec3 s_eyePositionWS = oz.xxx;


/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Shared SDF
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const float kMatMapleLeaf = 0.0;
const float kMatFallingMapleLeaf = 1.0;
const float kMatMapleBark = 2.0;
const float kMatGrass = 3.0;
const float kMatMountains = 4.0;
const float kMatPines = 5.0;

const uint kRenderFilter = 0u;
const uint kShadowMapFilter = 1u;

const vec3 kWindVelocityWS = -oz.xyy * 0.75;

const vec3 kTreePosWS = vec3(0.0, 0.0, -8.0);

//2 triangles and some displacement
float fMapleLeaf(vec3 posLeaf, float scale, float rand, bool doDetail, out vec4 material)
{
    posLeaf = opCheapBend(posLeaf.xzy, (rand-0.5) * 10.0).xzy;
    
    float normalisedHeight = saturate(0.5 + (posLeaf.y/scale));
    material = vec4(kMatMapleLeaf, 1.0, 0.0, 0.0);
    
    vec3 posTri = posLeaf - oz.yxy * scale;
    posTri.y = -posTri.y;
    
    if(doDetail)
    {
    	posTri.y += max(0.0, cos(abs(posTri.x)*6.0*kPI)) * 0.035;
    }

    float pointyBits = 0.0;
    float dist2D = sdTriangleIsosceles(posTri.xy, vec2(scale*1.2, scale*2.0));
    float innerStick = linearstep(0.01, 0.0, abs(posTri.x));
    innerStick = max(innerStick, linearstep(0.02, 0.0, abs(abs(posTri.x)-1.75*(posTri.y-1.4*scale))));
        
    if(doDetail)
    {
        pointyBits = abs(fract((-0.08 + posTri.y + abs(posTri.x)*2.0)*8.0) - 0.5) * 0.1 
            * saturate(1.0 - abs(-posTri.y/scale + 0.4)*1.);

        dist2D -= pointyBits;
    }
    
    float distToMid = (1.0 - 2.0*abs(normalisedHeight - 0.2));
    dist2D += distToMid*0.02;

    posTri.y -= scale * 0.75;
    posTri.x = abs(posTri.x) - scale * 1.3;
    pR(posTri.xy,  kPI * 0.35);
    
    float distTriSides = sdTriangleIsosceles(posTri.xy, vec2(scale*0.55, scale*1.3));
    innerStick = max(innerStick, linearstep(0.01, 0.0, abs(posTri.x)));
    if(doDetail)
    {    
        pointyBits = abs(fract((-0.03 + posTri.y + abs(posTri.x)*2.0)*8.0) - 0.5) * 0.1 
            * saturate(1.0 - abs(-posTri.y/scale + 0.35)*2.5);
        distTriSides -= pointyBits;
    }
	dist2D = min(dist2D, distTriSides);
    
    float inside = max(0.0, -dist2D/scale);
    material.z = inside;
    material.w = floor(rand * 100.0) + innerStick*0.99;
    
    if(doDetail)
    {
    	dist2D -= abs(fract((posLeaf.y/scale)*5.0)-0.5) * 0.02;
    }
    
    float minDist = opExtrusion(posLeaf, dist2D, 0.005);
    
    if(doDetail)
    {
        vec3 posStick = posLeaf + oz.yxy * scale * 0.5;
        float stickProgress = saturate(-posStick.y/scale);
        posStick.z += stickProgress*stickProgress*scale*0.3*(rand - 0.5);
    	float stickDist = fCapsule(posStick, -oz.yxy * scale * 1.0, oz.yyy, 0.003);
        if(stickDist < minDist)
        {
            minDist = stickDist;
        }        
    }
    
    return minDist;
}

float fBranchSDF(vec3 posBranch, float len, float rad, float rand, out vec4 material)
{
    float branchHalfLen = len * 0.5;
    float progressAlong = posBranch.y / (2.0*branchHalfLen);    
    float branchRad = rad * (1.0 - progressAlong * 0.8);
    
    float wave = sin((rand + posBranch.y)/len * 12.0)*0.25*rad;
    posBranch.xz += oz.xx * wave;
	float minDist = fCapsule(posBranch - oz.yxy * branchHalfLen, branchRad, branchHalfLen);
    
    float u = atan(posBranch.z, posBranch.x);
    material = vec4(kMatMapleBark, 0.0/*overriden for AO*/, u, progressAlong);

    return minDist;
}

float fBranchSDF(vec3 posWS, float scale, float rand, out vec4 material)
{
    float branchLen = 1.0 * scale;
    float branchRad = 0.03 * scale;

    return fBranchSDF(posWS, branchLen, branchRad, rand, material);
}

float fSmallBranchesSDF(vec3 posWS, float branchDist, float branchProgress, out vec4 material)
{
    float branchLen = clamp(branchDist * 2.0, 0.5, 2.0);
    
    //Shift until it looks good
    posWS += vec3(0.53, 1.0, 0.53);
    
    vec3 posBranches = posWS;
    vec3 id = pMod3(posBranches, oz.xxx * 2.0);
    id.x += pModPolar(posBranches.yz, 3.0);
    float rand = hash13(id * 789.5336);
    posBranches.xz += sin((posBranches.y + rand) * 2.0 * kPI) * 0.05;
    pR(posBranches.xy, (rand - 0.5) * kPI * 0.25);
    float rad = 0.05 * (1.3 - ((posBranches.y/branchLen) + 0.5));
    float minDist = fCapsule(posBranches, rad, branchLen);
    
    posBranches = posWS + oz.xxx;
    id = oz.xxx * 235.68 + pMod3(posBranches, oz.xxx * 2.0);
    id.x += pModPolar(posBranches.yx, 3.0);
    rand = hash13(id * 789.5336);
    posBranches.xz += sin((posBranches.y + rand) * 2.0 * kPI) * 0.05;
    pR(posBranches.yz, (rand - 0.5) * kPI * 0.25);
    rad = 0.05 * (1.3 - ((posBranches.y/branchLen) + 0.5));
    minDist = min(minDist, fCapsule(posBranches, rad, branchLen));
    
    //Remove branches near the center of the tree
    minDist += saturate(0.7 - branchProgress);
    
    //Remove small branches away from main branches
    minDist = smax(minDist, branchDist - 3.0, 0.75);
    //Remove small branches past the end of the main branch
    minDist += saturate((branchProgress - 1.4)*3.0);
    
    material = vec4(kMatMapleBark, 0.0/*overriden for AO*/, 0.001, branchProgress);
    return minDist;
}

float fCanopy(vec3 posTreeSpace, float branchesDist, vec4 branchMaterial, out vec4 material)
{
    const float leafSize = 0.15;
    const float leafRep = 0.4;
    
    vec3 leavesPos = posTreeSpace;
    vec3 leafId = pMod3(leavesPos, oz.xxx * leafRep);
    float leafRand = hash13(leafId * 347.0468);
    leavesPos.xzy += (leafRand - 0.5) * oz.xxx * leafRep * 0.5;
    pR(leavesPos.xz, leafRand * kPI);
    float leavesDist = fMapleLeaf(leavesPos, leafSize, leafRand, false, material);
    
    leavesPos = posTreeSpace + oz.xxx * leafRep * 0.5;
    pR(leavesPos.xz, kGoldenRatio * kPI);
    leafId = pMod3(leavesPos, oz.xxx * leafRep);
    leafRand = hash13(leafId * 347.0468);
    pR(leavesPos.xz, leafRand * kPI);
    leavesPos.xzy += (leafRand - 0.5) * oz.xxx * leafRep * 0.2;
    leavesDist = min(leavesDist, fMapleLeaf(leavesPos, leafSize, leafRand, false, material));
    
    //Remove leaves that are too far from branches, and too close to the trunk, and to far past the main branches
    float branchStart = linearstep(0.6, 0.4, branchMaterial.w);
    float branchEnd = linearstep(1.3, 1.42, branchMaterial.w);
    leavesDist = max(leavesDist, branchesDist - (0.27 - branchEnd*0.17) + branchStart);
    
    return leavesDist;
}

float fFallenLeavesSet(vec3 posTreeSpace, float iter, float groundY, out vec4 material)
{
    float iterRand = fract(iter * kGoldenRatio);
    float repSize = 0.25 + iter * 0.2;
    vec3 leafPos = posTreeSpace - iter * kWindVelocityWS * 4.0;
    leafPos.y = groundY - min(0.25, 0.75 - dot(leafPos.xz, leafPos.xz)*(0.01 - iter*0.002)*0.75);
    vec2 leafId = pMod2(leafPos.xz, oz.xx * repSize);
    float rand = hash12((leafId + oz.xx*iterRand*25.0) * 93.67);

    leafPos.xz += (rand - 0.5) * oz.xx * repSize * (0.5);
	leafPos.y += abs(rand-0.5)*2.0 * 0.75;
    
    pR(leafPos.yz, kPI * (0.2 + rand * 0.8));
    pR(leafPos.xy, kPI * 2.0 * rand);

    return fMapleLeaf(leafPos, 0.15, rand, true, /*out*/material);
}

float fFallenLeaves(vec3 posTreeSpace, float groundY, out vec4 material)
{
    float minDist = kMaxDist;
    
    if(groundY < 1.)
    {
        vec4 fallenLeavesMaterial;
        float fallenLeavesDist = fFallenLeavesSet(posTreeSpace, 0.0, groundY - 0.3, /*out*/fallenLeavesMaterial);
        if(fallenLeavesDist < minDist)
        {
            minDist = fallenLeavesDist;
            material = fallenLeavesMaterial;
        }

        fallenLeavesDist = fFallenLeavesSet(posTreeSpace, 1.0, groundY - 0.2, /*out*/fallenLeavesMaterial);
        if(fallenLeavesDist < minDist)
        {
            minDist = fallenLeavesDist;
            material = fallenLeavesMaterial;
        }

        fallenLeavesDist = fFallenLeavesSet(posTreeSpace, 2.0, groundY, /*out*/fallenLeavesMaterial);
        if(fallenLeavesDist < minDist)
        {
            minDist = fallenLeavesDist;
            material = fallenLeavesMaterial;
        }  
   
    }
    else
    {
        minDist = min(minDist, groundY - 0.75);
    }
    
    return minDist;
}

float fTreeSDF(vec3 posTreeSpace, float groundY, out vec4 material)
{
    float minDist = kMaxDist;
    float treeBoundingSphereDist = fSphere(posTreeSpace - oz.yxy * 8.0, 9.0);
    
    // If we're far from the tree and falling leaves, bail
    if(treeBoundingSphereDist > 12.0)
    {
        return treeBoundingSphereDist - 10.0;
    }
    
    // Falling leaves
    {
        vec3 leafPos = posTreeSpace - oz.yxy * 10.0;
        pR(leafPos.xy, -kPI * 0.25);//Rotate to match wind direction
        float leafId = pModPolar(leafPos.xz, 9.0);
        float leafRand = hash11(leafId * 68.76);
        leafPos.x -= 4.0 + leafRand * 2.0;
        float fallDuration = 20.0;
        float fallTime = (s_time*1.75 + leafRand * fallDuration);
        float iter = floor(fallTime / fallDuration);
        fallTime = fallTime - iter * fallDuration;
		
        leafPos.y += 2.0 + fallTime;
        float xOff = sin(fallTime * 0.75 + iter * kPI) + cos(fallTime * 1.5 + iter * kPI) * 0.5;
        leafPos.x += xOff*1.0;
        
        if(length(leafPos) > 0.3)
        {
            minDist = length(leafPos) - 0.2;
        }
        else
        {
            pR(leafPos.yz, xOff * 0.5 * kPI);
            pR(leafPos.xy, fallTime * (leafRand + 1.0) + iter * kPI);

            vec4 fallingLeavesMaterial;
            float fallingLeavesDist = fMapleLeaf(leafPos, 0.15, leafRand, true, /*out*/fallingLeavesMaterial);
            fallingLeavesMaterial.x = kMatFallingMapleLeaf;
            if(fallingLeavesDist < minDist)
            {
                minDist = fallingLeavesDist;
                material = fallingLeavesMaterial;
            }
        }
    }
    
    // If we're far from the tree, bail early
    if(treeBoundingSphereDist > 1.0)
    {
        return min(minDist, treeBoundingSphereDist);
    }
    
    vec4 trunkMaterial;
    vec3 trunkPos = posTreeSpace;
    
    float trunkDist = fBranchSDF(trunkPos, 10.0, 0.5, 0.0, trunkMaterial);
        
    if(trunkDist < minDist)
    {
        minDist = trunkDist;
        material = trunkMaterial;
    }
    
    float minBranchDist = kMaxDist;
    vec4 minBranchMaterial;
    
    
    float winFlexOffset = dot(sin(posTreeSpace * 0.1), oz.xxx) * 2.0 * kPI;
    float windFlexAmount = min(8.0, trunkDist)/8.0;
    vec3 windOffset = vec3(kWindVelocityWS.x, 0.5, kWindVelocityWS.z) * 
        (sin(s_time * 4.0 + winFlexOffset)) * 
        0.05 * windFlexAmount;
        
    
    vec4 branchMaterial;
    vec3 branchPos;
    float branchDist, id, rand;
    
    branchPos = trunkPos;
    id = pModPolar(branchPos.xz, 6.0);
    rand = hash11(id * 736.884);
    branchPos.y -= 4.0 + 1.0 * rand;
    pR(branchPos.xy, -kPI * (0.32 + rand * 0.1));
    
    branchDist = fBranchSDF(branchPos, 5.75, rand, branchMaterial);
    if(branchDist < minBranchDist)
    {
        minBranchDist = branchDist;
        minBranchMaterial = branchMaterial;
    }
    
    branchPos = trunkPos;
    pR(branchPos.xz, -kPI * 0.35);
    id = pModPolar(branchPos.xz, 5.0);
    rand = hash11(id * 736.884);
    branchPos.y -= 7.5 + 1.0 * rand;
    pR(branchPos.xy, -kPI * (0.35 - rand * 0.05));
   
    branchDist = fBranchSDF(branchPos, 5.0, 0.0, branchMaterial);
    if(branchDist < minBranchDist)
    {
        minBranchDist = branchDist;
        minBranchMaterial = branchMaterial;
    }
    
    branchPos = trunkPos;
    pR(branchPos.xz, -kPI * 0.65);
    id = pModPolar(branchPos.xz, 3.0);
    rand = hash11(id * 736.884);
    branchPos.y -= 9.5 + 0.5 * rand;
    pR(branchPos.xy, -kPI * (0.22 - 0.1 * rand));
    
    branchDist = fBranchSDF(branchPos, 4.0, 0.0, branchMaterial);
    if(branchDist < minBranchDist)
    {
        minBranchDist = branchDist;
        minBranchMaterial = branchMaterial;
    }
    
    if(minBranchDist < minDist)
    {
        minDist = minBranchDist;
        material = minBranchMaterial;
    }
    
    
    vec4 smallBranchesMaterial;
    float smallBranchesDist = fSmallBranchesSDF(trunkPos + windOffset * 0.25, minBranchDist, minBranchMaterial.w, 
                                                /*out*/smallBranchesMaterial);
    if(smallBranchesDist < minDist)
    {
        minDist = smallBranchesDist;
        material = smallBranchesMaterial;
    }

    vec4 leavesMaterial;
	float leavesDist = fCanopy(trunkPos + windOffset, smallBranchesDist, minBranchMaterial, 
                               /*out*/leavesMaterial);
    
    if(leavesDist < minDist)
    {
        minDist = leavesDist;
        material = leavesMaterial;
    }
    
	// Ambient occlusion is stronger at the center of the tree
    vec3 posToCanopyCenter = vec3(0.0, 10.0, 0.0) - posTreeSpace;
    material.y = min(1.0, dot(posToCanopyCenter, posToCanopyCenter) / 36.0);

    return minDist;
}

float fGrassBladeSet(vec3 grassPosWS, float iter, float scale, float flattenAmount, inout vec4 material)
{
    float iterRand = hash11(iter * 967.367);
	float height = 0.45 * max(1.0, scale);
    vec2 repSize = vec2(0.15, 0.15) * scale;
    
    
    float windOffset = iterRand * 5.0 + cos(grassPosWS.z * 2.0)*1.0;
    float wind = sin(s_time * 2.5 + windOffset + 2.0 * grassPosWS.x) * (1.0 - flattenAmount);
    
    //Offset each set to prevet overlap
    grassPosWS.xz += repSize * kGoldenRatio * iter * oz.xx;
    //Rotate each set in a different direction
    pR(grassPosWS.xz, (0.25 + (iterRand - 0.5) * 0.5) * kPI);
    
    vec2 id = pMod2(grassPosWS.xz, repSize);
    float rand = hash12(id);
    
    float normalisedHeight = saturate(grassPosWS.y / height);
        
    //Rotate/bend each blade with the wind
    pR(grassPosWS.yz, (normalisedHeight * (0.05 + rand * 0.1) + wind * 0.025) * kPI);
    grassPosWS.xz += (hash22(id * 37.3468) - 0.5*oz.xx) * repSize * 0.75;
    
    //Rotate the blade arount Y to get a variety of normal directions
    pR(grassPosWS.xz, (rand - 0.5) * 2.0 * kPI);
    
    const float kConeInvAngle = 0.485*PI;
    const vec2 kRefConeSinCos = vec2(sin(kConeInvAngle), cos(kConeInvAngle));
    float grassD = sdCone(grassPosWS - oz.yxy*height, vec3(kRefConeSinCos, height));  
    grassD = max(grassD, abs(grassPosWS.x) - 0.005);
    
    grassD += flattenAmount * 0.2;
    
    float ambientVis = min(1.0, 1.7 * normalisedHeight)*(1.0-flattenAmount);
    material = vec4(kMatGrass, normalisedHeight, min(material.z, ambientVis), rand);
    
    return grassD * 0.8;
}

float fGrass(vec3 posWS, float groundY, float leavesDist, out vec4 material)
{      
    vec3 grassPosWS;
    
    grassPosWS = posWS;
    grassPosWS.y = groundY + max(0.0, length(posWS.xz - s_eyePositionWS.xz) - 15.0) / 60.0;
    
    // Early ouut if far from the ground
    if(grassPosWS.y > 1.0)
    {
        return grassPosWS.y - 0.2;
    }
    
    material.z = 1.0;
    
    float flattenAmount = linearstep(0.1, 0.0, leavesDist);
    float grassDist = kMaxDist;    
    
	grassDist = min(grassDist, fGrassBladeSet(grassPosWS, 1.0, 1.0, flattenAmount, /*out*/material));
    grassDist = min(grassDist, fGrassBladeSet(grassPosWS, 2.0, 2.0, flattenAmount, /*out*/material));
    
    material.z *= linearstep(0.0, 0.3, leavesDist);

    return grassDist;
}

float noiseFbm(vec2 uv, sampler2D noiseSampler)
{
    float fbm = 0.0;
    float noise;
    
    noise = textureLod(noiseSampler, uv * 1.0, 0.0).r;
    fbm += noise * 1.0;
    noise = textureLod(noiseSampler, uv * 1.5, 0.0).r;
    fbm += noise * 0.55;
    noise = textureLod(noiseSampler, uv * 3.0, 0.0).r;
    fbm += noise * 0.35;
    noise = textureLod(noiseSampler, uv * 4.5, 0.0).r;
    fbm += noise * 0.25;    
    return fbm;
}

float fSDF(vec3 posWS, uint filterId, sampler2D noiseSampler, out vec4 material)
{    
    float mountainNoise = noiseFbm(posWS.xz * 0.0001 + oz.xx * 0.28, noiseSampler);
    
	float minDist = kMaxDist;
    
    float groundY = fSphere(posWS - vec3(-10.0, -500.0, -20.0), 500.0);
    
    float distantGroundDist = (mountainNoise - 0.25) * 30.0 + fSphere(posWS - vec3(100.0, -4995.0, 500.0), 5000.0);
    
    float allMountainsDist = kMaxDist;
    // Distant mountains
    if(filterId != kShadowMapFilter)
    {
        // Far left
        float scale = 1.65;
        vec3 moutainPosWS = posWS - scale*vec3(300.0, -100.0, 1400.0);
        float mountainDist = mountainNoise * 60.0 * scale * linearstep(-scale*150.0, scale*100.0, posWS.y) +
            fCone(moutainPosWS, scale*700.0, scale*600.0); 
        if(mountainDist < allMountainsDist)
        {
            allMountainsDist = mountainDist;
            material = vec4(kMatMountains, scale, mountainNoise, 100.0);
        }

        // A bit to the right
        scale = 2.7;
        moutainPosWS = posWS - scale*vec3(600.0, -100.0, 1000.0);
        mountainDist = mountainNoise * 40.0 * scale * linearstep(-scale*100.0, scale*100.0, posWS.y) +
            fCone(moutainPosWS, scale*500.0, scale*340.0); 
        if(mountainDist < allMountainsDist)
        {
            allMountainsDist = mountainDist;
            material = vec4(kMatMountains, scale, mountainNoise, 100.0);
        }

        scale = 4.45;
        moutainPosWS = posWS - scale*vec3(1000.0, -200.0, 900.0);
        mountainDist = mountainNoise * 40.0 * scale * linearstep(-scale*100.0, scale*100.0, posWS.y) +
            fCone(moutainPosWS, scale*550.0, scale*400.0); 
        if(mountainDist < allMountainsDist)
        {
            allMountainsDist = mountainDist;
            material = vec4(kMatMountains, scale, mountainNoise, 100.0);
        }

        scale = 0.85;
        moutainPosWS = posWS - scale*vec3(50.0, -120.0, 850.0);
        mountainDist = mountainNoise * 80.0 * scale +
            fCone(moutainPosWS, scale*700.0, scale*250.0); 
        if(mountainDist < allMountainsDist)
        {
            allMountainsDist = mountainDist;
            material = vec4(kMatMountains, scale, mountainNoise, 100.0);
        }

        // Far right
        scale = 4.0;
        moutainPosWS = posWS - scale*vec3(1480.0, -100.0, -700.0);
        mountainDist = mountainNoise * 50.0 * scale +
            fCone(moutainPosWS, scale*300.0, scale*350.0); 
        if(mountainDist < allMountainsDist)
        {
            allMountainsDist = mountainDist;
            material = vec4(kMatMountains, scale, mountainNoise, 100.0);
        }

        scale = 2.0;
        moutainPosWS = posWS - scale*vec3(1700.0, -200.0, -600.0);
        mountainDist = mountainNoise * 50.0 * scale +
            fCone(moutainPosWS, scale*600.0, scale*350.0); 
        if(mountainDist < allMountainsDist)
        {
            allMountainsDist = mountainDist;
            material = vec4(kMatMountains, scale, mountainNoise, 100.0);
        }
        
        minDist = min(allMountainsDist, minDist);
	}
    
    // Fallen leaves
    float fallenLeavesDist = kMaxDist;
    if(filterId != kShadowMapFilter)
    {
        vec4 fallenLeavesMat;
        fallenLeavesDist = fFallenLeaves(posWS - kTreePosWS, groundY, /*out*/ fallenLeavesMat);
        
        if(fallenLeavesDist < minDist)
        {
            minDist = fallenLeavesDist;
            material = fallenLeavesMat;
        }
    }
    
    // Grass
    vec4 grassMaterial;
    float grassDist = kMaxDist;
    if(filterId != kShadowMapFilter)
    {
        grassDist = fGrass(posWS, groundY, fallenLeavesDist, /*out*/ grassMaterial);
        
        if(grassDist < minDist)
        {
            minDist = grassDist;
            material = grassMaterial;
        }
    }
    
    if(filterId != kShadowMapFilter && 
       groundY < minDist)
    {
        minDist = groundY;
    	material = vec4(kMatGrass, 0.0, saturate(grassDist / 0.2) * 0.3, 0.0);
        //material = vec4(kMatMountains, 0.01, mountainNoise, grassDist*50.0);
    }
    
    // Tree
    vec4 treeMaterial;
	float treeDist = fTreeSDF(posWS - kTreePosWS, groundY, /*out*/ treeMaterial);
    
    if(treeDist < minDist)
    {
        minDist = treeDist;
        material = treeMaterial;
    }
    
    // Pine cones
    float pineDist = kMaxDist;

    if(filterId != kShadowMapFilter)
    {
        float pineGroundDist = min(distantGroundDist, allMountainsDist + 
                                   max(0.0, posWS.y - min(300.0, (1.0 - mountainNoise)*1000.0)) * 0.05);
        
        if(pineGroundDist > 25.0)
        {
            pineDist = pineGroundDist - 15.0;
        }
        else
        {
            vec3 posPine = posWS;
            posPine.y = pineGroundDist;
            vec2 pineId = pMod2(posPine.xz, oz.xx * 25.0);
            posPine .xz += hash22(pineId * 17.12) * 10.0;
            pineDist = fCone(posPine, 2.0, 15.0 + 4.0 * hash12(pineId * 17.12));

            posPine = posWS + oz.xxx * 12.5;
            posPine.y = pineGroundDist;
            pineId = pMod2(posPine.xz, oz.xx * 15.0);
            posPine .xz += hash22(pineId * 17.12) * 5.0;
            pineDist = min(pineDist, fCone(posPine, 2.0, 10.0 + 2.0 * hash12(pineId * 17.12)));
        }
        
        if( pineDist < minDist)
        {
            minDist = pineDist;
            material = vec4(kMatPines, pineGroundDist, mountainNoise, 1.0);
        }
    }
	
    
    if(filterId != kShadowMapFilter && 
       distantGroundDist < minDist)
    {
        minDist = distantGroundDist;
        material = vec4(kMatMountains, 1.0, mountainNoise, pineDist);
    }
    
    return minDist;
}

float fSDF(vec3 p, sampler2D noiseSampler)
{
    vec4 mat;
    return fSDF(p, kRenderFilter, noiseSampler, mat);
}

/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// Lighting
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

vec3 getSky(vec3 rayDirWS, float roughness, out vec3 transmittance)
{
    float r = max(0.0001, (rayDirWS.y + 0.1)/1.1);
    float cosineLobeAverage = 2.0/kPI;
    r = mix(r, cosineLobeAverage, roughness);
    
    float normalisedTravelledDensity = exp(-r)/r;
    
	float rayDotSun = dot(rayDirWS, s_dirToSunWS);
    float sr = max(0.0001, (s_dirToSunWS.y + 0.12)/1.12);    
    
    float rayleighPhase = rayleighPhase(rayDotSun) / kIsotropicScatteringPhase;
    rayleighPhase = mix(rayleighPhase, 1.0, roughness);
        
    vec3 rayleighTransmittance = exp(-(kRayleighScatteringCoefsKm) * kRayleighAtmHeightKm * normalisedTravelledDensity);
    vec3 rayleighScattering = oz.xxx - rayleighTransmittance;
    vec3 rMsCoefs = kRayleighScatteringCoefsKm * kRayleighScatteringCoefsKm * 1000.0;
    vec3 rayleighMultipleScattering = kMultipleScatteringFakery * mix(rayleighScattering, s_averageSkyColour, 0.5);
    
    //Hand tweaked earth shadowing / sky darkening
    float earthShadow = smoothstep(-0.15, 0.1, s_dirToSunWS.y + rayDotSun*0.02);
    
	vec3 sunTransmittance = max(0.00025*oz.xxx, //Max to prevent the sky from being pitch black at night
		earthShadow * mix(rayleighTransmittance, oz.xxx, 0.2 + 0.8*saturate((s_dirToSunWS.y)*3.0)));
        
    vec3 sky = (rayleighScattering * sunTransmittance + 
                earthShadow * rayleighTransmittance * rayleighMultipleScattering) *
        rayleighPhase;

    float mieTransmittance = exp(-kMieScatteringCoefsKm*kMieAtmHeightKm*normalisedTravelledDensity);
    float mieG = 0.75 - roughness*0.6;
    sky = sky * mieTransmittance + henyeyGreensteinPhase_schlick(rayDotSun, mieG) / kIsotropicScatteringPhase
        * s_cloudSunColour * earthShadow * (1.0 - mieTransmittance);
   
    transmittance = mieTransmittance * rayleighTransmittance;
    return sky;
}

vec3 getSky(vec3 rayDirWS, float roughness)
{
    vec3 unused;
    return getSky(rayDirWS, roughness, unused);
}

void initScene(vec3 eyePosWS, float time)
{
    s_eyePositionWS = eyePosWS;
    s_time = time * 1.0;
    s_dirToSunWS = normalize(vec3(0.4, 0.0, 0.5));
    
    float sunRotationPhase = kPI * 0.025;
    s_timeOfDay = fract(0.5 + (s_time * sunRotationPhase / (2.0 * kPI))) - 0.5;
    s_earthRotationRad = s_time * sunRotationPhase - sin(s_time * sunRotationPhase*2.0)*0.4;
    
    pR(s_dirToSunWS.yz, s_earthRotationRad);
    
    float sr = max(0.0001, (s_dirToSunWS.y + 0.0)/1.0);
    
    s_sunColour = float(USE_SUN) * exp(-kRayleighScatteringCoefsKm*kRayleighAtmHeightKm*
        exp(-sr)/sr);
	s_sunRadiance = s_sunColour*5.0 / kSunDiskSolidAngle;

    sr = max(0.02, (s_dirToSunWS.y + 0.01)/1.01);
    s_cloudSunColour = float(USE_SUN) * exp(-kRayleighScatteringCoefsKm*kRayleighAtmHeightKm*
        exp(-sr)/sr);
        
	s_averageSkyColour = getSky(oz.yxy, 0.5);
}

vec3 applyAtmosphere(vec3 sceneColour, vec3 rayDirWS, float travelledDist, float shadow)
{   
    float rayDotSun = dot(rayDirWS, s_dirToSunWS);
    float rayleighPhase = rayleighPhase(rayDotSun) / kIsotropicScatteringPhase;
    
    float r = max(0.05, (rayDirWS.y + 0.1)/1.1);
    float normalisedTravelledDensity = exp(-r)/r;
    
    float distKm = min(kRayleighAtmHeightKm, travelledDist / 1000.0);
    vec3 rayleighTransmittance = exp(-kRayleighScatteringCoefsKm*distKm*normalisedTravelledDensity);
    
    float sr = max(0.0001, (s_dirToSunWS.y + 0.12)/1.12);
    
    //Hand tweaked earth shadowing / sky darkening
	float earthShadow = smoothstep(-0.15, 0.1, s_dirToSunWS.y + rayDotSun*0.02);
    
	vec3 sunTransmittance = max(0.00025*oz.xxx, //Max to prevent the sky from being pitch black at night
		earthShadow * mix(rayleighTransmittance, oz.xxx, 0.2 + 0.8*saturate((s_dirToSunWS.y)*3.0)));   
    
    vec3 rayleighLighting = mix(s_averageSkyColour, rayleighPhase * sunTransmittance, shadow);
    vec3 rayleighInscatter = rayleighLighting * (oz.xxx - rayleighTransmittance);

    distKm = min(kMieAtmHeightKm, travelledDist / 1000.0);
    float mieTransmittance = exp(-kMieScatteringCoefsKm*distKm*normalisedTravelledDensity);
    float mieG = 0.7;
    vec3 mieLighting = mix(s_averageSkyColour, henyeyGreensteinPhase_schlick(rayDotSun, mieG) * 
        s_cloudSunColour * earthShadow * 4.0 * kPI, shadow);
    vec3 mieInscatter = mieLighting * (1.0 - mieTransmittance);
    
    vec3 atmTransmittance = rayleighTransmittance*mieTransmittance;
    vec3 atmInscatter = rayleighInscatter*mieTransmittance + mieInscatter;
    sceneColour = sceneColour * atmTransmittance + atmInscatter;
    
    
    return sceneColour;
}


float diskLight(vec3 rayDirWS, vec3 dirToLightWS,
           float cosAngularRadius, float roughness)
{    
    float brdfDiskSolidAngle = 2.0*kPI*(1.0 - (cosAngularRadius-roughness*1.0));
    float diskSolidAngle = 2.0*kPI*(1.0 - cosAngularRadius);
    float brightness = (max(0.00001, diskSolidAngle)/max(0.00001, brdfDiskSolidAngle));
    
    float sharpness = 1.0 - roughness;

    float vDotL = dot(rayDirWS, dirToLightWS);
    
    float cosRadiusStart = cosAngularRadius - 0.0001 - roughness*1.0;
    float cosRadiusEnd = cosAngularRadius + 0.0001 + roughness*1.0;
    float diskVisibility = linearstep(
        cosRadiusStart, 
        cosRadiusEnd,
    	vDotL)*2.0;
    
    float brdfPower = 7.0 - 6.0*sqrt(roughness);

    diskVisibility = pow(diskVisibility, brdfPower);

    //Integral S = (x^n dx) is F = x^(n+1) * 1/(n+1)
    //Integral over range [A, B] is F(B) - F(A)
    float powIntegral = 1.0/(brdfPower + 1.0);
	float normalisationFactor = powIntegral;
    //Renormalize
    diskVisibility /= max(0.00001, normalisationFactor);
    
    diskVisibility = min(1.0, diskVisibility * brightness);

    return diskVisibility;
}

vec3 getSun(vec3 rayDirWS, vec3 normalWS, float roughness)
{
    float sharpness = 1.0 - roughness;

    float vDotL = dot(rayDirWS, s_dirToSunWS);
    
    vec3 sunDisk = diskLight(rayDirWS, 
                             s_dirToSunWS, kCosSunRadius, roughness)
        * s_sunRadiance;
    
    float bloomBlend = linearstep(
        kCosSunRadius - (1.0 - kCosSunRadius)*10.0 - roughness * 1.0,
        kCosSunRadius + roughness * 1.0,
        vDotL);
    
    sunDisk += pow(bloomBlend, 4.0) * s_sunColour * 2.0 * sharpness;
    return sunDisk;
}

vec3 getSkyAndSun(vec3 rayDirWS)
{
    vec3 sky = getSky(rayDirWS, 0.0);
    sky += getSun(rayDirWS, s_dirToSunWS, 0.0);
    
    return sky;
}

vec3 computeSphereLighting(vec3 posWS, vec3 coneDirWS, float roughness, vec4 lightSphere, vec3 colour,
                      out float visibility)
{
    vec3 posToSphereWS = lightSphere.xyz - posWS;
    float distToSphereCenter = length(posToSphereWS);
    float sqDistToSphere = distToSphereCenter * distToSphereCenter;
    float sqSphereRadius = lightSphere.a * lightSphere.a;
    
    float distToDisk = (1.0/max(0.001, distToSphereCenter)) * max(0.001, sqDistToSphere - sqSphereRadius);
    float diskRadius = (lightSphere.a/distToSphereCenter)*sqrt(max(0.001, sqDistToSphere - sqSphereRadius));
    
    float cosSphereAngularRadius = clamp(distToDisk/sqrt(distToDisk*distToDisk + 
                                        diskRadius*diskRadius), -1.0, 1.0);
    vec3 posToSphereDirWS = posToSphereWS/distToSphereCenter;
    
    float sphereLighting = diskLight(coneDirWS, posToSphereDirWS, 
                                     cosSphereAngularRadius, roughness);
    
    //The point to light can be inside the sphere, blend to 1.0 at the center
    sphereLighting = mix(1.0, sphereLighting, min(1.0, sqDistToSphere/sqSphereRadius));
    
	visibility = sphereLighting;
    
    return colour * sphereLighting;
}

vec3 computeLighting(vec3 posWS, vec3 rayDirWS, vec3 normalWS, float roughness, float ambientVis, float shadow)
{
    vec3 lightingConeDirWS = normalize(mix(rayDirWS, normalWS, roughness*roughness*0.75));
    
    vec3 sky = getSky(lightingConeDirWS, roughness);

    vec3 ambient = sky;
    
#if USE_ATM
    vec3 skyUpColour = s_averageSkyColour;
#else
    vec3 skyUpColour = getSky(oz.yxy, 1.0);
#endif        
    
    vec4 treeSphere = vec4(kTreePosWS + oz.yxy * 9.5, 5.5);
    
    vec3 groundPosWS = posWS + lightingConeDirWS * (posWS.y/max(0.0001, -lightingConeDirWS.y));
    
    float treeShadow;
    computeSphereLighting(groundPosWS, s_dirToSunWS, roughness, vec4(treeSphere.xyz, treeSphere.a + 2.0), oz.yyy, treeShadow);
    vec3 vecToTreePosWS = posWS - kTreePosWS;
    vec3 treeLeavesAlbedo = vec3(0.5, 0.0075, 0.005);
    
    vec3 sunLight = smoothstep(0.05, 0.15, s_dirToSunWS.y) * s_sunColour;
    vec3 groundAlbedo = vec3(0.005, 0.35, 0.015);

    vec3 groundColour = (groundAlbedo * 0.63 + 0.04) * ((1.0 - treeShadow) * sunLight + skyUpColour);
    ambient = mix(ambient, groundColour, 
                  smoothstep(0.001+roughness*1.5, -0.001-roughness*1.5, lightingConeDirWS.y));

	//Fallen leaves lighting
    {
        vec3 leavesCenterWS = kTreePosWS - oz.yxy * 0.5;
        vec3 posToDiskCenterWS = leavesCenterWS - posWS;
        vec3 posToDiskCenterDirWS =  normalize(posToDiskCenterWS);

        vec3 leavesLighting = treeLeavesAlbedo * (0.35 * (1.0 - treeShadow) * sunLight + skyUpColour);

        float diff = linearstep(-1.0 + min(1.0, -posToDiskCenterWS.y/10.0), 
                                0.0 + min(1.0, -posToDiskCenterWS.y/10.0), 
                                dot(posToDiskCenterDirWS, lightingConeDirWS));
        diff *= 1.0 - min(1.0, dot(posToDiskCenterWS, posToDiskCenterWS)/150.0);
        ambient *= 1.0 - diff;  
        ambient += diff * leavesLighting;           
    }
    
    float sphereVisibility;
    vec3 sphereLight = computeSphereLighting(posWS, lightingConeDirWS, roughness, 
                                         treeSphere, treeLeavesAlbedo * (skyUpColour + 0.5 * sunLight), 
                                         sphereVisibility);
    ambient *= mix(1.0 - sphereVisibility, 1.0, 0.0*roughness);
    ambient += sphereLight;
    
    ambient *= ambientVis;
    ambient += getSun(lightingConeDirWS, normalWS, roughness) * shadow;

    return ambient;
}

vec3 computeLighting(vec3 posWS, vec3 rayDirWS, vec3 normalWS, float roughness)
{
    return computeLighting(posWS, rayDirWS, normalWS, roughness, 1.0, 1.0);
}


/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////
//////////////////////////// Cameras ////////////////////////////////
/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////

const float kCameraPlaneDist = 1.35;

float s_pixelConeWithAtUnitLength = 0.0;

vec2 getScreenspaceUvFromRayDirectionWS(
    vec3 rayDirectionWS,
	vec3 cameraForwardWS,
	vec3 cameraUpWS,
	vec3 cameraRightWS,
	float aspectRatio)
{
    vec3 eyeToCameraPlaneCenterWS = cameraForwardWS * kCameraPlaneDist;
    // project rayDirectionWs onto camera forward
    float projDist                 = dot(rayDirectionWS, cameraForwardWS);
    vec3  eyeToPosOnCameraPlaneWS = rayDirectionWS / projDist * kCameraPlaneDist;
    vec3  vecFromPlaneCenterWS       = eyeToPosOnCameraPlaneWS - eyeToCameraPlaneCenterWS;

    float xDist = dot(vecFromPlaneCenterWS, cameraRightWS);
    float yDist = dot(vecFromPlaneCenterWS, cameraUpWS);
    
    xDist /= aspectRatio;
    xDist = xDist * 0.5 + 0.5;
    yDist = yDist * 0.5 + 0.5;

    return vec2(xDist, yDist);
}

void computeCamera(float time, vec2 mouseNorm, vec4 iMouse, vec2 iResolution,
                   out vec3 rayOriginWS,
                   out vec3 cameraForwardWS,
                   out vec3 cameraUpWS,
                   out vec3 cameraRightWS
                  )
{
	s_pixelConeWithAtUnitLength = (1.0 / iResolution.y) / kCameraPlaneDist;

    rayOriginWS = vec3(-17.8, 2.0, -9.07);
    
	vec3 lookAtTarget = vec3( 0.0, 5.0, 0.0);
	
    cameraForwardWS = normalize(lookAtTarget - rayOriginWS);

    cameraRightWS = normalize(cross(oz.yxy, cameraForwardWS));
    cameraUpWS = normalize(cross(cameraForwardWS, cameraRightWS));
}

/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////
//////////////////////// Shadow mapping /////////////////////////////
/////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////

const float kShadowMapRangeWS = 14.0;

vec3 getShadowForwardDirWS(vec3 dirToSunWS)
{
    vec3 shadowPlaneForwardWS = dirToSunWS;
    shadowPlaneForwardWS.y = max(0.005, shadowPlaneForwardWS.y);
    shadowPlaneForwardWS = normalize(shadowPlaneForwardWS);
    
    return shadowPlaneForwardWS;
}

vec3 getShadowUvFromPosWS(vec3 posWS)
{
    vec3 shadowPlaneForwardWS = getShadowForwardDirWS(s_dirToSunWS);
    vec3 shadowPlaneRightWS = normalize(cross(oz.yxy, shadowPlaneForwardWS));
    vec3 shadowPlaneUpWS = cross(shadowPlaneForwardWS, shadowPlaneRightWS);
    
    vec3 shadowPlaneCenterWS = kTreePosWS + oz.yxy * 7.0 - oz.xyy * 4.0;   
    
    vec3 centerToPosWS = posWS - shadowPlaneCenterWS;
    
    vec3 uvSNorm;
    uvSNorm.x = dot(centerToPosWS, shadowPlaneRightWS);
    uvSNorm.y = dot(centerToPosWS, shadowPlaneUpWS);
    uvSNorm.z = dot(shadowPlaneForwardWS, centerToPosWS);
    
    uvSNorm /= kShadowMapRangeWS;
    
    return vec3(uvSNorm.xy * 0.5 + 0.5*oz.xx, uvSNorm.z);
}

vec3 uvSNormToShadowRayStartWS(vec2 uvSNorm, vec3 shadowPlaneForwardWS)
{   
    vec3 shadowPlaneRightWS = normalize(cross(oz.yxy, shadowPlaneForwardWS));
    vec3 shadowPlaneUpWS = cross(shadowPlaneForwardWS, shadowPlaneRightWS);
    
    vec3 rayStartWS = kTreePosWS + oz.yxy * 7.0 - oz.xyy * 4.0 +
        (uvSNorm.x * shadowPlaneRightWS + uvSNorm.y * shadowPlaneUpWS) * kShadowMapRangeWS;
    
    return rayStartWS;
}

`;

const buffA = `
#define ITER_SHADOW 128
float marchShadow(vec3 rayOriginWS, vec3 rayDirWS, float t, float mt, out float lastDist)
{
    float d;
    float minVisibility = 1.0;
    lastDist = 100.0;
    
    vec4 material;
    
    for(int i = NON_CONST_ZERO; i < ITER_SHADOW && t < mt; ++i)
    {
        float coneWidth = max(0.00001, kTanSunRadius * t);
        
        vec3 posWS = rayOriginWS + rayDirWS*t;
        d = fSDF(posWS, kShadowMapFilter, iChannel2, material);
        
        float stepMinVis = (d) / max(0.0001, coneWidth * 0.5);
        if(stepMinVis <= minVisibility)
        {
            minVisibility = stepMinVis;
            lastDist = t;
        }
        
        t += max(0.01, d);           
        
        if(minVisibility < 0.01)
        {
            minVisibility = 0.0;
        }
    }
      
    return smoothstep(0.0, 1.0, minVisibility);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 uvSNorm = uv * 2.0 - oz.xx;
    
    initScene(oz.xxx, iTime);
        
    vec3 shadowPlaneForwardWS = getShadowForwardDirWS(s_dirToSunWS);
    
	vec3 rayStartWS = uvSNormToShadowRayStartWS(uvSNorm, shadowPlaneForwardWS);
    
    float offsetFromShadowPlane = min(100.0, rayStartWS.y/shadowPlaneForwardWS.y);
    rayStartWS -= shadowPlaneForwardWS * offsetFromShadowPlane;
    
    float shadowDist = 0.0;
    float shadow = marchShadow(rayStartWS, shadowPlaneForwardWS, offsetFromShadowPlane - kShadowMapRangeWS, offsetFromShadowPlane + 100., shadowDist);
    
    shadowDist -= offsetFromShadowPlane;

    fragColor = vec4(shadow, shadowDist/kShadowMapRangeWS, 0.0, 1.0);
}

`;

const buffB = `
float fMaterialSDF(vec3 samplePosWS, float dist, vec4 material)
{
    if(abs(material.x - kMatMountains) < 0.1)
    {
        vec2 uv = samplePosWS.xz * 0.0015;
       	float mountainNoise = noiseFbm(uv / material.y, iChannel2);
        
        dist -= mountainNoise * 5.0 * material.y;
    }
    else if(abs(material.x - kMatMapleBark) < 0.1)
    {
        float progressAlongBranch = material.w;
        float u = material.z/kPI;

        vec2 branchUv = vec2(u * 0.5, progressAlongBranch * 0.5);

        dist -= textureLod(iChannel2, branchUv, 0.0).r * 0.05; 
    }
    else if(abs(material.x - kMatPines) < 0.1)
    {
        float pineGroundDist = material.y;
        float mountainNoise = material.z;
        dist -= sin(pineGroundDist*kPI)*0.5*(1.0 - pineGroundDist/20.0);
    }
    return dist;
}

vec3 getNormalWS(vec3 p, float dt)
{
    vec3 normalWS = oz.yyy;
    for( int i = NON_CONST_ZERO; i<4; i++ )
    {
        vec3 e = 0.5773*(2.0*vec3((((i+3)>>1)&1),((i>>1)&1),(i&1))-1.0);
        vec3 samplePosWS = p + e * dt;
        vec4 mat;
        float dist = fSDF(samplePosWS, kRenderFilter, iChannel2, mat);
        normalWS += e*fMaterialSDF(samplePosWS, dist, mat);
    }
    return normalize(normalWS);    
}

float sampleShadowMap(vec3 p, float startOffset)
{
    float shadowMapRangeWS = 14.0;
    
    vec3 uv_depth = getShadowUvFromPosWS(p);
    
    vec2 shadow_depth = textureLod(iChannel1, uv_depth.xy, 0.0).xy;
    
    if(shadow_depth.y > (uv_depth.z + startOffset / kShadowMapRangeWS))
    {
        return shadow_depth.x;
    }
    else
    {
        return 1.0;
    }
}

float globalShadow(vec3 posWS, vec3 rayDirWS)
{    
    float softness = 0.01;
    
    // Far left
    float scale = 1.65;
    vec3 moutainPosWS = scale*vec3(300.0, -100.0, 1400.0);
    moutainPosWS += scale*vec3(-200.0, 100.0, 0.0);
    float mountainShadow = sphSoftShadow(posWS, rayDirWS, moutainPosWS, scale*600.0 * 0.85, softness);

    // A bit to the right
    scale = 2.7;
    moutainPosWS = scale*vec3(600.0, -100.0, 1000.0);
    moutainPosWS += scale*vec3(-50.0, 0.0, 0.0);
    mountainShadow *= sphSoftShadow(posWS, rayDirWS, moutainPosWS, scale*500.0 * 0.6, softness);

    scale = 4.45;
    moutainPosWS = scale*vec3(1000.0, -200.0, 900.0);
    mountainShadow *= sphSoftShadow(posWS, rayDirWS, moutainPosWS, scale*500.0 * 0.7, softness);

    return mountainShadow;;
   
}

float getShadow(vec3 p, vec3 sd)
{
	return sampleShadowMap(p, 0.1);
}

float cloudNoiseFbm(vec2 uv)
{
    float maxNoise = 0.0;
    float noise = 0.0;
    
    float amplitude = 1.0;
    float scale = 1.0;
    
    vec2 windOffset = oz.yy;
    
    for(int i = NON_CONST_ZERO; i < 7; ++i)
    {
        windOffset += s_time/scale * 0.0015 * kWindVelocityWS.xz;
        
        noise += amplitude * textureLod(iChannel2, uv*scale - windOffset, 0.0).r;
    	maxNoise += amplitude;
    	amplitude *= 0.5;
        scale *= 2.0;
    }
    
    return noise / maxNoise;
}

vec3 computeFinalLighting(float marchedDist, vec3 rayOriginWS, vec3 rayDirWS,
                          vec4 material)
{    
    vec3 endPointWS = rayOriginWS + rayDirWS * marchedDist;

    vec3 sceneColour = oz.yyy;
    
    if(marchedDist < kMaxDist)
    {
        float coneWidth = max(0.001, s_pixelConeWithAtUnitLength * (marchedDist - 10.0));
        float normalDt = coneWidth;
        vec3 normalWS = getNormalWS(endPointWS, normalDt);
        normalWS = fixNormalBackFacingness(rayDirWS, normalWS);
        
        vec3 worldShadowOffset = oz.yxy * 1000.0 * linearstep(0.1, 0.2, s_timeOfDay);
        float worldShadow = globalShadow(endPointWS + worldShadowOffset, s_dirToSunWS);
        float atmShadow = saturate(worldShadow + (s_dirToSunWS.y - 0.0615)*15.0);
     	float shadow = getShadow(endPointWS, s_dirToSunWS) * worldShadow;        
        
        vec3 albedo = oz.xyx;
        vec3 f0Reflectance = oz.xxx * 0.04;
        float roughness = 0.6;
        vec4 emissive = oz.yyyy;
        float ambientVis = 1.0;

        if(abs(material.x - kMatMapleLeaf) < 0.1
               || abs(material.x - kMatFallingMapleLeaf) < 0.1)
        {
            ambientVis = max(0.25, material.y);
            shadow *= material.y;
            
            float inside = material.z;
            float leafRand = floor(material.w) / 100.0;
            float tint = min(1.0, leafRand*leafRand*0.5 + inside);
                
            albedo = mix(vec3(0.5, 0.0075, 0.005), vec3(0.5, 0.15, 0.005), tint*tint);

            float stick = max(0.0, fract(material.w) - 0.75*inside);
			albedo = mix(albedo, vec3(0.2, 0.04, 0.005), stick);
            //Backlighting
            emissive.rgb = henyeyGreensteinPhase(dot(s_dirToSunWS, rayDirWS), 0.5)
                * shadow * albedo * albedo * s_sunColour * (1.0 - stick) * 4.0;
            //emissive.a = 1.0;
            vec2 uv = material.yz;

            roughness = 0.7 - stick*0.2;
        }
        else if(abs(material.x - kMatMapleBark) < 0.1)
        {
            float progressAlongBranch = material.w;
            ambientVis = max(0.25, material.y);
            float u = material.z;
            
            vec2 branchUv = vec2(u, progressAlongBranch);
            roughness = 0.6;

            albedo = vec3(0.2, 0.04, 0.005);
        }
        else if(abs(material.x - kMatGrass) < 0.1)
        {
            float normalisedHeight = material.y;
            ambientVis = 0.15 + 0.85*material.z;
            shadow *= min(1.0, material.z * 3.0);
            float grassRand = material.w;
            
            albedo = mix(vec3(0.005, 0.35, 0.015), vec3(0.1, 0.35, 0.015), 
                         saturate(normalisedHeight*normalisedHeight + (grassRand - 0.5)));

            //Backlighting
            emissive.rgb = henyeyGreensteinPhase(dot(s_dirToSunWS, rayDirWS), 0.5)
                * shadow * albedo * albedo * s_sunColour * 4.0 * normalisedHeight;
            
            roughness = 0.75;
        }
        else if(abs(material.x - kMatMountains) < 0.1)
        {
            float mountainNoise = material.z;
            float mountainScale = material.y;
            float detailNoise = noiseFbm(endPointWS.xz * (0.002 / mountainScale), iChannel2);
            float noise = (detailNoise * 0.5 + mountainNoise) / 1.5;
            float treeDist = material.w;
            
            albedo = 0.5*vec3(0.15, 0.025, 0.001);
            roughness = 0.85;
            
            float rocks = linearstep(1.15, 1.3, detailNoise * 0.3 + noise * 0.7);
            albedo = mix(albedo, oz.xxx * 0.1, rocks);
            roughness = mix(0.85, 0.5, rocks);
            
            float snowAmount = saturate((noise - 0.5)*2.0 + (endPointWS.y - 550.0)/300.0);
            albedo = mix(albedo, oz.xxx, snowAmount);
            roughness = mix(roughness, 1.0, snowAmount);
            
            ambientVis = (0.5 + 0.5*saturate(treeDist*0.1));
            shadow *= saturate(treeDist*0.1);
        }
        else if(abs(material.x - kMatPines) < 0.1)
        {
            float mountainNoise = material.z;
            float bottomToTop = material.y / 20.0;
            
            albedo = mix(0.5*vec3(0.005, 0.15, 0.01), 0.25*vec3(0.005, 0.1, 0.05), linearstep(1.0, 1.2, mountainNoise));
            ambientVis = (0.5 + 0.5*bottomToTop);
            shadow *= saturate(bottomToTop * 5.0);
            roughness = 0.85;
        }        
            
        //Lighting part
        {            
            vec3 reflectedRayDirWS = reflect(rayDirWS, normalWS);
            float rDotN = max(0.0001, dot(reflectedRayDirWS, normalWS));
            vec3 fresnelReflectance = roughFresnel(f0Reflectance, rDotN, roughness);

            vec3 diffuse = albedo * computeLighting(endPointWS, normalWS, normalWS, 1.0, ambientVis, shadow);
            vec3 specular = computeLighting(endPointWS, reflectedRayDirWS, normalWS, roughness, ambientVis, shadow);
            vec3 surfaceLighting = mix(diffuse, specular, fresnelReflectance);
            sceneColour = surfaceLighting * (1.0 - emissive.a) + emissive.rgb;
        }
        
        sceneColour = applyAtmosphere(sceneColour, rayDirWS, marchedDist, atmShadow);
    }
    else
    {
        vec3 skyColour = getSkyAndSun(rayDirWS);
    	sceneColour = skyColour;
        
        //Stars
        float scale = 3.0;
        vec3 stars = oz.yyy;
        for(uint i = NON_CONST_ZERO_U; i < 4u; ++i)
        {
            vec3 rd = rayDirWS;
            rd.y = max(0.0001, (rd.y + 0.5) / 1.5);
            vec2 uv = rd.xz/rd.y;
            uv.y += s_earthRotationRad;
            uv += oz.xx * float(i) * kGoldenRatio;
            
            vec2 id = pMod2(uv, oz.xx * 0.1 * scale) + oz.xx * float(i) * kGoldenRatio;

            vec2 rand = hash22(id * 73.157);
            uv += (rand - 0.5*oz.xx) * 0.1 * scale;
            
            float starHeat = hash12(id * 73.157);
            vec3 starColour = oz.xxx * 0.75 + 0.5 * hash32(id * 953.56);
			starHeat *= starHeat;
            float startFade = linearstep((0.5 + starHeat*0.5)*0.003/rd.y, 0.0, length(uv));
            stars += startFade * startFade * starColour * 0.04 * (0.5 + starHeat*starHeat) * scale * scale;
            
            scale *= 0.5;
        }
        
        vec3 skyTransmittance;
        getSky(rayDirWS, 0.0, skyTransmittance);
        stars = stars * skyTransmittance;
        
        float cloudPlaneInterDist = 4000.0/max(0.0001, rayDirWS.y + 0.13);
        vec3 cloudPosWS = rayOriginWS + rayDirWS * cloudPlaneInterDist;
        
        float rayDotSun = dot(s_dirToSunWS, rayDirWS);
        float earthShadow = smoothstep(-0.06, -0.04, s_dirToSunWS.y + (rayDotSun - 0.5)*0.035);
        
        vec2 cloudUv = fract(cloudPosWS.xz * 0.0000035); 
        vec2 cloudShadowUv = cloudUv + s_dirToSunWS.xz * 0.002; 
        
        float cloudNoise = cloudNoiseFbm(cloudUv);
        
        float phase = henyeyGreensteinPhase_schlick(dot(rayDirWS, s_dirToSunWS), 0.7);
        float cloudTransmittance = 1.0 - smoothstep(0.6, 0.7, cloudNoise);
        float cloudShadow = 1.0 - 0.9*smoothstep(0.5, 0.8, cloudNoiseFbm(cloudShadowUv));
        vec3 cloudInscatter = s_averageSkyColour + max(oz.xxx * 0.00035, s_cloudSunColour * earthShadow) *
            (1.0 + phase * 1.0 * kPI) * cloudShadow;
        
        cloudInscatter = applyAtmosphere(cloudInscatter, rayDirWS, cloudPlaneInterDist, 1.0);
        
        sceneColour += stars;
        sceneColour = sceneColour * cloudTransmittance + (1.0 - cloudTransmittance) * cloudInscatter;
    }
    
    return sceneColour;
}

float fogNoiseFbm(vec3 uvw)
{
    float maxNoise = 0.0;
    float noise = 0.0;
    
    float amplitude = 1.0;
    
    for(int i = NON_CONST_ZERO; i < 3; ++i)
    {
        noise += amplitude * textureLod(iChannel3, uvw.xy, 0.0).r;
    	maxNoise += amplitude;
    	amplitude *= 0.5;
        uvw *= 2.0;
    }
    
    return noise / maxNoise;
}

#define ITER 1024
float march(vec3 rayOriginWS, vec3 rayDirWS, float rand, out vec3 sceneColour, out float responsiveness)
{
    float phase = 4.0 * kPI * 
        (henyeyGreensteinPhase_schlick(dot(rayDirWS, s_dirToSunWS), 0.7) + 
        kIsotropicScatteringPhase);
        
    vec4 material;
    
    vec3 inscatter = oz.yyy;
    float transmittance = 1.0;
    
    float t = 0.001;
    float d;
    
    for(int i = NON_CONST_ZERO; i < ITER; ++i)
    {
        float coneWidth = max(0.001, s_pixelConeWithAtUnitLength * (t - 10.0));
        
        vec3 posWS = rayOriginWS + rayDirWS*t;
        d = fSDF(posWS, kRenderFilter, iChannel2, material);
        
        t += d;
        
        if(i >= ITER - 1)
        {
            t = kMaxDist;
        }              
        
        if(d < coneWidth || t >= kMaxDist)
        {
            break;
        }
        
        
        // Add some fog at the bottom of the tree, because shadowing from leaves looks cool !
#if 1
        vec3 fogVolumeCenterWs = kTreePosWS - oz.yxy * 99.0;
        float distToFogVolume = fCapsule(posWS, fogVolumeCenterWs, 
                                         fogVolumeCenterWs,
                                         100.0);
        float distToTree = length((kTreePosWS - s_dirToSunWS * oz.xyx * 5.0) - posWS);
        
        float densityBias = ( max(0.0, distToTree - 2.0) * 0.035 + 0.2 ) +
            linearstep(0.0, 10.0, distToFogVolume);
        
        if(densityBias < 1.0)
        {
            float fogNoise = fogNoiseFbm((posWS - oz.yxy * 0.75 * s_time) * 0.025);
            fogNoise = max(0.0, fogNoise - densityBias);
            fogNoise = saturate(fogNoise * 2.0);

            float scatteringCoef = fogNoise * 0.1;

            float stepTransmittance = exp(-scatteringCoef*d);

            posWS = rayOriginWS + rayDirWS*(t - d*rand);
            float shadow = sampleShadowMap(posWS, 0.0) * linearstep(0.0575, 0.1, s_dirToSunWS.y);;

                vec3 stepLighting =  s_sunColour * shadow * phase;
            stepLighting += s_averageSkyColour;

            inscatter += transmittance * (1.0 - stepTransmittance) * stepLighting;
            transmittance *= stepTransmittance;
        }
#endif
        
    }
      
    sceneColour = computeFinalLighting(t, rayOriginWS, rayDirWS, material);
    
    sceneColour = sceneColour * transmittance + inscatter;
    
    responsiveness = abs(material.x - kMatFallingMapleLeaf) < 0.1 ? 1.0f : 0.0f;
    
    return t;
}


vec3 applyBloom(vec3 colour, vec2 uv, vec2 subPixelJitter)
{
#if 1
    float totalWeight = 0.0;
    vec3 bloom = oz.yyy;
    
    float kernel = 1.0;
    //Super sample low mips to get less blocky bloom
    for(float xo = -kernel; xo < kernel + 0.1; xo += 0.5)
    {
        for(float yo = -kernel; yo < kernel + 0.1; yo += 0.5)
        {
            vec2 vo = vec2(xo, yo);
            float weight = (kernel*kernel*2.0) - dot(vo, vo);
            vo += 0.5 * (subPixelJitter);
            vec2 off = vo*(0.5/kernel)/iResolution.xy;
            
            if(weight > 0.0)
            {
                float maxBloom = 5.0;
                bloom += weight * min(maxBloom*oz.xxx, textureLod(iChannel0, uv + off*exp2(5.0), 5.0).rgb);totalWeight += weight;
                bloom += weight * min(maxBloom*oz.xxx, textureLod(iChannel0, uv + off*exp2(6.0), 6.0).rgb);totalWeight += weight;
                bloom += weight * min(maxBloom*oz.xxx, textureLod(iChannel0, uv + off*exp2(7.0), 7.0).rgb);totalWeight += weight;
            }
        }
    }

    bloom.rgb /= totalWeight;
    
    colour.rgb = colour.rgb * 0.8 + pow(bloom, oz.xxx*1.5) * 0.3;
#endif
    
    return colour;
}


#define TAA 1

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 subPixelJitter = fract(hash22(fragCoord)
                                + float(iFrame%256) * kGoldenRatio * oz.xx) - 0.5*oz.xx;
    
    vec2 uv = fragCoord.xy / iResolution.xy;
    float jitterAmount = float(TAA);
    
    vec2 uvJittered = (fragCoord.xy + jitterAmount * subPixelJitter) / iResolution.xy;
    
    float aspectRatio = iResolution.x/iResolution.y;
    vec2 uvSNorm = uvJittered * 2.0 - vec2(1.0);
    uvSNorm.x *= aspectRatio;
    
    vec2 mouseUNorm = iMouse.xy/iResolution.xy;
    vec2 mouseNorm = mouseUNorm*2.0 - vec2(1.0);
    
    vec3 rayOriginWS;
    
    // ---- Camera setup ---- //
    vec3 cameraForwardWS, cameraUpWS, cameraRightWS;
    computeCamera(iTime, mouseNorm, iMouse, iResolution.xy, rayOriginWS, cameraForwardWS, cameraUpWS, cameraRightWS);
    vec3  rayDirWS = normalize(uvSNorm.x*cameraRightWS + uvSNorm.y*cameraUpWS + kCameraPlaneDist*cameraForwardWS);
    
    initScene(rayOriginWS, iTime);
    
    // ---- TAA part ---- //  
    float prevTime = iTime - iTimeDelta;
    vec3 prevCameraPosWS, prevCameraForwardWS, prevCameraUpWS, prevCameraRightWS;
    computeCamera(prevTime, mouseNorm, iMouse, iResolution.xy, prevCameraPosWS, 
                  prevCameraForwardWS, prevCameraUpWS, prevCameraRightWS);
    
    // ---- Render scene ---- //
    float responsiveness;
    vec3 sceneColour;
    float tt = march(rayOriginWS, rayDirWS, hash12(fragCoord), sceneColour, responsiveness);
    
    float nightTimeStrength = linearstep(-0.15, -0.6, s_dirToSunWS.y);
    
    float exposure = 1.0 + nightTimeStrength*150.0;
    sceneColour *= exposure;
    
    sceneColour = applyBloom(sceneColour, uv, subPixelJitter);
        
    // ---- Flares ---- //
    {
        float sunVisibility = sampleShadowMap(rayOriginWS, 0.0) * globalShadow(rayOriginWS, s_dirToSunWS);
        float numApertureBlades = 8.0;

        vec2 sunUv = getScreenspaceUvFromRayDirectionWS(s_dirToSunWS,
                                                           cameraForwardWS, cameraUpWS, cameraRightWS, aspectRatio);
        vec2 sunUvSNorm = sunUv * 2.0 - vec2(1.0);
    	sunUvSNorm.x *= aspectRatio;
        
        vec2 sunUvDirSNorm = normalize(sunUvSNorm);
        
        float rDotL = dot(rayDirWS, s_dirToSunWS);
        
        vec2 uvToSunSNorm = sunUvSNorm - uvSNorm;
        float starBurst = 0.5 + 0.5*cos(1.5 * kPI + atan(uvToSunSNorm.x, uvToSunSNorm.y) * numApertureBlades);
        float startFade = linearstep(0.97, 1.0, rDotL);
        float starWidth = linearstep(0.5, 1.0, rDotL);
        starBurst = pow(starBurst, max(1.0, 500.0 - starWidth*starWidth * 501.0))*startFade;

        vec3 totalFlares = starBurst * 1.5 * linearstep(0.875, 1.0, rDotL*rDotL) * oz.xxx;

        vec2 flareCenterUvSNorm;
        
        flareCenterUvSNorm = sunUvSNorm * 2.0;
        totalFlares += 0.5 * vec3(0.1, 0.15, 0.01) * 
            linearstep(0.05, 0.0, sdOctogon(flareCenterUvSNorm - uvSNorm, 0.35));
        
        flareCenterUvSNorm = sunUvSNorm * 1.5;
        totalFlares += 0.65 * vec3(0.015, 0.12, 0.09) * 
            linearstep(0.03, 0.0, sdOctogon(flareCenterUvSNorm - uvSNorm, 0.2));
        
        flareCenterUvSNorm = sunUvSNorm * 0.25;
        totalFlares += 2.5 * vec3(0.1, 0.1, 0.1) * 
            linearstep(0.01, 0.0, sdOctogon(flareCenterUvSNorm - uvSNorm, 0.1));
        
        flareCenterUvSNorm = sunUvSNorm * 0.1;
        totalFlares += 4.0 * vec3(0.11, 0.11, 0.1) * 
            linearstep(0.02, 0.0, sdOctogon(flareCenterUvSNorm - uvSNorm, 0.05));
        
        flareCenterUvSNorm = sunUvSNorm * -0.12;
        totalFlares += 3.5 * vec3(0.15, 0.05, 0.025) * 
            linearstep(0.01, 0.0, sdOctogon(flareCenterUvSNorm - uvSNorm, 0.15));
        
        flareCenterUvSNorm = sunUvSNorm * -0.25;
        totalFlares += 0.8 * vec3(0.02, 0.15, 0.1) * 
            linearstep(0.02, 0.0, sdOctogon(flareCenterUvSNorm - uvSNorm, 0.25));
        
        //First coloured circle
        {
            flareCenterUvSNorm = sunUvSNorm * 0.5;

            float distToDisk = length(flareCenterUvSNorm - uvSNorm) - length(flareCenterUvSNorm * 2.0);
            float ci = smoothstep(0.2, 0.01, abs(distToDisk));
            float colourRamp = linearstep(-0.2, 0.2, distToDisk);
            vec2 uvToSunDir = normalize(uvToSunSNorm);
            vec3 repColour = wavelengthToRGB(300.0 + colourRamp * 500.0);

            totalFlares += 0.25 * repColour * ci * linearstep(0.75, 1.0, dot(sunUvDirSNorm, uvToSunDir));
        }
        
        //Second coloured circle
        {
            flareCenterUvSNorm = sunUvSNorm * 0.5;

            float distToDisk = length(flareCenterUvSNorm - uvSNorm) - length(flareCenterUvSNorm * 1.6);
            float ci = smoothstep(0.4, 0.0, abs(distToDisk));
            float colourRamp = linearstep(-0.8, 0.8, distToDisk);
			vec2 uvToSunDir = normalize(uvToSunSNorm);
            vec3 repColour = wavelengthToRGB(300.0 + colourRamp * 500.0);
            totalFlares += 0.25 * repColour * ci * linearstep(0.98, 1.0, dot(sunUvDirSNorm, uvToSunDir));
        }
        
        
        flareCenterUvSNorm = sunUvSNorm * -1.4;
        totalFlares += 0.8 * vec3(0.1, 0.15, 0.075) * 
            linearstep(0.015, 0.0, sdOctogon(flareCenterUvSNorm - uvSNorm, 0.17));
        
        
        flareCenterUvSNorm = sunUvSNorm * -2.0;
        totalFlares += 3.0 * vec3(0.1, 0.05, 0.02) * 
            linearstep(0.4, 0.0, sdOctogon(flareCenterUvSNorm - uvSNorm, 0.1));
        
        sceneColour += totalFlares * 0.2 * s_sunColour * sunVisibility * linearstep(3.2, 2.0, length(sunUvSNorm));
    }
    
    vec2 prevFrameUv = uv;
    vec4 prevData = texture(iChannel0, prevFrameUv);
    
    float defaultBlendToCurrent = (2.0/9.0)*max(1.0, iTimeDelta/0.066);
    float blendedResp = mix(prevData.a, responsiveness, defaultBlendToCurrent);
    float blendToCurrent = mix(defaultBlendToCurrent, 1.0, blendedResp);
    //Increase TAA at night to get stars trails
    blendToCurrent = min(1.0, mix(blendToCurrent, iTimeDelta, nightTimeStrength));
    
#if !TAA    
    blendToCurrent = 1.0;
#endif
    
    //Clamp to prevent the sun from leaving a trail
    sceneColour = min(oz.xxx * 3.0, sceneColour);
    sceneColour = max(oz.yyy, mix(prevData.rgb, sceneColour, blendToCurrent));
    
    fragColor = vec4(sceneColour, responsiveness);
    fragColor.a = 1.;
}`;

const fragment = `
//The day/night cyle takes around 1 a minute, so sit back and relax.

//Text ascii art using : http://patorjk.com/software/taag/

float tonemapOp(float v)
{
    v = pow(v, 2.0);
    v = v / (1.0 + v);
    return pow(v, 1.0/2.0) * 1.025;
}

vec3 tonemap(vec3 colour)
{
    float inputLuminance = max(0.0001, rbgToluminance(colour));
    vec3 normalisedColour = colour / inputLuminance;
    
    vec3 tonemapColour;
    tonemapColour.r = tonemapOp(colour.r);
    tonemapColour.g = tonemapOp(colour.g);
    tonemapColour.b = tonemapOp(colour.b);
    float tonemappedLuminance = tonemapOp(inputLuminance);
    
    tonemapColour = (tonemapColour / max(0.0001, rbgToluminance(tonemapColour)));
    
    return tonemappedLuminance * mix(normalisedColour, tonemapColour, min(1.0, 0.35*inputLuminance));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy;
      
	vec4 colour = texture(iChannel1, uv);
    
    //Vignette
    colour.rgb *= smoothstep(1.15, 0.3, length(uv - 0.5*oz.xx));
    
	//Tonemap
    float toeStrength = 1.25;
    colour.rgb = tonemap(colour.rgb * toeStrength); colour.rgb = pow(colour.rgb, toeStrength*oz.xxx);
    
    //Gamma
    colour = pow(colour, vec4(1.0/2.2));
    fragColor = colour;
    
    //Dithering
    fragColor += ((hash12(fragCoord)) - 0.5)*4.0/255.0;
}
`;

export default class implements iSub {
  key(): string {
    return 'tdjyzz';
  }
  name(): string {
    return 'Tree in the wind';
  }
  sort() {
    return 519;
  }
  common() {
    return common;
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
    return [
      { type: 1, f: buffA, fi: 0 },
      { type: 1, f: buffB, fi: 1 },
      {
        ...webglUtils.DEFAULT_NOISE,
        ...webglUtils.TEXTURE_MIPMAPS,
        ...webglUtils.NO_FLIP_Y,
      },
    ];
  }
}
