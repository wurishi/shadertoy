import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
// Created by David Gallardo - xjorma/2020
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0

const float dissipation 	= 0.95;

const float ballRadius		= 0.06;
const float fogHeigth		= ballRadius * 4.;
const int	nbSlice			= 24;
const float fogSlice		= fogHeigth / float(nbSlice);
const int	nbSphere 		= 3;
const float shadowDensity 	= 25.;
const float fogDensity 		= 20.;
const float lightHeight     = 1.;

const float tau =  radians(360.);

float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

vec4 hash41(float p)
{
	vec4 p4 = fract(vec4(p) * vec4(.1031, .1030, .0973, .1099));
    p4 += dot(p4, p4.wzxy+33.33);
    return fract((p4.xxyz+p4.yzzw)*p4.zywx);
    
}

vec2 rotate(float angle, float radius)
{
    return vec2(cos(angle),-sin(angle)) * radius;
}

bool floorIntersect(in vec3 ro, in vec3 rd, in float floorHeight, out float t) 
{
    ro.y -= floorHeight;
    if(rd.y < -0.01)
    {
        t = ro.y / - rd.y;
        return true;
    }
    return false;
} 

// https://www.iquilezles.org/www/articles/intersectors/intersectors.htm

vec2 sphIntersect( in vec3 ro, in vec3 rd, in vec3 ce, float ra )
{
    vec3 oc = ro - ce;
    float b = dot( oc, rd );
    float c = dot( oc, oc ) - ra*ra;
    float h = b*b - c;
    if( h<0.0 ) return vec2(-1.0); // no intersection
    h = sqrt( h );
    return vec2( -b-h, -b+h );
}


// https://www.iquilezles.org/www/articles/boxfunctions/boxfunctions.htm

vec2 boxIntersection( in vec3 ro, in vec3 rd, in vec3 rad, in vec3 center,out vec3 oN ) 
{
    ro -= center;
    vec3 m = 1.0/rd;
    vec3 n = m*ro;
    vec3 k = abs(m)*rad;
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;

    float tN = max( max( t1.x, t1.y ), t1.z );
    float tF = min( min( t2.x, t2.y ), t2.z );
	
    if( tN>tF || tF<0.0) return vec2(-1.0); // no intersection
    
    oN = -sign(rd)*step(t1.yzx,t1.xyz)*step(t1.zxy,t1.xyz);

    return vec2( tN, tF );
}

vec2 spherePosition(int id, int frame)
{
    vec4 offset = hash41(float(id)) * tau;
    float fframe = float(frame);
    return vec2(cos(offset.x + fframe * 0.015) + cos(offset.y + fframe * 0.020), cos(offset.z + fframe * 0.017) + cos(offset.w + fframe * 0.022)) * vec2(1., 0.5) * 0.9;
}

float dist2(vec3 v)
{
    return dot(v, v);
}`;

const buffA = `
// Created by David Gallardo - xjorma/2020
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0


float noise(vec3 p)
{
	vec3 ip=floor(p);
    p-=ip; 
    vec3 s=vec3(7,157,113);
    vec4 h=vec4(0.,s.yz,s.y+s.z)+dot(ip,s);
    p=p*p*(3.-2.*p); 
    h=mix(fract(sin(h)*43758.5),fract(sin(h+s.x)*43758.5),p.x);
    h.xy=mix(h.xz,h.yw,p.y);
    return mix(h.x,h.y,p.z); 
}

vec2 fbm(vec3 p, int octaveNum)
{
	vec2 acc = vec2(0);	
	float freq = 1.0;
	float amp = 0.5;
    vec3 shift = vec3(100);
	for (int i = 0; i < octaveNum; i++)
	{
		acc += vec2(noise(p), noise(p + vec3(0,0,10))) * amp;
        p = p * 2.0 + shift;
        amp *= 0.5;
	}
	return acc;
}


vec3 sampleMinusGradient(vec2 coord)
{
    vec3	veld	= texture(iChannel1, coord / iResolution.xy).xyz;
    float	left	= texture(iChannel0,(coord + vec2(-1, 0)) / iResolution.xy).x;
    float	right	= texture(iChannel0,(coord + vec2( 1, 0)) / iResolution.xy).x;
    float	bottom	= texture(iChannel0,(coord + vec2( 0,-1)) / iResolution.xy).x;
    float	top 	= texture(iChannel0,(coord + vec2( 0, 1)) / iResolution.xy).x;
    vec2	grad 	= vec2(right - left,top - bottom) * 0.5;
    return	vec3(veld.xy - grad, veld.z);
}

