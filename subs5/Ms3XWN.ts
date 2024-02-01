import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
// Created by inigo quilez - iq/2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0

const ivec2 txPacmanPos       = ivec2(31, 1);
const ivec2 txPacmanMovDirNex = ivec2(31, 3);
const ivec2 txPoints          = ivec2(31, 5);
const ivec2 txState           = ivec2(31, 7);
const ivec2 txGhost0PosDir    = ivec2(31, 9);
const ivec2 txGhost1PosDir    = ivec2(31,11);
const ivec2 txGhost2PosDir    = ivec2(31,13);
const ivec2 txGhost3PosDir    = ivec2(31,15);
const ivec2 txMode            = ivec2(31,17);
const ivec2 txLives           = ivec2(31,19);
const ivec4 txCells           = ivec4(0,0,27,31);`;

const fragment = `
// Created by inigo quilez - iq/2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0


// postprocess (thanks to Timothy Lottes for the CRT filter - XsjSzR)



float sdCircle( in vec2 p, in float r )
{
    return length( p ) - r;
}

vec4 loadValue( in ivec2 re )
{
    return texelFetch( iChannel0, re, 0 );
}

vec2 dir2dis( float dir )
{
    vec2 off = vec2(0.0);
         if( dir<0.5 ) { off = vec2( 0.0, 0.0); }
    else if( dir<1.5 ) { off = vec2( 1.0, 0.0); }
    else if( dir<2.5 ) { off = vec2(-1.0, 0.0); }
    else if( dir<3.5 ) { off = vec2( 0.0, 1.0); }
    else               { off = vec2( 0.0,-1.0); }
    return off;
}

vec2 cell2ndc( vec2 c )
{
	c = (c+0.5) / 31.0;
    c.x -= 0.5*(1.0-iResolution.x/iResolution.y); // center
    return c;
}


vec3 drawMap( vec3 col, in vec2 fragCoord )
{
    vec2 p = fragCoord/iResolution.y;
    p.x += 0.5*(1.0-iResolution.x/iResolution.y); // center
    float wp = 1.0/iResolution.y;

    p *= 31.0;
    vec2 q = floor(p);
    vec2 r = fract(p);
    float wr = 31.0*wp;

    if( q.x>=0.0 && q.x<=27.0 )
    {
        float c = texture( iChannel0, (q+0.5)/iResolution.xy, -100.0 ).x;

        // points
        if( abs(c-2.0)<0.5 )
        {
            float d = sdCircle(r-0.5, 0.15);
            col += 0.3*vec3(1.0,0.7,0.4)*exp(-22.0*d*d); // glow
        }
    }
    
	// balls
    
    vec2 bp[4];
    
    bp[0] = vec2( 1.0, 7.0) + 0.5;
    bp[1] = vec2(25.0, 7.0) + 0.5;
    bp[2] = vec2( 1.0,27.0) + 0.5;
    bp[3] = vec2(25.0,27.0) + 0.5;
    
    for( int i=0; i<4; i++ )
    {
        float c = texture( iChannel0, (bp[i]+0.5)/iResolution.xy, -100.0 ).x;
        if( abs(c-3.0)<0.5 )
        {
        float d = length(p - bp[i]);
        col += 0.35*vec3(1.0,0.7,0.4)*exp(-1.0*d*d)*smoothstep( -1.0, -0.5, sin(2.0*6.2831*iTime) );
        }
    }
    
    return col;
}


vec3 drawPacman( vec3 col, in vec2 fragCoord, in vec4 pacmanPos, in vec3 pacmanMovDirNex )
{
    vec2 off = dir2dis(pacmanMovDirNex.x);
    
    vec2 mPacmanPos = pacmanPos.xy;
    //vec2 mPacmanPos = pacmanPos.xy + off*pacmanPos.z*pacmanPos.w;

    vec2 p = fragCoord/iResolution.y;
    float eps = 1.0 / iResolution.y;

    vec2 q = p - cell2ndc( mPacmanPos );

    float c = max(0.0,sdCircle(q, 0.023));

    // glow
    col += 0.25*vec3(1.0,0.8,0.0)*exp(-400.0*c*c);

    return col;
}

vec3 drawGhost( vec3 col, in vec2 fragCoord, in vec3 pos, in float dir, in float id, in vec3 mode )
{
    vec2 off = dir2dis(dir);

    vec2 gpos = pos.xy;

    vec2 p = fragCoord/iResolution.y;
    float eps = 1.0 / iResolution.y;

    vec2 q = p - cell2ndc( gpos );

    float c = max(0.0,sdCircle(q, 0.023));
   
    vec3 gco = 0.5 + 0.5*cos( 5.0 + 0.7*id + vec3(0.0,2.0,4.0) );
    float g = mode.x;
    if( mode.z>0.75 )
    {
        g *= smoothstep(-0.2,0.0,sin(3.0*6.28318*(iTime-mode.y)));
    }
    gco = mix( gco, vec3(0.1,0.5,1.0), g );

    // glow
    col += 0.2*gco*exp(-300.0*c*c);

    return col;
}

