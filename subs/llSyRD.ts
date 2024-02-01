import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
vec3 BlackBody( float t )
{
    float h = 6.6e-34; // Planck constant
    float k = 1.4e-23; // Boltzmann constant
    float c = 3e8;// Speed of light

    vec3 w = vec3( 610.0, 549.0, 468.0 ) / 1e9; // sRGB approximate wavelength of primaries
    
    vec3 w5 = w*w*w*w*w;    
    vec3 o = 2.*h*(c*c) / (w5 * (exp(h*c/(w*k*t)) - 1.0));

    return o;
}



float fHuePreservingFactor = 1.0;
float fDesaturateFactor = 0.8;

const float CtoK = 273.15;

const float fTempMinK = 600.0 + CtoK;
const float fTempMaxK = 5000.0 + CtoK;

vec2 vFlameResolution = vec2( 320, 200 );


vec3 SampleEnvironment( vec3 vDir )
{
    vec3 vEnvMap = texture(iChannel1, vDir.xy).rgb;
    vEnvMap = vEnvMap * vEnvMap;
    
    float kEnvmapExposure = 0.999;
    vec3 vResult = -log2(1.0 - vEnvMap * kEnvmapExposure);    

    return vResult;
}

float TonemapCompressRangeNorm( float x )
{
	return 1.0f - exp( -x );
}

float TonemapCompressRangeFloat( float x, float t )
{
	return ( x < t ) ? x : t + TonemapCompressRangeNorm( (x-t) / (1.0f - t) ) * (1.0f - t);
}

vec3 TonemapCompressRangeFloat3( vec3 x, float t )
{
	x.r = TonemapCompressRangeFloat( x.r, t );
	x.g = TonemapCompressRangeFloat( x.g, t );
	x.b = TonemapCompressRangeFloat( x.b, t );
	return x;
}


vec3 Tonemap( vec3 x )
{
    return TonemapCompressRangeFloat3( x, 0.6 );
}

float max3( vec3 vCol )
{
    //return dot( vCol, vLumaCoeff );
    
    return max( vCol.r, max( vCol.g, vCol.b ) );
}

/////////////////////
// Font stuff
/////////////////////


// Font characters
const uint
   	// HTML Entity Names
    
    _SP = 0x20u,		// ' '
    _EXCL = 0x21u, 		// '!' 
    _QUOT = 0x22u, 		// '"'
    _NUM = 0x23u,  		// '#'
    _DOLLAR = 0x24u, 	// '$'
    _PERCNT = 0x25u, 	// '%'
    _AMP = 0x26u, 		// '&'
    _APOS = 0x27u,		// '''    
    _LPAR = 0x28u, 		// '('
    _RPAR= 0x29u, 		// ')'
    _AST = 0x2Au,		// '*'
    _PLUS = 0x2Bu,		// '+'
    _COMMA = 0x2Cu,		// ','    
    _MINUS = 0x2Du,		// '-'
    _PERIOD = 0x2Eu,	// '.'
    _SOL = 0x2Fu,		// '/' 

    _0 = 0x30u, _1 = 0x31u, _2 = 0x32u, _3 = 0x33u, _4 = 0x34u, 
    _5 = 0x35u, _6 = 0x36u, _7 = 0x37u, _8 = 0x38u, _9 = 0x39u, 

    _COLON = 0x3Au,		// ':' 
    _SEMI = 0x3Bu,		// ';' 
    _LT = 0x3Cu,		// '<' 
    _EQUALS = 0x3Du,	// '=' 
    _GT = 0x3Eu,		// '>' 
    _QUEST = 0x3Fu,		// '?' 
    _COMAT = 0x40u,		// '@' 
    
    _A = 0x41u, _B = 0x42u, _C = 0x43u, _D = 0x44u, _E = 0x45u, 
    _F = 0x46u, _G = 0x47u, _H = 0x48u, _I = 0x49u, _J = 0x4Au,
    _K = 0x4Bu, _L = 0x4Cu, _M = 0x4Du, _N = 0x4Eu, _O = 0x4Fu,
    _P = 0x50u, _Q = 0x51u, _R = 0x52u, _S = 0x53u, _T = 0x54u,
    _U = 0x55u, _V = 0x56u, _W = 0x57u, _X = 0x58u, _Y = 0x59u,
    _Z = 0x5Au,

    _LSQB = 0x5Bu,		// '[' 
    _BSOL = 0x5Cu,		// '\'
    _RSQB = 0x5Du,		// ']' 
    _CIRC = 0x5Eu,		// '^' 