vec3 vignette(vec3 color, vec2 q, float v)
{
    color *= mix(1., pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), v), 0.02);
    return color;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	// Euler advection
    vec2	velocity = sampleMinusGradient(fragCoord).xy;
    vec3	veld = sampleMinusGradient(fragCoord - dissipation * velocity).xyz;
    float	density = veld.z;
    velocity = veld.xy;

    vec2	uv = (2. * fragCoord - iResolution.xy) / iResolution.y;
    // Small perturbation
    vec2 detailNoise = fbm(vec3(uv*40., iTime * 0.5 + 30.), 7) - 0.5;
    velocity += detailNoise * 0.2;
    density += length(detailNoise) * 0.01;
    
    // Injection
    vec2 injectionNoise = fbm(vec3(uv *1.5, iTime * 0.1 + 30.), 7) - 0.5;
    velocity += injectionNoise * 0.1;
    density += max((length(injectionNoise) * 0.04), 0.);

    // Inject emiter
    float influenceRadius = ballRadius * 2.;
    for(int i = 0 ; i < nbSphere ; i++)
    {
        vec2 p = spherePosition(i, iFrame);
        float dist = distance(uv, p);
        if(dist < influenceRadius)
        {
            vec2 op = spherePosition(i, iFrame + 1);
            vec2 ballVelocity = p - op; 
            density -= ((influenceRadius - dist) / influenceRadius) * 0.15;
            density = max(0., density);
         	velocity -= ballVelocity * 5.;   
        }
        
    }	    
    density = min(1., density);
    density *= 0.99;     // damp
    veld = vec3(vec3(velocity, density));
    veld = vignette(veld, fragCoord / iResolution.xy, 1.);
    fragColor = vec4(veld, 1);
}
`;

const buffB = `
// Created by David Gallardo - xjorma/2020
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0

// Divergence

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    ivec2 icoord = ivec2(fragCoord);
    float vel_x_left	= texelFetch(iChannel0, icoord + ivec2(-1,  0) , 0).x;
    float vel_x_right	= texelFetch(iChannel0, icoord + ivec2( 1,  0) , 0).x;
    float vel_y_bottom	= texelFetch(iChannel0, icoord + ivec2( 0, -1) , 0).y;
    float vel_y_top		= texelFetch(iChannel0, icoord + ivec2( 0,  1) , 0).y;
    float divergence	= (vel_x_right - vel_x_left + vel_y_top - vel_y_bottom) * 0.5;
    fragColor = vec4(divergence,vec3(1)); 
}`;

const buffC = `
// Created by David Gallardo - xjorma/2020
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0

// Pressure solver 1st interation

// Since in shadertoy we don't have countless pass we need to do many pass at once.


// code generated by :
/*
#include <iostream>

const int tabSize = 48;

std::int64_t divTab[tabSize][tabSize];
std::int64_t preTab[tabSize][tabSize];


void recurse(int x, int y, int level)
{
    level--;
    divTab[x][y] += std::int64_t(1) << std::int64_t(level * 2);
    if (level)
    {
        recurse(x - 1, y, level);
        recurse(x + 1, y, level);
        recurse(x, y - 1, level);
        recurse(x, y + 1, level);
    }
    else
    {
        preTab[x - 1][y]++;
        preTab[x + 1][y]++;
        preTab[x][y - 1]++;
        preTab[x][y + 1]++;
    }
}

void clear(std::int64_t (&tab)[tabSize][tabSize])
{
    for (int x = 0; x < tabSize; x++)
    {
        for (int y = 0; y < tabSize; y++)
        {
            tab[x][y] = 0;
        }
    }
}

void output(const char *functionName, std::int64_t(&tab)[tabSize][tabSize], std::int64_t multiplier)
{
    std::int64_t total = 0;
    for (int x = 0; x < tabSize; x++)
    {
        for (int y = 0; y < tabSize; y++)
        {
            if (tab[x][y])
            {
                total += tab[x][y];
                std::cout << "\tp += " << tab[x][y] << ".*" << functionName << "(" << x - tabSize / 2 << ", " << y - tabSize / 2 << ");\n";
            }
        }
    }
    total *= multiplier;
    std::cout << "\treturn\tp / " << total << ".;\n";
}

int main()
{
    clear(divTab);
    clear(preTab);
    recurse(tabSize / 2, tabSize / 2, 10);
    output("div", divTab, 2);
    output("pre", preTab, 1);
}
*/

