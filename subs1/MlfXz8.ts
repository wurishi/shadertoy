import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
//---------------------------------------------------------
// attempt #6: 523 chars
// more geom encoding using swizzling.
// todo: R() can probably be size-optimized.
#define G g+.2/p.ywyw*
#define E if(floor(mod(t,10.)) == n++) e=G
#define R(b) (i.x>=b.x&&i.x<b.z&&i.y>=b.y&&i.y<b.w)?1.:-1.// is i inside the rect b? b.xy/topleft, b.zw=bottomright
void mainImage(out vec4 o,vec2 i)
{
    o.xyz=iResolution;
    i/=o.xy;
    i.x*=o.x/o.y/.7;
    float d = 1., t=iTime, n;
    for(float z=5.;z>0.;z--)
    {
	    vec4 g = vec4(z,2,z,2)/4.,
            e=vec4(1,3,2,4),f=e,j=f.xxzz,k=f.xyyw,m=j,p=f;
        m.x=e.x=n=0.;
        p.w=5.;
        // e = 0 3 2 4
        // f = 1 3 2 4
        // j = 1 1 2 2
        // k = 1 3 3 4
        // m = 0 1 2 2
        // p = 1 3 2 5
        E f.xxzw;
        E p-f.zwxx+1.;
        E e,f=G f.xxyz;
        E e,f=G m;
        E e.xxzz,f=G p;
        E m,f=G k;
        E k,f=G j;
        E e.xxzw;
        E j,f=G f;
        E m,f=G f;
        t/=10.;
        d = max(max(min(d, -(R(vec4(g.xy,g.xy+.2)))),
                    R(e)),
                R(f));

    }
    o=o*0.-d;
    o.a=1.;
}

//---------------------------------------------------------
// attempt #5: 569 chars
/*
#define G g+.2/vec4(3,5,3,5)*vec4
#define E if(floor(mod(t,10.)) == n++) e=G
#define F ,f=G
#define R(b) (i.x>=b.x&&i.x<b.z&&i.y>=b.y&&i.y<b.w)?1.:-1.// is i inside the rect b? b.xy/topleft, b.zw=bottomright
void mainImage(out vec4 o,vec2 i)
{
    o.xyz=iResolution;
    i/=o.xy;
    i.x*=o.x/o.y/.7;
    o*=0.;
    float d = 1., t=iTime, n;
    for(float z=5.;z>0.;z--)
    {
	    vec4 g = vec4(z,2,z,2)/4.,
        e=vec4(0,1,2,2),f=o;// our 2 rects (xy=top left, zw=bottom right)
        n=0.;
        E(1,1,2,4);
        E(0,0,1,5)F(2,0,3,5);
        E(0,3,2,4)F(1,1,3,2);
        E(e)F(0,3,2,4);
        E(1,3,2,5)F(0,0,2,2);
        E(e)F(1,3,3,4);
        E(1,3,3,4)F(1,1,2,2);
        E(0,0,2,4);
        E(1,1,2,2)F(1,3,2,4);
        E(e)F(1,3,2,4);
        t/=10.;
        // geometry
        d = max(max(
                    min(d, -(R(vec4(g.xy,g.xy+.2)))),
                    R(e)),
                R(f)
               );

    }
    o-=d;
}

*/


//---------------------------------------------------------
// attempt #6: 600+ chars
/*
my attempt at encoding the digits as base-6 single values.
But the unpacking takes way too much code. currently it's broken; seems unviable.

i could try operating on 2 vec2s instead of a single vec4. Unpacking is a pain in the ass
because there are no bitwise ops. So I end up having to use floor(mod()) etc. So the best
encoding will depend on the smallest method of unpacking. Maybe X=ceil and Y=fract*6. or so?

*/
/*
#define X(x,b) floor(mod(x,b))
#define G(x) g.xyxy+.2/vec4(3,5,3,5)*vec4(X(x/36.*6.,6.),X(x/36.,6.),X(x/6.,6.),X(x,6.))
#define E(x) if(X(t,10.) == n++) e=G(x)
#define R(b) (i.x>=b.x&&i.x<b.z&&i.y>=b.y&&i.y<b.w)?1.:-1.
void mainImage(out vec4 o,vec2 i)
{
    o.xyz=iResolution;
    i/=o.xy;
    i.x*=o.x/o.y/.7;
    o*=0.;
    float d = 1., t=iTime, n;
    for(float z=5.;z>0.;--z)
    {
	    vec2 g = vec2(.24*z,.6);
        vec4 e,f=o;// our 2 rects (xy=top left, zw=bottom right)
        n=0.;
        E(268.);
        E(11.),f=G(455.);
        E(124.),f=G(272.);
        E(50.),f=G(124.);
        E(341.),f=G(14.);
        E(50.),f=G(346.);
        E(346.),f=G(266.);
        E(16.);
        E(266.),f=G(340.);
        E(340.),f=G(50.);
        t/=10.;
        d = max(max(
                    min(d, -(R(vec4(g, g+.2)))),
                    R(e)),
                R(f)
               );

    }
    o-=d;
}

*/




