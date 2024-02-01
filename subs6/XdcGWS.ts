import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// Shader Rally - @P_Malin

// Physics Hackery using the new mutipass things.

// WASD to drive. Space = brake
// G toggle gravity
// V toggle wheels (vehicle forces)
// . and , flip car

// Simulation Shader

//#define ENABLE_DEBUG_FORCES
#define ENABLE_GRAVITY_TOGGLE

ivec2 addrVehicle = ivec2( 0.0, 0.0 );

ivec2 offsetVehicleParam0 = ivec2( 0.0, 0.0 );

ivec2 offsetVehicleBody = ivec2( 1.0, 0.0 );
ivec2 offsetBodyPos = ivec2( 0.0, 0.0 );
ivec2 offsetBodyRot = ivec2( 1.0, 0.0 );
ivec2 offsetBodyMom = ivec2( 2.0, 0.0 );
ivec2 offsetBodyAngMom = ivec2( 3.0, 0.0 );

ivec2 offsetVehicleWheel0 = ivec2( 5.0, 0.0 );
ivec2 offsetVehicleWheel1 = ivec2( 7.0, 0.0 );
ivec2 offsetVehicleWheel2 = ivec2( 9.0, 0.0 );
ivec2 offsetVehicleWheel3 = ivec2( 11.0, 0.0 );

ivec2 offsetWheelState = ivec2( 0.0, 0.0 );
ivec2 offsetWheelContactState = ivec2( 1.0, 0.0 );


ivec2 addrCamera = ivec2( 0.0, 1.0 );
ivec2 offsetCameraPos = ivec2( 0.0, 0.0 );
ivec2 offsetCameraTarget = ivec2( 1.0, 0.0 );

ivec2 addrPrevCamera = ivec2( 0.0, 2.0 );

/////////////////////////
// Constants

float PI = acos(-1.0);

/////////////////////////
// Storage

vec4 LoadVec4( in ivec2 vAddr )
{
    return texelFetch( iChannel0, vAddr, 0 );
}

vec3 LoadVec3( in ivec2 vAddr )
{
    return LoadVec4( vAddr ).xyz;
}

bool AtAddress( vec2 p, ivec2 c ) { return all( equal( floor(p), vec2(c) ) ); }

void StoreVec4( in ivec2 vAddr, in vec4 vValue, inout vec4 fragColor, in vec2 fragCoord )
{
    fragColor = AtAddress( fragCoord, vAddr ) ? vValue : fragColor;
}

void StoreVec3( in ivec2 vAddr, in vec3 vValue, inout vec4 fragColor, in vec2 fragCoord )
{
    StoreVec4( vAddr, vec4( vValue, 0.0 ), fragColor, fragCoord);
}


/////////////////////////

// Keyboard 


// Keyboard constants definition
const int KEY_SPACE = 32;
const int KEY_LEFT  = 37;
const int KEY_UP    = 38;
const int KEY_RIGHT = 39;
const int KEY_DOWN  = 40;
const int KEY_A     = 65;
const int KEY_B     = 66;
const int KEY_C     = 67;
const int KEY_D     = 68;
const int KEY_E     = 69;
const int KEY_F     = 70;
const int KEY_G     = 71;
const int KEY_H     = 72;
const int KEY_I     = 73;
const int KEY_J     = 74;
const int KEY_K     = 75;
const int KEY_L     = 76;
const int KEY_M     = 77;
const int KEY_N     = 78;
const int KEY_O     = 79;
const int KEY_P     = 80;
const int KEY_Q     = 81;
const int KEY_R     = 82;
const int KEY_S     = 83;
const int KEY_T     = 84;
const int KEY_U     = 85;
const int KEY_V     = 86;
const int KEY_W     = 87;
const int KEY_X     = 88;
const int KEY_Y     = 89;
const int KEY_Z     = 90;
const int KEY_COMMA = 188;
const int KEY_PER   = 190;

bool KeyIsPressed(int key)
{
	return texelFetch( iChannel1, ivec2(key, 0), 0 ).x > 0.0;
}

bool KeyIsToggled(int key)
{
	return texelFetch( iChannel1, ivec2(key, 2), 0 ).x > 0.0;
}

/////////////////////////
// Rotation

vec2 Rotate( const in vec2 vPos, const in float t )
{
    float s = sin(t);
    float c = cos(t);
    
    return vec2( c * vPos.x + s * vPos.y, -s * vPos.x + c * vPos.y);
}

vec3 RotX( const in vec3 vPos, float t )
{
    vec3 result;
    result.x = vPos.x;
  	result.yz = Rotate( vPos.yz, t );
    return result;
}

vec3 RotY( const in vec3 vPos, float t )
{
    vec3 result;
    result.y = vPos.y;
  	result.xz = Rotate( vPos.xz, t );
    return result;
}

vec3 RotZ( const in vec3 vPos, float t )
{
    vec3 result;
    result.z = vPos.z;
  	result.xy = Rotate( vPos.xy, t );
    return result;
}


/////////////////////////
// Vec

vec3 Vec3Parallel( vec3 x, vec3 n )
{
    float d = dot( x, n );
    
    return x - n * d;    
}

vec3 Vec3Perp( vec3 x, vec3 n )
{
    return x - Vec3Parallel( x, n );
}

/////////////////////////
// Quaternions

vec4 QuatMul(const in vec4 lhs, const in vec4 rhs) 
{
      return vec4( lhs.y*rhs.z - lhs.z*rhs.y + lhs.x*rhs.w + lhs.w*rhs.x,
                   lhs.z*rhs.x - lhs.x*rhs.z + lhs.y*rhs.w + lhs.w*rhs.y,
                   lhs.x*rhs.y - lhs.y*rhs.x + lhs.z*rhs.w + lhs.w*rhs.z,
                   lhs.w*rhs.w - lhs.x*rhs.x - lhs.y*rhs.y - lhs.z*rhs.z);
}

vec4 QuatFromAxisAngle( vec3 vAxis, float fAngle )
{
	return vec4( normalize(vAxis) * sin(fAngle), cos(fAngle) );    
}

vec4 QuatFromVec3( vec3 vRot )
{
    float l = length( vRot );
    if ( l <= 0.0 )
    {
        return vec4( 0.0, 0.0, 0.0, 1.0 );
    }
    return QuatFromAxisAngle( vRot, l );
}

mat3 QuatToMat3( const in vec4 q )
{
	vec4 qSq = q * q;
	float xy2 = q.x * q.y * 2.0;
	float xz2 = q.x * q.z * 2.0;
	float yz2 = q.y * q.z * 2.0;
	float wx2 = q.w * q.x * 2.0;
	float wy2 = q.w * q.y * 2.0;
	float wz2 = q.w * q.z * 2.0;
 
	return mat3 (	
     qSq.w + qSq.x - qSq.y - qSq.z, xy2 - wz2, xz2 + wy2,
     xy2 + wz2, qSq.w - qSq.x + qSq.y - qSq.z, yz2 - wx2,
     xz2 - wy2, yz2 + wx2, qSq.w - qSq.x - qSq.y + qSq.z );
}

vec3 QuatMul( vec3 v, vec4 q )
{
    // TODO Validate vs other quat code
    vec3 t = 2.0 * cross(q.xyz, v);
	return v + q.w * t + cross(q.xyz, t);
}

vec3 ObjToWorld( vec3 v, mat3 m )
{
    return v * m;
}

vec3 WorldToObj( vec3 v, mat3 m )
{
    return m * v;
}


float sdBox( vec3 p, vec3 b )
{
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}


// RAYTRACE

float kFarClip=10.0;

struct SurfaceInfo
{
    vec3 vUVW;
    int iId;
};

struct ClosestSurface
{
    float fDist;
    SurfaceInfo surface;
};
    
void ClosestSurfaceInit( inout ClosestSurface closest, int iId, vec3 vUVW )
{
    closest.fDist = 10000.0;
    closest.surface.vUVW = vUVW;
    closest.surface.iId = iId;
}


ClosestSurface ClosestSurfaceUnion( const in ClosestSurface a, const in ClosestSurface b )
{
    if ( a.fDist < b.fDist )
    {
        return a;
    }

    return b;        
}
    
struct C_Intersection
{
	vec3 vPos;
	float fDist;	
	vec3 vNormal;
    SurfaceInfo surface;
};
    
///////////////////
// Random

#define MOD2 vec2(4.438975,3.972973)
#define MOD3 vec3(.1031,.11369,.13787)
#define MOD4 vec4(.1031,.11369,.13787, .09987)

float Hash( float p ) 
{
    // https://www.shadertoy.com/view/4djSRW - Dave Hoskins
	vec2 p2 = fract(vec2(p) * MOD2);
    p2 += dot(p2.yx, p2.xy+19.19);
	return fract(p2.x * p2.y);    
}

