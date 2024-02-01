import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
/* Wythoff construction demo, by mattz.
   License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

   Mouse rotates (or click in bottom left for auto-rotate).

   Keys do things:

     D - toggle demo mode (no other keys work until you leave demo mode)

     S - toggle sphere
     C - toggle color scheme
     T - toggle triangle visualizations

     1,2 - toggle bits of first angle divisor (p)
     3,4 - toggle bits of second angle divisor (q)
     5,6 - toggle bits of third angle divisor (r)
     7,8 - toggle bits of pipe location

   Much of the code below could be simplified. There's probably a lot
   of unnecessary normalization going on, for instance.

   Also note the distance function only goes to the OUTSIDE of the
   polyhedron, it is not a proper signed distance function (alas!)

   Here are some helpful links that I used to learn about the math:

     https://en.wikipedia.org/wiki/Wythoff_construction
     http://www.gregegan.net/APPLETS/26/WythoffNotes.html
     https://en.wikipedia.org/wiki/Spherical_polyhedron
     https://en.wikipedia.org/wiki/List_of_uniform_polyhedra_by_Wythoff_symbol

   Nope, I haven't yet figured out how to make snub polyhedra (type
   4?) or the non-convex (star-like) uniform polyhedra yet. 

   I also never figured out how to antialias the edges of my raymarched shapes. Someday.

   Tweet @matt_zucker with suggestions/comments/questions.

*/

// Here are some Wythoff symbols for well-known polyhedra:
#define WS_TET   vec4(3,2,3,0) // Tetrahedron
#define WS_OCT   vec4(4,2,3,0) // Octahedron
#define WS_CUBE  vec4(3,2,4,0) // Cube
#define WS_IKE   vec4(5,2,3,0) // Icosahedron
#define WS_DOE   vec4(3,2,5,0) // Dodecahedron
#define WS_CO    vec4(2,3,4,0) // Cuboctahedron
#define WS_ID    vec4(2,3,5,0) // Icosidodecahedron
#define WS_TUT   vec4(2,3,3,1) // Truncated tetrahedron
#define WS_TOE   vec4(2,4,3,1) // Truncated octahedron
#define WS_TIC   vec4(2,3,4,1) // Truncated cube
#define WS_TI    vec4(2,5,3,1) // Truncated icosahedron 
#define WS_TID   vec4(2,3,5,1) // Truncated dodecahedron
#define WS_SIRCO vec4(3,4,2,1) // Rhombicuboctahedron
#define WS_SRID  vec4(3,5,2,1) // Rhombicosidodecahedron
#define WS_GIRCO vec4(2,3,4,2) // Truncated cuboctahedron
#define WS_GRID  vec4(2,3,5,2) // Truncated icosidodecahedron

// Symbol of polyhedron to render.
vec4 wythoff_symbol = WS_IKE;

//////////////////////////////////////////////////////////////////////
// Toggles for display:

float demo_mode = 1.0;
float color_by_face = 1.0;
float show_triangles = 0.0;
float sphericity = 0.0;

// Demo also scales up/down object
float scale = 1.0;

//////////////////////////////////////////////////////////////////////
// Keys and other handy constants:

const float KEY_C = 67.5/256.0;
const float KEY_D = 68.5/256.0;
const float KEY_R = 82.5/256.0; 
const float KEY_S = 83.5/256.0;
const float KEY_T = 84.5/256.0;

const float KEY_1 = 49.5/256.0;
const float KEY_2 = 50.5/256.0;
const float KEY_3 = 51.5/256.0;
const float KEY_4 = 52.5/256.0;
const float KEY_5 = 53.5/256.0;
const float KEY_6 = 54.5/256.0;
const float KEY_7 = 55.5/256.0;
const float KEY_8 = 56.5/256.0;

const float pi = 3.141592653589793;

const float farval = 1e5;

const vec3 bg_color = vec3(0.9);

const mat3 basic_palette = mat3(vec3(1,1,0),
                                vec3(1,0,0),
                                vec3(0,0,1));

