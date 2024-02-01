import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
////////////////////////////////////////////////////////////////////////////////
//
// Wythoffian Tiling Generator
//
// Spherical, Euclidean, and Hyperbolic tilings, including duals and snubs.
//
// Based on Knighty's excellent 'Tilings'
//
// Modified by Matthew Arcus, mla, 9/3/2020
//
// Fundamental triangle angles are PI/P, PI/Q, PI/R and an appropriate
// geometry is selected for the specified angles.
//
// P and Q are fixed in the code (but of course may be changed), R varies,
// either automatically or with <left>/<right> keys.
//
// By default, display cycles through the 7 uniform tilings based on
// the underlying triangle, as well as the snub form. Triangle goes
// through (2,3,5),(2,3,6),(2,3,7), etc.
//
// <mouse>: apply appropriate isometry to tiling
// <up>/<down>: zoom in/out
// <left>/<right>: select R angle of fundamental triangle
// d: show dual
// f: use plain fill for tiles
// p: show region parity
// s: just show snub forms
// t: show main tiling
// x: texture tiles
//
////////////////////////////////////////////////////////////////////////////////

////////////////////////////////////////////////////////////////////////////////
// Original header
////////////////////////////////////////////////////////////////////////////////
// triangular groups tessellations. Coxeter group p-q-r. Stereographic
// projection. 
// adapted from fragmentarium script.see:
// http://www.fractalforums.com/fragmentarium/triangle-groups-tessellation/
// Licence: free.
// the type of the space embedding the tessellation depend on the value:
// 1/p+1/q+1/r
// if >1 its the sphere
// if =1 its the euclidean plane
// if <1 its the hyperbolic plane
//  
// Distance estimation to lines and vertices is used for antialiasing.
// You can still improve quality by using antialiasing.
////////////////////////////////////////////////////////////////////////////////

bool snubify = false;
bool dofill = true;
bool dodual = true;
bool dotiling = true;
bool dotexture = true;
bool doparity = true;

// These are the p, q and r parameters that define the Coxeter/triangle group
int P = 2; // Pi/p: angle beween reflexion planes a and b.
int Q = 3; // Pi/q: angle beween reflexion planes b and c.
int R = 3; // Pi/r: angle beween reflexion planes c and a.

// Iteration number.
const int Iterations = 30;

// Colors
const vec3 segColor        = vec3(0,0,0);
const vec3 dualColor       = vec3(1,0,0);
const vec3 backgroundColor = vec3(0);
const vec3 fillColor = vec3(1,1,0.7);
const vec3 faceColor0 = vec3(1,1,0);
const vec3 faceColor1 = vec3(0,1,1);
const vec3 faceColor2 = vec3(0,0,1);
const vec3 snubColor = vec3(0,1,0);

vec3 A,B,C; // The vertices of the triangle
float K = 0.0; // spaceType
vec3 na,nb,nc; // The normals of the reflexion planes, na = (1,0,0),
vec3 bary; // Barycentre coordinates of "Wythoff point"

float aaScale = 0.005; //anti-aliasing scale == half of pixel size.

const float PI = 3.14159265;

bool alert = false;
void assert(bool b) {
  if (!b) alert = true;;
}

//#define assert(e)

////////////////////////////////////////////////////////////////////////////////
// Geometry
////////////////////////////////////////////////////////////////////////////////

// For hyperbolic and spherical geometry, hdott(p,q) = -hdots(p,q)
float hdott(vec3 a, vec3 b){
  //dot product for "time like" vectors.
  return K*dot(a.xy,b.xy)+a.z*b.z;
}
float hdots(vec3 a, vec3 b){
  //dot product for "space like" vectors (these are duals of the "time like" 
  //vectors).  
  return dot(a.xy,b.xy)+K*a.z*b.z;
}
float hlengtht(vec3 v){
  return sqrt(abs(hdott(v,v)));
}
float hlengths(vec3 v){
  return sqrt(abs(hdots(v,v)));
}
vec3 hnormalizet(vec3 v){
  // normalization of "time like" vectors.
  return v/hlengtht(v);
}
vec3 hnormalizes(vec3 v){
  //normalization of "space like" vectors (not used).
  return v/hlengths(v);
}

/////////////////////////////////////////////////

