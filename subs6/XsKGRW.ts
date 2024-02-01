import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// The scene itself. Not much commenting, since this is mainly about the radial blur,
// plus a lot of it is rudimentary.

#define FAR 20.

// Hash.
float hash( float n ){ return fract(cos(n)*45758.5453); }


// Tri-Planar blending function. Based on an old Nvidia writeup:
// GPU Gems 3 - Ryan Geiss: http://http.developer.nvidia.com/GPUGems3/gpugems3_ch01.html
vec3 tpl( sampler2D t, in vec3 p, in vec3 n ){
   
    n = max(abs(n), 0.001);
    n /= (n.x + n.y + n.z );  
	p = (texture(t, p.yz)*n.x + texture(t, p.zx)*n.y + texture(t, p.xy)*n.z).xyz;
    return p*p;
}

// A simple, cheap but visually effective sinusoid based lattice. The downside to building
// a scene with transcendentals is the honing difficulty, but the logarithmic based
// "Logarithmmic Bisection" tracing method counters that.
float map(in vec3 p){
   
    // A few small bumps to put on the surface.
    float bump = (dot(sin(p*24. - cos(p.yzx*36.)), vec3(.015)));
    
    // Perturbing the surface slightly, prior to construction.
    p += sin(p*8. + 3.14159)*.1;
    
    // The main surface. A weird, molecular looking lattice.
    float n = dot(sin(p*2.), cos(p.yzx*2.));
    
 	// Clamping the surface value, and adding the bumps.
    //return (clamp(0., -1.1, n) + 1.1)/1.1 + bump;
    return (min(n, 0.) + 1.1)/1.1 + bump;
    
}

 
// Ambient occlusion, for that self shadowed look.
// XT95 came up with this particular version. Very nice.
//
// Hemispherical SDF AO - https://www.shadertoy.com/view/4sdGWN
// Alien Cocoons - https://www.shadertoy.com/view/MsdGz2
float cao( in vec3 p, in vec3 n, float maxDist )
{
	float ao = 0.0, l;
	const float nbIte = 6.0;
	const float falloff = 1.5;
    for( float i=1.; i< nbIte+.5; i++ ){
    
        l = (i + hash(i))*.5/nbIte*maxDist;
        ao += (l - map( p + n*l ))/ pow(1. + l, falloff);
    }
	
    return clamp( 1.-ao/nbIte, 0., 1.);
}

// Tetrahedral normal, courtesy of IQ.
vec3 nr(in vec3 p)
{  
    vec2 e = vec2(-1, 1)*.001;   
	return normalize(e.yxx*map(p + e.yxx) + e.xxy*map(p + e.xxy) + 
					 e.xyx*map(p + e.xyx) + e.yyy*map(p + e.yyy) );   
}

// A trimmed down version of Nimitz's "Log Bisecion" method. Very effective on
// difficult to hone in on things like weird, transcendental surfaces.
// Worth studying, if you're not familiar with it.
//
// Log-Bisection Tracing - Nimitz
// https://www.shadertoy.com/view/4sSXzD
float logBisectTrace( in vec3 ro, in vec3 rd){


    float t = 0., told = 0., mid, dn;
    float d = map(rd*t + ro);
    float sgn = sign(d);

    for (int i=0; i<64; i++){

        // If the threshold is crossed with no detection, use the bisection method.
        // Also, break for the usual reasons. Note that there's only one "break"
        // statement in the loop. I heard GPUs like that... but who knows?
        if (sign(d) != sgn || d < 0.001 || t > FAR) break;
 
        told = t;
        
        // Branchless version of the following:  
        // if(d>1.) t += d*.5; else t += log(abs(d) + 1.1)*.5;
        t += step(d, 1.)*(log(abs(d) + 1.1)*.5 - d*.5) + d*.5;
       
        d = map(rd*t + ro);
    }
    
    // If a threshold was crossed without a solution, use the bisection method.
    if (sign(d) != sgn){
    
        // Based on suggestions from CeeJayDK, with some minor changes.

        dn = sign(map(rd*told + ro));
        
        vec2 iv = vec2(told, t); // Near, Far

        // 6 iterations seems to be more than enough, for most cases...
        // but there's an early exit, so I've added a couple more.
        for (int ii=0; ii<8; ii++){ 
            //Evaluate midpoint
            mid = dot(iv, vec2(.5));
            float d = map(rd*mid + ro);
            if (abs(d) < 0.001)break;
            // Suggestion from movAX13h - Shadertoy is one of those rare
            // sites with helpful commenters. :)
            // Set mid to near or far, depending on which side we're on.
            iv = mix(vec2(iv.x, mid), vec2(mid, iv.y), step(0.0, d*dn));
        }

        t = mid; 
        
    }

    return min(t, FAR);
}