// Light vector
vec3 L = normalize(vec3(1.0, 0.5, 2.0));

//////////////////////////////////////////////////////////////////////
// Compare key state to default

float key_state(float key, float default_state) {
    return abs( texture(iChannel0, vec2(key, 0.75)).x - default_state );
}

//////////////////////////////////////////////////////////////////////
// Axis-aligned rotations

mat3 rot_x(in float t) {
    float cx = cos(t), sx = sin(t);
    return mat3(1., 0, 0, 
                0, cx, sx,
                0, -sx, cx);
}

mat3 rot_y(in float t) {
    float cy = cos(t), sy = sin(t);
    return mat3(cy, 0, -sy,
                0, 1., 0,
                sy, 0, cy);
}

mat3 rot_z(in float t) {
    float cz = cos(t), sz = sin(t);
    return mat3(cz, -sz, 0.,
                sz, cz, 0.,
                0., 0., 1.);
}

//////////////////////////////////////////////////////////////////////
// Constructs a spherical triangle from angle divisors p,q,r. The
// three great circles will meet at angles pi/p, pi/q, pi/r.
//
// Great circles are represented as unit vectors corresponding to
// their antipode. For instance, the great circle along the xy plane
// is simply the vector (0, 0, 1).
//
// Everything you ever want to do with points and lines on spheres
// boils down to dot products and cross products.
//
// If two great circles l1 and l2 meet at an angle theta, then
//
//   dot(l1, l2) = -cos(theta) = cos(pi - theta)
//
// So if the great circles are perpendicular, dot(l1, l2) = 0. And if
// a unit vector v lies on a great circle l, then dot(l, v) = 0, too.
//
// This returns tri, a matrix of great circles. If a point v is inside
// the triangle, then dot(tri[i], p) > 0 for all i.

mat3 construct_tri(in vec3 pqr) {

    // take pi/p, pi/q, pi/r
    vec3 angles = pi/pqr;

    // get cosines
    vec3 c = cos(angles);

    // only need sin(pi/p)
    float sp = sin(angles.x);

    // We want to construct three great circles l1, l2, l3 with the
    // following properties:
    //
    //   dot(l1, l2) = -cp
    //   dot(l2, l3) = -cq
    //   dot(l3, l1) = -cr

    // Without loss of generality we can fix one great circle at (1, 0, 0):
    vec3 l1 = vec3(1, 0, 0);

    // The next one is simply rotated by pi/p radians along the z axis:
    vec3 l2 = vec3(-c.x, sp, 0);

    // Now we need to solve a linear system:
    //
    //   dot(l3, l1) = x3*1 + y3*0 + z3*0 = x3 = -cr
    //   dot(l3, l2) = -x3*cp + y3*sp + z3*0 = -cq
    //
    // Substituting 1 into 2, we get cr*cp + y3*sp = -cq, which means
    // y3 = -(cq + cr*cp)/sp
    float x3 = -c.z;
    float y3 = -(c.y + c.x*c.z)/sp;

    // z3 is chosen to make sure that l3 is a unit vector
    float z3 = sqrt(1.0 - x3*x3 - y3*y3);
    
    vec3 l3 = vec3(x3, y3, z3);

    // Now we have all our great circles
    return mat3(l1, l2, l3);
    
}

//////////////////////////////////////////////////////////////////////
// This ridiculously handy function helps us solve a bunch of problems
// thanks to point-line duality:
//
//   - it constructs one of the two points of intersection of the
//     great circles a & b
//
//   - it constructs the great circle passing through the unit vectors
//     a & b on the sphere
//
//   - it constructs the altitude from a point a to line b, or from a
//     line a to a point b.

vec3 intersect(vec3 a, vec3 b) {
    return normalize(cross(a, b));
}

//////////////////////////////////////////////////////////////////////
// Constructs the great circle bisecting the angle formed by two great
// circles l1 and l2.

vec3 bisect(vec3 l1, vec3 l2) {
    return intersect(cross(l1, l2), 0.5*(l1+l2));
}

