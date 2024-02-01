import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define ITR 100
#define FAR 10.
#define time iTime

float smax(float a, float b)
{
    float pw = 14.;
    float res = exp2(pw*a) + exp2(pw*b);
    return log2(res)/pw;
}

float sbox(vec3 p, vec3 b)
{
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

float matid = 0.;

float map(vec3 p)
{
    vec2 w = 1./iChannelResolution[0].xy;
    const float dmx = .6;
    
    float df = 100.;
    
    float d[5];
    
    #if 1
    vec4 sp = textureLod(iChannel0, vec2(1.5, 0.5)*w, 0.);
    d[0] = length(p - sp.xyz)-sp.w;
    sp = textureLod(iChannel0, vec2(2.5, 0.5)*w, 0.);
    d[1] = length(p - sp.xyz)-sp.w;
    sp = textureLod(iChannel0, vec2(3.5, 0.5)*w, 0.);
    d[2] = length(p - sp.xyz)-sp.w;
    sp = textureLod(iChannel0, vec2(4.5, 0.5)*w, 0.);
    d[3] = length(p - sp.xyz)-sp.w;
    sp = textureLod(iChannel0, vec2(5.5, 0.5)*w, 0.);
    d[4] = length(p - sp.xyz)-sp.w;
    #else
    d[0] = length(p+vec3(0,sin(time*3.)*0.5,0))-1.;
    d[1] = length(p+vec3(1.2+cos(time*3.)*1.,sin(time*6.+0.7)*0.5,1))-1.;
    d[2] = length(p+vec3(.2+cos(time*2.+1.)*1.,-1.2,0))-.9;
    d[3] = length(p+vec3(.2+cos(time*2.+5.)*1.,-0.2,-.9))-.9;
    d[4] = length(p+vec3(.2+cos(time*2.+5.)*1.,-0.9,.9))-.9;
    #endif
    
    float dm = 100.;
    
    for (int j=0; j<5; j++)
    {
        dm = d[j];
        for (int i=0; i<5; i++)
        {
            if (i == j) continue;
			dm = mix(smax(dm, -d[i]),dm, dmx);
        }
        if (dm < df) matid = float(j);
        df = min(df,dm);
    }
    
    
    float box = - sbox(p, vec3(2.2,2.2,2.2));
    df = smax(df, -box);
    
    return df;
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

vec2 iBox( in vec3 ro, in vec3 rd, in vec4 b) 
{
    vec3 m = 1.0/rd;
    vec3 n = m*(ro-b.xyz);
    vec3 k = abs(m)*b.w;
	
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;

	float tN = max( max( t1.x, t1.y ), t1.z );
	float tF = min( min( t2.x, t2.y ), t2.z );
	
	if( tN > tF || tF < 0.0) return vec2(-1.0);

	return vec2( tN, tF );
}

vec3 rotx(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(p.x, c*p.y - s*p.z, s*p.y + c*p.z);
}

vec3 roty(vec3 p, float a){
    float s = sin(a), c = cos(a);
    return vec3(c*p.x + s*p.z, p.y, -s*p.x + c*p.z);
}

vec3 normal(const in vec3 p)
{  
    vec2 e = vec2(-1., 1.)*0.005;
	return normalize(e.yxx*map(p + e.yxx) + e.xxy*map(p + e.xxy) + 
					 e.xyx*map(p + e.xyx) + e.yyy*map(p + e.yyy) );   
}

float calcAO( in vec3 pos, in vec3 nor )
{
	float occ = 0.0;
    float sca = 1.0;
    for( int i=0; i<5; i++ )
    {
        float hr = 0.01 + 0.12*float(i)/4.0;
        vec3 aopos =  nor * hr + pos;
        float dd = map( aopos );
        occ += -(dd-hr)*sca;
        sca *= 0.95;
    }
    return clamp(occ*-2.+1., 0.0, 1.0 );    
}

float shadow( in vec3 ro, in vec3 rd, in float mint, in float tmax )
{
	float res = 1.0;
    float t = mint;
    for( int i=0; i<20; i++ )
    {
		float h = map( ro + rd*t );
        res = min( res, 8.0*h/t );
        t += clamp( h, 0.1, 0.4 );
        if( h<0.001 || t>5. ) break;
    }
    return clamp( res, 0.0, 1.0 );

}

vec3 lgt = normalize( vec3(-.5, 0.5, -0.2) );
vec3 lcol = vec3(1.1);

//mostly from: http://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
vec3 shade(in vec3 pos, in vec3 rd, in vec3 n, in vec3 alb)
{
    const float rough = 0.57;
    float nl = dot(n, lgt);
    float nv = dot(n, -rd);
    vec3 col = vec3(0.);
    float ao = calcAO(pos, n);
    vec3 f0 = vec3(0.1);
    if (nl > 0.)
    {
        vec3 haf = normalize(lgt - rd);
        float nh = clamp(dot(n, haf), 0., 1.); 
        float nv = clamp(dot(n, -rd), 0., 1.);
        float lh = clamp(dot(lgt, haf), 0., 1.);
        float a = rough*rough;
        float a2 = a*a;
        float dnm = nh*nh*(a2 - 1.) + 1.;
        float D = a2/(3.14159*dnm*dnm);
        float k = pow(rough + 1., 2.)/8.; //hotness reducing
		float G = (1./(nl*(1. - k) + k))*(1./(nv*(1. - k) + k));
        vec3 F = f0 + (1. - f0) * exp2((-5.55473*lh - 6.98316) * lh);
        vec3 spec = nl*D*F*G;
        col.rgb = lcol*nl*(spec + alb*(1. - f0));
    }
    col *= shadow(pos, lgt, 0.1,2.)*0.8+0.2;
    
    #if 1
    float bnc = clamp(dot(n, normalize(vec3(-lgt.x,5.0,-lgt.z)))*.5+0.28,0. , 1.);
    col.rgb += lcol*alb*bnc*0.1;
    #endif
    
    col += 0.05*alb;
    col *= ao;
    return col;
}

float tri(in float x){return abs(fract(x)-.5);}
vec3 tri3(in vec3 p){return vec3( tri(p.z+tri(p.y*1.)), tri(p.z+tri(p.x*1.)), tri(p.y+tri(p.x*1.)));}                           

mat2 m2 = mat2( 0.970,  0.242, -0.242,  0.970 );
float triNoise3d(in vec3 p)
{
    p.y *= 0.57;
    float z=1.5;
	float rz = 0.;
    vec3 bp = p;
	for (float i=0.; i<2.; i++ )
	{
        vec3 dg = tri3(bp*.5);
        p += (dg+0.1);

        bp *= 2.2;
		z *= 1.4;
		p *= 1.2;
        p.xz*= m2;
        
        rz+= (tri(p.z+tri(p.x+tri(p.y))))/z;
        bp += 0.9;
	}
	return rz;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{	
    vec2 q = fragCoord.xy/iResolution.xy;
	vec2 p = fragCoord.xy/iResolution.xy-0.5;
	p.x*=iResolution.x/iResolution.y;
	vec2 mo = iMouse.xy / iResolution.xy-.5;
    mo = (mo==vec2(-.5))?mo=vec2(-0.2,-0.0):mo;
	mo.x *= iResolution.x/iResolution.y;
    mo*=5.14;
    vec3 ro = vec3(.0,0.,5.5);
    vec3 rd = normalize(vec3(p,-1.));
    mo.x += sin(time*0.1);
    ro = rotx(ro,mo.y), rd = rotx(rd,mo.y);
    ro = roty(ro,mo.x), rd = roty(rd,mo.x);

    vec3 bg = sin(vec3(rd.x*1., rd.y*.5 + 1., rd.z*0.2 - 1.5)*.65-1.5)*.45+1.;
    bg += smoothstep(-0.4,1.,rd.y)*0.6;
    vec3 col = bg;
    vec3 brd = rd;
    
	float rz = march(ro,rd);
    
    if ( rz < FAR )
    {
        vec3 pos = ro +rd*rz;
        vec3 nor = normal(pos);
        vec3 alb = (sin(vec3(nor.x*.4 + 0., nor.y*.5 + 1., nor.z*0.4 + 4.)*.9 - 4. + matid*1.1))*0.47+0.5;
        col = shade(pos, rd, nor, alb);
    }
    
    vec2 ib2 = iBox(ro, brd, vec4(0,0,0, 2.2));
    float brad= 2.28;
    
    if(ib2.x>0.0)
        {
            if( ib2.y < rz )
            {
                vec3 pos = ro + brd*ib2.y;
                vec3 e = smoothstep( brad-0.15, brad, abs(pos) );
                float al = 1.0 - (1.0-e.x*e.y)*(1.0-e.y*e.z)*(1.0-e.z*e.x);
                col = mix( col, vec3(.03), 0.0 + 0.4*al );
                col *= (triNoise3d(pos*2.)*0.1+0.95)*vec3(.97,1.,.99);
            }
            if( ib2.x < rz )
            {
                vec3 pos = ro + brd*ib2.x;
                vec3 e = smoothstep( brad-0.15, brad, abs(pos) );
                float al = 1.0 - (1.0-e.x*e.y)*(1.0-e.y*e.z)*(1.0-e.z*e.x);
                col = mix( col, vec3(.03), 0.0 + .4*al );
                col *= (triNoise3d(pos*2.)*0.17+0.9)*vec3(.97,1.,.99);
            }
        }
        
	
    col = clamp(col,0.,1.);
    col = pow(col, vec3(0.416667))*1.055 - 0.055;
    col *= pow(20.0*q.x*q.y*(1.0-q.x)*(1.0-q.y), .07); //Vign
    
    col *= smoothstep(0.,50., mod(float(iFrame)-1800., 1800.)-18.);
    col *= smoothstep(1800.,1750., mod(float(iFrame)-1800., 1800.)-18.);
    
	fragColor = vec4( col, 1.0 );
}
`;

const f = `
float sbox(vec3 p, vec3 b)
{
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

float map(vec3 p, vec4[5] sp)
{
    float d = 100.;
    
    for (int i=0; i<5; i++)
    {
    	d = min(length(p-sp[i].xyz)-sp[i].w, d);
    }
    
    float box = - sbox(p, vec3(2.2,2.2,2.2));
    box = pow(box, 3.); //Cube is a hard surface, increase the distance metric
    d = min(d, box);
    
    return d;
}

vec3 normal(vec3 p, vec4[5] sp)
{  
    vec2 e = vec2(-1., 1.)*0.005;
	return normalize(e.yxx*map(p + e.yxx, sp) + e.xxy*map(p + e.xxy, sp) + 
					 e.xyx*map(p + e.xyx, sp) + e.yyy*map(p + e.yyy, sp) );   
}

vec3 hash3( float n ){return fract(sin(vec3(n,n+1.0,n+2.0))*vec3(43758.5453123,22578.1459123,19642.3490423))*2.0-1.0;}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = fragCoord.xy/iResolution.xy;
    vec2 w = 1./iChannelResolution[0].xy;
    
    if (p.y > 2.*w.y)
        discard;
    
    vec4[6] sp;
    vec4[5] sp2;
    
    sp[1] = texture(iChannel0, vec2(1.5, 0.5)*w);
    sp[2] = texture(iChannel0, vec2(2.5, 0.5)*w);
    sp[3] = texture(iChannel0, vec2(3.5, 0.5)*w);
    sp[4] = texture(iChannel0, vec2(4.5, 0.5)*w);
    sp[5] = texture(iChannel0, vec2(5.5, 0.5)*w);
    
    vec4[6] sv;
    
    sv[1] = texture(iChannel0, vec2(1.5, 1.5)*w);
    sv[2] = texture(iChannel0, vec2(2.5, 1.5)*w);
    sv[3] = texture(iChannel0, vec2(3.5, 1.5)*w);
    sv[4] = texture(iChannel0, vec2(4.5, 1.5)*w);
    sv[5] = texture(iChannel0, vec2(5.5, 1.5)*w);
    
    if (iFrame%1800 == 20)
    {
        sp[1] = vec4(0, 0.9, 1, 1);
        sp[2] = vec4(1, 0.5, 0, 0.95);
        sp[3] = vec4(-1, -0.5, 1, 0.9);
        sp[4] = vec4(1, -0.2, 1, 0.85);
        sp[5] = vec4(-0.5, 0.5, -1.5,0.8);
        
        sv[1] = vec4(hash3(float(iFrame)), 0)*0.04;
        sv[2] = vec4(hash3(float(iFrame+1)), 0)*0.06;
        sv[3] = vec4(hash3(float(iFrame+2)), 0)*0.06;
        sv[4] = vec4(hash3(float(iFrame+3)), 0)*0.06;
        sv[5] = vec4(hash3(float(iFrame+4)), 0)*0.06;
    }
    
    float cp = fragCoord.x;
    vec4 csp = vec4(0,0,0,1);
    vec4 csv = vec4(0,0,0,1);
    float td = 100.;
    int cnt = 0;
    
    //split into the current object and the rest
    for (int i=1; i<6; i++)
    {
        if (i == int(cp))
        {
            csp = sp[i];
            csv = sv[i];
        }
        else
        {
            sp2[cnt] = sp[i];
            cnt++;
        }
    }
    
    //evaluate the movement of the current object
    vec3 nor = normal(csp.xyz, sp2);
    float dst = map(csp.xyz, sp2);
#if 0
    //csv.xyz += (nor*0.0025*(exp(-dst*7. + 1.5))); //Repulsion
    csv.xyz += (nor*0.002*(exp(-dst*7. + 2.))); //Repulsion
    csv.xyz *= clamp(1.5*(abs(dst)),0.,1.)*0.01+0.99; //internal and external friction
#else
    csv.xyz += (nor*0.0025*(exp(-dst*8. + 1.75))); //Repulsion
    csv.xyz *= clamp(1.5*(abs(dst)),0.,1.)*0.006+0.994; //internal and external friction
#endif
    csv.y -= 0.0001; //gravity
    csv.xyz = clamp(csv.xyz, vec3(-0.5), vec3(0.5)); //Sanity
    csp.xyz += csv.xyz;
    
    vec4 ret = vec4(0,0,0,1);
    
    if (fragCoord.y < 1.0)
    {
        ret = csp;
    }
    else
        ret = csv;
    
    fragColor = ret;
}

`;

export default class implements iSub {
  key(): string {
    return 'ltjBzK';
  }
  name(): string {
    return 'Squishy balls';
  }
  webgl() {
    return WEBGL_2;
  }
  // sort() {
  //   return 0;
  // }
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
    return [
      // { type: 1, f, fi: 0 }
      webglUtils.DEFAULT_NOISE,
    ];
  }
}
