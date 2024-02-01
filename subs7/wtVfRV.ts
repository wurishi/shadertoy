import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `float sdBox(vec2 p, vec2 s){
    p = abs(p) - s;
    return max(p.y,p.x);
}

float ss( float c, float power, float bias){
    c = clamp(c,-0.,1.);
    //c = smoothstep(0.,1.,c);
    
    c = pow(c,1. + bias);
    
    float a = pow( abs(c), power);
    float b = 1.-pow( abs(c - 1.), power);
    
    return mix(a,b,c);
}



#define pi acos(-1.)
float r11(float i){ return fract(sin(i*15.126)*115.6);}

float valueNoise(float i, float p){ return mix(r11(floor(i)),r11(floor(i) + 1.), smoothstep(0.,1.,fract(i)));}

float sdRoundedBox( in vec2 p, in vec2 b, in vec4 r )
{
    r.xy = (p.x>0.0)?r.xy : r.zw;
    r.x  = (p.y>0.0)?r.x  : r.y;
    vec2 q = abs(p)-b+r.x;
    return min(max(q.x,q.y),0.0) + length(max(q,0.0)) - r.x;
}
float sdPolygon( in vec2[4] v, in vec2 p )
{
    int N = 4;
    float d = dot(p-v[0],p-v[0]);
    float s = 1.0;
    for( int i=0, j=N-1; i<N; j=i, i++ )
    {
        vec2 e = v[j] - v[i];
        vec2 w =    p - v[i];
        vec2 b = w - e*clamp( dot(w,e)/dot(e,e), 0.0, 1.0 );
        d = min( d, dot(b,b) );
        bvec3 c = bvec3(p.y>=v[i].y,p.y<v[j].y,e.x*w.y>e.y*w.x);
        if( all(c) || all(not(c)) ) s*=-1.0;  
    }
    return s*sqrt(d);
}

#define pmod(p,a) mod(p - 0.5*a,a) - 0.5*a

#define rot(a) mat2(cos(a), -sin(a), sin(a), cos(a))

#define pal(a,b,c,d,e) (a + (b)*sin((c)*(d) + e))

mat3 getOrthogonalBasis(vec3 direction){
    direction = normalize(direction);
    vec3 right = normalize(cross(vec3(0,1,0),direction));
    vec3 up = normalize(cross(direction, right));
    return mat3(right,up,direction);
}
float cyclicNoise(vec3 p, bool turbulent, float time){
    float noise = 0.;
    
    p.yz *= rot(2.5);
    p.xz *= rot(-2.5);
    float amp = 2.5;
    float gain = 0.7 ;
    const float lacunarity = 1.2;
    const int octaves = 4;
    
     float warp = .1 + sin(time*0.5)*0.05;
    float warpTrk = 1.5 ;
    const float warpTrkGain = 1.1;
    
    vec3 seed = vec3(-1,-2.,0.5);
    mat3 rotMatrix = getOrthogonalBasis(seed);
    
    for(int i = 0; i < octaves; i++){
        
        p -= sin(p.zxy*warpTrk + vec3(0,-time*0.2,0) - 0.01*warpTrk)*warp; 
        noise += sin(dot(cos(p), sin(p.zxy + vec3(0,time*0.1,0))))*amp;
    
        p *= rotMatrix;
        p *= lacunarity;
        
        warpTrk *= warpTrkGain;
        amp *= gain;
    }
    
    if(turbulent){
        return 1. - abs(noise)*0.5;
    
    }{
        return (noise*0.25 + 0.5);

    }
}

`;