//////////////////////////////////////////////////////////////////////
// Given a spherical triangle and a point x on a sphere, this
// repeatedly mirrors x along edges of the triangle until it lands
// inside.
//
// When I started this project, I thought I was going to have to
// mirror the triangle until it landed on the point, but it turns out,
// with all of the cross products flying around, that you have to
// track the parity (even or odd) if you flip the triangle, and it
// proved to be too much bookkeeping.
//
// Frankly, I'm not exactly sure why this works, or why 15 flips is
// the magic number that gets every point inside the destination
// triangle.
//
// I'm probably going to make another shader at some point to try to
// understand why this converges. 
//
// Upon return: the point x is inside the triangle, and the matrix M
// holds the product of all mirror transformations. Its determinant
// (not actually used anywhere except for visualization) is -1 for odd
// number of flips, +1 for even.

void flip_into_tri(in mat3 tri,
                   inout vec3 x,
                   out mat3 M) {
    
    // d holds signs of point/edge decisions for each edge of the triangle.
    // if its components are all non-negative, we win.
    vec3 d = x * tri; 

    // initialize M as the identity transformation
    M = mat3(1.0);

    // 5 iterations is the magic number
    for (int k=0; k<5; ++k) {    

        // if inside already, quit flippin'
        if (min(d[0], min(d[1], d[2])) >= 0.0) { break; }

        // for each edge of the triangle
        for (int j=0; j<3; ++j) {

            // if we are "outside" this edge
            if (d[j] < 0.0) {

                // flip along this edge
                vec3 tj = tri[j];                

                // update M by flipping each column
                M = mat3(reflect(M[0], tj),
                         reflect(M[1], tj),
                         reflect(M[2], tj));

                // reflect x
                x = reflect(x, tj);

                // update d
                d = x * tri;
                
            }
        }
    }
    
}

//////////////////////////////////////////////////////////////////////
// Precondition: we have flipped point x into the triangle. Now we do
// the meat of the Wythoff construction method. First, we choose a
// vertex, tri_vert, inside the triangle, according to the type of
// triangle:
//
//    p | q r : the vertex is placed at point P
//
//    p q | r : the vertex is placed at the point on PQ that bisects
//              the angle at R
//
//    p q r | : the vertex is placed at the incenter (intersection of
//              bisectors)
//
// Then from the given vertex, we drop altitudes to one or more edges
// of the triangle. Those altitudes will correspond the edges of our
// polyhedron, and the vertex itself will become a polyhedron vertex.
//
// Once the point and altitudes are constructed, we need to classify x
// as being in one of up to three possible regions (corresponding to
// red, yellow, and blue in the simple color display) created by
// splitting the triangle along the altitudes.
//
// In addition to which of the three regions we are selecting (encoded
// as a one-hot vec3), we also compute the normal point (the triangle
// vertex corresponding to that region), and the great circle
// corresponding to the closest polyhedron edge.
//
// The dot product between x and edge may be positive or negative.

void check_domain(in mat3 tri,
                  in vec3 x,
                  in float type,
                  out vec3 tri_vert,
                  out vec3 tri_region,
                  out vec3 face_normal,
                  out vec3 edge) {
        
    // Construct the three triangle vertices
    vec3 p0 = intersect(tri[1], tri[2]); // Q
    vec3 p1 = intersect(tri[2], tri[0]); // R
    vec3 p2 = intersect(tri[0], tri[1]); // P
     

    // Place vertex for each type
    if (type == 0.0) {
        
        // Place the vertex at P
        tri_vert = p2;
        
    } else { 
        
        // Bisect the angle at R
        vec3 l_b1 = bisect(tri[2], tri[0]);

        if (type == 1.0) {

            // Get the intersection with edge PQ
        	tri_vert = intersect(l_b1, tri[1]);
        
        } else {
        
            // Place the vertex at the incenter
            vec3 l_b2 = bisect(tri[0], tri[1]);
            tri_vert = intersect(l_b1, l_b2);
            
        }
        
    }
        
    // In the worst case we will have to look at all three
    // altitudes, so we might as well construct them now.
    vec3 l_a0 = intersect(tri_vert, tri[0]);
    vec3 l_a1 = intersect(tri_vert, tri[1]);
    vec3 l_a2 = intersect(tri_vert, tri[2]);

    // The altitudes were constructed so they all wind the same
    // direction around the point p. That gives the code below
    // some nice symmetry:
    float d0 = dot(x, l_a0);
    float d1 = dot(x, l_a1);
    float d2 = dot(x, l_a2);

    if (d1 < 0.0 && d2 >= 0.0) {
        tri_region = vec3(1.0, 0, 0);
        edge = abs(d1) < abs(d2) ? l_a1 : l_a2;
    } else if (d2 < 0.0 && d0 >= 0.0) {
        tri_region = vec3(0, 1.0, 0);
        edge = abs(d2) < abs(d0) ? l_a2 : l_a0;
    } else {
        tri_region = vec3(0, 0, 1.0);
        edge = abs(d0) < abs(d1) ? l_a0 : l_a1;
    }

    // Once we know the region, the polyhedron face normal is just the
    // corresponding vertex P, Q, or R.
    face_normal = mat3(p0, p1, p2) * tri_region;
        
}

