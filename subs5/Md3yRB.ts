import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
// mostly code for triangle setup and coordinate projection
// also gui placement

const float PI = 3.141592653589793;
const float TOL = 1e-5;

// define this to see some interesting visualization
// (and to speed up compile!)
//#define STEREOGRAPHIC_POLAR

//////////////////////////////////////////////////////////////////////
// state storage

#define PQR_COL     0 
#define THETA_COL   1
#define BARY_COL    2
#define SPSEL_COL   3
#define DFUNC0_COL  4
#define DFUNC1_COL  5
#define DECOR_COL   6
#define MISC_COL    7
// link, shade per face, GUI, debugbgcolor

#define TARGET_ROW  0
#define CURRENT_ROW 1

#define load(x,y) texelFetch(iChannel0, ivec2(x,y), 0)
#define load4(a,b) load(a,b)
#define load3(a,b) load(a,b).xyz
#define load2(a,b) load(a,b).xy
#define load1(a,b) load(a,b).x

//////////////////////////////////////////////////////////////////////
// triangle layout (see setup_triangle below)

vec3 pqr;

mat3 tri_edges, tri_verts, poly_edges, ortho_proj, planar_proj;
mat4x3 tri_spoints;
bvec3 is_face_normal;

mat3x2 planar_verts;
mat2 bary_mat;

vec3 bary_poly_vertex;
vec4 spoint_selector = vec4(0);
vec3 poly_vertex;

//////////////////////////////////////////////////////////////////////
// GUI layout (see setup_gui below)

float inset_scl;
vec2 inset_ctr;
vec2 object_ctr;
float text_size;
float dfunc_y;

//////////////////////////////////////////////////////////////////////
// stereographic projection

vec2 planar_from_sphere(vec3 q) {
    
    q = q * planar_proj;
    return q.xy / q.z;
    
}

vec3 sphere_from_planar(vec2 p) {
    
    return planar_proj * vec3(p, 1.);
    
}

//////////////////////////////////////////////////////////////////////
// cartesian <-> barycentric

vec3 bary_from_planar(vec2 p) { 

    vec2 bxy = bary_mat * (p - planar_verts[2]);
    return vec3(bxy, 1.-bxy.x-bxy.y);
    
}

vec2 planar_from_bary(vec3 b) {
    return planar_verts * b;
}

//////////////////////////////////////////////////////////////////////
// 3D <-> barycentric (via sterographic projection)

vec3 bary_from_sphere(vec3 q) {    
    return bary_from_planar(planar_from_sphere(q));
}


vec3 sphere_from_bary(vec3 b) {
    return tri_verts * b;
}

//////////////////////////////////////////////////////////////////////
// given polyhedron vertex coords as barycentric coords,
// compute where it should be on sphere (but first check)
// if it should be at a "special" point

void poly_from_bary() {
    
    bool was_select = false;
    
    for (int i=0; i<4; ++i) {
        if (abs(spoint_selector[i] - 1.) < TOL) {
            poly_vertex = tri_spoints[i];
            bary_poly_vertex = bary_from_sphere(poly_vertex);
            was_select = true;
        }
    }
    
    if (!was_select) {
        poly_vertex = normalize(sphere_from_bary(bary_poly_vertex.xyz));
    }
    
}    

//////////////////////////////////////////////////////////////////////
// map 2D position in lower right inset of gui to 3D sphere pos

vec3 sphere_from_gui(in vec2 p) {
    
    p -= inset_ctr;
    p *= inset_scl;
    
    float dpp = dot(p, p);
    
    if (dpp >= 1.) {
        return vec3(p/sqrt(dpp), 0);
    } else {    
        vec3 p3d = vec3(p, sqrt(1. - dot(p, p)));
        return ortho_proj*p3d;
    }
    
}

//////////////////////////////////////////////////////////////////////
// given PQR and specification of polygon vertex, set up all of the
// static info we need to do Wythoff construction later

void setup_triangle(in vec3 new_pqr) {
    
    pqr = new_pqr;
    
    float p = pqr.x;
    float q = pqr.y;
    float r = pqr.z;

    float tp = PI / p;
    float tq = PI / q;
    float tr = PI / r;

    float cp = cos(tp), sp = sin(tp);
    float cq = cos(tq);
    float cr = cos(tr);

    vec3 lr = vec3(1, 0, 0);
    vec3 lq = vec3(-cp, sp, 0);
    vec3 lp = vec3(-cq, -(cr + cp*cq)/sp, 0);
    
    lp.z = sqrt(1.0 - dot(lp.xy, lp.xy));
    
    tri_edges = mat3(lp, lq, lr);
    
    vec3 P = normalize(cross(lr, lq));
    vec3 R = normalize(cross(lq, lp));
    vec3 Q = normalize(cross(lp, lr));
    
    tri_verts = mat3(P, Q, R);
    
    tri_spoints[0] = normalize(cross(lq - lr, lp));
    tri_spoints[1] = normalize(cross(lr - lp, lq));
    tri_spoints[2] = normalize(cross(lp - lq, lr));
    
    tri_spoints[3] = normalize(cross(lp-lq, lr-lp));
        
    ortho_proj[2] = tri_spoints[3];
    ortho_proj[0] = -normalize(cross(ortho_proj[2], tri_edges[1]));
    ortho_proj[1] = normalize(cross(ortho_proj[2], ortho_proj[0]));
    
    planar_proj[2] = normalize(cross(R-P, Q-P));
    
    planar_proj[0] = -normalize(cross(planar_proj[2], tri_edges[1]));
    planar_proj[1] = normalize(cross(planar_proj[2], planar_proj[0]));
        
    for (int i=0; i<3; ++i) {
        planar_verts[i] = planar_from_sphere(tri_verts[i]);
    }
    
    bary_mat = inverse(mat2(planar_verts[0] - planar_verts[2],
                            planar_verts[1] - planar_verts[2]));
    

	poly_from_bary();
    
    is_face_normal = bvec3(true);
    
    for (int i=0; i<3; ++i) {
        poly_edges[i] = normalize(cross(poly_vertex, tri_edges[i]));
        for (int j=0; j<2; ++j) {
            int vidx = (i+j+1)%3;
            if (abs(dot(tri_verts[vidx], poly_edges[i])) < TOL) {
                is_face_normal[vidx] = false;
            }
        }
    }
    
}

//////////////////////////////////////////////////////////////////////
// if point p lies opposite m, mirror it. return the transform that
// accomplishes this.

mat3 mirror(inout vec3 p, in vec3 m) {
    
    float d = dot(p, m);
    mat3 rval = mat3(1.) - (2. * step(d, 0.)) * outerProduct(m, m);
        
    p = rval * p;
    
    return rval;
    
}

//////////////////////////////////////////////////////////////////////
// modify the vector m to halve the angle with respect to the y
// axis (assume that m.z == 0)

vec3 half_angle(in vec3 m) {
    return normalize(vec3(m.x - 1.0, m.y, 0.0));
}

//////////////////////////////////////////////////////////////////////
// use space folding to make sure pos lies in the triangular cone
// whose edge planes are given by tri_edges
//
// this function was largely determined by trial and error. possibly
// if I understood more about symmetry I would be able to get it 
// a little simpler

