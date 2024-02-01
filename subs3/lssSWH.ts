import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// #define GLSLSANDBOX

#ifdef GLSLSANDBOX
#ifdef GL_ES
#endif
uniform float time;
uniform vec2 mouse;
uniform vec2 resolution;
#define iTime time
#define iResolution resolution
#define iMouse mouse
#endif

// interface
//////////////////////////////////////////////////////////

// set color source for stroke / fill / clear
void set_source_rgba(vec4 c);
void set_source_rgba(float r, float g, float b, float a);
void set_source_rgb(vec3 c);
void set_source_rgb(float r, float g, float b);
void set_source_linear_gradient(vec3 color0, vec3 color1, vec2 p0, vec2 p1);
void set_source_linear_gradient(vec4 color0, vec4 color1, vec2 p0, vec2 p1);
void set_source_radial_gradient(vec3 color0, vec3 color1, vec2 p, float r);
void set_source_radial_gradient(vec4 color0, vec4 color1, vec2 p, float r);
void set_source(sampler2D image);
// control how source changes are applied
const int Replace = 0; // default: replace the new source with the old one
const int Alpha = 1; // alpha-blend the new source on top of the old one
const int Multiply = 2; // multiply the new source with the old one
void set_source_blend_mode(int mode);
// if enabled, blends using premultiplied alpha instead of
// regular alpha blending.
void premultiply_alpha(bool enable);

// set line width in normalized units for stroke
void set_line_width(float w);
// set line width in pixels for stroke
void set_line_width_px(float w);
// set blur strength for strokes in normalized units
void set_blur(float b);

// add a circle path at P with radius R
void circle(vec2 p, float r);
void circle(float x, float y, float r);
// add an ellipse path at P with radii RW and RH
void ellipse(vec2 p, vec2 r);
void ellipse(float x, float y, float rw, float rh);
// add a rectangle at O with size S
void rectangle(vec2 o, vec2 s);
void rectangle(float ox, float oy, float sx, float sy);
// add a rectangle at O with size S and rounded corner of radius R
void rounded_rectangle(vec2 o, vec2 s, float r);
void rounded_rectangle(float ox, float oy, float sx, float sy, float r);

// set starting point for curves and lines to P
void move_to(vec2 p);
void move_to(float x, float y);
// draw straight line from starting point to P,
// and set new starting point to P
void line_to(vec2 p);
void line_to(float x, float y);
// draw quadratic bezier curve from starting point
// over B1 to B2 and set new starting point to B2
void curve_to(vec2 b1, vec2 b2);
void curve_to(float b1x, float b1y, float b2x, float b2y);
// connect current starting point with first
// drawing point.
void close_path();

// clear screen in the current source color
void clear();
// fill paths and clear the path buffer
void fill();
// fill paths and preserve them for additional ops
void fill_preserve();
// stroke paths and clear the path buffer
void stroke_preserve();
// stroke paths and preserve them for additional ops
void stroke();
// clears the path buffer
void new_path();

// draw a letter with the given texture coordinate
void letter(sampler2D font_texture_source, ivec2 l);
void letter(sampler2D font_texture_source, int lx, int ly);
    
// return rgb color for given hue (0..1)
vec3 hue(float hue);
// return rgb color for given hue, saturation and lightness
vec3 hsl(float h, float s, float l);
vec4 hsl(float h, float s, float l, float a);

// rotate the context by A in radians
void rotate(float a);
// uniformly scale the context by S
void scale(float s);
// non-uniformly scale the context by S
void scale(vec2 s);
void scale(float sx, float sy);
// translate the context by offset P
void translate(vec2 p);
void translate(float x, float y);
// clear all transformations for the active context
void identity_matrix();
// transform the active context by the given matrix
void transform(mat3 mtx);
// set the transformation matrix for the active context
void set_matrix(mat3 mtx);

// return the active query position for in_fill/in_stroke
// by default, this is the mouse position
vec2 get_query();
// set the query position for subsequent calls to
// in_fill/in_stroke; clears the query path
void set_query(vec2 p);
// true if the query position is inside the current path
bool in_fill();
// true if the query position is inside the current stroke
bool in_stroke();

