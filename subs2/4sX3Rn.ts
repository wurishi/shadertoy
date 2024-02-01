import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define HW_PERFORMANCE 1

#if HW_PERFORMANCE==0
#define AA 1
#else
#define AA 2  // Set AA to 1 if your machine is too slow
#endif


float maxcomp(in vec3 p ) { return max(p.x,max(p.y,p.z));}
float sdBox( vec3 p, vec3 b )
{
  vec3  di = abs(p) - b;
  float mc = maxcomp(di);
  return min(mc,length(max(di,0.0)));
}

const mat3 ma = mat3( 0.60, 0.00,  0.80,
                      0.00, 1.00,  0.00,
                     -0.80, 0.00,  0.60 );

vec4 map( in vec3 p )
{
    float d = sdBox(p,vec3(1.0));
    vec4 res = vec4( d, 1.0, 0.0, 0.0 );

    float ani = smoothstep( -0.2, 0.2, -cos(0.5*iTime) );
	float off = 1.5*sin( 0.01*iTime );
	
    float s = 1.0;
    for( int m=0; m<4; m++ )
    {
        p = mix( p, ma*(p+off), ani );
	   
        vec3 a = mod( p*s, 2.0 )-1.0;
        s *= 3.0;
        vec3 r = abs(1.0 - 3.0*abs(a));
        float da = max(r.x,r.y);
        float db = max(r.y,r.z);
        float dc = max(r.z,r.x);
        float c = (min(da,min(db,dc))-1.0)/s;

        if( c>d )
        {
          d = c;
          res = vec4( d, min(res.y,0.2*da*db*dc), (1.0+float(m))/4.0, 0.0 );
        }
    }

    return res;
}

vec4 intersect( in vec3 ro, in vec3 rd )
{
    float t = 0.0;
    vec4 res = vec4(-1.0);
	vec4 h = vec4(1.0);
    for( int i=0; i<64; i++ )
    {
		if( h.x<0.002 || t>10.0 ) break;
        h = map(ro + rd*t);
        res = vec4(t,h.yzw);
        t += h.x;
    }
	if( t>10.0 ) res=vec4(-1.0);
    return res;
}

float softshadow( in vec3 ro, in vec3 rd, float mint, float k )
{
    float res = 1.0;
    float t = mint;
	float h = 1.0;
    for( int i=0; i<32; i++ )
    {
        h = map(ro + rd*t).x;
        res = min( res, k*h/t );
		t += clamp( h, 0.005, 0.1 );
    }
    return clamp(res,0.0,1.0);
}

vec3 calcNormal(in vec3 pos)
{
    vec3  eps = vec3(.001,0.0,0.0);
    vec3 nor;
    nor.x = map(pos+eps.xyy).x - map(pos-eps.xyy).x;
    nor.y = map(pos+eps.yxy).x - map(pos-eps.yxy).x;
    nor.z = map(pos+eps.yyx).x - map(pos-eps.yyx).x;
    return normalize(nor);
}

// light
vec3 light = normalize(vec3(1.0,0.9,0.3));

vec3 render( in vec3 ro, in vec3 rd )
{
    // background color
    vec3 col = mix( vec3(0.3,0.2,0.1)*0.5, vec3(0.7, 0.9, 1.0), 0.5 + 0.5*rd.y );
	
    vec4 tmat = intersect(ro,rd);
    if( tmat.x>0.0 )
    {
        vec3  pos = ro + tmat.x*rd;
        vec3  nor = calcNormal(pos);
		
        float occ = tmat.y;
		float sha = softshadow( pos, light, 0.01, 64.0 );

		float dif = max(0.1 + 0.9*dot(nor,light),0.0);
		float sky = 0.5 + 0.5*nor.y;
        float bac = max(0.4 + 0.6*dot(nor,vec3(-light.x,light.y,-light.z)),0.0);

        vec3 lin  = vec3(0.0);
        lin += 1.00*dif*vec3(1.10,0.85,0.60)*sha;
        lin += 0.50*sky*vec3(0.10,0.20,0.40)*occ;
        lin += 0.10*bac*vec3(1.00,1.00,1.00)*(0.5+0.5*occ);
        lin += 0.25*occ*vec3(0.15,0.17,0.20);	 

        vec3 matcol = vec3(
            0.5+0.5*cos(0.0+2.0*tmat.z),
            0.5+0.5*cos(1.0+2.0*tmat.z),
            0.5+0.5*cos(2.0+2.0*tmat.z) );
        col = matcol * lin;
    }

    return pow( col, vec3(0.4545) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // camera
    vec3 ro = 1.1*vec3(2.5*sin(0.25*iTime),1.0+1.0*cos(iTime*.13),2.5*cos(0.25*iTime));

#if AA>1
    #define ZERO (min(iFrame,0))
    vec3 col = vec3(0.0);
    for( int m=ZERO; m<AA; m++ )
    for( int n=ZERO; n<AA; n++ )
    {
        // pixel coordinates
        vec2 o = vec2(float(m),float(n)) / float(AA) - 0.5;
        vec2 p = (2.0*(fragCoord+o)-iResolution.xy)/iResolution.y;

        vec3 ww = normalize(vec3(0.0) - ro);
        vec3 uu = normalize(cross( vec3(0.0,1.0,0.0), ww ));
        vec3 vv = normalize(cross(ww,uu));
        vec3 rd = normalize( p.x*uu + p.y*vv + 2.5*ww );

        col += render( ro, rd );
    }
    col /= float(AA*AA);
#else   
    vec2 p = (2.0*fragCoord-iResolution.xy)/iResolution.y;
    vec3 ww = normalize(vec3(0.0) - ro);
    vec3 uu = normalize(cross( vec3(0.0,1.0,0.0), ww ));
    vec3 vv = normalize(cross(ww,uu));
    vec3 rd = normalize( p.x*uu + p.y*vv + 2.5*ww );
    vec3 col = render( ro, rd );
#endif        
    
    fragColor = vec4(col,1.0);
}


void mainVR( out vec4 fragColor, in vec2 fragCoord, in vec3 fragRayOri, in vec3 fragRayDir )
{
    float time = iTime*0.25 + 0.01*iMouse.x;
    float anim = 1.1 + 0.5*smoothstep( -0.3, 0.3, cos(0.1*iTime) );

    vec3 col = render( fragRayOri + vec3(0.0,1.0,2.5), fragRayDir );
    fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return '4sX3Rn';
  }
  name(): string {
    return 'Menger Sponge';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 233;
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
