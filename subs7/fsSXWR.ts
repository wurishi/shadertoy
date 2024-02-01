import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define R (iResolution.xy)
#define T(u) texture(iChannel0,(u)/R)
#define T1(u) texture(iChannel1,(u)/R)
#define T2(u) texture(iChannel2,(u)/R)
#define T3(u) texture(iChannel3,(u)/R)
#define TF(u)  texelFetch(iChannel0,ivec2(u), 0)
#define TF1(u) texelFetch(iChannel1,ivec2(u), 0)
#define TF2(u) texelFetch(iChannel2,ivec2(u), 0)
#define TF3(u) texelFetch(iChannel3,ivec2(u), 0)

#define pi acos(-1.)

#define startOffs 6

//#define iTime mod(iTime,2.)

#define particleCount pow(2.,9.)

#define particleSz 0.015

//#define getSize(idx) particleSz*(sin(idx*26. + iTime)*0.5 + 0.5)

#define getSize(idx) particleSz*(pow((sin(idx*126. +iTime + sin(iTime))*0.5 + 0.5),8.)+1.)


#define resFact vec2(R.x/R.y,1.)

#define rot(a) mat2(cos(a),-sin(a),sin(a),cos(a))

#define getIdx(a) vec2(mod(a,R.x), floor((a+R.x)/R.x)-1.)

// 8bit
highp uint packU8(mediump uvec4 a) {
    return uint( (a.x << 24)
               | (a.y << 16)
               | (a.z << 8 )
               | (a.w << 0 ) ); }
mediump uvec4 unpackU8(highp uint a) {
    return uvec4( (a & 0xFF000000u) >> 24
                , (a & 0x00FF0000u) >> 16
                , (a & 0x0000FF00u) >> 8
                , (a & 0x000000FFu) >> 0   ); }
float packU8(  vec4  a) { return uintBitsToFloat(packU8(uvec4(round(clamp(a, 0., 1.)*255.)))); }
vec4  unpackU8(float a) { return vec4(unpackU8(floatBitsToUint(a))) / 255.; }
float packS8(  vec4  a) { return uintBitsToFloat(packU8(uvec4(round(clamp(a, -1., 1.)*127.5+127.5)))); }
vec4  unpackS8(float a) { return clamp((vec4(unpackU8(floatBitsToUint(a))) - 127.5) / 127.5, -1., 1.); }


// 16bit
highp uint packU16(highp uvec2 a) {
    return uint( (a.x << 16)
               | (a.y << 0)); }
mediump uvec2 unpackU16(highp uint a) {
    return uvec2( (a & 0xFFFF0000u) >> 16
                , (a & 0x0000FFFFu) >> 0   ); }
float packU16(  vec2  a) { return uintBitsToFloat(packU16(uvec2(round(clamp(a, 0., 1.)* (pow(2.,16.) - 1.))))); }
vec2  unpackU16(float a) { return vec2(unpackU16(floatBitsToUint(a))) / (pow(2.,16.) - 1.); }



vec4 r24(vec2 p)
{
	vec4 p4 = fract(vec4(p.xyxy) * vec4(.1031, .1030, .0973, .1099));
    p4 += dot(p4, p4.wzxy+33.33);
    return fract((p4.xxyz+p4.yzzw)*p4.zywx);

}


