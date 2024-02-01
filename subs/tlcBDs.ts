import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
vec2 random2(vec2 st){
  st = vec2( dot(st,vec2(127.1,311.7)),
            dot(st,vec2(269.5,183.3)) );
  return fract(abs(sin(st)*43758.5453123));
}


float noise2 (float a, float b) {
  float buff1 = fract((10000. + abs(b + a)) * fract(a * fract((100. + b) * fract(a * 0.0171 + b))));
  return(buff1 * 1.0038 - 0.00185);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
  // Normalized pixel coordinates (from 0 to 1)
  vec2 st = fragCoord/iResolution.y;
  
  st.y -= iTime*0.1;
  
   // Масштаб
  float mashtab = 10.;
  st *= mashtab;

  // Разбиение пространства
  vec2 i_st = floor(st);
  vec2 f_st = fract(st);
  
  float m_dist1 = 100.0;
  float m_dist2 = 100.0;
  vec2 m_dist = vec2(100.0);


  for (int y= -1; y <= 1; y++) {
      for (int x= -1; x <= 1; x++) {
          // Соседняя клетка
          vec2 neighbor = vec2(float(x),float(y));
          vec2 point = random2(i_st + neighbor);
          point = 0.5+0.5*sin(iTime + 6.2831*point);
          vec2 diff = neighbor + point - f_st; //вектор до точки
          float dist = length(diff); // Расстояние до точки
          
          if ( dist < m_dist.x || dist < m_dist.y) {
              if (m_dist.x > m_dist.y) {m_dist.x = dist;}
              else {m_dist.y = dist;}
          }
          
          
      }
  }
  float min_dist = min(m_dist.x, m_dist.y);
  float max_dist = max(m_dist.x, m_dist.y);
  
  
  
  
  float col1 = float(max_dist-min_dist);
  float col2 = float(min_dist*max_dist);
  float col3 = float(cos(max_dist)-sin(min_dist));
  float col4 = float(17.-st.x-min_dist*15.0);
  float col5 = float(st.x-(min_dist/max_dist)*15.0);
  float col6 = float((0.5+0.5*sin((cos(max_dist)-sin(min_dist))*20.0)));
  
  //float col6 = float(sin(max_dist/min_dist-cos(max_dist-min_dist)));
  //float col1 = float(max_dist);
  //float col10 = col5-sin(max_dist)+cos(min_dist);
  //float col3 = float(min_dist/max_dist);
  //float col5 = float(min_dist/max_dist*(max_dist-min_dist));
  //float col6 = float(min_dist/max_dist - (max_dist-min_dist));
  //float col7 = float(1.-min_dist/max_dist - (max_dist-min_dist));
  //float col9 = float((max_dist-min_dist-sin(min_dist))*100.0);
  //float col10 = float(min_dist-(sin(max_dist)));
  //float col14 = float((0.5+0.5*sin((max_dist-min_dist-sin(min_dist))*20.0)));

  float m1 = mix(col1, col2, .5+.2*sin(iTime*0.7));
  float m2 = mix(col3, col4, .5+.2*sin(iTime*1.3));
  float m3 = mix(col5, col6, .5+.2*sin(iTime*1.9));
  float m4 = mix(col4, m2, m3);
   
  vec3 col7 = vec3(m4,m3,m2);
  vec3 col8 = vec3(m2,m4,m1);
  vec3 col9 = vec3(m1,m2,m3);
  
  vec3 col10 = mix(col7, col8, col7);
  vec3 col = col10;
  
  //float line = 1./(iResolution.y/mashtab); // добавляет сетку для наглядности
  //col += vec3(1.,0.,0.)*float(f_st.x<line||f_st.y<line); 
  fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'tlcBDs';
  }
  name(): string {
    return 'Cellular noise collection';
  }
  sort() {
    return 25;
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
