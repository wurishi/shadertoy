import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `

///////////////////////////
// Keyboard
///////////////////////////

const float KEY_SPACE = 32.5/256.0;
const float KEY_LEFT  = 37.5/256.0;
const float KEY_UP    = 38.5/256.0;
const float KEY_RIGHT = 39.5/256.0;
const float KEY_DOWN  = 40.5/256.0;

const float KEY_PLUS 	= 187.5/256.0;
const float KEY_MINUS  	= 189.5/256.0;

bool Key_IsPressed(float key)
{
    return texture( iChannel0, vec2(key, 0.0) ).x > 0.0;
}

bool Key_IsToggled(float key)
{
    return texture( iChannel0, vec2(key, 1.0) ).x > 0.0;
}

///////////////////////////


float VGARainbowChannel( float i, float a, float b, float c, float d, float e )
{    
    if ( i >= 8.0 ) i = 16.0 - i;
    if ( i <= 0.0 ) return a;
    if ( i == 1.0 ) return b;
    if ( i == 2.0 ) return c;
    if ( i == 3.0 ) return d;
    if ( i >= 4.0 ) return e;
    return a;
}

vec3 VGARainbow( float i, float a, float e )
{
    vec3 vi = mod( vec3( i ) + vec3(0,16,8), vec3(24) );

    float b = floor(a * 3./4. + e * 1.0 / 4.0 + 0.25);
    float c = floor(a * 2./4. + e * 2.0 / 4.0 + 0.25);
    float d = floor(a * 1./4. + e * 3.0 / 4.0 + 0.25);
    
    vec3 col;
    col.r = VGARainbowChannel( vi.r, a, b, c, d, e );
    col.g = VGARainbowChannel( vi.g, a, b, c, d, e );
    col.b = VGARainbowChannel( vi.b, a, b, c, d, e );

    return col;
}

vec3 VGAPaletteEntry( float i )
{
    i = floor( i );
    
    // EGA
    if ( i < 16.0 )
    {
        vec3 col;
        col.b  = floor( mod( i / 1.0, 2.0  )) * 2.0;
        col.g  = floor( mod( i / 2.0, 2.0  )) * 2.0;
        col.r  = floor( mod( i / 4.0, 2.0  )) * 2.0;        
        
        col += floor( mod( i / 8.0, 2.0  ) );
        
        if ( i == 6.0 ) col = vec3(2,1,0); // Special brown!

        return col * 21.;
    }

    // Greys
    if ( i == 16.0 ) return vec3(0.0);
    
    if ( i < 32.0 )
    {        
        float x = (i - 17.0);        
        return vec3( floor( .00084 * x * x * x * x - .01662 * x * x * x + .1859 * x * x + 2.453 * x + 5.6038 ) );
    }
    
    // Rainbows
    float rainbowIndex = mod( i - 32.0, 24.0 );
    float rainbowType = floor( (i - 32.0) / 24.0 );
    
    float rainbowTypeMod = floor( mod( rainbowType, 3.0 ) );
    float rainbowTypeDiv = floor( rainbowType / 3.0 );
    
    float rainbowLow = 0.;
    if ( rainbowTypeMod == 1.0 ) rainbowLow = 31.0;
    if ( rainbowTypeMod == 2.0 ) rainbowLow = 45.0;
    
    float rainbowHigh = 63.;
    if ( rainbowTypeDiv == 1.0 )
    {
        rainbowHigh = 28.0;
        rainbowLow = floor( rainbowLow / 2.2 );
    }
    if ( rainbowTypeDiv == 2.0 )
    {
        rainbowHigh = 16.0;
        rainbowLow = floor( rainbowLow / 3.8 );
    }
    
    if ( rainbowType < 9.0 )
    {
	    return VGARainbow( rainbowIndex, rainbowLow, rainbowHigh );
    }
    
    return vec3( 0.0 );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 vUV = fragCoord.xy / iResolution.xy;
    
    vec2 vFakeResolution = vec2(640,480);
    vUV = floor(vUV * vFakeResolution) / vFakeResolution;
    
    vec2 vFocus = vec2(-0.5, 0.0);
    vec2 vScale = vec2(2.0);
    
    if ( iMouse.z > 0.0 )
    {
    	vFocus += 2.0 * ((iMouse.xy / iResolution.xy) * 2.0 - 1.0);
    	vScale *= 0.02;
    }
    
    vScale.y /= iResolution.x / iResolution.y;
    
    vec2 z = vec2(0);
    vec2 c = vFocus + (vUV * 2.0 - 1.0) * vScale;
    
    bool bInside = true;
    
    float fIter = 0.0;
    for(int iter = 0; iter < 512; iter++)
    {        
 		z = mat2(z,-z.y,z.x) * z + c;
     
        if ( dot(z,z) > 4.0 )            
        {
            bInside = false;
            break;
        }       
        
        fIter++;
    }
    
    float fIndex = 0.0;
    if ( bInside ) 
    {
        //fIndex = 0.0; // black set
        fIndex = 1.0; // blue set
    }
    else
    {
 
        if ( Key_IsToggled( KEY_PLUS ) || Key_IsToggled( KEY_RIGHT ) )
        {
        	fIter += iTime * 10.0;
        }
        else
        if ( Key_IsToggled( KEY_MINUS ) || Key_IsToggled( KEY_LEFT ) )
        {
        	fIter -= iTime * 10.0;
        }
        
    	fIndex = 1.0 + mod( fIter, 255.0 );
    }
    
	fragColor.rgb = VGAPaletteEntry( fIndex ) / 63.0;
    fragColor.a = 1.0;
}

/*
vec3 VGAPaletteEntry( float i )
{
    float testIndex = 0.0;
    
    i = floor( i );
    
    #define PALETTE_ENTRY(R,G,B) if(i==testIndex) return vec3(R,G,B); testIndex++

    // EGA bit
    PALETTE_ENTRY(0, 0, 0);
    PALETTE_ENTRY(0, 0, 42);
    PALETTE_ENTRY(0, 42, 0);
    PALETTE_ENTRY(0, 42, 42);
    PALETTE_ENTRY(42, 0, 0);
    PALETTE_ENTRY(42, 0, 42);
    PALETTE_ENTRY(42, 21, 0);
    PALETTE_ENTRY(42, 42, 42);
    PALETTE_ENTRY(21, 21, 21);
    PALETTE_ENTRY(21, 21, 63);
    PALETTE_ENTRY(21, 63, 21);
    PALETTE_ENTRY(21, 63, 63);
    PALETTE_ENTRY(63, 21, 21);
    PALETTE_ENTRY(63, 21, 63);
    PALETTE_ENTRY(63, 63, 21);
    PALETTE_ENTRY(63, 63, 63);
    
    // Greyscale
    PALETTE_ENTRY(0, 0, 0);
    PALETTE_ENTRY(5, 5, 5);
    PALETTE_ENTRY(8, 8, 8);
    PALETTE_ENTRY(11, 11, 11);
    PALETTE_ENTRY(14, 14, 14);
    PALETTE_ENTRY(17, 17, 17);
    PALETTE_ENTRY(20, 20, 20);
    PALETTE_ENTRY(24, 24, 24);
    PALETTE_ENTRY(28, 28, 28);
    PALETTE_ENTRY(32, 32, 32);
    PALETTE_ENTRY(36, 36, 36);
    PALETTE_ENTRY(40, 40, 40);
    PALETTE_ENTRY(45, 45, 45);
    PALETTE_ENTRY(50, 50, 50);
    PALETTE_ENTRY(56, 56, 56);
    PALETTE_ENTRY(63, 63, 63);
    
    // Rainbows
    PALETTE_ENTRY(0, 0, 63);
    PALETTE_ENTRY(16, 0, 63);
    PALETTE_ENTRY(31, 0, 63);
    PALETTE_ENTRY(47, 0, 63);
    PALETTE_ENTRY(63, 0, 63);
    PALETTE_ENTRY(63, 0, 47);
    PALETTE_ENTRY(63, 0, 31);
    PALETTE_ENTRY(63, 0, 16);
    PALETTE_ENTRY(63, 0, 0);
    PALETTE_ENTRY(63, 16, 0);
    PALETTE_ENTRY(63, 31, 0);
    PALETTE_ENTRY(63, 47, 0);
    PALETTE_ENTRY(63, 63, 0);
    PALETTE_ENTRY(47, 63, 0);
    PALETTE_ENTRY(31, 63, 0);
    PALETTE_ENTRY(16, 63, 0);
    PALETTE_ENTRY(0, 63, 0);
    PALETTE_ENTRY(0, 63, 16);
    PALETTE_ENTRY(0, 63, 31);
    PALETTE_ENTRY(0, 63, 47);
    PALETTE_ENTRY(0, 63, 63);
    PALETTE_ENTRY(0, 47, 63);
    PALETTE_ENTRY(0, 31, 63);
    PALETTE_ENTRY(0, 16, 63);
    
    PALETTE_ENTRY(31, 31, 63); 
    PALETTE_ENTRY(39, 31, 63);
    PALETTE_ENTRY(47, 31, 63);
    PALETTE_ENTRY(55, 31, 63);
    PALETTE_ENTRY(63, 31, 63);
    PALETTE_ENTRY(63, 31, 55);
    PALETTE_ENTRY(63, 31, 47);
    PALETTE_ENTRY(63, 31, 39);
    PALETTE_ENTRY(63, 31, 31);
    PALETTE_ENTRY(63, 39, 31);
    PALETTE_ENTRY(63, 47, 31);
    PALETTE_ENTRY(63, 55, 31);
    PALETTE_ENTRY(63, 63, 31);
    PALETTE_ENTRY(55, 63, 31);
    PALETTE_ENTRY(47, 63, 31);
    PALETTE_ENTRY(39, 63, 31);
    PALETTE_ENTRY(31, 63, 31);
    PALETTE_ENTRY(31, 63, 39);
    PALETTE_ENTRY(31, 63, 47);
    PALETTE_ENTRY(31, 63, 55);
    PALETTE_ENTRY(31, 63, 63);
    PALETTE_ENTRY(31, 55, 63);
    PALETTE_ENTRY(31, 47, 63);
    PALETTE_ENTRY(31, 39, 63);
    
    PALETTE_ENTRY(45, 45, 63); 
    PALETTE_ENTRY(49, 45, 63);
    PALETTE_ENTRY(54, 45, 63);
    PALETTE_ENTRY(58, 45, 63);
    PALETTE_ENTRY(63, 45, 63);
    PALETTE_ENTRY(63, 45, 58);
    PALETTE_ENTRY(63, 45, 54);
    PALETTE_ENTRY(63, 45, 49);
    PALETTE_ENTRY(63, 45, 45);
    PALETTE_ENTRY(63, 49, 45);
    PALETTE_ENTRY(63, 54, 45);
    PALETTE_ENTRY(63, 58, 45);
    PALETTE_ENTRY(63, 63, 45);
    PALETTE_ENTRY(58, 63, 45);
    PALETTE_ENTRY(54, 63, 45);
    PALETTE_ENTRY(49, 63, 45);
    PALETTE_ENTRY(45, 63, 45);
    PALETTE_ENTRY(45, 63, 49);
    PALETTE_ENTRY(45, 63, 54);
    PALETTE_ENTRY(45, 63, 58);
    PALETTE_ENTRY(45, 63, 63);
    PALETTE_ENTRY(45, 58, 63);
    PALETTE_ENTRY(45, 54, 63);
    PALETTE_ENTRY(45, 49, 63);
    
    PALETTE_ENTRY(0, 0, 28); 
    PALETTE_ENTRY(7, 0, 28);
    PALETTE_ENTRY(14, 0, 28);
    PALETTE_ENTRY(21, 0, 28);
    PALETTE_ENTRY(28, 0, 28);
    PALETTE_ENTRY(28, 0, 21);
    PALETTE_ENTRY(28, 0, 14);
    PALETTE_ENTRY(28, 0, 7);
    PALETTE_ENTRY(28, 0, 0);
    PALETTE_ENTRY(28, 7, 0);
    PALETTE_ENTRY(28, 14, 0);
    PALETTE_ENTRY(28, 21, 0);
    PALETTE_ENTRY(28, 28, 0);
    PALETTE_ENTRY(21, 28, 0);
    PALETTE_ENTRY(14, 28, 0);
    PALETTE_ENTRY(7, 28, 0);
    PALETTE_ENTRY(0, 28, 0);
    PALETTE_ENTRY(0, 28, 7);
    PALETTE_ENTRY(0, 28, 14);
    PALETTE_ENTRY(0, 28, 21);
    PALETTE_ENTRY(0, 28, 28);
    PALETTE_ENTRY(0, 21, 28);
    PALETTE_ENTRY(0, 14, 28);
    PALETTE_ENTRY(0, 7, 28);
    
    PALETTE_ENTRY(14, 14, 28);
    PALETTE_ENTRY(17, 14, 28);
    PALETTE_ENTRY(21, 14, 28);
    PALETTE_ENTRY(24, 14, 28);
    PALETTE_ENTRY(28, 14, 28);
    PALETTE_ENTRY(28, 14, 24);
    PALETTE_ENTRY(28, 14, 21);
    PALETTE_ENTRY(28, 14, 17);
    PALETTE_ENTRY(28, 14, 14);
    PALETTE_ENTRY(28, 17, 14);
    PALETTE_ENTRY(28, 21, 14);
    PALETTE_ENTRY(28, 24, 14);
    PALETTE_ENTRY(28, 28, 14);
    PALETTE_ENTRY(24, 28, 14);
    PALETTE_ENTRY(21, 28, 14);
    PALETTE_ENTRY(17, 28, 14);
    PALETTE_ENTRY(14, 28, 14);
    PALETTE_ENTRY(14, 28, 17);
    PALETTE_ENTRY(14, 28, 21);
    PALETTE_ENTRY(14, 28, 24);
    PALETTE_ENTRY(14, 28, 28);
    PALETTE_ENTRY(14, 24, 28);
    PALETTE_ENTRY(14, 21, 28);
    PALETTE_ENTRY(14, 17, 28);
        
    PALETTE_ENTRY(20, 20, 28);
    PALETTE_ENTRY(22, 20, 28);
    PALETTE_ENTRY(24, 20, 28);
    PALETTE_ENTRY(26, 20, 28);
    PALETTE_ENTRY(28, 20, 28);
    PALETTE_ENTRY(28, 20, 26);
    PALETTE_ENTRY(28, 20, 24);
    PALETTE_ENTRY(28, 20, 22);
    PALETTE_ENTRY(28, 20, 20);
    PALETTE_ENTRY(28, 22, 20);
    PALETTE_ENTRY(28, 24, 20);
    PALETTE_ENTRY(28, 26, 20);
    PALETTE_ENTRY(28, 28, 20);
    PALETTE_ENTRY(26, 28, 20);
    PALETTE_ENTRY(24, 28, 20);
    PALETTE_ENTRY(22, 28, 20);
    PALETTE_ENTRY(20, 28, 20);
    PALETTE_ENTRY(20, 28, 22);
    PALETTE_ENTRY(20, 28, 24);
    PALETTE_ENTRY(20, 28, 26);
    PALETTE_ENTRY(20, 28, 28);
    PALETTE_ENTRY(20, 26, 28);
    PALETTE_ENTRY(20, 24, 28);
    PALETTE_ENTRY(20, 22, 28);       
    
    PALETTE_ENTRY(0, 0, 16);
    PALETTE_ENTRY(4, 0, 16);
    PALETTE_ENTRY(8, 0, 16);
    PALETTE_ENTRY(12, 0, 16);
    PALETTE_ENTRY(16, 0, 16);
    PALETTE_ENTRY(16, 0, 12);
    PALETTE_ENTRY(16, 0, 8);
    PALETTE_ENTRY(16, 0, 4);
    PALETTE_ENTRY(16, 0, 0);
    PALETTE_ENTRY(16, 4, 0);
    PALETTE_ENTRY(16, 8, 0);
    PALETTE_ENTRY(16, 12, 0);
    PALETTE_ENTRY(16, 16, 0);
    PALETTE_ENTRY(12, 16, 0);
    PALETTE_ENTRY(8, 16, 0);
    PALETTE_ENTRY(4, 16, 0);
    PALETTE_ENTRY(0, 16, 0);
    PALETTE_ENTRY(0, 16, 4);
    PALETTE_ENTRY(0, 16, 8);
    PALETTE_ENTRY(0, 16, 12);
    PALETTE_ENTRY(0, 16, 16);
    PALETTE_ENTRY(0, 12, 16);
    PALETTE_ENTRY(0, 8, 16);
    PALETTE_ENTRY(0, 4, 16);
    
    PALETTE_ENTRY(8, 8, 16);
    PALETTE_ENTRY(10, 8, 16);
    PALETTE_ENTRY(12, 8, 16);
    PALETTE_ENTRY(14, 8, 16);
    PALETTE_ENTRY(16, 8, 16);
    PALETTE_ENTRY(16, 8, 14);
    PALETTE_ENTRY(16, 8, 12);
    PALETTE_ENTRY(16, 8, 10);
    PALETTE_ENTRY(16, 8, 8);
    PALETTE_ENTRY(16, 10, 8);
    PALETTE_ENTRY(16, 12, 8);
    PALETTE_ENTRY(16, 14, 8);
    PALETTE_ENTRY(16, 16, 8);
    PALETTE_ENTRY(14, 16, 8);
    PALETTE_ENTRY(12, 16, 8);
    PALETTE_ENTRY(10, 16, 8);
    PALETTE_ENTRY(8, 16, 8);
    PALETTE_ENTRY(8, 16, 10);
    PALETTE_ENTRY(8, 16, 12);
    PALETTE_ENTRY(8, 16, 14);
    PALETTE_ENTRY(8, 16, 16);
    PALETTE_ENTRY(8, 14, 16);
    PALETTE_ENTRY(8, 12, 16);
    PALETTE_ENTRY(8, 10, 16);
    
    PALETTE_ENTRY(11, 11, 16);
    PALETTE_ENTRY(12, 11, 16);
    PALETTE_ENTRY(13, 11, 16);
    PALETTE_ENTRY(15, 11, 16);
    PALETTE_ENTRY(16, 11, 16);
    PALETTE_ENTRY(16, 11, 15);
    PALETTE_ENTRY(16, 11, 13);
    PALETTE_ENTRY(16, 11, 12);
    PALETTE_ENTRY(16, 11, 11);
    PALETTE_ENTRY(16, 12, 11);
    PALETTE_ENTRY(16, 13, 11);
    PALETTE_ENTRY(16, 15, 11);
    PALETTE_ENTRY(16, 16, 11);
    PALETTE_ENTRY(15, 16, 11);
    PALETTE_ENTRY(13, 16, 11);
    PALETTE_ENTRY(12, 16, 11);
    PALETTE_ENTRY(11, 16, 11);
    PALETTE_ENTRY(11, 16, 12);
    PALETTE_ENTRY(11, 16, 13);
    PALETTE_ENTRY(11, 16, 15);
    PALETTE_ENTRY(11, 16, 16);
    PALETTE_ENTRY(11, 15, 16);
    PALETTE_ENTRY(11, 13, 16);
    PALETTE_ENTRY(11, 12, 16);
    
    PALETTE_ENTRY(0, 0, 0);
    PALETTE_ENTRY(0, 0, 0);
    PALETTE_ENTRY(0, 0, 0);
    PALETTE_ENTRY(0, 0, 0);
    PALETTE_ENTRY(0, 0, 0);
    PALETTE_ENTRY(0, 0, 0);
    PALETTE_ENTRY(0, 0, 0);
    PALETTE_ENTRY(0, 0, 0);

    return vec3(0);
}
*/
`;

export default class implements iSub {
  key(): string {
    return '4lG3Wz';
  }
  name(): string {
    return 'VGA Mandelbrot';
  }
  sort() {
    return 487;
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
}