_LOWBAR = 0x5Fu,	// '_' 
    _GRAVE = 0x60u,		// 
    
    _a = 0x61u, _b = 0x62u, _c = 0x63u, _d = 0x64u, _e = 0x65u,
    _f = 0x66u, _g = 0x67u, _h = 0x68u, _i = 0x69u, _j = 0x6Au,
    _k = 0x6Bu, _l = 0x6Cu, _m = 0x6Du, _n = 0x6Eu, _o = 0x6Fu,
    _p = 0x70u, _q = 0x71u, _r = 0x72u, _s = 0x73u, _t = 0x74u,
    _u = 0x75u, _v = 0x76u, _w = 0x77u, _x = 0x78u, _y = 0x79u,
    _z = 0x7Au,

	_LCUB = 0x7Bu,		// '{'
    _VERBAR = 0x7Cu,	// '|'
    _RCUB = 0x7Du,		// '}'
    _TILDE = 0x7Eu,		// '~'
    
        
    _EOL = 0x1000u, 	// End of Line - Carriage Return & Line Feed    
    _BOLDON = 0x1001u,	// Special
    _BOLDOFF = 0x1002u,	// Special
    _ITALON = 0x1003u,	// Special
    _ITALOFF = 0x1004u	// Special
;


void PrintChar( inout vec2 vOutCharUV, vec2 vUV, uint uChar )
{
    if ( any( lessThan( vUV, vec2(0) ) ) ) return;
    if ( any( greaterThanEqual( vUV, vec2(1) ) ) ) return;
        
    uint uCharX = uChar % 16u;
    uint uCharY = uChar / 16u;
    
    vec2 vCharPos = vec2(uCharX, uCharY) / 16.0;
    vec2 vCharSize = vec2(1,1) / 16.0;
    
    vec2 vInset = vec2( 0.25, 0.0 );
    
    if ( uChar == 87u || uChar == 119u )
        vInset.x -= 0.05; // thinner 'W'
    
    vCharPos += vCharSize * vInset;
    
    vCharSize *= 1.0 - vInset * 2.0;
    
    vOutCharUV = vUV * vCharSize + vCharPos;    
}

struct TextString
{
    int firstChar;
    int charCount;
};

struct TextStrings
{
    TextString strings[6];
    uint characters[47];
};
    
const TextStrings textStrings = TextStrings (
   TextString[6](
       	TextString( 0, 6 ),
       	TextString( 6, 14 ),
       	TextString( 20, 8 ),
       	TextString( 28, 9 ),
        TextString( 37, 7 ),
       	TextString( 44, 3 )
       ),
       
   uint[47] ( _F, _i, _l, _m, _i, _c, 
              _H, _u, _e, _SP, _P, _r, _e, _s, _e, _r, _v, _i, _n, _g,
            _C, _o, _n, _s, _t, _a, _n, _t,
            _B, _l, _a, _c, _k, _b, _o, _d, _y,
            _P, _a, _l, _e, _t, _t, _e,
            _H, _u, _e)
);
    