void initialize() {
  // Set the space type
  K = float(sign(Q*R+P*R+P*Q-P*Q*R)); // 1/P+1/Q+1/R-1;

  float cospip=cos(PI/float(P)), sinpip=sin(PI/float(P));
  float cospiq=cos(PI/float(Q)), sinpiq=sin(PI/float(Q));
  float cospir=cos(PI/float(R)), sinpir=sin(PI/float(R));
  float ncsincos=(cospiq+cospip*cospir)/sinpip;

  // dot(na,nb) = -cos(PI/P)
  // dot(nb,nc) = -cos(PI/Q)
  // dot(nc,na) = -cos(PI/R)
  // |na| = |nb| = |nc| = 1
  na = vec3(1,0,0);
  nb = vec3(-cospip,sinpip,0);
  nc = vec3(-cospir,-ncsincos,sqrt(abs(1.0-cospir*cospir-ncsincos*ncsincos)));
  if (K == 0.0) {
    // This case is a little bit special - nc.z doesn't enter into
    // inner product, but acts as a scaling factor.
    nc.z = 0.25;
  }

  // "vertices" of the "triangle" made by the reflexion planes
  A = cross(nb,nc); //vec3(nb.y*nc.z,-nb.x*nc.z,nb.x*nc.y-nb.y*nc.x);
  B = cross(nc,na); //vec3(0,nc.z,-nc.y);
  C = cross(na,nb); //vec3(0,0,nb.y);
}

vec3 reflecta(vec3 z) {
  return z*vec3(-1,1,1);
}

vec3 reflectb(vec3 z) {
  return z-2.0*dot(nb,z)*nb;
}

vec3 reflectc(vec3 z) {
  // Only need spaceType for this
  return z-2.0*dot(nc,z)*nc*vec3(1,1,K);
}

vec3 fold(vec3 pos, inout int flips) {
  for (int i=0; i<Iterations; i++) {
    int flips0 = 0;
    flips0 += int(pos.x < 0.0);
    pos.x = abs(pos.x); // Reflect in y-axis - always a line of symmetry
    float t = 2.0*min(0.0,dot(nb,pos));
    flips0 += int(t < 0.0);
    pos -= t*nb;
    t = 2.0*min(0.0,dot(nc,pos));
    flips0 += int(t < 0.0);
    pos -= t*nc*vec3(1,1,K);
    if (flips0 == 0) break;
    //pos = hnormalizet(pos); // TBD: test this..
    flips += flips0;
  }
  return pos;
}

float DD(float t, float r2){
  // Stereographic projection
  //return t*(1.0+K*r2); // TBD: test this..
  return t*(1.0+K*r2)/(1.0+K*K*sqrt(r2)*t);
}

float hdistance(vec3 p, vec3 q) {
  return hlengths(p-q)/hlengtht(p+q);
}

float hangle(vec3 p, vec3 q, vec3 r) {
  // Return cosine of angle at p
  return hdots(p-q,p-r);
}

// Distance to half-line from p in direction n.
float dist2Segment(vec3 z, vec3 p, vec3 n, float r2, float radius){
  // pmin is the orthogonal projection of z onto the plane defined by p and n
  // then pmin is projected onto the unit sphere
	
  // we are assuming that p and n are normalized. If not, we should do: 
  mat2 smat=mat2(vec2(hdots(n,n),hdots(p,n)),vec2(hdott(p,n),hdott(p,p)));
  //mat2 smat=mat2(1,hdots(p,n),hdott(p,n),1);

  // v is the components of the "orthogonal" projection (depends on the
  // metric) of z on the plane defined by p and n wrt to the basis (p,n)
  vec2 v = smat*vec2(hdott(z,p),-hdots(z,n));
  v.y = min(0.0,v.y); //crops the part of the segment past the point p
	
  vec3 pmin = hnormalizet(v.x*p-v.y*n);
  
  float t = hdistance(pmin,z);
  return DD((t-radius)/(1.0+K*t*radius),r2); // Return distance to "cylinder"
}

void snubdual(vec3 z, vec3 p, float r2, float radius, inout float dmin) {
  dmin = min(dmin,dist2Segment(z,p,A-p,r2,radius));
  dmin = min(dmin,dist2Segment(z,p,B-p,r2,radius));
  dmin = min(dmin,dist2Segment(z,p,C-p,r2,radius));
}

