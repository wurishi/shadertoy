import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//#define HANDLE_SINGULARITY

#define ITR 80
#define FAR 10.
#define time iTime

mat2 mm2(in float a){float c = cos(a), s = sin(a);return mat2(c,-s,s,c);}

float map(vec3 p)
{
	p.x += sin(p.z*5.+sin(p.y*5.))*0.3;
    return (length(p)-1.)*0.7;
}

float march(in vec3 ro, in vec3 rd)
{
	float precis = 0.001;
    float h=precis*2.0;
    float d = 0.;
    for( int i=0; i<ITR; i++ )
    {
        if( abs(h)<precis || d>FAR ) break;
        d += h;
	    float res = map(ro+rd*d);
        h = res;
    }
	return d;
}

vec3 normal(const in vec3 p)
{  
    vec2 e = vec2(-1., 1.)*0.005;   
	return normalize(e.yxx*map(p + e.yxx) + e.xxy*map(p + e.xxy) + 
					 e.xyx*map(p + e.xyx) + e.yyy*map(p + e.yyy) );   
}

//http://orbit.dtu.dk/fedora/objects/orbit:113874/datastreams/file_75b66578-222e-4c7d-abdf-f7e255100209/content
void basis(in vec3 n, out vec3 f, out vec3 r)
{
    #ifdef HANDLE_SINGULARITY
    if(n.z < -0.999999)
    {
        f = vec3(0 , -1, 0);
        r = vec3(-1, 0, 0);
    }
    else
    {
    	float a = 1./(1. + n.z);
    	float b = -n.x*n.y*a;
    	f = vec3(1. - n.x*n.x*a, b, -n.x);
    	r = vec3(b, 1. - n.y*n.y*a , -n.y);
    }
    #else
    float a = 1./(1. + n.z);
    float b = -n.x*n.y*a;
    f = vec3(1. - n.x*n.x*a, b, -n.x);
   	r = vec3(b, 1. - n.y*n.y*a , -n.y);
    #endif
}

vec3 dLine(in vec3 ro, in vec3 rd, in vec3 a, in vec3 b)
{
	vec3 ba = b - a;
	vec3 oa = ro - a;
	float oad  = dot( oa,  rd );
	float dba  = dot( rd, ba );
	float baba = dot( ba, ba );
	float oaba = dot( oa, ba );
	
	vec2 th = vec2( -oad*baba + dba*oaba, oaba - oad*dba ) / (baba - dba*dba);
	
	th.x = max(th.x, 0.);
	th.y = clamp(th.y, 0., 1.);
	
	vec3 p = a + ba*th.y;
	vec3 q = ro + rd*th.x;
	
	return vec3( length( p-q ), th );
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
	vec2 p = fragCoord.xy/iResolution.xy-0.5;
	p.x*=iResolution.x/iResolution.y;
	vec2 mo = iMouse.xy / iResolution.xy-.5;
    mo = (mo==vec2(-.5))?mo=vec2(0.8,0.1):mo;
	mo.x *= iResolution.x/iResolution.y;
	//camera
	vec3 ro = vec3(0.,0.,4.5);
    vec3 rd = normalize(vec3(p,-1.5));
    vec3 rd2 = vec3(0,0.,-1);
    mat2 mx = mm2(mo.x*6.);
    mat2 my = mm2(mo.y*6.); 
    ro.xz *= mx;rd.xz *= mx;rd2.xz *= mx;
    ro.xy *= my;rd.xy *= my;rd2.xy *= my;
	
    vec3 ligt = normalize( vec3(-.5, 0.2, -0.2) );
    vec3 lcol = vec3(1.00,0.90,0.75);
    float rdl = clamp(dot(rd,ligt),0.,1.);
    vec3 col = lcol*pow(rdl,50.) + vec3(0.1,0.2,0.3)*0.5;
    
	float rz = march(ro,rd);
    
    if ( rz < FAR )
    {
        vec3 pos = ro+rz*rd;
        vec3 nor= normal(pos);
        float dif = clamp( dot(nor, ligt), 0., 1. );
        float bac = clamp( dot(nor, -ligt),0., 1.);
        float spe = pow(clamp(dot(reflect(rd,nor), ligt), 0., 1.),100.);
        float fre = 0.6*pow( clamp(1. + dot(nor,rd),0.0,1.0), 2.);
        vec3 brdf = 1.0*vec3(0.10,0.11,0.13);
        brdf += 2.*bac*vec3(0.15,0.15,0.15);
        brdf += 1.50*dif*lcol;
        col = vec3(0.3,0.3,0.3);
        col = col*brdf + col*spe + fre*col;
    }
    
    
    vec3 pdir = vec3(0.5773);
    pdir.xz *= mm2(time*0.3);
    pdir.zy *= mm2(time*.44);
    float rz2 = march(pdir*3.,-pdir);
    vec3 bpos = pdir*3.+rz2*-pdir;
	
    vec3 nor= normal(bpos);
    vec3 r = vec3(0);vec3 f = vec3(0);
    basis(nor,f,r);
    
    vec3 g = dLine(ro,rd,bpos,bpos+nor);
    float occ = step(g.y, rz)*0.5+0.5;
    col = max(col,smoothstep(-2.5,1.,sin(g.z*120.))*occ*vec3(.3,.3,1)*(1.-smoothstep(0.0,.03,g.x)));

    g = dLine(ro,rd,bpos,bpos+f);
    occ = step(g.y, rz)*0.5+0.5;
    col = max(col,smoothstep(-2.5,1.,sin(g.z*120.))*occ*vec3(1.,.2,.2)*(1.-smoothstep(0.0,.03,g.x)));

    g = dLine(ro,rd,bpos,bpos+r);
    occ = step(g.y, rz)*0.5+0.5;
    col = max(col,smoothstep(-2.5,1.,sin(g.z*120.))*occ*vec3(.2,1,.2)*(1.-smoothstep(0.0,.03,g.x)));
    
	fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return '4sSSW3';
  }
  name(): string {
    return 'Cheap orthonormal basis';
  }
  sort() {
    return 345;
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