void PrintString( inout vec2 vCharUV, vec2 vFontUV, int stringIndex )
{
    int lineCharPos = int(floor(vFontUV.x));
    int lineIndex = int(floor(vFontUV.y));
    
	if ( lineIndex != 0 )
		return;
    
    TextString currString = textStrings.strings[stringIndex];
    
	if ( lineCharPos < 0 || lineCharPos >= currString.charCount )
        return;
    
    int charIndex = currString.firstChar + lineCharPos;
    
    uint char = textStrings.characters[ charIndex ];
    
    PrintChar( vCharUV, fract(vFontUV), char );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 vUV = fragCoord.xy / iResolution.xy;
    ivec2 vQuadrant = ivec2( floor( vUV * 2.0 ) );
    int iQuadrant = vQuadrant.x + vQuadrant.y * 2;
    
    vec2 vQuadrantUV = fract( vUV * 2.0 ) * 1.2 - 0.1;
    
    float fIntensity = texture( iChannel0, vQuadrantUV * vFlameResolution / iChannelResolution[0].xy ).r;    

	vec3 vCol = vec3(0);
    
    // Draw Intensity Color Bar
    if ( vQuadrantUV.y < 0.1 )
    {
        fIntensity = vQuadrantUV.x;
    }
    
    float fFlameLinear = -log2( 1.0 - fIntensity * fIntensity * 0.999);
    
    float fFlameBrightness = fFlameLinear * 10.0;
    
    vec3 vFlameColor = vec3(0);
    vec3 vFlame = vec3(0);
    if ( vQuadrant.y > 0 )
    {
        // Constant color        
        vFlameColor = normalize(vec3(1.0, 0.25, 0.01));
    }
    else
    {
        // blackbody color
        float fTemperature = fFlameLinear * (fTempMaxK - fTempMinK) + fTempMinK;
        vFlameColor = normalize( BlackBody( fTemperature ) );

        // Hack blue flame color (not based on black body equations)
        //vFlameColor = 1.0 - exp( -fTemperature * (vec3(.0002, .0004, .02)));        
    }    
        
    vec3 vEnvironment = SampleEnvironment( vec3(vQuadrantUV.x - 0.5, vQuadrantUV.y - 0.9, 0.8) ) * 0.3;
    //vEnvironment *= 0.0f;
    vCol = vEnvironment + vFlameColor * fFlameBrightness;    

    float fExposure = 1.0f;
    if ( iMouse.z > 0.0 )
    {
    	fExposure *= 10.0 * iMouse.x / iResolution.x;
    }  
    
    //fExposure = 2.0;
    
    vCol *= fExposure;

    // Desaturate bright colors
    float L = max3(vCol);
    float fDesaturateStrength = 0.01;
    if ( vQuadrant.x > 0 )
    {
        // Hue preserving tonemap
        fDesaturateStrength = 0.2;
    }
    float fDesaturate = 1.0 - exp2( L * -fDesaturateStrength);
    vCol = mix( vCol, vec3(L), fDesaturate * fDesaturateFactor );            
    
    if ( vQuadrant.x > 0 )
    {
        // Hue preserving tonemap
        
        //if ( fLuma > 0.0 )
        {            
	        float fLuma = max3(vCol);
            vec3 vHue = vCol / fLuma;
            
            vec3 vHueShifted = Tonemap( vCol );
            
            float vTonemapLuma = Tonemap( vec3( fLuma ) ).x;            
            vec3 vHuePreserved = vHue * vTonemapLuma;
            
            vCol = mix( vHueShifted, vHuePreserved, fHuePreservingFactor);
        }
    }
    else
    {
        // Filmic tonemap
	    vCol = Tonemap( vCol );
    }
    
    // Output gamma
    vCol = pow( vCol, vec3(1.0 / 2.4) );
    
    
    if ( any( lessThan( vQuadrantUV, vec2(0) ) ) || any( greaterThan( vQuadrantUV, vec2(1) ) ) )
    {
        vCol = vec3(0.0, 0.0, 0.0);
    }       
    
    vec2 vFontUV = fragCoord / iResolution.xy;    
    vFontUV.y = 1.0 - vFontUV.y;
    vFontUV -= 0.5;
    
    vFontUV *= 15.0;
    vFontUV.x *= 3.0;
    
    vec2 vCharUV = vec2(0);
    
    PrintString( vCharUV, vFontUV - vec2(-14, -0.5), 0 );
    PrintString( vCharUV, vFontUV - vec2(4, -0.5), 1 );

    PrintString( vCharUV, vFontUV - vec2(-4, -5), 2 );
    PrintString( vCharUV, vFontUV - vec2(-1.5, -4), 5 );
    PrintString( vCharUV, vFontUV - vec2(-4.5, 4), 3 );
    PrintString( vCharUV, vFontUV - vec2(-3.5, 5), 4 );
    float fFont = textureLod( iChannel2, vCharUV, 0.0 ).w;    

    float fOutline = clamp ( (0.56 - fFont) * 20.0, 0.0, 1.0 );
    float fMain = clamp ( (0.52 - fFont) * 20.0, 0.0, 1.0 );
    
    vCol = mix( vCol, vec3(0), fOutline );
    vCol = mix( vCol, vec3(1,1,1), fMain );    
    
    //vCol = vec3(fIntensity);
    
	fragColor = vec4(vCol,1.0);
}
`;

const f = `
vec2 vFlameResolution = vec2( 320, 200 );

