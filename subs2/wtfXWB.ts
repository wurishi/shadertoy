import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `

mat3 rotX(float a)
{
    return mat3(1., 0., 0.,
                0., cos(a), sin(a),
                0., -sin(a), cos(a));
}

mat3 rotY(float a)
{
    return mat3(cos(a), 0., sin(a),
                0., 1., 0.,
                -sin(a), 0., cos(a));
}

mat3 rotZ(float a)
{
    return mat3(cos(a), sin(a), 0.,
                -sin(a), cos(a), 0.,
                0., 0., 1.);
}

void swap(inout vec3 a, inout vec3 b)
{
    vec3 temp = a;
    a = b;
    b = temp;
}

void swap(inout float a, inout float b)
{
    float temp = a;
    a = b;
    b = temp;
}

float field(vec3 p)
{
    // return max(textureLod(iChannel1, (p + p.zxy / 2.) / 70. - .4, 0.).r - .4, -(length(p.xy) - .5));
    return max(textureLod(iChannel1, p.xy / 70. - .4, 0.).r - .4, -(length(p.xy) - .5));
}

// Tri-Planar blending function. Based on an old Nvidia tutorial.
vec3 tex3D( sampler2D t, in vec3 p, in vec3 n){

    n = max(abs(n), 0.001);
    n /= dot(n, vec3(1));
    vec3 tx = texture(t, p.yz).xyz;
    vec3 ty = texture(t, p.zx).xyz;
    vec3 tz = texture(t, p.xy).xyz;

    // Textures are stored in sRGB (I think), so you have to convert them to linear space 
    // (squaring is a rough approximation) prior to working with them... or something like that. :)
    // Once the final color value is gamma corrected, you should see correct looking colors.
    return (tx*tx*n.x + ty*ty*n.y + tz*tz*n.z);
}

// Distance to a set of planes constructed to be perpendicular to the surface approximation
// plane and the intersecting sides of the tetrahedron.
// This is only used for getting a nice wireframe for the shading.
float tetrahedronPlaneDistance(vec3 p, vec3 pa, vec3 pb, vec3 pc, vec3 pd, vec4 plane)
{
    vec3 tn0 = cross(pb - pa, pc - pa);
    vec3 tn1 = cross(pb - pd, pa - pd);
    vec3 tn2 = cross(pc - pd, pb - pd);
    vec3 tn3 = cross(pa - pd, pc - pd);
    
    vec3 n = normalize(plane.xyz);

    vec3 b0 = normalize(cross(n, cross(n, tn0)));
    vec3 b1 = normalize(cross(n, cross(n, tn1)));
    vec3 b2 = normalize(cross(n, cross(n, tn2)));
    vec3 b3 = normalize(cross(n, cross(n, tn3)));
    
    vec3 c0 = p + b0 * dot(pa - p, tn0) / dot(b0, tn0);
    vec3 c1 = p + b1 * dot(pd - p, tn1) / dot(b1, tn1);
    vec3 c2 = p + b2 * dot(pd - p, tn2) / dot(b2, tn2);
    vec3 c3 = p + b3 * dot(pd - p, tn3) / dot(b3, tn3);
    
    float td0 = dot(p - c0, b0);
    float td1 = dot(p - c1, b1);
    float td2 = dot(p - c2, b2);
    float td3 = dot(p - c3, b3);
	
    return min(abs(td0), min(abs(td1), min(abs(td2), abs(td3))));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    float time = iTime + texelFetch(iChannel3, ivec2(fragCoord) & 1023, 0).r / 70.;
    vec2 uv = fragCoord / iResolution.xy * 2. - 1.;
    uv.x *= iResolution.x / iResolution.y;

    // Setup camera ray.
    
    vec3 ro = vec3(0.01, -.1, 7.0);

    ro.z += -time;

    vec3 rd = normalize(vec3(uv.xy, -1.2));

    // This time the "Bresenham"-style stepping requires a whopping 9 planes,
    // so they need to be stored in an array and can't be processed together as a single vector.
    
    const int numplanes = 9;

    vec3 ns[numplanes] = vec3[numplanes](
        vec3(1, 0, 0),
        vec3(0, 1, 0),
        vec3(0, 0, 1),
        normalize(vec3(+1, +1,  0)),
        normalize(vec3(-1, +1,  0)),
        normalize(vec3(+1,  0, +1)),
        normalize(vec3(-1,  0, +1)),
        normalize(vec3( 0, +1, +1)),
        normalize(vec3( 0, -1, +1)));

    fragColor.rgb = vec3(0);
    
    float hsq2 = sqrt(2.) / 2.;

    // Distances between planes.
    
    float slabWidths[numplanes] = float[numplanes](1., 1., 1.,
                                                   hsq2, hsq2, hsq2, hsq2, hsq2, hsq2);
    
    // Find the starting tetrahedron by reflecting a base tetrahedron
    // until it encloses the ray start point.
    
    vec3 c = floor(ro), f = ro - c;
    
    // The corners of the base tetrahedron.
    vec3 pa = vec3(0, 1, 0);
    vec3 pb = vec3(0, 0, 0);
    vec3 pc = vec3(.5, .5, 0);
    vec3 pd = vec3(.5, .5, .5);

    float s0 = abs(dot(pd, ns[2]));
    float s1 = abs(dot(pa, ns[4]));

    vec3 pcenter = (pa + pb + pc + pd) / 4.0;

    // Perform the reflections.
    for(int k = 0; k < 2; ++k)
        for(int j = 3; j < numplanes; ++j)
        {
            float dtet = dot(pcenter - .5, ns[j]);
            float d = dot(f - .5, ns[j]);

            if(sign(dtet) * sign(d) < 0.)
            {
                // The ray start point and the tetrahedron are on
                // opposite sides of this plane, so reflect the tetrahedron.
                pa -= ns[j] * dot(pa - .5, ns[j]) * 2.;
                pb -= ns[j] * dot(pb - .5, ns[j]) * 2.;
                pc -= ns[j] * dot(pc - .5, ns[j]) * 2.;
                
                // Swap one of the edges to maintain face winding orders.
                swap(pa, pb);
                
                pcenter = (pa + pb + pc + pd) / 4.0;
            }
        }

    pa += c;
    pb += c;
    pc += c;
    pd += c;

    // Ray geometry.
    
    float rod[numplanes];
    float rdd[numplanes];
    float inv[numplanes];
    float is[numplanes];

    for(int i = 0; i < numplanes; ++i)
        rod[i] = dot(ro, ns[i]);

    for(int i = 0; i < numplanes; ++i)
        rdd[i] = dot(rd, ns[i]);

    for(int i = 0; i < numplanes; ++i)
        inv[i] = slabWidths[i] / rdd[i];

    for(int i = 0; i < numplanes; ++i)
        is[i] = (floor(rod[i] / slabWidths[i]) + step(0., rdd[i]) - rod[i] / slabWidths[i]) * inv[i];

    for(int i = 0; i < numplanes; ++i)
        inv[i] = abs(inv[i]);

    float t0 = 0.;

    vec3 ps[4] = vec3[4](pa, pb, pc, pd);
    float fs[4] = float[4](field(pa), field(pb), field(pc), field(pd));

    vec4 resultPlane = vec4(0);
    float planet = 50.;

    float steps[4] = float[4](s1, s1, hsq2 / 2., s0);
    
	// Voxel traversal loop
    for(int i = min(iFrame, 0); i < 250; ++i)
    {       
        int idx = numplanes - 1;
        float t1 = is[numplanes - 1];

        // Find the next voxel step intersection distance.
        for(int j = 0; j < numplanes - 1; ++j)
        {
            if(is[j] < t1)
            {
                t1 = is[j];
                idx = j;
            }
        }

        if(fs[0] < 0. || fs[1] < 0. || fs[2] < 0. || fs[3] < 0.)
        {
            // The current tetrahedron has negative field values at it's corners, so
            // test the ray against the isosurface, approximated by a plane.

            // Solve the plane defined by the 4 isovalues at the corner of the tetrahedron, which
            // can be done by inverting a linear system.
            mat4 system = mat4(vec4(ps[0], 1), vec4(ps[1], 1), vec4(ps[2], 1), vec4(ps[3], 1));
            vec4 plane = vec4(fs[0], fs[1], fs[2], fs[3]) * inverse(system);
            
            // Intersect ray with plane.
            float t = -(dot(ro, plane.xyz) + plane.w) / dot(rd, plane.xyz);

            if(t > t0 && t < t1)
            {
                // The ray intersects the plane, and the intersection point is inside
                // the current (tetrahedral) voxel.
                resultPlane = plane;
    			planet = t;
                break;
            }
        }

        // Step to the next voxel
        is[idx] += inv[idx];

        vec3 rp = ro + rd * t1;

        // Figure out which vertex of the tetrahedron needs to be reflected.
        // This vertex will be the one furthest from the plane of reflection.
        
        int pidx;
        float md = 0.;
        for(int j = 0; j < 4; ++j)
        {
            float d = dot(ps[j] - rp, ns[idx]);
            if(abs(d) > abs(md))
            {
                md = d;
                pidx = j;
            }
        }
        
        // The vertex movement distance can only be one of 4 values, so snap
        // it to the expected value, to help improve numerical precision a bit.
        md = steps[pidx] * sign(md);

        ps[pidx] -= ns[idx] * md * 2.;

        // Take a single sample of the isofunction.
        fs[pidx] = field(ps[pidx]);

        // Undo the winding reversal caused by the vertex reflection.
        swap(ps[0], ps[1]);
        swap(fs[0], fs[1]);

        t0 = t1;
    }

    vec3 planep = ro + rd * planet;
    vec3 planen = normalize(resultPlane.xyz);

    // Shading

    float tetd = tetrahedronPlaneDistance(planep, ps[0], ps[1], ps[2], ps[3], resultPlane);
    
    vec3 col = vec3(0);
        
    if(planet < 50.)
    {
        vec3 diff = tex3D(iChannel0, planep * .5, planen) / 2.;
        
        float glow = pow(textureLod(iChannel1, (planep.xy + time * 5.) / 100., 0.).r, 8.) / 2.;
        float edge = (1. - smoothstep(.0, .01, tetd));
        
        
        col += diff * 2. * pow(textureLod(iChannel1, (planep.xy + time * 5.) / 40., 0.).r, 4.) * max(0., -planen.y);
        
    	col += diff * (dot(planen, normalize(vec3(1,-10,1))) * .4 + .5);
        
        vec3 r = reflect(rd, planen);
        
        float fr = pow(diff.b * 3., 4.) * 32. * pow(clamp(1. - dot(-rd, planen), 0., 1.), 3.);
        
        col = mix(col, textureLod(iChannel2, r.xy, 4.).rgb, fr);
    	col *= 1. - edge * .5;
        col += max(1. / (tetd * 8. + .02) * vec3(1, .7, .1) / 5. * glow * 2., 0.);
    }
    
    col = mix(vec3(1.), col, exp(-planet / 100.));

    col = (col - .48) * 1.1 + .5;
    col *= 1.5;
    
    fragColor.rgb = col;

    // Gamma
    fragColor.rgb = pow(clamp(fragColor.rgb, 0., 1.), vec3(1. / 2.2));
    fragColor.a = 1.;
}


`;

export default class implements iSub {
  key(): string {
    return 'wtfXWB';
  }
  name(): string {
    return 'Tetrahedral Voxel Traversal';
  }
  sort() {
    return 203;
  }
  webgl() {
    return WEBGL_2;
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
  channels() {
    return [
      { ...webglUtils.ROCK_TEXTURE, ...webglUtils.TEXTURE_MIPMAPS },
        webglUtils.DEFAULT_NOISE,
      //   webglUtils.ROCK_TEXTURE,
    ];
  }
}
