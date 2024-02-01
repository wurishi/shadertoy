import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const f = `
// 2x2 hash algorithm.
vec2 hash22(vec2 p) { 
    
    // This line makes the pattern repeatable. 
    p = mod(p, 5.); 

    // More concise, but wouldn't disperse things as nicely as other versions.
    float n = sin(dot(p, vec2(41, 289))); 
    return fract(vec2(8, 1)*262144.*n);

    //p = fract(vec2(8, 1)*262144.*n);
    //return sin(p*6.283 + iTime)*0.5 + 0.5;

}


// 2D 2nd-order Voronoi: Obviously, this is just a rehash of IQ's original. I've tidied
// up those if-statements. Since there's less writing, it should go faster. That's how 
// it works, right? :)
//
float voronoi(in vec2 p){
    
	vec2 g = floor(p), o; p -= g;
	
	vec3 d = vec3(1); // 1.4, etc. "d.z" holds the distance comparison value.
    
	for(int y = -1; y <= 1; y++){
		for(int x = -1; x <= 1; x++){
            
			o = vec2(x, y);
            o += hash22(g + o) - p;
            
			d.z = dot(o, o);            
            d.y = max(d.x, min(d.y, d.z));
            d.x = min(d.x, d.z); 
                       
		}
	}
	
	
    return d.y - d.x;
    // return d.x;
    // return max(d.y*.91 - d.x*1.1, 0.)/.91;
    // return sqrt(d.y) - sqrt(d.x); // etc.
}

// Prerendering a simple stone texture to one of the offscreen buffers. The process is simple, but
// definitely not simple enough to calculate it on the fly inside a distance function.
//
// There is one minor complication, and that is the texture needs to be repeatable. That's its own
// discussion, but if you're not sure how it's achieved, the key to repeatable Voronoi are the lines 
// "p = mod(p, 5)" and "float c = voronoi(p*5.)... ." I'm sure you'll figure it out from there. :)
//
// The random pixelization business is just a hacky way to redraw the texture when the canvas is resized.
// Definitely not the best way to go about it, that's for sure.
//
void mainImage( out vec4 fragColor, in vec2 fragCoord ){

    // Offscreen buffer coordinates.
    vec2 p = fragCoord.xy/iResolution.xy;

    // On the first frame, render the entire texture. Otherwise, randomly render every 8 pixels,
    // which, in theory, should lessen the workload. I'm continuously rendering parts of the texture
    // to account for resizing events. If you resize, the new heighmap will quickly pixel fade in.
    
    // Obviously, a better solution would be to detect a resize and render the texture just once, or 
    // better yet, have a fixed size offscreen buffer option... Although, that sounds like a backend 
    // nightmare. :)
    //if(hash22(p + iTime).x< 1./8. || iFrame==0){
    if(floor(hash22(p + iTime).x*8.)< 1. || iFrame==0){    
        
        // The stone texture. I made this up on the spot. Basically add three second order Voronoi
        // layers of varying amplitudes and frequency. Also, perturb the initial UV coordinates
        // to give it more of a natural look. Finally, add some fine detailing via one of Shadertoy's
        // in-house textures. By the way, you could generate that also, but I didn't want to 
        // overcomplicate a simple example.
        
        // Texture value. Reversing the channels for a different color variation.
        vec3 tx = texture(iChannel0, p).xyz; tx *= tx;
        tx = smoothstep(0., .5, tx);
        
        // Perturbing the UV coordinates just slightly to give the stones a slightly more natural feel.
        // Note the PI frequencies. That's for texture wrapping purposes.
        p += sin(p*6.283*2. - cos(p.yx*6.283*4.))*.01;
        
        // Three Voronoi layers. Pretty standard. I could have put a lot more effort into this
        // part, but it's just a simple proof of concept, so just three lazy layers.
        
        // More stone looking.
        //float c = voronoi(p*5.)*.8 + voronoi(p*15.)*.15 + voronoi(p*45.)*.05;
        
        // Less detail.
        //float c = voronoi(p*5.) - (1.-voronoi(p*15.))*.08 + voronoi(p*45.)*.04;
        
       
        //float c = voronoi(p*5.)*.6 + voronoi(p.yx*5. + vec2(2.666, 1.666))*.4 - (1.-voronoi(p*15.))*.08 + voronoi(p*45.)*.04;
        float c = voronoi(p*5. - .35)*.6 + voronoi((p.yx + .5)*10.)*.3 + (1.-voronoi(p*25.))*.075 + voronoi(p*60.)*.025;
 
        

        // Finally, using the greyscale texture value to add some fine detailing.
        c += dot(tx, vec3(.299, .587, .114))*.1;
        
        
        // Storing away the values for use in the main part of the application.
        fragColor.xyz = tx; // Put the texture color in the XYZ channels.
        fragColor.w = min(c/1.1, 1.); // Store the heightmap value in the "W" channel.


    }
    // Copy the rest of the pixels over to the new frame. Obvious, but it'd been a while, so I had to 
    // figure that one out. :)
    else fragColor = texture(iChannel1, p); 
    fragColor.a = 1.;
}
`;