float div(int x,int y)
{
    return texelFetch(iChannel1, ivec2(gl_FragCoord.xy) + ivec2(x,  y) , 0).x;
}

float getDiv( void )
{
    float p = 0.;
    p += 1.*div(-9, 0);
    p += 9.*div(-8, -1);
    p += 4.*div(-8, 0);
    p += 9.*div(-8, 1);
    p += 36.*div(-7, -2);
    p += 32.*div(-7, -1);
    p += 97.*div(-7, 0);
    p += 32.*div(-7, 1);
    p += 36.*div(-7, 2);
    p += 84.*div(-6, -3);
    p += 112.*div(-6, -2);
    p += 436.*div(-6, -1);
    p += 320.*div(-6, 0);
    p += 436.*div(-6, 1);
    p += 112.*div(-6, 2);
    p += 84.*div(-6, 3);
    p += 126.*div(-5, -4);
    p += 224.*div(-5, -3);
    p += 1092.*div(-5, -2);
    p += 1280.*div(-5, -1);
    p += 2336.*div(-5, 0);
    p += 1280.*div(-5, 1);
    p += 1092.*div(-5, 2);
    p += 224.*div(-5, 3);
    p += 126.*div(-5, 4);
    p += 126.*div(-4, -5);
    p += 280.*div(-4, -4);
    p += 1694.*div(-4, -3);
    p += 2752.*div(-4, -2);
    p += 6656.*div(-4, -1);
    p += 6464.*div(-4, 0);
    p += 6656.*div(-4, 1);
    p += 2752.*div(-4, 2);
    p += 1694.*div(-4, 3);
    p += 280.*div(-4, 4);
    p += 126.*div(-4, 5);
    p += 84.*div(-3, -6);
    p += 224.*div(-3, -5);
    p += 1694.*div(-3, -4);
    p += 3520.*div(-3, -3);
    p += 11016.*div(-3, -2);
    p += 16128.*div(-3, -1);
    p += 24608.*div(-3, 0);
    p += 16128.*div(-3, 1);
    p += 11016.*div(-3, 2);
    p += 3520.*div(-3, 3);
    p += 1694.*div(-3, 4);
    p += 224.*div(-3, 5);
    p += 84.*div(-3, 6);
    p += 36.*div(-2, -7);
    p += 112.*div(-2, -6);
    p += 1092.*div(-2, -5);
    p += 2752.*div(-2, -4);
    p += 11016.*div(-2, -3);
    p += 21664.*div(-2, -2);
    p += 47432.*div(-2, -1);
    p += 59712.*div(-2, 0);
    p += 47432.*div(-2, 1);
    p += 21664.*div(-2, 2);
    p += 11016.*div(-2, 3);
    p += 2752.*div(-2, 4);
    p += 1092.*div(-2, 5);
    p += 112.*div(-2, 6);
    p += 36.*div(-2, 7);
    p += 9.*div(-1, -8);
    p += 32.*div(-1, -7);
    p += 436.*div(-1, -6);
    p += 1280.*div(-1, -5);
    p += 6656.*div(-1, -4);
    p += 16128.*div(-1, -3);
    p += 47432.*div(-1, -2);
    p += 92224.*div(-1, -1);
    p += 163476.*div(-1, 0);
    p += 92224.*div(-1, 1);
    p += 47432.*div(-1, 2);
    p += 16128.*div(-1, 3);
    p += 6656.*div(-1, 4);
    p += 1280.*div(-1, 5);
    p += 436.*div(-1, 6);
    p += 32.*div(-1, 7);
    p += 9.*div(-1, 8);
    p += 1.*div(0, -9);
    p += 4.*div(0, -8);
    p += 97.*div(0, -7);
    p += 320.*div(0, -6);
    p += 2336.*div(0, -5);
    p += 6464.*div(0, -4);
    p += 24608.*div(0, -3);
    p += 59712.*div(0, -2);
    p += 163476.*div(0, -1);
    p += 409744.*div(0, 0);
    p += 163476.*div(0, 1);
    p += 59712.*div(0, 2);
    p += 24608.*div(0, 3);
    p += 6464.*div(0, 4);
    p += 2336.*div(0, 5);
    p += 320.*div(0, 6);
    p += 97.*div(0, 7);
    p += 4.*div(0, 8);
    p += 1.*div(0, 9);
    p += 9.*div(1, -8);
    p += 32.*div(1, -7);
    p += 436.*div(1, -6);
    p += 1280.*div(1, -5);
    p += 6656.*div(1, -4);
    p += 16128.*div(1, -3);
    p += 47432.*div(1, -2);
    p += 92224.*div(1, -1);
    p += 163476.*div(1, 0);
    p += 92224.*div(1, 1);
    p += 47432.*div(1, 2);
    p += 16128.*div(1, 3);
    p += 6656.*div(1, 4);
    p += 1280.*div(1, 5);
    p += 436.*div(1, 6);
    p += 32.*div(1, 7);
    p += 9.*div(1, 8);
    p += 36.*div(2, -7);
    p += 112.*div(2, -6);
    p += 1092.*div(2, -5);
    p += 2752.*div(2, -4);
    p += 11016.*div(2, -3);
    p += 21664.*div(2, -2);
    p += 47432.*div(2, -1);
    p += 59712.*div(2, 0);
    p += 47432.*div(2, 1);
    p += 21664.*div(2, 2);
    p += 11016.*div(2, 3);
    p += 2752.*div(2, 4);
    p += 1092.*div(2, 5);
    p += 112.*div(2, 6);
    p += 36.*div(2, 7);
    p += 84.*div(3, -6);
    p += 224.*div(3, -5);
    p += 1694.*div(3, -4);
    p += 3520.*div(3, -3);
    p += 11016.*div(3, -2);
    p += 16128.*div(3, -1);
    p += 24608.*div(3, 0);
    p += 16128.*div(3, 1);
    p += 11016.*div(3, 2);
    p += 3520.*div(3, 3);
    p += 1694.*div(3, 4);
    p += 224.*div(3, 5);
    p += 84.*div(3, 6);
    p += 126.*div(4, -5);
    p += 280.*div(4, -4);
    p += 1694.*div(4, -3);
    p += 2752.*div(4, -2);
    p += 6656.*div(4, -1);
    p += 6464.*div(4, 0);
    p += 6656.*div(4, 1);
    p += 2752.*div(4, 2);
    p += 1694.*div(4, 3);
    p += 280.*div(4, 4);
    p += 126.*div(4, 5);
    p += 126.*div(5, -4);
    p += 224.*div(5, -3);
    p += 1092.*div(5, -2);
    p += 1280.*div(5, -1);
    p += 2336.*div(5, 0);
    p += 1280.*div(5, 1);
    p += 1092.*div(5, 2);
    p += 224.*div(5, 3);
    p += 126.*div(5, 4);
    p += 84.*div(6, -3);
    p += 112.*div(6, -2);
    p += 436.*div(6, -1);
    p += 320.*div(6, 0);
    p += 436.*div(6, 1);
    p += 112.*div(6, 2);
    p += 84.*div(6, 3);
    p += 36.*div(7, -2);
    p += 32.*div(7, -1);
    p += 97.*div(7, 0);
    p += 32.*div(7, 1);
    p += 36.*div(7, 2);
    p += 9.*div(8, -1);
    p += 4.*div(8, 0);
    p += 9.*div(8, 1);
    p += 1.*div(9, 0);
    return  p / 1048576.;
}