vec3 Hash31(float p)
{
    // https://www.shadertoy.com/view/4djSRW - Dave Hoskins
   vec3 p3 = fract(vec3(p) * MOD3);
   p3 += dot(p3, p3.yzx + 19.19);
   return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

float SmoothNoise(in vec2 o) 
{
	vec2 p = floor(o);
	vec2 f = fract(o);
		
	float n = p.x + p.y*57.0;

	float a = Hash(n+  0.0);
	float b = Hash(n+  1.0);
	float c = Hash(n+ 57.0);
	float d = Hash(n+ 58.0);
	
	vec2 f2 = f * f;
	vec2 f3 = f2 * f;
	
	vec2 t = 3.0 * f2 - 2.0 * f3;
	
	float u = t.x;
	float v = t.y;

	float res = a + (b-a)*u +(c-a)*v + (a-b+d-c)*u*v;
    
    return res;
}

float FBM( vec2 p, float ps ) {
	float f = 0.0;
    float tot = 0.0;
    float a = 1.0;
    for( int i=0; i<3; i++)
    {
        f += SmoothNoise( p ) * a;
        p *= 2.0;
        tot += a;
        a *= ps;
    }
    return f / tot;
}
    
///////////////////
// Scene

#define MAT_TERRAIN 1
#define MAT_CAR_BODY 4
#define MAT_CAR_WINDOW 3
#define MAT_CHROME 3
#define MAT_GRILL 2
#define MAT_BLACK_PLASTIC 2
#define MAT_AXLE 2
#define MAT_WHEEL 5
#define MAT_REAR 2
#define MAT_SUSPENSION 6
#define MAT_WOOD 7

float GetTerrainDistance( const vec3 vPos )
{    
    float fbm = FBM( vPos.xz * vec2(0.5, 1.0), 0.5 );
    float fTerrainHeight = fbm * fbm;
    fTerrainHeight = fTerrainHeight * (sin(vPos.x * 0.1) + 1.0) * 0.5 + vPos.y + 3.0;    
    
    //float h = 1.0 - exp(-abs(vPos.x + 15.0) * 0.01);
    
    //fTerrainHeight += sin(vPos.x * 0.05) * 5.0 * h;
    //fTerrainHeight += sin(vPos.z * 0.05) * 5.0 * h;

	return fTerrainHeight;
}

ClosestSurface GetRampClosestSurface( const vec3 vPos, const float fRampSeed )
{
    ClosestSurface closest;
    
    vec3 vHash = Hash31( fRampSeed );
    
    closest.surface.iId = MAT_WOOD;
    closest.surface.vUVW = vPos.xyz;
    
    float fHeight = 2.0 + vHash.x * 6.0;
    float fRadius = 10.0 + vHash.y * 20.0;
    float fLedge = 2.0 + vHash.z * 3.0;
        
    float h2 = fRadius - fHeight;
    float fLength = sqrt(fRadius * fRadius - h2 * h2);
    fLength = fLength + fLedge;
    closest.fDist = sdBox( vPos - vec3( 0.0, fHeight * 0.5, fLength * 0.5 ), vec3(3.0, fHeight * 0.5, fLength * 0.5));
    

    vec3 vCylDomain = vPos - vec3( 0.0, fRadius, 0.0 );
    float fCylDist = length(vCylDomain.yz) - fRadius;
    
    //closest.fDist = fCylDist;
    
    closest.fDist = max( closest.fDist, -fCylDist);
    
    return closest;
}

ClosestSurface GetEnvironmentClosestSurface( const vec3 vPos )
{
    ClosestSurface terrainClosest;
    terrainClosest.surface.iId = MAT_TERRAIN;
    terrainClosest.surface.vUVW = vec3(vPos.xz,0.0);
    terrainClosest.fDist = GetTerrainDistance( vPos );

    //return terrainClosest;
    
    float fRepeat = 100.0;
    vec3 vRampDomain = vPos - vec3(-15.0, -3.0, 0.0);
    float fRampUnitZ = vRampDomain.z / fRepeat + 0.5;
    float fRampSeed = floor( fRampUnitZ );
    vRampDomain.z = (fract(fRampUnitZ) - 0.5) * fRepeat;
    ClosestSurface rampClosest = GetRampClosestSurface( vRampDomain, fRampSeed );

    return ClosestSurfaceUnion( terrainClosest, rampClosest );
}

ClosestSurface GetSceneClosestSurface( const vec3 vPos )
{    
    ClosestSurface closest = GetEnvironmentClosestSurface( vPos );
    
    return closest;
}

vec3 GetSceneNormal( const in vec3 vPos )
{
    const float fDelta = 0.0001;

    vec3 vDir1 = vec3( 1.0, -1.0, -1.0);
    vec3 vDir2 = vec3(-1.0, -1.0,  1.0);
    vec3 vDir3 = vec3(-1.0,  1.0, -1.0);
    vec3 vDir4 = vec3( 1.0,  1.0,  1.0);
	
    vec3 vOffset1 = vDir1 * fDelta;
    vec3 vOffset2 = vDir2 * fDelta;
    vec3 vOffset3 = vDir3 * fDelta;
    vec3 vOffset4 = vDir4 * fDelta;

    ClosestSurface c1 = GetSceneClosestSurface( vPos + vOffset1 );
    ClosestSurface c2 = GetSceneClosestSurface( vPos + vOffset2 );
    ClosestSurface c3 = GetSceneClosestSurface( vPos + vOffset3 );
    ClosestSurface c4 = GetSceneClosestSurface( vPos + vOffset4 );
	
    vec3 vNormal = vDir1 * c1.fDist + vDir2 * c2.fDist + vDir3 * c3.fDist + vDir4 * c4.fDist;	
		
    return normalize( vNormal );
}

void TraceScene( out C_Intersection outIntersection, const in vec3 vOrigin, const in vec3 vDir )
{	
	vec3 vPos = vec3(0.0);
	
	float t = 0.1;
	const int kRaymarchMaxIter = 32;
	for(int i=0; i<kRaymarchMaxIter; i++)
	{
		float fClosestDist = GetSceneClosestSurface( vOrigin + vDir * t ).fDist;
		t += fClosestDist;
		if(abs(fClosestDist) < 0.01)
		{
			break;
		}		
		if(t > kFarClip)
		{
			t = kFarClip;
			break;
		}
	}
    
	outIntersection.fDist = t;
	outIntersection.vPos = vOrigin + vDir * t;
    
    if( t >= kFarClip )
    {
        outIntersection.surface.iId = 0;
        outIntersection.surface.vUVW = vec3( 0.0 );
        outIntersection.vNormal = vec3(0.0, 1.0, 0.0);
    }
    else
    {
		outIntersection.vNormal = GetSceneNormal( outIntersection.vPos );
        outIntersection.surface = GetSceneClosestSurface( outIntersection.vPos ).surface;
    }
}

///////////////////

struct Body
{
    // Persistent State
    vec3 vPos;
    vec4 qRot;
    vec3 vMomentum;
    vec3 vAngularMomentum;
    
    // Derived
    mat3 mRot;
    
    // Constant
    float fMass;
    float fIT; // Hacky scalar for inertia tensor
    
    // Per frame
    vec3 vForce;
    vec3 vTorque;
};

void BodyLoadState( out Body body, ivec2 addr )
{
    body.vPos = LoadVec3( addr + offsetBodyPos );
    body.qRot = LoadVec4( addr + offsetBodyRot );
    body.vMomentum = LoadVec3( addr + offsetBodyMom );
    body.vAngularMomentum = LoadVec3( addr + offsetBodyAngMom );
}

void BodyStoreState( ivec2 addr, const in Body body, inout vec4 fragColor, in vec2 fragCoord )
{
    StoreVec3( addr + offsetBodyPos, body.vPos, fragColor, fragCoord );
    StoreVec4( addr + offsetBodyRot, body.qRot, fragColor, fragCoord );
    StoreVec3( addr + offsetBodyMom, body.vMomentum, fragColor, fragCoord );
    StoreVec3( addr + offsetBodyAngMom, body.vAngularMomentum, fragColor, fragCoord );
}

void BodyResetForFrame( inout Body body )
{
    body.vForce = vec3(0.0);
    body.vTorque = vec3(0.0);
}

void BodyCalculateDerivedState( inout Body body )
{
    body.mRot = QuatToMat3( body.qRot );    
}

void BodyApplyGravity( inout Body body, float dT )
{
    float fAccel_MpS = -9.81;
    body.vForce.y += body.fMass * fAccel_MpS;
}

void BodyIntegrate( inout Body body, float dT )
{
#ifdef ENABLE_GRAVITY_TOGGLE    
    if( !KeyIsToggled( KEY_G ) )
#endif // ENABLE_GRAVITY_TOGGLE        
    {
    	BodyApplyGravity( body, dT );
    }
    
    body.vMomentum += body.vForce * dT;
    body.vAngularMomentum += body.vTorque * dT;
    
    vec3 vVel = body.vMomentum / body.fMass;
    vec3 vAngVel = body.vAngularMomentum / body.fIT;

    body.vPos += vVel * dT;
    vec4 qAngDelta = QuatFromVec3( vAngVel * dT );
    body.qRot = QuatMul( qAngDelta, body.qRot );

    body.qRot = normalize( body.qRot );
}

void BodyApplyForce( inout Body body, vec3 vPos, vec3 vForce )
{    
    body.vForce += vForce;
    body.vTorque += cross(vPos - body.vPos, vForce);     
}

void BodyApplyImpulse( inout Body body, vec3 vPos, vec3 vImpulse )
{    
    body.vMomentum += vImpulse;
    body.vAngularMomentum += cross(vPos - body.vPos, vImpulse);     
}

vec3 BodyPointVelocity( const in Body body, vec3 vWorldPos )
{
    vec3 vVel = body.vMomentum / body.fMass;
    vec3 vAngVel = body.vAngularMomentum / body.fIT;
    
    return vVel + cross( vAngVel, vWorldPos - body.vPos );
}


void BodyApplyDebugForces( inout Body body )
{
#ifdef ENABLE_DEBUG_FORCES    
    float debugForceMag = 20000.0;
    if ( KeyIsPressed( KEY_LEFT ) )
    {
        vec3 vForcePos = body.vPos;
        vec3 vForce = vec3(-debugForceMag, 0.0, 0.0);
        BodyApplyForce( body, vForcePos, vForce );
    }
    if ( KeyIsPressed( KEY_RIGHT ) )
    {
        vec3 vForcePos = body.vPos;
        vec3 vForce = vec3(debugForceMag, 0.0, 0.0);
        BodyApplyForce( body, vForcePos, vForce );
    }
    if ( KeyIsPressed( KEY_UP ) )
    {
        vec3 vForcePos = body.vPos;
        vec3 vForce = vec3(0.0, 0.0, debugForceMag);
        BodyApplyForce( body, vForcePos, vForce );
    }
    if ( KeyIsPressed( KEY_DOWN ) )
    {
        vec3 vForcePos = body.vPos;
        vec3 vForce = vec3(0.0, 0.0, -debugForceMag);
        BodyApplyForce( body, vForcePos, vForce );
    }
#endif // ENABLE_DEBUG_FORCES                
    
    float debugTorqueMag = 4000.0;
    if ( KeyIsPressed( KEY_COMMA ) )
    {
        vec3 vForcePos = body.vPos;
        vec3 vForce = vec3(0.0, -debugTorqueMag, 0.0);
		vForcePos.x += 2.0;
        BodyApplyForce( body, vForcePos, vForce );
		//vForcePos.x -= 4.0;
        //vForce = -vForce;
        //BodyApplyForce( body, vForcePos, vForce );
    }
    if ( KeyIsPressed( KEY_PER ) )
    {
        vec3 vForcePos = body.vPos;
        vec3 vForce = vec3(0.0, debugTorqueMag, 0.0);
		vForcePos.x += 2.0;
        BodyApplyForce( body, vForcePos, vForce );
		//vForcePos.x -= 4.0;
        //vForce = -vForce;
        //BodyApplyForce( body, vForcePos, vForce );
    }        
}

void BodyCollideShapeSphere( inout Body body, vec3 vSphereOrigin, float fSphereRadius, float dT )
{    
    vec3 vSphereWorld = ObjToWorld( vSphereOrigin, body.mRot) + body.vPos;
    
    ClosestSurface closest = GetSceneClosestSurface( vSphereWorld );
    
    float fDepth = fSphereRadius - closest.fDist;
    
    if ( fDepth < 0.0 )
        return;
    
    vec3 vNormal = GetSceneNormal( vSphereWorld );
    vec3 vHitPos = vSphereWorld - vNormal * closest.fDist;    
    vec3 vPointVel = BodyPointVelocity( body, vHitPos );
    
    float fDot = dot( vPointVel, vNormal );
    
    if( fDot >= 0.0 )
        return;
    
    float fRestitution = 0.5;
    
    vec3 vRelativePos = (vHitPos - body.vPos);
    float fDenom = (1.0/body.fMass );
    float fCr = dot( cross( cross( vRelativePos, vNormal ), vRelativePos), vNormal);
    fDenom += fCr / body.fIT;
    
    float fImpulse = -((1.0 + fRestitution) * fDot) / fDenom;
    
    fImpulse += fDepth / fDenom;
    
    vec3 vImpulse = vNormal * fImpulse;
    
    vec3 vFriction = Vec3Perp( vPointVel, vNormal ) * body.fMass;
    float fLimit = 100000.0;
    float fMag = length(vFriction);
    if( fMag > 0.0 )
    {	        
        vFriction = normalize( vFriction );

        fMag = min( fMag, fLimit );
        vFriction = vFriction * fMag;

        //BodyApplyForce( body, vHitPos, vFriction );
        vImpulse += vFriction * dT;        
    }
    else
    {
        vFriction = vec3(0.0);
    }
    
    BodyApplyImpulse( body, vHitPos, vImpulse );
}
    
void BodyCollide( inout Body body, float dT )
{
    BodyCollideShapeSphere( body, vec3( 0.7, 0.7,  1.5), 0.5, dT );
    BodyCollideShapeSphere( body, vec3(-0.7, 0.7,  1.5), 0.5, dT );
    BodyCollideShapeSphere( body, vec3( 0.7, 0.7, -1.5), 0.5, dT );
    BodyCollideShapeSphere( body, vec3(-0.7, 0.7, -1.5), 0.5, dT );
    BodyCollideShapeSphere( body, vec3( 0.5, 1.0,  0.0), 0.7, dT );
    BodyCollideShapeSphere( body, vec3(-0.5, 1.0,  0.0), 0.7, dT );
}


/////////////////////////
struct Engine
{
    float fAngularMomentum;
};

/////////////////////////

struct Wheel
{
    // Persistent State
    float fSteer;
    float fRotation;
    float fExtension;
    float fAngularVelocity;
    
    // Results
    vec2 vContactPos;
    float fOnGround;
    float fSkid;    
    
    // Constant
	vec3 vBodyPos;    
    float fRadius;
    bool bIsDriven;
    bool bSteering;   
};
    
void WheelLoadState( out Wheel wheel, ivec2 addr )
{    
    vec4 vState = LoadVec4( addr + offsetWheelState );
    
    wheel.fSteer = vState.x;
    wheel.fRotation = vState.y;
    wheel.fExtension = vState.z;
    wheel.fAngularVelocity = vState.w;
    
    // output data
    wheel.vContactPos = vec2( 0.0 );
    wheel.fOnGround = 0.0;
    wheel.fSkid = 0.0;
}
    
void WheelStoreState( ivec2 addr, const in Wheel wheel, inout vec4 fragColor, in vec2 fragCoord )
{
    vec4 vState = vec4( wheel.fSteer, wheel.fRotation, wheel.fExtension, wheel.fAngularVelocity );
    StoreVec4( addr + offsetWheelState, vState, fragColor, fragCoord );

    vec4 vState2 = vec4( wheel.vContactPos.xy, wheel.fOnGround, wheel.fSkid );
    StoreVec4( addr + offsetWheelContactState , vState2, fragColor, fragCoord );
}

C_Intersection WheelTrace( vec3 vPos, vec3 vDir, Wheel wheel )
{
    C_Intersection intersection;
	TraceScene( intersection, vPos - vDir * wheel.fRadius, vDir );
    
    return intersection;
}


float ClampTyreForce( inout vec3 vVel, float fLimit )
{
    // Square clamp
    //vVelWheel.x = clamp( vVelWheel.x, -fLimit, fLimit);
    //vVelWheel.z = clamp( vVelWheel.z, -fLimit, fLimit);
	float fSkid = 0.0;
    
    // Circluar clamp
    float fMag = length(vVel);
    if( fMag > 0.0 )
    {	        
        vVel = normalize( vVel );
    }
    else
    {
        vVel = vec3(0.0);
    }
    if ( fMag > fLimit )
    {
        fSkid = fMag - fLimit;
	    fMag = fLimit;        
    }
    vVel = vVel * fMag;
    
    return fSkid;
}

void WheelUpdate( inout Engine engine, inout Body body, inout Wheel wheel, float dT )
{
    vec3 vWheelWorld = ObjToWorld( wheel.vBodyPos, body.mRot) + body.vPos;
    vec3 vWheelDown = ObjToWorld( vec3(0.0, -1.0, 0.0), body.mRot);
    
    float fSuspensionTravel = 0.25;
    C_Intersection intersection = WheelTrace( vWheelWorld, vWheelDown, wheel );
    
    float fTravel = clamp( intersection.fDist - wheel.fRadius, 0.0, fSuspensionTravel);
        
    // Apply suspension force
    // Simple spring-damper
    // (No anti-roll bar)
    float fWheelExt = fTravel / fSuspensionTravel;

    wheel.fOnGround = 1.0 - fWheelExt;
    
    float delta = (wheel.fExtension - fTravel) / fSuspensionTravel;

    float fForce = (1.0 - fWheelExt) * 5000.0 + delta * 15000.0;

    vec3 vForce = Vec3Perp( intersection.vNormal, vWheelDown) * fForce;
    //BodyApplyForce( body, vWheelWorld, vForce );                

    // Apply Tyre force

    // Super simplification of wheel / drivetrain / engine / tyre contact
    // ignoring engine / wheel angular momentum       

    // Figure out how contact patch is moving in world space
    vec3 vIntersectWorld = intersection.vPos;
    wheel.vContactPos = vIntersectWorld.xz;
    vec3 vVelWorld = BodyPointVelocity( body, vIntersectWorld );

    // Transform to body space
    vec3 vVelBody = WorldToObj( vVelWorld, body.mRot );

    // Transform to wheel space
    vec3 vVelWheel = RotY( vVelBody, wheel.fSteer );

    float fWScale = wheel.fRadius;

    float fWheelMOI = 20.0;
    if ( wheel.bIsDriven )
    {
        fWheelMOI = 30.0;

        // consta-torque mega engine
        if( KeyIsPressed( KEY_W ) )
        {
            wheel.fAngularVelocity += 2.0;
        }        

        if( KeyIsPressed( KEY_S ) )
        {
            wheel.fAngularVelocity -= 2.0;
        }        
    }

    if( KeyIsPressed( KEY_SPACE ) )
    {
        wheel.fAngularVelocity = 0.0; // insta-grip super brake
    }        

    vVelWheel.z -= wheel.fAngularVelocity * fWScale;

    vec3 vForceWheel = vVelWheel * body.fMass;

    // Hacked 'slip angle'
    //vForceWheel.x /=  1.0 + abs(wheel.fAngularVelocity * fWScale) * 0.1;

    float fLimit = 9000.0 * (1.0 - fWheelExt);

    wheel.fSkid = ClampTyreForce( vForceWheel, fLimit );    
    
    //vVelWheel.z += wheel.fAngularVelocity * fWScale;
    vec3 vForceBody = RotY( vForceWheel, -wheel.fSteer );

    // Apply force back on wheel

    wheel.fAngularVelocity += ((vForceWheel.z / fWScale) / fWheelMOI) * dT;

    vec3 vForceWorld = ObjToWorld( vForceBody, body.mRot );

    // cancel in normal dir
    vForceWorld = Vec3Parallel( vForceWorld, intersection.vNormal );

    vForce -= vForceWorld;
    //BodyApplyForce( body, vIntersectWorld, -vForceWorld );        
    
    BodyApplyForce( body, vIntersectWorld, vForce );        

    wheel.fExtension = fTravel;
    wheel.fRotation += wheel.fAngularVelocity * dT;    
}

void WheelUpdateSteerAngle( float fSteerAngle, inout Wheel wheel )
{
    if ( !wheel.bSteering )
    {
        wheel.fSteer = 0.0;
    }
    else
    {
        // figure out turning circle if wheel was central
        float turningCircle = wheel.vBodyPos.z / tan( fSteerAngle );
        float wheelTurningCircle = turningCircle - wheel.vBodyPos.x;
        wheel.fSteer = atan( abs(wheel.vBodyPos.z) / wheelTurningCircle);
    }
}

struct Vechicle
{
    Body body;    
    Engine engine;
    Wheel wheel[4];
    
    float fSteerAngle;
};

void VehicleLoadState( out Vechicle vehicle, ivec2 addr )
{    
    BodyLoadState( vehicle.body, addr + offsetVehicleBody );
    WheelLoadState( vehicle.wheel[0], addr + offsetVehicleWheel0 );
    WheelLoadState( vehicle.wheel[1], addr + offsetVehicleWheel1 );
    WheelLoadState( vehicle.wheel[2], addr + offsetVehicleWheel2 );
    WheelLoadState( vehicle.wheel[3], addr + offsetVehicleWheel3 );
    
    vec4 vParam0;
    vParam0 = LoadVec4( addr + offsetVehicleParam0 );
    vehicle.fSteerAngle = vParam0.x;
}

void VehicleStoreState( ivec2 addr, const in Vechicle vehicle, inout vec4 fragColor, in vec2 fragCoord )
{
    BodyStoreState( addr + offsetVehicleBody, vehicle.body, fragColor, fragCoord );
    WheelStoreState( addr + offsetVehicleWheel0, vehicle.wheel[0], fragColor, fragCoord );
    WheelStoreState( addr + offsetVehicleWheel1, vehicle.wheel[1], fragColor, fragCoord );
    WheelStoreState( addr + offsetVehicleWheel2, vehicle.wheel[2], fragColor, fragCoord );
    WheelStoreState( addr + offsetVehicleWheel3, vehicle.wheel[3], fragColor, fragCoord );

    vec4 vParam0 = vec4( vehicle.fSteerAngle, 0.0, 0.0, 0.0 );
    StoreVec4( addr + offsetVehicleParam0, vParam0, fragColor, fragCoord);
}

void VehicleResetForFrame( inout Vechicle vehicle )
{
    BodyResetForFrame( vehicle.body );
}

void VehicleSetup( inout Vechicle vehicle )
{
    vehicle.body.fMass = 1000.0;
    vehicle.body.fIT = 1000.0;

    vehicle.engine.fAngularMomentum = 0.0; // TODO : Move to state
    
    vehicle.wheel[0].vBodyPos = vec3( -0.9, -0.1, 1.25 );
    vehicle.wheel[1].vBodyPos = vec3(  0.9, -0.1, 1.25 );
    vehicle.wheel[2].vBodyPos = vec3( -0.9, -0.1, -1.25 );
    vehicle.wheel[3].vBodyPos = vec3(  0.9, -0.1, -1.25 );
    
    vehicle.wheel[0].fRadius = 0.45;
    vehicle.wheel[1].fRadius = 0.45;
    vehicle.wheel[2].fRadius = 0.45;
    vehicle.wheel[3].fRadius = 0.45; 
    
    vehicle.wheel[0].bIsDriven = false;
    vehicle.wheel[1].bIsDriven = false;
    vehicle.wheel[2].bIsDriven = true;
    vehicle.wheel[3].bIsDriven = true;    
    
    vehicle.wheel[0].bSteering = true;
    vehicle.wheel[1].bSteering = true;
    vehicle.wheel[2].bSteering = false;
    vehicle.wheel[3].bSteering = false;   
}


struct Camera
{
    vec3 vPos;
    vec3 vTarget;
};

void CameraLoadState( out Camera cam, in ivec2 addr )
{
	cam.vPos = LoadVec3( addr + offsetCameraPos );
	cam.vTarget = LoadVec3( addr + offsetCameraTarget );
}

void CameraStoreState( Camera cam, in ivec2 addr, inout vec4 fragColor, in vec2 fragCoord )
{
    StoreVec3( addr + offsetCameraPos, cam.vPos, fragColor, fragCoord );
    StoreVec3( addr + offsetCameraTarget, cam.vTarget, fragColor, fragCoord );    
}
    
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    if (( fragCoord.x > 13.0 ) || ( fragCoord.y > 3.0 ) )
    {
        fragColor = vec4(0.0);
        return;
    }
    
    
    Vechicle vehicle;
    
    VehicleLoadState( vehicle, addrVehicle );
    VehicleSetup( vehicle );
    VehicleResetForFrame( vehicle );

    if ( iFrame < 1 )
    {        
        vehicle.body.vPos = vec3( 0.0, -2.5, 0.0 );
        vehicle.body.vMomentum = vec3( 0.0 );
        vehicle.body.qRot = vec4( 0.0, 0.0, 0.0, 1.0 );
        vehicle.body.vAngularMomentum = vec3( 0.0, 0.5, 0.0 );        
        
        vehicle.fSteerAngle = 0.0;
    }

    BodyCalculateDerivedState( vehicle.body );
    
    // TODO: dT for steering
    if ( KeyIsPressed( KEY_A ) )
    {
        vehicle.fSteerAngle += 0.05;
    }    
    if ( KeyIsPressed( KEY_D ) )
    {
        vehicle.fSteerAngle -= 0.05;
    }    
    
    vehicle.fSteerAngle *= 0.9;
    
    float fSteerAngle = vehicle.fSteerAngle / ( 1.0 + length(vehicle.body.vMomentum) * 0.0001 );
    
    WheelUpdateSteerAngle( fSteerAngle, vehicle.wheel[0] );
    WheelUpdateSteerAngle( fSteerAngle, vehicle.wheel[1] );
    WheelUpdateSteerAngle( fSteerAngle, vehicle.wheel[2] );
    WheelUpdateSteerAngle( fSteerAngle, vehicle.wheel[3] );
    
    float dT = 1.0 / 60.0;

	if ( !KeyIsToggled( KEY_V ) )
    {
        WheelUpdate( vehicle.engine, vehicle.body, vehicle.wheel[0], dT );
        WheelUpdate( vehicle.engine, vehicle.body, vehicle.wheel[1], dT );
        WheelUpdate( vehicle.engine, vehicle.body, vehicle.wheel[2], dT );
        WheelUpdate( vehicle.engine, vehicle.body, vehicle.wheel[3], dT );
    }
    
	BodyApplyDebugForces( vehicle.body );
    BodyCollide( vehicle.body, dT );
    BodyIntegrate( vehicle.body, dT );

    fragColor = vec4( 0.0 );
    
    VehicleStoreState( addrVehicle, vehicle, fragColor, fragCoord );
    
  
    Camera prevCam;
    
    // load old camera data
    CameraLoadState( prevCam, addrCamera );

    // store in addrPrevCamera
    CameraStoreState( prevCam, addrPrevCamera, fragColor, fragCoord );
    
    Camera cam;
    
	vec2 vMouse = iMouse.xy / iResolution.xy;
	float fAngle = (-vMouse.x * 2.0 + 1.0) * 3.14;
   	float fDistance = 8.0 - vMouse.y * 6.0;
    
    cam.vTarget = vec3( 0.0, 1.0, 0.0 ) * vehicle.body.mRot + vehicle.body.vPos;
    cam.vPos = vec3( 0.0, 0.0, -fDistance ) * vehicle.body.mRot + vehicle.body.vPos + vec3(0.0, 2.0, 0.0);
    
    cam.vPos -= cam.vTarget;
    cam.vPos = RotY( cam.vPos, fAngle );
    cam.vPos += cam.vTarget;
            
    CameraStoreState( cam, addrCamera, fragColor, fragCoord );

    fragColor.a = 1.;
}
`;

const buffB = `
// Tyre track buffer rendering shader