const fragment = `
/*

	Precalculated Voronoi Heightmap
	-------------------------------

	Generating a simple, abstract stone texture in a single offscreen loop pass, then using 
	it as a heightmap for raymarching purposes. The example itself is nothing exciting, but it 
	shows that you can now calculate things like multiple terrain layers - or anything you can 
	dream up - in a single pass. In fact, if you put together a simple resizing system, you 
	could get it done in a single frame.

	You can find the texture creation behind the "Buf A" tab. For the record, I haven't	properly 
	investigated correct procedures yet, so there's probably a better way to preload a heightmap. 
	Ideally, it'd be nice to render to a fixed sized buffer, like 512 by 512 for instance, which
    would be especially helpful when moving to fullscreen, but I don't think that's possible at 
	present? Either way, the framerate is much, much better in a sub-1000-px sized canvas than 
	it would be if you had to do the same without multipass.

	By the way, thanks to "poljere," "iq" -- and whoever else was involved -- for providing 
	multiple-pass functionality. Putting that together would have been a backend nightmare, but 
	it opens up so many possibilities.

*/

// If you want to see what the generated heightmap looks like by itself, uncomment the following.
//#define SHOW_HEIGHMAP 

// Tri-Planar blending function. Based on an old Nvidia writeup:
// GPU Gems 3 - Ryan Geiss: http://http.developer.nvidia.com/GPUGems3/gpugems3_ch01.html
vec3 tex3D( sampler2D tex, in vec3 p, in vec3 n ){
   
    p = fract(p);
    
    n = max(n*n, 0.001);
    n /= (n.x + n.y + n.z ); 
    
	return (texture(tex, p.yz)*n.x + texture(tex, p.zx)*n.y + texture(tex, p.xy)*n.z).xyz;
}

// Reducing the heightmap function to a single texel lookup - via the stone texture which was 
// generated outside the distance function in the onscreen buffer, of course.
//
// Using the single pass system, there would have been no other option than to generate the stone 
// texture several times a frame... or beg someone behind the scenes to provide a 2D multilayered 
// Voronoi heightmap. :)
float heightMap( in vec2 p ) { 

    // The stone texture is tileable, or repeatable, which means the pattern is slightly
    // repetitive, but not too bad, all things considered. Note that the offscreen buffer 
    // doesn't wrap, so you have to do that yourself. Ie: fract(p) - Range [0, 1].
    return texture(iChannel1, fract(p/2.), -100.).w;

}


// Raymarching a textured XY-plane, with a bit of distortion thrown in.
float map(vec3 p){

    // The height value.
    float c = heightMap(p.xy);
    
    // Back plane, placed at vec3(0., 0., 1.), with plane normal vec3(0., 0., -1).
    // Adding some height to the plane from the texture. Not much else to it.
    return 1. - p.z - c*.1;//texture(texChannel0, p.xy).x*.1;

    
    // Smoothed out.
    //float t =  heightMap(p.xy);
    //return 1. - p.z - smoothstep(0.1, .8, t)*.06 - t*t*.03;
    
}


// Tetrahedral normal, courtesy of IQ.
vec3 getNormal( in vec3 pos )
{
    vec2 e = vec2(0.001, -0.001);
    return normalize(
        e.xyy * map(pos + e.xyy) + 
        e.yyx * map(pos + e.yyx) + 
        e.yxy * map(pos + e.yxy) + 
        e.xxx * map(pos + e.xxx));
}



// Ambient occlusion, for that self shadowed look.
// Based on the original by IQ.
float calculateAO(vec3 p, vec3 n)
{
   const float AO_SAMPLES = 5.0;
   float r = 1.0, w = 1.0;
   for (float i=1.0; i<=AO_SAMPLES; i++)
   {
      float d0 = i/AO_SAMPLES;
      r += w * (map(p + n * d0) - d0);
      w *= 0.5;
   }
   return clamp(r, 0.0, 1.0);
}

// Cool curve function, by Shadertoy user, Nimitz.
//
// It gives you a scalar curvature value for an object's signed distance function, which 
// is pretty handy for all kinds of things. Here's it's used to darken the crevices.
//
// From an intuitive sense, the function returns a weighted difference between a surface 
// value and some surrounding values - arranged in a simplex tetrahedral fashion for minimal
// calculations, I'm assuming. Almost common sense... almost. :)
//
// Original usage (I think?) - Cheap curvature
// Other usage: Xyptonjtroz
float curve(in vec3 p){

    const float eps = 0.0225, amp = 7.5, ampInit = 0.525;

    vec2 e = vec2(-1., 1.)*eps; //0.05->3.5 - 0.04->5.5 - 0.03->10.->0.1->1.
    
    float t1 = map(p + e.yxx), t2 = map(p + e.xxy);
    float t3 = map(p + e.xyx), t4 = map(p + e.yyy);
    
    return clamp((t1 + t2 + t3 + t4 - 4.*map(p))*amp + ampInit, 0., 1.);
}



void mainImage( out vec4 fragColor, in vec2 fragCoord ){
    
    
    // Unit direction ray. Divisionless one liner, courtesy of user, Coyote.
    vec3 rd = normalize(vec3(fragCoord - iResolution.xy*.5, min(iResolution.y*.75, 600.)));
    
    // Rotating the XY-plane back and forth, for a bit of variance.
    // Elegant angle vector, courtesy of user, Fabrice.
    vec2 th = sin(vec2(1.57, 0) + sin(iTime/4.)*.3);
    rd.xy = mat2(th, -th.y, th.x)*rd.xy;
    
    // Tilting the camera in another direction.
    //th = sin(vec2(1.57, 0) + sin(iTime/8.)*.1);
    //mat2(th, -th.y, th.x)*rd.yz;
    
    
    // Ray origin. Moving in the X-direction to the right.
    vec3 ro = vec3(iTime, cos(iTime/4.), 0.);
    
    
    // Light position, hovering around behind the camera.
    vec3 lp = ro + vec3(cos(iTime/4.)*.5, sin(iTime/4.)*.5, -.5);
    
    // Standard raymarching segment. Because of the straight forward setup, very few 
    // iterations are needed.
    float d, t=0.;
    for(int j=0; j<32; j++){
      
        d = map(ro + rd*t); // Distance to the function.
        
        // The plane "is" the far plane, so no far plane break is needed.
        if(d<0.001) break; 
        
        t += d*.7; // Total distance from the camera to the surface.
    
    }
    
   
    // Surface postion, surface normal and light direction.
    vec3 sp = ro + rd*t;
    vec3 sn = getNormal(sp);
    vec3 ld = lp - sp;
    
    
    // Texture scale factor.
    const float tSize0 = 1./1.;
    
    
    // Retrieving the texel at the surface postion. A tri-planar mapping method is used to
    // give a little extra dimension. The time component is responsible for the texture movement.
    float c = heightMap(sp.xy);
   
    
    vec3 oC = tex3D(iChannel1, sp*tSize0, sn);
    //vec3 oC = texture(iChannel1, sp.xz*tSize0).xyz*(vec3(c)*.5+.5); // 2D texel lookup.
    //vec3 oC = vec3(.55)*(vec3(c)*.9+.1); // Textureless.
    
    // Mixing in the normal to give the color a bit of a pearlescent quality. These rocks probably
    // wouldn't have a pearlecent quality... Um... space rocks. :)
    oC *= pow(max(c*c*sn*.7 + 1., 0.), vec3(2))*c;
   
    
    
    float lDist = max(length(ld), 0.001); // Light distance.
    float atten = 1./(1. + lDist*.125); // Light attenuation.
    
    ld /= lDist; // Normalizing the light direction vector.
    
    float diff = max(dot(ld, sn), 0.); // Diffuse.
    diff = pow(diff, 4.)*2.;
    float spec = pow(max( dot( reflect(-ld, sn), -rd ), 0.0 ), 16.); // Specular.
    float fre = pow(clamp(dot(sn, rd) + 1., .0, 1.), 2.); // Fake Fresnel, for the glow.
 
    // Schlick Fresnel approximation, to tone down the specular component a bit.
	float Schlick = pow( 1. - max(dot(rd, normalize(rd + ld)), 0.), 5.);
	float fre2 = mix(.5, 1., Schlick);  //F0 = .5;  // Hard granite.  
    
    // Shading. Note, there are no actual shadows. The camera is front on, so the following
    // two functions are enough to give a shadowy appearance.
    float crv = curve(sp); // Curve value, to darken the crevices.
    crv = smoothstep(0., 1., crv)*.5 + crv*.25 + .25; // Tweaking the curve value a bit.
    
    float ao = calculateAO(sp, sn); // Ambient occlusion, for self shadowing.


    
    // Combining the terms above to light the texel.
    vec3 col = (oC*(diff + .25 + vec3(.5, .7, 1)*spec*fre2*4. + vec3(1, .1, .2)*fre*8.));
    
    
    // Another variation, without the Fresnel glow.
    //vec3 col = (oC*(diff + 1.) + vec3(1., .9, .7)*spec*fre2*2.);
 
    
    // Applying the shades.
    col *= atten*crv*ao;
    
    //col = vec3(crv);
    
    #ifdef SHOW_HEIGHMAP
    vec2 uv = fragCoord.xy/iResolution.y;
    uv = mat2(th, -th.y, th.x)*uv;
    uv += vec2(iTime, cos(iTime/4.))/2.;
    vec4 tex = texture(iChannel1, fract(uv/1.));
    col = sqrt(tex.xyz)*tex.w;
	#endif

    // Presenting to the screen.
	fragColor = vec4(sqrt(clamp(col, 0., 1.)), 1.);
}
`;

export default class implements iSub {
  key(): string {
    return 'ldtGWj';
  }
  name(): string {
    return 'Precalculated Voronoi Heightmap';
  }
  // sort() {
  //   return 0;
  // }
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
    return [webglUtils.TEXTURE9, { type: 1, f, fi: 1 }];
  }
}