const buffA = `
vec4 r14(float a){
    vec2 c = vec2(mod(a,256.),floor(a/256.))/256. + 0./iChannelResolution[2].xy;
    return texture(iChannel2, c);
}


vec4 vn(float a, float t){
    return mix(r14(floor(a)),r14(floor(a + 1.)),smoothstep(0.,1.,fract(t)));
} 


void drawBlobs(vec2 uv, inout vec3 col, float sz, float szoffs, float fallspeed, bool outline){
        vec3 p = vec3(uv,1);
        
        p.y += iTime*0.34*fallspeed;
        
        p.yz *= rot(0.6);
        p.xz *= rot(2.);
        
        vec3 op = p;
        
        float md = sz;
        
        vec3 id = floor(p/md - 0.5);
        p = pmod(p,md);
        
        
        float d = length(p) - 0.0 - valueNoise(id.x + id.y + id.z + iTime*(0.5 + sin(id.x)) + sin(id.x + iTime + cos(id.z*10.)*5.),1.)*sz*0.2;

        vec3 c = pal(0.5,0.5*vec3(1,-1,1),1.,vec3(1,3,4),1. + id.x*20.  - p.x*20. + 10.*length(p)*smoothstep(0.,0.1,length(p)));
        
        d -= cyclicNoise(op*15., false, iTime*2.)*0.05*sz*(1. + szoffs);
        
        if(sin(id.x*20. + id.y*50. + sin(id.z*10. + id.x) + cos(id.z*10.)*2.) < -0.5)
            d = 10e4;
        if(!outline){
            if(d < 0.01){
                col = mix(col,c, smoothstep(fwidth(d)*1.,0.,d));
                //col = mix(col,vec3(0), smoothstep(fwidth(d)*1.,0.,abs(d) - 0.001));
    
            }
        } else{
        
            
            //d = max(abs(p.x) - 0.1, abs(p.y) - 0.1);
            col = mix(col,mix(c,vec3(0),1.), smoothstep(fwidth(d)*1.,0.,abs(d)));
        
        }
        
}

float text(vec2 p, float[8] chars, float spacing, float s, bool isAbs, float absWidth) {
	p *= s;
    
    p.x *= 1. - spacing;
    vec2 id = floor(p*8.*2.);
    p = mod(p,1./16.);
    p.x = p.x/(1. - spacing) + 0.1375*0.;
    float char = chars[int(id.x)];
    //char += 112. ;
    float t;
    if(abs(id.y) < 1. && id.x >= 0. && id.x < 8.  && char < 200.){
        vec4 letter = texture(iChannel3,p + vec2(mod(char,16.),-floor(char/16.) )/16.);
        t = letter.w - 0.5;
        t /= s*10.1;
    } else {
        t = 10e5;
    
	 }
    if (isAbs)
        t = abs(t) - absWidth;
    return t;
}
     


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    vec3 col = vec3(1.);

    

    
    {
        vec2 p = uv;
        
        p.y += iTime*0.19;
        //p *= rot(0.25*pi);
        
        float na = cyclicNoise(vec3(p*5.,iTime), false, iTime*0.);
        p += na*0.04;
        vec2 op = p;
        float md = .15;
        
        p = pmod(p,md);
        
        
        float d = min(abs(p.x),abs(p.y));

        
        vec3 c = pal(0.5,0.5*vec3(1,1,1),1.,vec3(1,3,4),1.  + 10.*length(op)*smoothstep(0.,0.1,length(op)));
        
        
        float n = cyclicNoise(vec3(op,1. + iTime*0.1)*10., false, iTime*0.);
        
        n = na;
        c = mix(c,vec3(0),1.);
        
        c = mix(col,c,smoothstep(0.1,1.,abs(n))*0.2 );
        
        col = mix(col,c, smoothstep(fwidth(op.x)*1.5,0.,d + 0.001));

        //col = mix(col,vec3(1), smoothstep(dFdx(p.x),0.,abs(d)));


    }
    
    drawBlobs(uv, col, 0.125,0. ,0.75, false);
    
    drawBlobs(uv, col, 0.4, 1.9, 1., false);

    {
        vec2 p = uv;
        
        p.y += iTime*0.2;
        
        float md = 2.;
        
        float id = floor(p.y/md - 0.5);
        
        p.x += sin(id*pi + pi*0.5)*0.8;
        p.y = pmod(p.y,md);
        
        for(float i = 0.; i < 15.; i++ ){
            
            vec2 s = vec2(1.-i/25.)*(0.5 + sin(id)*0.2);
            
            float d = sdBox(p*rot(i*(0.1 + sin(id*2.1)*0.3 ) + sin(id + iTime*i/15. )),s);
            
            
            col = mix(col,vec3(1.), smoothstep(dFdx(p.x),0.,d));
            
            if(abs(p.y) <md*0.49)
                col = mix(col,vec3(0), smoothstep(fwidth(d),0.,abs(d) - 0.001*0.));
            
        }

    }  
     

    {
        
        vec2 p = uv;
        p.y += iTime*0.2;
        
        float id = floor(p.y/2.);
        p.y = pmod(p.y,2.);
        
        //p.x += 0.5;
        
        //p.y -= 0.4;
        //p *= rot(sin(id + 4.));
        for(float i = 0.; i < 35.; i++){
            p.y += 0.01;
            vec2 lp = p;
            
            vec2 offsSz = vec2(8./16.,0.5*8./16.)*1.;
            
            
            lp.x += sin(i/45. + id + iTime)*0.4;
            lp.x += 0.5;
            lp -= offsSz*2.5*vec2(0,1);
            
            
            lp -= offsSz*1.;
            lp *= rot(0.5*sin(id*20. + 4. + iTime + i/25.));
            
            lp += offsSz*1.;
            
            float t = text( lp, float[8](135.,130.,121.,119.,120.,132.,117.,130.), 0., 0.5, true, 0.);
            
            if(i == 0.)
                t = text( lp, float[8](135.,130.,121.,119.,120.,132.,117.,130.), 0., 0.5, false, 0.);
                
            col = mix(col,vec3(0),smoothstep(dFdx(uv.x),0.,t));
            
        }

    }
    
    
    col = 1. - col;
    
    
    
    col = pow(col,vec3(0.454545));
    fragColor = vec4(col,1.0);
}`;