float SampleBackbuffer( vec2 vCoord )
{
    if ( any( greaterThanEqual( vCoord, vFlameResolution ) ) )
    {
        return 0.0;
    }

    if ( vCoord.x < 0.0 )
    {
        return 0.0;
    }
    
	return clamp( texture(iChannel0, vCoord / iResolution.xy).r, 0.0, 1.0 );
}
 
// Average pixels surrounding vCoord
float GetIntensityAverage( vec2 vCoord )
{
	float fDPixel = 1.0;
	
	float fResult 	= SampleBackbuffer( vCoord + vec2(0.0, 0.0) )
			+ SampleBackbuffer( vCoord + vec2( fDPixel, 0.0) )
		      	+ SampleBackbuffer( vCoord + vec2(-fDPixel, 0.0) )
			+ SampleBackbuffer( vCoord + vec2(0.0,  fDPixel) )
			+ SampleBackbuffer( vCoord + vec2(0.0, -fDPixel) );
	
	return fResult / 5.0;       
}
 

vec2 GetIntensityGradient(vec2 vCoord)
{
	float fDPixel = 1.0;
	
	float fPX = SampleBackbuffer(vCoord + vec2( fDPixel, 0.0));
	float fNX = SampleBackbuffer(vCoord + vec2(-fDPixel, 0.0));
	float fPY = SampleBackbuffer(vCoord + vec2(0.0,  fDPixel));
	float fNY = SampleBackbuffer(vCoord + vec2(0.0, -fDPixel));
	
	return vec2(fPX - fNX, fPY - fNY);              
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
#if 0
    // pause update
    fragColor = texelFetch( iChannel0, ivec2(fragCoord), 0 );
    return;
#endif    
    
	vec2 vCoord = fragCoord.xy;

    if ( any( greaterThanEqual( vCoord, vFlameResolution ) ) )
    {
        fragColor = vec4(0);
        return;
    }

    
	// get the intensity at the current pixel
	float fCurrPixelValue = SampleBackbuffer(vCoord);
	
	vec2 vFlamePos = vCoord;
    vec2 vFlameUV = vFlamePos / vFlameResolution;
	
	// move 'down' more the 'hotter' the pixel we sampled was
	// this is the main trick to get flame effect looking interesting
	vFlamePos.y -= fCurrPixelValue * 32.0;
	
	// always sample at least one pixel below
	vFlamePos.y -= 1.0;
	
	// move down the intensity gradient
	// (not really necessary for effect but gives the flames some sideways movement + a better shape)
	vFlamePos -= GetIntensityGradient(vCoord) * 5.0; 
	
	// average the surrounding pixels at the new position
	float fIntensity = GetIntensityAverage(vFlamePos);
	
	// fade
	fIntensity *= 0.95f;
    //fIntensity -= 0.01f;
	
	// "random" junk in the bottom few pixels
	if(gl_FragCoord.y < 2.0)
	{
        if ( vFlameUV.x > 0.4 && vFlameUV.x < 0.6)
        {
			fIntensity = fract(sin(fract(iTime + fragCoord.x * 124.1231243) * 32.3242 + sin(iTime * 23.234234 + fragCoord.x * 1.451243)));
        }
	}
	
    fragColor = vec4(fIntensity);
}
`;

export default class implements iSub {
  key(): string {
    return 'llSyRD';
  }
  name(): string {
    return 'Blackbody Palette';
  }
  // sort() {
  //   return 0;
  // }
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
}