ivec2 addrVehicle = ivec2( 0.0, 0.0 );

ivec2 offsetVehicleParam0 = ivec2( 0.0, 0.0 );

ivec2 offsetVehicleBody = ivec2( 1.0, 0.0 );
ivec2 offsetBodyPos = ivec2( 0.0, 0.0 );
ivec2 offsetBodyRot = ivec2( 1.0, 0.0 );
ivec2 offsetBodyMom = ivec2( 2.0, 0.0 );
ivec2 offsetBodyAngMom = ivec2( 3.0, 0.0 );

ivec2 offsetVehicleWheel0 = ivec2( 5.0, 0.0 );
ivec2 offsetVehicleWheel1 = ivec2( 7.0, 0.0 );
ivec2 offsetVehicleWheel2 = ivec2( 9.0, 0.0 );
ivec2 offsetVehicleWheel3 = ivec2( 11.0, 0.0 );

ivec2 offsetWheelState = ivec2( 0.0, 0.0 );
ivec2 offsetWheelContactState = ivec2( 1.0, 0.0 );


ivec2 addrCamera = ivec2( 0.0, 1.0 );
ivec2 offsetCameraPos = ivec2( 0.0, 0.0 );
ivec2 offsetCameraTarget = ivec2( 1.0, 0.0 );

ivec2 addrPrevCamera = ivec2( 0.0, 2.0 );

/////////////////////////
// Storage

vec4 LoadVec4( in ivec2 vAddr )
{
    return texelFetch( iChannel0, vAddr, 0 );
}

vec3 LoadVec3( in ivec2 vAddr )
{
    return LoadVec4( vAddr ).xyz;
}

bool AtAddress( vec2 p, ivec2 c ) { return all( equal( floor(p), vec2(c) ) ); }

void StoreVec4( in ivec2 vAddr, in vec4 vValue, inout vec4 fragColor, in vec2 fragCoord )
{
    fragColor = AtAddress( fragCoord, vAddr ) ? vValue : fragColor;
}

void StoreVec3( in ivec2 vAddr, in vec3 vValue, inout vec4 fragColor, in vec2 fragCoord )
{
    StoreVec4( vAddr, vec4( vValue, 0.0 ), fragColor, fragCoord);
}



struct Camera
{
    vec3 vPos;
    vec3 vTarget;
};

void CameraLoadState( out Camera cam, in ivec2 addr )
{
	cam.vPos = LoadVec3( addr + offsetCameraPos );
	cam.vTarget = LoadVec3( addr + offsetCameraTarget );
}




void UpdateTyreTracks( vec3 vCamPosPrev, vec3 vCamPos, inout vec4 fragColor, in vec2 fragCoord )
{
    float fRange = 20.0;
    vec2 vPrevOrigin = floor( vCamPosPrev.xz );
    vec2 vCurrOrigin = floor( vCamPos.xz );

    vec2 vFragOffset = ((fragCoord / iResolution.xy) * 2.0 - 1.0) * fRange;
    vec2 vFragWorldPos = vFragOffset + vCurrOrigin;
	
    vec2 vPrevFragOffset = vFragWorldPos - vPrevOrigin;
	vec2 vPrevUV = ( (vPrevFragOffset / fRange) + 1.0 ) / 2.0;
    vec4 vPrevSample = textureLod( iChannel1, vPrevUV, 0.0 );
    
    vec4 vWheelContactState[4];
    vWheelContactState[0] = LoadVec4( addrVehicle + offsetVehicleWheel0 + offsetWheelContactState );
    vWheelContactState[1] = LoadVec4( addrVehicle + offsetVehicleWheel1 + offsetWheelContactState );
    vWheelContactState[2] = LoadVec4( addrVehicle + offsetVehicleWheel2 + offsetWheelContactState );
    vWheelContactState[3] = LoadVec4( addrVehicle + offsetVehicleWheel3 + offsetWheelContactState );
    
    fragColor = vPrevSample;
    
    if ( vPrevUV.x < 0.0 || vPrevUV.x >= 1.0 || vPrevUV.y < 0.0 || vPrevUV.y >= 1.0 )
    {
        fragColor = vec4(0.0);
    }
    
    for ( int w=0; w<4; w++ )
    {        
        vec2 vContactPos = vWheelContactState[w].xy;
        
        float fDist = length( vFragWorldPos - vContactPos );
        
        if ( vWheelContactState[w].z > 0.01 )
        {
            float fAmount = smoothstep( 0.25, 0.1, fDist );
            fragColor.x = max(fragColor.x, fAmount * vWheelContactState[w].z );
            
            fragColor.y = max(fragColor.y, fAmount * vWheelContactState[w].w * 0.01);
        }		
    }
    
    
    fragColor.x = clamp( fragColor.x, 0.0, 1.0);
    fragColor.y = clamp( fragColor.y, 0.0, 1.0);
    
    if( iFrame < 1 )
    {
    	fragColor.x = 0.0;  
    }
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    fragColor = vec4(0.0,0.0, 0.0, 1.0);
    
    Camera cam;
    CameraLoadState( cam, addrCamera );

    Camera prevCam;    
    CameraLoadState( prevCam, addrPrevCamera );
    
    UpdateTyreTracks( prevCam.vPos, cam.vPos, fragColor, fragCoord );  
    
    fragColor.a = 1.;
}
`;

const buffC = `
// Shader Rally - @P_Malin