mat3 tile_sphere(inout vec3 pos) {
    
    mat3 M = mat3(1.);
    
    ////////////////////////////////////////////////////
    // part 1: guarantee that the point lives inside
    // the cluster of p triangles that share the vertex
    // (0, 0, 1)
    
    M *= mirror(pos, vec3(1, 0, 0));
   
    vec3 m = tri_edges[0];

    for (float i=0.; i<5.; ++i) {

        // mirror
        M *= mirror(pos, m);
        m -= tri_edges[1] * 2.0 * dot(m, tri_edges[1]);

        M *= mirror(pos, m);
        m -= tri_edges[2] * 2.0 * dot(m, tri_edges[2]);

    }

    ////////////////////////////////////////////////////
    // part 2: fold in the XY plane to make sure the 
    // point lives in the triangular cone just to the
    // right of the y axis
       
    M *= mirror(pos, vec3(1, 0, 0));
       
    float p = pqr.x;
    float k = p >= 5.0 ? 4. : p >= 3.0 ? 2. : 1.;
    
    float theta = k * PI / p;

    m = vec3(-cos(theta), sin(theta), 0); // lq
    
    if (p >= 5.0) {        
        M *= mirror(pos, m);
        m = half_angle(m);
    }
    
    if (p >= 3.0) {
        M *= mirror(pos, m);
        m = half_angle(m);
    }
    
    M *= mirror(pos, m);    

    return M;
        
}    


//////////////////////////////////////////////////////////////////////
// rotate about x-axis 

mat3 rotX(in float t) {
    float cx = cos(t), sx = sin(t);
    return mat3(1., 0, 0, 
                0, cx, sx,
                0, -sx, cx);
}

//////////////////////////////////////////////////////////////////////
// rotate about y-axis 

mat3 rotY(in float t) {
    float cy = cos(t), sy = sin(t);
    return mat3(cy, 0, -sy,
                0, 1., 0,
                sy, 0, cy);

}

//////////////////////////////////////////////////////////////////////
// GUI box placement functions

float box_dist(vec2 p, vec4 b) {
    
    p = abs(p - b.xy) - b.zw;
    return max(p.x, p.y);
    
}

vec4 char_ui_box(int idx) {
    
    const vec2 digit_rad = vec2(0.35, 0.5);
    
    return vec4(inset_ctr.x + (float(idx - 1))*text_size,
                2.*inset_ctr.y + 1.15*text_size,
                digit_rad*text_size);
    
}

vec4 tri_ui_box(int idx, float delta) {
    
    return vec4(char_ui_box(idx).xy + vec2(0, 0.9*delta*text_size), 
                0.4*text_size, 0.3*text_size);
    
}

vec4 dfunc_ui_box(int idx, int row) {
    
    return vec4(inset_ctr.x + (float(idx - 2))*text_size,
    	        dfunc_y - float(1-row)*text_size,
                vec2(0.45*text_size));
    
}

vec4 link_ui_box() {
    
    return vec4(inset_ctr.x + 2.85*text_size,
                dfunc_y - 0.5*text_size,
                0.3*text_size, 0.5*text_size);
    
}

vec4 decor_ui_box(int idx) {
    
    return vec4(inset_ctr.x + (float(idx)-1.5)*text_size*1.1,
                dfunc_y - 2.5*text_size,
                vec2(0.45*text_size));
    
}

vec4 color_ui_box(int idx) {
    
    return vec4(inset_ctr.x + (float(idx)-0.5)*text_size,
                dfunc_y - 3.5*text_size,
                vec2(0.45*text_size));
    
}

//////////////////////////////////////////////////////////////////////
// set up GUI positions

void setup_gui(vec2 res, float gui) {
    
    //bool show_gui = gui > 0.99 && res.y > 250.;
    if (res.y < 250.) { gui = 0.; }
    

    float inset_sz = 0.20*res.y;

    float margin_px = 6.0;

    text_size = 0.06 * res.y;

    inset_scl = 1.0 / inset_sz;
    inset_sz += margin_px;
    
    inset_ctr = vec2(mix(-inset_sz, inset_sz, gui), inset_sz);

    object_ctr = vec2(0.5*res.x + gui*inset_sz, 0.5*res.y);

    dfunc_y = res.y - text_size;
        


}
    
`;

const fragment = `
/* Wythoff explorer, by mattz
   License https://creativecommons.org/licenses/by-nc-sa/3.0/

   This is an update to my "Wythoff construction" shader:
   ldXczX 

   I've learned a bit since I wrote that, and was able to add
   a few new features I couldn't figure out last time:

     - lots more distance functions besides sphere and
       polyhedron! faceted or ball-and-stick nets, and
       also polyhedron dilated by sphere 

     - user-modifiable polyhedron vertex within triangle

     - lots of cool blending effects

   As usual, I'm indebted to other users on shadertoy for 
   helpful/inspiring examples, especially:
 
     - Polyhedron again (knighty)

     - 2D Folding (gaz)

   These links were helpful when creating this shader:

     - https://en.wikipedia.org/wiki/Wythoff_construction
     - http://www.gregegan.net/APPLETS/26/WythoffNotes.html
     - https://en.wikipedia.org/wiki/List_of_uniform_polyhedra

   If you want to browse the code: this main buffer only does AA 
   and GUI rendering. Buffer A handles mouse interaction and 
   global state updates, and Buffer B handles distance marching 
   and shading the actual polyhedron.

   I'm pretty sure this is the largest shader I've posted on
   Shadertoy -- apologies for the long compile times!

*/

//#define DEBUG_HITBOXES
#define ENABLE_EDGE_AA

//////////////////////////////////////////////////////////////////////
// point-line distance

float dline(vec2 p, vec2 a, vec2 b) {
    
    vec2 ba = b-a;
    vec2 n = normalize(vec2(-ba.y, ba.x));
    
    return dot(p, n) - dot(a, n);
    
}

//////////////////////////////////////////////////////////////////////
// point-line and point-segment distance

vec2 dline_seg(vec2 p, vec2 a, vec2 b) {

    vec2 ba = b-a;
    vec2 n = normalize(vec2(-ba.y, ba.x));

    vec2 pa = p-a;
    
    float u = clamp(dot(pa, ba)/dot(ba, ba), 0., 1.);
    
    return vec2(dot(a, n) - dot(p, n), length(p-mix(a,b,u)));
    
}

//////////////////////////////////////////////////////////////////////
// distance to character in SDF font texture

float font2d_dist(vec2 tpos, float size, vec2 offset) {

    float scl = 0.63/size;
      
    vec2 uv = tpos*scl;
    vec2 font_uv = (uv+offset+0.5)*(1.0/16.0);
    
    float k = texture(iChannel2, font_uv, -100.0).w + 1e-6;
    
    vec2 box = abs(uv)-0.5;
        
    return max(k-127.0/255.0, max(box.x, box.y))/scl;
    
}

//////////////////////////////////////////////////////////////////////
// distance to triangle for spin box

