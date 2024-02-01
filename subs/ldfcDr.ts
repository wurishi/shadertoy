import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define FONT_EFFECTS
#define AUTO_FONT_SPACING

#define FONT_SAMPLER iChannel0

const uint _SP = 0x20u;
const uint _EXCL = 0x21u;
const uint _QUOT = 0x22u;
const uint _NUM = 0x23u;
const uint _DOLLAR = 0x24u; 	// '$'
const uint _PERCNT = 0x25u; 	// '%'
const uint _AMP = 0x26u; 		// '&'
const uint _APOS = 0x27u;		// '''    
const uint _LPAR = 0x28u; 		// '('
const uint _RPAR= 0x29u; 		// ')'
const uint _AST = 0x2Au;		// '*'
const uint _PLUS = 0x2Bu;		// '+'
const uint _COMMA = 0x2Cu;		// ','    
const uint _MINUS = 0x2Du;		// '-'
const uint _PERIOD = 0x2Eu;	// '.'
const uint _SOL = 0x2Fu;		// '/' 

const uint _0 = 0x30u;
const uint _1 = 0x31u;
const uint _2 = 0x32u;
const uint _3 = 0x33u;
const uint _4 = 0x34u;
const uint _5 = 0x35u;
const uint _6 = 0x36u;
const uint _7 = 0x37u;
const uint _8 = 0x38u;
const uint _9 = 0x39u;
const uint _COLON = 0x3Au;		// ':' 
const uint _SEMI = 0x3Bu;		// ';' 
const uint _LT = 0x3Cu;		// '<' 
const uint _EQUALS = 0x3Du;	// '=' 
const uint _GT = 0x3Eu;		// '>' 
const uint _QUEST = 0x3Fu;		// '?' 
const uint _COMAT = 0x40u;		// '@' 
const uint _A = 0x41u;
const uint _B = 0x42u; 
const uint _C = 0x43u; 
const uint _D = 0x44u; 
const uint _E = 0x45u; 
const uint _F = 0x46u; 
const uint _G = 0x47u; 
const uint _H = 0x48u; 
const uint _I = 0x49u; 
const uint _J = 0x4Au;
const uint _K = 0x4Bu; 
const uint _L = 0x4Cu; 
const uint _M = 0x4Du; 
const uint _N = 0x4Eu; 
const uint _O = 0x4Fu;
const uint _P = 0x50u; 
const uint _Q = 0x51u; 
const uint _R = 0x52u; 
const uint _S = 0x53u; 
const uint _T = 0x54u;
const uint _U = 0x55u; 
const uint _V = 0x56u; 
const uint _W = 0x57u; 
const uint _X = 0x58u; 
const uint _Y = 0x59u;
const uint _Z = 0x5Au;
const uint _LSQB = 0x5Bu;
const uint _BSOL = 0x5Cu;
const uint _RSQB = 0x5Du;
const uint _CIRC = 0x5Eu;
const uint _LOWBAR = 0x5Fu;
const uint _GRAVE = 0x60u;
const uint _a = 0x61u; 
const uint _b = 0x62u; 
const uint _c = 0x63u; 
const uint _d = 0x64u; 
const uint _e = 0x65u;
const uint _f = 0x66u; 
const uint _g = 0x67u; 
const uint _h = 0x68u; 
const uint _i = 0x69u; 
const uint _j = 0x6Au;
const uint _k = 0x6Bu; 
const uint _l = 0x6Cu; 
const uint _m = 0x6Du; 
const uint _n = 0x6Eu; 
const uint _o = 0x6Fu;
const uint _p = 0x70u; 
const uint _q = 0x71u; 
const uint _r = 0x72u; 
const uint _s = 0x73u; 
const uint _t = 0x74u;
const uint _u = 0x75u; 
const uint _v = 0x76u; 
const uint _w = 0x77u; 
const uint _x = 0x78u; 
const uint _y = 0x79u;
const uint _z = 0x7Au;
const uint _LCUB = 0x7Bu;
const uint _VERBAR = 0x7Cu;
const uint _RCUB = 0x7Du;
const uint _TILDE = 0x7Eu;
const uint _EOL = 0x1000u;
const uint _BOLDON = 0x1001u;
const uint _BOLDOFF = 0x1002u;
const uint _ITALON = 0x1003u;
const uint _ITALOFF = 0x1004u;