// Main HDR scene shader

// Uncomment the next line to speed things up a bit
//#define FAST_VERSION
//#define SHOW_PHYSICS_SHAPE

#define RAYTRACE_COUNT 2

vec3 g_pixelRandom;

ivec2 addrVehicle = ivec2( 0.0, 0.0 );

ivec2 offsetVehicleParam0 = ivec2( 0.0, 0.0 );

ivec2 offsetVehicleBody = ivec2( 1.0, 0.0 );
ivec2 offsetBodyPos = ivec2( 0.0, 0.0 );
ivec2 offsetBodyRot = ivec2( 1.0, 0.0 );
ivec2 offsetBodyMom = ivec2( 2.0, 0.0 );
ivec2 offsetBodyAngMom = ivec2( 3.0, 0.0 );

ivec2 offsetVehicleWheel0 = ivec2( 5.0, 0.0 );
ivec2 offsetVehicleWheel1 = ivec2( 7.0, 0.0 );
ivec2 offsetVehicleWheel2 = ivec2( 9.0, 0.0 );
ivec2 offsetVehicleWheel3 = ivec2( 11.0, 0.0 );

ivec2 offsetWheelState = ivec2( 0.0, 0.0 );
ivec2 offsetWheelContactState = ivec2( 1.0, 0.0 );


ivec2 addrCamera = ivec2( 0.0, 1.0 );
ivec2 offsetCameraPos = ivec2( 0.0, 0.0 );
ivec2 offsetCameraTarget = ivec2( 1.0, 0.0 );

ivec2 addrPrevCamera = ivec2( 0.0, 2.0 );

/////////////////////////
// Storage

vec4 LoadVec4( in ivec2 vAddr )
{
    return texelFetch( iChannel0, vAddr, 0 );
}

vec3 LoadVec3( in ivec2 vAddr )
{
    return LoadVec4( vAddr ).xyz;
}

bool AtAddress( vec2 p, ivec2 c ) { return all( equal( floor(p), vec2(c) ) ); }

void StoreVec4( in ivec2 vAddr, in vec4 vValue, inout vec4 fragColor, in vec2 fragCoord )
{
    fragColor = AtAddress( fragCoord, vAddr ) ? vValue : fragColor;
}

void StoreVec3( in ivec2 vAddr, in vec3 vValue, inout vec4 fragColor, in vec2 fragCoord )
{
    StoreVec4( vAddr, vec4( vValue, 0.0 ), fragColor, fragCoord);
}


mat3 QuatToMat3( const in vec4 q )
{
	vec4 qSq = q * q;
	float xy2 = q.x * q.y * 2.0;
	float xz2 = q.x * q.z * 2.0;
	float yz2 = q.y * q.z * 2.0;
	float wx2 = q.w * q.x * 2.0;
	float wy2 = q.w * q.y * 2.0;
	float wz2 = q.w * q.z * 2.0;
 
	return mat3 (	
     qSq.w + qSq.x - qSq.y - qSq.z, xy2 - wz2, xz2 + wy2,
     xy2 + wz2, qSq.w - qSq.x + qSq.y - qSq.z, yz2 - wx2,
     xz2 - wy2, yz2 + wx2, qSq.w - qSq.x - qSq.y + qSq.z );
}


/////////////////////////
// Rotation

vec2 Rotate( const in vec2 vPos, const in float t )
{
    float s = sin(t);
    float c = cos(t);
    
    return vec2( c * vPos.x + s * vPos.y, -s * vPos.x + c * vPos.y);
}

vec2 Rotate( const in vec2 vPos, const in vec2 sc )
{
    return vec2( sc.y * vPos.x + sc.x * vPos.y, -sc.x * vPos.x + sc.y * vPos.y);
}

vec3 RotX( const in vec3 vPos, float t )
{
    vec3 result;
    result.x = vPos.x;
  	result.yz = Rotate( vPos.yz, t );
    return result;
}

vec3 RotY( const in vec3 vPos, float t )
{
    vec3 result;
    result.y = vPos.y;
  	result.xz = Rotate( vPos.xz, t );
    return result;
}

vec3 RotZ( const in vec3 vPos, float t )
{
    vec3 result;
    result.z = vPos.z;
  	result.xy = Rotate( vPos.xy, t );
    return result;
}

vec3 RotX( const in vec3 vPos, vec2 sc )
{
    vec3 result;
    result.x = vPos.x;
  	result.yz = Rotate( vPos.yz, sc );
    return result;
}

vec3 RotY( const in vec3 vPos, vec2 sc )
{
    vec3 result;
    result.y = vPos.y;
  	result.xz = Rotate( vPos.xz, sc );
    return result;
}

vec3 RotZ( const in vec3 vPos, vec2 sc )
{
    vec3 result;
    result.z = vPos.z;
  	result.xy = Rotate( vPos.xy, sc );
    return result;
}


/////////////////




float kFarClip=1000.0;

vec2 GetWindowCoord( const in vec2 vUV );
vec2 GetUVFromWindowCoord( const in vec2 vWindow );
vec3 GetCameraRayDir( const in vec2 vWindow, const in vec3 vCameraPos, const in vec3 vCameraTarget );
vec2 GetCameraWindowCoord(const in vec3 vWorldPos, const in vec3 vCameraPos, const in vec3 vCameraTarget);
vec3 GetSceneColour( in vec3 vRayOrigin,  in vec3 vRayDir, out float fDepth );
vec3 ApplyPostFX( const in vec2 vUV, const in vec3 vInput );
vec3 Hash32( vec2 p );

vec2 g_TyreTrackOrigin;

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    g_pixelRandom = normalize( Hash32(fragCoord.xy + iTime) );
    
	vec2 vUV = fragCoord.xy / iResolution.xy;

	vec3 vCameraPos = LoadVec3( addrCamera + offsetCameraPos );
	vec3 vCameraTarget = LoadVec3( addrCamera + offsetCameraTarget );
    
    g_TyreTrackOrigin = floor(vCameraPos.xz);
    
	vec3 vRayOrigin = vCameraPos;
	vec3 vRayDir = GetCameraRayDir( GetWindowCoord(vUV), vCameraPos, vCameraTarget );
	
    float fDepth;
	vec3 vResult = GetSceneColour(vRayOrigin, vRayDir, fDepth);
    vResult = max( vResult, vec3(0.0));
	    
	fragColor = vec4(vResult, fDepth);
}

// CAMERA

vec2 GetWindowCoord( const in vec2 vUV )
{
	vec2 vWindow = vUV * 2.0 - 1.0;
	vWindow.x *= iResolution.x / iResolution.y;

	return vWindow;	
}

vec2 GetUVFromWindowCoord( const in vec2 vWindow )
{
	vec2 vScaledWindow = vWindow;
    vScaledWindow.x *= iResolution.y / iResolution.x;
    
	 return vScaledWindow * 0.5 + 0.5;
}


vec3 GetCameraRayDir( const in vec2 vWindow, const in vec3 vCameraPos, const in vec3 vCameraTarget )
{
	vec3 vForward = normalize(vCameraTarget - vCameraPos);
	vec3 vRight = normalize(cross(vec3(0.0, 1.0, 0.0), vForward));
	vec3 vUp = normalize(cross(vForward, vRight));
							  
	vec3 vDir = normalize(vWindow.x * vRight + vWindow.y * vUp + vForward * 2.0);

	return vDir;
}

vec2 GetCameraWindowCoord(const in vec3 vWorldPos, const in vec3 vCameraPos, const in vec3 vCameraTarget)
{
	vec3 vForward = normalize(vCameraTarget - vCameraPos);
	vec3 vRight = normalize(cross(vec3(0.0, 1.0, 0.0), vForward));
	vec3 vUp = normalize(cross(vForward, vRight));
	
    vec3 vOffset = vWorldPos - vCameraPos;
    vec3 vCameraLocal;
    vCameraLocal.x = dot(vOffset, vRight);
    vCameraLocal.y = dot(vOffset, vUp);
    vCameraLocal.z = dot(vOffset, vForward);

    vec2 vWindowPos = vCameraLocal.xy / (vCameraLocal.z / 2.0);
    
    return vWindowPos;
}

// RAYTRACE

struct SurfaceInfo
{
    vec3 vUVW;
    int iId;
};

struct ClosestSurface
{
    float fDist;
    SurfaceInfo surface;
};
    
void ClosestSurfaceInit( inout ClosestSurface closest, int iId, vec3 vUVW )
{
    closest.fDist = kFarClip;
    closest.surface.vUVW = vUVW;
    closest.surface.iId = iId;
}


ClosestSurface ClosestSurfaceUnion( const in ClosestSurface a, const in ClosestSurface b )
{
    if ( a.fDist < b.fDist )
    {
        return a;
    }

    return b;        
}
    
struct C_Intersection
{
	vec3 vPos;
	float fDist;	
	vec3 vNormal;
    SurfaceInfo surface;
};

vec2 Segment( vec3 vPos, vec3 vP0, vec3 vP1 )
{
	vec3 pa = vPos - vP0;
	vec3 ba = vP1 - vP0;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	
	return vec2( length( pa - ba*h ), h );
}

float SdCapsule( vec3 vPos, vec3 vP0, vec3 vP1, float r0, float r1 )
{
    vec2 vC = Segment( vPos, vP0, vP1 );
    
    return vC.x - mix(r0, r1, vC.y);
}

