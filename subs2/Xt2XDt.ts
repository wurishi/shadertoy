import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
const float MAX_TRACE_DISTANCE = 3.0;           // max trace distance
const float INTERSECTION_PRECISION = 0.001;        // precision of the intersection
const int NUM_OF_TRACE_STEPS = 100;


//----
// Camera Stuffs
//----
mat3 calcLookAtMatrix( in vec3 ro, in vec3 ta, in float roll )
{
    vec3 ww = normalize( ta - ro );
    vec3 uu = normalize( cross(ww,vec3(sin(roll),cos(roll),0.0) ) );
    vec3 vv = normalize( cross(uu,ww));
    return mat3( uu, vv, ww );
}

// checks to see which intersection is closer
// and makes the y of the vec2 be the proper id
vec2 opU( vec2 d1, vec2 d2 ){
    
	return (d1.x<d2.x) ? d1 : d2;
    
}

float sdBox( vec3 p, vec3 b )
{
  vec3 d = abs(p) - b;
  return min(max(d.x,max(d.y,d.z)),0.0) +
         length(max(d,0.0));
}

float sdSphere( vec3 p, float s )
{
  return length(p)-s;
}


//--------------------------------
// Modelling 
//--------------------------------
vec2 map( vec3 pos ){  
    
 	vec2 res = vec2( sdSphere( pos - vec3( .3 , .3 , -0.4 ) , 1.1 ) , 1. ); 
    res = opU( res , vec2( sdBox( pos- vec3( -.8 , -.4 , 0.2 ), vec3( .4 , .3 , .2 )) , 2. ));
    
    return res;
    
}



vec2 calcIntersection( in vec3 ro, in vec3 rd ){

    
    float h =  INTERSECTION_PRECISION*2.0;
    float t = 0.0;
	float res = -1.0;
    float id = -1.;
    
    for( int i=0; i< NUM_OF_TRACE_STEPS ; i++ ){
        
        if( h < INTERSECTION_PRECISION || t > MAX_TRACE_DISTANCE ) break;
	   	vec2 m = map( ro+rd*t );
        h = m.x;
        t += h;
        id = m.y;
        
    }

    if( t < MAX_TRACE_DISTANCE ) res = t;
    if( t > MAX_TRACE_DISTANCE ) id =-1.0;
    
    return vec2( res , id );
    
}



// Calculates the normal by taking a very small distance,
// remapping the function, and getting normal for that
vec3 calcNormal( in vec3 pos ){
    
	vec3 eps = vec3( 0.001, 0.0, 0.0 );
	vec3 nor = vec3(
	    map(pos+eps.xyy).x - map(pos-eps.xyy).x,
	    map(pos+eps.yxy).x - map(pos-eps.yxy).x,
	    map(pos+eps.yyx).x - map(pos-eps.yyx).x );
	return normalize(nor);
}




vec3 render( vec2 res , vec3 ro , vec3 rd ){
   

  vec3 color = vec3( 0. );
    
  vec3 lightPos = vec3( 1. , 4. , 3. );
    
    
  if( res.y > -.5 ){
      
    vec3 pos = ro + rd * res.x;
    vec3 norm = calcNormal( pos );
      
    vec3 lightDir = normalize( lightPos - pos );
    
    float match = max( 0. , dot( lightDir , norm ));
      
    // Balloon
    if( res.y == 1. ){
            
    	color = vec3( 1. , 0., 0.) * match + vec3( .3 , .1, .2 );
        vec3 balloonColor = vec3( 1. , 0. , 0. );
    
    // Box
    }else if(res.y == 2. ){
        
        color = norm;
        
    }
        
        
  }
   
  return color;
    
    
}



void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
    vec2 p = (-iResolution.xy + 2.0*fragCoord.xy)/iResolution.y;

    vec3 ro = vec3( 0., 0., 2.);
    vec3 ta = vec3( 0. , 0. , 0. );
    
    // camera matrix
    mat3 camMat = calcLookAtMatrix( ro, ta, 0.0 );  // 0.0 is the camera roll
    
	// create view ray
	vec3 rd = normalize( camMat * vec3(p.xy,2.0) ); // 2.0 is the lens length
    
    vec2 res = calcIntersection( ro , rd  );

	
    vec3 color = render( res , ro , rd );
    
	fragColor = vec4(color,1.0);

    
    
}

`;

export default class implements iSub {
  key(): string {
    return 'Xt2XDt';
  }
  name(): string {
    return 'box & balloon Minimized';
  }
  sort() {
    return 294;
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
