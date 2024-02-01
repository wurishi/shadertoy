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

float area(vec3 a,vec3 b,vec3 c)
{
   b-=a;
   c-=a;
   return length(cross(b,c))/2.;
}

float area(vec2 a,vec2 b,vec2 c)
{
   b-=a;
   c-=a;
   return (b.x*c.y-b.y*c.x)/2.;
}

// Constants
const float pi = 3.14159265358979323;
const float th = pi * 2. / 3.;

// Equilateral triangle edge length
const float edgeLength = 2. / tan(th);

// Transformations for deforming the equilateral triangle grid into
// a square grid with diagonal lines
const float th2 = -pi * .25;
const float e = edgeLength * 1.5;
const mat2 rm = mat2(cos(th2), sin(th2), -sin(th2), cos(th2));
const mat2 m = rm * mat2(1. / 2., 0., 0., e / 2.) * sqrt(2.);
const mat2 mt = (1. / sqrt(2.)) * mat2(2., 0., 0., 2. / e) * transpose(rm);

// Normals of the 3 line directions in the equilateral triangle grid.
// This is used only in UV space.
const vec2 ns[3] = vec2[3](vec2(1, 0), vec2(cos(th), sin(th)), vec2(cos(th * 2.), sin(th * 2.)));

const float maxHeight = 9.6;

// Heightfield
float sampleHeightfield(vec2 p)
{
    float h = 	textureLod(iChannel0, p / 5. + p.y, 4.).b *
    			textureLod(iChannel1, p / 60., 2.).g * 1.6;
    
    return clamp(h, 0., 1. - 1e-4) * maxHeight;
}

// Vertex deformation
vec3 mapVertex(vec2 uv)
{
    vec3 v = vec3(uv.x, sampleHeightfield(uv), uv.y);
    v.x += cos(v.x / 2. + iTime) * .4;
    v.z += cos(v.z / 2. + iTime) * .4;
    v.xz += cos(v.z * 2. + iTime) * .4;
    v.x += cos(v.z / 3. + iTime) * .2;
    return v;
}

bool pointIsInTriangle(vec2 p, vec2 ta, vec2 tb, vec2 tc)
{
    float alpha = area(ta, tb, p);
    float beta = area(tb, tc, p);
    float gamma = area(tc, ta, p);

    float area = alpha + beta + gamma;

    if(area < 0.)
        return false;

    return alpha > 0. && beta > 0. && gamma > 0.;
}

// The raytracing function.
float trace(vec3 ro, vec3 rd, out vec3 triNorm, out vec3 bary)
{
    vec3 oro = ro;
    
    float mint = (maxHeight * step(rd.y, 0.) - ro.y) / rd.y;

    // Move ray start to bounding slab of heightfield.
    ro += rd * max(0., mint);

    // Determine the starting triangle by transforming the XZ
    // plane triangular grid to a square grid with diagonal cuts at each square,
    // then transforming the closet corners in that square grid back again.
    
    // This is done in a (somewhat large) neighbourhood around the query point
    // so that all the likely candidate deformed triangles can be included.
    
    vec2 u = m * ro.xz;
    
    vec2 tri0, tri1, tri2;
    vec2 uv0, uv1, uv2;
    bool notFound = true;

    for(int y = -2; y <= +2 && notFound; ++y)
	    for(int x = -2; x <= +2; ++x)
        {
    		vec2 cu = floor(u) + vec2(x, y);
            
            uv0 = mt * cu;
            tri0 = mapVertex(uv0).xz;

            uv1 = mt * (cu + vec2(1, 1));
            uv2 = mt * (cu + vec2(1, 0));
            
            tri1 = mapVertex(uv1).xz;
            tri2 = mapVertex(uv2).xz;

            if(pointIsInTriangle(ro.xz, tri0, tri1, tri2))
            {
                notFound = false;
                break;
            }
            
            uv1 = mt * (cu + vec2(0, 1));
            uv2 = mt * (cu + vec2(1, 1));
            
            tri1 = mapVertex(uv1).xz;
            tri2 = mapVertex(uv2).xz;

            if(pointIsInTriangle(ro.xz, tri0, tri1, tri2))
            {
                notFound = false;
                break;
            }
		}

    vec3 triangle[3];
    vec2 triangleUV[3];

    // Sort the triangle corners so that the corner at index N is opposite
    // to the triangle edge coincident to grid line normal at index N.
    for(int j = 0; j < 3; ++j)
    {
        float d0 = abs(dot(uv1 - uv0, ns[j]));
        float d1 = abs(dot(uv2 - uv1, ns[j]));
        float d2 = abs(dot(uv0 - uv2, ns[j]));

        triangleUV[j] = uv1;

        if(d0 < d1)
        {
            if(d0 < d2)
        		triangleUV[j] = uv2;
        }
        else if(d1 < d2)
        	triangleUV[j] = uv0;
        
        triangle[j] = mapVertex(triangleUV[j]);
    }

    float t0 = 0., t1, t = -1.;
        
    float maxt = (maxHeight * step(0., rd.y) - ro.y) / rd.y;
    
    triNorm = vec3(0);
    
    // The ray stepping loop
    // "min(iFrame, 0)" is used here to prevent complete unrolling of the loop (which
    // causes the compiler to take forever on OpenGL).
    for(int i = min(iFrame, 0); i < 200; ++i)
    {       
        // Determine which triangle edge has the next closest intersection, and get the index
        // of the triangle corner which is opposite to the edge coincident with that line.

        // Note that the edge index (idx) calculated in the previous step
        // can be used to skip one of the intersection tests, but I haven't done that yet.
        
        vec2 ns2[3] = vec2[3](	vec2(triangle[2].z - triangle[1].z, triangle[1].x - triangle[2].x),
                            	vec2(triangle[0].z - triangle[2].z, triangle[2].x - triangle[0].x),
                            	vec2(triangle[1].z - triangle[0].z, triangle[0].x - triangle[1].x));
        vec3 is;
                
        // Edge intersection distances
        is.x = dot(triangle[2].xz - ro.xz, ns2[0]) / dot(rd.xz, ns2[0]);
        is.y = dot(triangle[0].xz - ro.xz, ns2[1]) / dot(rd.xz, ns2[1]);
        is.z = dot(triangle[1].xz - ro.xz, ns2[2]) / dot(rd.xz, ns2[2]);
        
        if(dot(rd.xz, ns2[0]) < 0.)
            is.x = 1e9;
        
        if(dot(rd.xz, ns2[1]) < 0.)
            is.y = 1e9;
        
        if(dot(rd.xz, ns2[2]) < 0.)
            is.z = 1e9;
        
        int idx = 2;
        t1 = is.z;

        if(is.x < is.y)
        {
            if(is.x < is.z)
            {
                idx = 0;
                t1 = is.x;
            }
        }
        else if(is.y < is.z)
        {
        	idx = 1;
            t1 = is.y;
        }
        
        // Intersect ray with triangle. Actually this is just a ray-versus-plane
        // intersection, because the intersection point is already bounded by t0 and t1.
        triNorm = cross(triangle[2] - triangle[0], triangle[1] - triangle[0]);
        t = dot(triangle[0] - ro, triNorm) / dot(rd, triNorm);

        if(t > t0 && t < t1)
            break;
        
		if(t1 > maxt)
        	return 1e5;
        
        int idx1 = (idx + 1) % 3, idx2 = (idx + 2) % 3;
        
        // Mirror the UV triangle aross this grid line (which is coincident with
        // the edge opposite the triangle corner being moved here). This reverses
        // the winding.
        triangleUV[idx] -= 2. * ns[idx] * sign(dot(triangleUV[idx] - triangleUV[idx1], ns[idx]));
        
        // Take a single sample of the mesh using the newly-calculated UV corner.
        triangle[idx] = mapVertex(triangleUV[idx]);
        
        // Swap the other two corners, to maintain correspondence between triangle
        // corners and opposite edge lines. This also has the effect of reversing the winding
        // a second time, so all of the constructed triangles in fact have the same winding order.
        {
            vec3 temp = triangle[idx1];
            triangle[idx1] = triangle[idx2];
            triangle[idx2] = temp;
        }

        // Also swap the UV corners to maintain consistency.
        {
            vec2 temp = triangleUV[idx1];
            triangleUV[idx1] = triangleUV[idx2];
            triangleUV[idx2] = temp;
        }

        t0 = t1;
    }
    
    // Return the final intersection information.
    
    triNorm = normalize(triNorm);

    vec3 rp = ro + rd * t;
    
    // Get the barycentric coordinates.
    
    float alpha = area(triangle[0], triangle[1], rp);
    float beta = area(triangle[1], triangle[2], rp);
    float gamma = area(triangle[2], triangle[0], rp);

    float area = alpha + beta + gamma;

    bary = vec3(alpha, beta, gamma) / area;

    return distance(oro, rp);
}