vec3 drawScore( in vec3 col, in vec2 fragCoord, vec2 score, float lives )
{
    // score
    vec2 p = fragCoord/iResolution.y;
    // lives
    float eps = 1.0 / iResolution.y;
    for( int i=0; i<3; i++ )
    {
        float h = float(i);
        vec2 q = p - vec2(0.1 + 0.075*h, 0.7 );
        if( h + 0.5 < lives )
        {
            float c = max(0.0,sdCircle(q, 0.023));

            col += 0.17*vec3(1.0,0.8,0.0)*exp(-1500.0*c*c);
        }
    }

    return col;
}

//============================================================

//
// PUBLIC DOMAIN CRT STYLED SCAN-LINE SHADER
//
//   by Timothy Lottes
//
// This is more along the style of a really good CGA arcade monitor.
// With RGB inputs instead of NTSC.
// The shadow mask example has the mask rotated 90 degrees for less chromatic aberration.
//
// Left it unoptimized to show the theory behind the algorithm.
//
// It is an example what I personally would want as a display option for pixel art games.
// Please take and use, change, or whatever.
//

// Emulated input resolution.

//vec2 res = 640.0*vec2(1.0,iResolution.y/iResolution.x);
#define res (iResolution.xy/floor(1.0+iResolution.xy/512.0))

// Hardness of scanline.
//  -8.0 = soft
// -16.0 = medium
const float hardScan=-8.0;

// Hardness of pixels in scanline.
// -2.0 = soft
// -4.0 = hard
const float hardPix=-3.0;

// Display warp.
// 0.0 = none
// 1.0/8.0 = extreme
const vec2 warp=vec2(1.0/32.0,1.0/24.0); 

// Amount of shadow mask.
const float maskDark=0.6;
const float maskLight=2.0;

//------------------------------------------------------------------------

// sRGB to Linear.
// Assuing using sRGB typed textures this should not be needed.
float ToLinear1(float c){return(c<=0.04045)?c/12.92:pow((c+0.055)/1.055,2.4);}
vec3 ToLinear(vec3 c){return vec3(ToLinear1(c.r),ToLinear1(c.g),ToLinear1(c.b));}

// Linear to sRGB.
// Assuing using sRGB typed textures this should not be needed.
float ToSrgb1(float c){return(c<0.0031308?c*12.92:1.055*pow(c,0.41666)-0.055);}
vec3 ToSrgb(vec3 c){return vec3(ToSrgb1(c.r),ToSrgb1(c.g),ToSrgb1(c.b));}

// Nearest emulated sample given floating point position and texel offset.
// Also zero's off screen.
vec3 Fetch(vec2 pos,vec2 off){
  pos=floor(pos*res+off)/res;
  if(max(abs(pos.x-0.5),abs(pos.y-0.5))>0.5)return vec3(0.0,0.0,0.0);
  return ToLinear(texture(iChannel1,pos.xy,-16.0).rgb);}

// Distance in emulated pixels to nearest texel.
vec2 Dist(vec2 pos){pos=pos*res;return -((pos-floor(pos))-vec2(0.5));}
    
// 1D Gaussian.
float Gaus(float pos,float scale){return exp2(scale*pos*pos);}

// 3-tap Gaussian filter along horz line.
vec3 Horz3(vec2 pos,float off){
  vec3 b=Fetch(pos,vec2(-1.0,off));
  vec3 c=Fetch(pos,vec2( 0.0,off));
  vec3 d=Fetch(pos,vec2( 1.0,off));
  float dst=Dist(pos).x;
  // Convert distance to weight.
  float scale=hardPix;
  float wb=Gaus(dst-1.0,scale);
  float wc=Gaus(dst+0.0,scale);
  float wd=Gaus(dst+1.0,scale);
  // Return filtered sample.
  return (b*wb+c*wc+d*wd)/(wb+wc+wd);}

// 5-tap Gaussian filter along horz line.
vec3 Horz5(vec2 pos,float off){
  vec3 a=Fetch(pos,vec2(-2.0,off));
  vec3 b=Fetch(pos,vec2(-1.0,off));
  vec3 c=Fetch(pos,vec2( 0.0,off));
  vec3 d=Fetch(pos,vec2( 1.0,off));
  vec3 e=Fetch(pos,vec2( 2.0,off));
  float dst=Dist(pos).x;
  // Convert distance to weight.
  float scale=hardPix;
  float wa=Gaus(dst-2.0,scale);
  float wb=Gaus(dst-1.0,scale);
  float wc=Gaus(dst+0.0,scale);
  float wd=Gaus(dst+1.0,scale);
  float we=Gaus(dst+2.0,scale);
  // Return filtered sample.
  return (a*wa+b*wb+c*wc+d*wd+e*we)/(wa+wb+wc+wd+we);}

// Return scanline weight.
float Scan(vec2 pos,float off){
  float dst=Dist(pos).y;
  return Gaus(dst+off,hardScan);}

