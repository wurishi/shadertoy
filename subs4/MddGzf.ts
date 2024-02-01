import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const f = `
// Created by inigo quilez - iq/2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0

//
// Gameplay computation.
//
// The gameplay buffer is 14x14 pixels. The whole game is run/played for each one of these
// pixels. A filter in the end of the shader takes only the bit  of infomration that needs 
// to be stored in each texl of the game-logic texture.

// storage register/texel addresses
const ivec2 txBallPosVel = ivec2(0,0);
const ivec2 txPaddlePos  = ivec2(1,0);
const ivec2 txPoints     = ivec2(2,0);
const ivec2 txState      = ivec2(3,0);
const ivec2 txLastHit    = ivec2(4,0);
const ivec4 txBricks     = ivec4(0,1,13,12);

const float ballRadius = 0.035;
const float paddleSize = 0.30;
const float paddleWidth = 0.06;
const float paddlePosY  = -0.90;
const float brickW = 2.0/13.0;
const float brickH = 1.0/15.0;

const float gameSpeed =  3.0;
const float inputSpeed = 2.0;

const int KEY_SPACE = 32;
const int KEY_LEFT  = 37;
const int KEY_RIGHT = 39;

//----------------------------------------------------------------------------------------------

float hash1( float n ) { return fract(sin(n)*138.5453123); }

// intersect a disk sweept in a linear segment with a line/plane. 
float iPlane( in vec2 ro, in vec2 rd, float rad, vec3 pla )
{
    float a = dot( rd, pla.xy );
    if( a>0.0 ) return -1.0;
    float t = (rad - pla.z - dot(ro,pla.xy)) / a;
    if( t>=1.0 ) t=-1.0;
    return t;
}

// intersect a disk sweept in a linear segment with a box 
vec3 iBox( in vec2 ro, in vec2 rd, in float rad, in vec2 bce, in vec2 bwi ) 
{
    vec2 m = 1.0/rd;
    vec2 n = m*(ro - bce);
    vec2 k = abs(m)*(bwi+rad);
    vec2 t1 = -n - k;
    vec2 t2 = -n + k;
	float tN = max( t1.x, t1.y );
	float tF = min( t2.x, t2.y );
	if( tN > tF || tF < 0.0) return vec3(-1.0);
    if( tN>=1.0 ) return vec3(-1.0);
	vec2 nor = -sign(rd)*step(t1.yx,t1.xy);
	return vec3( tN, nor );
}

//----------------------------------------------------------------------------------------------

vec4 loadValue( in ivec2 re )
{
    return texelFetch( iChannel0, re, 0 );
}
void storeValue( in ivec2 re, in vec4 va, inout vec4 fragColor, in ivec2 p )
{
    fragColor = (p==re) ? va : fragColor;
}
void storeValue( in ivec4 re, in vec4 va, inout vec4 fragColor, in ivec2 p )
{
    fragColor = ( p.x>=re.x && p.y>=re.y && p.x<=re.z && p.y<=re.w ) ? va : fragColor;
}

//----------------------------------------------------------------------------------------------

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    ivec2 ipx = ivec2(fragCoord-0.5);
 
    // don't compute gameplay outside of the data area
    if( fragCoord.x > 14.0 || fragCoord.y>14.0 ) discard;
    
    //---------------------------------------------------------------------------------   
	// load game state
	//---------------------------------------------------------------------------------
    vec4  balPosVel = loadValue( txBallPosVel );
    float paddlePos = loadValue( txPaddlePos ).x;
    float points    = loadValue( txPoints ).x;
    float state     = loadValue( txState ).x;
    vec3  lastHit   = loadValue( txLastHit ).xyz;        // paddle, brick, wall
    vec2  brick     = loadValue( ipx ).xy;               // visible, hittime
	
    //---------------------------------------------------------------------------------
    // reset
	//---------------------------------------------------------------------------------
	if( iFrame==0 ) state = -1.0;
	
    if( state < -0.5 )
    {
        state = 0.0;
        balPosVel = vec4(0.0,paddlePosY+ballRadius+paddleWidth*0.5+0.001, 0.6,1.0);
        paddlePos = 0.0;
        points = 0.0;
        state = 0.0;
        brick = vec2(1.0,-5.0);
        lastHit = vec3(-1.0);
        
        
        if( fragCoord.x<1.0 || fragCoord.x>12.0 )
        {
            brick.x = 0.0;
            brick.y = -10.0;
        }
        

    }

    //---------------------------------------------------------------------------------
    // do game
    //---------------------------------------------------------------------------------

    // game over (or won), wait for space key press to resume
    if( state > 0.5 )
    {
        float pressSpace = texelFetch( iChannel1, ivec2(KEY_SPACE,0.0), 0 ).x;
        if( pressSpace>0.5 )
        {
            state = -1.0;
        }
    }
    
    // if game mode (not game over), play game
    else if( state < 0.5 ) 
	{

        //-------------------
        // paddle
        //-------------------
        float oldPaddlePos = paddlePos;
        if( iMouse.w>0.01 )
        {
            // move with mouse
            paddlePos = (-1.0 + 2.0*iMouse.x/iResolution.x)*iResolution.x/iResolution.y;
        }
        else
        {
            // move with keyboard
            float moveRight = texelFetch( iChannel1, ivec2(KEY_RIGHT,0), 0 ).x;
            float moveLeft  = texelFetch( iChannel1, ivec2(KEY_LEFT,0), 0 ).x;
            paddlePos += 0.02*inputSpeed*(moveRight - moveLeft);
        }
        paddlePos = clamp( paddlePos, -1.0+0.5*paddleSize+paddleWidth*0.5, 1.0-0.5*paddleSize-paddleWidth*0.5 );

        float moveTotal = sign( paddlePos - oldPaddlePos );

        //-------------------
        // ball
		//-------------------
        float dis = 0.01*gameSpeed*(iTimeDelta*60.0);
        
        // do up to 3 sweep collision detections (usually 0 or 1 will happen only)
        for( int j=0; j<3; j++ )
        {
            ivec3 oid = ivec3(-1);
            vec2 nor;
            float t = 1000.0;

            // test walls
            const vec3 pla1 = vec3(-1.0, 0.0,1.0 ); 
            const vec3 pla2 = vec3( 1.0, 0.0,1.0 ); 
            const vec3 pla3 = vec3( 0.0,-1.0,1.0 ); 
            float t1 = iPlane( balPosVel.xy, dis*balPosVel.zw, ballRadius, pla1 ); if( t1>0.0         ) { t=t1; nor = pla1.xy; oid.x=1; }
            float t2 = iPlane( balPosVel.xy, dis*balPosVel.zw, ballRadius, pla2 ); if( t2>0.0 && t2<t ) { t=t2; nor = pla2.xy; oid.x=2; }
            float t3 = iPlane( balPosVel.xy, dis*balPosVel.zw, ballRadius, pla3 ); if( t3>0.0 && t3<t ) { t=t3; nor = pla3.xy; oid.x=3; }
            
            // test paddle
            vec3  t4 = iBox( balPosVel.xy, dis*balPosVel.zw, ballRadius, vec2(paddlePos,paddlePosY), vec2(paddleSize*0.5,paddleWidth*0.5) );
            if( t4.x>0.0 && t4.x<t ) { t=t4.x; nor = t4.yz; oid.x=4;  }
            
            // test bricks
            ivec2 idr = ivec2(floor( vec2( (1.0+balPosVel.x)/brickW, (1.0-balPosVel.y)/brickH) ));
            ivec2 vs = ivec2(sign(balPosVel.zw));
            for( int j=0; j<3; j++ )
            for( int i=0; i<3; i++ )
            {
                ivec2 id = idr + ivec2( vs.x*i,-vs.y*j);
                if( id.x>=0 && id.x<13 && id.y>=0 && id.y<12 )
                {
                    float brickHere = texelFetch( iChannel0, (txBricks.xy+id), 0 ).x;
                    if( brickHere>0.5 )
                    {
                        vec2 ce = vec2( -1.0 + float(id.x)*brickW + 0.5*brickW,
                                         1.0 - float(id.y)*brickH - 0.5*brickH );
                        vec3 t5 = iBox( balPosVel.xy, dis*balPosVel.zw, ballRadius, ce, 0.5*vec2(brickW,brickH) );
                        if( t5.x>0.0 && t5.x<t )
                        {
                            oid = ivec3(5,id);
                            t = t5.x;
                            nor = t5.yz;
                        }
                    }
                }
            }
    
            // no collisions
            if( oid.x<0 ) break;

            
            // bounce
            balPosVel.xy += t*dis*balPosVel.zw;
            dis *= 1.0-t;
            
            // did hit walls
            if( oid.x<4 )
            {
                balPosVel.zw = reflect( balPosVel.zw, nor );
                lastHit.z = iTime;
            }
            // did hit paddle
            else if( oid.x<5 )
            {
                balPosVel.zw = reflect( balPosVel.zw, nor );
                // borders bounce back
                     if( balPosVel.x > (paddlePos+paddleSize*0.5) ) balPosVel.z =  abs(balPosVel.z);
                else if( balPosVel.x < (paddlePos-paddleSize*0.5) ) balPosVel.z = -abs(balPosVel.z);
                balPosVel.z += 0.37*moveTotal;
                balPosVel.z += 0.11*hash1( float(iFrame)*7.1 );
                balPosVel.z = clamp( balPosVel.z, -0.9, 0.9 );
                balPosVel.zw = normalize(balPosVel.zw);
                
                // 
                lastHit.x = iTime;
                lastHit.y = iTime;
            }
            // did hit a brick
            else if( oid.x<6 )
            {
                balPosVel.zw = reflect( balPosVel.zw, nor );
                lastHit.y = iTime;
                points += 1.0;
                if( points>131.5 )
                {
                    state = 2.0; // won game!
                }

                if( ipx == txBricks.xy+oid.yz )
                {
                    brick = vec2(0.0, iTime);
                }
            }
        }
        
        balPosVel.xy += dis*balPosVel.zw;
        
        // detect miss
        if( balPosVel.y<-1.0 )
        {
            state = 1.0; // game over
        }
    }
    
	//---------------------------------------------------------------------------------
	// store game state
	//---------------------------------------------------------------------------------
    fragColor = vec4(0.0, 0, 0, 1);
    
 
    storeValue( txBallPosVel, vec4(balPosVel),             fragColor, ipx );
    storeValue( txPaddlePos,  vec4(paddlePos,0.0,0.0,0.0), fragColor, ipx );
    storeValue( txPoints,     vec4(points,0.0,0.0,0.0),    fragColor, ipx );
    storeValue( txState,      vec4(state,0.0,0.0,0.0),     fragColor, ipx );
    storeValue( txLastHit,    vec4(lastHit,0.0),           fragColor, ipx );
    storeValue( txBricks,     vec4(brick,0.0,0.0),         fragColor, ipx );
}
`;

