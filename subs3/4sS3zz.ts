import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float msign(in float x) { return (x<0.0)?-1.0:1.0; }

float sdEllipse( vec2 p, in vec2 ab )
{
  //if( ab.x==ab.y ) return length(p)-ab.x;


	p = abs( p ); 
    if( p.x>p.y ){ p=p.yx; ab=ab.yx; }
	
	float l = ab.y*ab.y - ab.x*ab.x;
	
    float m = ab.x*p.x/l; 
	float n = ab.y*p.y/l; 
	float m2 = m*m;
	float n2 = n*n;
	
    float c = (m2+n2-1.0)/3.0; 
	float c3 = c*c*c;

    float d = c3 + m2*n2;
    float q = d  + m2*n2;
    float g = m  + m *n2;

    float co;

    if( d<0.0 )
    {
        float h = acos(q/c3)/3.0;
        float s = cos(h) + 2.0;
        float t = sin(h) * sqrt(3.0);
        float rx = sqrt( m2-c*(s+t) );
        float ry = sqrt( m2-c*(s-t) );
        co = ry + sign(l)*rx + abs(g)/(rx*ry);
    }
    else
    {
        float h = 2.0*m*n*sqrt(d);
        float s = msign(q+h)*pow( abs(q+h), 1.0/3.0 );
        float t = msign(q-h)*pow( abs(q-h), 1.0/3.0 );
        float rx = -(s+t) - c*4.0 + 2.0*m2;
        float ry =  (s-t)*sqrt(3.0);
        float rm = sqrt( rx*rx + ry*ry );
        co = ry/sqrt(rm-rx) + 2.0*g/rm;
    }
    co = (co-m)/2.0;

    float si = sqrt( max(1.0-co*co,0.0) );
 
    vec2 r = ab * vec2(co,si);
	
    return length(r-p) * msign(p.y-r.y);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = -1.0 + 2.0 * fragCoord.xy/iResolution.xy;
	uv.x *= iResolution.x/iResolution.y;
	
    vec2 m = iMouse.xy/iResolution.xy;
	m.x *= iResolution.x/iResolution.y;
	
 	float d = sdEllipse( uv, vec2(0.6,1.0)*m + vec2(0.4,0.2) );
    
    vec3 col = vec3(1.0) - sign(d)*vec3(0.1,0.4,0.7);
	col *= 1.0 - exp(-2.0*abs(d));
	col *= 0.8 + 0.2*cos(120.0*d);
	col = mix( col, vec3(1.0), 1.0-smoothstep(0.0,0.02,abs(d)) );

	fragColor = vec4( col, 1.0 );;
}
`;

export default class implements iSub {
  key(): string {
    return '4sS3zz';
  }
  name(): string {
    return 'Ellipse - distance 2D';
  }
  sort() {
    return 368;
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