// Allow nearest three lines to effect pixel.
vec3 Tri(vec2 pos){
  vec3 a=Horz3(pos,-1.0);
  vec3 b=Horz5(pos, 0.0);
  vec3 c=Horz3(pos, 1.0);
  float wa=Scan(pos,-1.0);
  float wb=Scan(pos, 0.0);
  float wc=Scan(pos, 1.0);
  return a*wa+b*wb+c*wc;}


// Shadow mask.
vec3 Mask(vec2 pos)
{
  pos.x+=pos.y*3.0;
  vec3 mask=vec3(maskDark,maskDark,maskDark);
  pos.x=fract(pos.x/6.0);
  if(pos.x<0.333)mask.r=maskLight;
  else if(pos.x<0.666)mask.g=maskLight;
  else mask.b=maskLight;
  return mask;}    


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //------------------------
    // CRT
    //------------------------
    vec3 col = ToSrgb( Tri(fragCoord.xy/iResolution.xy)*Mask(fragCoord.xy) );
    //col = texture( iChannel1, fragCoord.xy/iResolution.xy ).xyz;

    //------------------------
    // glow
    //------------------------
       
    vec4  pacmanPos = loadValue( txPacmanPos );
    vec3  pacmanDir = loadValue( txPacmanMovDirNex ).xyz;
    vec4  ghostPos[4];
    ghostPos[0]     = loadValue( txGhost0PosDir );
    ghostPos[1]     = loadValue( txGhost1PosDir );
    ghostPos[2]     = loadValue( txGhost2PosDir );
    ghostPos[3]     = loadValue( txGhost3PosDir );
    vec2  points    = loadValue( txPoints ).xy;
    float state     = loadValue( txState ).x;
    float lives     = loadValue( txLives ).x;
    vec3 mode       = loadValue( txMode ) .xyz;

    // map
    col = drawMap( col, fragCoord );

    // pacman
    col = drawPacman( col, fragCoord, pacmanPos, pacmanDir );

    // ghosts
    for( int i=0; i<4; i++ )
        col = drawGhost( col, fragCoord, ghostPos[i].xyz, ghostPos[i].w, float(i), mode );
    
    // score
    col = drawScore( col, fragCoord, points, lives );
    
	fragColor = vec4( col, 1.0 );
}
`;

const buffA = `
// Created by inigo quilez - iq/2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0


// game play

#define _ 0 // empty
#define W 1 // wall
#define P 2 // point
#define B 3 // ball
#define PA(a,b,c,d,e,f,g) (a+4*(b+4*(c+4*(d+4*(e+4*(f+4*(g)))))))
#define DD(id,c0,c1,c2,c3,c4,c5,c6,c7,c8,c9,c10,c11,c12,c13) if(y==id) m=(x<7)?PA(c0,c1,c2,c3,c4,c5,c6):PA(c7,c8,c9,c10,c11,c12,c13);
int map( in ivec2 q ) 
{
    if( q.x>13 ) q.x = q.x = 26-q.x;
	int x = q.x;
	int y = q.y;
	int m = 0;
    DD(30, W,W,W,W,W,W,W,W,W,W,W,W,W,W)
    DD(29, W,P,P,P,P,P,P,P,P,P,P,P,P,W)
    DD(28, W,P,W,W,W,W,P,W,W,W,W,W,P,W)
    DD(27, W,B,W,W,W,W,P,W,W,W,W,W,P,W)
    DD(26, W,P,W,W,W,W,P,W,W,W,W,W,P,W)
    DD(25, W,P,P,P,P,P,P,P,P,P,P,P,P,P)
    DD(24, W,P,W,W,W,W,P,W,W,P,W,W,W,W)
    DD(23, W,P,W,W,W,W,P,W,W,P,W,W,W,W)
    DD(22, W,P,P,P,P,P,P,W,W,P,P,P,P,W)
    DD(21, W,W,W,W,W,W,P,W,W,W,W,W,_,W)
    DD(20, _,_,_,_,_,W,P,W,W,W,W,W,_,W)
    DD(19, _,_,_,_,_,W,P,W,W,_,_,_,_,_)
    DD(18, _,_,_,_,_,W,P,W,W,_,W,W,W,_)
    DD(17, W,W,W,W,W,W,P,W,W,_,W,_,_,_)
    DD(16, _,_,_,_,_,_,P,_,_,_,W,_,_,_)
    DD(15, W,W,W,W,W,W,P,W,W,_,W,_,_,_)
    DD(14, _,_,_,_,_,W,P,W,W,_,W,W,W,W)
    DD(13, _,_,_,_,_,W,P,W,W,_,_,_,_,_)
    DD(12, _,_,_,_,_,W,P,W,W,_,W,W,W,W)
    DD(11, W,W,W,W,W,W,P,W,W,_,W,W,W,W)
    DD(10, W,P,P,P,P,P,P,P,P,P,P,P,P,W)
    DD( 9, W,P,W,W,W,W,P,W,W,W,W,W,P,W)
    DD( 8, W,P,W,W,W,W,P,W,W,W,W,W,P,W)
    DD( 7, W,B,P,P,W,W,P,P,P,P,P,P,P,_)
    DD( 6, W,W,W,P,W,W,P,W,W,P,W,W,W,W)
    DD( 5, W,W,W,P,W,W,P,W,W,P,W,W,W,W)
    DD( 4, W,P,P,P,P,P,P,W,W,P,P,P,P,W)
    DD( 3, W,P,W,W,W,W,W,W,W,W,W,W,P,W)
    DD( 2, W,P,W,W,W,W,W,W,W,W,W,W,P,W)
    DD( 1, W,P,P,P,P,P,P,P,P,P,P,P,P,P)
    DD( 0, W,W,W,W,W,W,W,W,W,W,W,W,W,W)
	return (m>>(2*(x%7))) & 3;
}

