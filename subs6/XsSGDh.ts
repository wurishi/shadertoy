import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
vec3 roty(float th, vec3 p) { 
	float c=cos(th),s=sin(th); 
	return vec3(c*p.x-s*p.z,p.y,c*p.z+s*p.x); 
}
vec3 rotx(float th, vec3 p) { 
	float c=cos(th),s=sin(th); 
	return vec3(p.x,c*p.y-s*p.z,c*p.z+s*p.y); 
}


float hash(float n) {return fract(sin(n * 0.1346) * 43758.5453123);}//from iq
vec2 noise( in vec3 x )
{
    vec3 p = floor(x);
    vec3 f = fract(x);
	f = f*f*(3.0-2.0*f);
	
	vec2 uv = (p.xy+vec2(37.0,17.0)*p.z) + f.xy;
	vec4 rg = texture( iChannel0, (uv+ 0.5)/256.0, -100.0 ).yxwz;
	return mix( rg.xz, rg.yw, f.z );
}

float map(vec3 p) {
	return length(p)-1.0;
}
vec3 nor(vec3 p) {
	float h=map(p);
	vec2 d=vec2(0.01,0.0);
	return normalize(vec3(map(p+d.xyy),map(p+d.yxy),map(p+d.yyx))-h);
}
vec3 glasscol=vec3(0.06,0.1,0.15);

//Rotation matrix by Syntopia
mat3 rotmat(vec3 v, float angle)
{
	float c = cos(angle);
	float s = sin(angle);
	
	return mat3(c + (1.0 - c) * v.x * v.x, (1.0 - c) * v.x * v.y - s * v.z, (1.0 - c) * v.x * v.z + s * v.y,
		(1.0 - c) * v.x * v.y + s * v.z, c + (1.0 - c) * v.y * v.y, (1.0 - c) * v.y * v.z - s * v.x,
		(1.0 - c) * v.x * v.z - s * v.y, (1.0 - c) * v.y * v.z + s * v.x, c + (1.0 - c) * v.z * v.z
		);
}

