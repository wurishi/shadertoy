import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform bool u_iscline;

float sdBox( vec3 p, vec3 b )
{
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}

vec3 opRep( in vec3 p, in vec3 c, in vec3 l)
{
    return p-c*clamp(round(p/c),-l,l);
}

float map(vec3 p)
{
    p.z += 5.0;
    p = opRep(p, vec3(4.0), vec3(1.0));
    return sdBox(p, vec3(1.0));
}

vec3 calcNormal( in vec3 p )
{
    const float h = 1e-5; // or some other value
    const vec2 k = vec2(1,-1);
    return normalize( k.xyy*map( p + k.xyy*h ) + 
                      k.yyx*map( p + k.yyx*h ) + 
                      k.yxy*map( p + k.yxy*h ) + 
                      k.xxx*map( p + k.xxx*h ) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord/iResolution.xy;
    vec3 iCamPos = vec3(0);
    vec3 rayOri, rayDir;
    float maxDepth;
    
    // use different camera setting for CineShader
    if(u_iscline) {
      // use the relative position of the camera to the center of the screen as ray origin
	    rayOri = iCamPos;
    
      // screen size is 6m x 6m, or you can use iScreenSize.xy(CineShader only) to get the screen size
      rayDir = normalize(vec3((uv - 0.5) * vec2(iResolution.x/iResolution.y, 1.0) * 6.0, 0.0) - iCamPos);
    
      // make the maxDepth further
      maxDepth = 30.0;
    }
    else {
      rayOri = vec3((uv - 0.5) * vec2(iResolution.x/iResolution.y, 1.0) * 6.0, 3.0);
	    rayDir = vec3(0.0, 0.0, -1.0);
      maxDepth = 6.0;
    }
	
	float depth = 0.0;
	vec3 p;
	
	for(int i = 0; i < 64; i++) {
		p = rayOri + rayDir * depth;
		float dist = map(p);
        depth += dist;
		if (dist < 1e-6) {
			break;
		}
	}
	
    depth = min(maxDepth, depth);
	vec3 n = calcNormal(p);
    float b = max(0.0, dot(n, vec3(0.577)));
    vec3 col = (0.5 + 0.5 * cos((b + iTime * 3.0) + uv.xyx * 2.0 + vec3(0,2,4))) * (0.85 + b * 0.35);
    col *= exp( -depth / maxDepth );
	
    #ifdef IS_CINESHADER
    // set the screen thickness to zero in CineShader
    fragColor = vec4(col, 0.0);
    #else
    // maximum thickness is 2m in alpha channel
    fragColor = vec4(col, 1.0 - (depth - 0.5) / 2.0);
    #endif
    fragColor.a = 1.;
}
`;

let gui: GUI;
const api = {
  u_iscline: true,
};

export default class implements iSub {
  key(): string {
    return 'wtdSR8';
  }
  name(): string {
    return 'Parallax view on Cineshader';
  }
  sort() {
    return 99;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_iscline');
    return createCanvas();
  }
  userFragment(): string {
    return fragment;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {
    if (gui) {
      gui.destroy();
      gui = null;
    }
  }
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    const u_iscline = webglUtils.getUniformLocation(gl, program, 'u_iscline');
    return () => {
      u_iscline.uniform1i(api.u_iscline ? 1 : 0);
    };
  }
}
