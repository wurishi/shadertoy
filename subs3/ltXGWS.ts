import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//#define DISPLACE

float cells( vec3 p )
{
    // find distance to closest "white checker" in checkerboard pattern
    p = fract(p/2.0)*2.0;
    
    p = min( p, 2.0-p );
    
    return min(length(p),length(p-1.0));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 iHalfRes = iResolution.xy/2.0;
    vec3 ray = normalize(vec3(fragCoord.xy-iHalfRes,iHalfRes.y*2.0));
    
    vec2 r = vec2(0);
    if ( iMouse.z > .0 ) r += vec2(-2,3)*(iMouse.yx/iHalfRes.yx-1.0);
    else r.y = iTime*.3;
    
    vec2 c = cos(r);
    vec2 s = sin(r);
    
    ray.yz = ray.yz*c.x + vec2(-1,1)*ray.zy*s.x;
    ray.xz = ray.xz*c.y + vec2(1,-1)*ray.zx*s.y;

    vec3 pos = vec3(-c.x*s.y,s.x,-c.x*c.y)*4.0;
    
    float h;
    for ( int i=0; i < 100; i++ )
    {
        h = length(pos)-2.0;
        h = max(h,min( 1.5-length(pos.xy), (length(pos.xz)-abs(pos.y)+.4)*.7 ));
        
        #ifdef DISPLACE
        	h = max( h, (h+(cells(pos*5.0)-.8))*.2 );
        #endif
        
        pos += ray*h;
        if ( h < .0001 )
            break;
    }
    
   	fragColor = vec4(.1,.1,.1,1);
    if ( h < .1 )
    {
        //fragColor.rgb = step(.5,fract(pos*5.0/2.0-.25));//
    	fragColor.rgb = vec3(cells(pos*5.0)/1.3);
    }
}
`;

export default class implements iSub {
  key(): string {
    return 'ltXGWS';
  }
  name(): string {
    return 'Honeycomb Pattern';
  }
  sort() {
    return 362;
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