float pre(int x,int y)
{
    return texelFetch(iChannel3, ivec2(gl_FragCoord.xy) + ivec2(x,  y) , 0).x;
}

float getPre( void )
{
    float p = 0.;
    p += 1.*pre(-10, 0);
    p += 10.*pre(-9, -1);
    p += 10.*pre(-9, 1);
    p += 45.*pre(-8, -2);
    p += 100.*pre(-8, 0);
    p += 45.*pre(-8, 2);
    p += 120.*pre(-7, -3);
    p += 450.*pre(-7, -1);
    p += 450.*pre(-7, 1);
    p += 120.*pre(-7, 3);
    p += 210.*pre(-6, -4);
    p += 1200.*pre(-6, -2);
    p += 2025.*pre(-6, 0);
    p += 1200.*pre(-6, 2);
    p += 210.*pre(-6, 4);
    p += 252.*pre(-5, -5);
    p += 2100.*pre(-5, -3);
    p += 5400.*pre(-5, -1);
    p += 5400.*pre(-5, 1);
    p += 2100.*pre(-5, 3);
    p += 252.*pre(-5, 5);
    p += 210.*pre(-4, -6);
    p += 2520.*pre(-4, -4);
    p += 9450.*pre(-4, -2);
    p += 14400.*pre(-4, 0);
    p += 9450.*pre(-4, 2);
    p += 2520.*pre(-4, 4);
    p += 210.*pre(-4, 6);
    p += 120.*pre(-3, -7);
    p += 2100.*pre(-3, -5);
    p += 11340.*pre(-3, -3);
    p += 25200.*pre(-3, -1);
    p += 25200.*pre(-3, 1);
    p += 11340.*pre(-3, 3);
    p += 2100.*pre(-3, 5);
    p += 120.*pre(-3, 7);
    p += 45.*pre(-2, -8);
    p += 1200.*pre(-2, -6);
    p += 9450.*pre(-2, -4);
    p += 30240.*pre(-2, -2);
    p += 44100.*pre(-2, 0);
    p += 30240.*pre(-2, 2);
    p += 9450.*pre(-2, 4);
    p += 1200.*pre(-2, 6);
    p += 45.*pre(-2, 8);
    p += 10.*pre(-1, -9);
    p += 450.*pre(-1, -7);
    p += 5400.*pre(-1, -5);
    p += 25200.*pre(-1, -3);
    p += 52920.*pre(-1, -1);
    p += 52920.*pre(-1, 1);
    p += 25200.*pre(-1, 3);
    p += 5400.*pre(-1, 5);
    p += 450.*pre(-1, 7);
    p += 10.*pre(-1, 9);
    p += 1.*pre(0, -10);
    p += 100.*pre(0, -8);
    p += 2025.*pre(0, -6);
    p += 14400.*pre(0, -4);
    p += 44100.*pre(0, -2);
    p += 63504.*pre(0, 0);
    p += 44100.*pre(0, 2);
    p += 14400.*pre(0, 4);
    p += 2025.*pre(0, 6);
    p += 100.*pre(0, 8);
    p += 1.*pre(0, 10);
    p += 10.*pre(1, -9);
    p += 450.*pre(1, -7);
    p += 5400.*pre(1, -5);
    p += 25200.*pre(1, -3);
    p += 52920.*pre(1, -1);
    p += 52920.*pre(1, 1);
    p += 25200.*pre(1, 3);
    p += 5400.*pre(1, 5);
    p += 450.*pre(1, 7);
    p += 10.*pre(1, 9);
    p += 45.*pre(2, -8);
    p += 1200.*pre(2, -6);
    p += 9450.*pre(2, -4);
    p += 30240.*pre(2, -2);
    p += 44100.*pre(2, 0);
    p += 30240.*pre(2, 2);
    p += 9450.*pre(2, 4);
    p += 1200.*pre(2, 6);
    p += 45.*pre(2, 8);
    p += 120.*pre(3, -7);
    p += 2100.*pre(3, -5);
    p += 11340.*pre(3, -3);
    p += 25200.*pre(3, -1);
    p += 25200.*pre(3, 1);
    p += 11340.*pre(3, 3);
    p += 2100.*pre(3, 5);
    p += 120.*pre(3, 7);
    p += 210.*pre(4, -6);
    p += 2520.*pre(4, -4);
    p += 9450.*pre(4, -2);
    p += 14400.*pre(4, 0);
    p += 9450.*pre(4, 2);
    p += 2520.*pre(4, 4);
    p += 210.*pre(4, 6);
    p += 252.*pre(5, -5);
    p += 2100.*pre(5, -3);
    p += 5400.*pre(5, -1);
    p += 5400.*pre(5, 1);
    p += 2100.*pre(5, 3);
    p += 252.*pre(5, 5);
    p += 210.*pre(6, -4);
    p += 1200.*pre(6, -2);
    p += 2025.*pre(6, 0);
    p += 1200.*pre(6, 2);
    p += 210.*pre(6, 4);
    p += 120.*pre(7, -3);
    p += 450.*pre(7, -1);
    p += 450.*pre(7, 1);
    p += 120.*pre(7, 3);
    p += 45.*pre(8, -2);
    p += 100.*pre(8, 0);
    p += 45.*pre(8, 2);
    p += 10.*pre(9, -1);
    p += 10.*pre(9, 1);
    p += 1.*pre(10, 0);
    return  p / 1048576.;
}