vec4 SampleCharacterTex( uint iChar, vec2 vCharUV )
{
    uvec2 iChPos = uvec2( iChar % 16u, iChar / 16u );
    vec2 vUV = (vec2(iChPos) + vCharUV) / 16.0f;
    return textureLod( FONT_SAMPLER, vUV, 0.0 );
}
    
vec4 SampleCharacter( uint iChar, vec2 vCharUV )
{
    uvec2 iChPos = uvec2( iChar % 16u, iChar / 16u );
    vec2 vClampedCharUV = clamp(vCharUV, vec2(0.01), vec2(0.99));
    vec2 vUV = (vec2(iChPos) + vClampedCharUV) / 16.0f;

    vec4 vSample;
    
    float l = length( (vClampedCharUV - vCharUV) );

#if 0
    // Simple but not efficient - samples texture for each character
    // Extends distance field beyond character boundary
    vSample = textureLod( FONT_SAMPLER, vUV, 0.0 );
    vSample.gb = vSample.gb * 2.0f - 1.0f;
    vSample.a -= 0.5f+1.0/256.0;    
    vSample.w += l * 0.75;
#else    
    // Skip texture sample when not in character boundary
    // Ok unless we have big shadows / outline / font weight
    if ( l > 0.01f )
    {
        vSample.rgb = vec3(0);
		vSample.w = 2000000.0; 
    }
    else
    {
		vSample = textureLod( FONT_SAMPLER, vUV, 0.0 );    
        vSample.gb = vSample.gb * 2.0f - 1.0f;
        vSample.a -= 0.5f + 1.0/256.0;    
    }
#endif    
        
    return vSample;
}

#ifndef AUTO_FONT_SPACING
float CharExtentsLeft( uint iChar )
{
    if ( iChar < 32u )
    {
        return 0.1f;
    }
    
    switch( iChar )
    {
        case _EXCL:  case _APOS: case _PERIOD: case _COMMA: case _COLON: case _SEMI: return 0.4f;
        case _l: return 0.325f;        
        case _A: case _Y: case _Q: case _w:case _W: case _m: case _M: return 0.25f;
    }
	return 0.3f;
}

float CharWidth( uint iChar )
{
    if ( iChar < 32u )
    {     
        return 0.8f;
    }
   
    switch( iChar )
    {
        case _EXCL: case _APOS: case _PERIOD: case _COMMA: case _COLON: case _SEMI: return 0.2f;       
        case _1: case _j: return 0.3f;        
        case _l: return 0.35f;
        case _A: case _Y: case _Q: case _w: case _W: case _m: case _M: return 0.5f;
    }

    return 0.4f;
}
#endif 

struct CharExtents
{
    float left;
    float width;
};
    
float CharVerticalPos(uint iChar, vec2 vUV) 
{
    vec4 vSample = SampleCharacterTex(iChar, vUV);
    float dist = vSample.a - (127.0/255.0);
    dist *= vSample.g * 2.0 - 1.0;
    return vUV.x - dist;
}

CharExtents GetCharExtents( uint iChar )
{
    CharExtents result;

#ifdef AUTO_FONT_SPACING
    result.left = CharVerticalPos( iChar, vec2(0.02, 0.5) );
    float right = CharVerticalPos( iChar, vec2(0.98, 0.5) );
    result.width = right - result.left;
#else
    result.left = CharExtentsLeft( iChar );
    result.width = CharWidth( iChar );
#endif
    
    if ( iChar == _SP )
    {
        result.left = 0.3f;
        result.width = 0.4f;
    }
    return result;
}

struct PrintState
{
    vec2 vCanvasOrigin;
    
    // print position
    vec2 vStart;
    vec2 vPos;
    vec2 vPixelSize;
    bool EOL;

    // result
    float fDistance;
#ifdef FONT_EFFECTS    
    float fShadowDistance;
    vec2 vNormal;    
#endif
};    

