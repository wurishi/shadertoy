import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';
//FINISH
const fragment = `
uniform int u_mode;

// (x4 + y4 + z4) - (r2^2)·(x2 + y2 + z2) + r1^4 = 0;
float iGoursat( in vec3 ro, in vec3 rd, in float ka, float kb )
{
    float po = 1.0;

    vec3 rd2 = rd*rd; vec3 rd3 = rd2*rd;
    vec3 ro2 = ro*ro; vec3 ro3 = ro2*ro;

    // raw quartic
    float k4 = dot(rd2,rd2);
    float k3 = dot(ro ,rd3);
    float k2 = dot(ro2,rd2) - kb/6.0;
    float k1 = dot(ro3,rd ) - kb*dot(rd,ro)/2.0;
    float k0 = dot(ro2,ro2) + ka - kb*dot(ro,ro);

    // make leading coefficient 1
    k3 /= k4;
    k2 /= k4;
    k1 /= k4;
    k0 /= k4;
    
    // reduced cubic
    float c2 = k2 - k3*(k3);
    float c1 = k1 + k3*(2.0*k3*k3-3.0*k2);
    float c0 = k0 + k3*(k3*(c2+k2)*3.0-4.0*k1);

    if(u_mode == 1) {
      // prevent |c1| from being too close to zero
      // reduced cubic
      if( abs(c1) < 0.1*abs(c2) )
      {
          po = -1.0;
          float tmp=k1; k1=k3; k3=tmp;
          k0 = 1.0/k0;
          k1 = k1*k0;
          k2 = k2*k0;
          k3 = k3*k0;

          c2 = k2 - k3*(k3);
          c1 = k1 + k3*(2.0*k3*k3-3.0*k2);
          c0 = k0 + k3*(k3*(c2+k2)*3.0-4.0*k1);
      }
    }

    c0 /= 3.0;

    float Q = c2*c2 + c0;
    float R = c2*c2*c2 - 3.0*c0*c2 + c1*c1;
    float h = R*R - Q*Q*Q;
    
    // 2 intersections
    if( h>0.0 )
    {
        h = sqrt(h);

        float s = sign(R+h)*pow(abs(R+h),1.0/3.0); // cube root
        float u = sign(R-h)*pow(abs(R-h),1.0/3.0); // cube root
        
        float x = s+u+4.0*c2;
        float y = s-u;
        float ks = x*x + y*y*3.0;
        float k = sqrt(ks);

		float t = -0.5*po*abs(y)*sqrt(6.0/(k+x)) - 2.0*c1*(k+x)/(ks+x*k) - k3;
        return (po<0.0)?1.0/t:t;
    }
	
	// 4 intersections
    float sQ = sqrt(Q);
    float w = sQ*cos(acos(-R/(sQ*Q))/3.0);
  //float w = sQ*cos(atan(sqrt(-h),-R)/3.0);

    float d2 = -w - c2; if( d2<0.0 ) return -1.0;
    float d1 = sqrt(d2);
    float h1 = sqrt(w - 2.0*c2 + c1/d1);
    float h2 = sqrt(w - 2.0*c2 - c1/d1);

    float t1 = -d1 - h1 - k3; t1 = (po<0.0)?1.0/t1:t1;
    float t2 = -d1 + h1 - k3; t2 = (po<0.0)?1.0/t2:t2;
    float t3 =  d1 - h2 - k3; t3 = (po<0.0)?1.0/t3:t3;
    float t4 =  d1 + h2 - k3; t4 = (po<0.0)?1.0/t4:t4;

    float t = 1e20;
    if( t1>0.0 ) t=t1;
    if( t2>0.0 ) t=min(t,t2);
    if( t3>0.0 ) t=min(t,t3);
    if( t4>0.0 ) t=min(t,t4);
    return t;
}

vec3 nGoursat( in vec3 pos, float ka, float kb )
{
    return normalize( 4.0*pos*pos*pos - 2.0*pos*kb );
}

#define AA 2

#define ZERO min(iFrame,0)

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // camera movement	
	float an = 0.3*iTime;
	vec3 ro = vec3( 3.2*cos(an), 1.5, 3.2*sin(an) );
    vec3 ta = vec3( 0.0, -0.05, 0.0 );
    // camera matrix
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(0.0,1.0,0.0) ) );
    vec3 vv = normalize( cross(uu,ww));

    // object animation
    float def = smoothstep(-1.0,-0.4,-cos(0.3*iTime));
    float ra = 0.3 + def*0.6*sin(1.311*iTime+0.0);
    float rb = abs(ra) + 0.6 + def*0.25*sin(0.73*iTime+3.0);

    
    vec3 tot = vec3(0.0);
    
    #if AA>1
    for( int m=ZERO; m<AA; m++ )
    for( int n=ZERO; n<AA; n++ )
    {
        // pixel coordinates
        vec2 o = vec2(float(m),float(n)) / float(AA) - 0.5;
        vec2 p = (-iResolution.xy + 2.0*(fragCoord+o))/iResolution.y;
        #else    
        vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;
        #endif

	    // create view ray
	    vec3 rd = normalize( p.x*uu + p.y*vv + 2.0*ww );

        // raytrace
        float t = iGoursat( ro, rd, ra, rb );

        // shading/lighting	
	    vec3 col = vec3(0.08)*(1.0-0.3*length(p));
        
	    if( t>0.0 )
	    {
            vec3 pos = ro + t*rd;
		    vec3 nor = nGoursat( pos, ra, rb );
            vec3 lig = normalize(vec3(0.7,0.6,0.3));
            vec3 hal = normalize(-rd+lig);
            float inn = dot(nor,normalize(pos));
		    float dif = clamp( dot(nor,lig), 0.0, 1.0 );
		    float amb = (0.5+0.5*nor.y)*(0.6+0.4*inn)*(0.6+0.4*pow(0.5+0.5*inn,2.0));
            
            const float fr = 20.5;
            vec3 th = abs(nor);
            //col = vec3(0.4) + 0.4*smoothstep(-0.01,0.01,cos(pos.x*fr*0.5)*cos(pos.y*fr*0.5)*cos(pos.z*fr*0.5)); 
            col = vec3(0.6) + 0.4*smoothstep(-0.01,0.01,cos(pos.x*fr*0.5)*cos(pos.y*fr*0.5)*cos(pos.z*fr*0.5));
            float wi = smoothstep(-1.0,-0.98-0.015*th.x,cos(pos.x*fr))
                      *smoothstep(-1.0,-0.98-0.015*th.y,cos(pos.y*fr))
                      *smoothstep(-1.0,-0.98-0.015*th.z,cos(pos.z*fr));
            col *= wi;
        if(u_mode == 0) {
          col *= vec3(0.3,0.5,0.7)*amb + vec3(1.1,0.8,0.6)*dif;
          col += wi*0.5*pow(clamp(dot(hal,nor),0.0,1.0),32.0)*dif;
        }
        else {
          col *= amb;
          float fre = clamp(1.0+dot(rd,nor),0.0,1.0);
          col += col*fre;
        }
	    }
	
        col = sqrt( col );

	    tot += col;
    #if AA>1
    }
    tot /= float(AA*AA);
    #endif

	// dither to remove banding in the background
    tot += fract(sin(fragCoord.x*vec3(13,1,11)+fragCoord.y*vec3(1,7,5))*158.391832)/255.0;
    
    fragColor = vec4( tot, 1.0 );
}
`;

let gui: GUI;
const api = {
  u_mode: 0,
};

export default class implements iSub {
  key(): string {
    return '3lj3DW';
  }
  name(): string {
    return 'Goursat - intersection';
  }
  sort() {
    return 110;
  }
  webgl() {
    return WEBGL_2;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_mode', [0, 1]);
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
    const u_mode = webglUtils.getUniformLocation(gl, program, 'u_mode');
    return () => {
      u_mode.uniform1i(api.u_mode);
    };
  }
}
