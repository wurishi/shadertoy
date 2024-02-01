import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform int u_method;

#define AA 1

// method 0 : approximate http://research.microsoft.com/en-us/um/people/hoppe/ravg.pdf
// method 1 : exact       

//-----------------------------------------------------------------------------------

float dot2( in vec3 v ) { return dot(v,v); }
vec2 sdBezier1(vec3 pos, vec3 A, vec3 B, vec3 C)
{    
    vec3 a = B - A;
    vec3 b = A - 2.0*B + C;
    vec3 c = a * 2.0;
    vec3 d = A - pos;

    float kk = 1.0 / dot(b,b);
    float kx = kk * dot(a,b);
    float ky = kk * (2.0*dot(a,a)+dot(d,b)) / 3.0;
    float kz = kk * dot(d,a);      

    vec2 res;

    float p = ky - kx*kx;
    float p3 = p*p*p;
    float q = kx*(2.0*kx*kx - 3.0*ky) + kz;
    float h = q*q + 4.0*p3;

    if(h >= 0.0) 
    { 
        h = sqrt(h);
        vec2 x = (vec2(h, -h) - q) / 2.0;
        vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
        float t = clamp(uv.x+uv.y-kx, 0.0, 1.0);

        // 1 root
        res = vec2(dot2(d+(c+b*t)*t),t);
    }
    else
    {
        float z = sqrt(-p);
        float v = acos( q/(p*z*2.0) ) / 3.0;
        float m = cos(v);
        float n = sin(v)*1.732050808;
        vec3 t = clamp( vec3(m+m,-n-m,n-m)*z-kx, 0.0, 1.0);
        
        // 3 roots, but only need two
        float dis = dot2(d+(c+b*t.x)*t.x);
        res = vec2(dis,t.x);

        dis = dot2(d+(c+b*t.y)*t.y);
        if( dis<res.x ) res = vec2(dis,t.y );
    }
    
    res.x = sqrt(res.x);
    return res;
}

    // http://research.microsoft.com/en-us/um/people/hoppe/ravg.pdf
    // { dist, t, y (above the plane of the curve, x (away from curve in the plane of the curve))
	float det( vec2 a, vec2 b ) { return a.x*b.y - a.y*b.x; }
    vec2 sdBezier2( vec3 p, vec3 va, vec3 vb, vec3 vc )
    {
      vec3 w = normalize( cross( vc-vb, va-vb ) );
      vec3 u = normalize( vc-vb );
      vec3 v =          ( cross( w, u ) );

      vec2 m = vec2( dot(va-vb,u), dot(va-vb,v) );
      vec2 n = vec2( dot(vc-vb,u), dot(vc-vb,v) );
      vec3 q = vec3( dot( p-vb,u), dot( p-vb,v), dot(p-vb,w) );
            
      float mq = det(m,q.xy);
      float nq = det(n,q.xy);
      float mn = det(m,n);
      float k1 = mq + nq;
        
      vec2  g = (k1+mn)*n + (k1-mn)*m;
    //float f = -4.0*mq*nq - (mn-mq+nq)*(mn-mq+nq);
      float f = -(mn*mn + 2.0*mn*(nq-mq)) - k1*k1;
      vec2  z = 0.5*f*vec2(g.y,-g.x)/dot(g,g);
    //float t = clamp( 0.5 + 0.5*det(z-q.xy,m+n)/mn, 0.0 ,1.0 );
      float t = clamp( 0.5 + 0.5*(det(z,m+n)+k1)/mn, 0.0 ,1.0 );
        
      vec2 cp = m*(1.0-t)*(1.0-t) + n*t*t - q.xy;
      return vec2(sqrt(dot(cp,cp)+q.z*q.z), t );
    }

    // my adaptation to 3d of http://research.microsoft.com/en-us/um/people/hoppe/ravg.pdf
    // { dist, t, y (above the plane of the curve, x (away from curve in the plane of the curve))
    vec2 sdBezier3( vec3 p, vec3 b0, vec3 b1, vec3 b2 )
    {
        b0 -= p;
        b1 -= p;
        b2 -= p;
       
        vec3 b01 = cross(b0,b1);
        vec3 b12 = cross(b1,b2);
        vec3 b20 = cross(b2,b0);
        
        vec3 n =  b01+b12+b20;
        
        float a = -dot(b20,n);
        float b = -dot(b01,n);
        float d = -dot(b12,n);

        float m = -dot(n,n);
        
      //vec3  g = b*(b2-b1) + d*(b1-b0) + a*(b2-b0)*0.5;
        vec3  g =  (d-b)*b1 + (b+a*0.5)*b2 + (-d-a*0.5)*b0;
        float f = a*a*0.25-b*d;
        vec3  k = b0-2.0*b1+b2;
        float t = clamp((a*0.5+b-0.5*f*dot(g,k)/dot(g,g))/m, 0.0, 1.0 );
        
        return vec2(length(mix(mix(b0,b1,t), mix(b1,b2,t),t)),t);
    }

