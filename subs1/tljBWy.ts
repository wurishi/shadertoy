import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
vec4 iHexPrism( in vec3  ro, in vec3  rd, 
                in float ra, in float he )
{
    const float ks3 = 0.866025;

    // normals
    const vec3 n1 = vec3( 1.0,0.0,0.0);
    const vec3 n2 = vec3( 0.5,0.0,ks3);
    const vec3 n3 = vec3(-0.5,0.0,ks3);
    const vec3 n4 = vec3( 0.0,1.0,0.0);

    // slabs intersections
    vec3 t1 = vec3((vec2(ra,-ra)-dot(ro,n1))/dot(rd,n1), 1.0);
    vec3 t2 = vec3((vec2(ra,-ra)-dot(ro,n2))/dot(rd,n2), 1.0);
    vec3 t3 = vec3((vec2(ra,-ra)-dot(ro,n3))/dot(rd,n3), 1.0);
    vec3 t4 = vec3((vec2(he,-he)-dot(ro,n4))/dot(rd,n4), 1.0);
    
    // inetsection selection
    if( t1.y<t1.x ) t1=vec3(t1.yx,-1.0);
    if( t2.y<t2.x ) t2=vec3(t2.yx,-1.0);
    if( t3.y<t3.x ) t3=vec3(t3.yx,-1.0);
    if( t4.y<t4.x ) t4=vec3(t4.yx,-1.0);
   
    vec4            tN=vec4(t1.x,t1.z*n1);
    if( t2.x>tN.x ) tN=vec4(t2.x,t2.z*n2);
    if( t3.x>tN.x ) tN=vec4(t3.x,t3.z*n3);
    if( t4.x>tN.x ) tN=vec4(t4.x,t4.z*n4);
    
    float tF = min(min(t1.y,t2.y),min(t3.y,t4.y));
    
    // no intersection
    if( tN.x > tF || tF < 0.0) return vec4(-1.0);

    return tN;  // return tF too for exit point
}

#define AA 2

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
     // camera movement	
	float an = 0.5*iTime;
	vec3 ro = vec3( 1.7*cos(an), 1.0, 1.7*sin(an) );
    vec3 ta = vec3( 0.0, 0.0, 0.0 );
    // camera matrix
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
    vec3 vv = normalize( cross(uu,ww));

    // render
    vec3 tot = vec3(0.0);
    
    #if AA>1
    for( int m=0; m<AA; m++ )
    for( int n=0; n<AA; n++ )
    {
        // pixel coordinates
        vec2 o = vec2(float(m),float(n)) / float(AA) - 0.5;
        vec2 p = (-iResolution.xy + 2.0*(fragCoord+o))/iResolution.y;
        #else    
        vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;
        #endif

	    // create view ray
        vec3 rd = normalize( p.x*uu + p.y*vv + 1.5*ww );

        // raytrace
        vec4 tnor = iHexPrism( ro, rd, 0.6, 0.7 );
        float t = tnor.x;
    
        // shading/lighting	
        vec3 col = vec3(0.0);
        if( t>0.0 )
        {
            vec3 pos = ro + t*rd;
            vec3 nor = tnor.yzw;
            float dif = clamp( dot(nor,vec3(0.8,0.6,0.4)), 0.0, 1.0 );
            float amb = 0.5 + 0.5*dot(nor,vec3(0.0,1.0,0.0));
            col = vec3(0.2,0.3,0.4)*amb + 
                  vec3(0.8,0.7,0.5)*dif + 
                  0.1*nor.z;
        }

        // gamma
        col = sqrt( col );
	    tot += col;
    #if AA>1
    }
    tot /= float(AA*AA);
    #endif

	fragColor = vec4( tot, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'tljBWy';
  }
  name(): string {
    return 'Hexprism - intersection';
  }
  sort() {
    return 179;
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