void MoveTo( inout PrintState state, vec2 vPos )
{
    state.vStart = state.vCanvasOrigin - vPos;
    state.vPos = state.vStart;    
    state.EOL = false;
}

void ClearPrintResult( inout PrintState state )
{
    state.fDistance = 1000000.0;
#ifdef FONT_EFFECTS        
    state.fShadowDistance = 1000000.0;
    state.vNormal = vec2(0.0);    
#endif    
}

PrintState PrintState_InitCanvas( vec2 vCoords, vec2 vPixelSize )
{
    PrintState state;
    state.vCanvasOrigin = vCoords;
    state.vPixelSize = vPixelSize;
    
    MoveTo( state, vec2(0) );

    ClearPrintResult( state );
    
    return state;
}

struct LayoutStyle
{
    vec2 vSize;
    float fLineGap;
    float fAdvancement;
    bool bItalic;
    bool bBold;
#ifdef FONT_EFFECTS        
    bool bShadow;
    vec2 vShadowOffset;
#endif    
};
    
LayoutStyle LayoutStyle_Default()
{
    LayoutStyle style;
    style.vSize = vec2(16.0f, 16.0f);    
    style.fLineGap = 0.1f;
    style.fAdvancement = 0.1f;
    style.bItalic = false;
    style.bBold = false;    
#ifdef FONT_EFFECTS        
    style.vShadowOffset = vec2(0);
    style.bShadow = false;
#endif    
    return style;
}

struct RenderStyle
{
    vec3 vFontColor;
    float fFontWeight;
#ifdef FONT_EFFECTS            
    vec3 vOutlineColor;
    vec3 vHighlightColor;
    float fOutlineWeight;
    float fBevelWeight;
    float fShadowSpread;
    float fShadowStrength;
    vec2 vLightDir;
#endif    
};

RenderStyle RenderStyle_Default( vec3 vFontColor )
{
    RenderStyle style;
    style.vFontColor = vFontColor;
    style.fFontWeight = 0.0f;
#ifdef FONT_EFFECTS            
    style.vOutlineColor = vec3(1);
    style.vHighlightColor = vec3(0);
    style.fOutlineWeight = 0.0f;
    style.fBevelWeight = 0.0f;
    style.fShadowSpread = 0.0f;
    style.fShadowStrength = 0.0f;
    style.vLightDir = vec2(-1.0f, -0.5f );
#endif    
    return style;
}

void PrintEndCurrentLine( inout PrintState state, const LayoutStyle style )
{
    // Apply CR
    state.vPos.x = state.vStart.x;
    
    // advance Y position to bottom of descender based on current font size.
    float fFontDescent = 0.15f;
	state.vPos.y -= style.vSize.y * fFontDescent;    
}

void PrintBeginNextLine( inout PrintState state, const LayoutStyle style )
{
    // move Y position to baseline based on current font size
    float fFontAscent = 0.65f;
	state.vPos.y -= style.vSize.y * (fFontAscent + style.fLineGap);
}

void PrintEOL( inout PrintState state, const LayoutStyle style )
{
    if ( state.EOL )
    {
        PrintBeginNextLine( state, style );
    }
    PrintEndCurrentLine( state, style );
    state.EOL = true;
}