//----------------------------------------------------------------------------------------------

const int KEY_SPACE = 32;
const int KEY_LEFT  = 37;
const int KEY_UP    = 38;
const int KEY_RIGHT = 39;
const int KEY_DOWN  = 40;

const float speedPacman = 7.0;
const float speedGhost  = 6.0;
const float intelligence = 0.53;
const float modeTime = 5.0;
//----------------------------------------------------------------------------------------------

float hash(float seed)
{
    return fract(sin(seed)*158.5453 );
}

//----------------------------------------------------------------------------------------------

vec4 loadValue( in ivec2 re )
{
    return texelFetch( iChannel0, re, 0 );
}

void storeValue( in ivec2 re, in vec4 va, inout vec4 fragColor, in ivec2 fragCoord )
{
    fragColor = ( re.x==fragCoord.x && re.y==fragCoord.y ) ? va : fragColor;
}

void storeValue( in ivec4 re, in vec4 va, inout vec4 fragColor, in ivec2 fragCoord )
{
    vec2 r = 0.5*vec2(re.zw);
    vec2 d = abs( vec2(fragCoord-re.xy)-r) - r - 0.5;
    fragColor = ( -max(d.x,d.y) > 0.0 ) ? va : fragColor;
}

ivec2 dir2dis( in int dir )
{
    ivec2 off = ivec2(0,0);
         if( dir==0 ) { off = ivec2( 0, 0); }
    else if( dir==1 ) { off = ivec2( 1, 0); }
    else if( dir==2 ) { off = ivec2(-1, 0); }
    else if( dir==3 ) { off = ivec2( 0, 1); }
    else              { off = ivec2( 0,-1); }
    return off;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    ivec2 ifragCoord = ivec2( fragCoord-0.5 );

    // don't compute gameplay outside of the data area
    if( ifragCoord.x > 31 || ifragCoord.y>31 ) discard;
    
    //---------------------------------------------------------------------------------   
	// load game state
	//---------------------------------------------------------------------------------
    vec4  ghostPos[4];
    vec4  pacmanPos       = loadValue( txPacmanPos );
    vec3  pacmanMovDirNex = loadValue( txPacmanMovDirNex ).xyz;
    vec2  points          = loadValue( txPoints ).xy;
    float state           = loadValue( txState ).x; // -1 = start game, 0 = start life, 1 = playing, 2 = game over
    vec3  mode            = loadValue( txMode ).xyz;
    float lives           = loadValue( txLives ).x;
    int   cell            = int( loadValue( ifragCoord ).x );
    ghostPos[0]           = loadValue( txGhost0PosDir );
    ghostPos[1]           = loadValue( txGhost1PosDir );
    ghostPos[2]           = loadValue( txGhost2PosDir );
    ghostPos[3]           = loadValue( txGhost3PosDir );
	
    //---------------------------------------------------------------------------------
    // reset
	//---------------------------------------------------------------------------------
	if( iFrame==0 ) state = -1.0;

    if( state<0.5 )
    {
        pacmanPos       = vec4(13.0,13.0,0.0,0.0);
        pacmanMovDirNex = vec3(0.0,0.0,0.0);
        mode            = vec3(0.0,-100.0,0.0);
        ghostPos[0]     = vec4(13.0,19.0,0.0,1.0);
        ghostPos[1]     = vec4(13.0,17.0,0.0,1.0);
        ghostPos[2]     = vec4(12.0,16.0,0.0,1.0);
        ghostPos[3]     = vec4(14.0,15.0,0.0,1.0);
    }
    
    if( state < -0.5 )
    {
        state           = 0.0;
        points          = vec2(0.0,0.0);
        lives           = 3.0;
        if( ifragCoord.x<27 && ifragCoord.y<31 ) 
            cell = map( ifragCoord );
    }
    else if( state < 0.5 )
    {
        state = 1.0;
    }
    else if( state < 1.5 ) 
	{
        //-------------------
        // pacman
        //-------------------

        // move with keyboard
        if( texelFetch( iChannel1, ivec2(KEY_RIGHT,0), 0 ).x>0.5 ) pacmanMovDirNex.z = 1.0;
        if( texelFetch( iChannel1, ivec2(KEY_LEFT, 0), 0 ).x>0.5 ) pacmanMovDirNex.z = 2.0;
        if( texelFetch( iChannel1, ivec2(KEY_UP,   0), 0 ).x>0.5 ) pacmanMovDirNex.z = 3.0;
        if( texelFetch( iChannel1, ivec2(KEY_DOWN, 0), 0 ).x>0.5 ) pacmanMovDirNex.z = 4.0;

        // execute desired turn as soon as possible
        if( pacmanMovDirNex.z>0.5 && abs(loadValue( ivec2(pacmanPos.xy) + dir2dis(int(pacmanMovDirNex.z)) ).x-float(W))>0.25 )
        {
            pacmanMovDirNex = vec3( pacmanMovDirNex.zz, 0.0 );
        }
        
        
        if( pacmanMovDirNex.x>0.5 ) pacmanPos.z += iTimeDelta*speedPacman;

        ivec2 off = dir2dis(int(pacmanMovDirNex.x));
        ivec2 np = ivec2(pacmanPos.xy) + off;
        float c = loadValue( np ).x;
        pacmanPos.w = step( 0.25, abs(c-float(W)) );

                
        if( pacmanPos.z>=1.0 )
        {
            pacmanPos.z = 0.0;
            float c = loadValue( np ).x;

            if( abs(c-float(W))<0.25 )
            {
                pacmanMovDirNex.x = 0.0;
            }
            else
            {
                pacmanPos.xy += vec2(off);
                // tunnel!
                     if( pacmanPos.x< 0.0 ) pacmanPos.x=26.0;
                else if( pacmanPos.x>26.0 ) pacmanPos.x= 0.0;
            }

            bool isin = (ifragCoord.x==int(pacmanPos.x)) && (ifragCoord.y==int(pacmanPos.y));
            c = loadValue( ivec2(pacmanPos.xy) ).x;
            if( abs(c-float(P))<0.2 )
            {
                if( isin ) cell = _;
                points += vec2(10.0,1.0);
            }
            else if( abs(c-float(B))<0.2 )
            {
                if( isin ) cell = _;
                points += vec2(50.0,1.0);
                mode.x = 1.0;
                mode.y = iTime;
            }
            if( points.y>241.5 )
            {
                state = 2.0;
            }
        }
        
        //-------------------
        // ghost
        //-------------------

        for( int i=0; i<4; i++ )
        {
            float seed = float(iFrame)*13.1 + float(i)*17.43;

            ghostPos[i].z += iTimeDelta*speedGhost;

            if( ghostPos[i].z>=1.0 )
            {
                ghostPos[i].z = 0.0;

                float c = loadValue( ivec2(ghostPos[i].xy)+dir2dis(int(ghostPos[i].w)) ).x;

                bool wr = int(loadValue( ivec2(ghostPos[i].xy)+ivec2( 1, 0) ).x) == W;
                bool wl = int(loadValue( ivec2(ghostPos[i].xy)+ivec2(-1, 0) ).x) == W;
                bool wu = int(loadValue( ivec2(ghostPos[i].xy)+ivec2( 0, 1) ).x) == W;
                bool wd = int(loadValue( ivec2(ghostPos[i].xy)+ivec2( 0,-1) ).x) == W;

                vec2 ra = vec2( hash( seed + 0.0),
                                hash( seed + 11.57) );
                if( abs(c-float(W)) < 0.25) // found a wall on the way
                {
                    if( ghostPos[i].w < 2.5 ) // was moving horizontally
                    {
                             if( !wu &&  wd )                ghostPos[i].w = 3.0;
                        else if(  wu && !wd )                ghostPos[i].w = 4.0;
                        else if( pacmanPos.y>ghostPos[i].y ) ghostPos[i].w = 3.0+mode.x;
                        else if( pacmanPos.y<ghostPos[i].y ) ghostPos[i].w = 4.0-mode.x;
                        else                                 ghostPos[i].w = 3.0-ghostPos[i].w;
                    }
                    else                          // was moving vertically
                    {
                             if( !wr &&  wl )                ghostPos[i].w = 1.0;
                        else if(  wr && !wl )                ghostPos[i].w = 2.0;
                        else if( pacmanPos.x>ghostPos[i].x ) ghostPos[i].w = 1.0+mode.x;
                        else if( pacmanPos.x<ghostPos[i].x ) ghostPos[i].w = 2.0-mode.x;
                        else                                 ghostPos[i].w = 7.0-ghostPos[i].w;
                    }

                }
                else if( ra.x < intelligence ) // found an intersection and it decided to find packman
                {
                    if( ghostPos[i].w < 2.5 ) // was moving horizontally
                    {
                             if( !wu && pacmanPos.y>ghostPos[i].y ) ghostPos[i].w = 3.0;
                        else if( !wd && pacmanPos.y<ghostPos[i].y ) ghostPos[i].w = 4.0;
                    }
                    else                          // was moving vertically
                    {
                             if( !wr && pacmanPos.x>ghostPos[i].x ) ghostPos[i].w = 1.0;
                        else if( !wl && pacmanPos.x<ghostPos[i].x ) ghostPos[i].w = 2.0;
                    }
                }
                else
                {
                         if( ra.y<0.15 ) { if( !wr ) ghostPos[i].w = 1.0; }
                    else if( ra.y<0.30 ) { if( !wl ) ghostPos[i].w = 2.0; }
                    else if( ra.y<0.45 ) { if( !wu ) ghostPos[i].w = 3.0; }
                    else if( ra.y<0.60 ) { if( !wd ) ghostPos[i].w = 4.0; }
                }

                if( abs(ghostPos[i].x-13.0)<0.25 &&
                    abs(ghostPos[i].y-19.0)<0.25 && 
                    abs(ghostPos[i].w-4.0)<0.25 )
                {
                    ghostPos[i].w = 1.0;
                }
                
                ghostPos[i].xy += vec2(dir2dis(int(ghostPos[i].w)));
                    
                    // tunnel!
                     if( ghostPos[i].x< 0.0 ) ghostPos[i].x=26.0;
                else if( ghostPos[i].x>26.0 ) ghostPos[i].x= 0.0;
            }
            
            
            // collision
            if( abs(pacmanPos.x-ghostPos[i].x)<0.5 && abs(pacmanPos.y-ghostPos[i].y)<0.5 )
            {
                if( mode.x<0.5 )
                {
                    lives -= 1.0;
                    if( lives<0.5 )
                    {
                		state = 2.0;
                    }
                    else
                    {
                        state = 0.0;
                    }
                }
                else
                {
                    points.x += 200.0;
                    ghostPos[i] = vec4(13.0,19.0,0.0,1.0);
                }
            }
        }
 
        //-------------------
        // mode
        //-------------------
        mode.z = (iTime-mode.y)/modeTime;
        if( mode.x>0.5 && mode.z>1.0 )
        {
            mode.x = 0.0;
        }
    }
    else //if( state > 0.5 )
    {
        float pressSpace = texelFetch( iChannel1, ivec2(KEY_SPACE,0), 0 ).x;
        if( pressSpace>0.5 )
        {
            state = -1.0;
        }
    }
  
	//---------------------------------------------------------------------------------
	// store game state
	//---------------------------------------------------------------------------------
    fragColor = vec4(0);
 
    
    storeValue( txPacmanPos,        vec4(pacmanPos),             fragColor, ifragCoord );
    storeValue( txPacmanMovDirNex,  vec4(pacmanMovDirNex,0.0),   fragColor, ifragCoord );
    storeValue( txGhost0PosDir,     vec4(ghostPos[0]),           fragColor, ifragCoord );
    storeValue( txGhost1PosDir,     vec4(ghostPos[1]),           fragColor, ifragCoord );
    storeValue( txGhost2PosDir,     vec4(ghostPos[2]),           fragColor, ifragCoord );
    storeValue( txGhost3PosDir,     vec4(ghostPos[3]),           fragColor, ifragCoord );
    storeValue( txPoints,           vec4(points,0.0,0.0),        fragColor, ifragCoord );
    storeValue( txState,            vec4(state,0.0,0.0,0.0),     fragColor, ifragCoord );
    storeValue( txMode,             vec4(mode,0.0),              fragColor, ifragCoord );
    storeValue( txLives,            vec4(lives,0.0,0.0,0.0),     fragColor, ifragCoord );
    storeValue( txCells,            vec4(cell,0.0,0.0,0.0),      fragColor, ifragCoord );
}
`;

const buffB = `
// Created by inigo quilez - iq/2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0


