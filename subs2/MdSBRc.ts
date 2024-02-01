import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
#define FAR 80.

// Scene object ID. Object identification. Either the mesh (0) or the isosurface (1).
float objID;
float svObjID; // Global ID to keep a copy of the above from pass to pass.

// Non-standard vec3-to-vec3 hash function.
vec3 hash33(vec3 p){ 
    
    float n = sin(dot(p, vec3(7, 157, 113)));    
    return fract(vec3(2097152, 262144, 32768)*n); 
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

// Camera path.
vec3 path(float t){
  
    //return vec3(0, 0, t); // Straight path.
    //return vec3(-sin(t/2.), sin(t/2.)*.5 + 1.57, t); // Windy path.
    
    float a = sin(t * 0.11);
    float b = cos(t * 0.14);
    return vec3(a*4. -b*1.5, b*1.7 + a*1.5, t);
    
}



// Standard 2D rotation formula.
mat2 r2(in float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

// A cheap orthonormal basis vector function - Taken from Nimitz's "Cheap Orthonormal Basis" example, then 
// modified slightly.
//
//Cheap orthonormal basis by nimitz
//http://orbit.dtu.dk/fedora/objects/orbit:113874/datastreams/file_75b66578-222e-4c7d-abdf-f7e255100209/content
//via: http://psgraphics.blogspot.pt/2014/11/making-orthonormal-basis-from-unit.html
mat3 basis(in vec3 n){
    
    float a = 1./(1. + n.z);
    float b = -n.x*n.y*a;
    return mat3(1. - n.x*n.x*a, b, n.x, b, 1. - n.y*n.y*a, n.y, -n.x, -n.y, n.z);
                
}
 
// A line segment formula that orients via an orthanormal basis. It'd be faster to use
// IQ's 3D line segment formula, but this one allows for more interesting cross sections,
// like hexagons and so forth.
float sdCapsule( vec3 p, vec3 a, vec3 b, float r ){

    b -= a;
    float l = length(b);
    p = basis(normalize(b))*(p - a - b*.5);
    
    p = abs(p);
    //return = max(length(p.xy) - r, p.z - l*.5);
    //return = max((p.x + p.y)/2. - r, p.z - l*.5);
    //return = max(max(p.x, p.y) - r, p.z - l*.5);
    return max(max(p.x*.866025 + p.y*.5, p.y) - r, p.z - l*.5);
 
}

 
 
/*
// Smooth maximum, based on the function above.
float smaxP(float a, float b, float s){
    
    float h = clamp( 0.5 + 0.5*(a-b)/s, 0., 1.);
    return mix(b, a, h) + h*(1.0-h)*s;
}

// Compact, self-contained version of IQ's 3D value noise function.
float n3D(vec3 p){
    
	const vec3 s = vec3(7, 157, 113);
	vec3 ip = floor(p); p -= ip; 
    vec4 h = vec4(0., s.yz, s.y + s.z) + dot(ip, s);
    p = p*p*(3. - 2.*p); 
    //p *= p*p*(p*(p * 6. - 15.) + 10.);
    h = mix(fract(sin(h)*43758.5453), fract(sin(h + s.x)*43758.5453), p.x);
    h.xy = mix(h.xz, h.yw, p.y);
    return mix(h.x, h.y, p.z); // Range: [0, 1].
}
*/

// A fake, noisy looking field - cheaply constructed from a spherized sinusoidal
// combination. I came up with it when I was bored one day. :) Lousy to hone in
// on, but it has the benefit of being able to guide a camera through it.
float isoMap(vec3 p){
     
    p.xy -= path(p.z).xy; // Perturb the object around the camera path.
    
	p = cos(p*.315*1.25 + sin(p.zxy*.875*1.25)); // 3D sinusoidal mutation.
    
    float n = length(p); // Spherize. The result is some mutated, spherical blob-like shapes.

    // It's an easy field to create, but not so great to hone in one. The "1.4" fudge factor
    // is there to get a little extra distance... Obtained by trial and error.
    return (n - 1.);
    
}

// Interpolating along the edge connecting vertices v1 and v2 with respect to the isovalue.
vec3 inter(in vec3 p1, in vec3 p2, float v1, float v2, float isovalue){
    
     
    // The interpolated point will fall somewhere between the vertex points p1 and p2.
    // Obviously if the isovalue is closer to p1, then the interpolated point will be
    // closer to p1, and vice versa.
    return mix(p1, p2, (isovalue - v1)/(v2 - v1));
    
    // Equivalent to:
    //return p1 + (isovalue - v1)/(v2 - v1)*(p2 - p1);
    
    // This is probably more correct, but we seem to be getting away with the line above.
    //float inter = v1 == v2 ? .5 : (isovalue - v1) /(v2 - v1); 
    //return mix(p1, p2, inter);
}

// Hacky global to save the unit direction ray for use below.
vec3 svRd;
float rayBox(in vec3 ro){
    
    vec3 p = 1./svRd;
    p = abs(p)*1.01 - p*ro;
	return min(min(p.x, p.y), p.z);
}

/*
// Standard ray-plane intersection.
float rayPlane(vec3 p, vec3 o, vec3 n, vec3 rd) {
    
    float dn = dot(rd, n);

    float s = 1e8;
    
    if (abs(dn) > 0.) {
        s = dot(p - o, n) / dn;
        s = s<0. ? 1e8 : s;
    }
    
    return s;//o + s*rd;
}

// Quickly hacked together ray to tetrahedron intersection... It seems to work. :)
float rayTetra(vec3 p, vec3 p0, vec3 p1, vec3 p2, vec3 p3, vec3 rd){
    
    vec3 n = normalize(cross(p0 - p1, p0 - p2));
    //vec3 pc = (p0 + p1 + p2)/3.;
    float t = rayPlane(p, p0, n, svRd);
    n = normalize(cross(p0 - p2, p0 - p3));
    //pc = (p0 + p2 + p3)/3.;
    t = min(t, rayPlane(p, p0, n, svRd));
    n = normalize(cross(p0 - p1, p0 - p3));
    //pc = (p0 + p1 + p3)/3.;
    t = min(t, rayPlane(p, p0, n, svRd));
    n = normalize(cross(p1 - p2, p1 - p3));
    //pc = (p1 + p2 + p3)/3.;
    t = min(t, rayPlane(p, p1, n, svRd)); 
    
    return t;//min(t, .5);
}
*/

/*

	If you're not familiar with the marching cubes or marching tetrahedra process, it's
	worth reading the article I've provided below, which contains easy to follow visuals,
    etc. It would have been nice to include those within the shader, but this is a pretty
	expensive algorithm, so the frame rate and compiler wouldn't let me. :)

	Ascii tetrahedron with labled vertices, for a mild visual reference.

        0 + 
         /|\
        / | \
       /  |  \
    3 +---|---+ 1
       \  |  /
        \ | /
         \|/
          + 2


	The method is simple. Patition space into a cubic grid, then split each cube into six 
	individual tetrahedra. Obtain the isosurface values at each of the four tetrahedral vertices.
	then use them to determine the required triangle arrangment for the tetrahedral cell.
    Since the tetrahedron edges align with those on adjacent cells, the interpolated triangles
	will line up throughout the grid to produce a triangulated mesh. For a better explanation
	and visual representation, feel free to follow the link below.
	
	I remember fumbling my way through the correct triangle orientations, then deciding to 
	try Paul Bourke's site, and sure enough, there was some fantastic working code to get
	me started. Although, I still had to do more work to get the right oriented triangles.

	Paul Bourke's site used to be a graphics community Mecca, and still is to a certain
	degree. At one point his Alexa ranking was so low that he could have made a fortune via
	advertising... Anyway, for anyone who's not familiar with the site, it's still a fantastic 
    resource.

	References:

	Polygonising A Scalar Field
    http://paulbourke.net/geometry/polygonise/
 
    Marching tetrahedra source: http://paulbourke.net/geometry/polygonise/source1.c
*/

float map(vec3 p){
 
    
    // Grid scale. Smaller values give a denser mesh, which obviously fit the isosurface 
    // better. I deliberately chose a less dense mesh in order to display the individual 
    // triangles more clearly.
    const float sc = .75;
 
    // Partitioning space into cubes, which are further subdivided into six tetrahedra. 
    // Note that no skewing is performed. You could, but I hear that it's not necessary.
    vec3 i = floor(p/sc)*sc;  p -= i;
    // Partioning into tetrahedra - Determined by checking which side of a couple 
    // of diagonal planes we're on.
    vec3 i1 = step(p.yzx, p)*sc, i2 = max(i1, sc - i1.zxy); i1 = min(i1, sc - i1.zxy);    
    
    // The four vertices of the individual tetrahedron.
    vec3 p0 = vec3(0), p1 = i1, p2 = i2, p3 = vec3(1)*sc;
    
    // Places for six vertices. Difference combinations require two triangles. "va" hold
    // the round vertex places.
    vec3 v1, v2, v3, v4, v5, v6, va;
        
     ///////////    
     
    // The four surface isolvalues at each of the four vertices. Yes, taking four isovalues
    // per distance function is crazy. In fact, we're rendering the continuous surface as
    // well, so that makes five... Don't try this at home, folks. :D
    vec4 ps = vec4(isoMap(i+p0), isoMap(i+p1), isoMap(i+p2), isoMap(i+p3));
 
    // The continuous isosurface value. Actually, it's a little smaller, just so it can 
    // fit inside the polygonized mesh a little better. I deliberately left a bit of
    // overlap for stylistic purposes, and to show that the mesh is an approximation.
    float surface = isoMap(p + i) + .1;
    
    // The mesh and vertice values.
    float mesh = 1e8, verts = 1e8;
 
    // A flag to determine whether one, two, or zero triangle arrangements should be drawn.
    float tri = 0.;
    
    
    // Edge thickness and isolevel threshold constants.
    const float r1 = .03;
    
    // The threshold doesn't have to be zero, but it makes more sense this way, since it's
    // analogous to the zero distance mark. Ie, a surface hit.
    const float isolevel = 0.;
 
    int index = 0; 
    
    // An old power-of-two flag trick. For instance, if point ps[0] and ps[2] are below the
    // isolevel - or, in other words, inside the surface, the "index" variable will have a 
    // unique value of 5.
    index += ps[0] < isolevel ? 1 : 0;
    index += ps[1] < isolevel ? 2 : 0;
    index += ps[2] < isolevel ? 4 : 0;
    index += ps[3] < isolevel ? 8 : 0;
 
    
    
    // If there are no verices with isovalues below the threshold, then we are
    // effectively in open space. The question at this point is, "How far do we
    // advance the ray?" What we should be doing is tetrahedral traversal, but 
    // instead, we'll cheat a little and use the continuous isosurface value.
    // It's not ideal, but it simplifies things greatly.
         
    // No vertices inside.
    if(index == 0) { 
        
        // In theory, a tetrahedral grid traversal is necessary here, but it's slow and 
        // cumbersome, so I'm hacking through it with a bit of fudge, which is prone to
        // artifacts. However, it's a lot simpler and hones in on the surface faster.        
        //mesh = rayTetra(p, p0, p1, p2, p3, svRd) + .05; //rayBox(p);
        
        mesh = surface + .005;  
         
    }
    // All vertices inside.
    else if(index == 15){
        
        // Also requires a tetrahedral grid traversal. However, this way is cheaper.
        //mesh = rayTetra(p, p0, p1, p2, p3, svRd) + .05;
        
        mesh = rayBox(p) + .05;
    	 
    }
    
    // Determining triangle arrangement based on how the four vertex isovalues
    // relate to the threshold. To me it's common sense, but in general, if
    // only one of the four isovalues is above the zero point threshold or only
    // one is below, then one triangle should cut through the three edges it's
    // connected to. That accounts for the first 8 (4x2) cases you see.
    // That leaves the two isovalue above or below case. In that instance, a 
    // two triangle arrangement is necessary. As mentioned, look at the pictures
    // in the article provided above, and that should make it clearer.
    
    // Because we're not concerned with triangular orientation, we can handle
    // two cases at once, which saves half the decision making. When triangle 
    // orientation is important, you can handle the cases seperately. It's been
    // while, but I'm pretty sure you can just reverse the order in once of 
    // the cases... Either way, if you weren't sure, a quick arrangement and
    // visual test would do the trick.
    
    // Single triangle cases:
    //
    // Vertex 0 only is inside (index = 1) or outside (index = 14) the isosurface 
    // (Ie: 1, 2 and 3 are inside).
    if(index == 1 || index == 14){
        
        //objID = 1.;
        tri = 1.;
        
        // This particular triangle will cut through the three edges connecting to 
        // vertex 0. Where the three vertices cut the edge will depend upon where the
        // isosurface touches the edge. You can determine that via simple interpolation.
        // For instance, if "ps[0]" has a value of "1" and "ps[1]" has a value of "-2,"
        // then you'd expect the triangle vertex to cut the edge one third of the 
        // way along the edge from "ps[0]."
        v1 = inter(p0, p1, ps[0], ps[1], isolevel);
        v2 = inter(p0, p2, ps[0], ps[2], isolevel);
        v3 = inter(p0, p3, ps[0], ps[3], isolevel);
        
    }    
    // Vertex 1 only is inside or outside.
    else if(index == 2 || index == 13){

        tri = 1.;
        v1 = inter(p1, p0, ps[1], ps[0], isolevel);
        v2 = inter(p1, p3, ps[1], ps[3], isolevel);
        v3 = inter(p1, p2, ps[1], ps[2], isolevel);
        
        
    }
    // Vertex 2 only is inside or outside.
    else if(index == 4 || index == 11){
        
        tri = 1.;
        v1 = inter(p2, p0, ps[2], ps[0], isolevel);
        v2 = inter(p2, p1, ps[2], ps[1], isolevel);
        v3 = inter(p2, p3, ps[2], ps[3], isolevel);

        
    } 
    // Vertex 3 only is inside or outside.
    else if(index == 7 || index == 8){
        
        tri = 1.;
        v1 = inter(p3, p0, ps[3], ps[0], isolevel);
        v2 = inter(p3, p2, ps[3], ps[2], isolevel);
        v3 = inter(p3, p1, ps[3], ps[1], isolevel);
        
    }
    
 
    
    
    // Two triangle cases.
    //
	// Vertices 0 and 1 are inside or vertices 2 and 3 are inside.
    if(index == 3 || index == 12){
        
        tri = 2.;
        
        v1 = inter(p0, p3, ps[0], ps[3], isolevel);
        v2 = inter(p0, p2, ps[0], ps[2], isolevel);
        v3 = inter(p1, p3, ps[1], ps[3], isolevel);
        
        v4 = v3;
        v5 = inter(p1, p2, ps[1], ps[2], isolevel);
        v6 = v2;

    
    }
    // Vertices 0 and 2 are inside or vertices 1 and 3 are inside.   
    else if(index == 5 || index == 10){
        
        tri = 2.;
        
        v1 = inter(p0, p1, ps[0], ps[1], isolevel);
        v2 = inter(p2, p3, ps[2], ps[3], isolevel);
        v3 = inter(p0, p3, ps[0], ps[3], isolevel);
        
        v4 = v1;
        v5 = inter(p1, p2, ps[1], ps[2], isolevel);
        v6 = v2;

    } 
    // Vertices 1 and 2 are inside or vertices 0 and 3 are inside.
    else if(index == 6 || index == 9){
        
        tri = 2.;
        
        v1 = inter(p0, p1, ps[0], ps[1], isolevel);
        v2 = inter(p1, p3, ps[1], ps[3], isolevel);
        v3 = inter(p2, p3, ps[2], ps[3], isolevel);
        
        v4 = v1;
        v5 = inter(p0, p2, ps[0], ps[2], isolevel);
        v6 = v3;

    }
    
    // Some notes on producing the vertex list - Per Dave Hoskins's request.
    //
    // Performing marching tetrahedra inside a pixel shader is a bit of a novelty, so as you 
    // could imagine, you wouldn't produce the actual vertex list within the shader. The idea 
    // would be to take this algorithm outside the pixel shader environment and produced the 
    // vertices there, where it'd be trivial. Basically, you'd visit every cube just once 
    // (instead of the multiple times required here). You'd subdivide each cube into tetrahedra 
    // using the 8 cube vertices (no need for step arithmetic), take the four isovalues, then 
    // proceed from there.
    
    // int vIndex = 0; // Counter to the vertex list. 
 
    // If necessary, draw a single triangle arrangement - in this case, three triangle edges.
    // All edges together form the mesh.
    if(tri>.5){
        
         mesh = sdCapsule(p, v1, v2, r1);
         mesh = min(mesh, sdCapsule(p, v2, v3, r1));
         mesh = min(mesh, sdCapsule(p, v3, v1, r1)); 
        
         // Imaginary vertex list array. Just keep adding vertices. Groups of three make 
         // up a triangle. "i" is the relative position of each cube, and v1, v2 and v3
         // are unique to each tetrahedron. Obviously, this would be performed outside the
         // the shader environment. You'd have to perform this over a 3 dimensional cubic
         // grid, then run through all six tetrahedra for each cube.
         // Splitting a cube into six tetrhedra. c0 to c7 represent the cube vertices.
		 // 1st [c0, c2, c3, c7], 2nd [c0, c2, c6, c7], 3rd [c0, c4, c6, c7],
		 // 4th [c0, c6, c1, c2], 5th [c0, c6, c1, c4], 6th [c5, c6, c1, c4].
         // For instance the first tetrahedron would be:
         // 1st [i, i + vec3(0, 0, 1), i + vec3(1, 0, 1), i + vec3(1, -1, 1)].
         //vertexList[vIndex++] = i + v1;
         //vertexList[vIndex++] = i + v2;
         //vertexList[vIndex++] = i + v3;
    } 
    
    // If a second triangle arrangement is required, draw it too.
    if(tri>1.5){
         mesh = min(mesh, sdCapsule(p, v4, v5, r1));
         mesh = min(mesh, sdCapsule(p, v5, v6, r1));
         mesh = min(mesh, sdCapsule(p, v6, v4, r1));
        
         // Imaginary vertex list array. Just keep adding triangles.
         //vertexList[vIndex++] = i + v4;
         //vertexList[vIndex++] = i + v5;
         //vertexList[vIndex++] = i + v6;
         
    } 
    
    
    // If necessary, draw little spheres to represent the vertex points for one
    // or two triangles.
    if(tri>.001) {
        va = vec3(dot(p - v1, p - v1), dot(p - v2, p - v2), dot(p - v3, p - v3));
        verts = sqrt(min(min(va.x, va.y), va.z)) - .06; 
    }
    if(tri>1.001) {
        va = vec3(dot(p - v4, p - v4), dot(p - v5, p - v5), dot(p - v6, p - v6));
        verts = min(verts, sqrt(min(min(va.x, va.y), va.z)) - .06);
    }

    // Add the vertices to the mesh.
    mesh = min(mesh, verts);

    // Object identification. Either the mesh or the encased isosurface.
    objID = mesh > surface ? 0. : 1.;
    
    // Combine the mesh with the continuous, encased surface.
    return min(mesh, surface);
    
    
    
}

 


// Standard raymarching routine.
float trace(vec3 o, vec3 r){
    
    float t = 0., d;
    
    for (int i = 0; i < 128; i++){
        
        d = map(o + r*t);
        
        if(abs(d)<.003*(t*.125 + 1.) || t>FAR) break;
        
        // Make smaller jumps as we approach the surface... kind of.
        t += (d<1. ? d*.5 : d);
    }
    
    return min(t, FAR);
}



// I keep a collection of occlusion routines... OK, that sounded really nerdy. :)
// Anyway, I like this one. I'm assuming it's based on IQ's original.
float cAO(in vec3 pos, in vec3 nor)
{
	float sca = 2.5, occ = 0.0;
    for( int i=min(0, iFrame); i<5; i++ ){
    
        float hr = 0.01 + float(i)*0.35/4.0;        
        float dd = map(nor * hr + pos);
        occ += (hr - dd)*sca;
        sca *= 0.7;
        
        // Fake break to prevent loop unrolling. Bad coding at its
        // finest, but the compiler seems to like it... Sigh! :)
        if(sca>1e5) break;
    }
    return clamp( 1.0 - occ, 0.0, 1.0 );    
}


// Standard normal function. It's not as fast as the tetrahedral calculation, but more symmetrical.
float getEdge(in vec3 p, in vec2 e) { 

     
    // This mess is an attempt to speed up compiler time by contriving a break... It's 
    // based on a suggestion by IQ. I think it works, but I really couldn't say for sure.
    float sgn = 1.;
    float mp[6];
    vec3[3] e6 = vec3[3](e.xyy, e.yxy, e.yyx);
    for(int i = min(0, iFrame); i<6; i++){
		mp[i] = map(p + sgn*e6[i/2]);
        sgn = -sgn;
        if(sgn>2.) break; // Fake conditional break;
    }
        
    float d = map(p)*2.;

    float edge = abs(mp[0] + mp[1] - d) + abs(mp[2] + mp[3] - d) + abs(mp[4] + mp[5] - d);
    //edge = abs(mp[0] + mp[1] + mp[2] + mp[3] + mp[4] + mp[5] - d*3.);
    edge = smoothstep(0., 1., sqrt(edge/e.x*2.));
    
    return edge;
}

// Standard normal function. It's not as fast as the tetrahedral calculation, but more symmetrical.
vec3 getNrm(in vec3 p, in vec2 e) {
    
    //vec3 n = normalize(vec3(map(p + e.xyy) - map(p - e.xyy),
    //map(p + e.yxy) - map(p - e.yxy),	map(p + e.yyx) - map(p - e.yyx)));
    
    // This mess is an attempt to speed up compiler time by contriving a break... It's 
    // based on a suggestion by IQ. I think it works, but I really couldn't say for sure.
    float sgn = 1.;
    float mp[6];
    vec3[3] e6 = vec3[3](e.xyy, e.yxy, e.yyx);
    for(int i = min(0, iFrame); i<6; i++){
		mp[i] = map(p + sgn*e6[i/2]);
        sgn = -sgn;
        if(sgn>2.) break; // Fake conditional break;
    }
    
    return normalize(vec3(mp[0] - mp[1], mp[2] - mp[3], mp[4] - mp[5]));
}


// Normal calculation, with some edging and curvature bundled in.
//
// Addendum: I've rewritten this in a very contrived and ugly form to 
// appease the compiler. It seems to work, but I still don't like it. :)
vec3 nrm(vec3 p, inout float edge, inout float crv, float t) { 
	
    
    // Roughly two pixel edge spread, regardless of resolution.
    vec2 e = vec2(1./iResolution.y*(1. + t*.5), 0);
    
    edge = getEdge(p, e);
/*   
	float d1 = map(p + e.xyy), d2 = map(p - e.xyy);
	float d3 = map(p + e.yxy), d4 = map(p - e.yxy);
	float d5 = map(p + e.yyx), d6 = map(p - e.yyx);
	float d = map(p)*2.;
    
    edge = abs(d1 + d2 - d) + abs(d3 + d4 - d) + abs(d5 + d6 - d);
    //edge = abs(d1 + d2 + d3 + d4 + d5 + d6 - d*3.);
    edge = smoothstep(0., 1., sqrt(edge/e.x*2.));
    */
/*    
    // Wider sample spread for the curvature.
    e = vec2(12./450., 0);
	d1 = map(p + e.xyy), d2 = map(p - e.xyy);
	d3 = map(p + e.yxy), d4 = map(p - e.yxy);
	d5 = map(p + e.yyx), d6 = map(p - e.yyx);
    crv = clamp((d1 + d2 + d3 + d4 + d5 + d6 - d*3.)*32. + .5, 0., 1.);
*/
    
    e = vec2(.002, 0); //iResolution.y - Depending how you want different resolutions to look.
    /*
    d1 = map(p + e.xyy), d2 = map(p - e.xyy);
	d3 = map(p + e.yxy), d4 = map(p - e.yxy);
	d5 = map(p + e.yyx), d6 = map(p - e.yyx);
	
    return normalize(vec3(d1 - d2, d3 - d4, d5 - d6));
    */
    
    return getNrm(p, e);
}


 
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    
    // Screen coordinates.
	vec2 uv = (fragCoord - iResolution.xy*.5)/iResolution.y;
	
    const float camSpeed = 1.;
	// Camera Setup.
	vec3 ro = vec3(0, 0, iTime*camSpeed); // Camera position, doubling as the ray origin.
	vec3 lk = ro + vec3(0, 0, .25);  // "Look At" position.
 
   
    // Light position. Set in the vicinity of the camera.
    vec3 lp = ro + vec3(0, 2, -1);
   
   
	// Using the Z-value to perturb the XY-plane.
	// Sending the camera, "look at," and light vector down the path. The "path" function is 
	// synchronized with the distance function.
    ro.xy += path(ro.z).xy;
	lk.xy += path(lk.z).xy;
	lp.xy += path(lp.z).xy;
    

    // Using the above to produce the unit ray-direction vector.
    float FOV = 3.14159/3.; // FOV - Field of view.
    vec3 forward = normalize(lk-ro);
    vec3 right = normalize(vec3(forward.z, 0., -forward.x )); 
    vec3 up = cross(forward, right);

    // rd - Ray direction.
    vec3 r = normalize(forward + FOV*uv.x*right + FOV*uv.y*up);
    //r = normalize(vec3(r.xy, sqrt(max(r.z*r.z - dot(r.xy, r.xy)*.15, 0.)) ));
    
    // Saving the unit direction ray, to be used in the distance function.
    svRd = r;
    
    // Camera swivel - based on path position.
    //vec2 sw = path(lk.z).xy;
    //r.xy *= r2(-sw.x/32.);
    
    // Basic raymarching function.
    float t = trace(ro, r);
    
    svObjID = objID; // Save the ID.


    // Scene color.
    vec3 sc = vec3(0);
   

    // Edge and curvature - The latter isn't being used..
    float edge = 0., crv = 1.;
    
    if(t<FAR){
        
        // Hit position and normal.
        vec3 sp = ro + r*t;
        vec3 sn = nrm(sp, edge, crv, t);
        
        // Scene coloring. Very basic.
        vec3 oCol = tex3D(iChannel0, sp, sn)*2.;
        if(svObjID<.5) oCol = mix(oCol, oCol.zyx, .75);
        
        
        float ao = cAO(sp, sn); // Ambient occlusion.

        // Point light.
        vec3 ld = lp - sp;
        float dist = max(length(ld), 0.001);
        ld /= dist;

        float atten = 5./(1. + dist*0.125 + dist*dist*0.05); // Attenuation.
        
        float diff = max(dot(ld, sn), 0.); // Diffuse.
        
       
        // Putting it all together.
    	sc = oCol*(diff + ao*.35)*atten*ao*(1. - edge*.7);
        

    }
    
    
    // Extra dark fog. The more we hide with this scene the better. :)
    sc = mix(vec3(0), sc, 1.0 / (1. + t*0.125 + t*t * 0.03));
    //sc = mix(sc, vec3(0), smoothstep(0.0, .2, t/FAR));
    
    // Rough gamma correction.
	fragColor = vec4(sqrt(max(sc, 0.)), 1);
}
`;

export default class implements iSub {
  key(): string {
    return 'MdSBRc';
  }
  name(): string {
    return '[SH17C] Surface Mesh Generation';
  }
  sort() {
    return 292;
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
    return [webglUtils.WOOD_TEXTURE];
  }
}