//////////////////////////////////////////////////////////////////////
// Wrapper function for the functions above. Four main steps:
//
//   1) construct the spherical triangle
//   2) flip the point x until it lies inside
//   3) figure out what region of the triangle x is in
//   4) clean up by mapping the triangle vertex, normal, and edge
//      through the inverse of the transform that x underwent

void wythoff(in vec4 wythoff_symbol, 
             in vec3 x,
             out mat3 tri,
             out mat3 M,
             out vec3 tri_vert,
             out vec3 tri_region,
             out vec3 face_normal,
             out vec3 edge) {

    vec3 pqr = wythoff_symbol.xyz;
    float type = wythoff_symbol.w;

    // step 1
    tri = construct_tri(pqr);

    // step 2
    flip_into_tri(tri, x, M);

    // step 3
    check_domain(tri, x, type, tri_vert, tri_region, face_normal, edge);

    // step 4
    face_normal = face_normal * M;
    tri_vert = tri_vert * M;
    edge = edge * M;
    
}

//////////////////////////////////////////////////////////////////////
// Distance function for raymarching.

float map(in vec3 pos) {

    // Handle scaling
    pos /= scale;

    // Get length of point & distance to sphere
    float d = length(pos);
    float d_sphere = d - 1.0;

    // Do wythoff construction
    mat3 tri, M;
    vec3 tri_vert, tri_region, face_normal, edge;
    
    wythoff(wythoff_symbol, pos, tri, M, 
            tri_vert, tri_region, face_normal, edge);

    // Compute distance to exterior of polyhedron
    float d_poly = dot(pos, face_normal) - dot(face_normal, tri_vert);

    // Mix polyhedron/sphere and go
    return mix(d_poly, d_sphere, sphericity) * scale;

}

//////////////////////////////////////////////////////////////////////
// RGB from hue

vec3 hue(float h) {
    vec3 c = mod(h*6.0 + vec3(2, 0, 4), 6.0);
    return h >= 1.0 ? vec3(h-1.0) : clamp(min(c, -c+4.0), 0.0, 1.0);
}

//////////////////////////////////////////////////////////////////////
// IQ's normal calculation

vec3 calc_normal( in vec3 pos ) {
    vec3 eps = vec3( 0.001, 0.0, 0.0 );
    vec3 nor = vec3(
                    map(pos+eps.xyy) - map(pos-eps.xyy),
                    map(pos+eps.yxy) - map(pos-eps.yxy),
                    map(pos+eps.yyx) - map(pos-eps.yyx) );
    return normalize(nor);
}

//////////////////////////////////////////////////////////////////////
// Based on IQ's ray marcher

vec2 cast_ray( in vec3 ro, in vec3 rd) {

    const int rayiter = 25;
    const float dmax = 20.0;
    
    const float precis = 0.01;   
    float h=8.0;

    float t = 0.0;
    float m = 1.0;

    for( int i=0; i<rayiter; i++ ) {
        if( abs(h)<precis||t>dmax ) continue;//break;
        t += h;
        h = map( ro+rd*t );
    }    

    if (t > dmax) {
        m = -1.0;
    }

    return vec2(t, m);

}

