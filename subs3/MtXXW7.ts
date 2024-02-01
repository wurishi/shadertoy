import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define PI 3.1415927

vec2 ClosestPointOnEllipse(vec2 p, vec2 ab)
{
	//focal point of ellipse - either on x axis if a>b or y otherwise
	float c = ab.x > ab.y ? sqrt(ab.x*ab.x - ab.y*ab.y) : sqrt(ab.y*ab.y - ab.x*ab.x);

	float t = 0.;
	if (ab.y < ab.x && abs(p.x) < c)
	{
		t = p.y > 0. ? 0. * PI : -0.5 * PI;
	}
	else if (ab.x < ab.y && abs(p.y) < c)
	{
		t = p.x > 0. ? 0. : -PI;
	}
	else
	{
		t = atan(ab.x*p.y,ab.y*p.x);
	}

	float aa_bb = ab.x * ab.x - ab.y * ab.y;
	vec2 pab = p*ab;
	for (int i=0; i<3; i++)
	{
		float sint = sin(t);
		float cost = cos(t);
		float ft = aa_bb * cost * sint - pab.x * sint + pab.y * cost;
		float dft = aa_bb * (cost * cost - sint * sint) - pab.x * cost - pab.y * sint;

		t = t - ft/dft;
	}

	return vec2(cos(t),sin(t))*ab;
}

float sdEllipse(vec2 p, vec2 ab)
{
	ab = abs(ab);
    p = -abs(p);
	vec2 closest = ClosestPointOnEllipse(p, ab);

	float dist = length(closest-p);

	vec2 poverab = p/ab;
	float inouttest = dot(poverab,poverab);

	if (inouttest > 1.) dist = -dist;
	return dist;
}

//borrowed from iq
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = -1.0 + 2.0 * fragCoord.xy/iResolution.xy;
	uv.x *= iResolution.x/iResolution.y;
	
    vec2 m = iMouse.xy/iResolution.xy;
	m.x *= iResolution.x/iResolution.y;
	
	float d = sdEllipse( uv, vec2(0.3,0.3)*m + vec2(1.0,0.5)  );
	vec3 col = clamp( abs(d), 0.0, 1.0 ) * (vec3(0.8) + vec3(-0.2,0.0,0.2)*sign(d) );
	col = mix( col, vec3(1.0,0.5,0.1), 1.0-smoothstep(abs(d),0.0,0.003));
	col *= 1.0 + 0.1*sin( 157.1*d );

    // gradient / normal
    //col = vec3( 0.5+0.5*normalize( vec2(dFdx(d), dFdy(d) ) ), 1.0 );
    
	fragColor = vec4( col, 1.0 );
}
`;

export default class implements iSub {
  key(): string {
    return 'MtXXW7';
  }
  name(): string {
    return 'Ellipse - Distance III';
  }
  sort() {
    return 376;
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