float SdBox( vec3 p, vec3 b )
{
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

float SdSphere( vec3 p, float r )
{
    return length(p) - r;
}

float UdRoundBox( vec3 p, vec3 b, float r )
{
  return length(max(abs(p)-b,0.0))-r;
}

float smin( float a, float b, float k )
{
    float h = clamp( 0.5+0.5*(b-a)/k, 0.0, 1.0 );
    return mix( b, a, h ) - k*h*(1.0-h);
}

float udRoundBox( vec3 p, vec3 b, float r )
{
  return length(max(abs(p)-b,0.0))-r;
}

float sdBox( vec3 p, vec3 b )
{
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

///////////////////
// Scene State

struct VehicleState
{
    vec3 vPos;
    
    vec4 qRot;
    mat3 mRot;
    
	vec4 vWheelState0;
	vec4 vWheelState1;
	vec4 vWheelState2;
	vec4 vWheelState3;
    
    vec4 vWheelSC0;
    vec4 vWheelSC1;
    vec4 vWheelSC2;
    vec4 vWheelSC3;
};

struct SceneState
{
    VehicleState vehicleState;
};
    
SceneState SetupSceneState()
{
    SceneState sceneState;
    
    sceneState.vehicleState.vPos = LoadVec3( addrVehicle + offsetVehicleBody + offsetBodyPos );
    
    sceneState.vehicleState.qRot = LoadVec4( addrVehicle + offsetVehicleBody + offsetBodyRot );
    sceneState.vehicleState.mRot = QuatToMat3( sceneState.vehicleState.qRot );

    vec4 vWheelState0 = LoadVec4( addrVehicle + offsetVehicleWheel0 );
    vec4 vWheelState1 = LoadVec4( addrVehicle + offsetVehicleWheel1 );
    vec4 vWheelState2 = LoadVec4( addrVehicle + offsetVehicleWheel2 );
    vec4 vWheelState3 = LoadVec4( addrVehicle + offsetVehicleWheel3 );
    
    sceneState.vehicleState.vWheelState0 = vWheelState0;
    sceneState.vehicleState.vWheelState1 = vWheelState1;
    sceneState.vehicleState.vWheelState2 = vWheelState2;
    sceneState.vehicleState.vWheelState3 = vWheelState3;
    
    sceneState.vehicleState.vWheelSC0 = vec4( sin(vWheelState0.x), cos(vWheelState0.x), sin(vWheelState0.y), cos(vWheelState0.y) );
    sceneState.vehicleState.vWheelSC1 = vec4( sin(vWheelState1.x), cos(vWheelState1.x), sin(vWheelState1.y), cos(vWheelState1.y) );
    sceneState.vehicleState.vWheelSC2 = vec4( sin(vWheelState2.x), cos(vWheelState2.x), sin(vWheelState2.y), cos(vWheelState2.y) );
    sceneState.vehicleState.vWheelSC3 = vec4( sin(vWheelState3.x), cos(vWheelState3.x), sin(vWheelState3.y), cos(vWheelState3.y) );
    
    return sceneState;
}

///////////////////
// Random

#define MOD2 vec2(4.438975,3.972973)
#define MOD3 vec3(.1031,.11369,.13787)
#define MOD4 vec4(.1031,.11369,.13787, .09987)
#define HASHSCALE .1031

float Hash( float p ) 
{
    // https://www.shadertoy.com/view/4djSRW - Dave Hoskins
	vec2 p2 = fract(vec2(p) * MOD2);
    p2 += dot(p2.yx, p2.xy+19.19);
	return fract(p2.x * p2.y);    
}

vec3 Hash31(float p)
{
    // https://www.shadertoy.com/view/4djSRW - Dave Hoskins
   vec3 p3 = fract(vec3(p) * MOD3);
   p3 += dot(p3, p3.yzx + 19.19);
   return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

vec3 Hash32(vec2 p)
{
	vec3 p3 = fract(vec3(p.xyx) * HASHSCALE);
    p3 += dot(p3, p3.yxz+19.19);
    return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

float SmoothNoise(in vec2 o) 
{
	vec2 p = floor(o);
	vec2 f = fract(o);
		
	float n = p.x + p.y*57.0;

	float a = Hash(n+  0.0);
	float b = Hash(n+  1.0);
	float c = Hash(n+ 57.0);
	float d = Hash(n+ 58.0);
	
	vec2 f2 = f * f;
	vec2 f3 = f2 * f;
	
	vec2 t = 3.0 * f2 - 2.0 * f3;
	
	float u = t.x;
	float v = t.y;

	float res = a + (b-a)*u +(c-a)*v + (a-b+d-c)*u*v;
    
    return res;
}

float FBM( vec2 p, float ps ) {
	float f = 0.0;
    float tot = 0.0;
    float a = 1.0;
#ifndef FAST_VERSION
    for( int i=0; i<3; i++)
#endif
    {
        f += SmoothNoise( p ) * a;
        p *= 2.0;
        tot += a;
        a *= ps;
    }
    return f / tot;
}


///////////////////
// Scene

#define MAT_TERRAIN 1
#define MAT_WOOD 2

#define MAT_CAR_BODY 3
#define MAT_CHROME 4
#define MAT_GRILL 5
#define MAT_BLACK_PLASTIC 5
#define MAT_AXLE 5
#define MAT_REAR 5
#define MAT_WHEEL 6
#define MAT_SUSPENSION 7

// Motion blur mask
#define MAT_FIRST_VEHICLE MAT_CAR_BODY

float GetTerrainDistance( const vec3 vPos )
{    
    float fbm = FBM( vPos.xz * vec2(0.5, 1.0), 0.5 );
    float fTerrainHeight = fbm * fbm;
    fTerrainHeight = fTerrainHeight * (sin(vPos.x * 0.1) + 1.0) * 0.5 + vPos.y + 3.0;    
    
    //float h = 1.0 - exp(-abs(vPos.x + 15.0) * 0.01);
    
    //fTerrainHeight += sin(vPos.x * 0.05) * 5.0 * h;
    //fTerrainHeight += sin(vPos.z * 0.05) * 5.0 * h;
    
    #ifndef FAST_VERSION
    {
		// Apply Tyre Track to Terrain
        float fRange = 20.0;
        vec2 vPrevFragOffset = vPos.xz - g_TyreTrackOrigin;
        vec2 vPrevUV = ( (vPrevFragOffset / fRange) + 1.0 ) / 2.0;

        vec4 vTrackSample = textureLod( iChannel3, vPrevUV, 0.0 );
        float fDepth = vTrackSample.x * (1.0 + vTrackSample.y);
        
        fTerrainHeight += fDepth * 0.05;        
    }
	#endif
    
	return fTerrainHeight;
}

ClosestSurface GetRampClosestSurface( const vec3 vPos, const float fRampSeed )
{
    ClosestSurface closest;
    
    vec3 vHash = Hash31( fRampSeed );
    
    closest.surface.iId = MAT_WOOD;
    closest.surface.vUVW = vPos.xyz;
    
    float fHeight = 2.0 + vHash.x * 6.0;
    float fRadius = 10.0 + vHash.y * 20.0;
    float fLedge = 2.0 + vHash.z * 3.0;
        
    float h2 = fRadius - fHeight;
    float fLength = sqrt(fRadius * fRadius - h2 * h2);
    fLength = fLength + fLedge;
    closest.fDist = sdBox( vPos - vec3( 0.0, fHeight * 0.5, fLength * 0.5 ), vec3(3.0, fHeight * 0.5, fLength * 0.5));
    

    vec3 vCylDomain = vPos - vec3( 0.0, fRadius, 0.0 );
    float fCylDist = length(vCylDomain.yz) - fRadius;
    
    //closest.fDist = fCylDist;
    
    if ( -fCylDist > closest.fDist )
    {
        closest.fDist = -fCylDist;
        closest.surface.iId = MAT_WOOD;
    }
    //closest.fDist = max( closest.fDist, -fCylDist);
    
    return closest;
}

ClosestSurface GetEnvironmentClosestSurface( const vec3 vPos )
{
    ClosestSurface terrainClosest;
    terrainClosest.surface.iId = MAT_TERRAIN;
    terrainClosest.surface.vUVW = vec3(vPos.xz,0.0);
    terrainClosest.fDist = GetTerrainDistance( vPos );
#ifdef FAST_VERSION
    return terrainClosest;
#else
    float fRepeat = 100.0;
    vec3 vRampDomain = vPos - vec3(-15.0, -3.0, 0.0);
    float fRampUnitZ = vRampDomain.z / fRepeat + 0.5;
    float fRampSeed = floor( fRampUnitZ );
    vRampDomain.z = (fract(fRampUnitZ) - 0.5) * fRepeat;
    ClosestSurface rampClosest = GetRampClosestSurface( vRampDomain, fRampSeed );

    return ClosestSurfaceUnion( terrainClosest, rampClosest );
#endif
}

float PlaneDist( const in vec3 vPos, const in vec3 vNormal, float fDist )
{
    return dot(vNormal.xyz, vPos) - fDist;
}

float PlaneDist( const in vec3 vPos, const in vec4 vPlane )
{
    return PlaneDist(vPos, vPlane.xyz, vPlane.w);
}




float CarBodyMin( float a, float b, float k )
{
    return smin(a, b, k);
}
  
float CarBodyMax( float a, float b, float k )
{
    return -CarBodyMin(-a, -b, k);
}

float WheelArchCombine( float a, float b )
{
    float size = 0.1;
    float r= clamp( 1.0 - abs(b) / size, 0.0, 1.0);
    a -= r * r * size;
    
    return CarBodyMax(a, b, 0.1);
}

float GetWheelArchDist( vec3 vPos )
{
    vPos.y = max( vPos.y, 0.0 );
    return  0.45 - length( vec2( length( vPos.zy ), vPos.x ));
    //return  0.45 - length( vPos.zy );
}

vec4 GetPlaneCoeffs( vec3 a, vec3 b, vec3 c )
{
    vec3 n = normalize( cross(a-b, b-c) );
    float d = -dot( n, a );
    
    return vec4( n, d );
}


ClosestSurface GetCarBodyClosestSurface( const in vec3 vCarPos )
{
    ClosestSurface closest;
    
#ifdef SHOW_PHYSICS_SHAPE
    vec4 vSpheres[6];
    vSpheres[0] = vec4(0.7, 0.7, 1.5, 0.5 );
    vSpheres[1] = vec4(-0.7, 0.7, 1.5, 0.5 );
    vSpheres[2] = vec4(0.7, 0.7, -1.5, 0.5 );
    vSpheres[3] = vec4(-0.7, 0.7, -1.5, 0.5 );
    vSpheres[4] = vec4(0.5, 1.0, 0.0, 0.7 );
    vSpheres[5] = vec4(-0.5, 1.0, 0.0, 0.7 );    

	closest.surface.vUVW = vCarPos.xyz;
    closest.surface.fId = MAT_CAR_BODY;
    closest.fDist = kFarClip;
    
    for (int s=0; s<6; s++)
    {
        float d = length( vCarPos.xyz - vSpheres[s].xyz) - vSpheres[s].w;
        
        closest.fDist = min( closest.fDist, d );
    }
#else    
    
    vec3 vAbsBodyPos = vCarPos - vec3(0.0, 0.3, 0.0);

    vec3 vBodyPos = vAbsBodyPos;
    vBodyPos.x = abs(vBodyPos.x);
	closest.surface.vUVW = vAbsBodyPos.xyz;
    closest.surface.iId = MAT_CAR_BODY;
   
    //closest.fDist = SdBox( vBodyPos - vec3(0.0, 0.5, 0.0), vec3(0.7, 0.2, 1.5)-0.2)  -0.2;
    
    vec3 vFrontWheelPos = -vec3( 0.0, -0.1, -1.25 ) ;
    vec3 vRearWheelPos = -vec3( 0.0, -0.1, 1.25 ) ;

    vec3 vWheelPos = vBodyPos - vFrontWheelPos;
    
    float fSeparation = (vFrontWheelPos.z - vRearWheelPos.z) * 0.5;
    vWheelPos.z = abs(vWheelPos.z + fSeparation ) - fSeparation;
    vWheelPos.x = abs(vWheelPos.x) - 0.8;
    
    float fWheelArchDist = GetWheelArchDist( vWheelPos );
    

    
    float fBodyBaseDist = kFarClip;

    {
        float fTopDist = PlaneDist( vBodyPos, normalize(vec3(0.0, 1.0, 0.0)), 0.8 );
        float fFrontDist = PlaneDist( vBodyPos, normalize(vec3(0.0, 0.2, 1.0)), 1.9 );    
        float fSideDist = PlaneDist( vBodyPos, normalize(vec3(1.0, -0.1, 0.0)), 0.85 );
        float fBaseDist = PlaneDist( vBodyPos, normalize(vec3(0.0, -1.0, 0.0)), -0.1 );
        float fBackDist = PlaneDist( vBodyPos, normalize(vec3(0.0, 0.0, -1.0)), 2.0 );

        float fX = abs(vBodyPos.x);
        fTopDist += fX * fX * 0.05;
        fFrontDist += fX * fX * 0.1;
        
        float fSmooth = 0.2;

        float fFrontTopDist = CarBodyMax( fTopDist, fFrontDist, 0.2 );

        fBodyBaseDist = fFrontTopDist;
        fBodyBaseDist = CarBodyMax( fBodyBaseDist, fSideDist, 0.3 );

        float fBaseBackDist = CarBodyMax( fBaseDist, fBackDist, 0.1 );
        fBodyBaseDist = CarBodyMax( fBodyBaseDist, fBaseBackDist, 0.1 );
    }

    fBodyBaseDist = WheelArchCombine( fBodyBaseDist, fWheelArchDist );   
            
    float fBodyTopDist = kFarClip;

    {
        float fTopDist = PlaneDist( vBodyPos, normalize(vec3(0.0, 1.0, 0.0)), 1.3 );
        float fFrontDist = PlaneDist( vBodyPos, normalize(vec3(0.0, 1.0, 0.7)), 1.1 );    
        float fSideDist = PlaneDist( vBodyPos, normalize(vec3(1.0, 0.4, 0.0)), 1.03 );
        float fBaseDist = PlaneDist( vBodyPos, normalize(vec3(0.0, -1.0, 0.0)), -0.7);
        float fBackDist = PlaneDist( vBodyPos, normalize(vec3(0.0, 0.0, -1.0)), 0.55 );

        float fX = abs(vBodyPos.x);
        fTopDist += fX * fX * 0.1;
        
        float fFrontTopDist = CarBodyMax( fTopDist, fFrontDist, 0.1 );

        fBodyTopDist = fFrontTopDist;
        fBodyTopDist = CarBodyMax( fBodyTopDist, fSideDist, 0.1 );

        float fBaseBackDist = CarBodyMax( fBaseDist, fBackDist, 0.1 );
        fBodyTopDist = CarBodyMax( fBodyTopDist, fBaseBackDist, 0.1 );
    }
        
    //fBodyTopDist = SdBox( vBodyPos - vec3(0.0, 0.5, -0.5), vec3(0.7, 0.5, 1.0)-0.2)  -0.2;
    
    //float fDistDome = SdSphere( vBodyPos - vec3(0.0, -0.5, -0.5), 2.0 );
    //float fDistBase = -vBodyPos.y;
    
    //closest.fDist = max( fDistDome, fDistBase );
    
    closest.fDist = fBodyBaseDist;
    
    closest.fDist = smin( closest.fDist, fBodyTopDist, 0.1);
    
#ifndef FAST_VERSION    
    float fRearSpace = SdBox( vBodyPos - vec3(0.0, 0.8, -1.3), vec3(0.7, 0.35, 0.65) - 0.05) - 0.05 ;
    
    fRearSpace = -min(-fRearSpace, -(fWheelArchDist + 0.02) );
    
    if( fRearSpace < -closest.fDist )
    {
        closest.fDist = -fRearSpace;
        closest.surface.iId = MAT_REAR;
    }
    
    
   	ClosestSurface mirrorClosest;
    vec3 vMirrorDomain = vBodyPos - vec3(0.875, 0.9, 0.55);
    vMirrorDomain.z += vMirrorDomain.x * 0.1;
    mirrorClosest.fDist = SdBox( vMirrorDomain, vec3(0.125, 0.1, 0.06)-0.05)  -0.05;
	mirrorClosest.surface.vUVW = vBodyPos.xyz - vec3(0.5);
    mirrorClosest.surface.iId = MAT_CAR_BODY;    
    if ( mirrorClosest.fDist < -vMirrorDomain.z )
    {                
        if ( mirrorClosest.fDist < -0.01 )
        {
    		mirrorClosest.surface.iId = MAT_CHROME;    
        }
        
        mirrorClosest.fDist = -vMirrorDomain.z;        
    }
    
    closest = ClosestSurfaceUnion( closest, mirrorClosest );

    
   	/*ClosestSurface grillClosest;
    vec3 vGrillDomain = vBodyPos - vec3(0.0, 0.55, 1.85);
    vGrillDomain.z += vGrillDomain.y * 0.2;
    float fGrillDist = UdRoundBox( vGrillDomain, vec3(0.85, 0.05, 0.0), 0.1);
    if ( fGrillDist < closest.fDist )
    {
        closest.surface.fId = MAT_GRILL;
    }*/
    
    /*ClosestSurface lightClosest;
    vec3 vLightDomain = vBodyPos - vec3(0.5, 0.5, 2.0);
    if( vBodyPos.z < 0.5 )
    {
        vLightDomain = vBodyPos - vec3(0.3, 1.5, -0.2);
    }
    lightClosest.fDist = length(vLightDomain) - 0.15;
    float fFrontDist = length(vLightDomain + vec3(0.0, 0.0, 0.52)) - 0.5;
    lightClosest.fDist = -min( -lightClosest.fDist, -fFrontDist );
	lightClosest.surface.vUVW = vAbsBodyPos.xyz;
    lightClosest.surface.fId = MAT_CHROME; 

    closest = ClosestSurfaceUnion( closest, lightClosest );*/
	
#endif    
#endif
    return closest;
}

float g_fWheelR = 0.45;
float g_fWheelW = 0.25;
ClosestSurface GetWheelClosestSurface( vec3 vPos )
{   
    float theta = atan( vPos.z, vPos.y );
    float r = length( vPos.zy );    
    float x = vPos.x;
        
    float fr = r * ( 1.0 / g_fWheelR );
    
    if( fr < 0.5 )
    {
        x += 0.01 * clamp((0.5 - fr) * 30.0, 0.0, 1.0);
        
        if( fr < 0.3 )
        {
            float unitr = fr / 0.3;
            x = x + sqrt(1.0 - unitr * unitr) * 0.05;
            //x = x + 0.01;
        }    
    }
    else
    {
#ifndef FAST_VERSION    
        
        float fX = x * (1.0 / g_fWheelW);
        float tread = sin(theta * 15.0 + abs(fX) * 4.0);
        
        float treadThickness = 1.0 - clamp( 0.9 - fX * fX * 0.3, 0.0, 1.0 );
	    
        r = -min( -r, -(r + abs(tread) * treadThickness * 0.05 + 0.025));
#endif
    }
    
    float fRound = 0.1;
    
    float fWheelR = g_fWheelR - fRound;
    float fWheelW = g_fWheelW - fRound;       
    
    vec2 rx = vec2( r,x );

    ClosestSurface closest;
    closest.surface.iId = MAT_WHEEL;
    closest.surface.vUVW = vPos.yzx;
    closest.fDist = length( max( abs(rx) - vec2(fWheelR, fWheelW), 0.0)) - fRound;
        
    return closest;
}

ClosestSurface GetVehicleClosestSurface( const in VehicleState vehicleState, const vec3 vPos )
{
    ClosestSurface closest;
    
    /*
    float fCullDist = length( vPos - vVehPos );
    if ( fCullDist > 3.5 ) 
    {
        closest.fDist = fCullDist - 1.0;
        closest.surface.fId = 0.0;
        closest.surface.vUVW = vec3(0.0);
        return closest;
    }
	*/        
    
    
    vec3 vLocalPos = vehicleState.mRot * (vPos - vehicleState.vPos);
    
    
    //closest.fDist = 10000.0;
    //closest.surface.fId = 0.0;
    //closest.surface.vUVW = vec3(0.0);    
    closest = GetCarBodyClosestSurface( vLocalPos );
    
	vec3 vWheelPos0 = vec3( -0.9, -0.1, 1.25 );
	vec3 vWheelPos1 = vec3(  0.9, -0.1, 1.25 );
	vec3 vWheelPos2 = vec3( -0.9, -0.1, -1.25 );
	vec3 vWheelPos3 = vec3(  0.9, -0.1, -1.25 );        
        
    
    vec3 vWheelOrigin;
    vec4 vWheelState;
    vec4 vWheelSC;

    if ( vLocalPos.z > 0.0 )
    {
        if ( vLocalPos.x < 0.0 )
        {
            vWheelOrigin = vWheelPos0;
            vWheelState = vehicleState.vWheelState0;
            vWheelSC = vehicleState.vWheelSC0;
        }
        else
        {
            vWheelOrigin = vWheelPos1;
            vWheelState = vehicleState.vWheelState1;
            vWheelSC = vehicleState.vWheelSC1;
        }
    }
    else
    {
        if ( vLocalPos.x < 0.0 )
        {
            vWheelOrigin = vWheelPos2;
            vWheelState = vehicleState.vWheelState2;
            vWheelSC = vehicleState.vWheelSC2;
        }
        else
        {
            vWheelOrigin = vWheelPos3;
            vWheelState = vehicleState.vWheelState3;
            vWheelSC = vehicleState.vWheelSC3;
        }
    }
    
    vec3 vWheelPos = vWheelOrigin;
    float fWheelSide = sign(vWheelOrigin.x);
    
    vWheelPos.y -= vWheelState.z - g_fWheelR;
    vec3 vWheelLocalPos = vWheelPos - vLocalPos;
    vWheelLocalPos = RotY( vWheelLocalPos, vWheelSC.xy );        
    vWheelLocalPos = RotX( vWheelLocalPos, vWheelSC.zw );    
    vWheelLocalPos.x *= -fWheelSide;
    closest = ClosestSurfaceUnion( closest, GetWheelClosestSurface( vWheelLocalPos ) );
    
#ifndef FAST_VERSION    
    vec3 vAxleOrigin = vWheelOrigin;
    vAxleOrigin.x = 0.0;
    vAxleOrigin.y = 0.25;
    vec3 vAxleEnd = vWheelPos;
    vAxleEnd.x = 0.9 * fWheelSide;
    float cDist0 = SdCapsule(vLocalPos, vAxleOrigin, vAxleEnd, 0.05, 0.05);
    if( cDist0 < closest.fDist )
    {
        closest.surface.iId = MAT_AXLE;
        closest.fDist = cDist0;
    }
    
    float fSuspensionTop = 0.6;
    
    vec3 vSuspensionOrigin = vWheelOrigin;
    vSuspensionOrigin.x -= 0.4 * fWheelSide;
    vSuspensionOrigin.y = fSuspensionTop;
    //vSuspensionOrigin.z *= 0.9;

    vec3 vSuspensionDomain = vLocalPos - vSuspensionOrigin;
    vSuspensionDomain.z = abs(vSuspensionDomain.z) - 0.1;    
    
    vec3 vSuspensionEnd = vec3(0.03 * fWheelSide, -fSuspensionTop + (vWheelPos.y - vWheelOrigin.y) * 0.8, 0.0);
    //vec3 vSuspensionEnd = vWheelPos;
    //vSuspensionEnd.x = 0.5 * fWheelSide;
    //vSuspensionEnd.y += 0.05;
    //vec3 vSuspensionDomain = vLocalPos - vSuspensionOrigin;
    float cDist1 = SdCapsule(vSuspensionDomain, vec3(0.0), vSuspensionEnd, 0.05, 0.05);
    if( cDist1 < closest.fDist )
    {
        closest.surface.iId = MAT_SUSPENSION;
        closest.fDist = cDist1;
        closest.surface.vUVW = vSuspensionDomain;
        closest.surface.vUVW.y = closest.surface.vUVW.y / vSuspensionEnd.y;
    }
#endif 
    
    return closest;
}



ClosestSurface GetSceneClosestSurface( const in SceneState sceneState, const vec3 vPos )
{    
    ClosestSurface closest;
    
    ClosestSurfaceInit( closest, MAT_TERRAIN, vec3( 0.0 ) );
        
    ClosestSurface terrainClosest = GetEnvironmentClosestSurface( vPos );
    ClosestSurface vehicleClosest = GetVehicleClosestSurface( sceneState.vehicleState, vPos );
    closest = ClosestSurfaceUnion( terrainClosest, vehicleClosest );
    
    return closest;
}

vec3 GetSceneNormal( const in SceneState sceneState, const in vec3 vPos )
{
    const float fDelta = 0.0005;

    vec3 vDir1 = vec3( 1.0, -1.0, -1.0);
    vec3 vDir2 = vec3(-1.0, -1.0,  1.0);
    vec3 vDir3 = vec3(-1.0,  1.0, -1.0);
    vec3 vDir4 = vec3( 1.0,  1.0,  1.0);
	
    vec3 vOffset1 = vDir1 * fDelta;
    vec3 vOffset2 = vDir2 * fDelta;
    vec3 vOffset3 = vDir3 * fDelta;
    vec3 vOffset4 = vDir4 * fDelta;

    ClosestSurface c1 = GetSceneClosestSurface( sceneState, vPos + vOffset1 );
    ClosestSurface c2 = GetSceneClosestSurface( sceneState, vPos + vOffset2 );
    ClosestSurface c3 = GetSceneClosestSurface( sceneState, vPos + vOffset3 );
    ClosestSurface c4 = GetSceneClosestSurface( sceneState, vPos + vOffset4 );
	
    vec3 vNormal = vDir1 * c1.fDist + vDir2 * c2.fDist + vDir3 * c3.fDist + vDir4 * c4.fDist;	
		
    return normalize( vNormal );
}

void TraceScene( const in SceneState sceneState, out C_Intersection outIntersection, const in vec3 vOrigin, const in vec3 vDir )
{	
	vec3 vPos = vec3(0.0);
	
	float t = 0.1;
	const int kRaymarchMaxIter = 64;
	for(int i=0; i<kRaymarchMaxIter; i++)
	{
		float fClosestDist = GetSceneClosestSurface( sceneState, vOrigin + vDir * t ).fDist;
		t += fClosestDist;
		if(abs(fClosestDist) < 0.01)
		{
			break;
		}		
		if(t > kFarClip)
		{
			t = kFarClip;
			break;
		}
	}
    
	outIntersection.fDist = t;
	outIntersection.vPos = vOrigin + vDir * t;
    
    if( t >= kFarClip )
    {
        outIntersection.surface.iId = 0;
        outIntersection.surface.vUVW = vec3( 0.0 );
        outIntersection.vNormal = vec3(0.0, 1.0, 0.0);
    }
    else
    {
		outIntersection.vNormal = GetSceneNormal( sceneState, outIntersection.vPos );
        outIntersection.surface = GetSceneClosestSurface( sceneState, outIntersection.vPos ).surface;
    }
}

#define SOFT_SHADOW

float TraceShadow( const in SceneState sceneState, const in vec3 vOrigin, const in vec3 vDir, const in float fDist )
{
#ifndef SOFT_SHADOW
	C_Intersection shadowIntersection;
	TraceScene(sceneState, shadowIntersection, vOrigin, vDir);
	if(shadowIntersection.fDist < fDist) 
	{
		return 0.0;		
	}
	
	return 1.0;
#else	
	#define kShadowIter 32
	#define kShadowFalloff 10.0
	float fShadow = 1.0;
	float t = 0.01;
	float fDelta = 2.5 / float(kShadowIter);
	for(int i=0; i<kShadowIter; i++)
	{
		vec4 vUnused;
		ClosestSurface closest = GetSceneClosestSurface( sceneState, vOrigin + vDir * t );
		
		fShadow = min( fShadow, kShadowFalloff * closest.fDist / t );
		
		t = t + fDelta;
	}

	return clamp(fShadow, 0.0, 1.0);
#endif
}

// AMBIENT OCCLUSION

float GetAmbientOcclusion( const in SceneState sceneState, const in vec3 vPos, const in vec3 vNormal )
{
	float fAmbientOcclusion = 0.0;
#ifndef FAST_VERSION    
	
	float fStep = 0.1;
	float fDist = 0.0;
	for(int i=0; i<=5; i++)
	{
		fDist += fStep;
		
		vec4 vUnused;
        
		ClosestSurface closest = GetSceneClosestSurface( sceneState, vPos + vNormal * fDist );
		
		float fAmount = (fDist - closest.fDist);
		
		fAmbientOcclusion += max(0.0, fAmount * fDist );                                  
	}
#endif	
	return max(1.0 - fAmbientOcclusion, 0.0);
}

// LIGHTING

void AddLighting(inout vec3 vDiffuseLight, inout vec3 vSpecularLight, const in vec3 vViewDir, const in vec3 vLightDir, const in vec3 vNormal, const in float fSmoothness, const in vec3 vLightColour)
{
	float fNDotL = clamp(dot(vLightDir, vNormal), 0.0, 1.0);
	vec3 vHalfAngle = normalize(-vViewDir + vLightDir);
    float fNDotH = clamp(dot(vHalfAngle, vNormal), 0.0, 1.0);
	
	vDiffuseLight += vLightColour * fNDotL;
	
	float fSpecularPower = exp2(4.0 + 6.0 * fSmoothness);
	float fSpecularIntensity = (fSpecularPower + 2.0) * 0.125;
	vSpecularLight += vLightColour * fSpecularIntensity * clamp(pow(fNDotH, fSpecularPower), 0.0, 1.0) * fNDotL;
}

void AddPointLight(const in SceneState sceneState, inout vec3 vDiffuseLight, inout vec3 vSpecularLight, const in vec3 vViewDir, const in vec3 vPos, const in vec3 vNormal, const in float fSmoothness, const in vec3 vLightPos, const in vec3 vLightColour)
{
	vec3 vToLight = vLightPos - vPos;	
	float fDistance2 = dot(vToLight, vToLight);
	float fAttenuation = 100.0 / (fDistance2);
	vec3 vLightDir = normalize(vToLight);
	
	vec3 vShadowRayDir = vLightDir;
	vec3 vShadowRayOrigin = vPos + vShadowRayDir * 0.01;
	float fShadowFactor = TraceShadow( sceneState, vShadowRayOrigin, vShadowRayDir, length(vToLight));
	
	AddLighting(vDiffuseLight, vSpecularLight, vViewDir, vLightDir, vNormal, fSmoothness, vLightColour * fShadowFactor * fAttenuation);
}

void AddPointLightFlare(inout vec3 vEmissiveGlow, const in vec3 vRayOrigin, const in vec3 vRayDir, const in float fIntersectDistance, const in vec3 vLightPos, const in vec3 vLightColour)
{
    vec3 vToLight = vLightPos - vRayOrigin;
    float fPointDot = dot(vToLight, vRayDir);
    fPointDot = clamp(fPointDot, 0.0, fIntersectDistance);

    vec3 vClosestPoint = vRayOrigin + vRayDir * fPointDot;
    float fDist = length(vClosestPoint - vLightPos);
	vEmissiveGlow += sqrt(vLightColour * 0.05 / (fDist * fDist));
}

void AddDirectionalLight(const in SceneState sceneState, inout vec3 vDiffuseLight, inout vec3 vSpecularLight, const in vec3 vViewDir, const in vec3 vPos, const in vec3 vNormal, const in float fSmoothness, const in vec3 vLightDir, const in vec3 vLightColour)
{	
	float fAttenuation = 1.0;

	vec3 vShadowRayDir = -vLightDir;
	vec3 vShadowRayOrigin = vPos + vShadowRayDir * 0.01;
	float fShadowFactor = TraceShadow(sceneState, vShadowRayOrigin, vShadowRayDir, 10.0);
	
	AddLighting(vDiffuseLight, vSpecularLight, vViewDir, -vLightDir, vNormal, fSmoothness, vLightColour * fShadowFactor * fAttenuation);	
}

void AddDirectionalLightFlareToFog(inout vec3 vFogColour, const in vec3 vRayDir, const in vec3 vLightDir, const in vec3 vLightColour)
{
	float fDirDot = clamp(dot(-vLightDir, vRayDir) * 0.5 + 0.5, 0.0, 1.0);
	float kSpreadPower = 5.0;
	vFogColour += vLightColour * pow(fDirDot, kSpreadPower) * 0.5;
}

// SCENE MATERIALS

vec3 ProjectedTexture( vec3 pos, vec3 normal )
{
    vec3 vWeights = normal * normal;
    vec3 col = vec3(0.0);
    vec3 samplev;
    samplev = texture( iChannel1, pos.xz ).rgb;
    col += samplev * samplev * vWeights.y;
    samplev = texture( iChannel1, pos.xy ).rgb;
    col += samplev * samplev * vWeights.z;
    samplev = texture( iChannel1, pos.yz ).rgb;
    col += samplev * samplev * vWeights.x;
    col /= vWeights.x + vWeights.y + vWeights.z;
    return col;    
}

void GetSurfaceInfo( out vec3 vOutAlbedo, out float fOutR0, out float fOutSmoothness, out vec3 vOutBumpNormal, const in C_Intersection intersection )
{
	vOutBumpNormal = intersection.vNormal;
    
    /*if(false)
    {
		vOutAlbedo = vec3(0.1);
		fOutSmoothness = 0.0;			
		fOutR0 = 0.02;   
        return;
    }*/
        
    
    float fRange = 20.0;
    vec2 vPrevFragOffset = intersection.vPos.xz - g_TyreTrackOrigin;
    vec2 vPrevUV = ( (vPrevFragOffset / fRange) + 1.0 ) / 2.0;

    vec4 vTrackSample = texture( iChannel3, vPrevUV );            
    
    if ( vPrevUV.x < 0.0 || vPrevUV.x >=1.0 || vPrevUV.y < 0.0 || vPrevUV.y >= 1.0 )
    {
        vTrackSample = vec4(0.0);
    }
	
	fOutR0 = 0.02;

    switch (intersection.surface.iId )       
	{
        case MAT_TERRAIN:
        {
            vec2 vUV = intersection.surface.vUVW.xy * 0.1;
            vOutAlbedo = texture(iChannel1, vUV).rgb;

            #ifndef FAST_VERSION
            float fBumpScale = 1.0;

            vec2 vRes = iChannelResolution[0].xy;
            vec2 vDU = vec2(1.0, 0.0) / vRes;
            vec2 vDV = vec2(0.0, 1.0) / vRes;

            float fSampleW = texture(iChannel1, vUV - vDU).r;
            float fSampleE = texture(iChannel1, vUV + vDU).r;
            float fSampleN = texture(iChannel1, vUV - vDV).r;
            float fSampleS = texture(iChannel1, vUV + vDV).r;

            vec3 vNormalDelta = vec3(0.0);
            vNormalDelta.x += 
                ( fSampleW * fSampleW
                 - fSampleE * fSampleE) * fBumpScale;
            vNormalDelta.z += 
                (fSampleN * fSampleN
                 - fSampleS * fSampleS) * fBumpScale;

            vOutBumpNormal = normalize(vOutBumpNormal + vNormalDelta);
            #endif

            vOutAlbedo = vOutAlbedo * vOutAlbedo;	
            fOutSmoothness = vOutAlbedo.r * 0.3;

            //if(false)
            {       
                // Tyre tracks
                float fDepth = vTrackSample.x * (1.0 + vTrackSample.y);

                //vec3 vTex2 = texture(iChannel2, vUV).rgb;
                vec3 vTex2 = mix( vOutAlbedo, vec3( 0.9, 0.3, 0.01 ), 0.5);
                vOutAlbedo = mix( vOutAlbedo, vTex2, fDepth );

                //vOutAlbedo *= 1.0 - 0.2 * vTrackSample.r;

                vOutAlbedo *= 1.0 - 0.6 * vTrackSample.g;
                fOutSmoothness = mix( fOutSmoothness, fOutSmoothness * 0.75 + 0.25, fDepth );                        
            }  
        }
        break;
        
        case MAT_BLACK_PLASTIC:
        {
            vec2 vUV = intersection.surface.vUVW.xy;
            vOutAlbedo = texture(iChannel1, vUV).rgb;
            vOutAlbedo = vOutAlbedo * vOutAlbedo;	
            vOutAlbedo *= 0.01;
            fOutSmoothness = 0.1;//vOutAlbedo.r;			

            vec3 vDirt = (texture(iChannel1, intersection.surface.vUVW.zy).rgb + texture(iChannel1, intersection.surface.vUVW.xy).rgb) * 0.5;
            float fDirt = vDirt.r;

            float fMix = clamp( fDirt - intersection.surface.vUVW.y * 2.5 + 0.8, 0.0, 1.0 );

            vDirt = vDirt * vDirt * 0.1;

            vOutAlbedo = mix( vOutAlbedo, vDirt, fMix );
            fOutSmoothness = mix( fOutSmoothness, 0.01, fMix );        

        }
        break;
                
		case MAT_CHROME:
        {
            vOutAlbedo = vec3(0.1);
            fOutSmoothness = 1.0;			
            fOutR0 = 0.9;
        }
        break;
        
		case MAT_CAR_BODY:
        {
            vOutAlbedo = vec3(0.0, 0.0, 1.0);

            float fAbsX = abs( intersection.surface.vUVW.x );

            fOutSmoothness = 1.0;

            float fStripe = abs(fAbsX - (0.15));
            fStripe = smoothstep( 0.1 + 0.01, 0.1 - 0.01, fStripe);

            vOutAlbedo = mix( vOutAlbedo, vec3(1.0, 1.0, 1.0), fStripe);

            if ( intersection.surface.vUVW.y < 0.85 )
            {
                float fLine = abs(intersection.surface.vUVW.z - 0.7);
                fLine = min( fLine, abs(intersection.surface.vUVW.z + 0.6) );
                fLine = min( fLine, abs(fAbsX - 0.65) );
                fLine = min( fLine, abs(intersection.surface.vUVW.y - 0.2) );
                fLine = clamp( (fLine - 0.005) / 0.01, 0.0, 1.0);
                vOutAlbedo *= fLine;
                fOutR0 *= fLine;
                fOutSmoothness *= fLine;

            }

            if(fAbsX > 0.92 )
            {
                vOutAlbedo = vec3(0.02, 0.02, 0.02);
                fOutSmoothness = 0.2;
            }

            if( intersection.surface.vUVW.y > 0.85 && intersection.surface.vUVW.y < 1.2)
            {
                bool bFront = (intersection.surface.vUVW.z + intersection.surface.vUVW.y * 1.25 )  > 1.6;
                bool bRear = (intersection.surface.vUVW.z)  < -0.45;
                bool bSide = (fAbsX +intersection.surface.vUVW.y * 0.3) > 0.9;

                if ( !(bFront && bSide) && !(bRear && bSide))
                {
                    vOutAlbedo = vec3(0.0, 0.0, 0.0);
                    fOutR0 = 0.02;
                    fOutSmoothness = 0.9;
                }
            }

            vec3 vGrillDomain = intersection.surface.vUVW - vec3(0.0, 0.55, 1.85);
            float fGrillDist = UdRoundBox( vGrillDomain, vec3(0.85, 0.05, 0.0), 0.1);
            if ( fGrillDist < 0.0 )
            {
                vOutAlbedo = vec3(0.0, 0.0, 0.0);
                fOutR0 = 0.02;
            }        

            vec3 vLightDomain = intersection.surface.vUVW;
            vLightDomain.x = abs( vLightDomain.x );
            vLightDomain -= vec3(0.6, 0.56, 1.85);
            float fLightDist = UdRoundBox( vLightDomain, vec3(0.1, 0.04, 0.5), 0.05);
            if ( fLightDist < 0.0 )
            {
                vOutAlbedo = vec3(0.5);
                fOutR0 = 1.0;
                fOutSmoothness = 0.8;
            }


            vec3 vDirt = (texture(iChannel1, intersection.surface.vUVW.zy).rgb + texture(iChannel1, intersection.surface.vUVW.xy).rgb) * 0.5;
            float fDirt = vDirt.r;

            float fMix = clamp( fDirt - intersection.surface.vUVW.y * 1.5 + 0.8, 0.0, 1.0 );

            vDirt = vDirt * vDirt * 0.1;

            vOutAlbedo = mix( vOutAlbedo, vDirt, fMix );
            fOutR0 = mix( fOutR0, 0.01, fMix );
            fOutSmoothness = mix( fOutSmoothness, 0.01, fMix );

            //vOutR0 = vec3(0.7, 0.5, 0.02);
            //vOutAlbedo = vOutR0 * 0.01;

        }
       	break;
        
		case MAT_WHEEL:
        {
            vec2 vUV = intersection.surface.vUVW.xy;
            vOutAlbedo = texture(iChannel2, vUV).rgb;
            vOutAlbedo = vOutAlbedo * vOutAlbedo;	
            vOutAlbedo *= 0.01;
            float len = length(vUV);
            float fR = len * (1.0 / g_fWheelR);
            if ( fR < 0.5 )
            {
                fOutSmoothness = 1.0;        
                fOutR0 = 1.0;
            }
            else
            {
                fOutSmoothness = 0.1;
            }

            vec3 vDirt = (texture(iChannel1, intersection.surface.vUVW.zy).rgb + texture(iChannel1, intersection.surface.vUVW.xy).rgb) * 0.5;

            float fDirt = vDirt.r;
            fDirt = sqrt(fDirt);

            float fMix = clamp( fDirt - (1.0 - fR) * 1.0 + 0.8, 0.0, 1.0 );

            vDirt = vDirt * vDirt * 0.1;

            vOutAlbedo = mix( vOutAlbedo, vDirt, fMix );
            fOutR0 = mix( fOutR0, 0.01, fMix );
            fOutSmoothness = mix( fOutSmoothness, 0.01, fMix );

        }
        break;
        
    	case MAT_SUSPENSION:
        {
            vOutAlbedo = vec3(0.1);
            fOutSmoothness = 1.0;			
            fOutR0 = 0.9;

            float fY = intersection.surface.vUVW.y;

            float fAngle = atan(intersection.surface.vUVW.x, intersection.surface.vUVW.y);        
            fAngle -= fY * 30.0;
            float fFAngle = fract(fAngle / (3.1415 * 2.0));
            if ( fFAngle < 0.5 )
            {
                fOutR0 = 0.0;
                vOutAlbedo = vec3(0.0);            
            }

            vec3 vDirt = (texture(iChannel1, intersection.surface.vUVW.zy).rgb + texture(iChannel1, intersection.surface.vUVW.xy).rgb) * 0.5;

            float fDirt = vDirt.r;
            fDirt = sqrt(fDirt);

            float fMix = clamp( fDirt + 0.1, 0.0, 1.0 );

            vDirt = vDirt * vDirt * 0.1;

            vOutAlbedo = mix( vOutAlbedo, vDirt, fMix );
            fOutR0 = mix( fOutR0, 0.01, fMix );
            fOutSmoothness = mix( fOutSmoothness, 0.01, fMix );

        }
        break;
        
    	case MAT_WOOD:
        {
            vec2 vUV = intersection.surface.vUVW.xz * 0.1;
            vOutAlbedo = texture(iChannel2, vUV).rgb;
            vOutAlbedo = vOutAlbedo * vOutAlbedo;
            fOutSmoothness = vOutAlbedo.r;

            vOutAlbedo *= 1.0 - vTrackSample.g * 0.6;
        }
        break;
    }
	
	//vOutR0 = vec3(0.9);
	//fOutSmoothness = 0.5;
}

vec3 vSkyTop = vec3(0.1, 0.5, 0.8);
vec3 vSkyBottom = vec3(0.02, 0.04, 0.06);

vec3 GetSkyColour( const in vec3 vDir )
{
	vec3 vResult = vec3(0.0);
	
    vResult = mix(vSkyBottom, vSkyTop, abs(vDir.y)) * 30.0;
	
#ifndef FAST_VERSION    
    float fCloud = texture( iChannel1, vDir.xz * 0.01 / vDir.y ).r;
    fCloud = clamp( fCloud * fCloud * 3.0 - 1.0, 0.0, 1.0);
    vResult = mix( vResult, vec3(8.0), fCloud );
#endif 
    
	return vResult;	
}

float GetFogFactor(const in float fDist)
{
	float kFogDensity = 0.0025;
	return exp(fDist * -kFogDensity);	
}

vec3 GetFogColour(const in vec3 vDir)
{
	return (vSkyBottom) * 25.0;
}


vec3 vSunLightColour = vec3(1.0, 0.9, 0.6) * 10.0;
vec3 vSunLightDir = normalize(vec3(0.4, -0.3, -0.5));
	
void ApplyAtmosphere(inout vec3 vColour, const in float fDist, const in vec3 vRayOrigin, const in vec3 vRayDir)
{		
	float fFogFactor = GetFogFactor(fDist);
	vec3 vFogColour = GetFogColour(vRayDir);			
	AddDirectionalLightFlareToFog(vFogColour, vRayDir, vSunLightDir, vSunLightColour);
	
	vec3 vGlow = vec3(0.0);
	//AddPointLightFlare(vGlow, vRayOrigin, vRayDir, fDist, vLightPos, vLightColour);					
	
	vColour = mix(vFogColour, vColour, fFogFactor) + vGlow;	
}

// TRACING LOOP

	
vec3 GetSceneColour( in vec3 vRayOrigin,  in vec3 vRayDir, out float fDepth )
{
	vec3 vColour = vec3(0.0);
	float fRemaining = 1.0;
	
    SceneState sceneState = SetupSceneState();
    
    fDepth = 0.0;
    float fFirstTrace = 1.0;
    
#ifndef FAST_VERSION    
	for(int i=0; i<RAYTRACE_COUNT; i++)
#endif
    {	
        // result = reflection
        //vColour = vec3(0.0);
		//vRemaining = vec3(1.0);
        
		float fCurrRemaining = fRemaining;
		float fShouldApply = 1.0;
		
		C_Intersection intersection;				
		TraceScene( sceneState, intersection, vRayOrigin, vRayDir );

        float fHitDepth = intersection.fDist;
		if(intersection.surface.iId >= MAT_FIRST_VEHICLE)
		{
            fHitDepth = -fHitDepth;
        }
		
        fDepth = ( fFirstTrace > 0.0 ) ? fHitDepth : fDepth;
        fFirstTrace = 0.0;
        
		vec3 vResult = vec3(0.0);
		float fBlendFactor = 0.0;
						
		if(intersection.surface.iId == 0)
		{
			fBlendFactor = 1.0;
			fShouldApply = 0.0;
		}
		else
		{		
			vec3 vAlbedo;
			float fR0;
			float fSmoothness;
			vec3 vBumpNormal;
			
			GetSurfaceInfo( vAlbedo, fR0, fSmoothness, vBumpNormal, intersection );			
		
			vec3 vDiffuseLight = vec3(0.0);
			vec3 vSpecularLight = vec3(0.0);

			//AddPointLight(sceneState, vDiffuseLight, vSpecularLight, vRayDir, intersection.vPos, vBumpNormal, fSmoothness, vLightPos, vLightColour);								

			AddDirectionalLight(sceneState, vDiffuseLight, vSpecularLight, vRayDir, intersection.vPos, vBumpNormal, fSmoothness, vSunLightDir, vSunLightColour);								
			
			vDiffuseLight += 0.2 * GetAmbientOcclusion(sceneState, intersection.vPos, vBumpNormal);

			float fSmoothFactor = pow(fSmoothness, 5.0);
			float fFresnel = fR0 + (1.0 - fR0) * pow(1.0 - dot(-vBumpNormal, vRayDir), 5.0) * fSmoothFactor;
			
			vResult = mix(vAlbedo * vDiffuseLight, vSpecularLight, fFresnel);		
			fBlendFactor = fFresnel;
			
			ApplyAtmosphere(vResult, intersection.fDist, vRayOrigin, vRayDir);		
			
			fRemaining *= fBlendFactor;			
            
            #ifndef FAST_VERSION
            float fRoughness = 1.0 - fSmoothness;
            fRoughness = pow(fRoughness, 5.0);
            vBumpNormal = normalize(vBumpNormal + g_pixelRandom * (fRoughness) * 0.5);
			#endif
            vRayDir = normalize(reflect(vRayDir, vBumpNormal));
			vRayOrigin = intersection.vPos;// + intersection.vNormal;            
		}			

		vColour += vResult * fCurrRemaining * fShouldApply;

#ifndef FAST_VERSION    
        if( fRemaining < 0.05 )
        {
            break;
        }        		
#endif        
	}

	vec3 vSkyColor = GetSkyColour(vRayDir);
	
	ApplyAtmosphere(vSkyColor, kFarClip, vRayOrigin, vRayDir);		
	
	vColour += vSkyColor * fRemaining;
	
	return vColour;
}

void mainVR( out vec4 fragColor, in vec2 fragCoord, in vec3 fragRayOri, in vec3 fragRayDir )
{
    fragRayOri.x = -fragRayOri.x;
    fragRayDir.x = -fragRayDir.x;
    
    g_pixelRandom = normalize( Hash32(fragCoord.xy + iTime) );
    
	vec2 vUV = fragCoord.xy / iResolution.xy;

	vec3 vCameraPos = LoadVec3( addrCamera + offsetCameraPos );
    
    // This will make you vomit good
    //fragRayOri.xz += vCameraPos.xz;
                
    g_TyreTrackOrigin = floor(vCameraPos.xz);
    
	vec3 vRayOrigin = fragRayOri;
	vec3 vRayDir = fragRayDir;
	
    float fDepth;
	vec3 vResult = GetSceneColour(vRayOrigin, vRayDir, fDepth);
    vResult = max( vResult, vec3(0.0));
	    
	fragColor = vec4(vResult, fDepth);    
  fragColor.a = 1.;
}
`;

const fragment = `
// Shader Rally - @P_Malin

// (Uncomment FAST_VERSION in "Buf C" for a framerate boost)

// Physics Hackery using the new mutipass things.

// WASD to drive. Space = brake
// G toggle gravity
// V toggle wheels (vehicle forces)
// . and , flip car

// Restart shader to reset car

// I'll add more soon (including a fast version of the rendering code maybe :)

// Image shader - final postprocessing

#define MOTION_BLUR_TAPS 32

ivec2 addrVehicle = ivec2( 0.0, 0.0 );

ivec2 offsetVehicleParam0 = ivec2( 0.0, 0.0 );

ivec2 offsetVehicleBody = ivec2( 1.0, 0.0 );
ivec2 offsetBodyPos = ivec2( 0.0, 0.0 );
ivec2 offsetBodyRot = ivec2( 1.0, 0.0 );
ivec2 offsetBodyMom = ivec2( 2.0, 0.0 );
ivec2 offsetBodyAngMom = ivec2( 3.0, 0.0 );

ivec2 offsetVehicleWheel0 = ivec2( 5.0, 0.0 );
ivec2 offsetVehicleWheel1 = ivec2( 7.0, 0.0 );
ivec2 offsetVehicleWheel2 = ivec2( 9.0, 0.0 );
ivec2 offsetVehicleWheel3 = ivec2( 11.0, 0.0 );

ivec2 offsetWheelState = ivec2( 0.0, 0.0 );
ivec2 offsetWheelContactState = ivec2( 1.0, 0.0 );


ivec2 addrCamera = ivec2( 0.0, 1.0 );
ivec2 offsetCameraPos = ivec2( 0.0, 0.0 );
ivec2 offsetCameraTarget = ivec2( 1.0, 0.0 );

ivec2 addrPrevCamera = ivec2( 0.0, 2.0 );


/////////////////////////
// Storage

vec4 LoadVec4( in ivec2 vAddr )
{
    return texelFetch( iChannel0, vAddr, 0 );
}

vec3 LoadVec3( in ivec2 vAddr )
{
    return LoadVec4( vAddr ).xyz;
}

bool AtAddress( vec2 p, ivec2 c ) { return all( equal( floor(p), vec2(c) ) ); }

void StoreVec4( in ivec2 vAddr, in vec4 vValue, inout vec4 fragColor, in vec2 fragCoord )
{
    fragColor = AtAddress( fragCoord, vAddr ) ? vValue : fragColor;
}

void StoreVec3( in ivec2 vAddr, in vec3 vValue, inout vec4 fragColor, in vec2 fragCoord )
{
    StoreVec4( vAddr, vec4( vValue, 0.0 ), fragColor, fragCoord);
}


vec3 ApplyPostFX( const in vec2 vUV, const in vec3 vInput );

// CAMERA

vec2 GetWindowCoord( const in vec2 vUV )
{
	vec2 vWindow = vUV * 2.0 - 1.0;
	vWindow.x *= iResolution.x / iResolution.y;

	return vWindow;	
}

vec2 GetUVFromWindowCoord( const in vec2 vWindow )
{
	vec2 vScaledWindow = vWindow;
    vScaledWindow.x *= iResolution.y / iResolution.x;
    
	 return vScaledWindow * 0.5 + 0.5;
}


vec3 GetCameraRayDir( const in vec2 vWindow, const in vec3 vCameraPos, const in vec3 vCameraTarget )
{
	vec3 vForward = normalize(vCameraTarget - vCameraPos);
	vec3 vRight = normalize(cross(vec3(0.0, 1.0, 0.0), vForward));
	vec3 vUp = normalize(cross(vForward, vRight));
							  
	vec3 vDir = normalize(vWindow.x * vRight + vWindow.y * vUp + vForward * 2.0);

	return vDir;
}

vec2 GetCameraWindowCoord(const in vec3 vWorldPos, const in vec3 vCameraPos, const in vec3 vCameraTarget)
{
	vec3 vForward = normalize(vCameraTarget - vCameraPos);
	vec3 vRight = normalize(cross(vec3(0.0, 1.0, 0.0), vForward));
	vec3 vUp = normalize(cross(vForward, vRight));
	
    vec3 vOffset = vWorldPos - vCameraPos;
    vec3 vCameraLocal;
    vCameraLocal.x = dot(vOffset, vRight);
    vCameraLocal.y = dot(vOffset, vUp);
    vCameraLocal.z = dot(vOffset, vForward);

    vec2 vWindowPos = vCameraLocal.xy / (vCameraLocal.z / 2.0);
    
    return vWindowPos;
}

float GetCoC( float fDistance, float fPlaneInFocus )
{
	// http://http.developer.nvidia.com/GPUGems/gpugems_ch23.html

    float fAperture = 0.03;
    float fFocalLength = 1.0;
    
	return abs(fAperture * (fFocalLength * (fDistance - fPlaneInFocus)) /
          (fDistance * (fPlaneInFocus - fFocalLength)));  
}


// Random

#define MOD2 vec2(4.438975,3.972973)

float Hash( float p ) 
{
    // https://www.shadertoy.com/view/4djSRW - Dave Hoskins
	vec2 p2 = fract(vec2(p) * MOD2);
    p2 += dot(p2.yx, p2.xy+19.19);
	return fract(p2.x * p2.y);    
}


float fGolden = 3.141592 * (3.0 - sqrt(5.0));

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 vUV = fragCoord.xy / iResolution.xy;

    vec4 vSample = textureLod( iChannel1, vUV, 0.0 ).rgba;
	
    float fDepth = abs(vSample.w);
    
	vec3 vCameraPos = LoadVec3( addrCamera + offsetCameraPos );
	vec3 vCameraTarget = LoadVec3( addrCamera + offsetCameraTarget );
    
	vec3 vRayOrigin = vCameraPos;
	vec3 vRayDir = GetCameraRayDir( GetWindowCoord(vUV), vCameraPos, vCameraTarget );
        
    vec3 vWorldPos = vRayOrigin + vRayDir * fDepth;
    
	vec3 vPrevCameraPos = LoadVec3( addrPrevCamera + offsetCameraPos );
	vec3 vPrevCameraTarget = LoadVec3( addrPrevCamera + offsetCameraTarget );
    vec2 vPrevWindow = GetCameraWindowCoord( vWorldPos, vPrevCameraPos, vPrevCameraTarget );
    vec2 vPrevUV = GetUVFromWindowCoord(vPrevWindow);
    
    if( vSample.a < 0.0 ) 
    {
        vPrevUV = vUV;
    }
        
	vec3 vResult = vec3(0.0);
    
    float fTot = 0.0;
    
    float fPlaneInFocus = length(vCameraPos - vCameraTarget);
    
    float fCoC = GetCoC( abs(fDepth), fPlaneInFocus );
    
    float r = 1.0;
    vec2 vangle = vec2(0.0,fCoC); // Start angle
    
    vResult.rgb = vSample.rgb * fCoC;
    fTot += fCoC;
    
    float fMotionBlurTaps = float(MOTION_BLUR_TAPS);
    
    float f = 0.0;
    float fIndex = 0.0;
    for(int i=1; i<MOTION_BLUR_TAPS; i++)
    {
        vec2 vTapUV = mix( vUV, vPrevUV, f / fMotionBlurTaps - 0.5 );
                
        float fRand = Hash( iTime + fIndex + vUV.x + vUV.y * 12.345);
        
        // http://blog.marmakoide.org/?p=1
        
        float fTheta = fRand * fGolden * fMotionBlurTaps;
        float fRadius = fCoC * sqrt( fRand * fMotionBlurTaps ) / sqrt( fMotionBlurTaps );        
        
        vTapUV += vec2( sin(fTheta), cos(fTheta) ) * fRadius;
        
        vec4 vTapSample = textureLod( iChannel1, vTapUV, 0.0 ).rgba;
        if( sign(vTapSample.a) == sign(vSample.a) )
        {
  		  	float fCurrCoC = GetCoC( abs(vTapSample.a), fPlaneInFocus );
            
            float fWeight = fCurrCoC + 1.0;
            
    		vResult += vTapSample.rgb * fWeight;
        	fTot += fWeight;
        }
        f += 1.0;
        fIndex += 1.0;
    }
    vResult /= fTot;
        
	vec3 vFinal = ApplyPostFX( vUV, vResult );

    // Draw depth
    //vFinal = vec3(1.0) / abs(vSample.a);    
    
	fragColor = vec4(vFinal, 1.0);
}

// POSTFX

vec3 ApplyVignetting( const in vec2 vUV, const in vec3 vInput )
{
	vec2 vOffset = (vUV - 0.5) * sqrt(2.0);
	
	float fDist = dot(vOffset, vOffset);
	
	const float kStrength = 0.75;
	
	float fShade = mix( 1.0, 1.0 - kStrength, fDist );	

	return vInput * fShade;
}

vec3 Tonemap( vec3 x )
{
    float a = 0.010;
    float b = 0.132;
    float c = 0.010;
    float d = 0.163;
    float e = 0.101;

    return ( x * ( a * x + b ) ) / ( x * ( c * x + d ) + e );
}

vec3 ColorGrade( vec3 vColor )
{
    vec3 vHue = vec3(1.0, .7, .2);
    
    vec3 vGamma = 1.0 + vHue * 0.6;
    vec3 vGain = vec3(.9) + vHue * vHue * 8.0;
    
    vColor *= 1.5;
    
    float fMaxLum = 100.0;
    vColor /= fMaxLum;
    vColor = pow( vColor, vGamma );
    vColor *= vGain;
    vColor *= fMaxLum;  
    return vColor;
}

vec3 ApplyGamma( const in vec3 vLinear )
{
	const float kGamma = 2.2;

	return pow(vLinear, vec3(1.0/kGamma));	
}

vec3 ApplyPostFX( const in vec2 vUV, const in vec3 vInput )
{
	vec3 vTemp = ApplyVignetting( vUV, vInput );	
	
	vTemp = vTemp * 2.0;
    
    vTemp = ColorGrade( vTemp );
    
	return Tonemap( vTemp );		
}`;

export default class implements iSub {
  key(): string {
    return 'XdcGWS';
  }
  name(): string {
    return 'Shader Rally';
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
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  userFragment(): string {
    return buffC;
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
      webglUtils.WOOD_TEXTURE,
      webglUtils.WOOD_TEXTURE,
      { type: 1, f: buffB, fi: 3 }, //
    ];
  }
}