//////////////////////////////////////////////////////////////////////
// Color for ray

vec3 shade(vec3 ro, vec3 rd) {

    // Do raymarching
    vec2 tm = cast_ray(ro, rd);

    if (tm.y < 0.0) {

        // No hit
        return bg_color;

    } else {

        // We hit the polyhedron
        vec3 p = ro + rd*tm.x;

        // Redo Wythoff construcion to get vertex, region, normal, edge.
        vec3 x = normalize(p);

        mat3 tri, M;
        vec3 tri_vert, tri_region, face_normal, edge;
    
        wythoff(wythoff_symbol, x, tri, M, 
                tri_vert, tri_region, face_normal, edge);

        //////////////////////////////////////////////////
        // Black lines

        // Look at distance from edge to draw black lines
        float d_black = abs(dot(edge, x)) - 0.005;

        // Look at points on sphere
        d_black = min(d_black, length(x - tri_vert) - 0.03*sphericity);

        // Distance to coverage
        float k_black = smoothstep(0.0, 0.01, d_black);

        //////////////////////////////////////////////////
        // Face coloring
        
        // Normal to RGB
        vec3 per_face_color = face_normal*0.5 + 0.5;

        // Red/Yellow/Blue
        vec3 basic_color = basic_palette * tri_region;
        
        // Mix per-face/basic
        vec3 base_color = mix(basic_color, per_face_color, color_by_face);

        //////////////////////////////////////////////////
        // Even/odd triangle coloring

        // Light version of color for even triangles
        vec3 lighter = 0.6*base_color + 0.4;

        // Signed distances to triangle edge (note always positive
        // cause M*x is guaranteed inside triangle)
        vec3 d = M * x * tri;

        // Get min dist for shading
        float tri_dist = min(d.x, min(d.y, d.z));

        // For odd triangles
        vec3 darker = lighter * 0.8;

        // In-between color for AA
        vec3 mid = lighter * 0.9;

        // Compute parity as determinant of reflection matrix
        float parity = dot(M[0], cross(M[1], M[2]));

        // Base color for even/odd
        vec3 tri_color = parity < 0.0 ? darker : lighter;

        // AA
        tri_color = mix(mid, tri_color,
                        smoothstep(0.0, 0.005, abs(tri_dist)));

        //////////////////////////////////////////////////
        // Final shading

        vec3 final_color = mix(base_color, tri_color, show_triangles);
      
        vec3 n = calc_normal(p);
    
        float nDotL = clamp(dot(n, L), 0.0, 1.0);

        return k_black * final_color * (nDotL * 0.5 + 0.5);

    }

}

//////////////////////////////////////////////////////////////////////
// Decode numbers 2,3,4,5 or 0,1,2,3 from two key toggles. This is
// a very gross user interface

float keys_to_num(float key, float default_value, float bias) {

    default_value -= bias;

    float hi = key_state(key, floor(default_value/2.0));
    float lo = key_state(key+1.0/256.0, mod(default_value, 2.0));

    return 2.0*hi + lo + bias;
  
}

//////////////////////////////////////////////////////////////////////
// Does GLSL support constant arrays across the board yet? 

vec4 choose_shape(float index) {

    if (index < 1.0) {
        return WS_TET;
    } else if (index < 2.0) {
        return WS_OCT;
    } else if (index < 3.0) {
        return WS_CUBE;
    } else if (index < 4.0) {
        return WS_IKE;
    } else if (index < 5.0) {
        return WS_DOE;
    } else if (index < 6.0) {
        return WS_CO;
    } else if (index < 7.0) {
        return WS_ID;
    } else if (index < 8.0) {
        return WS_TUT;
    } else if (index < 9.0) {
        return WS_TOE;
    } else if (index < 10.0) {
        return WS_TIC;
    } else if (index < 11.0) {
        return WS_TI;
    } else if (index < 12.0) {
        return WS_TID;
    } else if (index < 13.0) {
        return WS_SIRCO;
    } else if (index < 14.0) {
        return WS_SRID;
    } else if (index < 15.0) {
        return WS_GIRCO;
    } else {
        return WS_GRID;
    }
    
}

