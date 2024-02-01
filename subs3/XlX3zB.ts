import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define PI	3.14159265359
#define PI2	( PI * 2.0 )

#define DISPLAY_FACES true
#define DISPLAY_SEGMENTS true
#define DISPLAY_VERTICES true

int Type=3;
float U=0.,V=0.,W=1.;
float SRadius=0.03, VRadius=0.07;

vec3 nc,p,pab,pbc,pca;
void init() {//setup folding planes and vertex
	float t=iTime;
    Type=int(fract(0.025*t)*3.)+3;
    U=0.5*sin(t*1.5)+0.5;
    V=0.5*sin(t*0.8)+0.5;
    W=0.5*sin(t*0.3)+0.5;
    float cospin=cos(PI/float(Type)), scospin=sqrt(0.75-cospin*cospin);
	nc=vec3(-0.5,-cospin,scospin);//3rd folding plane. The two others are xz and yz planes
	pab=vec3(0.,0.,1.);
	pbc=vec3(scospin,0.,0.5);//No normalization in order to have 'barycentric' coordinates work evenly
	pca=vec3(0.,scospin,cospin);
	p=normalize((U*pab+V*pbc+W*pca));//U,V and W are the 'barycentric' coordinates (coted barycentric word because I'm not sure if they are really barycentric... have to check)
	pbc=normalize(pbc);	pca=normalize(pca);//for slightly better DE. In reality it's not necesary to apply normalization :) 
}

vec3 fold(vec3 pos) {
	for(int i=0;i<5 /*Type*/;i++){
		pos.xy=abs(pos.xy);//fold about xz and yz planes
		pos-=2.*min(0.,dot(pos,nc))*nc;//fold about nc plane
	}
	return pos;
}

float D2Planes(vec3 pos) {//distance to the 3 faces
	pos-=p;
    float d0=dot(pos,pab);
	float d1=dot(pos,pbc);
	float d2=dot(pos,pca);
	return max(max(d0,d1),d2);
}

float length2(vec3 p){ return dot(p,p);}

float D2Segments(vec3 pos) {
	pos-=p;
	float dla=length2(pos-min(0.,pos.x)*vec3(1.,0.,0.));
	float dlb=length2(pos-min(0.,pos.y)*vec3(0.,1.,0.));
	float dlc=length2(pos-min(0.,dot(pos,nc))*nc);
	return sqrt(min(min(dla,dlb),dlc))-SRadius;
}

float D2Vertices(vec3 pos) {
	return length(pos-p)-VRadius;
}

float Polyhedron(vec3 pos) {
	pos=fold(pos);
	float d=10000.;
	if(DISPLAY_FACES) d=min(d,D2Planes(pos));
	if(DISPLAY_SEGMENTS) d=min(d,D2Segments(pos));
	if(DISPLAY_VERTICES)  d=min(d,D2Vertices(pos));
	return d;
}

vec3 getColor(vec3 pos){//Not optimized.
#define Face0Color vec3(.8,0.6,0.);
#define Face1Color vec3(0.3,0.7,0.2);
#define Face2Color vec3(0.1,0.4,1.);
#define SegmentsColor vec3(0.4,0.4,0.7);
#define VerticesColor vec3(1.,.4,.3);
	pos=fold(pos);
	float d0=1000.0,d1=1000.0,d2=1000.,df=1000.,dv=1000.,ds=1000.;
	if(DISPLAY_FACES){
		d0=dot(pos-p,pab);
		d1=dot(pos-p,pbc);
		d2=dot(pos-p,pca);
		df=max(max(d0,d1),d2);
	}
	if(DISPLAY_SEGMENTS) ds=D2Segments(pos);
	if(DISPLAY_VERTICES) dv=D2Vertices(pos);
	float d=min(df,min(ds,dv));
	vec3 col=Face0Color;
	if(d==df){
		if(d==d1) col=Face1Color;
		if(d==d2) col=Face2Color;
	}else{
		if(d==ds) col=SegmentsColor;
		if(d==dv) col=VerticesColor;
	}
	return col;
}

vec2 rotate(in vec2 p, in float t)
{
	return p * cos(-t) + vec2(p.y, -p.x) * sin(-t);
}

float map(in vec3 p)
{
    //return length(p)-1.;
	return mix(length(p)-1.,Polyhedron(p),0.8);//just for fun
}

vec3 calcNormal(in vec3 p)
{
	const vec2 e = vec2(0.0001, 0.0);
	return normalize(vec3(
		map(p + e.xyy) - map(p - e.xyy),
		map(p + e.yxy) - map(p - e.yxy),
		map(p + e.yyx) - map(p - e.yyx)));
}

float march(in vec3 ro, in vec3 rd)
{
	const float maxd = 5.0;
	const float precis = 0.001;
    float h = precis * 2.0;
    float t = 0.0;
	float res = -1.0;
    for(int i = 0; i < 64; i++)
    {
        if(h < precis || t > maxd) break;
	    h = map(ro + rd * t);
        t += h;
    }
    if(t < maxd) res = t;
    return res;
}

vec3 transform(in vec3 p)
{
    p.yz = rotate(p.yz, iTime * 0.2 + (iMouse.y-0.5*iResolution.y)*PI2/360.);
    p.zx = rotate(p.zx, iTime * 0.125 + (0.5*iResolution.x-iMouse.x)*PI2/360.);
    return p;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec2 p = (2.0 * fragCoord.xy - iResolution.xy) / iResolution.y;
	vec3 col = vec3(0.3 + p.y * 0.1);
   	vec3 rd = normalize(vec3(p, -1.8));
	vec3 ro = vec3(0.0, 0.0, 2.5);
    vec3 li = normalize(vec3(0.5, 0.8, 3.0));
    ro = transform(ro);
	rd = transform(rd);
	li = transform(li);
    init();
    float t = march(ro, rd);
    if(t > -0.001)
    {
        vec3 pos = ro + t * rd;
        vec3 n = calcNormal(pos);
		float dif = clamp(dot(n, li), 0.0, 1.0);
        col = getColor(pos) * dif;
        col = pow(col, vec3(0.8));
	}
   	fragColor = vec4(col, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'XlX3zB';
  }
  name(): string {
    return 'Polyhedron again';
  }
  sort() {
    return 361;
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