void mainImage( out vec4 fragColor, in vec2 C )
{
    float div = getDiv();
    float p = getPre() - div;
    fragColor = vec4(p, div, vec3(1));
}
`;

const buffD = `
float div(int x,int y)
{
    return texelFetch(iChannel0, ivec2(gl_FragCoord.xy) + ivec2(x,  y) , 0).y;
}

float pre(int x,int y)
{
    return texelFetch(iChannel0, ivec2(gl_FragCoord.xy) + ivec2(x,  y) , 0).x;
}

float getPre( void )
{
    float p = 0.;
    p += 1.*pre(-10, 0);
    p += 10.*pre(-9, -1);
    p += 10.*pre(-9, 1);
    p += 45.*pre(-8, -2);
    p += 100.*pre(-8, 0);
    p += 45.*pre(-8, 2);
    p += 120.*pre(-7, -3);
    p += 450.*pre(-7, -1);
    p += 450.*pre(-7, 1);
    p += 120.*pre(-7, 3);
    p += 210.*pre(-6, -4);
    p += 1200.*pre(-6, -2);
    p += 2025.*pre(-6, 0);
    p += 1200.*pre(-6, 2);
    p += 210.*pre(-6, 4);
    p += 252.*pre(-5, -5);
    p += 2100.*pre(-5, -3);
    p += 5400.*pre(-5, -1);
    p += 5400.*pre(-5, 1);
    p += 2100.*pre(-5, 3);
    p += 252.*pre(-5, 5);
    p += 210.*pre(-4, -6);
    p += 2520.*pre(-4, -4);
    p += 9450.*pre(-4, -2);
    p += 14400.*pre(-4, 0);
    p += 9450.*pre(-4, 2);
    p += 2520.*pre(-4, 4);
    p += 210.*pre(-4, 6);
    p += 120.*pre(-3, -7);
    p += 2100.*pre(-3, -5);
    p += 11340.*pre(-3, -3);
    p += 25200.*pre(-3, -1);
    p += 25200.*pre(-3, 1);
    p += 11340.*pre(-3, 3);
    p += 2100.*pre(-3, 5);
    p += 120.*pre(-3, 7);
    p += 45.*pre(-2, -8);
    p += 1200.*pre(-2, -6);
    p += 9450.*pre(-2, -4);
    p += 30240.*pre(-2, -2);
    p += 44100.*pre(-2, 0);
    p += 30240.*pre(-2, 2);
    p += 9450.*pre(-2, 4);
    p += 1200.*pre(-2, 6);
    p += 45.*pre(-2, 8);
    p += 10.*pre(-1, -9);
    p += 450.*pre(-1, -7);
    p += 5400.*pre(-1, -5);
    p += 25200.*pre(-1, -3);
    p += 52920.*pre(-1, -1);
    p += 52920.*pre(-1, 1);
    p += 25200.*pre(-1, 3);
    p += 5400.*pre(-1, 5);
    p += 450.*pre(-1, 7);
    p += 10.*pre(-1, 9);
    p += 1.*pre(0, -10);
    p += 100.*pre(0, -8);
    p += 2025.*pre(0, -6);
    p += 14400.*pre(0, -4);
    p += 44100.*pre(0, -2);
    p += 63504.*pre(0, 0);
    p += 44100.*pre(0, 2);
    p += 14400.*pre(0, 4);
    p += 2025.*pre(0, 6);
    p += 100.*pre(0, 8);
    p += 1.*pre(0, 10);
    p += 10.*pre(1, -9);
    p += 450.*pre(1, -7);
    p += 5400.*pre(1, -5);
    p += 25200.*pre(1, -3);
    p += 52920.*pre(1, -1);
    p += 52920.*pre(1, 1);
    p += 25200.*pre(1, 3);
    p += 5400.*pre(1, 5);
    p += 450.*pre(1, 7);
    p += 10.*pre(1, 9);
    p += 45.*pre(2, -8);
    p += 1200.*pre(2, -6);
    p += 9450.*pre(2, -4);
    p += 30240.*pre(2, -2);
    p += 44100.*pre(2, 0);
    p += 30240.*pre(2, 2);
    p += 9450.*pre(2, 4);
    p += 1200.*pre(2, 6);
    p += 45.*pre(2, 8);
    p += 120.*pre(3, -7);
    p += 2100.*pre(3, -5);
    p += 11340.*pre(3, -3);
    p += 25200.*pre(3, -1);
    p += 25200.*pre(3, 1);
    p += 11340.*pre(3, 3);
    p += 2100.*pre(3, 5);
    p += 120.*pre(3, 7);
    p += 210.*pre(4, -6);
    p += 2520.*pre(4, -4);
    p += 9450.*pre(4, -2);
    p += 14400.*pre(4, 0);
    p += 9450.*pre(4, 2);
    p += 2520.*pre(4, 4);
    p += 210.*pre(4, 6);
    p += 252.*pre(5, -5);
    p += 2100.*pre(5, -3);
    p += 5400.*pre(5, -1);
    p += 5400.*pre(5, 1);
    p += 2100.*pre(5, 3);
    p += 252.*pre(5, 5);
    p += 210.*pre(6, -4);
    p += 1200.*pre(6, -2);
    p += 2025.*pre(6, 0);
    p += 1200.*pre(6, 2);
    p += 210.*pre(6, 4);
    p += 120.*pre(7, -3);
    p += 450.*pre(7, -1);
    p += 450.*pre(7, 1);
    p += 120.*pre(7, 3);
    p += 45.*pre(8, -2);
    p += 100.*pre(8, 0);
    p += 45.*pre(8, 2);
    p += 10.*pre(9, -1);
    p += 10.*pre(9, 1);
    p += 1.*pre(10, 0);
    return  p / 1048576.;
}

