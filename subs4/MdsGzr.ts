import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const sound = `
#define N(T,N) t+=float(T); if(x>t) r=vec2(N,t);
#define L(T,N,X) t+=float(T); if((x>t) && (x<(t+float(X)))) r=vec2(N,t);

vec2 GetTrack0ANote(float x)
{
    vec2 r = vec2(-1.0);
    float t = 0.0;
    N(288,62) N(96,66) N(96,69) N(96,50) N(96,62) N(96,62) N(96,50) N(96,66) N(96,62) N(96,50) N(96,62)
    N(96,54) N(96,50) N(96,62) N(96,66) N(96,52) N(96,61) N(96,67) N(96,52) N(96,61) N(96,61) N(96,52)
    N(96,61) N(96,57) N(96,52) N(96,61) N(96,61) N(96,45) N(96,61) N(96,67) N(96,45) N(96,61) N(96,61)
    N(96,45) N(96,61) N(96,55) N(96,45) N(96,61) N(96,61) N(96,50) N(96,66) N(96,66) N(96,50) N(96,66)
    N(96,66) N(96,50) N(96,62) N(96,57) N(96,50) N(96,62) N(96,66) N(96,54) N(96,66) N(96,66) N(96,54)
    N(96,66) N(96,66) N(96,42) N(96,50) N(96,50) N(96,42) N(96,45) N(96,45) N(96,43) N(96,50) N(96,52)
    N(96,43) N(96,47) N(96,52) N(96,52) N(192,52) N(96,52) N(96,55) N(96,59) N(96,52) N(96,61) N(96,67)
    N(96,45) N(96,61) N(96,61) N(96,50) N(96,66) N(96,66) N(96,54) N(96,66) N(96,66) N(96,52) N(192,76)
    N(96,55) N(192,81) N(96,54) N(144,66) N(48,66) N(96,54) N(96,78) N(96,85) N(96,52) N(96,56) N(96,56)
    N(96,52) N(96,56) N(96,61) N(96,52) N(96,56) N(96,56) N(96,52) N(96,56) N(96,56) N(91,52) N(101,61)
    N(96,61) N(93,54) N(99,61) N(96,61) N(91,55) N(101,57) N(96,61) N(93,54) N(99,64) N(96,61) L(89,52,7)
    N(103,56) N(96,56) N(96,52) N(96,56) N(96,61) N(96,52) N(96,56) N(96,62) N(96,52) N(96,59) N(96,62)
    N(96,61) N(192,57) N(96,54) N(144,78) N(48,74) N(48,71) N(48,52) N(48,78) N(48,56) N(96,52) N(96,57)
    N(281,81)
    return r;
}

vec2 GetTrack0BNote(float x)
{
    vec2 r = vec2(-1.0);
    float t = 0.0;
    N(576,69) N(96,66) N(96,66) N(96,81) N(96,62) N(96,66) N(96,78) N(96,54) N(96,57) N(96,62) N(96,57)
    N(96,62) N(96,67) N(96,67) N(96,61) N(96,81) N(96,67) N(96,67) N(96,79) N(96,57) N(96,55) N(96,61)
    N(96,57) N(96,57) N(96,71) N(96,67) N(96,61) N(96,79) N(96,67) N(96,67) N(96,73) N(96,57) N(96,57)
    N(96,61) N(96,57) N(96,57) N(96,71) N(96,62) N(96,57) N(96,78) N(96,62) N(96,57) N(96,78) N(96,57)
    N(96,54) N(96,62) N(96,57) N(96,62) N(96,74) N(96,62) N(96,62) N(96,86) N(96,62) N(96,62) N(96,81)
    N(96,45) N(96,45) N(96,62) N(96,54) N(96,54) N(96,74) N(96,52) N(96,47) N(96,86) N(96,50) N(96,50)
    N(96,50) N(192,64) N(96,64) N(96,67) N(96,71) N(96,71) N(96,67) N(96,61) N(192,67) N(96,67) N(96,78)
    N(96,57) N(96,62) N(192,57) N(96,62) N(96,47) N(288,45) N(288,50) N(144,69) N(48,69) N(96,50) N(96,86)
    N(192,85) N(96,62) N(96,62) N(192,62) N(96,64) N(96,82) N(96,62) N(96,62) N(192,62) N(96,62) N(96,45)
    N(96,57) N(96,64) N(96,45) N(96,57) N(96,57) N(96,45) N(96,61) N(96,64) N(96,45) N(96,57) N(96,64)
    N(96,52) N(96,62) N(96,64) N(192,62) N(96,64) N(96,76) N(96,64) N(96,56) N(192,64) N(96,59) N(96,54)
    N(192,81) N(96,59) N(288,40) N(48,71) N(48,44) N(96,40) N(96,45) N(288,67)
    return r;
}

vec2 GetTrack0CNote(float x)
{
    vec2 r = vec2(-1.0);
    float t = 0.0;
    N(672,57) N(96,57) N(96,78) N(96,57) N(96,57) N(96,74) N(96,57) N(96,62) N(192,66) N(96,57) N(96,69)
    N(96,57) N(96,57) N(96,79) N(96,57) N(96,79) N(96,73) N(96,55) N(96,61) N(192,55) N(96,55) N(288,57)
    N(96,83) N(192,57) N(96,79) N(96,55) N(96,61) N(192,55) N(96,55) N(192,57) N(96,62) N(96,74) N(96,57)
    N(96,62) N(96,74) N(96,54) N(96,62) N(192,66) N(96,57) N(192,57) N(96,57) N(96,81) N(96,57) N(96,57)
    N(96,78) N(96,54) N(96,54) N(192,50) N(96,50) N(192,47) N(96,50) N(96,83) N(96,52) N(96,47) N(96,47)
    N(192,76) N(96,76) N(96,79) N(96,83) N(96,83) N(96,57) N(96,57) N(192,57) N(96,57) N(96,90) N(96,62)
    N(96,57) N(192,62) N(96,57) N(96,50) N(288,52) N(288,74) N(144,74) N(48,74) N(96,66) N(288,76) N(96,64)
    N(96,64) N(192,64) N(96,55) N(96,73) N(96,64) N(96,64) N(192,64) N(96,64) N(96,78) N(96,64) N(96,57)
    N(192,64) N(96,64) N(96,83) N(96,64) N(96,57) N(192,61) N(96,57) N(96,85) N(96,64) N(96,62) N(192,64)
    N(96,55) N(96,85) N(96,62) N(96,64) N(192,62) N(96,83) N(96,59) N(288,50) N(288,78) N(48,74) N(48,78)
    N(96,76) N(96,69) N(288,64)
    return r;
}

vec2 GetTrack0DNote(float x)
{
    vec2 r = vec2(-1.0);
    float t = 0.0;
    N(768,81) N(288,78) N(576,69) N(288,79) N(288,73) N(480,64) N(96,71) N(288,79) N(288,73) N(480,64)
    N(96,71) N(288,83) N(96,83) N(192,78) N(576,69) N(288,86) N(288,78) N(288,62) N(192,66) N(96,69) N(288,83)
    N(288,83) N(96,43) N(960,68) N(96,69) N(480,74) N(96,78) N(96,43) N(288,73) N(576,69) N(384,83) N(96,83)
    N(192,83) N(96,82) N(192,83) N(96,83) N(192,76) N(96,76) N(288,76) N(192,76) N(96,76) N(96,71) N(192,81)
    N(192,78) N(96,85) N(96,76) N(96,83) N(96,83) N(192,83) N(96,82) N(96,88) N(96,86) N(96,86) N(192,80)
    N(192,83) N(288,80) N(288,71) N(48,68) N(48,74) N(96,74) N(96,61)
    return r;
}

vec2 GetTrack0ENote(float x)
{
    vec2 r = vec2(-1.0);
    float t = 0.0;
    N(768,78) N(288,74) N(864,81) N(1152,83) N(288,79) N(864,78) N(288,74) N(864,81) N(288,81) N(864,86)
    N(288,76) N(96,83) N(960,80) N(96,81) N(480,86) N(192,71) N(288,83) N(576,74) N(384,74) N(96,74) N(192,74)
    N(96,73) N(192,74) N(96,74) N(1152,69) N(192,86) N(96,76) N(192,74) N(96,74) N(192,74) N(96,85) N(192,83)
    N(96,83) N(384,71) N(288,68) N(288,74) N(96,71) N(96,71) N(96,64)
    return r;
}

vec2 GetTrack0FNote(float x)
{
    vec2 r = vec2(-1.0);
    float t = 0.0;
    N(4224,74) N(2688,76) N(1728,78) N(4128,74) N(96,74) N(960,68) N(96,68) N(96,68)
    return r;
}

// ------------------- 8< ------------------- 8< ------------------- 8< -------------------

float NoteToHz(float n)
{  	
	return 440.0*pow( 2.0, (n-69.0)/12.0 );
}

float Sin(float x)
{
    return sin(x * 3.1415 * 2.0);
}

#if 1

float Instrument( const in vec2 vFreqTime )
{
    float f = vFreqTime.x;
    float t = vFreqTime.y;
    
    if( t < 0.0 )
        return 0.0;
    float x = 0.0;
    float a = 1.0;
    float h = 1.0;
    for(int i=0; i<8; i++)
    {
        x += Sin( f * t * h ) * exp2( t * -a );
        x += Sin( f * (t+0.005) * h * 0.5 ) * exp2( t * -a * 2.0 ) ;
        h = h + 1.01;
        a = a * 2.0;
    }
    
    return x;
}

#else

float Function(float t, float f)
{
    float t2 = t * f * radians(180.0);
    float y = 0.0;
    
    float h = 1.0;
    float a = 1.0;
    for( int i=0; i<8; i++)
    {
        float inharmonicity = 0.001;
        float f2 = h * sqrt( 1.0 + h * h *  inharmonicity);
        float r = sin( t2 * f2 );

        //r = r * a;
        r = r * exp2(t * -2.0 / a);
        
        y += r;

        h = h + 1.0;
        a = a * 0.6;
    }
    
    //y *= exp2(t * -4.0);
    return y;
}

float Main( float t, float f )
{
    return Function(t, f) + Function(t + 0.01, f * 0.51);
}

float Instrument( const in vec2 vFreqTime )
{
    return Main(vFreqTime.y, vFreqTime.x);
}
#endif

const float kMidiTimebase = 240.0;
const float kInvMidiTimebase = 1.0 / kMidiTimebase;
const float kTranspose = 12.0 * 0.0;

vec2 GetNoteData( const in vec2 vMidiResult, const in float fMidiTime )
{
    return vec2( NoteToHz(vMidiResult.x + kTranspose), abs(fMidiTime - vMidiResult.y) * kInvMidiTimebase );
}

float PlayMidi( const in float time )
{
    if(time < 0.0)
		return 0.0;
    
    float fMidiTime = time * kMidiTimebase;
    
    float fResult = 0.0;
    
    fResult += Instrument( GetNoteData( GetTrack0ANote(fMidiTime), fMidiTime ) );
    fResult += Instrument( GetNoteData( GetTrack0BNote(fMidiTime), fMidiTime ) );
    fResult += Instrument( GetNoteData( GetTrack0CNote(fMidiTime), fMidiTime ) );
    fResult += Instrument( GetNoteData( GetTrack0DNote(fMidiTime), fMidiTime ) );
    fResult += Instrument( GetNoteData( GetTrack0ENote(fMidiTime), fMidiTime ) );
    fResult += Instrument( GetNoteData( GetTrack0FNote(fMidiTime), fMidiTime ) );
    
    fResult = clamp(fResult * 0.05, -1.0, 1.0);
    
    float fFadeEnd = 60.0;
    float fFadeTime = 5.0;
    float fFade = (time - (fFadeEnd - fFadeTime)) / fFadeTime;    
    fResult *= clamp(1.0 - fFade, 0.0, 1.0);
    
    return fResult;
}

vec2 mainSound( in int samp,float time)
{
    return vec2( PlayMidi(time) );
}

//#define IMAGE_SHADER

#ifdef IMAGE_SHADER

float Function( float x )
{
	return mainSound( in int samp, iTime + x / (44100.0 / 60.0) ).x * 0.5 + 0.5;
}

float Plot( vec2 uv )
{
	float y = Function(uv.x);
	
	return abs(y - uv.y) * iResolution.y;	
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	
	vec2 uv = fragCoord.xy / iResolution.xy;
	
	vec3 vResult = vec3(0.0);
	
	vResult += Plot(uv);
	
	fragColor = vec4((vResult),1.0);
}
#endif

`;

