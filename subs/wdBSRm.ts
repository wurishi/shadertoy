import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `

uniform int u_shape;


// Root 2, or more precisely, an approximation to the principle square root of 2. :)
#define sqrt2 1.414213562373


//  vec2 to float hash.
float hash12(vec2 p){

	return fract(sin(dot(p ,vec2(12.9898, 78.233)))*43758.5453);
}

 
//  vec2 to vec2 hash.
vec2 hash22(vec2 p){

    return fract(sin(vec2(dot(p,vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))))*43758.5453);
}


// Standard 2D rotation formula.
mat2 rot2(in float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }

/*
	This is Fizzer's circle solving function. It's very useful, and not just for this
	particular example. I put in some rough comments, for anyone who wants to know how
	it comes about. Although, I'd doulbe check the reasoning. 

	I spent quite some time trying to tackle the geometry from a different perspective, 
	then realized that since the points A and B would be in constant form, a lot of this 
	would be optimized by the compiler... Would that be right? Either way, even if it 
	wasn't, it'd be possible to precalculate a lot of this anyway.


            A
             \
              \
  O------------C (0, 0)
              /
             B
*/

/*
// Returns the origin and radius of a circle intersecting A and B, with tangents
// at A and B pointing towards C (vec2(0)). This is for drawing the circular arcs.
void solveCircle(vec2 a, vec2 b, out vec2 o, out float r){

    // Angle between two vectors (AC and BC) defined using an inner product.
    // cos(th) = a.b/|a||b|
    float th = acos(dot(normalize(a), normalize(b)))/2.; // Angle OCA
    float adj = length(a); // Length AC.
    r = tan(th)*adj; // r is not length OC, it's OA... 15 minutes of my life I won't get back. :)
    o = normalize(a + b)*sqrt(r*r + adj*adj); // Direction and length of OC.
 
}
*/

// adx's considerably more concise version of the method above.
// On a side note, if you haven't seen it before, his "Quake / Introduction" 
void solveCircle(vec2 a, vec2 b, out vec2 o, out float r){
    
    vec2 m = a + b;
    o = dot(a, a)/dot(m, a)*m;
    r = length(o - a);
    
}

// The following function takes in the color, fractional coordinates, tangential arc 
// end-points, arc width, and a scaling factor -- which is necessary to plot the correct 
// amount of arc lines.
//
// A lot of this is just window dressing, so I wouldn't take it too seriously. Without the
// decoration, this'd be a pretty short function.
vec3 doArc(vec3 col, float w, float arc, vec2  p, float aNum, float r){
    
    
    // Indexing into the texture prior to coordinate manipulation.
    vec3 tx = texture(iChannel0, p).xyz; tx *= tx;
     
    // Rotating the lines to a different position. Not absolutely necessary, but
    // I thought they looked neater here.
    p = rot2(3.14159/aNum)*p;
    
 
    // Using the arc distance field for a bit of sinusoidal shading. Not that important,
    // and not the only way to do it, but it enhances the borders a bit.
    float shade = min(abs(arc)/.1*1.25, 1.);
    shade = clamp(-sin(shade*2.*6.283) + .25, 0., 1.);

    
    // Cell pixel angle.
    float ang = atan(p.y, p.x); 
    // Quantizing and repeating the angle, whilst snapping to the center.
    float ia = (floor(ang/6.2831*aNum) + .5)/aNum;
    
    // Polar coordinates -- Radial and angular.
    p = rot2(ia*6.2831)*p;
    p.x -= r; // Moving the center of the cell out to the arc radius.
    

    // Thin rectangles (spaced out around the arc), to emulated dividing lines. 
    p = abs(p);
    float d = max(p.x - .05, p.y + .005);
    // Cheaper, but not as nice. It's there for comparison.
    //float d = clamp(cos(ang*aNum)*1. + .25, 0., 1.);
    
    // Combining the dividing lines with the arc to create the partitioned squares.
    d = max(arc + .045, -d);
    
    // Dots: Interesting, but not as well suited to the example.
    //float d = length(p) - .05;
    
    
    // Arc coloring, slightly blended into  the background.
    vec3 arcCol = mix(tx*1.5, vec3(1, .9, .8), .75);
    
    // Texture colored border lines.
    col = mix(col, vec3(0), (1. - smoothstep(-w*8., w*8., arc - .04))*.5);
    col = mix(col, vec3(0), 1. - smoothstep(-w, w, arc - .015));
    col = mix(col, arcCol*shade*vec3(1.2, .8, .6)*vec3(1.5, .9, .6), 1. - smoothstep(-w, w, arc + .015));
    
     
    // Applying the white partitioned squares.
    col = mix(col, vec3(0), (1. - smoothstep(-w*2., w*2., d - .01))*.5);
    col = mix(col, vec3(0), 1. - smoothstep(-w, w, d));
    col = mix(col, arcCol, 1. - smoothstep(-w, w, d + .02));
    
    // Return the decorated arc color.
    return col;
}




// Distance metric.
float dist(vec2 p, float sc){
  if(u_shape == 0) {
    return length(p); // Circle.
  }
  else if(u_shape == 1) {
    p = abs(p);
    float oct = max((p.y + p.x)/sqrt2, max(p.x, p.y)); // Octagon.
    p *= rot2(3.14159/8.);
    float dec = max(oct, max((p.y + p.x)/sqrt2, max(p.x, p.y)));
    return sc<32.?  oct : dec;
  }
  else {
    p = abs(p);
    float d = max((p.y + p.x)/sqrt2, max(p.x, p.y));
    p *= rot2(3.14159/8.);
    return max(d, max((p.y + p.x)/sqrt2, max(p.x, p.y))); // Hexadecagon.
  }
}

// The following function takes in the color, fractional coordinates, tangential arc 
// end-points, arc width, and a scaling factor -- which is necessary to plot the correct 
// amount of arc lines.
vec3 renderArc(vec3 col, vec2 p, vec2 a, vec2 b, float aw, float sc){
      
    // Falloff factor.
    float w = 3./iResolution.y;

    // Applying Fizzer's "solveCircle" function, which returns the
    // origin and radius of the circle that cuts through the end-points
    // "a" and "b".
    vec2 o; float r;
    solveCircle(a, b, o, r);   

    // Circular distance.
    float arc = dist(p - o, sc);
    // Just the outer rim of the circle. "aw" is the width.
    arc = abs(arc - r) - aw; 
    
    // Render the arc. You could make this function as simple or as
    // esoteric as you want, depending on the level of detail required.
    col = doArc(col, w, arc, p - o, sc, r);

    // Return the decorated arc color.
    return col;
}


void mainImage(out vec4 fragColor, in vec2 fragCoord){

    // Normalized pixel coordinates.
    vec2 uv = fragCoord/min(iResolution.y, 650.);
    
    // Scaling and translation.
    vec2 p = uv*4. + vec2(1, .25)*iTime;   
    p = rot2(3.14159/8.)*p;
    vec2 oP = p; // Keeping a copy for later.
    
    // Falloff factor, based on resolution. 
    float w = 1./iResolution.y;
    // Fizzer's falloff factor. It works, but I get a bit paranoid when it comes to
    // the behaviour of differnt GPUs. :)
    //float w = max(length(dFdx(p)), length(dFdy(p)))/2.;
    
    
    
    // Rendering variables.
    
    // Just a quick debug hack. Set the first slot to zero to omit the diamond
    // background, and\or the second slot to omit the octagonal background.
    const vec2 doBg = vec2(1, 1);
    
    // Load in a texture, perform some round sRGB to linear conversion, then
    // set a version of it to the background.
    vec3 tx = texture(iChannel0, oP/4. + .3).xyz; tx *= tx;
    vec3 bg = tx*vec3(2, 1.45, 1);
    
    // Initiate the color to the background.
    vec3 col = bg;
 
    
    const float aw = .1; // Arc width.
    const float scL = 80.; // Large arc scale.
    const float scS = 16.; // Small arc scale.
    
    
    // Performing a diamond octagon partitioning: It's slightly more involved than
    // a single tile partitioning, but not that difficult.
    //    
    vec2 ip = floor(p); // Diamond ID.
    p -= ip + .5; // Fractional coordinates. Equivalent to: fract(p) - .5.
    
    // 2D diamond field... The dimensions are calculated using basic trigonometry. 
    // Although, I was still too lazy to do it myself.
    float dia = abs(p.x) + abs(p.y) - (1. - sqrt2/2.);
    
    
    // If we're inside a diamond, then render the diamond tile. Anything outside of this
    // will obviously be inside an octagon tile.
    if(dia<.0){
        
        
        if(doBg.x>.5){
            
            //vec3 dCol = mix(bg*1.5, vec3(1, .9, .8), .65);
            vec3 dCol = bg*2.;
            float snD = clamp(-cos(dia*6.2831*16. + 3.14159/2.)*1. + .75, 0., 1.);
            dCol *= vec3(1, .8, .6)*snD;
            //dCol = bg*vec3(1, 2, 3)*snD;
            //dCol = bg*vec3(1.5, 2.125, 2.75)*snD;
             
            col = mix(col, vec3(0), 1. - smoothstep(-w, w, dia - .015));
            col = mix(col, dCol, 1. - smoothstep(-w, w, dia + .015));
        }
        
        
        // Obtain a random ID for the diamond cell, and if it's over a certain threshold,
        // rotate it by 90 degrees; It's a standard square Truchet move.
        if(hash12(ip + .59)>.5) p = p.yx;
        
        
        // Render the two arcs (refer to the shader imagery). By the way, we're using Fizzer's 
        // "solveCircle" method for completeness, but you could calculate it pretty easily by hand, 
        // if necessary.
        const float k = .5 - sqrt2/4.;
        
        // The following function takes in the color, fractional coordinates, tangential arc end-points, 
        // arc width, and a scaling factor -- which is necessary to plot the correct amount of arc lines.
        col = renderArc(col, p, vec2(k, k), vec2(k, -k), aw, scS);
        col = renderArc(col, p, vec2(-k, k), vec2(-k, -k), aw, scS);
        
    }
    else {
        
        // If we're inside an octagon cell (outside a diamond), then obtain the 
        // ID (similar to the diaomond ID, but offset by half a cell) and 
        // fractional coordinates.
        p = oP - .5;
        vec2 ip = floor(p);
        p -= ip + .5; // Equivalent to: fract(p) - .5;
        
        
        // 2D octagonal bound: There's a few ways to achieve the same, but this will
        // do. We're giving it a diameter of one, to fill up the cell. By the way, we're
        // only using this for background decoration. Otherwise, we wouldn't need it.
        float oct = max((abs(p.x) + abs(p.y))/sqrt2, max(abs(p.x), abs(p.y))) - .5;
 
        
        // Some random numbers. It's a bit hacky, but it'll do. In fact, I should 
        // probably lash out and use one of Dave Hoskins's hash formulae.
        vec3 rnd3 = vec3(hash22(ip + vec2(37.73, 132.57)), hash12(ip)); 
       
        
        
        // If applicable, render the octagonal background pattern. I wouldn't pay too much 
        // attention to any of this. A lot of it was made up as I went along. :)
        if(doBg.y>.5){
            
            
            // Weird hack: The drop shadows make the the octagon backgrounds covered with double
            // arcs look a little dark, so I've lit them up a little. 
            if(rnd3.x>.5 && rnd3.y>.5) col *= 1.25;
            
            // Random octagonal cell coloring, if you like that kind of thing.
            //if(hash(rnd3.z*37.2 + .53)>.5) col *= vec3(1, .5, 1.5); 
            //if(hash(rnd3.z*71.3 + .71)>.5) col = mix(col.zyx, dot(col, vec3(.299, .587, .114))*vec3(1), .5);
            // Subtle checkerboard coloring.
            //if(mod(ip.x + ip.y, 2.)>.5) col = mix(col, col.xzy, .35);
            //if(mod(ip.x + ip.y, 2.)<.5) col = mix(col.zyx, dot(col, vec3(.299, .587, .114))*vec3(1), .5);
             
            
            // A cheap way to render some repeat lines... There are better ways, but this works.
            float snD = clamp(cos(oct*6.2831*20. + 3.14159/2.)*2. + 1.5, 0., 1.);
            //col *= (clamp(cos(length(p)*6.2831*20. + 3.14159/2.)*2. + 1.5, 0., 1.)*.8 + .2);
            
            // The octagonal border.
            float octTor = abs(oct + .1666/2. - .015) - .1666/2. + .015;
            col = mix(col, vec3(0), (1. - smoothstep(-w*5., w*5., octTor - .03))*.5);
            col = mix(col, vec3(0), 1. - smoothstep(-w, w, octTor - .015));
            col = mix(col, bg/1.25*(snD*.75 + .25), 1. - smoothstep(-w, w, octTor + .015));

           
            // The circular or octagonal pattern inside the octagon.
            
            float shp = 0.;
            if(u_shape == 0) {
              // A circular decoration.
              shp = length(p) - .14;
            }
            else {
              // A star variation, if that's you're thing.
              //oct = min((abs(p.x) + abs(p.y))/sqrt2, max(abs(p.x), abs(p.y))) - .5;
              // An octagonal center decoration.
              shp = oct + .1666 + .2;//max(abs(p.x), abs(p.y)) - .15;// - (1. - sqrt2/2.);
            }
            
            snD = clamp(-sin(shp*6.2831*20. + 3.14159/2.)*1. + .5, 0., 1.); // Concentric rings.
            
            // Render the central bullseye pattern.
            col = mix(col, vec3(0), 1. - smoothstep(-w, w, shp - .065));
            col = mix(col, mix(bg*1.5, vec3(1, .9, .8), .65), (1. - smoothstep(-w*2., w*2., shp - .03)));
            col = mix(col, vec3(0), 1. - smoothstep(-w*2., w*2., shp - .015));
            col = mix(col, bg/1.*(snD*.95 + .05)*vec3(1.5, 2.125, 2.75), 1. - smoothstep(-w, w, shp + .015));
          
          
        }
        
        
        // Rendering the octagonal arc patterns over the background.
        
        // Use the unique octagonal ID to produce a random integer that can be used to
        // randomly rotate the octagonal coordinates about its rotationally symmetric axes.
        float iRnd = floor(rnd3.z*8.);
        p = rot2(3.14159/4.*iRnd)*p;
        
        // A point that cuts the midway point of the top side... prior to rotation.
        vec2 a = vec2(0, .5);
        
        // Rotational matrices -- to help rotate mid-points.
        mat2 r1 = rot2(3.14159/4.), r2 = rot2(3.14159/2.), r3 = rot2(3.14159/4.*3.);
        
        
        
        
        // I came up with this logic pretty quickly, but I think it's sound... Having said that, 
        // you'd be much better off referring to Fizzer's workings, as it's more elegant.
        //
        // On one side of the octagon, render either a long arc surrounding a small arc, or
        // two adjacent small arcs. On the other side of the octagon, use another random number
        // to do the same.
            
        
        // One half of the octagon.
        if(rnd3.x>.5){

            // The following function takes in the color, fractional coordinates, tangential arc 
            // end-points, arc width, and a scaling factor -- which is necessary to plot the correct 
            // amount of arc lines.
            col = renderArc(col, p, a, r3*a, aw, scL);
            col = renderArc(col, p, r1*a, r2*a, aw, scS);
        }
        else {
           
            col = renderArc(col, p, a, r1*a, aw, scS);
            col = renderArc(col, p, r2*a, r3*a, aw, scS);
        }
           
        a = -a; // Simple way to render the other half.
   
        // Other half of the octagon.
        if(rnd3.y>.5){
       
            col = renderArc(col, p, a, r3*a, aw, scL);
            col = renderArc(col, p, r1*a, r2*a, aw, scS);
        }
        else {
            
            col = renderArc(col, p, a, r1*a, aw, scS);
            col = renderArc(col, p, r2*a, r3*a, aw, scS);
        }

        
    }
    
     
    // Mixing in a bit of pink down the bottom of the canvas, to give a sunset feel? :)
    col = mix(col.xzy, col, pow(uv.y, .25));
    
    // Subtle vignette.
    uv = fragCoord/iResolution.xy;
    col *= pow(16.*uv.x*uv.y*(1. - uv.x)*(1. - uv.y) , .0625);
    // Colored variation.
    //col = mix(col.zyx, col, pow(16.*uv.x*uv.y*(1. - uv.x)*(1. - uv.y) , .125));

    
    
    // Rough gamma correction and output to screen
    fragColor = vec4(sqrt(max(col, 0.)), 1);
    
}
`;

let gui: GUI;
const api = {
  u_shape: 0,
};

export default class implements iSub {
  key(): string {
    return 'wdBSRm';
  }
  name(): string {
    return 'Diamond Octagon Truchet Pattern';
  }
  sort() {
    return 63;
  }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
  }
  main(): HTMLCanvasElement {
    gui = new GUI();
    gui.add(api, 'u_shape', [0, 1, 2]);
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
    const u_shape = webglUtils.getUniformLocation(gl, program, 'u_shape');
    return () => {
      u_shape.uniform1i(api.u_shape);
    };
  }
  channels() {
    return [webglUtils.TEXTURE8];
  }
}