float dist2Tiling(vec3 z, vec3 p, float r2, bool parity) {
  const float radius = 0.01;// Thickness of the lines
  float dmin = 1e8;
  if (!snubify) {
    dmin = min(dmin,dist2Segment(z,p,-na,r2,radius));
    dmin = min(dmin,dist2Segment(z,p,-nb,r2,radius));
    dmin = min(dmin,dist2Segment(z,p,-nc*vec3(1,1,K),r2,radius));
  } else if (!parity) {
    // The six rays from the triangle point.
    vec3 p0 = reflecta(reflectb(p));
    vec3 p1 = reflectb(reflecta(p));
    vec3 p2 = reflectb(reflectc(p));
    vec3 p3 = reflectc(reflectb(p));
    vec3 p4 = reflectc(reflecta(p));
    vec3 p5 = reflecta(reflectc(p));
    dmin = min(dmin,dist2Segment(z,p,p0-p,r2,radius));
    dmin = min(dmin,dist2Segment(z,p,p1-p,r2,radius));
    dmin = min(dmin,dist2Segment(z,p,p2-p,r2,radius));
    dmin = min(dmin,dist2Segment(z,p,p3-p,r2,radius));
    dmin = min(dmin,dist2Segment(z,p,p4-p,r2,radius));
    dmin = min(dmin,dist2Segment(z,p,p5-p,r2,radius));
  } else {
    // The three rays passing through the other triangle.
    vec3 p0 = reflecta(p);
    vec3 p1 = reflectb(p);
    vec3 p2 = reflectc(p);
    dmin = min(dmin,dist2Segment(z,p0,p1-p0,r2,radius));
    dmin = min(dmin,dist2Segment(z,p1,p2-p1,r2,radius));
    dmin = min(dmin,dist2Segment(z,p2,p0-p2,r2,radius));
  }
  return dmin;
}

float dist2Dual(vec3 z, vec3 p, float r2, bool parity) {
  const float radius = 0.008; // Thickness of the lines
  float dmin = 1e8;
  if (!snubify) {
    if (bary.z != 0.0) dmin = min(dmin,dist2Segment(z,A,B-A,r2,radius));
    if (bary.x != 0.0) dmin = min(dmin,dist2Segment(z,B,C-B,r2,radius));
    if (bary.y != 0.0) dmin = min(dmin,dist2Segment(z,C,A-C,r2,radius));
  } else {
    // Centre of snub triangle. Should check this is valid!
    vec3 f = (reflecta(p)+reflectb(p)+reflectc(p))/3.0;
    // Snub dual method from fizzer.
    if (parity) {
      snubdual(z,f,r2,radius,dmin);
    } else {
      snubdual(reflecta(z),f,r2,radius,dmin);
      snubdual(reflectb(z),f,r2,radius,dmin);
      snubdual(reflectc(z),f,r2,radius,dmin);
    }
  }
  return dmin;
}

