import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float sdEllipse( in vec2 z, in vec2 ab )
{
    vec2 p = abs( z ); if( p.x > p.y ){ p=p.yx; ab=ab.yx; }
	
    float l = ab.y*ab.y - ab.x*ab.x;
    float m = ab.x*p.x/l; float m2 = m*m;
    float n = ab.y*p.y/l; float n2 = n*n;
    float c = (m2 + n2 - 1.0)/3.0; float c3 = c*c*c;
    float q = c3 + m2*n2*2.0;
    float d = c3 + m2*n2;
    float g = m + m*n2;

    float co;

    if( d<0.0 )
    {
        float p = acos(q/c3)/3.0;
        float s = cos(p);
        float t = sin(p)*sqrt(3.0);
        float rx = sqrt( -c*(s + t + 2.0) + m2 );
        float ry = sqrt( -c*(s - t + 2.0) + m2 );
        co = ( ry + sign(l)*rx + abs(g)/(rx*ry) - m)/2.0;
    }
    else
    {
        float h = 2.0*m*n*sqrt( d );
        float s = sign(q+h)*pow( abs(q+h), 1.0/3.0 );
        float u = sign(q-h)*pow( abs(q-h), 1.0/3.0 );
        float rx = -s - u - c*4.0 + 2.0*m2;
        float ry = (s - u)*sqrt(3.0);
        float rm = sqrt( rx*rx + ry*ry );
        float p = ry/sqrt(rm-rx);
        co = (p + 2.0*g/rm - m)/2.0;
    }

    float si = sqrt( 1.0 - co*co );
 
    vec2 closestPoint = vec2( ab.x*co, ab.y*si );
	
    return length(closestPoint - p ) * sign(p.y-closestPoint.y);
}

float sdEllipse_iter(vec2 p, vec2 ab){
    p = abs(p);
    float t = 0.785398;
    vec2 xy;
    for (int i=0;i<3;i++){
        vec2 cs = vec2(cos(t),sin(t));
        xy = ab*cs;
        vec2 e = (ab.x*ab.x-ab.y*ab.y)*vec2(1,-1)*cs*cs*cs/ab;
        vec2 r = xy-e, q = p-e;
        //float rm = length(r), qm = length(q);
        //float dc = rm*asin((r.x*q.y-r.y*q.x)/(rm*qm));
        float dc = (r.x*q.y-r.y*q.x)/length(q);
        float dt = dc/sqrt(dot(ab,ab)-dot(xy,xy));
        t += dt;
        t = min(1.570796,max(0.,t));
    }
    vec2 q = p/ab;
    return sign(dot(q,q)-1.)*length(p-xy);
}




#define res iResolution.xy
#define AA 16

void mainImage(out vec4 Col, in vec2 Pos) {
    vec2 ab = vec2(1.+.8*cos(iTime),1.);
    float SC = 7./res.x;
    float T = iMouse.z>0.?SC*(iMouse.x-.5*res.x):1e8;
    vec2 p0 = SC*(Pos-.5*res);
    
    // use AA to waste time to compare performance
    float d = 0.;
    for (int i=0;i<AA;i++) for (int j=0;j<AA;j++) {
        vec2 p = p0+SC*vec2(i,j)/float(AA);
        if (p.x<T) d += sdEllipse_iter(p,ab);
        else d += sdEllipse(p,ab);
    }
    d /= float(AA*AA);
    
    // color
    vec3 col = vec3(.8)-sign(d)*vec3(.1,.4,.2);
    col *= (.2*cos(60.*d)+.8)*(1.-exp(-5.*abs(d)));
    col = mix(col,vec3(1,1,0),clamp(2.-60.*abs(d),0.,1.));
    col = mix(col,vec3(1),clamp(2.-60.*abs(p0.x-T),0.,1.));
    Col = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'wtfyWj';
  }
  name(): string {
    return 'Ellipse Distance Comparison';
  }
  sort() {
    return 372;
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