float hash13(vec3 p3){
    p3 = fract((p3)*0.1031);
    p3 += dot(p3, p3.yzx  + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}
///  2 out, 3 in...
vec2 hash23(vec3 p3)
{
	p3 = fract(p3 * vec3(.1031, .1030, .0973));
    p3 += dot(p3, p3.yzx+33.33);
    return fract((p3.xx+p3.yz)*p3.zy);
}
mat3 getOrthogonalBasis(vec3 direction){
    direction = normalize(direction);
    vec3 right = normalize(cross(vec3(0,1,0),direction));
    vec3 up = normalize(cross(direction, right));
    return mat3(right,up,direction);
}


`;

const buffA = `// ------------------------------- //
//           Movement              //
// ------------------------------- //

int neighborsCnt = 0;
vec4 neighborPtrs[] = vec4[8](vec4(0),vec4(0),vec4(0),vec4(0),vec4(0),vec4(0),vec4(0),vec4(0));

//#define steps  floor(particleSz*iResolution.x*8.)

float steps = 20.;
float stepSz = 2.;
void findNeighbors( vec4 me, vec2 mePos, vec2 dir){

    for(float i = 1.; i < steps; i++){
        vec4 otherPntr = TF1( mePos.xy * R + dir * i*stepSz );
        vec4 otherP    = T( otherPntr.xy );
        
        //if ( otherP.x != me.x){
        //if ( unpackU16(otherP.x) != me.xy ){
        if ( unpackU16(otherP.x).x != mePos.x && unpackU16(otherP.x).y != mePos.y ){
            for(int i = 0; i < neighborsCnt; i++){
                if (neighborPtrs[i] == otherPntr)
                    return;
            }
            neighborPtrs[neighborsCnt++] = otherPntr;
            return;
        }
    }

}

void mainImage( out vec4 C, in vec2 U )
{

    if (iFrame < 3){
        
        float pc = floor(sqrt(particleCount));
        vec2 id = floor(U/R*pc) + 0.0001;
        vec2 cellSz = R/(pc + 1.);
        
        vec2 pos = id*cellSz/R + cellSz/R;

        vec2 vel = r24(id).xy*2. - 1.;

        C.x = packU16(pos);
        C.y = packS8(vel.xyxy);    
        C.z = packU8(r24(id));
        
    } else {
        C = T(U);
        
        vec4 pPtr = T1(C.xy*R);
        
        if (iFrame > startOffs){
            
            //C = T( pPtr.xy );
            
            vec2 pos = unpackU16(C.x);
            vec2 vel = unpackS8(C.y).xy;
            vec4 data = unpackU8(C.z);
    

            findNeighbors( C, pos, vec2(1,0));
            findNeighbors( C, pos, vec2(-1,0));
            findNeighbors( C, pos, vec2(0,1));
            findNeighbors( C, pos, vec2(0,-1));
            
            findNeighbors( C, pos, vec2(1,1));
            findNeighbors( C, pos, vec2(1,-1));
            findNeighbors( C, pos, vec2(-1,1));
            findNeighbors( C, pos, vec2(-1,-1));
            
            vec2 meToMouse = iMouse.xy/iResolution.xy-pos;
            meToMouse *= resFact;
            
            if(iMouse.z > 0.)
                vel -= 1.*normalize(meToMouse)*smoothstep(0.34,0.,length(meToMouse));
            // elastic collisions
            for(int i = 0; i < neighborsCnt; i++){    
                vec4 otherPtr = neighborPtrs[i];
                vec4 other = T(otherPtr.xy);
                vec2 otherVel = unpackS8(other.y).xy;
                vec4 otherData = unpackU8(other.z);
                
                other.xy = unpackU16(other.x);
                vec2 meToOther = (other.xy - pos.xy)*resFact.xy;
                
                
                float distBetween = length(meToOther);
                
                
                float sizes =  getSize(data.x) + getSize(otherData.x); 
                
                if( distBetween < sizes ){
                    

                    vec2 normal = normalize(meToOther);
                    vec2 tangent = vec2(-normal.y,normal.x);


                    float meNorm = dot(vel, normal);
                    float meTan = dot(vel, tangent);
                    float otherNorm = dot(otherVel, normal);
                    float otherTan = dot(otherVel, tangent);

                    float massMe = 1.;
                    float massOther = 1.;
                    
                    
                    meNorm = ( meNorm * (massMe - massOther) + 2.*massOther*otherNorm ) / (massMe + massOther);
                    
                    vel = tangent * meTan + normal*meNorm;
                    
                    pos -= normalize(meToOther)*(abs(distBetween - sizes));
                    
                }




            }
        
        
            if (abs(pos.x - 0.5) > 0.5 - particleSz*0.5){
                vel.x *= -1.;
                if ( sign(vel.x) != sign(-pos.x + 0.5) )
                    vel.x *= -1.;
            }
            if (abs(pos.y - 0.5) > 0.5 - particleSz*0.5){
                vel.y *= -1.;
                if ( sign(vel.y) != sign(-pos.y + 0.5) )
                    vel.y *= -1.;            
            }

            
            
            pos += vel/resFact*0.002;
            
            
            C.x = packU16(pos);
            C.y = packS8(vel.xyxy);
            //C.x = packSnorm(vec4(pos,vel));
        }
    }
}`;

const buffB = `// ------------------------------- //
//           Tracking              //
// ------------------------------- //

float steps = 15.;
float stepSz = 2.;
void findMe( inout vec4 pPntr, inout vec2 pos, vec2 U, vec2 dir){
    for(float i = 1.; i < steps; i++){
        vec4 otherPntr = T1(U + dir*i);
        vec4 otherP = T(otherPntr.xy);
        vec2 otherPos = unpackU16(otherP.x);
        
        if (length( (U/R - otherPos.xy)/resFact.yx ) < length( (U/R - pos.xy)/resFact.yx )){
            pos = otherPos;
            pPntr = otherPntr;
        }
        
    }

}
        

void mainImage( out vec4 C, in vec2 U )
{

    if (iFrame < 3) {
        //C = r24(U);
        C.xy = U;
        C.zw -= C.zw;
    } else {        
        C = T1(U);
        
        if (iFrame < startOffs){
            steps = 100.;
        }
        
        
        vec4 pPntr = C;
        vec4 p = T(pPntr.xy);
        vec2 pos = unpackU16(p.x);
        
        findMe(pPntr,pos,U,vec2(0,1));
        findMe(pPntr,pos,U,vec2(0,-1));
        findMe(pPntr,pos,U,vec2(1,0));
        findMe(pPntr,pos,U,vec2(-1,0));
        findMe(pPntr,pos,U,vec2(1,1));
        findMe(pPntr,pos,U,vec2(1,-1));
        findMe(pPntr,pos,U,vec2(-1,1));
        findMe(pPntr,pos,U,vec2(-1,-1));
        
        C = pPntr;
        
        if (iFrame == startOffs-1){
            C.zw = 1. + floor(r24(C.xy).xy*2.99);
        }
    }

}`;

const buffC = `// ------------------------------- //
//           Painting              //
// ------------------------------- //


int neighborsCnt = 0;
vec4 neighborPtrs[] = vec4[8](vec4(0),vec4(0),vec4(0),vec4(0),vec4(0),vec4(0),vec4(0),vec4(0));

float steps = 7.;
void findNeighbors( vec2 p, vec2 dir){
    float stepSz = 1. + mod(float(iFrame),2.);
    for(float i = 1.; i < steps; i++){
        vec4 otherPntr = TF1( p.xy * R + dir * i*stepSz );
        vec4 otherP    = T( otherPntr.xy );
        vec2 otherPos = unpackU16(otherP.x);
        
        // TODO: don't unpack here
        if ( otherPos.x != p.x ){
            for(int i = 0; i < neighborsCnt; i++){
                if (neighborPtrs[i] == otherPntr)
                    return;
            }
            neighborPtrs[neighborsCnt++] = otherPntr;
            return;
        }
    }

}

float sdSq(vec2 p, float s){p = abs(p) - s; return max(p.x,p.y);}


const int charsCnt = 1;
float text(vec2 p, float[charsCnt] chars, float spacing, float s, bool isAbs, float absWidth) {
	
    p *= s;  
    p.x +=  1./16./2.;
    p.y +=  1./16./2.;
    
    p.x *= 1. - spacing;
    
    vec2 id = floor(p*16.);
    p = mod(p,1./16.);
    p.x = p.x/(1. - spacing);
    float char = chars[int(id.x)];
    //char += 112. ;
    
    float t;
    if(abs(id.y) < 1. && id.x >= 0. && id.x < float(charsCnt)  && char < 200.){
        vec4 letter = texture(iChannel3,p + vec2(mod(char,16.),-floor(char/16.) )/16.);
        t = letter.w -0.5;
        if(abs(p.x-1./16./2.)>1./16./2.)
            t = 10e4;
    
        t /= s*10.1;
    } else {
        t = 10e5;
    
	 }
    if (isAbs)
        t = abs(t) - absWidth;
    return t;
}

float texta(vec2 p, float[charsCnt] chars, float spacing, float s, bool isAbs, float absWidth) {
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
     


#define pal(a,b,c,d,e) ((a) + (b)*sin((c)*(d) + (e)))
void mainImage( out vec4 C, in vec2 U )
{
    vec2 uv = U/R;
    float pixelSize = dFdx(uv.x)*3.;
    
    vec4 mePntr = T1(U);
    vec4 me = T(mePntr.xy);
    
    vec2 mePos = unpackU16(me.x);
    vec4 meData = unpackU8(me.z);
    
    
    C = texture(iChannel2,U/R);
    findNeighbors( mePos, vec2(1,0));
    findNeighbors( mePos, vec2(-1,0));
    findNeighbors( mePos, vec2(0,1));
    findNeighbors( mePos, vec2(0,-1));
    
    findNeighbors( mePos, vec2(1,1));
    findNeighbors( mePos, vec2(1,-1));
    findNeighbors( mePos, vec2(-1,1));
    findNeighbors( mePos, vec2(-1,-1));
    
    for(int i = -1; i < neighborsCnt; i++){
        vec4 otherPtr;
        vec4 otherP;
        if (i == -1){
            otherPtr = mePntr;
            otherP = me;
        } else {
            otherPtr= neighborPtrs[i];
            otherP = T(otherPtr.xy);
        }
        
        
        vec2 pos = unpackU16(otherP.x);
        vec4 data = unpackU8(otherP.z);
    
        float size = data.x;
    
    
        //vec3 col = pal(0.6,vec3(0.5,0.5,0.5),vec3(5,2,3),5. + sin(data.z), 0. + data.w*6. + iTime); 
        vec3 col = pal(0.5*vec3(1.,1.,1.),vec3(0.1,0.5,0.5),vec3(5,2,3),5. + sin(data.z), 0. + data.w*6. + iTime*4.); 
        vec3 colb = pal(0.5*vec3(1.,1.,1.),vec3(0.1,0.5,0.5),vec3(5,2,3),5. + sin(data.z), 0. + data.w*6. + iTime*4. + 1.); 
        
        //col -= col - 1.;
        float dFill = length((pos.xy - uv)*resFact.xy) - getSize(size) ;
        float s = getSize(size);
        float charIdx = data.x < 0.5 ? 69. : 64.;
        float t = text((uv-pos.xy + 0.*s)*resFact.xy, float[1](charIdx), 0.,   0.325/s/16., false, 0.);
        
        t /= 1.;
        dFill = t;
        vec3 crot = col - 1.;
        crot.xz *= rot(-1.4);
        crot += vec3(1,1.6,1.5);
        
        
        float dOutline = abs(dFill) - 0.0001;
        dFill += 0.00;
        
        vec3 crotb = crot;
        C.xyz = mix(C.xyz,vec3(0),smoothstep(pixelSize,0.,dFill));
        C.xyz = mix(C.xyz,crotb*0.6,smoothstep(pixelSize,0.,dOutline));
        
        //C.xyz = mix(C.xyz,crotb*0.6,smoothstep(pixelSize,0.,dFill));
        //C.xyz = mix(C.xyz,vec3(0.1),smoothstep(pixelSize,0.,dOutline));
        
        if (data.y >= meData.y){
        
        
        }
        //C = mix(C,pal(0.5,0.5,vec4(3,2,1,1.),1.,otherPtr.z*1.*14. + 0.*otherPtr.w ),smoothstep(dFdx(uv.x),0.,length((otherP.xy - uv)*resFact.xy) - particleSz));
    }

    
    
    if(iFrame < 4)
        C = vec4(0);
}`;

const fragment = `
// thx to wyatt for teaching me storing voronoi particle tracking stuff in different buffers and packing!
// int packing from somewhere on shadertoy

// ~500 ellastic 5s and 0s

void mainImage( out vec4 C, in vec2 U )
{
    vec4 pPntr = T1(U);
    vec4 p = T(pPntr.xy);
    vec2 pos = unpackU16(p.x);
    
    C = texture(iChannel0,U/R);
    
        
    vec2 uv = (U - 0.5*R)/R.y;
    
    C = 1. - C;
    
    //C = 1. - C*2.5;
    
    
    C = max(C,0.);
    C = pow(C,vec4(0.4545)*vec4(2.5,1.,1,1));  
    
    

}
`;

export default class implements iSub {
    key(): string {
        return 'fsSXWR';
    }
    name(): string {
        return 'Day 500';
    }
    // sort() {
    //     return 0;
    // }
    common() {
        return common;
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
        return [
            { type: 1, f: buffA, fi: 0 },
            { type: 1, f: buffB, fi: 1 },
            { type: 1, f: buffC, fi: 2 },
            webglUtils.FONT_TEXTURE,
        ];
    }
}
