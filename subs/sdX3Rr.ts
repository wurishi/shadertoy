import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
float linear_activation(float edge0, float edge1, float x)
{
    return clamp((x - edge0) / (edge1 - edge0), 0.0, 1.0);
}

float rms_is_high(float rms)
{
    return linear_activation(0.0, 3.0, rms);
}

float mgr_is_high(float rms)
{
    return linear_activation(0.0, 20.0, rms);
}

// NOTE: Maps [-1, 1] to (inf, -1]
float map11to1inf(float x)
{
    return 2.0/(x+1.0) - 2.0;
}

#define T_Min 1
#define T_Prod 2
#define T_Drastic 3
#define T_SugenoWeber 4
#define T_Hamacher 5
#define T_SchweizerSklar 6
#define T_Frank 7
#define T_Yager 8
#define T_AczelAlsina 9
#define T_Dombi 10
float fuzzy_and(float a, float b, float cos_time)
{
    float result = 0.0;
    int t_norm = T_SugenoWeber;
    float p = 0.0;
    
    if(t_norm == T_Min) {
      result = min(a, b);
    }
    else if(t_norm == T_Prod) {
      result = a * b;
    }
    else if(t_norm == T_Drastic) {
      if(a == 1.0) result = b;
      else if(b == 1.0) result = a;
      else result = 0.0;
    }
    else if(t_norm == T_SugenoWeber) {
      float lambda = map11to1inf(cos_time);
      result = max(0.0, (a+b-1.0 + lambda*a*b)/(1.0+lambda));
    }
    else if(t_norm == T_Hamacher) {
      float k = map11to1inf(cos_time) + 1.0;
      result = (a*b)/(k + (1.0-k)*(a + b - a*b));
    }
    else if(t_norm == T_SchweizerSklar) {
      p = map11to1inf(cos_time) + 1.0;
      result = pow(max(0.0, pow(a,p) + pow(b,p) - 1.0), 1.0/p);
    }
    else if(t_norm == T_Frank) {
      p = map11to1inf(cos_time) + 1.0;
      result = log(1.0 + (pow(p,a) - 1.0)*(pow(p,b) - 1.0)/(p-1.0))/log(p);
    }
    else if(t_norm == T_Yager) {
      // NOTE: Numerically unstable
      p = map11to1inf(cos_time) + 1.0;
      result = max(0.0, 1.0 - pow(pow(1.0-a, p) + pow(1.0-b, p), 1.0/p));
    }
    return result;
}

vec3 heatmap(float x)
{
    float level = x*3.14159265/2.;
   
    vec3 col;
    col.r = sin(level);
    col.g = sin(level*2.);
    col.b = cos(level);
    
    return col;
}

uniform bool u_side;
uniform int u_type;

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 uv = fragCoord/iResolution.xy;

    vec3 col = vec3(0,0,0);

    vec2 ll = vec2(3,0);
    vec2 tr = vec2(0,20);

    if(u_side) {
      ll = vec2(3.5,-0.5);
      tr = vec2(-2,22);
    }

    float rms = mix(ll.x, tr.x, uv.x);
    float mgr = mix(ll.y, tr.y, uv.y);

    float rms_high = rms_is_high(rms);
    float mgr_high = mgr_is_high(mgr);
    float rms_low = 1.0 - rms_high;
    float mgr_low = 1.0 - mgr_high;

    float cos_time = cos(iTime);
    float strategies[4];
    strategies[0] = fuzzy_and(mgr_high, rms_high, cos_time);
    strategies[1] = fuzzy_and(mgr_low, rms_low, cos_time);
    strategies[2] = fuzzy_and(mgr_high, rms_low, cos_time);
    strategies[3] = fuzzy_and(mgr_low, rms_high, cos_time);

    int best_strategy = 0;
    float best_rating = 0.0;
    for(int i=0; i<4; ++i)
    {
        if(strategies[i] > best_rating)
        {
            best_rating = strategies[i];
            best_strategy = i;
        }
    }

    if(u_type == 0) {
      col.xyz = heatmap(strategies[0]);
    }
    else if(u_type == 1) {
      col.x = strategies[0];
      col.y = strategies[1];
      col.z = strategies[2];
    }
    else if(u_type == 2) {
      if(best_strategy == 0) {
        col = vec3(1.0,0.5,0.3);
      }
      else if(best_strategy == 1) {
        col = vec3(0.8,0.6,1.0);
      }
      else if(best_strategy == 2) {
        col = vec3(0.5,0.8,0.2);
      }
      else if(best_strategy == 3) {
        col = vec3(0.5,0.8,1.0);
      }
    }
    else {
      col = strategies[0]*vec3(1.0,0.5,0.3) + strategies[1]*vec3(0.8,0.6,1.0) + strategies[2]*vec3(0.5,0.8,0.2) + strategies[3]*vec3(0.5,0.8,1.0);
    }

    // Output to screen
    fragColor = vec4(col,1.0);
}
`;

let gui: GUI;
let api = {
  side: false,
  type: 0,
};

export default class implements iSub {
  key(): string {
    return 'sdX3Rr';
  }
  name(): string {
    return 'ANU - Strategic Management';
  }
  sort() {
    return 28;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'side');
    gui.add(api, 'type', [0, 1, 2, 3]);
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
    const u_side = webglUtils.getUniformLocation(gl, program, 'u_side');
    const u_type = webglUtils.getUniformLocation(gl, program, 'u_type');
    return () => {
      u_side.uniform1i(api.side ? 1 : 0);
      u_type.uniform1i(api.type);
    };
  }
}