// rendering


float sdBox( vec2 p, vec2 b )
{
  vec2 d = abs(p) - b;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float sdBox( vec2 p, vec2 a, vec2 b )
{
  p -= (a+b)*0.5;
  vec2 d = abs(p) - 0.5*(b-a);
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float sdCircle( in vec2 p, in float r )
{
    return length( p ) - r;
}

//============================================================

// digit data by P_Malin
// converted to LUT and integer logic by iq
const int[] font = int[]( 
    7 + 5*16 + 5*256 + 5*4096 + 7*65536,
    2 + 2*16 + 2*256 + 2*4096 + 2*65536,
    7 + 1*16 + 7*256 + 4*4096 + 7*65536,
    7 + 4*16 + 7*256 + 4*4096 + 7*65536,
    4 + 7*16 + 5*256 + 1*4096 + 1*65536,
    7 + 4*16 + 7*256 + 1*4096 + 7*65536,
    7 + 5*16 + 7*256 + 1*4096 + 7*65536,
    4 + 4*16 + 4*256 + 4*4096 + 7*65536,
    7 + 5*16 + 7*256 + 5*4096 + 7*65536,
    7 + 4*16 + 7*256 + 5*4096 + 7*65536 );
                          
int SampleDigit(const in int n, const in vec2 vUV)
{
    //if( abs(vUV.x-0.5)>0.5 || abs(vUV.y-0.5)>0.5 ) return 0;
    vec2 q = abs(vUV-0.5);
    if( max(q.x,q.y)>0.5 ) return 0;
    

    ivec2 p = ivec2(floor(vUV * vec2(4.0, 5.0)));
    int   i = p.x + p.y*4;
    
    return (font[n]>>i) & 1;
}

int PrintInt( in vec2 uv, in int value )
{
    int res = 0;
    
    int maxDigits = (value<10) ? 1 : (value<100) ? 2 : 3;
    int digitID = maxDigits - 1 - int(floor(uv.x));
    
    if( digitID>=0 && digitID<maxDigits )
    {
        int div = (digitID==0) ? 1 : (digitID==1) ? 10 : 100;
        res = SampleDigit( (value/div) % 10, vec2(fract(uv.x), uv.y) );
    }

    return res;
}

vec4 loadValue( in ivec2 re )
{
    return texelFetch( iChannel0, re, 0 );
}

//============================================================

vec3 drawMap( vec3 col, in vec2 fragCoord )
{
    vec2 p = fragCoord/iResolution.y;
    p.x += 0.5*(1.0-iResolution.x/iResolution.y); // center
    float wp = 1.0/iResolution.y;

    vec2 q = floor(p*31.0);
    vec2 r = fract(p*31.0);
    float wr = 31.0*wp;

    if( q.x>=0.0 && q.x<=27.0 )
    {
        float c = texture( iChannel0, (q+0.5)/iResolution.xy, -100.0 ).x;

        // empty
        if( c<0.5 )
        {
        }
        // walls
        else if( c<1.5 )
        {
            vec2 wmi = vec2( texture( iChannel0, (q-vec2(1.0,0.0)+0.5)/iResolution.xy ).x,
                             texture( iChannel0, (q-vec2(0.0,1.0)+0.5)/iResolution.xy ).x );
            vec2 wma = vec2( texture( iChannel0, (q+vec2(1.0,0.0)+0.5)/iResolution.xy ).x,
                             texture( iChannel0, (q+vec2(0.0,1.0)+0.5)/iResolution.xy ).x );
			
            wmi = step( abs(wmi-1.0), vec2(0.25) );
            wma = step( abs(wma-1.0), vec2(0.25) );
            vec2 ba = -(0.16+0.35*wmi);
            vec2 bb =  (0.16+0.35*wma);

            //bb = vec2(0.51); ba = -bb;

            float d = sdBox(r-0.5, ba, bb);
            float f = 1.0 - smoothstep( -0.01, 0.01, d );
            
            vec3 wco = 0.5 + 0.5*cos( 3.9 - 0.2*(wmi.x+wmi.y+wma.x+wma.y) + vec3(0.0,1.0,1.5) );
            wco += 0.1*sin(40.0*d);
            col = mix( col, wco, f );
        }
        // points
        else if( c<2.5 )
        {
            float d = sdCircle(r-0.5, 0.15);
            float f = 1.0 - smoothstep( -wr, wr, d );
            col = mix( col, vec3(1.0,0.8,0.7), f );
            //col += 0.3*vec3(1.0,0.7,0.4)*exp(-12.0*d*d); // glow
        }
        // big alls
        else
        {
            float d = sdCircle( r-0.5 ,0.40*smoothstep( -1.0, -0.5, sin(2.0*6.2831*iTime) ));
            float f = 1.0 - smoothstep( -wr, wr, d );
            col = mix( col, vec3(1.0,0.9,0.5), f );
        }
    }
    
    return col;
}

vec2 dir2dis( float dir )
{
    vec2 off = vec2(0.0);
         if( dir<0.5 ) { off = vec2( 0.0, 0.0); }
    else if( dir<1.5 ) { off = vec2( 1.0, 0.0); }
    else if( dir<2.5 ) { off = vec2(-1.0, 0.0); }
    else if( dir<3.5 ) { off = vec2( 0.0, 1.0); }
    else               { off = vec2( 0.0,-1.0); }
    return off;
}


vec2 cell2ndc( vec2 c )
{
	c = (c+0.5) / 31.0;
    c.x -= 0.5*(1.0-iResolution.x/iResolution.y); // center
    return c;
}


vec3 drawPacman( vec3 col, in vec2 fragCoord, in vec4 pacmanPos, in vec3 pacmanMovDirNex )
{
    vec2 off = dir2dis(pacmanMovDirNex.x);
    
    vec2 mPacmanPos = pacmanPos.xy;
    //vec2 mPacmanPos = pacmanPos.xy + off*pacmanPos.z*pacmanPos.w;

    vec2 p = fragCoord/iResolution.y;
    float eps = 1.0 / iResolution.y;

    vec2 q = p - cell2ndc( mPacmanPos );

         if( pacmanMovDirNex.y<1.5 ) { q = q.xy*vec2(-1.0,1.0); }
    else if( pacmanMovDirNex.y<2.5 ) { q = q.xy; }
    else if( pacmanMovDirNex.y<3.5 ) { q = q.yx*vec2(-1.0,1.0); }
    else                             { q = q.yx; }

    float c = sdCircle(q, 0.023);
    float f = c;

    if( pacmanMovDirNex.y>0.5 )
    {
        float an = (0.5 + 0.5*sin(4.0*iTime*6.2831)) * 0.9;
        vec2 w = normalize( q - vec2(0.005,0.0) );

        w = vec2( w.x, abs( w.y ) );
        float m = dot( w, vec2(sin(an),cos(an)));
        f = max( f, -m );
    }
    f = 1.0 - smoothstep( -0.5*eps, 0.5*eps, f );
    col = mix( col, vec3(1.0,0.8,0.1), f );

    // glow
    //col += 0.25*vec3(1.0,0.8,0.0)*exp(-300.0*c*c);

    return col;
}

vec3 drawGhost( vec3 col, in vec2 fragCoord, in vec3 pos, in float dir, in float id, in vec3 mode )
{
    vec2 off = dir2dis(dir);

    vec2 gpos = pos.xy;

    
    vec2 p = fragCoord/iResolution.y;
    float eps = 1.0 / iResolution.y;

    vec2 q = p - cell2ndc( gpos );

    float c = sdCircle(q, 0.023);
    float f = c;
	f = max(f,-q.y);
    float on = 0.0025*sin(1.0*6.28318*q.x/0.025 + 6.2831*iTime);
    f = min( f, sdBox(q-vec2(0.0,-0.0065+on), vec2(0.023,0.012) ) );
   
    vec3 gco = 0.5 + 0.5*cos( 5.0 + 0.7*id + vec3(0.0,2.0,4.0) );
    float g = mode.x;
    if( mode.z>0.75 )
    {
        g *= smoothstep(-0.2,0.0,sin(3.0*6.28318*(iTime-mode.y)));
    }
    gco = mix( gco, vec3(0.1,0.5,1.0), g );
    
    f = 1.0 - smoothstep( -0.5*eps, 0.5*eps, f );
    col = mix( col, gco, f );

    f = sdCircle( vec2(abs(q.x-off.x*0.006)-0.011,q.y-off.y*0.006-0.008), 0.008);
    f = 1.0 - smoothstep( -0.5*eps, 0.5*eps, f );
    col = mix( col, vec3(1.0), f );

    f = sdCircle( vec2(abs(q.x-off.x*0.01)-0.011,q.y-off.y*0.01-0.008), 0.004);
    f = 1.0 - smoothstep( -0.5*eps, 0.5*eps, f );
    col = mix( col, vec3(0.0), f );

    // glow
    //col += 0.2*gco*exp(-300.0*c*c);

    return col;
}


vec3 drawScore( in vec3 col, in vec2 fragCoord, vec2 score, float lives )
{
    // score
    vec2 p = fragCoord/iResolution.y;
    col += float( PrintInt( (p - vec2(0.05,0.9))*20.0, int(score.x) ));
    col += float( PrintInt( (p - vec2(0.05,0.8))*20.0, int(242.0-score.y) ));
    
    // lives
    float eps = 1.0 / iResolution.y;
    for( int i=0; i<3; i++ )
    {
        float h = float(i);
        vec2 q = p - vec2(0.1 + 0.075*h, 0.7 );
        if( h + 0.5 < lives )
        {
            float c = sdCircle(q, 0.023);
            float f = c;

            {
                vec2 w = normalize( q - vec2(0.005,0.0) );
                w = vec2( w.x, abs( w.y ) );
                float an = 0.5;
                float m = dot( w, vec2(sin(an),cos(an)));
                f = max( f, -m );
            }
            f = 1.0 - smoothstep( -0.5*eps, 0.5*eps, f );
            col = mix( col, vec3(1.0,0.8,0.1), f );

            // glow
            //col += 0.15*vec3(1.0,0.8,0.0)*exp(-1500.0*c*c);
        }
    }

    return col;
}

//============================================================

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //------------------------
    // load game state
    //------------------------
       
    vec4  pacmanPos = loadValue( txPacmanPos );
    vec3  pacmanDir = loadValue( txPacmanMovDirNex ).xyz;
    vec4  ghostPos[4];
    ghostPos[0]     = loadValue( txGhost0PosDir );
    ghostPos[1]     = loadValue( txGhost1PosDir );
    ghostPos[2]     = loadValue( txGhost2PosDir );
    ghostPos[3]     = loadValue( txGhost3PosDir );
    vec2  points    = loadValue( txPoints ).xy;
    float state     = loadValue( txState ).x;
    float lives     = loadValue( txLives ).x;
    vec3 mode       = loadValue( txMode ) .xyz;


    //------------------------
    // render
    //------------------------
    vec3 col = vec3(0.0);
    
    // map
    col = drawMap( col, fragCoord );
    
    // pacman
    col = drawPacman( col, fragCoord, pacmanPos, pacmanDir );

    // ghosts
    for( int i=0; i<4; i++ )
    {
        col = drawGhost( col, fragCoord, ghostPos[i].xyz, ghostPos[i].w, float(i), mode );
    }

    // score
    col = drawScore( col, fragCoord, points, lives );
 
    
    if( state>1.5 )
    {
        col = mix( col, vec3(0.3), smoothstep(-1.0,1.0,sin(2.0*6.2831*iTime)) );
    }
    
	fragColor = vec4( col, 1.0 );
}`;

export default class implements iSub {
  key(): string {
    return 'Ms3XWN';
  }
  name(): string {
    return 'Pacman Game';
  }
  // sort() {
  //   return 0;
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
    ];
  }
}