void PrintCh( inout PrintState state, inout LayoutStyle style, const uint iChar )
{
    if ( iChar == _EOL )
    {
        PrintEOL( state, style );
        return;
    }
    else
    if ( iChar == _BOLDON )
    {
        style.bBold = true;
        return;
    }
    else
    if ( iChar == _BOLDOFF )
    {
        style.bBold = false;
        return;
    }
    else
    if ( iChar == _ITALON )
    {
        style.bItalic = true;
        return;
    }
    else
    if ( iChar == _ITALOFF )
    {
        style.bItalic = false;
        return;
    }
    
    if ( state.EOL )
    {
        PrintBeginNextLine( state, style );
		state.EOL = false;
    }
    
    vec2 vUV = (state.vPos / style.vSize);

    /*if ( (vUV.y > -0.1) && (vUV.y < 0.1) && (abs(vUV.x) < 0.02 || abs(vUV.x - CharWidth(iChar)) < 0.02) )
    {
        state.fDistance = -10.0;
    }*/
    
	CharExtents extents = GetCharExtents( iChar );    
    vUV.y += 0.8f; // Move baseline
    vUV.x += extents.left - style.fAdvancement;
    
    if ( style.bItalic )
    {
    	vUV.x += (1.0 - vUV.y) * -0.4f;
    }
    
    vec3 v = SampleCharacter( iChar, vUV ).agb;
    if ( style.bBold )
    {
    	v.x -= 0.025f;
    }
    
    if ( v.x < state.fDistance )
    {
        state.fDistance = v.x;
#ifdef FONT_EFFECTS            
        state.vNormal = v.yz;
#endif        
    }

#ifdef FONT_EFFECTS            
    if ( style.bShadow )
    {
        float fShadowDistance = SampleCharacter( iChar, vUV - style.vShadowOffset ).a;
        if ( style.bBold )
        {
            fShadowDistance -= 0.025f;
        }
        
        if ( fShadowDistance < state.fShadowDistance )
        {
            state.fShadowDistance = fShadowDistance;
        }        
    }
#endif
    
    state.vPos.x -= style.vSize.x * (extents.width + style.fAdvancement);
}

float GetFontBlend( PrintState state, LayoutStyle style, float size )
{
    float fFeatherDist = 1.0f * length(state.vPixelSize / style.vSize);    
    float f = clamp( (size-state.fDistance + fFeatherDist * 0.5f) / fFeatherDist, 0.0, 1.0);
    return f;
}

void RenderFont( in PrintState state, in LayoutStyle style, in RenderStyle renderStyle, inout vec3 color )
{
#ifdef FONT_EFFECTS            
    if ( style.bShadow )
    {
        float fSize = renderStyle.fFontWeight + renderStyle.fOutlineWeight;
        float fBlendShadow = clamp( (state.fShadowDistance - fSize - renderStyle.fShadowSpread * 0.5) / -renderStyle.fShadowSpread, 0.0, 1.0);
        color.rgb = mix( color.rgb, vec3(0.0), fBlendShadow * renderStyle.fShadowStrength);    
    }

    if ( renderStyle.fOutlineWeight > 0.0f )
    {        
        float fBlendOutline = GetFontBlend( state, style, renderStyle.fFontWeight + renderStyle.fOutlineWeight );
        color.rgb = mix( color.rgb, renderStyle.vOutlineColor, fBlendOutline);
    }
#endif
    
    float f = GetFontBlend( state, style, renderStyle.fFontWeight );

    vec3 vCol = renderStyle.vFontColor;
	
#ifdef FONT_EFFECTS            
    if ( renderStyle.fBevelWeight > 0.0f )
    {    
        float fBlendBevel = GetFontBlend( state, style, renderStyle.fFontWeight - renderStyle.fBevelWeight );    
        float NdotL = dot( state.vNormal, normalize(renderStyle.vLightDir ) );
        float shadow = 1.0 - clamp(-NdotL, 0.0, 1.0f);
        float highlight = clamp(NdotL, 0.0, 1.0f);
        highlight = pow( highlight, 10.0f);
        vCol = mix( vCol, vCol * shadow + renderStyle.vHighlightColor * highlight, 1.0 - fBlendBevel);
    }
#endif
    
    color.rgb = mix( color.rgb, vCol, f);    
}

#define ARRAY_PRINT(STATE, STYLE, CHAR_ARRAY ) { for (int i=0; i<CHAR_ARRAY.length(); i++) PrintCh( STATE, STYLE, CHAR_ARRAY[i] ); }

void Print( inout PrintState state, LayoutStyle style, uint value )
{
	uint place = 1000000000u;

    bool leadingZeros = true;
    while( place > 0u )
    {
        uint digit = (value / place) % 10u;
        if ( place == 1u || digit != 0u )
        {
            leadingZeros = false;
        }
        
        if (!leadingZeros)
        {
            PrintCh( state, style, _0 + digit );
        }
        place = place / 10u;
    }    
}

void Print( inout PrintState state, LayoutStyle style, int value )
{
    if ( value < 0 )
    {
        PrintCh( state, style, _MINUS );
        value = -value;
    }

    Print ( state, style, uint(value) );    
}