float spin_icon_dist(vec2 pos, float size, bool flip, bool dim) {
    
    if (flip) { pos.y = -pos.y; }  
    pos.x = abs(pos.x);
    
    vec2 p0 = vec2(0, -0.7)*text_size;
    vec2 p1 = vec2(0.35, -0.7)*text_size;
    vec2 p2 = vec2(0.0, -1.1)*text_size;
    
    float d = max(dline(pos, p0, p1), dline(pos, p1, p2));
    
    if (dim) { 
        d = abs(d + 0.02*text_size) - 0.02*text_size;
    }
    
    return d;
       
}

//////////////////////////////////////////////////////////////////////
// distance to icon for distance function

float dfunc_icon_dist(vec2 p, float sz, int style) {
    
    if (style == 0) {
        
        return length(p) - sz;
        
    } else if (style == 5 || style == 6) {

		p.y = abs(p.y);
        
        vec2 vp = p*vec2(1, 0.9);
        float d = abs(length((vp - vec2(0, 0.6*sz))) - 0.5*sz) - 0.06*sz;
        
        float q = length(p - vec2(0, min(p.y, 0.4*sz)))-0.06*sz;
        float r = box_dist(p, vec4(0, 0, 0.35, 0.7)*sz);
                    
        if (style == 6) {
        
            q = min(q, box_dist(p, vec4(0, 2.0, 0.06, 0.46)*sz));
            q = min(q, box_dist(p, vec4(-0.5, 2.4, 0.56, 0.06)*sz));
            
        }
                
        return min(q, max(d, -r));
        
    }
    
    p += vec2(0, 0.15*sz);
    
    sz *= 0.9;
    
    const float k = 0.8660254037844387;
    
    p.x = abs(p.x);
    
    vec2 m0 = vec2(0, sz);
    vec2 m1 = vec2(k*sz, -0.5*sz);
    vec2 m2 = vec2(0, -0.5*sz);
    
    vec2 d_ls = min(dline_seg(p, m0, m1),
                    dline_seg(p, m1, m2));
    
    float d_point = min(length(p - m0), length(p - m1));
    
    if (style == 1) {
        return -d_ls.x - 0.5;
    } else if (style == 2) {
        return min(d_point - 0.25*sz, abs(d_ls.y)-0.08*sz);
    } else if (style == 3) {
        return abs(d_ls.x)-0.15*sz;
    } else {
        return min(min(d_ls.y, d_point) - 0.35*sz, -d_ls.x);    
    }
    
}

//////////////////////////////////////////////////////////////////////
// distance to icon for decorations

float decor_icon_dist(vec2 p, float sz, int style) {
    
    float s = sign(p.x*p.y);
    
    p = abs(p);
    
    vec2 a = vec2(0, sz);
    vec2 b = vec2(sz, 0);
    
    float l = dline(p, a, b);
    float c = length( p - (p.x > p.y ? b : a)*0.8 );
    
    if (style == 0) {
        return c - 0.2*sz;
    } else if (style == 1) {
        return abs(l + 0.04*sz) - 0.08*sz;
    } else if (style == 2) {
        return min(abs(l), max(min(p.x, p.y), l)) - 0.03*sz;
    } else {
        return min(max(min(s*p.x, s*p.y), l), abs(l)-0.03*sz);
        
    }
    
}

//////////////////////////////////////////////////////////////////////
// draw color icon (RGB or facet-shaded selectors)

void draw_color_icon(vec2 p, float sz, int i, bool enable, inout vec3 color) {
    
    const float k = 0.8660254037844387;
    
    mat2 R = mat2(-0.5, k, -k, -0.5);
    
    vec2 p1 = vec2(k*sz, 0);
    vec2 p2 = vec2(0, 0.5*sz);
    
    mat3 colors;
    
    if (i == 0) {
        colors = mat3(vec3(1, 0, 0),
                      vec3(1, 1, 0),
                      vec3(0, 0, 1));
    } else {
        colors = mat3(vec3(0.6, 0, 0.6),
                      vec3(0.7, 0.4, 0.7),
                      vec3(0.1, 0.5, 0.5));
    }
    
    float ue = enable ? 1. : 0.3;
    float ds = 1e5;
    
    for (int j=0; j<3; ++j) {
        
        vec2 ap = vec2(abs(p.x), abs(p.y-0.5*sz));
        
        vec2 dls = dline_seg(ap, p2, p1);
        
        p = R*p;
        
        color = mix(color, colors[j], smoothstep(1.0, 0.0, -dls.x+0.5) * ue);
        ds = min(ds, dls.y);
    
    }

    color = mix(color, vec3(0), smoothstep(1.0, 0.0, ds-0.05*sz) * ue);
    
}


//////////////////////////////////////////////////////////////////////
// draw sphere inset for bottom left corner

void draw_sphere_inset(in vec2 p, inout vec3 color) {    
    
    float px = inset_scl;
    
    float dot_size = max(3.0*px, 0.03);
    float line_width = max(.25*px, 0.003);

    float lp = length((p - inset_ctr)*px);
        
    vec3 sp = sphere_from_gui(p);
    
    if (lp < 1.) {
        
        color = vec3(1);        
      
        float d_tri = 1e5;
        
        
        float d_circ = 1e5;
        
        for (int i=0; i<3; ++i) {

            d_circ = min(d_circ, length(sp - tri_verts[i]));
            d_circ = min(d_circ, length(sp - tri_spoints[i]));
            
            d_tri = min(d_tri, dot(sp, tri_edges[i]));
        }
        
        d_circ = min(d_circ, length(sp - tri_spoints[3]));
                   
        float d_V = length(sp - poly_vertex);
                
        vec3 sp2 = sp;
        tile_sphere(sp2); 
        

        float d_gray = 1e5;
        
        for (int i=0; i<3; ++i) {
            d_gray = min(d_gray, abs(dot(sp2, tri_edges[i])));
        }
        
        
        float d_pink = length(sp2 - poly_vertex);
        
        color = mix(color, vec3(0.85), smoothstep(px, 0.0, d_gray-2.*line_width));

        color = mix(color, vec3(0.9, 0.5, 0.5), smoothstep(px, 0.0, d_pink-0.7*dot_size));

        color = mix(color, vec3(0.6), smoothstep(px, 0.0, -d_tri));
        color = mix(color, vec3(0), smoothstep(px, 0.0, abs(d_tri)-line_width));

        color = mix(color, vec3(1), step(d_circ, dot_size));
        color = mix(color, vec3(0.7, 0, 0), smoothstep(px, 0.0, d_V-dot_size));
        color = mix(color, vec3(0), smoothstep(px, 0.0, abs(d_circ - dot_size)-line_width));

    
    }    
    
    color = mix(color, vec3(0), smoothstep(px, 0.0, abs(lp - 1.)-line_width));                                                 
    
}

//////////////////////////////////////////////////////////////////////
// was for debugging, now just for fun 