//---------------------------------------------------------
// attempt #4: 595 chars
/*
// i = input (uv)
// o = output
// d = distance
// z = loop iterator
// e = rect1
// f = rect2
// g = origin of digit
// k = multiplier temp value
// n = temp variable for testing digit
// s = another temp variable

#define G g.xyxy+.2/vec4(3,5,3,5)*vec4
#define E if(floor(mod(t,10.)) == n++) e=G
#define F f=G
#define R(b) (i.x>=b.x&&i.x<b.z&&i.y>=b.y&&i.y<b.w)?1.:-1.
void mainImage(out vec4 o,vec2 i)
{
    o.xyz=iResolution;
    i/=o.xy;
    i.x*=o.x/o.y*1.2;
    i.y=1.-i.y;
    o*=0.;

    float d = 1., t=iTime, n;
    
    for(float z=5.;z>0.;--z)
    {
	    vec2 g = vec2(.24*z,.2);
        vec4 e,// our 2 rects (xy=top left, zw=bottom right)
            f=o;

        n=0.;
        E(1,1,2,4);
        E(0,0,1,5), F(2,0,3,5);
        E(0,1,2,2), F(1,3,3,4);
        E(0,1,2,2), F(0,3,2,4);
        E(1,0,2,2), F(0,3,2,5);
        E(1,1,3,2), F(0,3,2,4);
        E(1,1,3,2), F(1,3,2,4);
        E(0,1,2,5);
        E(1,1,2,2), F(1,3,2,4);
        E(1,1,2,2), F(0,3,2,5);
        t/=10.;

        d = max(max(
                    min(d, -(R(vec4(g, g+.2)))),
                    R(e)),
                R(f)
               );

    }
    o-=d;
}


*/




//---------------------------------------------------------
// attempt #3: 653 chars
/*
// d = distance
// o = output
// i = input (uv)
// z = loop iterator
// e = rect1
// f = rect2
// g = origin of digit
// k = multiplier temp value
// n = temp variable for testing digit

#define G vec4(g,g)+.2/vec4(3,5,3,5)*vec4
#define E if(floor(mod(t,10.)) == n++) e=G
#define F f=G
float R(vec2 d, vec4 b)
{
    d=max(b.xy-d,d-b.zw);
    return length(max(d-d, d)) + min(0.,max(d.x,d.y));
}

void mainImage(out vec4 o,vec2 i)
{
    float d = 1e9, t=iTime, n;
    o.xyz=iResolution;
    i/=o.xy;
    i.x*=o.x/o.y*1.2;
    i.y=1.-i.y;

    for(float z=5.;z>0.;--z)
    {
	    vec2 g = vec2(.24*z,.2);
        vec4 e,f=o;// safe because iResolution is always big enough that this will be off-screen.

        n=0.;
        E(1,1,2,4);
        E(0,0,1,5), F(2,0,3,5);
        E(0,1,2,2), F(1,3,3,4);
        E(0,1,2,2), F(0,3,2,4);
        E(1,0,2,2), F(0,3,2,5);
        E(1,1,3,2), F(0,3,2,4);
        E(1,1,3,2), F(1,3,2,4);
        E(0,1,2,5);
        E(1,1,2,2), F(1,3,2,4);
        E(1,1,2,2), F(0,3,2,5);
        t/=10.;

        d = max(
            max(
                min(d, R(i, vec4(g, g+.2))),
                -R(i,e)),
            -R(i,f));

    }
    o = vec4(i,i*i)* step(0.,-d);
}


*/