//-----------------------------------------------------------------------------------

vec3  hash3( float n ) { return fract(sin(vec3(n,n+7.3,n+13.7))*1313.54531); }

vec3 noise3( in float x )
{
    float p = floor(x);
    float f = fract(x);
    f = f*f*(3.0-2.0*f);
    return mix( hash3(p+0.0), hash3(p+1.0), f );
}

float sdBox( vec3 p, vec3 b )
{
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

//-----------------------------------------------------------------------------------


vec2 map( vec3 p )
{
    vec3 a = vec3(0.0,-1.0,0.0);
    vec3 b = vec3(0.0, 0.0,0.0);
    vec3 c = vec3(0.0, 0.5,-0.5);
	float th = 0.0;
	float hm = 0.0;
	float id = 0.0;
    
    float dm = length(p-a);

    for( int i=0; i<8; i++ )
	{	
        vec3 bboxMi = min(a,min(b,c))-0.3;
    	vec3 bboxMa = max(a,max(b,c))+0.3;
        
        float bv = sdBox( p-0.5*(bboxMa+bboxMi), 0.5*(bboxMa-bboxMi) );
        //if( bv<dm )
        {
            vec2 h;
            if(u_method == 1) {
                h = sdBezier1( p, a, b, c );
            }
            else if(u_method == 2) {
                h = sdBezier2( p, a, b, c );
            }
            else {
                h = sdBezier3( p, a, b, c );
            }
            float kh = (th + h.y)/8.0;
            float ra = 0.3 - 0.28*kh + 0.3*exp(-15.0*kh);
            float d = h.x - ra;
            if( d<dm ) { dm=d; hm=kh; }
    	}
		
        vec3 na = c;
		vec3 nb = c + (c-b);
		vec3 dir = normalize(-1.0+2.0*hash3( id+13.0 ));
		vec3 nc = nb + 1.0*dir*sign(-dot(c-b,dir));

		id += 3.71;
		a = na;
		b = nb;
		c = nc;
		th += 1.0;
	}

	return vec2( dm*0.5, hm );
}

float map2( in vec3 pos )
{
    return min( pos.y+1.0, map(pos).x );
}


vec3 intersect( in vec3 ro, in vec3 rd )
{
    vec3 res = vec3( -1.0 );

    float maxd = 12.0;
    
    // plane
    float tp = (-1.0-ro.y)/rd.y;
    if( tp>0.0 )
    {
        vec3 pos = ro + rd*tp;
        res = vec3( tp, 0.025*length(pos.xz)*1.0 + 0.01*atan(pos.z,pos.x), 0.0 );
        maxd = tp;
    }

    // tentacle
	const float precis = 0.001;
    float t = 2.0;
	float l = 0.0;
    for( int i=0; i<128; i++ )
    {
	    vec2 h = map( ro+rd*t );
        if( h.x<precis || t>maxd ) break;
        t += h.x;
		l = h.y;
    }
    if( t<maxd ) res = vec3( t, l, 1.0 );

    return res;
}

vec3 calcNormal( in vec3 pos )
{
    vec3 eps = vec3(0.002,0.0,0.0);

    float f = map(pos).x;
	return normalize( vec3(
           map(pos+eps.xyy).x - f,
           map(pos+eps.yxy).x - f,
           map(pos+eps.yyx).x - f ) );
}

float softshadow( in vec3 ro, in vec3 rd, float mint, float k )
{
    float res = 1.0;
    float t = mint;
	float h = 1.0;
    for( int i=0; i<32; i++ )
    {
        h = map(ro + rd*t).x;
        res = min( res, k*h/t );
		t += clamp( h, 0.02, 2.0 );
        if( res<0.0001 ) break;
    }
    return clamp(res,0.0,1.0);
}

float calcAO( in vec3 pos, in vec3 nor )
{
    float ao = 0.0;
    for( int i=0; i<8; i++ )
    {
        float h = 0.02 + 0.5*float(i)/7.0;
        float d = map2( pos + h*nor );
        ao += h-d;
    }
    return clamp( 1.5 - ao*0.6, 0.0, 1.0 );
}


vec3 lig = normalize(vec3(-0.2,0.6,0.9));

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
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


        //-----------------------------------------------------
        // camera
        //-----------------------------------------------------

        float an = 2.0 + 0.3*iTime;

        vec3 ro = vec3(7.0*sin(an),0.0,7.0*cos(an));
        vec3 ta = vec3(0.0,0.0,0.0);

        // camera matrix
        vec3 ww = normalize( ta - ro );
        vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
        vec3 vv = normalize( cross(uu,ww));

        // create view ray
        vec3 rd = normalize( p.x*uu + p.y*vv + 2.5*ww );

        //-----------------------------------------------------
        // render
        //-----------------------------------------------------

        vec3 col = clamp( vec3(0.95,0.95,1.0) - 0.75*rd.y, 0.0, 1.0 );
        float sun = pow( clamp( dot(rd,lig), 0.0, 1.0 ), 8.0 );
        col += 0.7*vec3(1.0,0.9,0.8)*pow(sun,4.0);
        vec3 bcol = col;

        // raymarch
        vec3 tmat = intersect(ro,rd);
        if( tmat.z>-0.5 )
        {
            // geometry
            vec3 pos = ro + tmat.x*rd;
            vec3 nor = calcNormal(pos);
            if( tmat.z<0.5 )
                nor = vec3(0.0,1.0,0.0);
            vec3 ref = reflect( rd, nor );

            // materials
            vec3 mate = vec3(0.5);
            mate *= smoothstep( -0.75, 0.75, cos( 200.0*tmat.y ) );

            float occ = calcAO( pos, nor );

            // lighting
            float sky = clamp(nor.y,0.0,1.0);
            float bou = clamp(-nor.y,0.0,1.0);
            float dif = max(dot(nor,lig),0.0);
            float bac = max(0.3 + 0.7*dot(nor,-lig),0.0);
            float sha = 0.0; if( dif>0.001 ) sha=softshadow( pos+0.01*nor, lig, 0.0005, 32.0 );
            float fre = pow( clamp( 1.0 + dot(nor,rd), 0.0, 1.0 ), 5.0 );
            float spe = max( 0.0, pow( clamp( dot(lig,reflect(rd,nor)), 0.0, 1.0), 8.0 ) );

            // lights
            vec3 brdf = vec3(0.0);
            brdf += 2.0*dif*vec3(1.25,0.90,0.60)*sha;
            brdf += 1.5*sky*vec3(0.10,0.15,0.35)*occ;
            brdf += 1.0*bou*vec3(0.30,0.30,0.30)*occ;
            brdf += 1.0*bac*vec3(0.30,0.25,0.20)*occ;
            brdf += 1.0*fre*vec3(1.00,1.00,1.00)*occ*dif;

            // surface-light interacion
            col = mate.xyz* brdf;
            col += (1.0-mate.xyz)*1.0*spe*vec3(1.0,0.95,0.9)*sha*2.0*(0.2+0.8*fre)*occ;

            // fog
            col = mix( col, bcol, smoothstep(10.0,20.0,tmat.x) );
        }
		col += 0.4*vec3(1.0,0.8,0.7)*sun;
        tot += col;
#if AA>1
    }
    tot /= float(AA*AA);
#endif
    
	
    // gamma
	tot = pow( clamp(tot,0.0,1.0), vec3(0.45) );

	fragColor = vec4( tot, 1.0 );
}

`;

let gui: GUI;
const api = {
  u_method: 1,
};

export default class implements iSub {
  key(): string {
    return 'ldj3Wh';
  }
  name(): string {
    return 'Quadratic Bezier - 3D';
  }
  sort() {
    return 164;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_method', { exact: 1, approximate2: 2, approximate3: 3 });
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
    const u_method = webglUtils.getUniformLocation(gl, program, 'u_method');
    return () => {
      u_method.uniform1i(api.u_method);
    };
  }
}
