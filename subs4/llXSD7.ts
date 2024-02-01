import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
/*
The MIT License (MIT)

Copyright (c) 2015 Huw Bowles & Daniel Zimmermann

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/

// Example to illustrate volume sampling research undertaken right here on
// shadertoy and published at siggraph 2015:
//
// Talk: "A Novel Sampling Algorithm for Fast and Stable Real-Time Volume Rendering"
// Ppt: http://advances.realtimerendering.com/s2015/siggraph15_volsampling.pptx
// Course page: http://advances.realtimerendering.com/s2015/index.html
//


// for graph
#define RANGEY 6.0
#define RANGEX (RANGEY*iResolution.x/iResolution.y)
#define THICK  0.05

// simple macros to pull mouse position in [0,1]
#define MOUSEX	iMouse.x/iResolution.x
#define MOUSEY	iMouse.y/iResolution.y

#define CAMX (RANGEX*(MOUSEX-.5)*2.5)

#define SAMPLE_COUNT 32
#define PARAMETRIC_STEPS 32

#define EPS 0.001

//#define VIS_SAMPLE_LEVELS

float pdf_max( float xstart, float xend )
{
    xstart = max( xstart, 0. );
    return 5./(1.+xstart*1.5);
}

// the density line plot
bool fn1( float x, out float y, out vec4 col )
{
	col = vec4(1.,0.,0.,1.);
	y = pdf_max( x, x );
	return true;
}

// visualise two tree levels
float inten = .4;
float visy0 = .5;
bool fn2( float x, out float y, out vec4 col )
{
    return false;
    //y = pow( 2., 1.+floor(log2(MOUSEY*RANGEY)) );
    y = MOUSEY*RANGEY;
	col = vec4(inten);
	return true;
}


vec4 drawSample( vec2 px, vec2 pt, vec4 col )
{
    float pw = .2;
    float r = length(pt-px);
    
    float border = smoothstep( pw*.65, pw*.7, r );
    col.rgb = mix(col.rgb, vec3(99.,37.,35.)/255., border);
    
    float alpha = smoothstep( pw, pw*.85, r );
    //alpha *= border;
    alpha *= col.a;
    return vec4( col.rgb, alpha );
}

float dens_max( float x, float dx )
{
    return pdf_max(x,x+dx);
}

float mov_mod( float x, float y)
{
    return mod( x - iTime/4., y );
}

bool onBoundary( float x, float dx )
{
    // the +0.25 solves numerical issues without changing the result
	return mov_mod( x + dx*0.25, dx ) < dx*0.5;
}

// this parametric function places a white dot at each sample
bool pfn1( float t, out float x, out float y, out vec4 col, out float mint, out float maxt )
{
	col = vec4(192.,80.,77.,255.)/255.;
	mint = 0.;
	maxt = 1.;
	int thisPt = int(floor(t*float(SAMPLE_COUNT)));
    
    // new variables from adaptive sampling
    
    // setup sampling
	x = 0.;
    float dx = exp2(floor(log2(1./dens_max(x,0.))));
    x -= mov_mod(x,2.*dx);
    float wt = 1.;
    bool even = true;
    
	for( int i = 0; i < SAMPLE_COUNT; i++ )
	{
		if( i == thisPt && x >= 0.)
		{
			break;
		}
        
        // sample at x, give weight wt
        if( even )
        {
			float densx = dens_max( x, dx * 2.0 );
			if( densx > 1.0 / dx )
            {
                // higher sampling rate
                dx /= 2.0;
                densx = dens_max( x, dx * 2.0 );
                
                // need enough of these to get to desired density, if not can get
                // pops
                if( densx > 1.0 / dx ) { dx /= 2.0; densx = dens_max( x, dx * 2.0 ); }
                if( densx > 1.0 / dx ) { dx /= 2.0; densx = dens_max( x, dx * 2.0 ); }
                if( densx > 1.0 / dx ) { dx /= 2.0; densx = dens_max( x, dx * 2.0 ); }
            }
            else
            {
                float nextDx, nextDens; bool nextEven;
                
                nextDx = 2.*dx;
                nextDens = dens_max( x, nextDx*2. );
                nextEven = onBoundary( x, nextDx*2. );
                if( nextDens < 0.5 / dx && nextEven )
                {
                    // lower sampling rate
					dx = nextDx;
					// commit to this density
					densx = nextDens;
                }
                
                // can repeat the above block to step down sampling rates faster
            }
            
			//wt = saturate( 2.0 * (densx / (1.0 / dx) - 0.5) );
			wt = clamp( 1.0*(2.0 * densx * dx - 1.0), 0., 1. );
        }
        
        x += dx;
	    even = !even;
	}
    
    wt = even ? (2.-wt) : wt;
    
    col.a *= clamp(wt,0.,1.);
    
    y = pdf_max(x,x);// even ? pdf_max(x,x) : max( pdf_max(x,x), 1./(2.*dx));
    
	return true;
}


vec4 graph( vec2 p, float xmin, float xmax, float ymin, float ymax, float width );

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;

    // uv minx maxx miny maxy thickness
	fragColor = graph( uv, 0., RANGEX, 0., RANGEY, THICK );

	return;
}


float drawNumber( float num, vec2 pos, vec2 pixel_coords );

float boundary(float coord, float spacing)
{
    float r = abs(mov_mod(coord+spacing/2.,spacing)-spacing/2.);
    return smoothstep(7.5/iResolution.y,0.,r);
    //return  < 10./iResolution.x ? 1. : 0.;
}

vec3 graph_bg(vec2 thisPt)
{
    float lowcoord = exp2(floor(log2(1./thisPt.y)));
    float i = 1.-boundary(thisPt.x,lowcoord);
    i = mix( 0.2,1.,i);
    return vec3(i);
}

// p is in [0,1]. 
vec4 graph( vec2 p, float xmin, float xmax, float ymin, float ymax, float width )
{
	vec4 result = vec4(1.);
	
	float thisx = xmin + (xmax-xmin)*p.x;
	float thisy = ymin + (ymax-ymin)*p.y;
	
    result.rgb = graph_bg(vec2(thisx,thisy));
    
	// compute gradient between this pixel and next (seems reasonable)
	float eps = dFdx(thisx);

	float alpha;
	
	//vec4 axisCol = vec4(vec3(.3),1.);
	
	// axes
	// x
	//alpha = abs( thisy - 0. ); alpha = smoothstep( width, width/4., alpha );
	//result = (1.-alpha)*result + alpha*axisCol;
	// y
	//alpha = abs( thisx - 0. ); alpha = smoothstep( width, width/4., alpha );
	//result = (1.-alpha)*result + alpha*axisCol;
	
	// uses iq's awesome distance to implicit http://www.iquilezles.org/www/articles/distance/distance.htm
	float f;
	vec4 fcol;
	if( fn1( thisx, f, fcol ) )
	{
		float f_1; fn1( thisx + eps, f_1, fcol ); float f_prime = (f_1 - f) / eps;
		alpha = abs(thisy - f)/sqrt(1.+f_prime*f_prime); alpha = smoothstep( width, width/4., alpha ); alpha *= fcol.a;
		result = (1.-alpha)*result + alpha*fcol;
	}
	if( fn2( thisx, f, fcol ) )
	{
		float f_1; fn2( thisx + eps, f_1, fcol ); float f_prime = (f_1 - f) / eps;
		alpha = abs(thisy - f)/sqrt(1.+f_prime*f_prime); alpha = smoothstep( width, width/4., alpha ); alpha *= fcol.a;
		result = (1.-alpha)*result + alpha*fcol;
	}
	// parametric curves. todo - join the dots!
	float x, mint, maxt;
	if( pfn1( 0., x, f, fcol, mint, maxt ) )
	{
		float dt = (maxt-mint)/float(PARAMETRIC_STEPS);
		float t = mint;
		for( int i = 0; i <= PARAMETRIC_STEPS; i++ )
		{
			pfn1( t, x, f, fcol, mint, maxt );
			vec4 samp = drawSample( vec2(thisx,thisy), vec2(x,f), fcol );
			result = (1.-samp.a)*result + samp.a*samp;
			t += dt;
		}
	}
	
	//result += vec4(drawNumber(xmin, vec2(0.,0.)+vec2(1.)/iResolution.xy, p ));
	//result += vec4(drawNumber(xmax, vec2(1.,0.)+vec2(-26.,1.)/iResolution.xy, p ));
	//result += vec4(drawNumber(ymax, vec2(0.,1.)+vec2(1.,-7.)/iResolution.xy, p ));
	//result += vec4(drawNumber(ymin, vec2(0.,0.)+vec2(1.,10.)/iResolution.xy, p ));
	
	return result;
}

// digits based on the nice ascii shader by movAX13h

float drawDig( vec2 pos, vec2 pixel_coords, float bitfield )
{
	// offset relative to 
	vec2 ic = pixel_coords - pos ;
	ic = floor(ic*iResolution.xy);
	// test if overlap letter
	if( clamp(ic.x, 0., 2.) == ic.x && clamp(ic.y, 0., 4.) == ic.y )
	{
		// compute 1d bitindex from 2d pos
		float bitIndex = ic.y*3.+ic.x;
		// isolate the bit
		return floor( mod( bitfield / exp2( floor(bitIndex) ), 2. ) );
	}
	return 0.;
}
// decimal point
float drawDecPt( vec2 center, vec2 pixel_coords )
{
	return drawDig( center, pixel_coords, 1. );
}
// minus sign
float drawMinus( vec2 center, vec2 pixel_coords )
{
	return drawDig( center, pixel_coords, 448. );
}
// digits 0 to 9
float drawDigit( float dig, vec2 pos, vec2 pixel_coords )
{
	if( dig == 1. )
		return drawDig( pos, pixel_coords, 18724. );
	if( dig == 2. )
		return drawDig( pos, pixel_coords, 31183. );
	if( dig == 3. )
		return drawDig( pos, pixel_coords, 31207. );
	if( dig == 4. )
		return drawDig( pos, pixel_coords, 23524. );
	if( dig == 5. )
		return drawDig( pos, pixel_coords, 29671. );
	if( dig == 6. )
		return drawDig( pos, pixel_coords, 29679. );
	if( dig == 7. )
		return drawDig( pos, pixel_coords, 31012. );
	if( dig == 8. )
		return drawDig( pos, pixel_coords, 31727. );
	if( dig == 9. )
		return drawDig( pos, pixel_coords, 31719. );
	// 0
	return drawDig( pos, pixel_coords, 31599. );
}

// max num width is 26px (minus, 3 nums, dec pt, 2 nums)
// max height is 6px
float drawNumber( float num, vec2 pos, vec2 pixel_coords )
{
	float result = 0.;
	bool on = false;
	float d;
	
	// minus sign
	if( num < 0. )
	{
		result += drawMinus( pos, pixel_coords );
		pos.x += 4. / iResolution.x;
		num = -num;
	}
	// hundreds
	d = floor(mod(num/100.,10.));
	if( on || d > 0. )
	{
		result += drawDigit( d, pos, pixel_coords );
		pos.x += 4. / iResolution.x;
		on = true;
	}
	// tens
	d = floor(mod(num/10.,10.));
	if( on || d > 0. )
	{
		result += drawDigit( d, pos, pixel_coords );
		pos.x += 4. / iResolution.x;
		on = true;
	}
	// ones
	d = floor(mod(num,10.));
	result += drawDigit( d, pos, pixel_coords );
	pos.x += 4. / iResolution.x;
	// dec pt
	result += drawDecPt( pos, pixel_coords );
	pos.x += 2. / iResolution.x;
	// tenths
	d = floor(mod(num/.1,10.));
	if( true )
	{
		result += drawDigit( d, pos, pixel_coords );
		pos.x += 4. / iResolution.x;
	}
	// hundredths
	d = floor(.5+mod(num/.01,10.));
	if( d > 0. )
	{
		result += drawDigit( d, pos, pixel_coords );
		pos.x += 4. / iResolution.x;
	}
	
	return clamp(result,0.,1.);
}

vec3 hsv2rgb(vec3 c);
vec3 rgb2hsv(vec3 c);

vec3 errorColour( float err, float maxerror )
{
	err = 1. - err / maxerror;
	err *= 2. / 3.;
	return hsv2rgb( vec3(err, 1., 1.) );
}

//http://lolengine.net/blog/2013/07/27/rgb-to-hsv-in-glsl

vec3 rgb2hsv(vec3 c)
{
    vec4 K = vec4(0.0, -1.0 / 3.0, 2.0 / 3.0, -1.0);
    vec4 p = mix(vec4(c.bg, K.wz), vec4(c.gb, K.xy), step(c.b, c.g));
    vec4 q = mix(vec4(p.xyw, c.r), vec4(c.r, p.yzx), step(p.x, c.r));

    float d = q.x - min(q.w, q.y);
    float e = 1.0e-10;
    return vec3(abs(q.z + (q.w - q.y) / (6.0 * d + e)), d / (q.x + e), q.x);
}

vec3 hsv2rgb(vec3 c)
{
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}
`;

export default class implements iSub {
  key(): string {
    return 'llXSD7';
  }
  name(): string {
    return 'Adaptive Sampling Diagram';
  }
  sort() {
    return 434;
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