void Print( inout PrintState state, LayoutStyle style, float value, int decimalPlaces )
{
    if ( value < 0.0f )
    {
        PrintCh( state, style, _MINUS );
    }
    value = abs(value);
    
    int placeIndex = 10;
    
    bool leadingZeros = true;
    while( placeIndex >= -decimalPlaces )
    {
        float place = pow(10.0f, float(placeIndex) );
        float digitValue = floor( value / place );
        value -= digitValue * place;
        
        
        uint digit = min( uint( digitValue ), 9u );
        
        if ( placeIndex == -1 )
        {
            PrintCh( state, style, _PERIOD );
        }
        
        if ( placeIndex == 0 || digit != 0u )
        {
            leadingZeros = false;
        }        
        
        if ( !leadingZeros )
        {
        	PrintCh( state, style, _0 + digit );
        }
                
        placeIndex--;
    }
}

// --------------- 8< --------------- 8< --------------- 8< --------------- 8< ---------------


void PrintMessage( inout PrintState state, LayoutStyle style )
{
    uint strA[] = uint[] ( _H, _e, _l, _l, _o, _COMMA, _SP, _w, _o, _r, _l, _d, _PERIOD, _EOL );
    ARRAY_PRINT( state, style, strA );

    uint strB[] = uint[] ( _ITALON, _A, _B, _C, _1, _2, _3, _ITALOFF, _EOL );
    ARRAY_PRINT( state, style, strB );
    
    uint strC[] = uint[] ( _BOLDON, _A, _B, _C, _1, _2, _3, _BOLDOFF, _SP );
    ARRAY_PRINT( state, style, strC );
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{   
    fragColor = vec4(1);
    fragColor.rgb = texture(iChannel2, fragCoord.xy * 0.005).bgr * 0.3 + 0.7;
    
    
///////////////////////////
// Example Usage
///////////////////////////
    
    vec2 vCanvasCoord = vec2( fragCoord.x, iResolution.y - 1.0f - fragCoord.y );    
    vec2 vCanvasPixelSize = vec2(1.0);

	bool bScaleWithResolution = true;    
    
    if ( bScaleWithResolution )
    {
    	vCanvasCoord = vec2( fragCoord.x, iResolution.y - 1.0f - fragCoord.y ) * vec2(640.0, 360) / iResolution.xy;
    	vCanvasPixelSize = vec2(640.0, 360) / iResolution.xy;
        
        //vec2 dVdx = dFdx(vCanvasCoord);
        //vec2 dVdy = dFdy(vCanvasCoord);
        //vCanvasPixelSize = vec2( length(vec2(dVdx.x, dVdy.x) ), length(vec2(dVdx.y, dVdy.y) ) );
    }
    
    PrintState state = PrintState_InitCanvas( vCanvasCoord, vCanvasPixelSize );

    LayoutStyle style = LayoutStyle_Default();
    //style.vSize = vec2(48.0f, 64.0f);
    
    // Without this line the print position specifies the baseline
    // with this line we advance by the ascent and line gap
    PrintBeginNextLine(state, style);
    
    uint str[] = uint[] ( _D, _e, _f, _a, _u, _l, _t, _SP, _S, _t, _y, _l, _e, _PERIOD, _EOL );
    ARRAY_PRINT( state, style, str );

    Print( state, style, int(iDate.x) );
    PrintCh( state, style, _MINUS );
    Print( state, style, int(iDate.y) + 1 );
    PrintCh( state, style, _MINUS );
    Print( state, style, int(iDate.z) );
    PrintCh( state, style, _COMMA );
    PrintCh( state, style, _SP );
    Print( state, style, int(mod(iDate.w / (60.0 * 60.0), 24.0)) );
    PrintCh( state, style, _COLON );
    Print( state, style, int(mod(iDate.w / 60.0, 60.0)) );
    PrintCh( state, style, _COMMA );
    PrintCh( state, style, _SP );
    Print( state, style, iTime, 3 );
    PrintEOL( state, style );

    RenderStyle renderStyle = RenderStyle_Default( vec3(0.0) );
    RenderFont( state, style, renderStyle, fragColor.rgb );

////////////////////////////    

    ClearPrintResult( state );
    
    uint strB[] = uint[] ( _T, _H, _E, _SP, _Q, _U, _I, _C, _K, _SP, _B, _R, _O, _W, _N, _SP, _F, _O, _X, _SP, _J, _U, _M, _P, _S, _SP, _O, _V, _E, _R, _SP, _T, _H, _E, _SP, _L, _A, _Z, _Y, _SP, _D, _O, _G, _PERIOD, _EOL );
    ARRAY_PRINT( state, style, strB );
    uint strC[] = uint[] ( _T, _h, _e, _SP, _q, _u, _i, _c, _k, _SP, _b, _r, _o, _w, _n, _SP, _f, _o, _x, _SP, _j, _u, _m, _p, _s, _SP, _o, _v, _e, _r, _SP, _t, _h, _e, _SP, _l, _a, _z, _y, _SP, _d, _o, _g, _PERIOD, _EOL );
    ARRAY_PRINT( state, style, strC );
    uint strD[] = uint[] ( _T, _h, _e, _SP, _BOLDON, _q, _u, _i, _c, _k, _BOLDOFF,_SP, _b, _r, _o, _w, _n, _SP, _f, _o, _x, _SP, _BOLDON, _ITALON, _j, _u, _m, _p, _s, _ITALOFF, _BOLDOFF, _SP, _o, _v, _e, _r, _SP, _t, _h, _e, _SP, _ITALON, _l, _a, _z, _y, _ITALOFF, _SP, _d, _o, _g, _PERIOD, _EOL );
    ARRAY_PRINT( state, style, strD );
    
    RenderFont( state, style, renderStyle, fragColor.rgb );
    ClearPrintResult( state );

    style.vSize = vec2(64.0f, 64.0f) * 0.6;
    style.fAdvancement = 0.15;

#ifdef FONT_EFFECTS         
    style.vShadowOffset = vec2(0.075, 0.1);
    style.bShadow = true;
#endif    
    
    PrintMessage( state, style );
        
    renderStyle.vFontColor = texture(iChannel1, fragCoord.xy * 0.005).rgb;
        
    renderStyle.fFontWeight = 0.02f;
#ifdef FONT_EFFECTS                
    renderStyle.vOutlineColor = vec3(0.0, 0.0, 0.0);
    renderStyle.vHighlightColor = vec3(1.0, 1.0, 1.0);
    renderStyle.fOutlineWeight = 0.02f;
    renderStyle.fBevelWeight = 0.05f;
    renderStyle.fShadowSpread = 0.15f;
    renderStyle.fShadowStrength = 0.0f;
    renderStyle.vLightDir = vec2(-1.0f, -0.5f );
#endif    
    
    RenderFont( state, style, renderStyle, fragColor.rgb );

    ClearPrintResult( state );

#ifdef FONT_EFFECTS                
    renderStyle.fShadowSpread = 0.1f;
    renderStyle.fShadowStrength = 0.6f;
#endif

    PrintMessage( state, style );
    RenderFont( state, style, renderStyle, fragColor.rgb );

    ClearPrintResult( state );
    
	style.vSize *= 1.5;
    
    //MoveTo( state, vec2(100, 100) );
    PrintMessage( state, style );
        
    renderStyle.fFontWeight = 0.0f;
    renderStyle.vFontColor = vec3(0.4, 0.7, 1.0);

#ifdef FONT_EFFECTS                    
    renderStyle.vOutlineColor = vec3(0.0, 0.0, 0.0);
    renderStyle.vHighlightColor = vec3(0.0);
    renderStyle.fOutlineWeight = 0.05;
    renderStyle.fBevelWeight = 0.0;
#endif
    
    RenderFont( state, style, renderStyle, fragColor.rgb );    
}

`;

export default class implements iSub {
  key(): string {
    return 'ldfcDr';
  }
  name(): string {
    return 'SDF Font Texture Adventures';
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
  channels() {
    return [
      webglUtils.FONT_TEXTURE,
      webglUtils.WOOD_TEXTURE,
      webglUtils.ROCK_TEXTURE,
    ];
  }
}