vec3 stereographic_polar_diagram(in vec2 p, in vec2 theta) {
    
    mat3 R = rotX(-theta.x)*rotY(-theta.y);

    float rad = length(planar_verts[0]);
    float scl = 8.0*rad / iResolution.y;
    
    p *= scl;

    float d = 1e5;
    
    vec3 Rctr = R * vec3(0, 0, 1);
    vec3 Rp3d = R * vec3(p, 1);
    vec2 Rp = Rp3d.xy / Rp3d.z;
        
    for (int i=0; i<3; ++i) {
        vec3 tp = (tri_verts[i] * planar_proj * R);
        d = min(d, length(p - tp.xy / tp.z) - 2.*scl);
    }
        
    vec3 pos = sphere_from_planar(Rp) * sign(Rp3d.z);
    mat3 M = tile_sphere(pos);
    
    for (int i=0; i<3; ++i) {
        vec3 e =  M * tri_edges[i] * planar_proj * R;
        e /= length(e.xy);
        d = min(d, abs(dot(vec3(p, 1), e)));
    }    

    vec3 pv = M * poly_vertex * planar_proj * R;
    
    vec3 color = vec3(1);

    if (length(Rp) < rad) {
        color = vec3(1, .5, 1);
    }

    float Mdet = dot(M[0], cross(M[1], M[2]));
    
    color *= mix(0.8, 1.0, step(0.0, Mdet));
    
    color = mix(color, vec3(0, 0, 1), smoothstep(scl, 0.0, abs(length(Rp)-rad)-.5*scl));
    color *= smoothstep(0., scl, d-0.25*scl);
    color = mix(color, vec3(0.7, 0, 0), smoothstep(scl, 0., length(p - pv.xy / pv.z)-3.*scl));
    
    vec3 e = vec3(0, 0, 1) * R;
    e /= length(e.xy);
    d = abs(dot(vec3(p, 1), e));    
    color = mix(color, vec3(0.0, 0, 0.5), smoothstep(scl, 0., d-.5*scl));
    
    return color;
    
}

//////////////////////////////////////////////////////////////////////
// helper function for drawing icons below

void icon_dist_update(inout vec2 blk_gray, 
                      float d, bool enable) {
    
    if (enable) {
        blk_gray.x = min(blk_gray.x, d);
    } else {
        blk_gray.y = min(blk_gray.y, d);
    }
    
}

//////////////////////////////////////////////////////////////////////
// our main image - apply AA to rendered polyhedron and draw GUI

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    
    ////////////////////////////////////////////////////////////
    // set up GUI placement and load in settings from texture A
    
    
    bary_poly_vertex = load3(BARY_COL, TARGET_ROW);
    spoint_selector = load4(SPSEL_COL, TARGET_ROW);   
    vec4 theta = load4(THETA_COL, TARGET_ROW);
    
    setup_triangle(load3(PQR_COL, TARGET_ROW));
    
    vec4 decorations = load4(DECOR_COL, TARGET_ROW);
    
    vec4 misc = load4(MISC_COL, TARGET_ROW);
    bool is_linked = (misc.x != 0.);
    
    float gui = load(MISC_COL, CURRENT_ROW).z;

    setup_gui(iResolution.xy, gui);
    
#ifdef STEREOGRAPHIC_POLAR    
    
    // render a cool 2D diagram
    vec3 color = stereographic_polar_diagram(fragCoord.xy - object_ctr, theta.xy);
    color = mix(vec3(1), color, smoothstep(0.0, 100.0, fragCoord.x-2.*inset_ctr.x));
    
#else
#ifdef ENABLE_EDGE_AA

    // texture B holds the rendered scene with the ray distance 
    // stored in the 4th (w) coordinate. 
    //
    // note color not yet gamma-corrected so still safe to blend

    ivec2 fc = ivec2(fragCoord);

    // fetch center texel and four surrounding texels
    vec4 sa = texelFetch(iChannel1, fc+ivec2(0, 1), 0);
    vec4 sb = texelFetch(iChannel1, fc+ivec2(-1, 0), 0);
    vec4 sc = texelFetch(iChannel1, fc, 0);
    vec4 sd = texelFetch(iChannel1, fc+ivec2(1, 0), 0);
    vec4 se = texelFetch(iChannel1, fc+ivec2(0, -1), 0);
    
    // blur the center pixel horizontally and vertically
    const vec3 bcoeff = vec3(0.25, 0.5, 0.25);
    vec3 hblur = mat3(sb.xyz, sc.xyz, sd.xyz)*bcoeff;
    vec3 vblur = mat3(sa.xyz, sc.xyz, se.xyz)*bcoeff;
         
    // get the (absolute) gradient of the depth map 
    // and its (approximate) norm
    vec2 depth_grad = abs(vec2(sd.w - sb.w, se.w - sa.w));
    float depth_grad_norm = depth_grad.x + depth_grad.y;
    
    // depth gradient now sums to 1
    depth_grad /= max(1e-5, depth_grad_norm);
    
    // compute blur along depth gradient direction
    vec3 directed_blur = hblur*depth_grad.y + vblur*depth_grad.x;

    // blend in blur where gradient is large
    vec3 color = mix(sc.xyz, directed_blur, 
                     smoothstep(0.0, 0.5, depth_grad_norm));
    
#else
    
    vec3 color = texelFetch(iChannel1, ivec2(fragCoord), 0).xyz;
    
#endif            
#endif
    
    // everything from here down is just UI and gamma correction
    
    vec3 pre_gui_color = color;
            
    draw_sphere_inset(fragCoord.xy, color);    
    
    float d_gray = 1e5;
    vec2 d_bg = vec2(1e5);

    for (int i=0; i<3; ++i) {

        vec2 text_pos = fragCoord.xy - char_ui_box(i).xy;
        
        d_bg.x = min(d_bg.x, font2d_dist(text_pos, text_size, vec2(pqr[i], 12.0)));
        d_gray = min(d_gray, spin_icon_dist(text_pos, text_size, true, pqr[i] >= 5.));
        d_gray = min(d_gray, spin_icon_dist(text_pos, text_size, false, pqr[i] <= 2.));
        
        text_pos -= vec2(1, 0) * text_size;
        
    }
       
    float icon_size = 0.35*text_size;

    for (int row=0; row<2; ++row) {
        
        vec4 df = load4(!is_linked && row == 0 ? DFUNC0_COL : DFUNC1_COL, TARGET_ROW);
        
        for (int i=0; i<5; ++i) {
                                
            vec2 p = fragCoord.xy - dfunc_ui_box(i, row).xy;
            float idist = dfunc_icon_dist(p, icon_size, i);
            
            float dfi;
            if (i == 0) { dfi = 1. - dot(df, vec4(1)); } else { dfi = df[i-1]; }
            
            icon_dist_update(d_bg, idist, dfi != 0.);
            
        }
        
    }
    
    for (int i=0; i<4; ++i) {
        
        vec2 p = fragCoord.xy - decor_ui_box(i).xy;
        float idist = decor_icon_dist(p, icon_size, i);
        
        icon_dist_update(d_bg, idist, decorations[i] != 0.);
        
    }
    
    for (int i=0; i<2; ++i) {
        
        vec2 p = fragCoord.xy - color_ui_box(i).xy;
        bool enable = (misc.y == float(i));
        
        draw_color_icon(p, icon_size, i, enable, color);
                
    }
    
    float ldist = dfunc_icon_dist(fragCoord.xy - link_ui_box().xy, 
                                  icon_size, is_linked ? 6 : 5);
    
    icon_dist_update(d_bg, ldist, is_linked);

    vec4 rule_box = vec4(inset_ctr.x,
                         iResolution.y - 2.75*text_size,
                         0.19 * iResolution.y,
                         0.25);

    d_gray = min(d_gray, box_dist(fragCoord.xy, rule_box));
    
    rule_box.y -= 2.5*text_size;
    
    d_gray = min(d_gray, box_dist(fragCoord.xy, rule_box));
    
    color = mix(vec3(0), color, smoothstep(0.0, 1.0, d_bg.x));
    color = mix(vec3(0.4), color, smoothstep(0.0, 1.0, d_bg.y));     
    color = mix(vec3(0.2), color, smoothstep(0.0, 1.0, d_gray));     