void mainImage( out vec4 fragColor, in vec2 C )
{ 
    float p = getPre() - div(0,0);
    fragColor = vec4(p,vec3(1));
}`;

const fragment = `
// Created by David Gallardo - xjorma/2020
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0

#define RENDER3D	1

#if  RENDER3D

#define AA 0

float sceneIntersection(in vec3 ro,in vec3 rd, out vec3 inter, out vec3 normal, out vec3 color, in float dist, out vec3 lightPos)
{
    float mint = dist;
    inter = vec3(0);
    normal = vec3(0);
    color = vec3(0);
   	// Spheres
    for(int i = 0 ; i < nbSphere ; i++)
    {
        vec2 p2d = spherePosition(i, iFrame);
		vec3 pos = vec3(p2d.x, ballRadius, p2d.y);
        vec3 ballColor = vec3(1, 0, 0);
        if( i == 0)
        {
            ballColor = vec3(1);
            lightPos = pos + vec3(0, lightHeight, 0);
        }

        float t = sphIntersect( ro, rd, pos, ballRadius).x;
        if(t > 0. && t < mint)
        {
            mint = t;
            inter = (ro + mint * rd);
            normal = normalize(inter - pos);
            color = ballColor;
        }     
    }

    // Floor
    {
        float aspecRatio = iResolution.x / iResolution.y;  
        vec3 boxNormal;
    	float t = boxIntersection(ro, rd, vec3(aspecRatio,0.1,1), vec3(0,-0.1,0),boxNormal).x;
        if(t > 0. && t < mint)
        {
            mint = t;
            inter = (ro + mint * rd);
			normal = boxNormal;
            ivec2 tileId = ivec2(vec2(inter.x, inter.z) * 3. + 100.);
            color = ((tileId.x & 1) ^ (tileId.y & 1)) == 0 ? vec3(0.3) : vec3(0.15);  
        }       
    }
	return mint;
}

