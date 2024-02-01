import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const f = `
#define MAX_DIGIT 2
#define FLOAT_PRECISION 2
#define SLIDER_LENGTH 128.
#define WIDGET_COLOR vec3(.3,1.,.3)

/* global var */  vec4  col = vec4(0.); vec2 pos = vec2(0.);  vec2 uv = vec2(0.);
/* char sprite */ vec4 ch_spc = vec4(0x000000,0x000000,0x000000,0x000000); vec4 ch_exc = vec4(0x003078,0x787830,0x300030,0x300000); vec4 ch_quo = vec4(0x006666,0x662400,0x000000,0x000000); vec4 ch_hsh = vec4(0x006C6C,0xFE6C6C,0x6CFE6C,0x6C0000); vec4 ch_dol = vec4(0x30307C,0xC0C078,0x0C0CF8,0x303000); vec4 ch_pct = vec4(0x000000,0xC4CC18,0x3060CC,0x8C0000); vec4 ch_amp = vec4(0x0070D8,0xD870FA,0xDECCDC,0x760000); vec4 ch_apo = vec4(0x003030,0x306000,0x000000,0x000000); vec4 ch_lbr = vec4(0x000C18,0x306060,0x603018,0x0C0000); vec4 ch_rbr = vec4(0x006030,0x180C0C,0x0C1830,0x600000); vec4 ch_ast = vec4(0x000000,0x663CFF,0x3C6600,0x000000); vec4 ch_crs = vec4(0x000000,0x18187E,0x181800,0x000000); vec4 ch_com = vec4(0x000000,0x000000,0x000038,0x386000); vec4 ch_dsh = vec4(0x000000,0x0000FE,0x000000,0x000000); vec4 ch_per = vec4(0x000000,0x000000,0x000038,0x380000); vec4 ch_lsl = vec4(0x000002,0x060C18,0x3060C0,0x800000); vec4 ch_0 = vec4(0x007CC6,0xD6D6D6,0xD6D6C6,0x7C0000); vec4 ch_1 = vec4(0x001030,0xF03030,0x303030,0xFC0000); vec4 ch_2 = vec4(0x0078CC,0xCC0C18,0x3060CC,0xFC0000); vec4 ch_3 = vec4(0x0078CC,0x0C0C38,0x0C0CCC,0x780000); vec4 ch_4 = vec4(0x000C1C,0x3C6CCC,0xFE0C0C,0x1E0000); vec4 ch_5 = vec4(0x00FCC0,0xC0C0F8,0x0C0CCC,0x780000); vec4 ch_6 = vec4(0x003860,0xC0C0F8,0xCCCCCC,0x780000); vec4 ch_7 = vec4(0x00FEC6,0xC6060C,0x183030,0x300000); vec4 ch_8 = vec4(0x0078CC,0xCCEC78,0xDCCCCC,0x780000); vec4 ch_9 = vec4(0x0078CC,0xCCCC7C,0x181830,0x700000); vec4 ch_col = vec4(0x000000,0x383800,0x003838,0x000000); vec4 ch_scl = vec4(0x000000,0x383800,0x003838,0x183000); vec4 ch_les = vec4(0x000C18,0x3060C0,0x603018,0x0C0000); vec4 ch_equ = vec4(0x000000,0x007E00,0x7E0000,0x000000); vec4 ch_grt = vec4(0x006030,0x180C06,0x0C1830,0x600000); vec4 ch_que = vec4(0x0078CC,0x0C1830,0x300030,0x300000); vec4 ch_ats = vec4(0x007CC6,0xC6DEDE,0xDEC0C0,0x7C0000); vec4 ch_A = vec4(0x003078,0xCCCCCC,0xFCCCCC,0xCC0000); vec4 ch_B = vec4(0x00FC66,0x66667C,0x666666,0xFC0000); vec4 ch_C = vec4(0x003C66,0xC6C0C0,0xC0C666,0x3C0000); vec4 ch_D = vec4(0x00F86C,0x666666,0x66666C,0xF80000); vec4 ch_E = vec4(0x00FE62,0x60647C,0x646062,0xFE0000); vec4 ch_F = vec4(0x00FE66,0x62647C,0x646060,0xF00000); vec4 ch_G = vec4(0x003C66,0xC6C0C0,0xCEC666,0x3E0000); vec4 ch_H = vec4(0x00CCCC,0xCCCCFC,0xCCCCCC,0xCC0000); vec4 ch_I = vec4(0x007830,0x303030,0x303030,0x780000); vec4 ch_J = vec4(0x001E0C,0x0C0C0C,0xCCCCCC,0x780000); vec4 ch_K = vec4(0x00E666,0x6C6C78,0x6C6C66,0xE60000); vec4 ch_L = vec4(0x00F060,0x606060,0x626666,0xFE0000); vec4 ch_M = vec4(0x00C6EE,0xFEFED6,0xC6C6C6,0xC60000); vec4 ch_N = vec4(0x00C6C6,0xE6F6FE,0xDECEC6,0xC60000); vec4 ch_O = vec4(0x00386C,0xC6C6C6,0xC6C66C,0x380000); vec4 ch_P = vec4(0x00FC66,0x66667C,0x606060,0xF00000); vec4 ch_Q = vec4(0x00386C,0xC6C6C6,0xCEDE7C,0x0C1E00); vec4 ch_R = vec4(0x00FC66,0x66667C,0x6C6666,0xE60000); vec4 ch_S = vec4(0x0078CC,0xCCC070,0x18CCCC,0x780000); vec4 ch_T = vec4(0x00FCB4,0x303030,0x303030,0x780000); vec4 ch_U = vec4(0x00CCCC,0xCCCCCC,0xCCCCCC,0x780000); vec4 ch_V = vec4(0x00CCCC,0xCCCCCC,0xCCCC78,0x300000); vec4 ch_W = vec4(0x00C6C6,0xC6C6D6,0xD66C6C,0x6C0000); vec4 ch_X = vec4(0x00CCCC,0xCC7830,0x78CCCC,0xCC0000); vec4 ch_Y = vec4(0x00CCCC,0xCCCC78,0x303030,0x780000); vec4 ch_Z = vec4(0x00FECE,0x981830,0x6062C6,0xFE0000); vec4 ch_lsb = vec4(0x003C30,0x303030,0x303030,0x3C0000); vec4 ch_rsl = vec4(0x000080,0xC06030,0x180C06,0x020000); vec4 ch_rsb = vec4(0x003C0C,0x0C0C0C,0x0C0C0C,0x3C0000); vec4 ch_pow = vec4(0x10386C,0xC60000,0x000000,0x000000); vec4 ch_usc = vec4(0x000000,0x000000,0x000000,0x00FF00); vec4 ch_a = vec4(0x000000,0x00780C,0x7CCCCC,0x760000); vec4 ch_b = vec4(0x00E060,0x607C66,0x666666,0xDC0000); vec4 ch_c = vec4(0x000000,0x0078CC,0xC0C0CC,0x780000); vec4 ch_d = vec4(0x001C0C,0x0C7CCC,0xCCCCCC,0x760000); vec4 ch_e = vec4(0x000000,0x0078CC,0xFCC0CC,0x780000); vec4 ch_f = vec4(0x00386C,0x6060F8,0x606060,0xF00000); vec4 ch_g = vec4(0x000000,0x0076CC,0xCCCC7C,0x0CCC78); vec4 ch_h = vec4(0x00E060,0x606C76,0x666666,0xE60000); vec4 ch_i = vec4(0x001818,0x007818,0x181818,0x7E0000); vec4 ch_j = vec4(0x000C0C,0x003C0C,0x0C0C0C,0xCCCC78); vec4 ch_k = vec4(0x00E060,0x60666C,0x786C66,0xE60000); vec4 ch_l = vec4(0x007818,0x181818,0x181818,0x7E0000); vec4 ch_m = vec4(0x000000,0x00FCD6,0xD6D6D6,0xC60000); vec4 ch_n = vec4(0x000000,0x00F8CC,0xCCCCCC,0xCC0000); vec4 ch_o = vec4(0x000000,0x0078CC,0xCCCCCC,0x780000); vec4 ch_p = vec4(0x000000,0x00DC66,0x666666,0x7C60F0); vec4 ch_q = vec4(0x000000,0x0076CC,0xCCCCCC,0x7C0C1E); vec4 ch_r = vec4(0x000000,0x00EC6E,0x766060,0xF00000); vec4 ch_s = vec4(0x000000,0x0078CC,0x6018CC,0x780000); vec4 ch_t = vec4(0x000020,0x60FC60,0x60606C,0x380000); vec4 ch_u = vec4(0x000000,0x00CCCC,0xCCCCCC,0x760000); vec4 ch_v = vec4(0x000000,0x00CCCC,0xCCCC78,0x300000); vec4 ch_w = vec4(0x000000,0x00C6C6,0xD6D66C,0x6C0000); vec4 ch_x = vec4(0x000000,0x00C66C,0x38386C,0xC60000); vec4 ch_y = vec4(0x000000,0x006666,0x66663C,0x0C18F0); vec4 ch_z = vec4(0x000000,0x00FC8C,0x1860C4,0xFC0000); vec4 ch_lpa = vec4(0x001C30,0x3060C0,0x603030,0x1C0000); vec4 ch_bar = vec4(0x001818,0x181800,0x181818,0x180000); vec4 ch_rpa = vec4(0x00E030,0x30180C,0x183030,0xE00000); vec4 ch_tid = vec4(0x0073DA,0xCE0000,0x000000,0x000000); vec4 ch_lar = vec4(0x000000,0x10386C,0xC6C6FE,0x000000);
#define _a  col += vec4( char(ch_a) );
#define _b  col += vec4( char(ch_b) );
#define _c  col += vec4( char(ch_c) );
#define _d  col += vec4( char(ch_d) );
#define _e  col += vec4( char(ch_e) );
#define _f  col += vec4( char(ch_f) );
#define _g  col += vec4( char(ch_g) );
#define _h  col += vec4( char(ch_h) );
#define _i  col += vec4( char(ch_i) );
#define _j  col += vec4( char(ch_j) );
#define _k  col += vec4( char(ch_k) );
#define _l  col += vec4( char(ch_l) );
#define _m  col += vec4( char(ch_m) );
#define _n  col += vec4( char(ch_n) );
#define _o  col += vec4( char(ch_o) );
#define _p  col += vec4( char(ch_p) );
#define _q  col += vec4( char(ch_q) );
#define _r  col += vec4( char(ch_r) );
#define _s  col += vec4( char(ch_s) );
#define _t  col += vec4( char(ch_t) );
#define _u  col += vec4( char(ch_u) );
#define _v  col += vec4( char(ch_v) );
#define _w  col += vec4( char(ch_w) );
#define _x  col += vec4( char(ch_x) );
#define _y  col += vec4( char(ch_y) );
#define _z  col += vec4( char(ch_z) );
#define _A  col += vec4( char(ch_A) );
#define _B  col += vec4( char(ch_B) );
#define _C  col += vec4( char(ch_C) );
#define _D  col += vec4( char(ch_D) );
#define _E  col += vec4( char(ch_E) );
#define _F  col += vec4( char(ch_F) );
#define _G  col += vec4( char(ch_G) );
#define _H  col += vec4( char(ch_H) );
#define _I  col += vec4( char(ch_I) );
#define _J  col += vec4( char(ch_J) );
#define _K  col += vec4( char(ch_K) );
#define _L  col += vec4( char(ch_L) );
#define _M  col += vec4( char(ch_M) );
#define _N  col += vec4( char(ch_N) );
#define _O  col += vec4( char(ch_O) );
#define _P  col += vec4( char(ch_P) );
#define _Q  col += vec4( char(ch_Q) );
#define _R  col += vec4( char(ch_R) );
#define _S  col += vec4( char(ch_S) );
#define _T  col += vec4( char(ch_T) );
#define _U  col += vec4( char(ch_U) );
#define _V  col += vec4( char(ch_V) );
#define _W  col += vec4( char(ch_W) );
#define _X  col += vec4( char(ch_X) );
#define _Y  col += vec4( char(ch_Y) );
#define _Z  col += vec4( char(ch_Z) );
#define _spc  col += vec4( char(ch_spc) );
#define _float(a)  col += vec4(print_float(a));
#define _int(a)  col += vec4(print_int(a));
#define _slider(x,y,id,v) setCursor(x,y);print_slider(id,v);
#define _color(x,y,id,v) setCursor(x,y);print_color(id,v);
#define _box(p,s,c) print_box(p,s,c);
#define _cursor(x,y)  setCursor(x,y);
/* gfx func */ void setCursor(int x, int y){pos = vec2(float(x),iResolution.y-float(y));}float extract_bit(float n, float b){    b = clamp(b,-1.0,24.0);    return floor(mod(floor(n / pow(2.0,floor(b))),2.0));   }float sprite(vec4 spr, vec2 size, vec2 uv){    uv = floor(uv);    float bit = (size.x-uv.x-1.0) + uv.y * size.x;    bool bounds = all(greaterThanEqual(uv,vec2(0))) && all(lessThan(uv,size));        float pixels = 0.0;    pixels += extract_bit(spr.x, bit - 72.0);    pixels += extract_bit(spr.y, bit - 48.0);    pixels += extract_bit(spr.z, bit - 24.0);    pixels += extract_bit(spr.w, bit - 00.0);        return bounds ? pixels : 0.0;}float char(vec4 ch){    float px = sprite(ch, vec2(8, 12), uv - pos);    pos.x += 8.;    return px;}vec4 get_digit(float d){    d = floor(d);    if(d == 0.0) return ch_0;    if(d == 1.0) return ch_1;    if(d == 2.0) return ch_2;    if(d == 3.0) return ch_3;    if(d == 4.0) return ch_4;    if(d == 5.0) return ch_5;    if(d == 6.0) return ch_6;    if(d == 7.0) return ch_7;    if(d == 8.0) return ch_8;    if(d == 9.0) return ch_9;    return ch_0;}float print_float(float number){    float result = 0.0;        for(int i = MAX_DIGIT-1; i >= -FLOAT_PRECISION;i--)    {        float digit = mod( number / pow(10.0, float(i)) , 10.0);                if(i == -1)        {            result += char(ch_per);        }                if((abs(number) > pow(10.0, float(i))) || i <= 0)        {            result += char(get_digit(digit));        }    }     return result;}float print_int(float number){    float result = 0.0;        for(int i = MAX_DIGIT;i >= 0;i--)    {        float digit = mod( number / pow(10.0, float(i)) , 10.0);        if(abs(number) > pow(10.0, float(i)) || i == 0)        {            result += char(get_digit(digit));        }    }       return result;}vec3 hsv2rgb( in vec3 c ){vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );rgb = rgb*rgb*(3.0-2.0*rgb);return c.z * mix( vec3(1.0), rgb, c.y);}vec3 widgetSelected(){    return texture(iChannel0, vec2(.5,2.5)/iResolution.xy).rgb;}vec4 uiSlider(int id){return texture(iChannel0, vec2(float(id)+.5,0.5)/iResolution.xy);}vec4 uiColor(int id){return texture(iChannel0, vec2(float(id)+.5,1.5)/iResolution.xy);}float roundBox( in vec2 p, in vec2 b, in float r ) {    vec2 q = abs(p) - b;    vec2 m = vec2( min(q.x,q.y), max(q.x,q.y) );    float d = (m.x > 0.0) ? length(q) : m.y;     return d - r;}void print_slider( int id, float v ){    vec2 puv = uv-vec2(.5);    vec3 select = widgetSelected();    float sl2 = SLIDER_LENGTH/2.;    vec4 value = uiSlider(id);    if(value.a == 0.)        value.r = v;        bool selected = ( select.r == .1 && select.g*255. == float(id) );    bool mouseAndNoSelect = iMouse.w>.5 && roundBox( iMouse.xy-pos-vec2(sl2,6.), vec2(sl2,3.), 5.) < 0. && select.r == 0.;         if(mouseAndNoSelect || selected)    	value.r = clamp((iMouse.x-pos.x-2.)/SLIDER_LENGTH,0.,1.);    float d = roundBox( uv-pos-vec2(sl2,6.), vec2(sl2,3.), 5.);    float layer = clamp(sign(-d),0.,1.);    col.rgb += vec3((clamp( 1.3-abs(d) , 0., 2.))*max(.0,-sign(uv.x-pos.x-value.r*SLIDER_LENGTH))*.5 );    col.rgb += WIDGET_COLOR*vec3( clamp( 1.-abs(d)*.75 , 0., 1.) );    col.a += layer + clamp( 1.-abs(d) , 0., 1.);        float oldx = pos.x;    pos.x += SLIDER_LENGTH-8.*4.;    _float(value.r)    pos.x = oldx;        if(puv.x == float(id) && puv.y==0.)        col = vec4(value.r,0.,0.,1.);        if(puv.x == 0. && puv.y == 2.)    {        if(iMouse.w<.5)            col = vec4(0.);        else if(mouseAndNoSelect)        	col = vec4(.1,float(id)/255.,0.,0.);    }}void print_color( int id, vec3 v){    vec2 puv = uv-vec2(.5);    vec3 select = widgetSelected();    float sl2 = SLIDER_LENGTH/2.;    vec4 color = uiColor(id);    if(color.a == 0.)        color.rgb = v;        bool selected = ( select.r == .2 && select.g*255. == float(id) );    bool mouseAndNoSelect = iMouse.w>.5 && roundBox( iMouse.xy-pos-vec2(sl2,6.), vec2(sl2,3.), 5.) < 0. && select.r == 0.;         if(mouseAndNoSelect || selected)    	color.rgb = hsv2rgb( vec3( (iMouse.x-pos.x)/(SLIDER_LENGTH*.9),1.,1.) );    float d = roundBox( uv-pos-vec2(sl2,6.), vec2(sl2,3.), 5.);    float layer = clamp(sign(-d),0.,1.);    col.rgb += vec3( layer*color*max(.0,sign(uv.x-pos.x-SLIDER_LENGTH*.9)));    col.rgb += WIDGET_COLOR*vec3( clamp( 1.-abs(d)*.75 , 0., 1.) );    col.a += layer + clamp( 1.-abs(d) , 0., 1.);        if((mouseAndNoSelect || selected) && uv.x-pos.x-SLIDER_LENGTH*.9<0.)        col.rgb += layer*hsv2rgb( vec3( (uv.x-pos.x)/(SLIDER_LENGTH*.9),1.,1.) );            if(puv.x == float(id) && puv.y==1.)        col = vec4(color.rgb,1.);        if(puv.x == 0. && puv.y == 2.)    {        if(iMouse.w<.5)            col = vec4(0.);        else if(mouseAndNoSelect)        	col = vec4(.2,float(id)/255.,0.,0.);    }}void print_box(vec2 p, vec2 s, vec4 c){    if(uv.x>p.x && uv.x <p.x+s.x && uv.y>p.y && uv.y<p.y+s.y)        col += c;}


//FUNCTIONS :
// _cursor(x,y) : define the cursor (0,0) == top-left
// _slider(x,y,id,v) : define a slider at the position x,y with an ID and a default value float v
// _color(x,y,id,v) : define a color picker at the position x,y with an ID and a default value vec3 v
// _box(x,y,sx,sy,c) : define a layout box at the position x,y with the size sx,sy and a color vec4 c
//_[a..Z] : write a character at the position of the cursor
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    uv = fragCoord.xy;
    if(uv.x-.5 == 0. && uv.y-.5 == 2.)
        col = vec4(widgetSelected(),0.);
    
    _box(vec2(10,10),vec2(148,iResolution.y-20.),vec4(0.,0.,0.,.25))
        
    float t = mod(iTime,10.);
    int jump = int( abs(cos(t*7.))/exp(t*2.)*30. );
    _cursor(42,30-jump) _B _l _a _b _l _a _b _l _a
    _slider(20,50, 0, .75) _R _o _u _g _h _n _e _s _s
    _slider(20,80, 1, 0.) _M _e _t _a _l _l _i _c
    _color (20,110, 0, vec3(1.,.7,.0)) _M _a _t _e _r _i _a _l _spc  _c _o _l _o _r
    
    fragColor = min(col.rgba,1.);
}
`;