const fragment = `
/////////////////////////////////////
// Settings

#define EMULATE_8BIT

#ifdef EMULATE_8BIT
	#define LIMIT_FRAMERATE
	#define SCANLINE_EFFECT
	#define NON_AA_LINES
	#define LOW_RESOLUTION
	#define XOR_PIXELS
#endif

#ifndef NON_AA_LINES
#ifdef XOR_PIXELS
#undef XOR_PIXELS
#endif
#endif

float kFramesPerSecond = 7.5;

#ifdef LOW_RESOLUTION
vec2 kWindowResolution = vec2(256.0, 192.0);
#else
vec2 kWindowResolution = iResolution.xy;
#endif

float kAALineWidth = 1.0;

/////////////////////////////////////
// Time

float GetSceneTime()
{
	#ifdef LIMIT_FRAMERATE
		return (floor(iTime * kFramesPerSecond) / kFramesPerSecond);
	#else
		return iTime;
	#endif
}

/////////////////////////////////////
// Line Rasterization

#ifdef NON_AA_LINES
float RasterizeLine(const in vec2 vPixel, const in vec2 vA, const in vec2 vB)
{
	// vPixel is the centre of the pixel to be rasterized
	
	vec2 vAB = vB - vA;	
	vec2 vAbsAB = abs(vAB);
	float fGradientSelect = step(vAbsAB.y, vAbsAB.x);

	vec2 vAP = vPixel - vA;

	float fAB = mix(vAB.y, vAB.x, fGradientSelect);
	float fAP = mix(vAP.y, vAP.x, fGradientSelect);
	
	// figure out the co-ordinates we intersect the vPixelCentre x or y axis
	float t = fAP / fAB;	
	vec2 vIntersection = vA + (vB - vA) * t;
	vec2 vIntersectionDist = abs(vIntersection - vPixel);
	
	vec2 vResult = step(vIntersectionDist, vec2(0.5));

	// mask out parts of the line beyond the beginning or end
	float fClipSpan = step(t, 1.0) * step(0.0, t);	
	
	// select the x or y axis result based on the gradient of the line
	return mix(vResult.x, vResult.y, fGradientSelect) * fClipSpan;
}
#else
float RasterizeLine(const in vec2 vPixel, const in vec2 vA, const in vec2 vB)
{
	// AA version based on distance to line
	
	// vPixel is the co-ordinate within the pixel to be rasterized
	
	vec2 vAB = vB - vA;	
	vec2 vAP = vPixel - vA;
	
	vec2 vDir = normalize(vAB);
	float fLength = length(vAB);
	
	float t = clamp(dot(vDir, vAP), 0.0, fLength);
	vec2 vClosest = vA + t * vDir;
	
	float fDistToClosest = 1.0 - (length(vClosest - vPixel) / kAALineWidth);

	float i =  clamp(fDistToClosest, 0.0, 1.0);
	
	return sqrt(i);
}
#endif

/////////////////////////////////////
// Matrix Fun

mat4 SetRotTrans( vec3 r, vec3 t )
{
    float a = sin(r.x); float b = cos(r.x); 
    float c = sin(r.y); float d = cos(r.y); 
    float e = sin(r.z); float f = cos(r.z); 

    float ac = a*c;
    float bc = b*c;

    return mat4( d*f,      d*e,       -c, 0.0,
                 ac*f-b*e, ac*e+b*f, a*d, 0.0,
                 bc*f+a*e, bc*e-a*f, b*d, 0.0,
                 t.x,      t.y,      t.z, 1.0 );
}

mat4 SetProjection( float d )
{
    return mat4( 1.0, 0.0, 0.0, 0.0,
				 0.0, 1.0, 0.0, 0.0,
				 0.0, 0.0, 1.0, d,
				 0.0, 0.0, 0.0, 0.0 );
}

mat4 SetWindow( vec2 s, vec2 t )
{
    return mat4( s.x, 0.0, 0.0, 0.0,
				 0.0, s.y, 0.0, 0.0,
				 0.0, 0.0, 1.0, 0.0,
				 t.x, t.y, 0.0, 1.0 );
}

/////////////////////////////////////
// Window Border Setup

const vec2 kWindowMin = vec2(0.1, 0.1);
const vec2 kWindowMax = vec2(0.9, 0.9);
const vec2 kWindowRange = kWindowMax - kWindowMin;

vec2 ScreenUvToWindowPixel(vec2 vUv)
{
	#ifdef LOW_RESOLUTION
		vUv = ((vUv - kWindowMin) / kWindowRange);
	#endif
	return vUv * kWindowResolution;
}

float IsPixelInWindow(vec2 vPixel)
{
	vec2 vResult = step(vPixel, kWindowResolution)
				* step(vec2(0.0), vPixel);
	return min(vResult.x, vResult.y);
}

/////////////////////////////

const int kVertexCount = 30;
vec3 kVertices[kVertexCount] = vec3[kVertexCount] (
    vec3(40, 0.0, 95),
    vec3(-40, 0.0, 95),
    vec3(00, 32.5, 30),
    vec3(-150,-3.8,-10),
    vec3(150,-3.8,-10),
    vec3(-110, 20,-50),
    vec3(110, 20,-50),
    vec3(160,-10,-50),
    vec3(-160,-10,-50),
    vec3(0, 32.5,-50),
    vec3(-40,-30,-50),
    vec3(40,-30,-50),
    vec3(-45, 10,-50),
    vec3(-10, 15,-50),
    vec3( 10, 15,-50),
    vec3(45, 10,-50) ,
    vec3(45,-15,-50),
    vec3(10,-20,-50),
    vec3(-10,-20,-50),
    vec3(-45,-15,-50),
    vec3(-2,-2, 95),
    vec3(-2,-2, 112.5),
    vec3(-100,-7.5,-50),
    vec3(-100, 7.5,-50),
    vec3(-110, 0,-50),
    vec3( 100, 7.5,-50),
    vec3( 110, 0,-50),
    vec3( 100,-7.5,-50),
    vec3(  0,0, 95),
    vec3(  0,0, 112.5)
);


float BackfaceCull(vec2 A, vec2 B, vec2 C)
{
	vec2 AB = B - A;
	vec2 AC = C - A;
	float c = AB.x * AC.y - AB.y * AC.x;
	return step(c, 0.0);
}

float Accumulate( const float x, const float y )
{
#ifdef XOR_PIXELS
	return x + y;
#else
	return max(x, y);
#endif
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
	vec2 uv = fragCoord.xy / iResolution.xy;
	
	// get window pixel co-ordinates for centre of current pixel
	vec2 vWindowPixelCords = ScreenUvToWindowPixel(uv);
	vec2 vPixel = floor(vWindowPixelCords) + 0.5;
	
	// Setup Transform
	mat4 mTransform;

	{
		vec3 vRot = vec3(0.1, 0.2, 0.3) * GetSceneTime();
		
		if(iMouse.z > 0.0)
		{
			vec2 vUnitMouse = iMouse.xy / iResolution.xy;
			vRot= vec3(vUnitMouse.yx * vec2(1.0, 1.0) + vec2(1.5, 0.5), 0.0) * 3.14159 * 2.0;
		}
		
		vec3 vTrans = vec3(0.0, 0.0, 350.0);
		mat4 mRotTrans = SetRotTrans( vRot, vTrans );
		mat4 mProjection = SetProjection( 1.0 );
		mat4 mWindow = SetWindow( vec2(1.0, iResolution.x/iResolution.y) * kWindowResolution, vec2(0.5) * kWindowResolution );
	
		mTransform = mWindow * mProjection * mRotTrans;
	}

	// Transform Vertices to Window Pixel Co-ordinates
	
	vec2 vScrVtx[kVertexCount];
	for(int i=0; i<kVertexCount; i++)
	{
		vec4 vhPos = mTransform * vec4(kVertices[i], 1.0);
		vScrVtx[i] = vhPos.xy / vhPos.w;
	}

	// Cull Faces
	const int kFaceCount = 14;
	float fFaceVisible[kFaceCount];
	
	// hull 
	fFaceVisible[0] = BackfaceCull( vScrVtx[2], vScrVtx[1], vScrVtx[0] );
	fFaceVisible[1] = BackfaceCull( vScrVtx[0], vScrVtx[1], vScrVtx[10] );
	fFaceVisible[2] = BackfaceCull( vScrVtx[6], vScrVtx[2], vScrVtx[0] );
	fFaceVisible[3] = BackfaceCull( vScrVtx[0], vScrVtx[4], vScrVtx[6] );
	fFaceVisible[4] = BackfaceCull( vScrVtx[0], vScrVtx[11], vScrVtx[7] );
	fFaceVisible[5] = BackfaceCull( vScrVtx[1], vScrVtx[2], vScrVtx[5] );

	fFaceVisible[6] = BackfaceCull( vScrVtx[5], vScrVtx[3], vScrVtx[1] );
	fFaceVisible[7] = BackfaceCull( vScrVtx[1], vScrVtx[3], vScrVtx[8] );
	fFaceVisible[8] = BackfaceCull( vScrVtx[5], vScrVtx[2], vScrVtx[9] );
	fFaceVisible[9] = BackfaceCull( vScrVtx[2], vScrVtx[6], vScrVtx[9] );
	fFaceVisible[10] = BackfaceCull( vScrVtx[5], vScrVtx[8], vScrVtx[3] );
	fFaceVisible[11] = BackfaceCull( vScrVtx[7], vScrVtx[6], vScrVtx[4] );
	fFaceVisible[12] = BackfaceCull( vScrVtx[9], vScrVtx[6], vScrVtx[7] );
	
	// engines - all culled together
	fFaceVisible[13] = BackfaceCull( vScrVtx[14], vScrVtx[15], vScrVtx[16] );

	// Draw Lines
	
	float fResult = 0.0;
	
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[0], vScrVtx[2]) * max(fFaceVisible[0], fFaceVisible[2]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[0], vScrVtx[4]) * max(fFaceVisible[3], fFaceVisible[4]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[0], vScrVtx[6]) * max(fFaceVisible[2], fFaceVisible[3]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[1], vScrVtx[0]) * max(fFaceVisible[0], fFaceVisible[1]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[1], vScrVtx[10]) * max(fFaceVisible[1], fFaceVisible[7]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[2], vScrVtx[1]) * max(fFaceVisible[0], fFaceVisible[5]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[2], vScrVtx[5]) * max(fFaceVisible[5], fFaceVisible[8]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[2], vScrVtx[9]) * max(fFaceVisible[8], fFaceVisible[9]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[3], vScrVtx[1]) * max(fFaceVisible[6], fFaceVisible[7]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[3], vScrVtx[8]) * max(fFaceVisible[7], fFaceVisible[10]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[4], vScrVtx[6]) * max(fFaceVisible[3], fFaceVisible[11]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[5], vScrVtx[1]) * max(fFaceVisible[5], fFaceVisible[6]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[5], vScrVtx[3]) * max(fFaceVisible[6], fFaceVisible[10]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[5], vScrVtx[8]) * max(fFaceVisible[10], fFaceVisible[12]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[6], vScrVtx[2]) * max(fFaceVisible[2], fFaceVisible[9]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[6], vScrVtx[9]) * max(fFaceVisible[9], fFaceVisible[12]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[7], vScrVtx[4]) * max(fFaceVisible[4], fFaceVisible[11]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[7], vScrVtx[6]) * max(fFaceVisible[11], fFaceVisible[12]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[8], vScrVtx[10]) * max(fFaceVisible[7], fFaceVisible[12]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[9], vScrVtx[5]) * max(fFaceVisible[8], fFaceVisible[12]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[10], vScrVtx[11]) * max(fFaceVisible[1], fFaceVisible[12]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[11], vScrVtx[0]) * max(fFaceVisible[1], fFaceVisible[4]));
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[11], vScrVtx[7]) * max(fFaceVisible[4], fFaceVisible[12]));

	if(fFaceVisible[13] > 0.0)	
	{
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[12], vScrVtx[13] ));
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[13], vScrVtx[18] ));
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[14], vScrVtx[15] ));
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[15], vScrVtx[16] ));
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[16], vScrVtx[17] ));
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[17], vScrVtx[14] ));
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[18], vScrVtx[19] ));
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[19], vScrVtx[12] ));
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[25], vScrVtx[26] ));
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[26], vScrVtx[27] ));
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[27], vScrVtx[25] ));
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[22], vScrVtx[23] ));
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[23], vScrVtx[24] ));
		fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[24], vScrVtx[22] ));
	}
	
	// gun
	fResult = Accumulate(fResult, RasterizeLine( vPixel, vScrVtx[28], vScrVtx[29]));

	#ifdef XOR_PIXELS	
	fResult = mod(fResult, 2.0);
	#endif
	
	// Clip pixel to window border
	fResult *= IsPixelInWindow(vPixel);
	
	// Scanline Effect
	#ifdef SCANLINE_EFFECT	
		float fScanlineEffect = cos((vWindowPixelCords.y + 0.5) * 3.1415 * 2.0) * 0.5 + 0.5;
		fResult = (fResult * 0.9 + 0.1) * (fScanlineEffect * 0.2 + 0.8);
	#endif
		
	fragColor = vec4(vec3(fResult),1.0);
}

`;

export default class implements iSub {
  key(): string {
    return 'MdsGzr';
  }
  name(): string {
    return 'Mostly Harmless';
  }
  sort() {
    return 486;
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
}