vec3 color(vec2 z, vec3 p){
  float r2 = dot(z,z);
  vec3 z3 = vec3(2.0*z,1.0-K*r2)/(1.0+K*r2);
  int flips = 0;
  z3 = fold(z3,flips);
  bool parity = (flips&1) == 0;
  vec3 color = backgroundColor;
  // Fill in the tile colors. This can probably be simplified.
  if (dofill) {
    color = fillColor;
  } else if (!snubify) {
    // Non-chiral case, just 3 sectors of triangle.
    bool side0 = dot(z3,cross(p,na)) < 0.0;
    bool side1 = dot(z3,cross(p,nb)) < 0.0;
    bool side2 = dot(z3,cross(p,nc*vec3(1,1,K))) < 0.0;
    if (side0 && !side1) color = faceColor0;
    else if (side1 && !side2) color = faceColor1;
    else if (side2 && !side0) color = faceColor2;
  } else if (!parity) {
    // Triangle contains snub Wythoff point, p, there are
    // 6 sectors, boundaries are between p and it's 6
    // double reflections.
    vec3 p0 = reflecta(reflectb(p));
    vec3 p1 = reflectb(reflecta(p));
    vec3 p2 = reflectb(reflectc(p));
    vec3 p3 = reflectc(reflectb(p));
    vec3 p4 = reflectc(reflecta(p));
    vec3 p5 = reflecta(reflectc(p));
    bool side0 = dot(z3,cross(p,p0)) < 0.0;
    bool side1 = dot(z3,cross(p,p1)) < 0.0;
    bool side2 = dot(z3,cross(p,p2)) < 0.0;
    bool side3 = dot(z3,cross(p,p3)) < 0.0;
    bool side4 = dot(z3,cross(p,p4)) < 0.0;
    bool side5 = dot(z3,cross(p,p5)) < 0.0;
    if (side1 && !side0) color = faceColor1;
    if (side2 && !side1) color = snubColor;
    if (side3 && !side2) color = faceColor2;
    if (side4 && !side3) color = snubColor;
    if (side5 && !side4) color = faceColor0;
    if (side0 && !side5) color = snubColor;
  } else {
    // The other triangle, containing the centre of
    // a snub triangle. The three sides of the snub triangle
    // pass through region.
    vec3 p0 = reflecta(p);
    vec3 p1 = reflectb(p);
    vec3 p2 = reflectc(p);
    bool side0 = dot(z3,cross(p0,p1-p0)) < 0.0;
    bool side1 = dot(z3,cross(p1,p2-p1)) < 0.0;
    bool side2 = dot(z3,cross(p2,p0-p2)) < 0.0;
    if (side0) color = faceColor1;
    else if (side1) color = faceColor2;
    else if (side2) color = faceColor0;
    else color = snubColor;
  }
  
  if (doparity && parity) color *= 0.9; // Antialias this?

  if (dotexture) color *= 0.8+0.2*texture(iChannel2, z3.xy + 0.0*iTime).r;

  //antialiasing using distance de segments and vertices (ds and dv) 
  //(see:http://www.iquilezles.org/www/articles/distance/distance.htm)
  if (dodual) {
    float ds = dist2Dual(z3,p,r2,parity);
    color = mix(dualColor,color,smoothstep(-1.0,1.0,ds/aaScale));
  }
  if (dotiling) {
    float ds = dist2Tiling(z3, p, r2, parity);
    color = mix(segColor,color,smoothstep(-1.0,1.0,ds/aaScale));
  }
	
  // Final touch in order to remove jaggies at the edge of the circle
  // (for hyperbolic case)
  if (K == -1.0) {
    color = mix(backgroundColor,color,
                smoothstep(-1.0,1.0,(1.0-sqrt(r2))/aaScale));
  }
  return color;
}

// Decode integer k bitwise as bary coords.
vec3 getbary(int k) {
  k = 1+(k%7);
  return vec3((k>>0)&1,(k>>1)&1,(k>>2)&1);
}

// Find bary coords of point whose 3 reflections form an equilateral triangle.
// Fairly standard application of 2-dimensional Newton-Raphson.
// It's pretty silly doing this in a fragment shader, but it's fun.
// There are ways of directly calculating the "Fermat point", but
// I haven't tried that for non-euclidean triangles.
vec2 eval(vec2 s) {
  vec3 t = mat3(A,B,C)*vec3(s,1.0-s.x-s.y);
  vec3 p0 = reflecta(t);
  vec3 q0 = reflectb(t);
  vec3 r0 = reflectc(t);
  // Doesn't seem to matter whether we equalize angles or distances
#if 0
  // Reflect to an equilateral triangle
  float d0 = hdistance(p0,q0);
  float d1 = hdistance(q0,r0);
  float d2 = hdistance(r0,p0);
#else
  // Reflect to an equiangular triangle
  float d0 = hangle(p0,q0,r0);
  float d1 = hangle(q0,r0,p0);
  float d2 = hangle(r0,p0,q0);
#endif
  return vec2(d1-d0,d2-d1);
}

mat2 jacobian(vec2 s, float eps) {
  // f(a+eps) = f(a-eps) + 2*eps*f'(a) => f'(a) =  (f(a+eps)-f(a-eps))/(2*eps)
  vec2 e = vec2(eps,0);
  vec2 s0 = eval(s+e.xy);
  vec2 s1 = eval(s-e.xy);
  vec2 s2 = eval(s+e.yx);
  vec2 s3 = eval(s-e.yx);
  // df[0]/da df[0]/db
  // df[1]/da df[1]/db
  // Column major!
  return mat2(s0-s1,s2-s3)/(2.0*eps);
}

vec2 refine(vec2 s) {
  // 0 = f(a+dx) = f(a)+M(dx)
  // f(a) = -M(dx)
  // dx = -inv(M)(f(a))
  mat2 m = inverse(jacobian(s,1e-6));
  vec2 t = eval(s);
  vec2 dx = m*t;
  return s-dx;
}