//////////////////////////////////////////////////////////////////////
// Distance to character in SDF font texture

float font2d_dist(vec2 tpos, float size, vec2 offset) {

    float scl = 0.63/size;
    vec2 uv = tpos*scl;
    vec2 font_uv = (uv+vec2(0.3, 0.2)+offset)*(1.0/16.0);
    
    float k = texture(iChannel1, font_uv, -100.0).w + 1e-6;
    
    vec2 box = abs(uv-vec2(0.2, 0.3))-0.5;
        
    return max(k-127.0/255.0, max(box.x, box.y))/scl;
    
}

//////////////////////////////////////////////////////////////////////
// Generate label for Wythoff symbol using SDF font texture

vec2 label_symbol(vec2 text_pos, float text_size) {
    
    float d = farval;
    
    for (int i=0; i<3; ++i) {
        d = min(d, font2d_dist(text_pos, text_size, vec2(wythoff_symbol[i], 12.0)));
        text_pos -= vec2(1.0, 0)*text_size;
        
        if (wythoff_symbol.w == float(i)) {
            text_pos += vec2(0.25, 0) * text_size;
            d = min(d, font2d_dist(text_pos, text_size, vec2(12.0, 8.0)));
            text_pos -= vec2(0.75, 0) * text_size;
        }      
        
    }
    
    return vec2(smoothstep(vec2(0.0), vec2(1.0), d - vec2(2.0, 0.0)));
    
}



