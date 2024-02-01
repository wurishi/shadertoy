import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define AA 1

float sdSegment( vec2 p, vec2 a, vec2 b )
{
	vec2 pa = p-a, ba = b-a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return length( pa - ba*h );
}

float sdDisk( vec2 p, vec2 a, float r )
{
	return length(p-a)-r;
}

int mod3( int n )
{
    return (n<0) ? 2-((2-n)%3) : n%3;
    
    // Other methods of computing mod3:           // PC-WebGL  Native-OpenGL  Android WebGL
    //
    // 1.  return (n<0) ? 2-((2-n)%3) : n%3;      //    Ok        Ok            Ok 
    // 2.  return int((uint(n)+0x80000001U)%3u);  //    Ok        Ok            Broken
    // 3.  n %= 3; return (n<0)?n+3:n;            //    Ok        Broken        Ok
    // 4.  n %= 3; n+=((n>>31)&3); return n;      //    Ok        Broken        Ok
    // 5.  return ((n%3)+3)%3;                    //    Ok        Broken        Ok
    // 6.  return int[](1,2,0,1,2)[n%3+2];        //    Ok        Broken        Ok
}

//=============================================================

// return the hexagon that p belongs to
ivec2 hexagonGetID( in vec2 p ) 
{
	vec2  q = vec2( p.x, p.x*0.5+p.y*0.8660254037 );

    ivec2 i = ivec2(floor(q));
	vec2  f =       fract(q);
    
	int v = mod3(i.x+i.y);
    ivec2 id = i + v;
    if( v==2 ) id -= (f.x>f.y)?ivec2(1,2):ivec2(2,1);
    
    return ivec2( id.x, (2*id.y-id.x)/3 );
}

// return the center of an hexagon
vec2 hexagonCenFromID( in ivec2 id )
{
    return vec2(float(id.x),float(id.y)*1.732050807);
}

//=============================================================

vec3 render( in vec2 pos, in float px )
{
	const float kPtRa = 0.1;

    // scale image
    pos *= 8.0;
    px  *= 8.0;

    // ray
    vec2 ro = vec2(9.0,2.0)*cos(0.11*iTime+vec2(0.0,1.0));
    vec2 rd = normalize(cos(0.1*iTime*vec2(1.3,1.1)+vec2(3.0,2.0)-1.0));

    // draw barckground
    ivec2 oid = hexagonGetID(pos);
    vec3  col = vec3(0.3+0.2*sin(float(15*oid.x)+cos(float(33*oid.y))));

    // draw ray
    float d = sdSegment( pos, ro, ro+rd*30.0 );
    col = mix(col,vec3(1,1,0),1.0-smoothstep(-px*0.5,px*0.5,d-kPtRa*0.3));

    // prepare for hex-traverse
    const vec2 n1 = vec2( 1.0,0.0);
    const vec2 n2 = vec2( 0.5,0.866025);
    const vec2 n3 = vec2(-0.5,0.866025);
    ivec2 i1 = ivec2( 2,0);
    ivec2 i2 = ivec2( 1,1);
    ivec2 i3 = ivec2(-1,1);
    float d1 = 1.0/dot(rd,n1);
    float d2 = 1.0/dot(rd,n2);
    float d3 = 1.0/dot(rd,n3);
    float s1 = 1.0; if(d1<0.0) {s1=-1.0;i1=-i1;} s1=(s1-dot(ro,n1))*d1;
    float s2 = 1.0; if(d2<0.0) {s2=-1.0;i2=-i2;} s2=(s2-dot(ro,n2))*d2;
    float s3 = 1.0; if(d3<0.0) {s3=-1.0;i3=-i3;} s3=(s3-dot(ro,n3))*d3;

    // hex-traverse
    ivec2 hid = hexagonGetID(ro);
    float hdi = 0.0;
    for( int i=0; i<32; i++ )
    {
        //-----------------------
        // render current hexagon
        //-----------------------
        if( hid==oid ) col = mix(col,vec3(1.0,0.0,0.0),0.3);
        col = mix(col,vec3(1,0,0),1.0-smoothstep(-px*0.5,px*0.5,sdDisk(pos,hexagonCenFromID(hid),kPtRa)));
        col = mix(col,vec3(1,1,0),1.0-smoothstep(-px*0.5,px*0.5,sdDisk(pos,ro+rd*hdi,kPtRa)));

        //------------------
        // find next hexagon
        //------------------
        float t1 = s1+(                 float(hid.x)    )*d1;
        float t2 = s2+(float(hid.y)*1.5+float(hid.x)*0.5)*d2;
        float t3 = s3+(float(hid.y)*1.5-float(hid.x)*0.5)*d3;
        
             if( t1<t2 && t1<t3 ) { hid += i1; hdi=t1; }
        else if( t2<t3          ) { hid += i2; hdi=t2; }
        else                      { hid += i3; hdi=t3; }
    }

    return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) 
{
    vec3 tot = vec3(0.0);
    
    #if AA>1
    for( int mm=0; mm<AA; mm++ )
    for( int nn=0; nn<AA; nn++ )
    {
        vec2 off = vec2(mm,nn)/float(AA);
        vec2 uv = (fragCoord+off)/iResolution.xy;
        vec2 pos = (2.0*(fragCoord+off)-iResolution.xy)/iResolution.y;
    #else    
    {
        vec2 uv = fragCoord/iResolution.xy;
        vec2 pos = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    #endif
		float px = 2.0/iResolution.y;
        
		vec3 col = render(pos,px);
        
        tot += col;
	}	
 	#if AA>1
    tot /= float(AA*AA);
    #endif
        
	fragColor = vec4( tot, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'WtSBWK';
  }
  name(): string {
    return 'Hexagonal Grid Traversal - 2D';
  }
  sort() {
    return 183;
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