//---------------------------------------------------------
// attempt #2: 695 chars
/*

float R(vec2 d, vec4 b)
{
    d=max(b.xy-d,d-b.zw);
    return length(max(d-d, d)) + min(0.,max(d.x,d.y));
}
// d = distance
// o = output
// i = input (uv)
// z = loop iterator
// e = rect1
// f = rect2
// v = digit value
// g = origin of digit
// k = multiplier temp value

#define E if(v == n++) e=vec4(g,g)+k*vec4
#define F f=k*vec4
#define O 1,1// to save chars you need to use a 3-char #define 7 times.

void mainImage(out vec4 o,vec2 i)
{
    float d = 1e9, t = iTime, v,n;
    o.xyz=iResolution;
    i/=o.xy;i.x*=o.x/o.y;
    i.y=1.-i.y;
    o=o-o;

    for(float z=0.;z<4.;++z)
    {
        v = floor(mod(t,10.));
        t/=10.;
	    vec2 g = vec2(.24 * (5.-z), .3);

        vec4 e,
            f=o,
            k=.2/vec4(3,5,3,5);

        n=0.;
        E(O,1,3);
        E(0,0,1,5), F(2,0,1,5);
        E(0,1,2,1), F(1,3,2,1);
        E(0,1,2,1), F(0,3,2,1);
        E(1,0,1,2), F(0,3,2,2);
        E(O,2,1), F(0,3,2,1);
        E(O,2,1), F(1,3,1,1);
        E(0,1,2,4);
        E(O,1,1), F(1,3,1,1);
        E(O,1,1), F(0,3,2,2);

        e.zw += e.xy;
        f.zw += f.xy;
//        e += vec4(g,g);
  //      f += vec4(g,g);
        
        d = max(
            max(
                min(d, R(i, vec4(g, g + .2))),
                -R(i,e)),
            -R(i,f));

    }
    o = mix(vec4(i,i*i),o, step(0.,d));
}

*/





//---------------------------------------------------------
// original: 1245 chars.
/*
float opS( float d2, float d1 ){ return max(-d1,d2); }

float sdr(vec2 uv, vec2 tl, vec2 br)
{
    vec2 d = max(tl-uv, uv-br);
    return length(max(vec2(0.0), d)) + min(0.0, max(d.x, d.y));
}

void mainImage(out vec4 o,vec2 i)
{
    float d = 1e9;
    float t = iTime;
    o.xyz=iResolution;
    i/=o.xy;i.x*=o.x/o.y;
    i.y=1.-i.y;
    o=o-o;
    vec2 digitSize = vec2(.2,.3);
    vec4 color = vec4(i,i*i);

    for(float z=0.;z<5.;++z)
    {
        float v = floor(mod(t,10.));
        vec4 rect1=o,rect2=o;
        if(v == 1.)
            rect1=vec4(0,0,1,5), rect2=vec4(2,0,1,5);
        if(v == 2.)
            rect1=vec4(0,1,2,1), rect2=vec4(1,3,2,1);
        if(v == 3.)
            rect1=vec4(0,1,2,1), rect2=vec4(0,3,2,1);
        if(v == 4.)
            rect1=vec4(1,0,1,2), rect2=vec4(0,3,2,2);
        if(v == 5.)
            rect1=vec4(1,1,2,1), rect2=vec4(0,3,2,1);
        if(v == 6.)
            rect1=vec4(1,1,2,1), rect2=vec4(1,3,1,1);
        if(v == 7.)
            rect1=vec4(0,1,2,4);
        if(v == 8.)
            rect1=vec4(1,1,1,1), rect2=vec4(1,3,1,1);
        if(v == 9.)
            rect1=vec4(1,1,1,1), rect2=vec4(0,3,2,2);
        if(v == 0.)
            rect1=vec4(1,1,1,3);

        vec2 origin = vec2((digitSize.x + .05) * (5.-z), 0);
        origin.y += 0.3;// offset on screen.
        
        rect1 *= vec4(digitSize,digitSize)/vec4(3,5,3,5);
        rect2 *= vec4(digitSize,digitSize)/vec4(3,5,3,5);

        rect1.zw += rect1.xy;
        rect2.zw += rect2.xy;
        rect1 += vec4(origin,origin);
        rect2 += vec4(origin,origin);
        
        d = min(d,sdr(i, origin, origin + digitSize));
        d = opS(d, sdr(i, rect1.xy,rect1.zw));
        d = opS(d, sdr(i, rect2.xy,rect2.zw));

        t/=10.;
    }
        o = mix(color,o, step(0.,d));
}
*/

`;

export default class implements iSub {
  key(): string {
    return 'MlfXz8';
  }
  name(): string {
    return 'Time-o-matic';
  }
  sort() {
    return 156;
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
}