float sampleFog(in vec3 pos)
{
    vec2 uv = pos.xz;
    uv.x *= iResolution.y / iResolution.x;
    uv = uv * 0.5 + 0.5;
    if(max(uv.x, uv.y) > 1. || min(uv.x, uv.y) < 0.)
    {
        return 0.;
    }
    return texture(iChannel0, uv).z;
}

vec3 Render(in vec3 ro,in vec3 rd,in float dist, float fudge)
{
    vec3  inter;
    vec3  normal;
    vec3  baseColor; 
    vec3  lightPos;
    float mint = sceneIntersection(ro, rd, inter, normal, baseColor, dist, lightPos);
    
    vec3 color = vec3(0);

    
    if(mint<dist)
    {
        vec3 lightDir = normalize(lightPos - inter);
        float lightDist2 = dist2(lightPos - inter);
        vec3 shadowStep = (fogHeigth / float(nbSlice)) * lightDir / lightDir.y;
        float shadowDist = 0.;
        for(int i = 0 ; i < nbSlice ; i++)
        {
            vec3 shadowPos = inter + shadowStep * float(i);
            float v = sampleFog(shadowPos) * fogHeigth;
            shadowDist += min(max(0., v - shadowPos.y), fogSlice) * length(shadowStep) / fogSlice;
        }
        float shadowFactor = exp(-shadowDist * shadowDensity * 0.25);
        color = baseColor * (max(0., dot(normal, lightDir) * shadowFactor) + 0.2) / lightDist2;
    }
    else
    {
        color = vec3(0);
    }
    

    // Compute Fog
	float t;
    if(floorIntersect(ro, rd, fogHeigth, t))
    {
        vec3 curPos = ro + rd * t;
        vec3 fogStep = (fogHeigth / float(nbSlice)) * rd / abs(rd.y);
        curPos += fudge * fogStep;  // fix banding issue
        float stepLen = length(fogStep);
        float curDensity = 0.;
        float transmittance = 1.;
        float lightEnergy = 0.;
        for(int i = 0; i < nbSlice; i++)
        {
            if( dot(curPos - ro, rd) > mint)
                break;
            float curHeigth = sampleFog(curPos) * fogHeigth;
            float curSample = min(max(0., curHeigth - curPos.y), fogSlice) * stepLen / fogSlice;
            if(curSample > 0.001)
            {
                vec3 lightDir = normalize(lightPos - curPos);
                vec3 shadowStep = (fogHeigth / float(nbSlice)) * lightDir / lightDir.y;
                float lightDist2 = dist2(lightPos - curPos);
                vec3 shadowPos = curPos + shadowStep * fudge;
                float shadowDist = 0.;

                for (int j = 0; j < nbSlice; j++)
                {
                    shadowPos += shadowStep;
                    if(shadowPos.y > fogHeigth)
                    {
                        break;
                    }
                    float curHeight = sampleFog(shadowPos) * fogHeigth;
             		shadowDist += min(max(0., curHeight - shadowPos.y), fogSlice) * length(shadowStep) / fogSlice;
               }

                
            	float shadowFactor = exp(-shadowDist * shadowDensity) / lightDist2;
                curDensity = curSample * fogDensity;
                float absorbedlight =  shadowFactor * (1. * curDensity);
                lightEnergy += absorbedlight * transmittance;
                transmittance *= 1. - curDensity;	
            }
            curPos+= fogStep;       
        }
        color = mix(color, vec3(lightEnergy), 1. - transmittance);
    }  
    
    
    return color;
}