#ifdef DEBUG_HITBOXES
    
    float d_hitbox = 1e5;
    
    d_hitbox = min(d_hitbox, length(fragCoord.xy - inset_ctr) - 1./inset_scl);

    for (int i=0; i<3; ++i) {
        d_hitbox = min(d_hitbox, box_dist(fragCoord.xy, tri_ui_box(i, -1.)));
        d_hitbox = min(d_hitbox, box_dist(fragCoord.xy, tri_ui_box(i,  1.)));
        d_hitbox = min(d_hitbox, box_dist(fragCoord.xy, char_ui_box(i)));
    }
    
    for (int i=0; i<5; ++i) {
        for (int row=0; row<2; ++row) {
            d_hitbox = min(d_hitbox, box_dist(fragCoord.xy, dfunc_ui_box(i, row)));
        }
    }
    
    for (int i=0; i<4; ++i) {
        d_hitbox = min(d_hitbox, box_dist(fragCoord.xy, decor_ui_box(i)));
    }

    for (int i=0; i<2; ++i) {
        d_hitbox = min(d_hitbox, box_dist(fragCoord.xy, color_ui_box(i)));
    }
    
    d_hitbox = min(d_hitbox, box_dist(fragCoord.xy, link_ui_box()));
    
    color = mix(vec3(1, 0, 1), color, 0.5+0.5*smoothstep(0., 1., d_hitbox));
    
#endif    
    
    color = mix(pre_gui_color, color, gui);
    
    // gamma correction
    color = pow(color, vec3(1.0/2.2));

    fragColor = vec4(color, 1);
        
}
`;

const buffA = `
// responsible for handling mouse and setting global states

vec4 data = vec4(0); // data (fragment color) to write
ivec2 fc; // current fragment coords 

// how quick to blend to target state
const float TARGET_LERP_RATE = 0.08;

// store a value in the current row (fc.y)
void store(int dst_col, vec4 dst_value) {
    if (fc.x == dst_col) { data = dst_value; }
}

//////////////////////////////////////////////////////////////////////
// do these settings represent a valid triangle?    

bool valid_pqr(vec3 pqr) {
    float s = 1./pqr.x + 1./pqr.y + 1./pqr.z;
    return s > 1. && s < 1.3;
}

//////////////////////////////////////////////////////////////////////
// helper function for below

void update_snap(inout float dmin,
                 inout int imin,
                 in int i,
                 in vec3 q,
                 in vec3 p) {
    
    float d = length(p-q);
    
    if (d < dmin) {
        dmin = d;
        imin = i;
    }
    
}

//////////////////////////////////////////////////////////////////////
// given a position q on the sphere, see if it "snaps" to one of
// three triangle vertices or four "special points"

int tri_snap(in vec3 q) {

    float dmin = 1e5;
    int imin = -1;
    
    float ds = 1e5;

    for (int i=0; i<3; ++i) {
        update_snap(dmin, imin, i, q, tri_verts[i]);
        update_snap(dmin, imin, i+3, q, tri_spoints[i]);
        ds = min(ds, length(tri_spoints[i] - tri_spoints[3]));
    }
    
    update_snap(dmin, imin, 6, q, tri_spoints[3]);

    if (dmin < max(0.5*ds, 0.125)) {        
        return imin;        
    } else {
    	return -1;
    }
    
}

//////////////////////////////////////////////////////////////////////
// helper function for below

void update_closest(inout vec4 pd, in vec3 pi, in vec3 q) {
    
    float di = length(pi-q);
    
    if (di < pd.w) { 
        pd.xyz = pi;
        pd.w = di;
    }
    
}

//////////////////////////////////////////////////////////////////////
// if q is in the triangle, return q; otherwise return closest point
// in triangle to q

vec3 tri_closest(vec3 q) {

    if (min(dot(q, tri_edges[0]), 
            min(dot(q, tri_edges[1]), dot(q, tri_edges[2]))) > 0.) {
        
        return q;

    } else {

        vec4 pd = vec4(1e5);
        
        for (int i=0; i<3; ++i) {
            
            update_closest(pd, tri_verts[i], q);

            int j = (i+1)%3;
            int k = 3-i-j;

            vec3 Tji = tri_verts[j] - tri_verts[i];
            
            float u = clamp(dot(q - tri_verts[i], Tji) / dot(Tji, Tji), 0., 1.);
            vec3 p = normalize(tri_verts[i] + u*Tji);
            
            update_closest(pd, p, q);

        }
        
        return pd.xyz;
        
    }

    
}

//////////////////////////////////////////////////////////////////////
// handle clicking in bottom right inset depicting sphere

void gui_vertex_update() {    

    if (fc.x != BARY_COL && fc.x != SPSEL_COL) { return; }

    if (length(iMouse.zw - inset_ctr)*inset_scl > 1.) {       

        return; 
        
    } else {

        vec3 q = sphere_from_gui(iMouse.xy);
        
        vec4 spsel;
        int s = tri_snap(q);

        if (abs(iMouse.zw) == iMouse.xy && s >= 0) {
            if (s < 3) {
                if (fc.x == BARY_COL) {
                    data.xyz = bary_from_sphere( tri_verts[s] );
                } else {
                    data = vec4(0);
                }
            } else { 
                if (fc.x == BARY_COL) {
                    data.xyz = bary_from_sphere( tri_spoints[s-3] );
                } else {
                    data = vec4(0);
                    data[s-3] = 1.;
                }
            }
        } else {
            if (fc.x == BARY_COL) {
                data.xyz = bary_from_sphere( tri_closest(q) );
            } else {
                data = vec4(0);
            }
        }

    }
    
}

//////////////////////////////////////////////////////////////////////
// handle clicking triangle spin boxes 

void gui_pqr_update() {
    
    if (fc.x != PQR_COL) { return; }
    
    for (int i=0; i<3; ++i) {

        int j = (i+1)%3;
        int k = 3-i-j;

        for (float delta=-1.; delta <= 1.; delta += 2.) {
            
            bool enabled = (delta < 0.) ? data[i] > 2. : data[i] < 5.;
            if (!enabled) { continue; }

            float d = box_dist(iMouse.xy, tri_ui_box(i, delta));       
            if (d > 0.) { continue; }

            data[i] += delta;
            
            int iopp = delta*data[j] > delta*data[k] ? j : k;
            
            for (int cnt=0; cnt<5; ++cnt) {
                if (valid_pqr(data.xyz)) { continue; }
                data[iopp] -= delta; 
            }   
            
        }
    }

}

