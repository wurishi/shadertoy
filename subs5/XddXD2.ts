import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const f = `
#define Seed iDate.z
#define Size 24.0
#define Speed 2.0

//White Noise
float n1(float n)
{
 	return fract(cos(n*85.62+Seed)*941.53);   
}
float n1(vec2 n)
{
 	return n1(n1(n.x)*1436.6+n1(n.y)*346.2);   
}
vec2 n2(float n)
{
 	return vec2(n1(n),n1(n*2.79-400.0));   
}
vec3 n3(float n)
{
 	return vec3(n1(n),n1(n*2.79-400.0),n1(600.0-n*3.32));   
}
vec3 n3(vec2 n)
{
 	return n3(n1(n.x)*0.74+n1(n.y)*0.91);   
}
//Perlin Noise
float p1(vec2 n)
{
 	vec2 F = floor(n);
    vec2 S = fract(n);
    return mix(mix(n1(F),n1(F+vec2(1,0)),S.x),
               mix(n1(F+vec2(0,1)),n1(F+vec2(1)),S.x),S.y);
}
vec2 p2(float n)
{
 	float F = floor(n);
    float S = fract(n);
    return mix(n2(F),n2(F+1.0),S);
}
//Voronoi Noise
vec3 v3(vec2 n)
{
    vec2 F = floor(n);
    float D = 1.0;
    vec3 C = vec3(0);
 	for(int X = -1;X<=1;X++)
    for(int Y = -1;Y<=1;Y++)
    {
        vec2 P = F+vec2(X,Y)+n2(n1(F+vec2(X,Y)));
        if (length(n-P)<D)
        {
        	D = length(n-P);
            C = n3(P);
        }
    }
    return C;
}
vec2 path(float n)
{
 	return mix(p2(n),p2(n+0.5),abs(0.5-fract(n)));   
}
vec3 color(vec2 p)
{
 	return sqrt(v3(p/128.0)*0.7+v3(p/64.0)*0.3); 
}
void mainImage( out vec4 fragColor, vec2 fragCoord )
{
    vec4 C = vec4(0,0,0,1);
    if (iFrame==0)
    {
		C = vec4(vec3(p1(fragCoord/2.0)*0.05+0.95),1);
    }
    else
    {
        vec2 UV = fragCoord/iResolution.xy;
        C = texture(iChannel0,UV);
        
        vec2 B = iResolution.xy*path(iTime*Speed);
        float P = Size*(p1(fragCoord/4.0)*0.2+0.8)-length(fragCoord-B);
        C = mix(C,vec4(color(B),1),smoothstep(0.0,Size,P));
        
    }
    fragColor = C;
    fragColor.a = 1.;
}
`;

const fragment = `
void mainImage( out vec4 fragColor, vec2 fragCoord )
{
    vec2 UV = fragCoord/iResolution.xy;
	fragColor = texture(iChannel0,UV);
}
`;

export default class implements iSub {
  key(): string {
    return 'XddXD2';
  }
  name(): string {
    return 'Procedural Paintings';
  }
  // sort() {
  //   return 0;
  // }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
  }
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  userFragment(): string {
    return f;
  }
  fragmentPrecision?(): string {
    return PRECISION_MEDIUMP;
  }
  destory(): void {}
  initial?(gl: WebGLRenderingContext, program: WebGLProgram): Function {
    return () => {};
  }
  channels() {
    return [{ type: 1, f, fi: 0 }];
  }
}