vec4 warp(vec3 p)
{
	p=rotmat(normalize(vec3(1.0,0.0,0.0)),p.x*1.5)*p;
	float cyr=sqrt(1.0-p.x*p.x)*0.6;
	cyr*=0.6+0.4*sin(7.0*atan(p.y,p.z));
	float dd=smoothstep(cyr*1.1,cyr,length(p.yz));
	return vec4(p,dd);
}
float glassstep=0.05;
float refr=1.04;
vec4 trace(vec3 rs, vec3 rd, vec2 fragCoord ) 
{
	float t=0.0;
	vec3 p=rs;	
	float inside=1.0;
	vec4 col=vec4(0.0,0.0,0.0,1.0);
	
	float A=dot(rd,rd);
	float B=2.0*dot(rd,rs);
	float C=dot(rs,rs)-1.0;
	float q=B*B-4.0*A*C;
	float spheret=(-B-sqrt(max(0.0,q)))/(2.0*A);
	//return vec4(q);
	p+=rd*spheret;
	for (int i=0;i<64;++i) {
		float h=map(p);
		h*=inside;
		if (h<=0.0) {
			// surface intersection
			p+=h*rd;
			vec3 n=nor(p);
			float nrd=dot(n,rd)*inside;
			if (nrd<0.0) 
			{
				vec3 rr=reflect(rd,n);
				float rocc=max(0.0,rr.y*1.*inside);
				float fr=pow(1.0+nrd,5.0)*0.99+0.01;
//				if (inside<0.0)
				
				//col.xyz+=col.w*fr*3.0*rocc*pow(texture(iChannel3,rr).xywz,vec3(2.2)); 魔改
//				col.w=1.0;
//				return col;
//				if (inside>0.0)
				if (q>0.1) rd=inside*normalize(refract(rd*inside,n,(inside<0.0)?refr:(1.0/refr)));
				inside=-inside;
				if (inside<0.0) h=hash(fragCoord.x+fragCoord.y*117.0)*glassstep;
				col.w*=0.95;
//				col.xyz+=0.2*glasscol;
			}
		}
		float step=max(0.01,abs(h)*0.95);
		if (inside<0.0) {
			step=min(step,glassstep);
			vec4 warp0 = warp(p);
			float warp1 = warp(p+vec3(0.0,0.02,0.0)).w;
			vec3 gcol=texture(iChannel1,warp0.yz*0.3+0.1).xyz;
			gcol=mix(gcol,vec3(0.5),-1.9);
			gcol*=vec3(0.5-(warp1-warp0.w));
			float dd=warp0.w*4.0;
			float k=exp(-step*dd);
			col.xyz+=(1.0-k)*col.w*gcol;
			col.w*=k;
			
			k=exp(-step*0.5);
			col.xyz+=(1.0-k)*col.w*glasscol;
			col.w*=k;
		}
		else step=min(step,5.0);
		p+=step*rd;
	}
	col.w=1.0-col.w;
	//col=vec4(1.0);
	col.xyzw*=smoothstep(0.0,0.1,q); // anti-aliasing!!!
///	if (fragCoord.x>iResolution.x*0.5) return col.wwww;
	col.w=1.0-col.w;
	//return normalize(rd.xyz).xyzz*col.w;
	float flot=(-1.0-p.y)/rd.y;
	vec3 flo=p+flot*rd;
	vec3 bg=vec3(1.0);
	if (dot(rd,flo-rs)>0.0) 
	{
		bg.xyz=vec3(sqrt(1.05-1.0/dot(flo,flo)));
		bg=mix(bg,vec3(1.0),smoothstep(0.,0.1,q));
//		
//		bg.xyz=fract(flo+0.5);
	}
//	else		
//	bg*=0.6+0.5*
//		pow(texture(iChannel2,rd)*0.5 + 0.5*texture(iChannel3,rd),vec4(2.2)).xyz;
	vec2 strip;
	float sca=2.;
	strip.x=(atan(rd.x,rd.z)*sca*24.0/3.141592);
	strip.y=(asin(rd.y)*10.0*sca);
	float f=hash(floor(strip.x)+floor(strip.y)*117.0);
	strip=fract(strip);
	if (f<0.5) strip.x=1.0-strip.x;

	float stripe=smoothstep (0.05,0.08,abs(length(strip)-0.5));
		  stripe*=smoothstep(0.05,0.08,abs(length(1.0-strip)-0.5));
	stripe=1.0-stripe;
	stripe*=smoothstep(0.0,0.9,rd.y);
	bg*=1.0-stripe*0.2;
	col.xyz+=col.w *bg;
	return col;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 uv = (fragCoord.xy-iResolution.xy*0.5) / iResolution.yy * 2.0;
	vec2 m=iMouse.xy/iResolution.xy;
	float th=(m.y*0.1-0.5)*1.0;
	vec3 rs=rotx(th,vec3(0,0,-2.0));
	vec3 re=rotx(th,vec3(uv*3.0,2.0));
	th=(m.x-0.5)*6.0+iTime*0.071-5.1;
	rs=roty(th,rs);
	re=roty(th,re);	
	vec3 rd=normalize(re-rs);
	vec4 col=trace(rs,rd,fragCoord);//*vec4(0.4,0.5,0.8,1.0);
	col+=4.0/255.0*hash(fragCoord.x+fragCoord.y*117.0);
	col=mix(col,smoothstep(0.0,1.0,col),0.5); // everything looks better with an s curve ;)
	col=pow(col,vec4(0.4));
	col*=vec4(smoothstep(2.0,0.0,length(uv*vec2(0.25,0.5))));
	fragColor = col;
  fragColor.a = 1.;
}

`;

export default class implements iSub {
  key(): string {
    return 'XsSGDh';
  }
  name(): string {
    return 'marble';
  }
  sort() {
    return 669;
  }
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
    return [
      webglUtils.DEFAULT_NOISE,
      webglUtils.TEXTURE9, //
    ];
  }
}