//////////////////////////////////////////////////////////////////////
// handle polyhedron rotation (time based or mouse based)

void gui_theta_update() {
    
    if (fc.x != THETA_COL) { return; }
    
    if (iMouse.z > 2.*inset_ctr.x && iMouse.w > 0.) {
        
        // mouse down somewhere in the pane but not in GUI panel    
        
    	if ( length(iMouse.zw - object_ctr) < 0.45 * iResolution.y) {

            // down somewhere near object
            vec2 disp = (iMouse.xy - object_ctr) * 0.01;
            data.xyz = vec3(-disp.y, disp.x, 1);
            
        } else {
            
            // down far from object
            data.z = 0.;
            
        }
        
    }
    
        
    if (data.z == 0.) {
        float t = iTime;
        data.x = t * 2.*PI/6.; 
        data.y = t * 2.*PI/18.;
    }    
    
}

//////////////////////////////////////////////////////////////////////
// handle clicking on distance function selectors

void gui_dfunc_update() {
    
    if (!(fc.x == DFUNC0_COL || fc.x == DFUNC1_COL)) { return; }
        
    bool is_linked = (load(MISC_COL, TARGET_ROW).x != 0.);

    for (int row=0; row<2; ++row) {  

        int col_for_row = (row == 0 ? DFUNC0_COL : DFUNC1_COL);

        for (int i=0; i<5; ++i) {

            bool update = ( (is_linked && fc.x == DFUNC1_COL) || 
                           (!is_linked && fc.x == col_for_row) );

            if (update) {

                if (box_dist(iMouse.xy, dfunc_ui_box(i, row)) < 0.) {
                    data = vec4(0);
                    if (i > 0) { data[i-1] = 1.; }
                }

            }
        }

    }

}

//////////////////////////////////////////////////////////////////////
// handle clicking on chain link icon or color selectors

void gui_misc_update() {
    
    if (fc.x != MISC_COL) { return; }
        
    if (box_dist(iMouse.xy, link_ui_box()) < 0.) {
        data.x = 1. - data.x;
    }
    
    for (int i=0; i<2; ++i) {
        if (box_dist(iMouse.xy, color_ui_box(i)) < 0.) {
            data.y = float(i);
        }
    }
    
}

//////////////////////////////////////////////////////////////////////
// handle clicking on decoration icons

void gui_decor_update() {
    
    if (fc.x != DECOR_COL) { return; }
    
    for (int i=0; i<4; ++i) {
        if (box_dist(iMouse.xy, decor_ui_box(i)) < 0.) {
            data[i] = 1. - data[i];
        }
    }
    
}

//////////////////////////////////////////////////////////////////////
// main "rendering" function

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    
    fc = ivec2(fragCoord);
    
    data = texelFetch(iChannel0, fc, 0);        
               
    vec4 pqrx = load(PQR_COL, TARGET_ROW);

    float gui = 1.0 - texelFetch(iChannel1, ivec2(32, 2), 0).x;

    if (iFrame == 0) {

        // on first frame, store in default values
        store(PQR_COL, vec4(5, 3, 2, iTime));
        store(THETA_COL, vec4(0, 0, 0, 1));
        store(BARY_COL, vec4(0, 0, 0, 0));
        store(SPSEL_COL, vec4(0, 0, 0, 1));
        store(DFUNC1_COL, vec4(0, 1, 0, 0));
        store(DFUNC0_COL, vec4(0, 0, 0, 1));        
        store(DECOR_COL, vec4(1));
        store(MISC_COL, vec4(0, 0, gui, 1));

    } else if (fc.y == TARGET_ROW) {
        
    	// target values are set by UI    
        setup_gui(iResolution.xy, gui);
        setup_triangle(pqrx.xyz);                   

        float cur_mouse_state = min(iMouse.z, iMouse.w) > 0. ? 1. : -1.;
        bool click = (cur_mouse_state == 1. && pqrx.w <= 0.);       

        if (fc.x == PQR_COL) {
            data.w = cur_mouse_state * iTime;
        } 
        if (fc.x == MISC_COL) {
            data.z = gui;
        }
        
        float current_gui = load(MISC_COL, CURRENT_ROW).z;

        if (current_gui > 0.95) {
            
            if (click) { 
                gui_pqr_update(); 
                gui_dfunc_update(); 
                gui_decor_update(); 
                gui_misc_update(); 
            }

            gui_vertex_update();        
            
        }

        gui_theta_update();
            
        
    } else {
        
        vec4 cpqrx = load(PQR_COL, CURRENT_ROW);
        float dt = iTime - cpqrx.w;
        
        // current values are set by lerping towards target
        vec4 target = load(fc.x, TARGET_ROW);         
        
        if (dt == 0.) {
            data = target;
        } else {
            data = mix(data, target, TARGET_LERP_RATE);       
        }
        
        if (fc.x == PQR_COL) {
            data.w = abs(pqrx.w);
        }
        
    }
        
    fragColor = data;
    
}`;

const buffB = `
// distance marches and shades the polyhedron

const int rayiter = 8;
vec3 L = normalize(vec3(-0.7, 1.0, -1.0));

const float dmin = 2.0;
const float dmax = 5.0;

vec4 distance_function;
float shade_per_face;
float bg_value;
vec4 decorations;

//////////////////////////////////////////////////////////////////////
// data structure for polyhedron distance queries

struct query_t {
    
    int vidx; // index of triangle vertex
    int eidx; // index of triangle edge
    
    float fdist_vertex; // 3D distance to closest vertex
    float fdist_edge;   // 3D distance to closest edge/vertex
    float fdist_face;   // 3D distance to closest face/edge/vertex
    
    float pdist_tri;       // distance to triangle cutting plane
    float pdist_poly_edge; // SIGNED distance to polyhedron edge cutting plane (pass thru ctr)
    float pdist_poly_perp; // perpendicular distance to polyhedron edge (parallel to face)
    float pdist_bisector;  // distance to polyhedron edge bisector cutting plane
    
    mat3 M; // 3D flip to move point inside spherical triangle
    
};

//////////////////////////////////////////////////////////////////////
// wythoff construction - the workhorse of the distance estimator.