// Shadows.
float sha(in vec3 ro, in vec3 rd, in float start, in float end, in float k){

    float shade = 1.0;
    const int maxIterationsShad = 16; 

    float dist = start;
    float stepDist = end/float(maxIterationsShad);

    for (int i=0; i<maxIterationsShad; i++){
        float h = map(ro + rd*dist);
        //shade = min(shade, k*h/dist);
        shade = min(shade, smoothstep(0.0, 1.0, k*h/dist));

        dist += clamp(h, 0.02, 0.16);
        
        // There's some accuracy loss involved, but early exits from accumulative distance function can help.
        if ((h)<0.001 || dist > end) break; 
    }
    
    return min(max(shade, 0.) + 0.1, 1.0); 
}

// Grey scale.
float gr(vec3 p){ return dot(p, vec3(0.299, 0.587, 0.114)); }

// Texture bump mapping. Four tri-planar lookups, or 12 texture lookups in total.
vec3 db( sampler2D tx, in vec3 p, in vec3 n, float bf){
   
    const vec2 e = vec2(0.001, 0);
    // Gradient vector, constructed with offset greyscale texture values.
    vec3 g = vec3( gr(tpl(tx, p - e.xyy, n)), gr(tpl(tx, p - e.yxy, n)), gr(tpl(tx, p - e.yyx, n)));
    
    g = (g - gr(tpl(tx,  p , n)))/e.x; g -= n*dot(n, g);
                      
    return normalize( n + g*bf ); // Bumped normal. "bf" - bump factor.
	
}

// Camera path. Arranged to coincide with the frequency of the lattice.
vec3 camPath(float t){
  
    return vec3(-sin(t), sin(t) + .75, t*2. + .5);
    
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    
    
	// Screen coordinates.
	vec2 u = (fragCoord - iResolution.xy*0.5)/iResolution.y;
	
	// Camera Setup.
	
    vec3 o = camPath(iTime); // Camera position, doubling as the ray origin.
    vec3 lk = camPath(iTime + .1);  // "Look At" position.
    vec3 l = o + vec3(1.5, 1., -0.5); // Light position, somewhere near the moving camera.


    // Using the above to produce the unit ray-direction vector.
    float FOV = 3.14159/3.; // FOV - Field of view.
    vec3 fwd = normalize(lk-o);
    vec3 rgt = normalize(vec3(fwd.z, 0., -fwd.x )); 
    vec3 up = cross(fwd, rgt);

    // Unit direction ray.
    vec3 r = normalize(fwd + FOV*(u.x*rgt + u.y*up));
    // Lens distortion.
    //vec3 r = fwd + FOV*(u.x*rgt + u.y*up);
    //r = normalize(vec3(r.xy, (r.z - length(r.xy)*.5)));
    
    
    // Rotate the camera using Fabrice's simplified rotation matrix.
    u = sin(vec2(1.57, 0) - iTime/2.); // Reusing "u."
    mat2 a = mat2(u, -u.y, u.x);
    r.xz = a * r.xz;
    r.xy = a * r.xy;

    // Nimitz's fancy surface intersection formula.
    float t = logBisectTrace(o, r);

    // Initialize the scene color to zero.
    vec3 col = vec3(0);
    
    // If the surface is hit, light it up.
    if(t<FAR){
    
        // Position and normal.
        vec3 p = o + r*t, n = nr(p);
        
        // Texture bump the normal.
        float sz = 1./1.;
        n = db(iChannel0, p*sz, n, .03/(1. + t/FAR));


        l -= p; // Light to surface vector. Ie: Light direction vector.
        float d = max(length(l), 0.001); // Light to surface distance.
        l /= d; // Normalizing the light direction vector.
        
        // Ambient occlusion and shadowing.
        float ao =  cao(p, n, 4.);
        float sh = sha(p, l, 0.04, d, 4.);
        
        // Diffuse, specular, fresnel. Only the latter is being used here.
        //float di = max(dot(l, n), 0.);
        //float sp = pow(max( dot( reflect(r, n), l ), 0.0 ), 8.); // Specular term.
        float fr = clamp(1.0 + dot(r, n), 0.0, 1.0); // Fresnel reflection term.
        
        // Texturing the surface with some tri-planar mapping..
        vec3 tx = tpl( iChannel0, p*sz, n);

		// Very simple coloring. Fresnel and texture combination. Radial blurs like simplicity. :)
        col = tx*fr*4.;
        col *= 1./(1. + d*.125 + d*d*.05)*ao*sh;

        
    }

    vec3 bg = vec3(1, .56, .3);
    col = mix(clamp(col, 0., 1.), bg, smoothstep(0., FAR-2., t));
    fragColor = vec4(col, 1.);
    
    
}
`;

const fragment = `
/*
	Full Scene Radial Blur
	----------------------

	Radial blur - as a postprocessing effect - is one of the first things I considered doing 
	when the multipass system came out. I've always loved this effect. Reminds me of the early 
	demos from Aardbei et al. 

	Anyway, Shadertoy user, Passion, did a really cool radial blur on a field of spheres that
	inspired me to do my own. Radial blurs are pretty straight forward, but it was still
    helpful to have Passion's version as a guide. 

    As for the radial blur process, there's not much to it. Start off at the pixel position, 
    then radiate outwards gathering up pixels with decreased weighting. The result is a
	blurring of the image in a radial fashion, strangely enough. :)

	Inspired by:

	Blue Dream - Passion
	https://www.shadertoy.com/view/MdG3RD

	Radial Blur - IQ
	https://www.shadertoy.com/view/4sfGRn

	Rays of Blinding Light - mu6k
	https://www.shadertoy.com/view/lsf3Dn

*/

