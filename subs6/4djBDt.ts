import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
uniform bool u_auto;
uniform float u_filter;

#define THRESHOLD .5 // edge threshold
#define LEVELS 10    // number of posterization levels
#define RADIUS 5     // kuwahara window 

/*
 * Posterization is the result of reducing the number of colors 
 * in an image. I.e., if you try to view a 24-bit color image in
 * and old 16 color CRT monitor the screen will render a 
 * "posterized" version of the image 
 * http://www.cs.umb.edu/~jreyes/csit114-fall-2007/project4/filters.html#posterize
 */
vec3 posterize(vec3 c)
{
    // Split up each of the color channels into ranges
    float range = 1./float(LEVELS);
    float colors[LEVELS];
    
    // Assign each range to a specified value 
    // For now set it to the mean
    for(int i=0; i<LEVELS;i++) {
        colors[i] = ((float(i)*range)+(float(i+1)*range))/2.;
    }
    
    ivec3 v = ivec3(int(floor(c.r/range)),
                    int(floor(c.g/range)),
                    int(floor(c.b/range)));
    
    
	c.r=colors[v.x];
    c.g=colors[v.y];
    c.b=colors[v.z];
    
    //c = floor(c * float(LEVELS))/float(LEVELS);;
  
    return c; 
}

/*
 * Sobel operator:
 * Convolve image with horizontal and vertical filters
 * that calculates the image gradient (directional change in the
 * intensity or color) thereby detecting an edge 
 */
vec3 edge(vec2 uv, vec2 s) 
{   
    // Sobel convolution kernels in the horizational 
    // and vertical directions
    mat3 h = mat3(-1,-2,-1, // first col h[0]
                   0,0,0,
                   1,2,1);
     
    mat3 v = mat3(1,0,-1,
                  2,0,-2,
                  1,0,-1);
    
    // populate neighboring pixel box with neighboring pixels
    mat3 b;
    for (float i=0.; i<3.; i++) {
        for (float j=0.; j<3.; j++) {
            vec4 t = texture(iChannel0,uv + 
                             vec2((i-1.)*s.x,(1.-j)*s.y));
            b[int(i)][int(j)] = length(t); 
        }
    }

    // Convolve
    // Process can be described as "sliding the kernel over the input image"
    //   For each position of the kernel, we multiply the overlapping values 
    //   of the kernel and image together, and add up the results.
    //   This sum of products will be the value of the output image at the 
    //   point in the input image where the kernel is centered
    float gx = dot(h[0], b[0]) + dot(h[1], b[1]) + dot(h[2], b[2]);
    float gy = dot(v[0], b[0]) + dot(v[1], b[1]) + dot(v[2], b[2]);

    // magnitude of gradient
    float magnitude = clamp(sqrt((gx*gx) + (gy*gy)),0.,.9);
    
    if (magnitude >= THRESHOLD)
        return vec3(0, 0, 0);
    else
        return vec3(1, 1, 1);   
}

// helper func to find min std dev
void findMin(float s, inout float min_sigma, vec4 m, out vec4 c)
{
    if (s < min_sigma) {
        min_sigma = s;
        c = vec4(m);
    }
}

/*
 * Inspired by non-photorealistic techniques, 
 * I originally wanted to implement a 
 * watercolor/brush-stroke shader...
 * Read some things decided I maybe didn't have time
 * for that -- I found a cool kuwahara filter implementation
 * https://www.shadertoy.com/view/MsXSz4
 *  who is the source of this...not me :) 
 * https://en.wikipedia.org/wiki/Kuwahara_filter
 */
vec4 kuwahara(vec2 uv, vec2 s)
{        
    // size of region
    float size = pow(float(RADIUS + 1),2.);

    vec4 m0,m1,m2,m3,s0,s1,s2,s3;
    m0 = m1 = m2 = m3 = s0 = s1 = s2 = s3 = vec4(0.0);

    vec4 c;

    // 4 square regions with RADIUS pixels
    for (int j = -RADIUS; j <= 0; ++j)  {
        for (int i = -RADIUS; i <= 0; ++i)  {
            c = texture(iChannel0, uv + vec2(i,j) * s);
            m0 += c; // mean
            s0 += c * c; //std dev
        }
    }

    for (int j = -RADIUS; j <= 0; ++j)  {
        for (int i = 0; i <= RADIUS; ++i)  {
            c = texture(iChannel0, uv + vec2(i,j) * s);
            m1 += c;
            s1 += c * c;
        }
    }

    for (int j = 0; j <= RADIUS; ++j)  {
        for (int i = 0; i <= RADIUS; ++i)  {
            c = texture(iChannel0, uv + vec2(i,j) * s);
            m2 += c;
            s2 += c * c;
        }
    }

    for (int j = 0; j <= RADIUS; ++j)  {
        for (int i = -RADIUS; i <= 0; ++i)  {
            c = texture(iChannel0, uv + vec2(i,j) * s);
            m3 += c;
            s3 += c * c;
        }
    }
    
    // calculate mean & std dev
    m0 /= size;
    s0 = abs(s0 / size - m0 * m0);
    m1 /= size;
    s1 = abs(s1 / size - m1 * m1);
    m2 /= size;
    s2 = abs(s2 / size - m2 * m2);
    m3 /= size;
    s3 = abs(s3 / size - m3 * m3);
    
    // find min std dev 
    // set output to corresponding mean
    float min_sigma = 1e+2;   
    
    float ms = s0.r + s0.g + s0.b;
    findMin(ms,min_sigma,m0,c);
    
    ms = s1.r + s1.g + s1.b;
    findMin(ms,min_sigma,m1,c);
    
    ms = s2.r + s2.g + s2.b;
    findMin(ms,min_sigma,m2,c);
    
    ms = s3.r + s3.g + s3.b;
    findMin(ms,min_sigma,m3,c);
    
    return c;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 s = vec2(1./iResolution.x, 1./iResolution.y);
    vec3 c = texture(iChannel0, uv).xyz ;

    c = kuwahara(uv,s).xyz;  
    //c = posterize(c);
    c *= edge(uv,s);
      
    //animate -- comment out to see filters alone
    if(u_auto) {
      c = mix(texture(iChannel0, uv).xyz, c, clamp(0.5+0.5*sin(iTime), 0.,1.));
    }
    else {
      c = mix(texture(iChannel0, uv).xyz, c, u_filter);
    }
    fragColor = vec4(c,1.0);
}


`;

let gui: GUI;
const api = {
  u_auto: true,
  u_filter: 0,
};

export default class implements iSub {
  key(): string {
    return '4djBDt';
  }
  name(): string {
    return 'toon-ish shader';
  }
  sort() {
    return 633;
  }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_auto');
    gui.add(api, 'u_filter', 0, 1, 0.1);
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
    const u_auto = webglUtils.getUniformLocation(gl, program, 'u_auto');
    const u_filter = webglUtils.getUniformLocation(gl, program, 'u_filter');
    return () => {
      u_auto.uniform1i(api.u_auto ? 1 : 0);
      u_filter.uniform1f(api.u_filter);
    };
  }
  channels() {
    return [
      { type: 0, path: './textures/XdlGzH.jpg' }, //
    ];
  }
}