void construct(in vec3 pos, out query_t Q) {     
    
    // flip point to land within spherical triangle
    Q.M = tile_sphere(pos);
       
    // position relative to vertex
    vec3 rel_pos = pos - poly_vertex;
    
    // initialize data structure members that get updated 
    // as the loop progresses
    Q.fdist_vertex = length(rel_pos);
    Q.fdist_edge = Q.fdist_vertex;
    Q.pdist_tri = 1e5;
             
    // for each potential face edge (perpendicular to each tri. edge)
    for (int eidx=0; eidx<3; ++eidx) {   
        
        vec3 tri_edge = tri_edges[eidx];
        
        // update distance to triangle
        Q.pdist_tri = min(Q.pdist_tri, dot(pos, tri_edge));
        
        // signed distance of polyhedron vertex poly_vertex from edge plane
        float V_tri_dist = dot(poly_vertex, tri_edge);
        
        // polyhedron edge cut plane (passes thru origin and V, perpendicular
        // to triangle edge)
        vec3 poly_edge = poly_edges[eidx];
                                
        // signed distance from point to face edge
        float poly_edge_dist = dot(pos, poly_edge);

        // triangle vertex on the same side of face edge as point
        int vidx = (eidx + (poly_edge_dist > 0. ? 2 : 1)) % 3;
        
        // see which side of the vertex we are on
        float rel_tri_dist = dot(rel_pos, tri_edge);
        
		// update distance to edge        
        Q.fdist_edge = min(Q.fdist_edge, length(rel_pos - min(rel_tri_dist, 0.) * tri_edge));     
       
        // construct at the other polyhedron edge associated with the given
        // triangle vertex
        vec3 other_poly_edge = poly_edges[3-eidx-vidx];
        
        // construct the plane that bisects the two polyhedron edges
        vec3 bisector = cross(poly_vertex, poly_edge - other_poly_edge);
        
        float bisector_dist = dot(pos, bisector);
             
        if (bisector_dist > 0.) {
            // if we are on the correct side of the associated
            // bisector, than we have found the closest triangle
            // edge & vertex.
            
            Q.pdist_bisector = bisector_dist;
            Q.pdist_poly_edge = poly_edge_dist;
            Q.eidx = eidx;
            Q.vidx = vidx;
            
        }
 
    }
    
    // computing the perpendicular distance away from
    // the polyhedron edges was a bit hairy. there
    // was probably a better way to do this.
    
    // initialize to zero
    Q.pdist_poly_perp = 1e5;

    // for each triangle vertex
    for (int vidx=0; vidx<3; ++vidx) {
        
        if (!is_face_normal[vidx]) { continue; }

        vec3 tri_vertex = tri_verts[vidx];

        // midpoint of polyhedron face
        vec3 P = tri_vertex * dot(poly_vertex, tri_vertex);

        // initial big negative perpendicular distance
        float pp = -1e5;

        // for each triangle edge associated with the vertex
        for (int j=0; j<2; ++j) {

            int eidx = (vidx+j+1)%3;

            // constructed same as big for loop above
            vec3 tri_edge = tri_edges[eidx];           

            // midpoint of polyhedron edge
            vec3 F = poly_vertex - dot(poly_vertex, tri_edge)*tri_edge;

            // mix in signed distance perpendicular to edge
            pp = max(pp, dot(rel_pos, normalize(F - P)));

        }

        Q.pdist_poly_perp = min(Q.pdist_poly_perp, pp); 
        
    }

    if (Q.pdist_poly_perp < 0.) {
        // only use true distance to face if we are "above" it
        Q.fdist_face = dot(rel_pos, tri_verts[Q.vidx]);
    } else {
        // otherwise just use distance to edge
        Q.fdist_face = Q.fdist_edge;
    }
        
}

//////////////////////////////////////////////////////////////////////
// distance estimator weighs a linear combination of different
// distance functions

vec2 map(in vec3 pos) {
    
    query_t Q;
    
    construct(pos, Q);
    
    mat4x2 tm;
    
    // distance to sphere
    vec2 sphere = vec2(length(pos)-1., 2);
    
    // distance to polyhedron
	tm[0] = vec2(Q.fdist_face, 2);
    
    // distance to ball-and-stick web (cylinders/spheres)
    vec2 dv = vec2(Q.fdist_vertex-0.07, 0);
    vec2 de = vec2(Q.fdist_edge-0.04, 1);    
    tm[1] = dv.x < de.x ? dv : de;                  

    // distance to polyhedral net (faceted edges)
    tm[2] = vec2(max(-(Q.pdist_poly_perp+0.08),
                     max(Q.fdist_face, -0.08-Q.fdist_face)), 1);
    
    // distance to polyhedron dilated by sphere
    tm[3] = vec2(Q.fdist_face-0.15, 2);
          
    // sphere coefficient
    float k = 1.0 - dot(distance_function, vec4(1));
    
    // return final linear combination
    return (k*sphere + tm * distance_function);

}

//////////////////////////////////////////////////////////////////////
// IQ's normal calculation. 

vec3 calcNormal( in vec3 pos ) {
    vec3 eps = vec3( 0.01, 0.0, 0.0 );
    vec3 nor = vec3(
        map(pos+eps.xyy).x - map(pos-eps.xyy).x,
        map(pos+eps.yxy).x - map(pos-eps.yxy).x,
        map(pos+eps.yyx).x - map(pos-eps.yyx).x );
    return normalize(nor);
}


//////////////////////////////////////////////////////////////////////
// IQ's distance marcher. 

vec2 castRay( in vec3 ro, in vec3 rd ) {

    const float precis = 0.001;   
    float h=dmin;

    float t = 0.0;
    float m = -1.0;

    for( int i=0; i<40; i++ ) {

        if( abs(h)<precis||t>dmax ) continue;//break;
        t += h;
        vec2 res = map( ro+rd*t );
        h = res.x;
        m = res.y;        
        
    }    

    if (t > dmax) {
        m = -1.0;
    }

    return vec2(t, m);

}


//////////////////////////////////////////////////////////////////////
// coloring function for surface shading - input is position and
// material (0=vertex, 1=edge, 2=face)