vec3 getsnub() {
  // Solve f(a,b,c) = g(a,b,c) = h(a,b,c)
  // Here f,g,h are distances to 3 sides of triangle, or the three
  // angles in the triangle.
  // a,b,c are bary coords
  // In fact, we can set a+b+c = 1, so only 2 variables really.
  // Have a vector quantity: [f-g,h-g], which we want to set to [0,0].
  // f(x+dx) = f(x) + F(dx)
  // ie. f(x) + F(dx) = 0 => dx = -inv(F)(f(x))
  // We need a decent starting point, here the middle of the triangle
  vec2 s = vec2(0.333,0.333);
  // A few iterations are enough
  for (int i = 0; i < 4; i++) s = refine(s);
  assert(length(eval(s)) < 1e-4); // Check we have a solution
  vec3 res = vec3(s,1.0-s.x-s.y);
  return res;
}

vec3 getbary(int k, float t) {
  k %= 16;
  if (k >= 14) {
    snubify = true;
    return getsnub();
  }
  //k = max(0,k-1);
  k = min(k,12);
  return mix(getbary(k/2),getbary((k+1)/2),t);
}

bool keypress(int code) {
  return texelFetch(iChannel0, ivec2(code,2),0).x != 0.0;
}

vec4 store(int i,int j) {
  return texelFetch(iChannel1, ivec2(i,j),0);
}

int keycount(int key) {
  return int(store(0,key).x);
}

const int KEY_LEFT = 37;
const int KEY_RIGHT = 39;
const int KEY_UP = 38;
const int KEY_DOWN = 40;

const int CHAR_D = 68;
const int CHAR_F = 70;
const int CHAR_L = 76;
const int CHAR_P = 80;
const int CHAR_S = 83;
const int CHAR_T = 84;
const int CHAR_X = 88;

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
  // Set up our options
  dofill = keypress(CHAR_F);
  dodual = !keypress(CHAR_D);
  dotiling = !keypress(CHAR_T);
  dotexture = !keypress(CHAR_X);
  doparity = !keypress(CHAR_P);
  snubify = keypress(CHAR_S);

  // P,Q are fixed, select value for R.
  int rselect = keycount(KEY_RIGHT)-keycount(KEY_LEFT);
  if (rselect > 0) {
    R = 2+rselect;
  } else {
    int cycle = snubify ? 3 : 16;
    R = 5+int(iTime)/(cycle);
  }
  // Set up triangle, bary coords and Wythoff point.
  initialize();
  bary = snubify ? getsnub() : getbary(int(iTime),fract(iTime));
  // The barycentric coords for the vertex.
  vec3 p = mat3(A,B,C)*bary;
    // Weighted average of the vertices of the triangle
  p = hnormalizet(p);

  // Scaling
  float scaleFactor = K == 1.0 ? 2.0 : 1.0;
  // Zoom in and out with arrow keys
  scaleFactor *= exp(0.1*float(keycount(KEY_DOWN)-keycount(KEY_UP)));

  // Get screen point..
  vec2 z = scaleFactor*(2.0*fragCoord.xy-iResolution.xy) / iResolution.y;

  // ..and apply appropriate isometry.
  if (iMouse.x > 0.0) {
    vec2 m = scaleFactor*vec2((2.0*iMouse.xy-iResolution.xy)/iResolution.y);
    if (K == 0.0) {
      // euclidean translation
      z -= m;
    } else if (K == 1.0) {
      // spherical, invert at mouse position
      z -= m;
      float k = 1.0/dot(z,z);
      z *= k;
      scaleFactor *= k; // Adjust scale factor for inversion
      z += m;
    } else if (K == -1.0) {
      // hyperbolic, invert centre of unit disc to mouse position
      float X = dot(m,m);
      m /= X;
      z -= m;
      float k = (1.0-X)/(X*dot(z,z));
      z *= k;
      scaleFactor *= abs(k); // Adjust scale factor for inversion
      z += m;
    }
  }
  aaScale = 2.0*scaleFactor/iResolution.y;
  fragColor = vec4(color(z,p),1.0);
  if (alert) fragColor.x = 1.0;
}

`;

export default class implements iSub {
  key(): string {
    return 'wlGSWc';
  }
  name(): string {
    return 'Wythoffian Tiling Generator';
  }
  sort() {
    return 547;
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
      { type: 3 },
      { type: 3 },
      webglUtils.DEFAULT_NOISE, //
    ];
  }
}
