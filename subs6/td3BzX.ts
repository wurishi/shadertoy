import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
#define SHARPEN_FACTOR 16.0

vec4 sharpenMask (sampler2D tex, vec2 fragCoord)
{
    // Sharpen detection matrix [0,1,0],[1,-4,1],[0,1,0]
    // Colors
    vec4 up = texture (tex, (fragCoord + vec2 (0, 1))/iResolution.xy);
    vec4 left = texture (tex, (fragCoord + vec2 (-1, 0))/iResolution.xy);
    vec4 center = texture (tex, fragCoord/iResolution.xy);
    vec4 right = texture (tex, (fragCoord + vec2 (1, 0))/iResolution.xy);
    vec4 down = texture (tex, (fragCoord + vec2 (0, -1))/iResolution.xy);

    // Return edge detection
    return (1.0 + 4.0*SHARPEN_FACTOR)*center -SHARPEN_FACTOR*(up + left + right + down);
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    

    vec2 uv = fragCoord / iResolution.xy;
    vec4 c = texture(iChannel3, uv);

    vec2 d = 1.0 / iChannelResolution[0].xy;
    

    vec4 u = (
             -1.0 * texture(iChannel3, uv + vec2(-d.x, -d.y)) +
             -2.0 * texture(iChannel3, uv + vec2(-d.x,  0.0)) + 
             -1.0 * texture(iChannel3, uv + vec2(-d.x,  d.y)) +
             +1.0 * texture(iChannel3, uv + vec2( d.x, -d.y)) +
             +2.0 * texture(iChannel3, uv + vec2( d.x,  0.0)) + 
             +1.0 * texture(iChannel3, uv + vec2( d.x,  d.y))
             ) / 4.0;

    vec4 v = (
             -1.0 * texture(iChannel3, uv + vec2(-d.x, -d.y)) + 
             -2.0 * texture(iChannel3, uv + vec2( 0.0, -d.y)) + 
             -1.0 * texture(iChannel3, uv + vec2( d.x, -d.y)) +
             +1.0 * texture(iChannel3, uv + vec2(-d.x,  d.y)) +
             +2.0 * texture(iChannel3, uv + vec2( 0.0,  d.y)) + 
             +1.0 * texture(iChannel3, uv + vec2( d.x,  d.y))
             ) / 4.0;

    fragColor = vec4(vec3(dot(u.xyz, u.xyz), 
                             dot(v.xyz, v.xyz), 
                             dot(u.xyz, v.xyz)), 1.0);
    
    //fragColor = sharpenMask (iChannel3 , fragCoord);
}


`;

const buffB = `
#ifdef GL_ES
precision mediump float;
#endif

float normpdf(in float x, in float sigma)
{
	return 0.39894*exp(-0.5*x*x/(sigma*sigma))/sigma;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec3 c = texture(iChannel0, fragCoord.xy / iResolution.xy).rgb;
    vec3 sum = vec3(0.0);
	
		//declare stuff
		const int mSize = 10;
		const int kSize = (mSize-1)/2;
		float kernel[mSize];
		
		
		//create the 1-D kernel
		float sigma = 5.0;
		float Z = 0.0;
		for (int j = 0; j <= kSize; ++j)
		{
			kernel[kSize+j] = kernel[kSize-j] = normpdf(float(j), sigma);
		}
		
		//get the normalization factor (as the gaussian has been clamped)
		for (int j = 0; j < mSize; ++j)
		{
			Z += kernel[j];
		}
		
		//read out the texels
		for (int i=-kSize; i <= kSize; ++i)
		{
			for (int j=-kSize; j <= kSize; ++j)
			{
				sum += kernel[kSize+j]*kernel[kSize+i]*texture(iChannel0, (fragCoord.xy+vec2(float(i),float(j))) / iResolution.xy).rgb;
	
			}
		}
		
		
		sum = sum/(Z*Z);
	
    float lambda1 = 0.5 * (sum.y + sum.x +
        sqrt(sum.y*sum.y - 2.0*sum.x*sum.y + sum.x*sum.x + 4.0*sum.z*sum.z));
    float lambda2 = 0.5 * (sum.y + sum.x -
        sqrt(sum.y*sum.y - 2.0*sum.x*sum.y + sum.x*sum.x + 4.0*sum.z*sum.z));

    vec2 v = vec2(lambda1 - sum.x, -sum.z);
    vec2 t;
    if (length(v) > 0.0) { 
        t = normalize(v);
    } else {
        t = vec2(0.0, 1.0);
    }

    float phi = atan(t.y, t.x);

    float A = (lambda1 + lambda2 > 0.0)?
        (lambda1 - lambda2) / (lambda1 + lambda2) : 0.0;

    fragColor = vec4(t, phi, A);
    fragColor.a = 1.;
}

`;

const buffC = `
float radius = 15.0;
float q  = 12.0;
float alpha = 5.0;

const float PI = 3.14159265358979323846;
//const int N = 8;

//const float sigma_r = 0.5;

//const float sigma_r2 = sigma_r * sigma_r;