vec3 poly_color(vec3 pos, float material) {

    // do our distance query with the given point
    query_t Q;
    construct(pos, Q);
    
    // this would be an odd failure but it happened
    // sometimes during debugging
    if (Q.vidx < 0) {return vec3(0.9); }

    // "standard" blue/yellow/red vertex colors
    const mat3 std_fcolors = mat3(vec3(0, 0, 1),
                               vec3(1, 1, 0),
                               vec3(1, 0, 0));

    // for coloring with faces - gives a nice contrast to 
    // the bgcolors above
    const mat3 std_ecolors = mat3(vec3(1, 0.5, 0),
                              vec3(0.5, 0, 1),
                              vec3(0, 0.5, 0));

    const vec3 std_vert = vec3(0.1, 0.2, 0.5);
    
    ////////////////////////////////////////////////////////////
    // start setting up some AA for face coloring
    //
    // Q.vidx is the index of the triangle vertex that forms
    // the normal of this face
    //
    // Q.eidx is the index of the triangle edge perpendicular
    // to the polyhedron edge
    // 
    // now we want to find the index of the triangle vertex
    // which lies *across* this polyhedron edge (this is for
    // anti-aliasing using the "standard" color scheme
    
    // start with other vertex on this triangle edge, 
    // and see if it is also on this polyhedron edge
    int vidx2 = 3 - Q.vidx - Q.eidx;                    

    vec3 opposite_tri_vertex = tri_verts[vidx2];
    float opp_on_edge = abs(dot(opposite_tri_vertex, poly_edges[Q.eidx]));

    // if so, then the same triangle vertex is used as normal
    // for both faces (just in an adjacent triangle)
    if (opp_on_edge < TOL) { vidx2 = Q.vidx; }
    
    vec3 tri_vert2 = tri_verts[vidx2];

    if (vidx2 == Q.vidx) {
         tri_vert2 = reflect(tri_vert2, poly_edges[Q.eidx]);
    }

    // hacked scaling factor for antialiasing -- should probably
    // be based on ray differentials, but in practice this works fine
    float s = 2.5/iResolution.y;

    // blend coefficient for blending between two different face colors
    float u_face_aa = smoothstep(-0.5*s, 0.5*s, abs(Q.pdist_poly_edge));

    // get antialiased standard face color and face normal
    vec3 std_face_aa = mix(std_fcolors[vidx2], std_fcolors[Q.vidx], u_face_aa);
    vec3 sph_face_aa = mix(tri_vert2, tri_verts[Q.vidx], u_face_aa);
    
    ////////////////////////////////////////////////////////////
    // AA for edge coloring

    // get blended edge color (probably a smarter way to antialias)
    vec3 std_edge_aa = mix(std_ecolors*vec3(0.33333), std_ecolors[Q.eidx],
                           smoothstep(0., s, Q.pdist_bisector));

    // midpoint of closest polygon edge
    vec3 edge_midpoint = poly_vertex - dot(tri_edges[Q.eidx], poly_vertex)*tri_edges[Q.eidx];

    // plane splitting face thru polyhedron vertex and face center
    vec3 face_split = normalize(cross(tri_verts[Q.vidx], poly_vertex));
    
    // same midpoint across splitline
    vec3 opp_edge_midpoint = reflect(edge_midpoint, face_split);

    // edges should blend together at polyhedron vertex
    vec3 sph_edge_aa = mix(poly_vertex, edge_midpoint,
                         smoothstep(0., s, Q.pdist_bisector));
    
    // edges should blend together near corners of face
    sph_edge_aa = mix(opp_edge_midpoint, sph_edge_aa,
                      smoothstep(-0.5*s, 0.5*s, abs(dot(pos, Q.M*face_split))));

    ////////////////////////////////////////////////////////////
    // now put it all together

    // blend between standard and spherical shading
    vec3 face = mix(std_face_aa, 0.5*(Q.M*sph_face_aa)+0.5, shade_per_face);
    vec3 edge = mix(std_edge_aa, 0.5*(Q.M*sph_edge_aa)+0.5, shade_per_face);
    vec3 vert = mix(std_vert, 0.25*(Q.M*poly_vertex)+0.75, shade_per_face);

    // blend face, verts, edges with decorations
    vec3 color = face;
    
    // vertex and polyhedron edge decorations affect just face
    float scaled_vertex_distance = length(pos - Q.M*poly_vertex*length(pos));
    color *= mix(1.0, 0.0, 
                max(decorations.x*smoothstep(s, 0.0, scaled_vertex_distance-0.02),
                    decorations.y*smoothstep(s, 0.0, abs(Q.pdist_poly_edge)-.5*s)));

    // edge colors
    color = mix(color, edge, clamp(2. - material, 0.0, 1.0));

    // parity & triangle edges affect face & edge
    float parity = dot(Q.M[0], cross(Q.M[1], Q.M[2]));
    
    color *= mix(1.0, 0.8, decorations.w*smoothstep(0.5*s, -0.5*s, parity*Q.pdist_tri));
    color *= mix(1.0, 0.5, decorations.z*smoothstep(s, 0.0, abs(Q.pdist_tri)));        

    // vertex colors
    color = mix(color, vert, clamp(1. - material, 0.0, 1.0));
    
    //done
    return color;
    
}

//////////////////////////////////////////////////////////////////////
// trace ray & determine fragment color

vec4 shade( in vec3 ro, in vec3 rd ){

    vec2 tm = castRay(ro, rd);        

    vec3 c;

    if (tm.y < 0.0) {

        tm.x = dmax;
        c = vec3(bg_value);

    } else {        

        vec3 pos = ro + tm.x*rd;
               
        vec3 n = calcNormal(pos);
        
        vec3 color = poly_color(pos, tm.y);
        
        vec3 diffamb = (0.9*clamp(dot(n,L), 0.0, 1.0)+0.1) * color;
        
        vec3 p = normalize(pos);
        
        vec3 refl = 2.0*n*dot(n,L)-L;
        float spec = 0.4*pow(clamp(-dot(refl, rd), 0.0, 1.0), 20.0);
        c = diffamb + spec;
        
        c *= 0.4*dot(p, n) + 0.6;
        

    }

    return vec4(c, tm.x);

}

//////////////////////////////////////////////////////////////////////
// generate polyhedron image finally

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    
#ifdef STEREOGRAPHIC_POLAR    
    
    fragColor = vec4(1, 1, 1, dmax); 
        
#else    
    
    ////////////////////////////////////////////////////////////
    // load in settings from GUI manager
    
    // load triangle shape & rotation from target row (set directly)
    vec4 pqrx = load4(PQR_COL, TARGET_ROW);        
    vec4 theta = load4(THETA_COL, TARGET_ROW);  

    vec4 cpqrx = load4(PQR_COL, CURRENT_ROW);
    float dt = iTime - cpqrx.w;
    
    int active_row = CURRENT_ROW;
    
    if (dt == 0.) {
        active_row = TARGET_ROW;
    }

    // all other params change continuously
    bary_poly_vertex = load3(BARY_COL, active_row);
    spoint_selector = load4(SPSEL_COL, active_row);    
    vec4 misc = load4(MISC_COL, active_row);
    vec4 df1 = load4(DFUNC1_COL, active_row);    
    vec4 df0 = mix(load4(DFUNC0_COL, active_row), df1, misc.x);
    decorations = load4(DECOR_COL, active_row);

    shade_per_face = misc.y;
    bg_value = misc.w;
    
    distance_function = mix(df0, df1, smoothstep(0.25, 0.75, fragCoord.y/iResolution.y));
                        
    setup_triangle(pqrx.xyz); 
    setup_gui(iResolution.xy, misc.z);
    
    ////////////////////////////////////////////////////////////
    // pretty normal raymarcher/renderer from here on out
    // only twist is that emit ray distance along with
    // color to final buffer in order to do AA along 
    // depth discontinuities

    vec2 uv = (fragCoord.xy - object_ctr) * 0.8 / (iResolution.y);
    
    const vec3 tgt = vec3(0.0, 0.0, 0.0);
    const vec3 cpos = vec3(0.0, 0.0, 3.25);
    const vec3 up = vec3(0, 1, 0);

    vec3 rz = normalize(tgt - cpos),
        rx = normalize(cross(rz,vec3(0,1.,0))),
        ry = cross(rx,rz);


    mat3 Rview = mat3(rx,ry,rz)*rotY(theta.y)*rotX(theta.x); 
    L = Rview*L;

    vec3 rd = Rview*normalize(vec3(uv, 1.));
    vec3 ro = tgt + Rview*vec3(0,0,-length(cpos-tgt));

    fragColor = shade(ro, rd);
    
#endif
    
}
`;

export default class implements iSub {
  key(): string {
    return 'Md3yRB';
  }
  name(): string {
    return 'Wythoff explorer';
  }
  // sort() {
  //   return 0;
  // }
  common() {
    return common;
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
      { type: 1, f: buffA, fi: 0 },
      { type: 1, f: buffB, fi: 1 },
      webglUtils.FONT_TEXTURE, //
    ];
  }
}