// return the transformed coordinate of the current pixel
vec2 get_origin();
// draw a 1D graph from coordinate p, result f(p.x),
// and gradient1D(f,p.x)
void graph(vec2 p, float f_x, float df_x);
// draw a 2D graph from coordinate p, result f(p),
// and gradient2D(f,p)
void graph(vec2 p, float f_x, vec2 df_x);
// adds a custom distance field as path
// this field will not be testable by queries
void add_field(float c);

// returns a gradient for 1D graph function f at position x
#define gradient1D(f,x) (f(x + get_gradient_eps()) - f(x - get_gradient_eps())) / (2.0*get_gradient_eps())
// returns a gradient for 2D graph function f at position x
#define gradient2D(f,x) vec2(f(x + vec2(get_gradient_eps(),0.0)) - f(x - vec2(get_gradient_eps(),0.0)),f(x + vec2(0.0,get_gradient_eps())) - f(x - vec2(0.0,get_gradient_eps()))) / (2.0*get_gradient_eps())
// draws a 1D graph at the current position
#define graph1D(f) { vec2 pp = get_origin(); graph(pp, f(pp.x), gradient1D(f,pp.x)); }
// draws a 2D graph at the current position
#define graph2D(f) { vec2 pp = get_origin(); graph(pp, f(pp), gradient2D(f,pp)); }

// represents the current drawing context
// you usually don't need to change anything here
struct Context {
    // screen position, query position
    vec4 position;
    vec2 shape;
    vec2 clip;
    vec2 scale;
    float line_width;
    bool premultiply;
    vec2 blur;
    vec4 source;
    vec2 start_pt;
    vec2 last_pt;
    int source_blend;
    bool has_clip;
};

// save current stroke width, starting
// point and blend mode from active context.
Context _save();
#define save(name) Context name = _save();
// restore stroke width, starting point
// and blend mode to a context previously returned by save()
void restore(Context ctx);

// draws a half-transparent debug gradient for the
// active path
void debug_gradient();
void debug_clip_gradient();
// returns the gradient epsilon width
float get_gradient_eps();


// implementation
//////////////////////////////////////////////////////////

vec2 aspect;
vec2 uv;
vec2 position;
vec2 query_position;
float ScreenH;
float AA;
float AAINV;

//////////////////////////////////////////////////////////

float det(vec2 a, vec2 b) { return a.x*b.y-b.x*a.y; }

//////////////////////////////////////////////////////////