const buffB = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
        
        fragColor *= 0.;
        float iters = 23.;
        for(float i = 0.; i < iters*iters; i++){
            fragColor += texture(iChannel0,(fragCoord + vec2(mod(i,iters),floor(i/iters))- 0.5*iters )/iResolution.xy );
        }
        fragColor /= iters*iters;
}
`;

const buffC = `void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
        
        fragColor *= 0.;
        float iters = 23.;
        for(float i = 0.; i < iters*iters; i++){
            fragColor += texture(iChannel0,(fragCoord + vec2(mod(i,iters),floor(i/iters)) - 0.5*iters )/iResolution.xy );
        }
        fragColor /= iters*iters;

}`;

const buffD = `
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    vec3 col = vec3(1.);

    col = texture(iChannel0,fragCoord/iResolution.xy,0.).xyz;
    
    
    vec4 blurred = texture(iChannel1,fragCoord/iResolution.xy);
    vec3 bloom = smoothstep(0.6,2.,length(blurred.xyz))*blurred.xyz;
    col += bloom*0.2;
        
    //drawBloomed(uv, col, fragCoord);
    //drawBloomed(uv + vec2(0,30.), col, fragCoord);

     
    
    
    fragColor = col.xyzz;
    //fragColor = vec4(col,1.0);
}`;

const fragment = `
// influenced by baugasm https://www.instagram.com/baugasm/ and some acid graphix


vec4 r14(float a){
    vec2 c = vec2(mod(a,256.),floor(a/256.))/256. + 0./iChannelResolution[2].xy;
    return texture(iChannel2, c);
}


vec4 vn(float a, float t){
    return mix(r14(floor(a)),r14(floor(a + 1.)),smoothstep(0.,1.,fract(t)));
} 


