import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `

float saturate(float value)
{
	return max(0., min(value, 1.));   
}

vec4 eye_shape(vec2 uv, float blur, float id)
{
  uv.y -=0.05;

  float blink = min((cos(iTime * 3. + id*37.) * 0.5 + 0.5)*20., 1.);
  //uv.y /= blink;
  //uv.x /= min(blink + 0.5, 1.);
  float eye = length(uv) - .1;
  float ring = length(uv) - .07;
  float inner = length(uv) - .04;
  vec2 uv2 = uv;
  uv2.x *= 0.5;
  uv2.y = -abs(uv2.y);
  float eye2 = length(uv2-vec2(0., -0.2*blink)) - .1;
  
  uv2 = uv;
  uv2.x = abs(uv2.x);
  uv2.x *= 0.4;
  uv2.y *= 1.5;
  uv2.y += uv2.x*uv2.x*100.;
  uv2.x -= (uv2.x*uv2.x)*0.01;
  uv2.y -= 0.035;
  float eye_white = length(uv2) - .01;

  float eyeMask = smoothstep(blur, -blur, eye);
  float eyeMask2 = smoothstep(blur, -blur, eye2);
  float ringMask = smoothstep(blur, -blur, ring);
  float innerMask = smoothstep(blur, -blur, inner);
  float eye_whiteMask = smoothstep(blur, -blur, eye_white);
  vec3 iris = vec3(221./255.,133./255.,37./255.);
  iris += iris*0.15;
  iris += (uv.y)/0.7*2.;
  
  eyeMask *= 1.-eyeMask2;
  
  vec3 color = vec3(1.);
  color = mix(color, iris, ringMask);
 
    
  color -= mix(color, vec3(0.), 1.-innerMask);
  color = mix(color, vec3(1.), eye_whiteMask);
  
  float shade = min(1. , (-eye/0.12/0.2)*0.5 + 0.6); 
  shade *= (uv.y)/0.25+ 0.9;
  color *=vec3(1) * shade;
  
    return vec4(color, eyeMask);
}

vec4 body(vec2 uv, vec3 color,  float radius, float blur, float id)
{

  uv *= 1.0+(cos(iTime*4. + id)*0.5+0.5)*0.02;
  
  vec2 uvEye = uv - vec2(0., 0.24);
  vec4 eye_color = eye_shape(uvEye, blur, id);

  uv.x = abs(uv.x) * (1. + smoothstep(0.5, 0.0, uv.y)*0.2);

  uv.x *= uv.x*2.0;
  uv.x += 0.1;
  uv.y -= 0.2;
  uv.y *= 0.7;

  float gradient_y = uv.y;

  float body = length(uv) - radius;
  

  float bodyMask = smoothstep(blur, -blur, body);

  float bodyShape = smoothstep(-.0 , 0.4, -body/ radius);

  //color *= 0.5*bodyShape;
  vec3 finalColor = color;
  float gradient = min(1.,(0.5 + smoothstep(-0.1, 0.2, gradient_y)));
  finalColor = color* bodyMask;
  finalColor *= gradient;
  finalColor += 0.3*(1.-bodyShape)*bodyMask;
  //color *= smoothstep(0., 0.5, 1.0 - circle); 

  finalColor = mix(finalColor, eye_color.rgb, eye_color.w);

  return vec4(finalColor, bodyMask);

}

vec4 starLayer2(vec2 uv)
{
  uv *= 10.;
  uv *= 0.5;

  vec2 lv = (fract(uv)-0.5);
  vec2 id = ceil(uv);

  float randomValue = (cos(id.y*733.23)*cos(id.x*52629.72))*0.5 + 0.5;

  vec2 random = (sin(id.yx*23.89)*cos(id*3455.7))*0.5 + 0.5;

  float sz = mix(2., 8., randomValue);
  vec2 mv = vec2(
    mix(-sz,sz, random.x)/4.,
    mix(-sz,sz, random.y)/4.
  );
  lv *= sz;
  lv += mv;


  float time = cos(iTime*2.+ randomValue*2357.)*1.;

  float len = abs(lv.x) * abs(lv.y);
  float len2 = length(lv.xy);
  vec3 col = vec3(1.);
  len *= 40.0;
  len = 1.-len;
  len2 = 1.-len2;
  col += smoothstep(0.5, 1.0, len2)*(1.-abs(cos(time*0.5)*0.5));
  len2 = saturate(len2);
  len*=len2;
  
  len -= (1. - abs(cos(time)*0.3));
  len = smoothstep(-0.1, 0.1, len);
  len = saturate(len);

  vec3 star1 = vec3(1., 0.5, 0.5);
  vec3 star2 = vec3(0.5, 0.5, 1.);
  vec3 star = mix(star1, star2, randomValue);

  col = star*len;
  col += smoothstep(0.7, 1.0, len2)*1.;
  return vec4(col, len);
}
vec4 stars(vec2 uv, float uvY)
{
  float y = uv.y;
  vec4 s = vec4(0.);
  uv*= 1.5;
  vec4 sl = starLayer2(uv);
  s = mix(s, sl, sl.w);

  uv*= 1.5;
  uv+=vec2(12.2);
  sl = starLayer2(uv);
  s = mix(sl, s, s.w);

  //s = 1./s*0.0091;

  vec3 color = vec3(0);
  vec3 sky1 = vec3(7./255., 19./255., 44./255.);
  vec3 sky2 = vec3(115./255., 172./255., 199./255.);

  vec3 sky = mix(sky2, sky1, uvY);

  //color.rg = lv;
  color = s.rgb;
  color = mix(sky*1.5, color, uvY - 0.3);

  //color = vec3(1.) * s ;

  return vec4(color, 1.);
}

float square(vec2 uv, float sY, float eY, float top, float bottom)
{
  uv.x = abs(uv.x);


  float m = 0.001;
  float h = mix(bottom, top, (uv.y-sY)/(eY-sY));


  float k = smoothstep(-m, m, uv.y - sY);
  k *= smoothstep(m, -m, uv.y - eY);
  k *= smoothstep(m, -m, uv.x - h);

  return k;

}
mat2 rot(float a)
{
  return mat2(cos(a), - sin(a), sin(a), cos(a));
}

float tree(vec2 uv)
{
  float f = square(uv, -0.1, 0.15, 0.10, 0.10);
  //uv = rot(0.01+ cos(iGlobalTime)*0.1) * uv;
  uv.y-= 0.16;
  f += square(uv, -0.1, 0.35, 0.18, 0.35);
  uv.y-= 0.35;
  uv = rot(0.01 + cos(iTime)*0.1) * uv;
  f += square(uv, -0.05, 0.25, 0.15, 0.3);
  uv.y-= 0.25;
  uv = rot(0.01 + cos(iTime)*0.1) * uv;
  f += square(uv, -0.05, 0.45, 0.0, 0.25);

  return f;
}

vec4 flr(vec2 uv)
{
  uv.y -=0.15;
  vec3 color;
  vec3 fg_color = vec3(32./255., 56./255., 103./255.);

  float l = 1.;

  uv.y += uv.x*uv.x*0.1;

  l = smoothstep(0.0, 0.001, -uv.y);

  color.rg = uv;
  color = fg_color;

  vec2 lv = rot(-0.12 + cos(iTime*2.)*0.01 ) * (uv + vec2(-0.55, 0.));
  lv.y +=0.2;
  lv*=1.7;
  l += tree(lv);

  lv = rot(0.12 + cos(iTime*2. + 23.)*0.1 ) * (uv + vec2(0.55, 0.));
  lv*=1.8;
  l += tree(lv);

  l = saturate(l);

  color *= 1. - uv.y*0.9;

  return vec4(color, l);
}

float circle(vec2 uv, float radius, float blur)
{
  float circle = length(uv) - radius;
  circle = smoothstep(blur, -blur, circle);
  return circle;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  float time = iTime * 1.0;
  vec2 uv = (gl_FragCoord.xy / iResolution.x);
  vec2 normalizedUV = gl_FragCoord.xy/iResolution.xy;

  uv.x -= 0.5; 
  //uv.y -= (iResolution.y/iResolution.x)*0.5;
  //uv.y
  uv.y += 0.05;


  vec4 col = vec4(0);

  float blur = 0.001;
  vec3 c1 = vec3(155./255.,197./255.,52./255.);
  vec3 c2 = vec3(201./255.,45./255.,75./255.);
  vec3 c3 = vec3(81./255.,169./255.,221./255.);

  col.rg = uv;

  uv *= 1.4;

  vec4 b1 = body(uv, c1, 0.2, blur, 1.);
  vec2 uv2 = rot(0.4) * (uv + vec2(0.2, 0.));
  vec4 b2 = body(uv2, c2, 0.2, blur,2.);
  uv2 = rot(-0.4) * (uv + vec2(-0.2, 0.));
  vec4 b3 = body(uv2, c3, 0.2, blur,3.);

  col = stars(uv, normalizedUV.y);
  col = mix(col, b2, b2.w);
  col = mix(col, b3, b3.w);
  col = mix(col, b1, b1.w);

  vec4 flr = flr(uv);
  col = mix(col, flr, flr.w);
  //col = b1+b2;
  //col += body(uv, c1, 0.2, blur);

  fragColor = vec4(col.rgb, 1.);
}
`;

export default class implements iSub {
  key(): string {
    return 'tlV3zy';
  }
  name(): string {
    return 'Snaliens';
  }
  sort() {
    return 630;
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