vec3 hue(float hue) {
    return clamp(
        abs(mod(hue * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0,
        0.0, 1.0);
}

vec3 hsl(float h, float s, float l) {
    vec3 rgb = hue(h);
    return l + s * (rgb - 0.5) * (1.0 - abs(2.0 * l - 1.0));
}

vec4 hsl(float h, float s, float l, float a) {
    return vec4(hsl(h,s,l),a);
}

//////////////////////////////////////////////////////////

#define DEFAULT_SHAPE_V 1e+20
#define DEFAULT_CLIP_V -1e+20

Context _stack;

void init (vec2 fragCoord, vec2 mouse, vec2 resolution) {
	aspect = vec2(resolution.x / resolution.y, 1.0);
	ScreenH = min(resolution.x,resolution.y);
	AA = ScreenH*0.4;
	AAINV = 1.0 / AA;
    
    uv = fragCoord.xy / resolution;
    vec2 m = mouse / resolution;

    position = (uv*2.0-1.0)*aspect;
    query_position = (m*2.0-1.0)*aspect;

    _stack = Context(
        vec4(position, query_position),
        vec2(DEFAULT_SHAPE_V),
        vec2(DEFAULT_CLIP_V),
        vec2(1.0),
        1.0,
        false,
        vec2(0.0,1.0),
        vec4(vec3(0.0),1.0),
        vec2(0.0),
        vec2(0.0),
        Replace,
        false
    );
}

vec3 _color = vec3(1.0);

vec2 get_origin() {
    return _stack.position.xy;
}

vec2 get_query() {
    return _stack.position.zw;
}

void set_query(vec2 p) {
    _stack.position.zw = p;
    _stack.shape.y = DEFAULT_SHAPE_V;
    _stack.clip.y = DEFAULT_CLIP_V;
}

Context _save() {
    return _stack;
}

void restore(Context ctx) {
    // preserve shape
    vec2 shape = _stack.shape;
    vec2 clip = _stack.clip;
    bool has_clip = _stack.has_clip;
    // preserve source
    vec4 source = _stack.source;
    _stack = ctx;
    _stack.shape = shape;
    _stack.clip = clip;
    _stack.source = source;
    _stack.has_clip = has_clip;
}

mat3 mat2x3_invert(mat3 s)
{
    float d = det(s[0].xy,s[1].xy);
    d = (d != 0.0)?(1.0 / d):d;

    return mat3(
        s[1].y*d, -s[0].y*d, 0.0,
        -s[1].x*d, s[0].x*d, 0.0,
        det(s[1].xy,s[2].xy)*d,
        det(s[2].xy,s[0].xy)*d,
        1.0);
}

void identity_matrix() {
    _stack.position = vec4(position, query_position);
    _stack.scale = vec2(1.0);
}

void set_matrix(mat3 mtx) {
    mtx = mat2x3_invert(mtx);
    _stack.position.xy = (mtx * vec3(position,1.0)).xy;
    _stack.position.zw = (mtx * vec3(query_position,1.0)).xy;
    _stack.scale = vec2(length(mtx[0].xy), length(mtx[1].xy));
}

void transform(mat3 mtx) {
    mtx = mat2x3_invert(mtx);
    _stack.position.xy = (mtx * vec3(_stack.position.xy,1.0)).xy;
    _stack.position.zw = (mtx * vec3(_stack.position.zw,1.0)).xy;
    _stack.scale *= vec2(length(mtx[0].xy), length(mtx[1].xy));
}

void rotate(float a) {
    float cs = cos(a), sn = sin(a);
    transform(mat3(
        cs, sn, 0.0,
        -sn, cs, 0.0,
        0.0, 0.0, 1.0));
}

void scale(vec2 s) {
    transform(mat3(s.x,0.0,0.0,0.0,s.y,0.0,0.0,0.0,1.0));
}

void scale(float sx, float sy) {
    scale(vec2(sx, sy));
}

void scale(float s) {
    scale(vec2(s));
}

void translate(vec2 p) {
    transform(mat3(1.0,0.0,0.0,0.0,1.0,0.0,p.x,p.y,1.0));
}

void translate(float x, float y) { translate(vec2(x,y)); }

void clear() {
    _color = mix(_color, _stack.source.rgb, _stack.source.a);
}

void blit(out vec4 dest) {
    dest = vec4(sqrt(_color), 1.0);
}

void blit(out vec3 dest) {
    dest = _color;
}

void add_clip(vec2 d) {
    d = d / _stack.scale;
    _stack.clip = max(_stack.clip, d);
    _stack.has_clip = true;
}

void add_field(vec2 d) {
    d = d / _stack.scale;
    _stack.shape = min(_stack.shape, d);
}

void add_field(float c) {
    _stack.shape.x = min(_stack.shape.x, c);
}

void new_path() {
    _stack.shape = vec2(DEFAULT_SHAPE_V);
    _stack.clip = vec2(DEFAULT_CLIP_V);
    _stack.has_clip = false;
}

void debug_gradient() {
    vec2 d = _stack.shape;
    _color = mix(_color,
        hsl(d.x * 6.0,
            1.0, (d.x>=0.0)?0.5:0.3),
        0.5);
}

void debug_clip_gradient() {
    vec2 d = _stack.clip;
    _color = mix(_color,
        hsl(d.x * 6.0,
            1.0, (d.x>=0.0)?0.5:0.3),
        0.5);
}

void set_blur(float b) {
    if (b == 0.0) {
        _stack.blur = vec2(0.0, 1.0);
    } else {
        _stack.blur = vec2(
            b,
            0.0);
    }
}

void write_color(vec4 rgba, float w) {
    float src_a = w * rgba.a;
    float dst_a = _stack.premultiply?w:src_a;
    _color = _color * (1.0 - src_a) + rgba.rgb * dst_a;
}

void premultiply_alpha(bool enable) {
    _stack.premultiply = enable;
}

float min_uniform_scale() {
    return min(_stack.scale.x, _stack.scale.y);
}

float uniform_scale_for_aa() {
    return min(1.0, _stack.scale.x / _stack.scale.y);
}

float calc_aa_blur(float w) {
    vec2 blur = _stack.blur;
    w -= blur.x;
    float wa = clamp(-w*AA*uniform_scale_for_aa(), 0.0, 1.0);
    float wb = clamp(-w / blur.x + blur.y, 0.0, 1.0);
	return wa * wb;
}

void fill_preserve() {
    write_color(_stack.source, calc_aa_blur(_stack.shape.x));
    if (_stack.has_clip) {
	    write_color(_stack.source, calc_aa_blur(_stack.clip.x));        
    }
}

void fill() {
    fill_preserve();
    new_path();
}

void set_line_width(float w) {
    _stack.line_width = w;
}

void set_line_width_px(float w) {
    _stack.line_width = w*min_uniform_scale() * AAINV;
}

float get_gradient_eps() {
    return (1.0 / min_uniform_scale()) * AAINV;
}

vec2 stroke_shape() {
    return abs(_stack.shape) - _stack.line_width/_stack.scale;
}

void stroke_preserve() {
    float w = stroke_shape().x;
    write_color(_stack.source, calc_aa_blur(w));
}

void stroke() {
    stroke_preserve();
    new_path();
}

bool in_fill() {
    return (_stack.shape.y <= 0.0);
}

bool in_stroke() {
    float w = stroke_shape().y;
    return (w <= 0.0);
}

void set_source_rgba(vec4 c) {
    //c.rgb *= c.rgb;
    c *= c;
    if (_stack.source_blend == Multiply) {
        _stack.source *= c;
    } else if (_stack.source_blend == Alpha) {
    	float src_a = c.a;
    	float dst_a = _stack.premultiply?1.0:src_a;
	    _stack.source =
            vec4(_stack.source.rgb * (1.0 - src_a) + c.rgb * dst_a,
                 max(_stack.source.a, c.a));
    } else {
    	_stack.source = c;
    }
}

void set_source_rgba(float r, float g, float b, float a) {
    set_source_rgba(vec4(r,g,b,a)); }

void set_source_rgb(vec3 c) {
    set_source_rgba(vec4(c,1.0));
}

void set_source_rgb(float r, float g, float b) { set_source_rgb(vec3(r,g,b)); }

void set_source(sampler2D image) {
    set_source_rgba(texture(image, _stack.position.xy));
}

void set_source_linear_gradient(vec4 color0, vec4 color1, vec2 p0, vec2 p1) {
    vec2 pa = _stack.position.xy - p0;
    vec2 ba = p1 - p0;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    set_source_rgba(mix(color0, color1, h));
}

void set_source_linear_gradient(vec3 color0, vec3 color1, vec2 p0, vec2 p1) {
    set_source_linear_gradient(vec4(color0, 1.0), vec4(color1, 1.0), p0, p1);
}

void set_source_radial_gradient(vec4 color0, vec4 color1, vec2 p, float r) {
    float h = clamp( length(_stack.position.xy - p) / r, 0.0, 1.0 );
    set_source_rgba(mix(color0, color1, h));
}

void set_source_radial_gradient(vec3 color0, vec3 color1, vec2 p, float r) {
    set_source_radial_gradient(vec4(color0, 1.0), vec4(color1, 1.0), p, r);
}

void set_source_blend_mode(int mode) {
    _stack.source_blend = mode;
}

vec2 length2(vec4 a) {
    return vec2(length(a.xy),length(a.zw));
}

vec2 dot2(vec4 a, vec2 b) {
    return vec2(dot(a.xy,b),dot(a.zw,b));
}

void letter(sampler2D font_texture_source, ivec2 l) {
  vec2 p = vec2(l);
  vec3 tx;
  vec2 ip;
  float d;
  int ic;
  ip = vec2(l);
  p += clamp(_stack.position.xy, 0.0, 1.0);
  ic = 0x21 + int (mod (16. + ip.x + 2. * ip.y, 94.));
  tx = texture (font_texture_source, mod ((vec2 (mod (float (ic), 16.),
     15. - floor (float (ic) / 16.)) + fract (p)) * (1. / 16.), 1.)).gba - 0.5;
  d = tx.b + 1. / 256.;
  add_field(d / min_uniform_scale());
}

void letter(sampler2D font_texture_source, int lx, int ly) {
    letter(font_texture_source, ivec2(lx,ly));
}

void rounded_rectangle(vec2 o, vec2 s, float r) {
    s = (s * 0.5);
    r = min(r, min(s.x, s.y));
    o += s;
    s -= r;
    vec4 d = abs(o.xyxy - _stack.position) - s.xyxy;
    vec4 dmin = min(d,0.0);
    vec4 dmax = max(d,0.0);
    vec2 df = max(dmin.xz, dmin.yw) + length2(dmax);
    add_field(df - r);
}

void rounded_rectangle(float ox, float oy, float sx, float sy, float r) {
    rounded_rectangle(vec2(ox,oy), vec2(sx,sy), r);
}

void rectangle(vec2 o, vec2 s) {
    rounded_rectangle(o, s, 0.0);
}

void rectangle(float ox, float oy, float sx, float sy) {
    rounded_rectangle(vec2(ox,oy), vec2(sx,sy), 0.0);
}

void circle(vec2 p, float r) {
    vec4 c = _stack.position - p.xyxy;
    add_field(vec2(length(c.xy),length(c.zw)) - r);
}
void circle(float x, float y, float r) { circle(vec2(x,y),r); }

float sdEllipse( vec2 p, in vec2 ab )
{
	p = abs( p ); if( p.x > p.y ){ p=p.yx; ab=ab.yx; }
	
	float l = ab.y*ab.y - ab.x*ab.x;
    if (l == 0.0) {
        return length(p) - ab.x;
    }
	
    float m = ab.x*p.x/l; 
	float n = ab.y*p.y/l; 
	float m2 = m*m;
	float n2 = n*n;
	
    float c = (m2 + n2 - 1.0)/3.0; 
	float c3 = c*c*c;

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
 
    vec2 r = vec2( ab.x*co, ab.y*si );
	
    return length(r - p ) * sign(p.y-r.y);
}

void ellipse(vec2 p, vec2 r) {
    vec4 c = _stack.position - p.xyxy;
    add_field(vec2(sdEllipse(c.xy, r), sdEllipse(c.zw, r)));
}

void ellipse(float x, float y, float rw, float rh) {
    ellipse(vec2(x,y), vec2(rw, rh));
}

void move_to(vec2 p) {
    _stack.start_pt = p;
    _stack.last_pt = p;
}

void move_to(float x, float y) { move_to(vec2(x,y)); }

// stroke only
void line_to(vec2 p) {
    vec4 pa = _stack.position - _stack.last_pt.xyxy;
    vec2 ba = p - _stack.last_pt;
    vec2 h = clamp(dot2(pa, ba)/dot(ba,ba), 0.0, 1.0);
    vec2 s = sign(pa.xz*ba.y-pa.yw*ba.x);
    vec2 d = length2(pa - ba.xyxy*h.xxyy);
    add_field(d);
    add_clip(d * s);
    _stack.last_pt = p;
}

void line_to(float x, float y) { line_to(vec2(x,y)); }

void close_path() {
    line_to(_stack.start_pt);
}

// Test if point p crosses line (a, b), returns sign of result
float test_cross(vec2 a, vec2 b, vec2 p) {
    return sign((b.y-a.y) * (p.x-a.x) - (b.x-a.x) * (p.y-a.y));
}

// Determine which side we're on (using barycentric parameterization)
float bezier_sign(vec2 A, vec2 B, vec2 C, vec2 p) {
    vec2 a = C - A, b = B - A, c = p - A;
    vec2 bary = vec2(c.x*b.y-b.x*c.y,a.x*c.y-c.x*a.y) / (a.x*b.y-b.x*a.y);
    vec2 d = vec2(bary.y * 0.5, 0.0) + 1.0 - bary.x - bary.y;
    return mix(sign(d.x * d.x - d.y), mix(-1.0, 1.0,
        step(test_cross(A, B, p) * test_cross(B, C, p), 0.0)),
        step((d.x - d.y), 0.0)) * test_cross(A, C, B);
}

// Solve cubic equation for roots
vec3 bezier_solve(float a, float b, float c) {
    float p = b - a*a / 3.0, p3 = p*p*p;
    float q = a * (2.0*a*a - 9.0*b) / 27.0 + c;
    float d = q*q + 4.0*p3 / 27.0;
    float offset = -a / 3.0;
    if(d >= 0.0) {
        float z = sqrt(d);
        vec2 x = (vec2(z, -z) - q) / 2.0;
        vec2 uv = sign(x)*pow(abs(x), vec2(1.0/3.0));
        return vec3(offset + uv.x + uv.y);
    }
    float v = acos(-sqrt(-27.0 / p3) * q / 2.0) / 3.0;
    float m = cos(v), n = sin(v)*1.732050808;
    return vec3(m + m, -n - m, n - m) * sqrt(-p / 3.0) + offset;
}

// Find the signed distance from a point to a quadratic bezier curve
float bezier(vec2 A, vec2 B, vec2 C, vec2 p)
{
    B = mix(B + vec2(1e-4), B, abs(sign(B * 2.0 - A - C)));
    vec2 a = B - A, b = A - B * 2.0 + C, c = a * 2.0, d = A - p;
    vec3 k = vec3(3.*dot(a,b),2.*dot(a,a)+dot(d,b),dot(d,a)) / dot(b,b);
    vec3 t = clamp(bezier_solve(k.x, k.y, k.z), 0.0, 1.0);
    vec2 pos = A + (c + b*t.x)*t.x;
    float dis = length(pos - p);
    pos = A + (c + b*t.y)*t.y;
    dis = min(dis, length(pos - p));
    pos = A + (c + b*t.z)*t.z;
    dis = min(dis, length(pos - p));
    return dis * bezier_sign(A, B, C, p);
}

void curve_to(vec2 b1, vec2 b2) {
    vec2 shape = vec2(
        bezier(_stack.last_pt, b1, b2, _stack.position.xy),
        bezier(_stack.last_pt, b1, b2, _stack.position.zw));
    add_field(abs(shape));
    add_clip(shape);
	_stack.last_pt = b2;
}

void curve_to(float b1x, float b1y, float b2x, float b2y) {
    curve_to(vec2(b1x,b1y),vec2(b2x,b2y));
}

void graph(vec2 p, float f_x, float df_x) {
    add_field(abs(f_x - p.y) / sqrt(1.0 + (df_x * df_x)));
}

void graph(vec2 p, float f_x, vec2 df_x) {
    add_field(abs(f_x) / length(df_x));
}

// trace visualization
// -- @paniq

//////////////////////////////////////////////////////////

#define iafloat vec2
#define iavec3 mat3 // in glsl: mat3x2

iavec3 iavec3_new(iafloat x, iafloat y, iafloat z) {
	return iavec3(x, 0.0, y, 0.0, z, 0.0);
}

iavec3 iavec3_new(float x, float y, float z) {
	return iavec3(x, x, 0.0, y, y, 0.0, z, z, 0.0);
}

iavec3 iavec3_new(vec3 p) {
	return iavec3(p.xx, 0.0, p.yy, 0.0, p.zz, 0.0);
}

iavec3 iavec3_new(vec3 p0, vec3 p1) {
	return iavec3(p0.x, p1.x, 0.0, p0.y, p1.y, 0.0, p0.z, p1.z, 0.0);
}

iafloat imin(iafloat a, iafloat b) {
	return iafloat(min(a.x,b.x),min(a.y,b.y));
}

iafloat imax(iafloat a, iafloat b) {
	return iafloat(max(a.x,b.x),max(a.y,b.y));
}

iafloat iadd(iafloat a, iafloat b) {
	return a + b;
}

iavec3 iadd(iavec3 a, iavec3 b) {
	return iavec3_new(
		a[0].xy + b[0].xy,
		a[1].xy + b[1].xy,
		a[2].xy + b[2].xy);
}

iavec3 iadd(vec3 a, iavec3 b) {
	return iavec3_new(
		a.xx + b[0].xy,
		a.yy + b[1].xy,
		a.zz + b[2].xy);
}

iafloat isub(iafloat a, iafloat b) {
	return a - b.yx;
}

iavec3 isub(iavec3 a, iavec3 b) {
	return iavec3_new(
		a[0].xy - b[0].yx,
		a[1].xy - b[1].yx,
		a[2].xy - b[2].yx);
}

iavec3 isub(iavec3 a, vec3 b) {
	return iavec3_new(
		a[0].xy - b.xx,
		a[1].xy - b.yy,
		a[2].xy - b.zz);
}

iafloat imul(iafloat a, iafloat b) {
	vec4 f = vec4(
		a.xxyy * b.xyxy
	);	
	return iafloat(
		min(min(f[0],f[1]),min(f[2],f[3])),
		max(max(f[0],f[1]),max(f[2],f[3])));
}

iafloat imul(float a, iafloat b) {
	vec2 f = vec2(a*b);	
	return iafloat(
		min(f[0],f[1]),
		max(f[0],f[1]));
}

iavec3 imul(iavec3 a, iavec3 b) {
	return iavec3_new(
		imul(a[0].xy, b[0].xy),
		imul(a[1].xy, b[1].xy),
		imul(a[2].xy, b[2].xy)
	);
}

iavec3 imul(float a, iavec3 b) {
	return iavec3_new(
		imul(a, b[0].xy),
		imul(a, b[1].xy),
		imul(a, b[2].xy)
	);
}

iavec3 imul(vec3 a, iavec3 b) {
	return iavec3_new(
		imul(a.xx, b[0].xy),
		imul(a.yy, b[1].xy),
		imul(a.zz, b[2].xy)
	);
}

iavec3 imul(vec3 a, iafloat b) {
	return iavec3_new(
		imul(a.x, b),
		imul(a.y, b),
		imul(a.z, b)
	);
}


iafloat idiv(iafloat a, iafloat b) {
	vec4 f = vec4(
		a.x/b, a.y/b
	);
	return iafloat(
		min(min(f[0],f[1]),min(f[2],f[3])),
		max(max(f[0],f[1]),max(f[2],f[3])));
}

iavec3 idiv(iavec3 a, iavec3 b) {
	return iavec3_new(
		idiv(a[0].xy, b[0].xy),
		idiv(a[1].xy, b[1].xy),
		idiv(a[2].xy, b[2].xy)
	);
}

iafloat isqrt(iafloat a) {
	return iafloat(sqrt(a.x),sqrt(a.y));
}

// for even powers in general,
// for odd powers, it's just iafloat(a*a)
iafloat ipow2(iafloat a) {	
	return (a.x>=0.0)?iafloat(a*a):(a.y<0.0)?iafloat((a*a).yx):iafloat(0.0,max(a.x*a.x,a.y*a.y));
}

iavec3 ipow2(iavec3 v) {
	return iavec3_new(
		ipow2(v[0].xy),
		ipow2(v[1].xy),
		ipow2(v[2].xy));
}

iafloat ilensq(iavec3 a) {
	iavec3 c = ipow2(a);
	return c[0].xy + c[1].xy + c[2].xy;
}

iafloat ilength(iavec3 a) {
	iavec3 c = ipow2(a);
	return isqrt(c[0].xy + c[1].xy + c[2].xy);
}

iafloat idot(iavec3 a, iavec3 b) {
	iavec3 c = imul(a,b);
	return c[0].xy + c[1].xy + c[2].xy;
}

bool icontains(iafloat a, float v) {
	return ((v >= a.x) && (v < a.y));
}

//////////////////////////////////////////////////////////

iafloat sphere(iavec3 p, float r) {
	// x^2 + y^2 + z^2 - r^2
	return isub(ilensq(p),iafloat(r*r));
}

iafloat teardrop(iavec3 p) {
	// -0.5x^5 - 0.5x^4 + y^2 + z^2
	
	iafloat x2 = ipow2(p[2].xy);
	iafloat y2 = ipow2(p[1].xy);
	iafloat z2 = ipow2(p[0].xy);
	
	iafloat x4 = ipow2(x2);
	iafloat x5 = imul(p[2].xy,x4);
	
	return iadd(iadd(isub(imul(-0.5,x5), imul(0.5,x4)), y2), z2);	
}


iafloat map(iavec3 p) {
    float as = sin(iTime)*0.5+0.5;

    // scaling needs no distance fix
	iafloat drop = teardrop(imul(2.0,isub(p, vec3(1.0,0.0,0.0))));
	iafloat sph1 = sphere(isub(p, vec3(1.0,0.0,0.0)), 0.8);
	// anisotropic scaling is no problem
	iafloat sph2 = sphere(imul(
		vec3(3.0,1.0,1.0),
		isub(p, vec3(0.0,0.0,-0.9+0.2*as))), 0.5);
	
	return imin(imax(drop,sph1), sph2);
}

vec2 grad2d(vec3 p) {
	vec2 d = vec2(0.0, 1e-3);
	
	// could do this with only two queries if only the sign
	// could be recovered.
	vec2 hx = map(iavec3_new(p + d.yxx)) - map(iavec3_new(p - d.yxx));
	vec2 hy = map(iavec3_new(p + d.xxy)) - map(iavec3_new(p - d.xxy));
	
	return normalize(vec2(
		hx.x, hy.x));
}

void arrow(vec2 u, vec2 n) {
	vec2 o = vec2(n.y, -n.x);
	move_to(u);
	u += n;
	line_to(u);
	move_to(u - o*0.2);
	line_to(u + o*0.2);
	line_to(u + n*0.4);
	close_path();
}

iafloat trace_paint(vec3 ro, vec3 rd, iafloat t) {
	iavec3 r = iadd(ro, imul(rd, t));
	
	iafloat h = map(r);
	if (icontains(h, 0.0))
		set_source_rgba(vec4(0.0,1.0,0.0,0.5));
	else
		set_source_rgba(vec4(1.0,0.0,0.0,0.5));
	
	move_to(ro.xz+rd.xz*t.x);
	line_to(ro.xz+rd.xz*t.y);
	stroke();
	
	rectangle(r[0].x, r[2].x, r[0].y - r[0].x, r[2].y - r[2].x);
	stroke();
	
	return h;
}

void paint() {
	vec2 ms = ((iMouse.xy/iResolution.xy)*2.0-1.0) * aspect;
	
	// clear screen
	
	iafloat d = map(iavec3_new(
		vec3(position.x,0.0,position.y)));
	
	
	set_source_rgb(
		(d.x<=0.0)?hsl(0.6, 1.0, 0.7):vec3(0.0,0.0,0.5));
	clear();

	set_source_rgba(hsl(0.6, 1.0, 0.7, 0.3));
	set_line_width_px(3.0);
	for (int i = 0; i < 8; ++i) {
		_stack.shape.x = d.x-float(i)*0.2;
		stroke();
	}

	set_source_rgb(vec3(1.0));
	set_line_width_px(1.3);

	vec3 ro = vec3(-1.5,0.0,0.0);
	vec3 rd = normalize(vec3(ms.x, 0.0, ms.y) - ro);
	
	circle(ro.xz, 0.02);
	fill();

	float maxt = 3.1;
	float mine = 1e-3;
	
	iafloat t = iafloat(0.0, maxt);

	bool hit = false;	
	for (int i = 0; i < 32; ++i) {
	
		float th = (t.x+t.y)*0.5;
		
		iafloat t0 = iafloat(t.x, th);
		iafloat t1 = iafloat(th, t.y);
		
		iafloat d0 = trace_paint(ro, rd, t0);
		iafloat d1 = trace_paint(ro, rd, t1);
		if (icontains(d0, 0.0)) {
			t.y = th;
			if (max(abs(d0.y),abs(d0.x)) < mine) {
				hit = true;
				break;
			}
		} else if (icontains(d1, 0.0)) {
			t.x = th;
			if (max(abs(d1.y),abs(d1.x)) < mine) {
				hit = true;
				break;
			}
		} else {
			// nudge to back, double interval
			float d = (t.y-t.x);
			t.x += d;
			t.y += d*2.0;
			if (t.x >= maxt)
				break;
		}
	}

	if (hit) {
		set_source_rgb(vec3(1.0));
		float th = (t.x+t.y)*0.5;
		circle(ro.xz + rd.xz*th, 0.03);
		fill();
		
		// arrow
		vec3 p = (ro+rd*th);
		vec2 n = grad2d(p);
		vec2 o = vec2(n.y, -n.x);
		set_source_rgb(vec3(1.0));	
		arrow(p.xz, n*0.1);
		stroke();
	}

}

//////////////////////////////////////////////////////////

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    init(fragCoord, iMouse.xy, iResolution.xy);

    paint();

    blit(fragColor);
}
`;

export default class implements iSub {
  key(): string {
    return 'lssSWH';
  }
  name(): string {
    return 'Interval Arithmetic';
  }
  sort() {
    return 366;
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
}