void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    vec2 src_size = vec2(textureSize(iChannel3, 0));
    vec2 uv = fragCoord.xy / iResolution.xy;

    vec4 m[4];
    vec3 s[4];
    for (int k = 0; k < 4; ++k) {
        m[k] = vec4(0.0);
        s[k] = vec3(0.0);
    }

    float piN = 2.0 * PI / float(4);
    mat2 X = mat2(cos(piN), sin(piN), -sin(piN), cos(piN));

    vec4 t = texture(iChannel1, uv);
    
    float a = radius * clamp((alpha + t.w) / alpha, 0.1, 2.0); 
    float b = radius * clamp(alpha / (alpha + t.w), 0.1, 2.0);

    float cos_phi = cos(t.z);
    float sin_phi = sin(t.z);

    //mat2 R = mat2(cos_phi, -sin_phi, sin_phi, cos_phi);
    //mat2 S = mat2(1.0/a, 0.0, 0.0, 1.0/b);
    //mat2 SR = S * R;
    mat2 SR = mat2(cos_phi/a, -sin_phi/b, sin_phi/a, cos_phi/b); 

    int max_x = int(sqrt(a*a * cos_phi*cos_phi +
                          b*b * sin_phi*sin_phi));
    int max_y = int(sqrt(a*a * sin_phi*sin_phi +
                          b*b * cos_phi*cos_phi));

    for (int j = 0; j <= max_y; ++j)  {
        for (int i = -max_x; i <= max_x; ++i) {
            if ((j !=0) || (i > 0)) {
                vec2 v = SR * vec2(float(i),float(j));
                float dot_v = dot(v,v);
                if (dot_v <= 0.99-0.98*iMouse.x/(iResolution.x)) {
                    vec4 c0_fix = texture(iChannel3, uv + vec2(i,j) / iResolution.xy);
                    vec3 c0 = c0_fix.rgb;
                    vec4 c1_fix = texture(iChannel3, uv - vec2(i,j) / iResolution.xy);
                    vec3 c1 = c1_fix.rgb;

                    vec3 cc0 = c0 * c0;
                    vec3 cc1 = c1 * c1;

                    float n = 0.0;
                    float wx[4];
                    /*
                    for(int k = 0; k < 4; ++k) {
                        //float z = (v.y + 0.5) - (1.0 * v.x * v.x);
                        //wx[k] = step(0.0, z)*z*z;
                        float z = max(0, (v.y + 0.5) - (1.0 * v.x * v.x));
                        wx[k] = z * z;
                        n += wx[k];
                        v *= X;
                    }
                    */
                    {
                        float z;
                        float xx = 0.33 - 0.84 * v.x * v.x;
                        float yy = 0.33 - 0.84 * v.y * v.y;

                        z = max(0.0, v.y + xx);
                        n += wx[0] = z * z;

                        z = max(0.0, -v.x + yy);
                        n += wx[1] = z * z;

                        z = max(0.0, -v.y + xx);
                        n += wx[2] = z * z;

                        z = max(0.0, v.x + yy);
                        n += wx[3] = z * z;
                    }
                
                    float g = exp(-3.125 * dot_v) / n;

                    for (int k = 0; k < 4; ++k) {
                        float w = wx[k] * g;
                        m[k] += vec4(c0 * w, w);
                        s[k] += cc0 * w;
                        m[(k+2)&3] += vec4(c1 * w, w);
                        s[(k+2)&3] += cc1 * w;
                    }
                }
            }
        }
    }

    vec4 o = vec4(0.0);
    for (int k = 0; k < 4; ++k) {
        m[k].rgb /= m[k].w;
        s[k] = abs(s[k] / m[k].w - m[k].rgb * m[k].rgb);

        float sigma2 = sqrt(s[k].r) + sqrt(s[k].g) + sqrt(s[k].b);
        float w = 1.0 / (1.0 + pow(255.0 * sigma2, q));
        o += vec4(m[k].rgb * w, w);
    }

    fragColor = vec4(o.rgb / o.w, 1.0);
    fragColor.a = 1.;
}
`;

const fragment = `
#define img_size iResolution.xy

float sigma = 2.;

struct lic_t { 
    vec2 p; 
    vec2 t;
    float w;
    float dw;
};

void step2(inout lic_t s) {
    vec2 t = texture(iChannel1, s.p).xy;
    if (dot(t, s.t) < 0.0) t = -t;
    s.t = t;

    s.dw = (abs(t.x) > abs(t.y))? 
        abs((fract(s.p.x) - 0.5 - sign(t.x)) / t.x) : 
        abs((fract(s.p.y) - 0.5 - sign(t.y)) / t.y);

    s.p += t * s.dw / img_size;
    s.w += s.dw;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    float twoSigma2 = 2.0 * sigma * sigma;
    float halfWidth = 2.0 * sigma;
    vec2 uv = fragCoord.xy / img_size;

    vec3 c = texture( iChannel2, uv ).xyz;
    float w = 1.0;

    lic_t a, b;
    a.p = b.p = uv;
    a.t = texture( iChannel1, uv ).xy / img_size;
    b.t = -a.t;
    a.w = b.w = 0.0;

    while (a.w < halfWidth) {
        step2(a);
        float k = a.dw * exp(-a.w * a.w / twoSigma2);
        c += k * texture(iChannel2, a.p).xyz;
        w += k;
    }
    while (b.w < halfWidth) {
        step2(b);
        float k = b.dw * exp(-b.w * b.w / twoSigma2);
        c += k * texture(iChannel2, b.p).xyz;
        w += k;
    }
    c /= w;

    fragColor = 1.05*vec4(c, 1.0);
    fragColor.a = 1.;
    //fragColor = mix(texture( iChannel1, uv ) , texture( iChannel2, uv ) , 0.);
}
`;

export default class implements iSub {
  key(): string {
    return 'td3BzX';
  }
  name(): string {
    return 'Anisotropic Kuwahara filtering';
  }
  // sort() {
  //   return 0;
  // }
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
      { type: 1, f: buffA, fi: 0 },
      { type: 1, f: buffB, fi: 1 },
      { type: 1, f: buffC, fi: 2 },
      { type: 0, path: './textures/XdlGzH.jpg' }, //
    ];
  }
}