void drawBloomed(vec2 uv, inout vec3 col, vec2 fragCoord){
        vec2 p = uv;
        
        p.y += iTime*0.125;
        
        float md = 1.;
        
        float id = floor(p.y/md - 0.5);
        
        
        float offs = sin(id*110.2 + pi*0.5);
        offs = sign(offs)*smoothstep(0.,0.1,abs(offs));
        p.x += offs*0.5;
        p.y = pmod(p.y,md);
        p.y += 0.3;
        
        
        float h1 =  + 0.4*float(sin(id*1.5 + 2.) > 0.);
        float h2 = 0.4*float(sin(id) < 0.);
        
        if(abs(h2-h1)<0.51){
            float o = sin(id*3. + 1.); 
            h2 += sign(o)*max(abs(o),0.71)*0.6;
             
        }
        
        float d = sdPolygon( vec2[4](
            vec2(0.,0),
            vec2(0.2,0.),
            vec2(0.2,0.2 + h1),
            vec2(0.,0.2 + h2)
        ),p) - 0.02;
        
        float blueNoise = texture(iChannel3,p*0.3).x;
        
        vec4 blurred = texture(iChannel2,fragCoord/iResolution.xy);
         
         
        blurred = clamp(blurred,0.1,1.);
        //blurred = mix(blurred, col.xyzz, smoothstep(0.5,0.6,blueNoise*1.05));
        blurred +=  smoothstep(0.3,0.69,blueNoise)*0.03;
        
        col = mix(col, blurred.xyz, smoothstep(dFdx(p.x),0.,d));
        col = mix(col, blurred.xyz*2.*(1. + sin(p.x*20. + p.y*10. + sin(p.y*5.) + iTime)), smoothstep(dFdx(p.x)*1.5,0.,abs(d)));
            
            

    }

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    {
        vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
        vec3 col = vec3(1.);

        col = texture(iChannel0,fragCoord/iResolution.xy,0.).xyz;


        vec4 blurred = texture(iChannel2,fragCoord/iResolution.xy);
        vec3 bloom = smoothstep(0.6,2.,length(blurred.xyz))*blurred.xyz;
        col += bloom*0.2;

        drawBloomed(uv, col, fragCoord);
        //drawBloomed(uv + vec2(0,30.), col, fragCoord);

     
    
    
        fragColor = col.xyzz;
    }
    float n1d = texelFetch(iChannel1,ivec2(mod(fragCoord + vec2(float(iFrame),0.),256.)),0).x;
    vec3 n  = texelFetch(iChannel1,ivec2(mod(fragCoord  + n1d*200. ,256.)),0).xyz;
    
    vec2 uv = (fragCoord - 0.5*iResolution.xy)/iResolution.y;
    
    //fragColor.xyz =texture(iChannel0,fragCoord/iResolution.xy).xyz;
    
    
    fragColor.xyz = pow(fragColor.xyz, vec3(1.1,1.,0.95));
    
    //fragColor.xyz = 1. - fragColor.xyz;
    
    //fragColor.xyz *= 1. - dot(uv,uv)*0.8;
    //fragColor.xyz = pow(fragColor.xyz, vec3(0.4545 + n*0.05));
    
    //col = pow(col,vec3(0.454545));
    
    
    //fragColor = texture(iChannel2,fragCoord/iResolution.xy);
    
    fragColor.xyz += smoothstep(1.,0.,length(fragColor))*n*0.08;
    
    fragColor.xyz -= smoothstep(0.,1.,length(fragColor))*n*0.15;
    
}

`;

export default class implements iSub {
    key(): string {
        return 'wtVfRV';
    }
    name(): string {
        return 'Day 439';
    }
    // sort() {
    //     return 0;
    // }
    common() {
        return common;
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
    webgl() {
        return WEBGL_2;
    }
    channels() {
        return [
            { type: 1, f: buffA, fi: 0 },
            { type: 1, f: buffB, fi: 1 },
            { type: 1, f: buffC, fi: 2 },
            { type: 1, f: buffD, fi: 3 },
        ];
    }
}