vec3 vignette(vec3 color, vec2 q, float v)
{
    color *= 0.3 + 0.8 * pow(16.0 * q.x * q.y * (1.0 - q.x) * (1.0 - q.y), v);
    return color;
}

mat3 setCamera( in vec3 ro, in vec3 ta )
{
	vec3 cw = normalize(ta-ro);
	vec3 up = vec3(0, 1, 0);
	vec3 cu = normalize( cross(cw,up) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
	vec3 tot = vec3(0.0);
        
#if AA
	vec2 rook[4];
    rook[0] = vec2( 1./8., 3./8.);
    rook[1] = vec2( 3./8.,-1./8.);
    rook[2] = vec2(-1./8.,-3./8.);
    rook[3] = vec2(-3./8., 1./8.);
    for( int n=0; n<4; ++n )
    {
        // pixel coordinates
        vec2 o = rook[n];
        vec2 p = (-iResolution.xy + 2.0*(fragCoord+o))/iResolution.y;
#else //AA
        vec2 p = (-iResolution.xy + 2.0*fragCoord)/iResolution.y;
#endif //AA
 
        // camera       
        float theta	= radians(360.)*(iMouse.x/iResolution.x-0.5) - radians(90.);
        float phi	= -radians(30.);
        vec3 ro = 2. * vec3( sin(phi)*cos(theta),cos(phi),sin(phi)*sin(theta));
        vec3 ta = vec3( 0 );
        // camera-to-world transformation
        mat3 ca = setCamera( ro, ta );
        
        vec3 rd =  ca*normalize(vec3(p,1.5));        
        
        vec3 col = Render(ro ,rd, 6., hash12(fragCoord + iTime));
        

        tot += col;
            
#if AA
    }
    tot /= 4.;
#endif
	tot = vignette(tot, fragCoord / iResolution.xy, 0.6);
	fragColor = vec4( sqrt(tot), 1.0 );
}
	
#else	// RENDER3D 
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //fragColor = vec4(texelFetch(iChannel0, ivec2(fragCoord), 0).xy, 0, 1);
    fragColor = vec4(vec3(texelFetch(iChannel0, ivec2(fragCoord), 0).z), 1);
}
#endif	// RENDER3D
`;

export default class implements iSub {
  key(): string {
    return 'WlVyRV';
  }
  name(): string {
    return 'Dry ice 2';
  }
  webgl() {
    return WEBGL_2;
  }
  // sort() {
  //   return 0;
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
  channels() {
    return [
      { type: 1, f: buffA, fi: 0 }, //
      { type: 1, f: buffB, fi: 1 }, //
      { type: 1, f: buffC, fi: 2 }, //
      { type: 1, f: buffD, fi: 3 }, //
    ];
  }
}