// Ray direction function
vec3 rfunc(vec2 uv)
{
    vec3 r = normalize(vec3(uv.xy, -1.4));
    mat3 m = rotX(-.75);
    return m * r;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec3 col = vec3(0);

    vec2 uv = fragCoord / iResolution.xy * 2. - 1.;    
    uv.x *= iResolution.x / iResolution.y;

    // Setup primary ray.
    vec3 o = vec3(cos(iTime / 4.) * 4.*0., 10., -iTime), r = rfunc(uv);
    
    vec3 triNorm, bary;
    float t = trace(o, r, triNorm, bary);
    
    vec3 n = triNorm;

    vec3 rp = o + r * t;
    vec3 ld = normalize(vec3(10, 6, 3));
    
    // Directional light
	col = vec3(max(0., dot(triNorm, ld))) * .8;
                
    // Shadow
    float st = trace(rp + ld * 1e-2, ld, triNorm, triNorm);
    if(st > 1e-2 && st < 1e3)
		col *= .1;
    
    // Ambient light
    col += max(0., n.y) * vec3(.2);
    
    col *= sin(-(rp.y - 58.5) * vec3(1.2,1.2,1.5)/3.)*.47+.5;
    col *= 1.5;
    
    float w = t / 800. + pow(max(0., 1. - dot(-r, n)), 4.) * .2;
    col *= mix(2., 1., smoothstep(.02 - w, .02 + w, min(bary.x, min(bary.y, bary.z))));

    col += textureLod(iChannel2, reflect(r, n).xy, 3.5).rgb * .5 * max(0., n.y) *
        	clamp(1. - dot(-r, n), 0., 1.);
    
    // Fog
    col = mix(vec3(.5, .5, 1.), col, exp2(-t / 300.));
    
    // Clamp and gamma-correct
    fragColor = vec4(pow(clamp(col, 0., 1.), vec3(1. / 2.2)), 1.0);
}

`;

export default class implements iSub {
  key(): string {
    return 'ttsSzX';
  }
  name(): string {
    return 'Triangulated Heightfield Trick 3';
  }
  sort() {
    return 291;
  }
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
      { ...webglUtils.ROCK_TEXTURE, ...webglUtils.TEXTURE_MIPMAPS }, //
      { ...webglUtils.WOOD_TEXTURE, ...webglUtils.TEXTURE_MIPMAPS },
      webglUtils.WOOD_TEXTURE, // 背光颜色
    ];
  }
}
