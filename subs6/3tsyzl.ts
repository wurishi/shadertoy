import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// disable TRAPs to see just the set
#define TRAPS

// disable CUT to see the whole set
#define CUT

const int   kNumIte = 200;
const float kPrecis = 0.00025;
const vec4  kC = vec4(-2,6,15,-6)/22.0;
const float kFocLen = 3.0;
#ifdef TRAPS
const float kBSRad = 2.0;
#else
const float kBSRad = 1.2;
#endif
#define     kNumBounces 3

// --------------------------------------
// oldschool rand() from Visual Studio
// --------------------------------------
int   seed = 1;
void  srand(int s ) { seed = s; }
int   rand(void) { seed=seed*0x343fd+0x269ec3; return (seed>>16)&32767; }
float frand(void) { return float(rand())/32767.0; }
// --------------------------------------
// hash to initialize the random seed (copied from Hugo Elias)
// --------------------------------------
int hash( int n ) { n=(n<<13)^n; return n*(n*n*15731+789221)+1376312589; }
//--------------------------------------------------------------------------------
// http://amietia.com/lambertnotangent.html
//--------------------------------------------------------------------------------
vec3 cosineDirection( in vec3 nor)
{
    float u = frand()*2.0-1.0;
    float a = frand()*6.28318531;
    return normalize(nor+vec3(sqrt(1.0-u*u)*vec2(cos(a),sin(a)), u) );
}
//--------------------------------------------------------------------------------
// quaternion manipulation
//--------------------------------------------------------------------------------
vec4 qSquare( in vec4 q )
{
    return vec4(q.x*q.x - q.y*q.y - q.z*q.z - q.w*q.w, 2.0*q.x*q.yzw);
}
vec4 qCube( in vec4 q )
{
    vec4  q2 = q*q;
    return vec4(q.x  *(    q2.x - 3.0*q2.y - 3.0*q2.z - 3.0*q2.w), 
                q.yzw*(3.0*q2.x -     q2.y -     q2.z -     q2.w));
}
float qLength2( in vec4 q ) { return dot(q,q); }
//--------------------------------------------------------------------------------
// ray-sphere intersection
// http://iquilezles.org/www/articles/intersectors/intersectors.htm
//--------------------------------------------------------------------------------
vec2 iSphere( in vec3 ro, in vec3 rd, in float rad )
{
	float b = dot( ro, rd );
	float c = dot( ro, ro ) - rad*rad;
	float h = b*b - c;
	if( h<0.0 ) return vec2(-1.0);
    h = sqrt(h);
	return vec2(-b-h, -b+h );
}
//--------------------------------------------------------------------------------
// build camera rotation matrix
//--------------------------------------------------------------------------------
mat3 setCamera( in vec3 ro, in vec3 ta, float cr )
{
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(sin(cr), cos(cr),0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}
//--------------------------------------------------------------------------------
// SDF of the Julia set z³+c
// https://iquilezles.org/www/articles/distancefractals/distancefractals.htm
//--------------------------------------------------------------------------------
vec2 map( in vec3 p )
{
    vec4 z = vec4( p, 0.0 );
    float dz2 = 1.0;
	float m2  = 0.0;
    float n   = 0.0;
    #ifdef TRAPS
    float o   = 1e10;
    #endif
    
    for( int i=0; i<kNumIte; i++ ) 
	{
        // z' = 3z² -> |z'|² = 9|z²|²
		dz2 *= 9.0*qLength2(qSquare(z));
        
        // z = z³ + c		
		z = qCube( z ) + kC;
        
        // stop under divergence		
        m2 = qLength2(z);		

        // orbit trapping : https://iquilezles.org/www/articles/orbittraps3d/orbittraps3d.htm
        #ifdef TRAPS
        o = min( o, length(z.xz-vec2(0.45,0.55))-0.1 );
        #endif
        
        // exit condition
        if( m2>256.0 ) break;				 
		n += 1.0;
	}
   
	// sdf(z) = log|z|·|z|/|dz| : https://iquilezles.org/www/articles/distancefractals/distancefractals.htm
	float d = 0.25*log(m2)*sqrt(m2/dz2);
    
    #ifdef TRAPS
    d = min(o,d);
    #endif
    #ifdef CUT
    d = max(d, p.y);
    #endif
    
	return vec2(d,n);        
}

//--------------------------------------------------------------------------------
// Compute Normal to SDF
//--------------------------------------------------------------------------------

#if 1
// https://iquilezles.org/www/articles/normalsSDF/normalsSDF.htm
vec3 calcNormal( in vec3 pos )
{
    const vec2 e = vec2(1.0,-1.0)*0.5773*kPrecis;
    return normalize( e.xyy*map( pos + e.xyy ).x + 
					  e.yyx*map( pos + e.yyx ).x + 
					  e.yxy*map( pos + e.yxy ).x + 
					  e.xxx*map( pos + e.xxx ).x );
}
#else
// https://iquilezles.org/www/articles/juliasets3d/juliasets3d.htm
vec3 calcNormal( in vec3 p )
{
    #ifdef TRAPS
    the code below only works for the actual Julia set, not the traps
    #endif
        
    vec4 z = vec4(p,0.0);

    // identity derivative
    mat4x4 J = mat4x4(1,0,0,0,  
                      0,1,0,0,  
                      0,0,1,0,  
                      0,0,0,1 );

  	for(int i=0; i<kNumIte; i++)
    {
        // f(q) = q³ + c = 
        //   x =  x²x - 3y²x - 3z²x - 3w²x + c.x
        //   y = 3x²y -  y²y -  z²y -  w²y + c.y
        //   z = 3x²z -  y²z -  z²z -  w²z + c.z
        //   w = 3x²w -  y²w -  z²w -  w²w + c.w
		//
        // Jacobian, J(f(q)) =
        //   3(x²-y²-z²-w²)  6xy            6xz            6xw
        //    -6xy           3x²-3y²-z²-w² -2yz           -2yw
        //    -6xz          -2yz            3x2-y²-3z²-w² -2zw
        //    -6xw          -2yw           -2zw            3x²-y²-z²-3w²
        
        float k1 = 6.0*z.x*z.y, k2 = 6.0*z.x*z.z;
        float k3 = 6.0*z.x*z.w, k4 = 2.0*z.y*z.z;
        float k5 = 2.0*z.y*z.w, k6 = 2.0*z.z*z.w;
        float sx = z.x*z.x, sy = z.y*z.y;
        float sz = z.z*z.z, sw = z.w*z.w;
        float mx = 3.0*sx-3.0*sy-3.0*sz-3.0*sw;
        float my = 3.0*sx-3.0*sy-    sz-    sw;
        float mz = 3.0*sx-    sy-3.0*sz-    sw;
        float mw = 3.0*sx-    sy-    sz-3.0*sw;
        
        // chain rule of jacobians
        J = J*mat4x4( mx, -k1, -k2, -k3,
                      k1,  my, -k4, -k5,
                      k2, -k4,  mz, -k6,
                      k3, -k5, -k6,  mw );
        // q = q³ + c
        z = qCube(z) + kC; 
        
        // exit condition
        if(dot2(z)>256.0) break;
    }

    return (p.y>0.0 ) ? vec3(0.0,1.0,0.0) : normalize( (J*z).xyz );
}
#endif

//--------------------------------------------------------------------------------
// ray-scene intersection
//--------------------------------------------------------------------------------
vec2 raycast( in vec3 ro, in vec3 rd )
{
    float tmax = 7.0;
	float tmin = kPrecis;    

    // intersect clipping plane
    #ifdef CUT
    const float kSplit = 0.01;
    float tpS = (kSplit-ro.y)/rd.y;
    if( tpS>0.0 )
    {
        if( ro.y>kSplit ) tmin = max(tmin,tpS);
        else              tmax = min(tmax,tpS);
    }
	#endif
    
    // intersect lower clipping plane
    #if 1
    {
    float tpF = (-0.8-ro.y)/rd.y;
    if( tpF>0.0 ) tmax = min(tmax,tpF);
    }
    #endif

    // intersect bounding sphere
    #if 1
    vec2 bv = iSphere( ro, rd, kBSRad );
    if( bv.y<0.0 ) return vec2(-2.0,0.0);
    tmin = max(tmin,bv.x);
    tmax = min(tmax,bv.y);
	#endif
    
    // raymarch
    vec2  res = vec2(-1.0);
    float t = tmin;
	float lt = 0.0;
	float lh = 0.0;
    for(int i=0; i<1024; i++ )
    {
        res = map(ro+rd*t);
        if( res.x<kPrecis ) break;
		lt = t;
		lh = res.x;
        #ifndef TRAPS
        t += min(res.x,0.2);
        #else
        t += min(res.x,0.01)*(0.5+0.5*frand());
        #endif
        if( t>tmax ) break;
    }
    // linear interpolation for better isosurface
	if( lt>0.0001 && res.x<0.0 ) t = lt - lh*(t-lt)/(res.x-lh);
	
    res.x = (t<tmax)?t:-1.0;

    return res;
}

//--------------------------------------------------------------------------------
// color of the surface
//--------------------------------------------------------------------------------
vec3 colorSurface( in vec3 pos, in vec3 nor, in vec2 tn )
{
    vec3 col = 0.5+0.5*cos(log2(tn.y)*0.9+3.5+vec3(0.0,0.6,1.0));
    if( pos.y>0.0 ) col = mix(col,vec3(1.0),0.2);
    float inside = smoothstep(14.0,15.0,tn.y);
    col *= vec3(0.45,0.42,0.40) + vec3(0.55,0.58,0.60)*inside;
    col = mix(col*col*(3.0-2.0*col),col,inside);
    col = mix( mix(col,vec3(dot(col,vec3(0.3333))),-0.4),
                        col, inside);
    return clamp(col*0.65,0.0,1.0);
}

//--------------------------------------------------------------------------------
// Render the scene through super simplified path-tracing
//--------------------------------------------------------------------------------
vec3 render( in  vec2 fragCoord, in vec3 ro, in vec3 rd,
             out vec3 resPos, out float resT)
{
    vec3 colorMask = vec3(1.0);
 	resT = 1e20;
    
    // path-tracing
    for( int bounce=0; bounce<kNumBounces; bounce++ )
    {
        vec2 tn = raycast( ro, rd );
        float t = tn.x;
        if( t < 0.0 )
        {
            return (bounce>0) ? colorMask*1.65*step(0.0,rd.y) 
                              : vec3(clamp(0.02+0.021*rd.y,0.0,1.0));
        }
        else
        {
            vec3 pos = ro + t*rd;
            vec3 nor = calcNormal( pos );

            if( bounce==0 ) { resT = t; resPos = pos; }

			colorMask *= colorSurface( pos, nor, tn );
            rd = cosineDirection(nor);
        	ro = pos+nor*kPrecis;
        }
   }
   
   return vec3(0.0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //-----------------------------------------------
	// init random seed
    //-----------------------------------------------
    ivec2 q = ivec2(fragCoord);
    srand( hash(q.x+hash(q.y+hash(1117*iFrame))));
    
    //-----------------------------------------------
    // camera
    //-----------------------------------------------
    float an = 0.5+iTime*0.03;
    vec3  ro = 2.0*vec3(sin(an),0.8,cos(an));
    #ifdef CUT
    vec3  ta = vec3( 0.0, -0.3, 0.0 );
    #else
    vec3  ta = vec3( 0.0, -0.1, 0.0 );
	#endif
    mat3x3 cam = setCamera(ro,ta,0.0);
    
    //-----------------------------------------------
    // ray direction
    //-----------------------------------------------
    vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    vec3 rd = normalize( cam*vec3(p.xy,kFocLen) );
    
    //-----------------------------------------------
    // render fractal
    //-----------------------------------------------
    vec3 pos; float resT;
    vec3 col = render(fragCoord,ro,rd,pos,resT);

    //-----------------------------------------------
	// reproject to previous frame and pull history
    //-----------------------------------------------

    // fetch previous camera matrix from the bottom left three pixels
    mat3x4 oldCam = mat3x4( texelFetch(iChannel0,ivec2(0,0), 0),
                            texelFetch(iChannel0,ivec2(1,0), 0),
                            texelFetch(iChannel0,ivec2(2,0), 0) );
    // world space point
    vec4 wpos = vec4(pos,1.0);
    // convert to camera space (note inverse multiply)
    vec3 cpos = wpos*oldCam;
    // convert to NDC space (project)
    vec2 npos = kFocLen*cpos.xy/cpos.z;
    // convert to screen space
    vec2 spos = 0.5 + 0.5*npos*vec2(iResolution.y/iResolution.x,1.0);
	// convert to raster space
    vec2 rpos = spos * iResolution.xy;

    // read color+depth from this point's previous screen location
    vec4 ocolt = textureLod( iChannel0, spos, 0.0 );
    // if we consider the data contains the history for this point
    if( iFrame>0 && resT<100.0 && (rpos.y>1.5||rpos.x>3.5) )
    {
        // blend with history (it's a IIR low pas filter really)
        col = mix( ocolt.xyz, col, 0.06 );
    }
    // output
	if( q.y==0 && q.x<3 )
    {
    	// camera matrix in lower left three pixels, for next frame
             if( q.x==0 ) fragColor = vec4( cam[0], -dot(cam[0],ro) );
        else if( q.x==1 ) fragColor = vec4( cam[1], -dot(cam[1],ro) );
        else              fragColor = vec4( cam[2], -dot(cam[2],ro) );
    }
    else
    {
        // color and depth
        fragColor = vec4( col, resT );
    }
}`;

const fragment = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = fragCoord / iResolution.xy;

    vec3 col = texture( iChannel0, p ).xyz;

    // color grade
    col = col*2.0/(1.0+col);
    col = pow( col, vec3(0.4545) );
    col = pow(col,vec3(0.85,0.97,1.0));
    col = col*0.5 + 0.5*col*col*(3.0-2.0*col);

    // vignette
    col *= 0.5 + 0.5*pow( 16.0*p.x*p.y*(1.0-p.x)*(1.0-p.y), 0.1 );
    
    fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return '3tsyzl';
  }
  name(): string {
    return 'Julia - Quaternion 3';
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
      { type: 1, f: buffA, fi: 0 }, //
    ];
  }
}