const fragment = `
//Only what you need in your shaders to get the IU inputs
float uiSlider(int id){return texture(iChannel0, vec2(float(id)+.5,0.5)/iResolution.xy).r;}
vec3 uiColor(int id){return texture(iChannel0, vec2(float(id)+.5,1.5)/iResolution.xy).rgb;}

vec3 sampleEnvMap(vec3 rd, float lod);
float ambientOcclusion( in vec3 p, in vec3 n, float maxDist, float falloff );
vec3 doBumpMap( sampler2D tex, in vec3 p, in vec3 nor, float bumpfactor);
vec3 shade( in vec3 p, in vec3 n, in vec3 ro, in vec3 rd, vec2 v )
{
    //Get the slider here!
    float roughness = uiSlider(0);
    float metallic = uiSlider(1);
    
    
    float d = length(ro-p);
    
    vec3 col = vec3(0.);
    if(d>30.)
        return sampleEnvMap(-rd,.9)*2.;
    
    n = doBumpMap(iChannel1, p*.25, n, .05);
    
    float ao = clamp( pow( ambientOcclusion(p,n,.5,1.), 20.)*5., 0., 1.);
    float fre = clamp(1.0+dot(n,rd), 0.0, 1.0 );
        
    vec3 diff = mix(sampleEnvMap(-n,roughness).rgb, vec3(1.), roughness);
    vec3 spec = sampleEnvMap(-reflect(rd,n),roughness).rgb;
    
    //Get the color here!
    col = (uiColor(0)*.3+.7) * mix(diff*ao,spec, min(1., metallic+fre) );
	return col;
}



vec3 raymarche( in vec3 ro, in vec3 rd, in vec2 nfplane );
vec3 normal( in vec3 p );
float map( in vec3 p );

mat3 lookat( in vec3 fw, in vec3 up );
mat3 rotate( in vec3 v, in float angle);
void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    
	vec2 q = fragCoord.xy/iResolution.xy;
	vec2 v = -1.0+2.0*q;
	v.x *= iResolution.x/iResolution.y;
	
	float ctime = (iTime)*.1;
	vec3 ro = vec3( cos(ctime)*5., 0., sin(ctime)*5. );
	vec3 rd = normalize( vec3(v.x, v.y, 1.5) );
	rd = lookat( -ro + vec3(0., 0., 0.), vec3(0., 1., 0.) ) * rd;
	
	vec3 p = raymarche(ro, rd, vec2(1., 100.) );
	vec3 n = normal(p.xyz);
	vec3 col = shade(p, n, ro, rd, q);
	
    col = pow(col, vec3(1./2.2));
    col = clamp(col,0.,1.) * (.5 + .5*pow( q.x*q.y*(1.-q.x)*(1.-q.y)*50., .5));
    
    //UI integration
    vec4 ui = texture(iChannel0,q);
    col = mix(col,ui.rgb, ui.a*.8);
        
	fragColor = vec4( col, 1. );
}



//From Shane
float tex3D( sampler2D tex, in vec3 p, in vec3 n ){
  
    n = max((abs(n) - 0.2)*7., 0.001); // max(abs(n), 0.001), etc.
    n /= (n.x + n.y + n.z );  
    
	return (texture(tex, p.yz)*n.x + texture(tex, p.zx)*n.y + texture(tex, p.xy)*n.z).x;
}
vec3 doBumpMap( sampler2D tex, in vec3 p, in vec3 nor, float bumpfactor){
   
    const float eps = 0.001;
    float ref = tex3D(tex,  p , nor);                 
    vec3 grad = vec3( tex3D(tex, vec3(p.x-eps, p.y, p.z), nor)-ref,
                      tex3D(tex, vec3(p.x, p.y-eps, p.z), nor)-ref,
                      tex3D(tex, vec3(p.x, p.y, p.z-eps), nor)-ref )/eps;
             
    grad -= nor*dot(nor, grad);          
                      
    return normalize( nor + grad*bumpfactor );
	
}

//From iq
vec3 deform( vec3 p )
{
    p.xyz += 1.000*sin(  2.0*p.zxy );
    p.xyz += 0.500*sin(  4.0*p.zxy );
    p.xyz += 0.250*sin(  8.0*p.zxy );
    return p;
}
    
float map( in vec3 p )
{
	float d = length(deform(p))-1.5;
	
	return d*.1;
}

float roundBox( in vec2 p, in vec2 b, in float r ) 
{
    vec2 q = abs(p) - b;
    vec2 m = vec2( min(q.x,q.y), max(q.x,q.y) );
    float d = (m.x > 0.0) ? length(q) : m.y; 
    return d - r;
}


const float PI = 3.14159265359;
vec3 sampleEnvMap(vec3 rd, float lod)
{
    vec2 uv = vec2(atan(rd.z,rd.x),acos(rd.y));
    uv = fract(uv/vec2(2.0*PI,PI));
    
    vec3 col = vec3(0.,0.05*cos(uv.x)+0.05, .1*sin(uv.y)+.1)*1.;
    
    float r = (1.-pow(lod,.5))*1000.+5.;
    col += vec3(1.)* clamp( pow(1.-roundBox(uv-vec2(.5), vec2(.05,.05),.01),r), 0., 1.);
    col += vec3(1.)* clamp( pow(1.-roundBox(uv-vec2(.67,.5), vec2(.05,.05),.01),r), 0., 1.);
    col += vec3(1.)* clamp( pow(1.-roundBox(uv-vec2(.67,.67), vec2(.05,.05),.01),r), 0., 1.);
    col += vec3(1.)* clamp( pow(1.-roundBox(uv-vec2(.5,.67), vec2(.05,.05),.01),r), 0., 1.);
    col += vec3(1.,.5,.1)*2. * clamp( pow(1.-roundBox(uv-vec2(.3,.7), vec2(.01,.01),.2),r), 0., 1.);
    
    return min(col*(1.-lod*.8),vec3(1.));
}


float hash( float n )//->0:1
{
    return fract(sin(n)*3538.5453);
}
vec3 randomSphereDir(vec2 rnd)
{
	float s = rnd.x*PI*2.;
	float t = rnd.y*2.-1.;
	return vec3(sin(s), cos(s), t) / sqrt(1.0 + t * t);
}
vec3 randomHemisphereDir(vec3 dir, float i)
{
	vec3 v = randomSphereDir( vec2(hash(i+1.), hash(i+2.)) );
	return v * sign(dot(v, dir));
}

float ambientOcclusion( in vec3 p, in vec3 n, float maxDist, float falloff )
{
	const int nbIte = 32;
    const float nbIteInv = 1./float(nbIte);
    const float rad = 1.-1.*nbIteInv; //Hemispherical factor (self occlusion correction)
    
	float ao = 0.0;
    
    for( int i=0; i<nbIte; i++ )
    {
        float l = hash(float(i))*maxDist;
        vec3 rd = normalize(n+randomHemisphereDir(n, l )*rad)*l; // mix direction with the normal
        													    // for self occlusion problems!
        
        ao += (l - map( p + rd )) / pow(1.+l, falloff);
    }
	
    return clamp( 1.-ao*nbIteInv, 0., 1.);
}

vec3 raymarche( in vec3 ro, in vec3 rd, in vec2 nfplane )
{
	vec3 p = ro+rd*nfplane.x;
	float t = 0.;
	for(int i=0; i<1256; i++)
	{
        float d = map(p);
        t += d;
        p += rd*d;
		if( t > nfplane.y )
            break;
            
	}
	
	return p;
}
vec3 normal( in vec3 p )
{
	vec3 eps = vec3(0.0001, 0.0, 0.0);
	return normalize( vec3(
		map(p+eps.xyy)-map(p-eps.xyy),
		map(p+eps.yxy)-map(p-eps.yxy),
		map(p+eps.yyx)-map(p-eps.yyx)
	) );
}



mat3 lookat( in vec3 fw, in vec3 up )
{
	fw = normalize(fw);
	vec3 rt = normalize( cross(fw, normalize(up)) );
	return mat3( rt, cross(rt, fw), fw );
}

`;

export default class implements iSub {
  key(): string {
    return 'ldKSDm';
  }
  name(): string {
    return 'UI easy to integrate';
  }
  webgl() {
    return WEBGL_2;
  }
  sort() {
    return 445;
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
      { type: 1, f, fi: 0 }, //
      webglUtils.TEXTURE2,
    ];
  }
}