// The radial blur section. Shadertoy user, Passion, did a good enough job, so I've used a
// slightly trimmed down version of that. By the way, there are accumulative weighting 
// methods that do a slightly better job, but this method is good enough for this example.


// Radial blur samples. More is always better, but there's frame rate to consider.
const float SAMPLES = 24.; 


// 2x1 hash. Used to jitter the samples.
float hash( vec2 p ){ return fract(sin(dot(p, vec2(41, 289)))*45758.5453); }


// Light offset.
//
// I realized, after a while, that determining the correct light position doesn't help, since 
// radial blur doesn't really look right unless its focus point is within the screen boundaries, 
// whereas the light is often out of frame. Therefore, I decided to go for something that at 
// least gives the feel of following the light. In this case, I normalized the light position 
// and rotated it in unison with the camera rotation. Hacky, for sure, but who's checking? :)
vec3 lOff(){    
    
    vec2 u = sin(vec2(1.57, 0) - iTime/2.);
    mat2 a = mat2(u, -u.y, u.x);
    
    vec3 l = normalize(vec3(1.5, 1., -0.5));
    l.xz = a * l.xz;
    l.xy = a * l.xy;
    
    return l;
    
}



void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    
    // Screen coordinates.
    vec2 uv = fragCoord.xy / iResolution.xy;

    // Radial blur factors.
    //
    // Falloff, as we radiate outwards.
    float decay = 0.97; 
    // Controls the sample density, which in turn, controls the sample spread.
    float density = 0.5; 
    // Sample weight. Decays as we radiate outwards.
    float weight = 0.1; 
    
    // Light offset. Kind of fake. See above.
    vec3 l = lOff();
    
    // Offset texture position (uv - .5), offset again by the fake light movement.
    // It's used to set the blur direction (a direction vector of sorts), and is used 
    // later to center the spotlight.
    //
    // The range is centered on zero, which allows the accumulation to spread out in
    // all directions. Ie; It's radial.
    vec2 tuv =  uv - .5 - l.xy*.45;
    
    // Dividing the direction vector above by the sample number and a density factor
    // which controls how far the blur spreads out. Higher density means a greater 
    // blur radius.
    vec2 dTuv = tuv*density/SAMPLES;
    
    // Grabbing a portion of the initial texture sample. Higher numbers will make the
    // scene a little clearer, but I'm going for a bit of abstraction.
    vec4 col = texture(iChannel1, uv.xy)*0.25;
    
    // Jittering, to get rid of banding. Vitally important when accumulating discontinuous 
    // samples, especially when only a few layers are being used.
    uv += dTuv*(hash(uv.xy + fract(iTime))*2. - 1.);
    
    // The radial blur loop. Take a texture sample, move a little in the direction of
    // the radial direction vector (dTuv) then take another, slightly less weighted,
    // sample, add it to the total, then repeat the process until done.
    for(float i=0.; i < SAMPLES; i++){
    
        uv -= dTuv;
        col += texture(iChannel1, uv) * weight;
        weight *= decay;
        
    }
    
    // Multiplying the final color with a spotlight centered on the focal point of the radial
    // blur. It's a nice finishing touch... that Passion came up with. If it's a good idea,
    // it didn't come from me. :)
    col *= (1. - dot(tuv, tuv)*.75);
    
    // Smoothstepping the final color, just to bring it out a bit, then applying some 
    // loose gamma correction.
    fragColor = sqrt(smoothstep(0., 1., col));
    
    // Bypassing the radial blur to show the raymarched scene on its own.
    //fragColor = sqrt(texture(iChannel1, fragCoord.xy / iResolution.xy));
}


`;

export default class implements iSub {
  key(): string {
    return 'XsKGRW';
  }
  name(): string {
    return 'Full Scene Radial Blur';
  }
  sort() {
    return 688;
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
      webglUtils.TEXTURE9,
      { type: 1, f: buffA, fi: 1 }, //
    ];
  }
}
