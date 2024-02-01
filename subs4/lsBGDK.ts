import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `


vec4 noise(float p){return texture(iChannel0,vec2(p/iChannelResolution[0].x,.0));}
vec4 noise(vec2 p){return texture(iChannel0,p/iChannelResolution[0].xy);}
vec4 noise(vec3 p){float m = mod(p.z,1.0);float s = p.z-m; float sprev = s-1.0;if (mod(s,2.0)==1.0) { s--; sprev++; m = 1.0-m; };return mix(texture(iChannel0,p.xy/iChannelResolution[0].xy + noise(sprev).yz*21.421),texture(iChannel0,p.xy/iChannelResolution[0].xy + noise(s).yz*14.751),m);}
vec4 noise(vec4 p){float m = mod(p.w,1.0);float s = p.w-m; float sprev = s-1.0;if (mod(s,2.0)==1.0) { s--; sprev++; m = 1.0-m; };return mix(noise(p.xyz+noise(sprev).wyx*3531.123420),	noise(p.xyz+noise(s).wyx*4521.5314),	m);}
vec4 noise(float p, float lod){return texture(iChannel0,vec2(p/iChannelResolution[0].x,.0),lod);}
vec4 noise(vec2 p, float lod){return texture(iChannel0,p/iChannelResolution[0].xy,lod);}
vec4 noise(vec3 p, float lod){float m = mod(p.z,1.0);float s = p.z-m; float sprev = s-1.0;if (mod(s,2.0)==1.0) { s--; sprev++; m = 1.0-m; };return mix(texture(iChannel0,p.xy/iChannelResolution[0].xy + noise(sprev,lod).yz,lod*21.421),texture(iChannel0,p.xy/iChannelResolution[0].xy + noise(s,lod).yz,lod*14.751),m);}

#define t iTime

vec3 flare(vec2 uv, vec2 pos, float seed, float size)
{
	vec4 gn = noise(seed-1.0);
	gn.x = size;
	vec3 c = vec3(.0);
	vec2 p = pos;
	vec2 d = uv-p;
	
	
	c += (0.01+gn.x*.2)/(length(d));
	
	c += vec3(noise(atan(d.x,d.y)*256.9+pos.x*2.0).y*.25)*c;
	
	float fltr = length(uv);
	fltr = (fltr*fltr)*.5+.5;
	fltr = min(fltr,1.0);
	
	for (float i=.0; i<20.; i++)
	{
		vec4 n = noise(seed+i);
		vec4 n2 = noise(seed+i*2.1);
		vec4 nc = noise (seed+i*3.3);
		nc+=vec4(length(nc));
		nc*=.65;
		
		for (int i=0; i<3; i++)
		{
			float ip = n.x*3.0+float(i)*.1*n2.y*n2.y*n2.y;
			float is = n.y*n.y*4.5*gn.x+.1;
			float ia = (n.z*4.0-2.0)*n2.x*n.y;
			vec2 iuv = (uv*(mix(1.0,length(uv),n.w*n.w)))*mat2(cos(ia),sin(ia),-sin(ia),cos(ia));
			vec2 id = mix(iuv-p,iuv+p,ip);
			c[i] += pow(max(.0,is-(length(id))),.45)/is*.1*gn.x*nc[i]*fltr;
		}
		
	}
	
	
	return c;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = fragCoord.xy / iResolution.xy -.5;
	uv.x*= iResolution.x/ iResolution.y;
	uv *= 2.0;
	
	vec2 mouse = iMouse.xy / iResolution.xy -.5;
	mouse.x*= iResolution.x/ iResolution.y;
	mouse *= 2.0;
	
	vec3 color = vec3(.0);
	
    vec2 pos;
    if (iMouse.z < .5)
    {
        pos = vec2(sin(t),cos(t*.7));
    }

    else pos = mouse.xy;
	
		color += flare(uv,pos,t-mod(t,2.00),0.15)*vec3(1.9,1.9,2.4);
	
	
	color+=noise(fragCoord.xy).xyz*.01;

	
	fragColor = vec4(color,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'lsBGDK';
  }
  name(): string {
    return 'Flare Mania';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 473;
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
    return [{ ...webglUtils.DEFAULT_NOISE, ...webglUtils.TEXTURE_MIPMAPS }];
  }
}