const fragment = `
// Created by inigo quilez - iq/2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0

//
// Game rendering. Regular 2D distance field rendering.
//


// storage register/texel addresses
const ivec2 txBallPosVel = ivec2(0,0);
const ivec2 txPaddlePos  = ivec2(1,0);
const ivec2 txPoints     = ivec2(2,0);
const ivec2 txState      = ivec2(3,0);
const ivec2 txLastHit    = ivec2(4,0);
const ivec4 txBricks     = ivec4(0,1,13,12);

const float ballRadius = 0.035;
const float paddleSize = 0.30;
const float paddleWidth = 0.06;
const float paddlePosY  = -0.90;
const float brickW = 2.0/13.0;
const float brickH = 1.0/15.0;

//----------------

const vec2 shadowOffset = vec2(-0.03,0.03);

//=================================================================================================
// distance functions
//=================================================================================================

float udSegment( in vec2 p, in vec2 a, in vec2 b )
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
    return length( pa - ba*h );
}

float udHorizontalSegment( in vec2 p, in float xa, in float xb, in float y )
{
    vec2 pa = p - vec2(xa,y);
    float ba = xb - xa;
    pa.x -= ba*clamp( pa.x/ba, 0.0, 1.0 );
    return length( pa );
}

float udRoundBox( in vec2 p, in vec2 c, in vec2 b, in float r )
{
  return length(max(abs(p-c)-b,0.0))-r;
}

//=================================================================================================
// utility
//=================================================================================================

float hash1( in float n )
{
    return fract(sin(n)*138.5453123);
}

const int[] font = int[](0x75557, 0x22222, 0x74717, 0x74747, 0x11574, 0x71747, 0x71757, 0x74444, 0x75757, 0x75747);
const int[] powers = int[](1, 10, 100, 1000, 10000);
int PrintInt( in vec2 uv, in int value )
{
    const int maxDigits = 3;
    if( abs(uv.y-0.5)<0.5 )
    {
        int iu = int(floor(uv.x));
        if( iu>=0 && iu<maxDigits )
        {
            int n = (value/powers[maxDigits-iu-1]) % 10;
            uv.x = fract(uv.x);//(uv.x-float(iu)); 
            ivec2 p = ivec2(floor(uv*vec2(4.0,5.0)));
            return (font[n] >> (p.x+p.y*4)) & 1;
        }
    }
    return 0;
}

//=================================================================================================

float doBrick( in ivec2 id, out vec3 col, out float glo, out vec2 cen )
{
    float alp = 0.0;
    
    glo = 0.0;
    col = vec3(0.0);
    cen = vec2(0.0);
    
    if( id.x>0 && id.x<13 && id.y>=0 && id.y<12 )
    {
        vec2 brickHere = texelFetch( iChannel0, txBricks.xy+id, 0 ).xy;

        alp = 1.0;
        glo = 0.0;
        if( brickHere.x < 0.5 )
        {
            float t = max(0.0,iTime-brickHere.y-0.1);
            alp = exp(-2.0*t );
            glo = exp(-4.0*t );
        }
         
        if( alp>0.001 )
        {
            float fid = hash1( float(id.x*3 + id.y*16) );
            col = vec3(0.5,0.5,0.6) + 0.4*sin( fid*2.0 + 4.5 + vec3(0.0,1.0,1.0) );
            if( hash1(fid*13.1)>0.85 )
            {
                col = 1.0 - 0.9*col;
                col.xy += 0.2;
            }
        }
        
        cen = vec2( -1.0 + float(id.x)*brickW + 0.5*brickW,
                     1.0 - float(id.y)*brickH - 0.5*brickH );
    }

    return alp;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 uv = (2.0*fragCoord-iResolution.xy) / iResolution.y;
    float px = 2.0/iResolution.y;
    
    //------------------------
    // load game state
    //------------------------
    vec2  ballPos   = texelFetch( iChannel0, txBallPosVel, 0 ).xy;
    float paddlePos = texelFetch( iChannel0, txPaddlePos, 0 ).x;
    float points    = texelFetch( iChannel0, txPoints, 0 ).x;
    float state     = texelFetch( iChannel0, txState, 0 ).x;
    vec3  lastHit   = texelFetch( iChannel0, txLastHit, 0 ).xyz;

    
    //------------------------
    // draw
    //------------------------
    vec3 col = vec3(0.0);
    vec3 emi = vec3(0.0);
    
    // board
    {
        col = 0.6*vec3(0.4,0.6,0.7)*(1.0-0.4*length( uv ));
        col *= 1.0 - 0.1*smoothstep( 0.0,1.0,sin(uv.x*80.0)*sin(uv.y*80.0))*(1.0 - smoothstep( 1.0, 1.01, abs(uv.x) ) );
    }    

    // bricks
    {
        float b = brickW*0.17;

        // soft shadow
        {
            vec2 st = uv + shadowOffset;
            ivec2 id = ivec2(floor( vec2( (1.0+st.x)/brickW, (1.0-st.y)/brickH) ));

            vec3 bcol; vec2 bcen; float bglo;

            float sha = 0.0;
            for( int j=-1; j<=1; j++ )
        	for( int i=-1; i<=1; i++ )
        	{
                ivec2 idr = id + ivec2(i, j );
                float alp = doBrick( idr, bcol, bglo, bcen );
                float f = udRoundBox( st, bcen, 0.5*vec2(brickW,brickH)-b, b );
                float s = 1.0 - smoothstep( -brickH*0.5, brickH*1.0, f ); 
                s = mix( 0.0, s, alp );
                sha = max( sha, s );
            }
            col = mix( col, col*0.4, sha );
        }
    

        ivec2 id = ivec2(floor( vec2( (1.0+uv.x)/brickW, (1.0-uv.y)/brickH) ));
        
        // shape
        {
            vec3 bcol; vec2 bcen; float bglo;
            float alp = doBrick( id, bcol, bglo, bcen );
            if( alp>0.0001 )
            {
                float f = udRoundBox( uv, bcen, 0.5*vec2(brickW,brickH)-b, b );
                bglo  += 0.6*smoothstep( -4.0*px, 0.0, f );

                bcol *= 0.7 + 0.3*smoothstep( -4.0*px, -2.0*px, f );
                bcol *= 0.5 + 1.7*bglo;
                col = mix( col, bcol, alp*(1.0-smoothstep( -px, px, f )) );
            }
        }
        
        // gather glow
        for( int j=-1; j<=1; j++ )
        for( int i=-1; i<=1; i++ )
        {
            ivec2 idr = id + ivec2(i, j );
            vec3 bcol = vec3(0.0); vec2 bcen; float bglo;
            float alp = doBrick( idr, bcol, bglo, bcen );
            float f = udRoundBox( uv, bcen, 0.5*vec2(brickW,brickH)-b, b );
            emi += bcol*bglo*exp(-600.0*f*f);
        }
    }    
    
    
    // ball 
    {
        float hit = exp(-4.0*(iTime-lastHit.y) );

        // shadow
        float f = 1.0-smoothstep( ballRadius*0.5, ballRadius*2.0, length( uv - ballPos + shadowOffset ) );
        col = mix( col, col*0.4, f );

        // shape
        f = length( uv - ballPos ) - ballRadius;
        vec3 bcol = vec3(1.0,0.6,0.2);
        bcol *= 1.0 + 0.7*smoothstep( -3.0*px, -1.0*px, f );
        bcol *= 0.7 + 0.3*hit;
        col = mix( col, bcol, 1.0-smoothstep( 0.0, px, f ) );
        
        emi  += bcol*0.75*hit*exp(-500.0*f*f );
    }
    
    
    // paddle
    {
        float hit = exp(-4.0*(iTime-lastHit.x) ) * sin(20.0*(iTime-lastHit.x));
        float hit2 = exp(-4.0*(iTime-lastHit.x) );
        float y = uv.y + 0.04*hit * (1.0-pow(abs(uv.x-paddlePos)/(paddleSize*0.5),2.0));

        // shadow
        float f = udHorizontalSegment( vec2(uv.x,y)+shadowOffset, paddlePos-paddleSize*0.5,paddlePos+paddleSize*0.5,paddlePosY );
        f = 1.0-smoothstep( paddleWidth*0.5*0.5, paddleWidth*0.5*2.0, f );
        col = mix( col, col*0.4, f );

        // shape
        f = udHorizontalSegment( vec2(uv.x,y), paddlePos-paddleSize*0.5, paddlePos+paddleSize*0.5,paddlePosY ) - paddleWidth*0.5;
        vec3 bcol = vec3(1.0,0.6,0.2);
        bcol *= 1.0 + 0.7*smoothstep( -3.0*px, -1.0*px, f );
        bcol *= 0.7 + 0.3*hit2;
        col = mix( col, bcol, 1.0-smoothstep( -px, px, f ) );
        emi  += bcol*0.75*hit2*exp( -500.0*f*f );

    }

    
    // borders
    {
        float f = abs(abs(uv.x)-1.02);
        f = min( f, udHorizontalSegment(uv,-1.0,1.0,1.0) );
        f *= 2.0;
        float a = 0.8 + 0.2*sin(2.6*iTime) + 0.1*sin(4.0*iTime);
        float hit  = exp(-4.0*(iTime-lastHit.z) );
        //
        a *= 1.0-0.3*hit;
        col += a*0.5*vec3(0.6,0.30,0.1)*exp(- 30.0*f*f);
        col += a*0.5*vec3(0.6,0.35,0.2)*exp(-150.0*f*f);
        col += a*1.7*vec3(0.6,0.50,0.3)*exp(-900.0*f*f);
    }
    
    // score
    {
        float f = float(PrintInt( (uv-vec2(-1.5,0.8))*10.0, int(points) ));
        col = mix( col, vec3(1.0,1.0,1.0), f );
    }
    
    
    // add emmission
    col += emi;
    

    //------------------------
    // game over
    //------------------------
    col = mix( col, vec3(1.0,0.5,0.2), state * (0.5+0.5*sin(30.0*iTime)) );

    fragColor = vec4(col,1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'MddGzf';
  }
  name(): string {
    return 'Bricks Game';
  }
  sort() {
    return 462;
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
    return [{ type: 1, f, fi: 0 }];
  }
}