//////////////////////////////////////////////////////////////////////
// Main program

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {

    vec2 fragCoordText = fragCoord;
    float reveal_mode = key_state(KEY_R, 0.0);
    
    demo_mode = key_state(KEY_D, demo_mode);
    float text_size = 24.0;

    if(reveal_mode > 0.0 && demo_mode == 0.0) {
        
        wythoff_symbol.x =     2.0 * abs( floor(2.0*fract(4.0*fragCoord.x/iResolution.x)) - floor((wythoff_symbol.x - 2.0)/2.0) ) + abs( floor(2.0*fract(8.0*fragCoord.x/iResolution.x)) - mod((wythoff_symbol.x - 2.0), 2.0) ) + 2.0;
        wythoff_symbol.y =     2.0 * abs( floor(2.0*fract(1.0*fragCoord.x/iResolution.x)) - floor((wythoff_symbol.y - 2.0)/2.0) ) + abs( floor(2.0*fract(2.0*fragCoord.x/iResolution.x)) - mod((wythoff_symbol.y - 2.0), 2.0) ) + 2.0;
        wythoff_symbol.z =     2.0 * abs( floor(2.0*fract(6.0*fragCoord.y/iResolution.y)) - floor((wythoff_symbol.z - 2.0)/2.0) ) + abs( floor(2.0*fract(3.0*fragCoord.y/iResolution.y)) - mod((wythoff_symbol.z - 2.0), 2.0) ) + 2.0;
        wythoff_symbol.w = min(2.0 * abs( floor(2.0*fract(1.5*fragCoord.y/iResolution.y)) - floor((wythoff_symbol.w      )/2.0) ) + abs( floor(1.5*fract(1.0*fragCoord.y/iResolution.y)) - mod((wythoff_symbol.w      ), 2.0) ), 2.0);

        fragCoordText = mod(fragCoord*3.,iResolution.xy/vec2(16,12)*3.);
        fragCoord = mod(fragCoord*vec2(16,12),iResolution.xy)*vec2(1,16./12.);
        fragCoord.y -= iResolution.y*.125;
        text_size = 24.0;
        

    }
 
    //////////////////////////////////////////////////
    // Set up model view and projection
    
    float t = iTime;
    
    const vec3 tgt = vec3(0);
    const vec3 cpos = vec3(1.0,1.0,1.0)*10.005;
    const vec3 up = vec3(0, 0, 1);
    const float fovy = 0.125;

    vec2 uv = (fragCoord.xy - .5*iResolution.xy) * fovy / (iResolution.y);

    vec3 rz = normalize(tgt - cpos),
        rx = normalize(cross(rz,up)),
        ry = cross(rx,rz);
         
    float thetay = t * 0.6;
    float thetax = t * 0.3;

    if (max(iMouse.x, iMouse.y) > 20.0) { 
        thetax = (iMouse.y - .5*iResolution.y) * -4.5/iResolution.y; 
        thetay = (iMouse.x - .5*iResolution.x) * 4.0/iResolution.x; 
    }

    mat3 Rmouse = rot_x(thetax)*rot_y(thetay);
    mat3 Rview = mat3(rx,ry,rz)*Rmouse;    
    L = Rview*Rmouse*(L*Rview);
  
    vec3 rd = Rview*normalize(vec3(uv, 1.)),
        ro = tgt + Rview*vec3(0,0,-length(cpos-tgt));

    //////////////////////////////////////////////////
    // Inititialize Wythoff symbol and settings
    

    if (demo_mode > 0.0) {

        const float d_scale = 1.0;
        const float d_long = 5.0;

        const float t_appear = 0.5;
        const float t_big = t_appear + d_scale;
        const float t_poly_start = t_big + d_long;
        const float t_poly_end = t_poly_start + 0.5;
        const float t_color_start = t_poly_end + d_long;
        const float t_color_end = t_color_start + 0.5;
        const float t_shrink = t_color_end + d_long;
        const float t_final = t_shrink + d_scale;
        
        float stage = floor(t / t_final);
        float ts = mod(t, t_final);

        sphericity = smoothstep(t_poly_end, t_poly_start, ts);

        show_triangles = sphericity;
        
        color_by_face = smoothstep(t_color_start, t_color_end, ts);

        scale = min(smoothstep(t_appear, t_big, ts),
                    smoothstep(t_final, t_shrink, ts));
        
        float shape = mod(stage + 3.0, 16.0);

        wythoff_symbol = choose_shape(shape);

    } else {

        color_by_face = key_state(KEY_C, color_by_face);
        show_triangles = key_state(KEY_T, show_triangles);
        sphericity = key_state(KEY_S, 0.0);
    
        if (reveal_mode == 0.0) {
            wythoff_symbol.x = keys_to_num(KEY_1, wythoff_symbol.x, 2.0);
            wythoff_symbol.y = keys_to_num(KEY_3, wythoff_symbol.y, 2.0);
            wythoff_symbol.z = keys_to_num(KEY_5, wythoff_symbol.z, 2.0);
            wythoff_symbol.w = min(keys_to_num(KEY_7, wythoff_symbol.w, 0.0), 2.0);
        }

    }

    //////////////////////////////////////////////////
    // Now composite our scene

    // Don't attempt to render obviously bogus polyhedra.
    bool valid = dot(1.0/wythoff_symbol.xyz, vec3(1.0)) > 1.0;

    vec3 scene_color = bg_color;
    vec3 text_color = valid ? vec3(0) : vec3(0.7, 0, 0);

    if (valid && scale > 0.0) {
        scene_color = shade(ro, rd);
        text_color = vec3(0);
    }

    // Composite in text
    vec2 text_pos = fragCoordText.xy - 12.49;

    vec2 k = label_symbol(text_pos, text_size);

    scene_color = mix(bg_color, scene_color, k.x);
    scene_color = mix(text_color, scene_color, k.y);

    // Done!
    fragColor = vec4(scene_color, 1.0);
	
}

`;

export default class implements iSub {
  key(): string {
    return 'ldXczX';
  }
  name(): string {
    return 'Wythoff construction';
  }
  sort() {
    return 537;
  }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  webgl() {
    return WEBGL_2;
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
      webglUtils.DEFAULT_NOISE,
      webglUtils.FONT_TEXTURE, //
    ];
  }
}
