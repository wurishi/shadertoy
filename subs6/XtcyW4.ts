import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
// [SH18] Human Document. Created by Reinder Nijhoff 2018
// @reindernijhoff
//
// https://www.shadertoy.com/view/XtcyW4
//
//   * Created for the Shadertoy Competition 2018 *
//

// animation

#define FRAMES (760.)
#define DURATION_ANIM (FRAMES/60.)
#define DURATION_START (4.)
#define DURATION_END (4.)
#define DURATION_MORPH_ANIM (.5)
#define DURATION_MORPH_STILL (.5)
#define DURATION_MORPH (DURATION_MORPH_ANIM+DURATION_MORPH_STILL)
#define DURATION_TOTAL (DURATION_START+DURATION_ANIM+DURATION_END)

float frame;

float offsetTime(float time) {
    return max(0., time-2.);
}

void initAnimation(float time) {
    float t = mod(offsetTime(time), DURATION_TOTAL);
    frame = floor(clamp((t-DURATION_START)*60., 10., FRAMES-10.));
}

// bone functions

const float planeY = -9.5;

#define NUM_BONES 14

#define LEFT_LEG_1 3
#define LEFT_LEG_2 4
#define LEFT_LEG_3 5
#define RIGHT_LEG_1 0
#define RIGHT_LEG_2 1
#define RIGHT_LEG_3 2
#define LEFT_ARM_1 10
#define LEFT_ARM_2 11
#define LEFT_ARM_3 12
#define RIGHT_ARM_1 7
#define RIGHT_ARM_2 6
#define RIGHT_ARM_3 8
#define SPINE 13
#define HEAD 9

// render functions

#define MAT_TABLE    1.
#define MAT_PENCIL_0 2.
#define MAT_PENCIL_1 3.
#define MAT_PENCIL_2 4.
#define MAT_PAPER    5.
#define MAT_METAL_0  6.

#define PENCIL_POS vec3(-0.8,-0.2, -2.3)
#define PENCIL_ROT .95
#define PAPER_SIZE (vec2(1.95, 2.75)*1.1)

// http://www.johndcook.com/blog/2010/01/20/how-to-compute-the-soft-maximum/
float smin(in float a, in float b, const in float k) { return a - log(1.0+exp(k*(a-b))) * (1. / k); }

float opS( const float d1, const float d2 ) {
    return max(-d1,d2);
}

vec2 rotate( in vec2 p, const float t ) {
    float co = cos(t);
    float si = sin(t);
    return mat2(co,-si,si,co) * p;
}

float sdSphere( const vec3 p, const vec4 s ) {
    return distance(p,s.xyz)-s.w;
}

float sdBox( vec3 p, vec3 b ) {
    vec3 d = abs(p) - b;
    return min(max(d.x,max(d.y,d.z)),0.0) + length(max(d,0.0));
}

float sdCapsule(vec3 p,vec3 o,vec3 e,const float r0,const float r1) {
    vec3 d = e-o;
    float h = length(d);
    d *= (1./h);
    float t=clamp(dot(p-o,d),0.,h);
	vec3 np=o+t*d;
	return distance(np,p)-mix(r0,r1,t);
}

float sdCylinderZY( const vec3 p, const vec2 h ) {
  vec2 d = abs(vec2(length(p.zy),p.x)) - h;
  return min(max(d.x,d.y),0.0) + length(max(d,0.0));
}

float sdHexPrism( const vec3 p, const vec2 h ) {
    vec3 q = abs(p);
#if 0
    return max(q.x-h.y,max((q.z*0.866025+q.y*0.5),q.y)-h.x);
#else
    float d1 = q.x-h.y;
    float d2 = max((q.z*0.866025+q.y*0.5),q.y)-h.x;
    return length(max(vec2(d1,d2),0.0)) + min(max(d1,d2), 0.);
#endif
}

float sdCapsule( const vec3 p, const vec3 a, const vec3 b, const float r ) {
	vec3 pa = p-a, ba = b-a;
	float h = clamp( dot(pa,ba)/dot(ba,ba), 0.0, 1.0 );
	return length( pa - ba*h ) - r;
}

float sdSphere( const vec3 p, const float r ) {
    return length(p) - r;
}

float sdCone( const vec3 p, const vec2 c ) {
    float q = length(p.yz);
    return dot(c,vec2(q,p.x));
}

vec2 sphIntersect( in vec3 ro, in vec3 rd, in float r ) {
	vec3 oc = ro;
	float b = dot( oc, rd );
	float c = dot( oc, oc ) - r * r;
	float h = b*b - c;
	if( h<0.0 ) return vec2(-1.0);
    h = sqrt( h );
	return vec2(-b - h, -b + h);
}

vec2 boxIntersect( in vec3 ro, in vec3 rd, in vec3 rad ) {
    vec3 m = 1.0/rd;
    vec3 n = m*ro;
    vec3 k = abs(m)*rad;
	
    vec3 t1 = -n - k;
    vec3 t2 = -n + k;

	float tN = max( max( t1.x, t1.y ), t1.z );
	float tF = min( min( t2.x, t2.y ), t2.z );
	
	if( tN > tF || tF < 0.0) return vec2(-1);

	return vec2(tN, tF);
}

float planeIntersect( const vec3 ro, const vec3 rd, const float height) {	
	if (rd.y==0.0) return 500.;	
	float d = -(ro.y - height)/rd.y;
	if( d > 0. ) {
		return d;
	}
	return 500.;
}

//
// Material properties.
//

vec4 texNoise( sampler2D sam, in vec3 p, in vec3 n ) {
	vec4 x = texture( sam, p.yz );
	vec4 y = texture( sam, p.zx );
	vec4 z = texture( sam, p.xy );

	return x*abs(n.x) + y*abs(n.y) + z*abs(n.z);
}
`;

const buffA = `
// [SH18] Human Document. Created by Reinder Nijhoff 2018
// @reindernijhoff
//
// https://www.shadertoy.com/view/XtcyW4
//
//   * Created for the Shadertoy Competition 2018 *
// 
// Buffer A: I have preprocessed a (motion captured) animation by taking the Fourier 
//           transform of the position of all bones (14 bones, 760 frames). Only a fraction 
//           of all calculated coefficients are stored in this shader: the first 
//           coefficients with 16 bit precision, later coefficients with 8 bit. The positions
//           of the bones are reconstructed each frame by taking the inverse Fourier
//           transform of this data.
//
//           I have used (part of) an animation from the Carnegie Mellon University Motion 
//           Capture Database. The animations of this database are free to use:
//
//           - http://mocap.cs.cmu.edu/
// 
//           Íñigo Quílez has created some excellent shaders that show the properties of 
//           Fourier transforms, for example: 
//
//           - https://www.shadertoy.com/view/4lGSDw
//           - https://www.shadertoy.com/view/ltKSWD
//


#define HQ 10
#define LQ 13

vec2 cmul(vec2 a, vec2 b) { return vec2(a.x*b.x - a.y*b.y, a.x*b.y + a.y*b.x); }
#define S(q,s,c) (float((q >> s) & 0xFFU)*c.x-c.y)
#define SH(q,s,c) (float((q >> s) & 0xFFFFU)*c.x-c.y)

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    if(int(fragCoord.x) > 0 || int(fragCoord.y) > NUM_BONES) {      
        return;
    }
    
    initAnimation(iTime);
    
	int y = int(fragCoord.y);  
    float s1 = (6.28318530718/FRAMES)*frame;
    vec2 pos = vec2(0);
    vec2 posy = vec2(0);
    
    uint[HQ] hqd;
    uint[LQ] lqd;

    uint[HQ] hqyd;
    uint[LQ] lqyd;
    
    uint[HQ] hqdB;
    uint[LQ] lqdB;
    
    uint[HQ] hqydB;
    uint[LQ] lqydB;

    // scale 
    const vec3 scale = vec3(0.012353025376796722, 0.011576368473470211, 0.025544768199324608); 

    // scale, offset - first coeffs 
    const vec2 ch = vec2(0.014635691419243813, 636.2047119140625); 
    const vec2 cl = vec2(0.39385828375816345, 42.45376205444336); 

    // scale, offset - last coeffs 
    const vec2 chb = vec2(0.003957926761358976, 118.40463256835938);
    const vec2 clb = vec2(0.520740270614624, 58.412567138671875);


    if (y==0) { hqd = uint[10] (0x7f2d8b92U,0xc4f2beaeU,0xbbeaad0eU,0xd070a2e9U,0xb266a557U,0xb19fa162U,0xad6ca7edU,0xb0f7ac1fU,0xb104ac21U,0xb2439bbfU); lqd = uint[13] (0x928a893cU,0x537c793cU,0x6792965bU,0x6466c17aU,0x7748a244U,0x9f628b6bU,0x995b7167U,0x825a6c62U,0x727c6767U,0x84687269U,0x7d709262U,0x74638d50U,0x7b697e68U);}
    if (y==0 || y==1) { hqyd = uint[10] (0x45960000U,0xb649b0efU,0xb91aa98aU,0xafbaa34dU,0xa830a08fU,0xac65a40cU,0xaa63a1d7U,0xa37ca7edU,0xac25a239U,0xaf63ad31U); lqyd = uint[13] (0x1505b2cU,0xac01194U,0xbaae51f4U,0xbe3a7385U,0x953f9568U,0x58757b42U,0x807b6578U,0x26549d61U,0x4e5b634dU,0x646d4f74U,0x7f86567aU,0x9670756fU,0x6770546dU);}
    if (y==1) { hqd = uint[10] (0x6f4585cbU,0xc4a3bce4U,0xb9f2b155U,0xcbc89e17U,0xacdba615U,0xabb69dd9U,0xb168ab59U,0xac9ea649U,0xb314a969U,0xafe2a327U); lqd = uint[13] (0x9e7c8c46U,0x7d645c57U,0x6f636f51U,0x765d9b5cU,0x8e566451U,0x78638e62U,0x705e7169U,0x76697177U,0x7a637c68U,0x7f607767U,0x78607353U,0x736b6f71U,0x7d637f69U);}
    if (y==2) { hqd = uint[10] (0x813a9626U,0xc801c2d1U,0xbf42abe8U,0xcd90a65fU,0xb0e1a15eU,0xaeba9cecU,0xab0fa953U,0xb28fa809U,0xafd4a45bU,0xb0b8a7dbU); lqd = uint[13] (0x90588c2bU,0x6b696944U,0x7c6e7a51U,0x675d995dU,0x7e667b54U,0x6c5e8266U,0x78587967U,0x74607b6fU,0x845c7f68U,0x7d5b7964U,0x775e685cU,0x77676d67U,0x7764706aU);}
    if (y==2 || y==3) { hqyd = uint[10] (0x4838601U,0xaf02a4f0U,0xaba0a4e7U,0xa16a9a56U,0xa0379c04U,0xa68ba99aU,0xa63aab86U,0xa4aca392U,0xa689ab22U,0xa152ac96U); lqyd = uint[13] (0x2150385cU,0x73ff21e2U,0xdaa1b4a2U,0x9e28de0cU,0x37763c06U,0x4e452891U,0x698a7850U,0x2ca4724dU,0x7f9c507cU,0xa15d8184U,0x73599e63U,0x565b504aU,0x5d68695cU);}
    if (y==3) { hqd = uint[10] (0x819db6f2U,0xc5abcc7eU,0xc384a773U,0xc844aa35U,0xb0709d74U,0xa6009fbbU,0xaf9aa9b4U,0xa9f3a8b2U,0xb3a09bf7U,0xafc3ae57U); lqd = uint[13] (0x65464a2bU,0x645c6a55U,0x6e5a8865U,0x5f5db08bU,0x75618131U,0x894c4847U,0x7c577b73U,0x5876615fU,0x6e614d46U,0x92916657U,0x8c6e5a79U,0x785f5d5aU,0x61657e4cU);}
    if (y==4) { hqd = uint[10] (0x7057b74bU,0xc6e5c8f3U,0xc22aab06U,0xc861a366U,0xb0759fd9U,0xa4229de0U,0xb5c7aa1cU,0xa44ba815U,0xb622a03cU,0xad9da952U); lqd = uint[13] (0x7d51642dU,0x77575d78U,0x844c8977U,0x71468a6aU,0x73566a49U,0x7c6c6c59U,0x69767452U,0x6967665eU,0x64526d67U,0x6767846aU,0x636d786aU,0x74677e65U,0x74617163U);}
    if (y==4 || y==5) { hqyd = uint[10] (0x88cd4a5aU,0xb2b7b0e6U,0xb9dbb24eU,0xad0fa4fbU,0xa6ffa074U,0xaca2a79aU,0xa64ea955U,0xa11aac9cU,0xa83dacd4U,0xb306a50dU); lqyd = uint[13] (0xa5a374cU,0x45dc1c98U,0xafb77cb9U,0x8c57db72U,0x81576b48U,0x616a7758U,0x75666467U,0x584e7b6fU,0x69526b59U,0x5a7b4e75U,0x74806075U,0x6f676d7eU,0x66677b6cU);}
    if (y==5) { hqd = uint[10] (0x7fe7b48aU,0xc7f3c61dU,0xc09ba88dU,0xca11a71dU,0xb12fa099U,0xab6da034U,0xad91a571U,0xae72ac1cU,0xb16fa17fU,0xad92a90bU); lqd = uint[13] (0x8454932aU,0x625d7559U,0x7b5b8d64U,0x644e9769U,0x735e765fU,0x6e5a7f6eU,0x775b7465U,0x7263776cU,0x7f637f69U,0x78607e63U,0x70616e57U,0x726a6f66U,0x7566706aU);}
    if (y==6) { hqd = uint[10] (0x797e765dU,0xc9f7c05aU,0xbe9db1b6U,0xd26fa3bcU,0xaad3a0dcU,0xb02297ceU,0xaaa6b166U,0xae69a0b9U,0xaec4a95fU,0xb373a6efU); lqd = uint[13] (0x9a3f535fU,0x82676760U,0x6d7d6f40U,0x6b846236U,0x726b9d59U,0x6252786aU,0x716d7f75U,0x7c797d63U,0x7a667b66U,0x6f647c51U,0x76677467U,0x6f687461U,0x746a735fU);}
    if (y==6 || y==7) { hqyd = uint[10] (0x9ddebb01U,0x9494a957U,0xa223bdd6U,0x9412bad1U,0xa162aebcU,0xc209b52bU,0xb339a79dU,0x9acfa754U,0xa47aaeceU,0xbccab927U); lqyd = uint[13] (0xd876bb65U,0x670ec504U,0x2b333400U,0x2a756964U,0x849f2a9aU,0x6241be66U,0x5583345cU,0x63326785U,0x5d78555eU,0x7aa84298U,0x886ba57dU,0x635b7a4eU,0x6871646eU);}
    if (y==7) { hqd = uint[10] (0x707c816cU,0xc8a2bd56U,0xb894b447U,0xd02e9e32U,0xabe4a20bU,0xad239781U,0xb11aaef1U,0xa637a0c8U,0xb385a979U,0xb4a8a648U); lqd = uint[13] (0x812a6680U,0x9888687aU,0x7263a24fU,0x63886354U,0x7971aa4aU,0x76387a75U,0x76688f7aU,0x6b8d7264U,0x7c638455U,0x8c74784dU,0x88746f6cU,0x7a69785bU,0x7a706b54U);}
    if (y==8) { hqd = uint[10] (0x786185abU,0xccd4c4f2U,0xc299b1a7U,0xd1bda151U,0xacdf9d39U,0xaf0b9a6eU,0xad3caec2U,0xadf1a0ccU,0xb039a7c0U,0xb536a45cU); lqd = uint[13] (0x8f47594aU,0x80576b5cU,0x76696550U,0x85636754U,0x795f8161U,0x71687458U,0x6a72745fU,0x75617e59U,0x76647e67U,0x64627f5bU,0x6c647a61U,0x6e65735fU,0x6b627863U);}
    if (y==8 || y==9) { hqyd = uint[10] (0xffffe30eU,0x8aa3afebU,0x9ac1c8c4U,0x99f2c288U,0xab85b26dU,0xba8eb5d5U,0xadcbae25U,0x9a80a928U,0xa56ab508U,0xbc84b8dcU); lqyd = uint[13] (0xae54b088U,0x752dc82aU,0x27564815U,0x4c7c5e81U,0x85895a8dU,0x5d588573U,0x70755469U,0x595b6a79U,0x7f6a7481U,0x6f6d7173U,0x67687862U,0x666c5f6bU,0x62697471U);}
    if (y==9) { hqd = uint[10] (0x6de79f16U,0xcf64c883U,0xc5c3b1fcU,0xcd459d56U,0xab069cd0U,0xaa239e3eU,0xb50cac41U,0xa4f5a0bcU,0xb25ea61fU,0xb427a28eU); lqd = uint[13] (0x7651566aU,0x8c557a75U,0x855a685fU,0x8f555769U,0x7d587361U,0x84686b50U,0x6c7d6c61U,0x7367745aU,0x70688060U,0x6d6e7d55U,0x706a785fU,0x6b64735eU,0x6d677b61U);}
    if (y==10) { hqd = uint[10] (0x6d23bfd6U,0xd03ec43eU,0xcdc8ad1eU,0xc2ef9dffU,0xaac8a3f1U,0xa63fa2a7U,0xb9e0a3daU,0x9dd2a9d2U,0xb0f1a249U,0xab98a746U); lqd = uint[13] (0x2c5aa46bU,0x768b8969U,0xcd66826fU,0x73586b52U,0x80a36844U,0x775b7f52U,0x6f618e72U,0x9f5e8172U,0x86545463U,0x7f5e6858U,0x846d5d78U,0x85637471U,0x805e6c5cU);}
    if (y==10 || y==11) { hqyd = uint[10] (0xc58eb64bU,0x8e4ca00aU,0x9b52b3b3U,0x9b6fb009U,0xac4bb06bU,0xb4f1b9abU,0xae25aa6dU,0x9eb5a6e5U,0xa7f2b1a6U,0xa99cbbe2U); lqyd = uint[13] (0xc75fc2d3U,0xa51bdd72U,0x6a209613U,0x21596f19U,0x55ac2689U,0xa34aa596U,0x66522a5eU,0xa52b4393U,0x5b499654U,0x299c2b50U,0x788a6991U,0x775b8582U,0x64716960U);}
    if (y==11) { hqd = uint[10] (0x77dcd005U,0xcc81c841U,0xcb2da829U,0xc4b6a5b9U,0xaf569dcaU,0xaa0aa4ceU,0xb38fa1edU,0xa494af97U,0xb1a5a091U,0xadb6a755U); lqd = uint[13] (0x3c74a346U,0x8a729868U,0xab5f956bU,0x7f498158U,0x747f745fU,0x8058715eU,0x72568062U,0x936a836bU,0x82616961U,0x7b546d58U,0x7c606b6aU,0x8263716cU,0x79606958U);}
    if (y==12) { hqd = uint[10] (0x786cc344U,0xcd32cb3fU,0xc7edab4cU,0xca48a2fcU,0xaec49c6cU,0xaad2a2daU,0xb1d2a555U,0xa6fdab44U,0xb231a20fU,0xb0aca64aU); lqd = uint[13] (0x635c7d45U,0x805a8a68U,0x89508165U,0x804e786aU,0x6f5c6f6dU,0x805e6964U,0x776c6d5fU,0x7e687860U,0x7b6d7f67U,0x78627558U,0x73636f60U,0x71656f64U,0x7165755fU);}
    if (y==12 || y==13) { hqyd = uint[10] (0xda14e8ccU,0x92d8a694U,0x9c9cbe57U,0x9be6b744U,0xa953af96U,0xb301b328U,0xabf7ab5fU,0x9bb4a744U,0xa507b50aU,0xb300b446U); lqyd = uint[13] (0x934d939aU,0x85578f73U,0x695a6241U,0x4c647e64U,0x7f8f3e7bU,0x6b627d7aU,0x6e71515fU,0x6d5e6c7bU,0x885c7d7aU,0x58656a61U,0x5d766363U,0x70715e7bU,0x60657d6fU);}
    if (y==13) { hqd = uint[10] (0x7a6fa42aU,0xcbc2c779U,0xc430ad87U,0xcd35a2ebU,0xae879dadU,0xad4b9f22U,0xaee0a953U,0xabdca6b5U,0xb0f2a473U,0xb243a62aU); lqd = uint[13] (0x7f527640U,0x7b577b5bU,0x7e5b7358U,0x7d58745fU,0x735f7767U,0x75617362U,0x736b7060U,0x7a607c61U,0x79668068U,0x715f7b5cU,0x7061725fU,0x70667062U,0x70627664U);}


    if (y==0) { hqdB = uint[10] (0xe21c2f6cU, 0xcb15b85bU, 0x82ac80dbU, 0x84cdc8ffU, 0x4e019d8dU, 0x5248950eU, 0x5fe371bcU, 0x54dd8336U, 0x76639b92U, 0x73ec992eU); lqdB = uint[13] (0x4e9360b6U, 0x428c5087U, 0x64494d75U, 0x4f7d6c6dU, 0x62907478U, 0x7d855a7fU, 0x76845c70U, 0x72847583U, 0x5d8d6986U, 0x5180527dU, 0x5c6c6074U, 0x61767378U, 0x697a647cU);}
    if (y==0 || y==1) { hqydB = uint[10] (0x6546a12eU, 0x54dd93fcU, 0x466e7ab9U, 0x55946828U, 0x67a35c96U, 0x6a6c5743U, 0x6d876a60U, 0x5a9e61f3U, 0x6857718cU, 0x5c81503dU); lqydB = uint[13] (0xb93d7f38U, 0xc1b8dd63U, 0x80b58db8U, 0x407f2a84U, 0x5d534354U, 0x62706571U, 0x4a696289U, 0x6d537247U, 0x87649163U, 0x777f7c6cU, 0x5b696277U, 0x88695c6fU, 0x756e696aU);}
    if (y==1) { hqdB = uint[10] (0xdcf8220dU, 0xecc6cbddU, 0x82ac7569U, 0x8dbdd346U, 0x66a98e0bU, 0x4c3f8cc0U, 0x63777618U, 0x5e0e6fd8U, 0x78309a7dU, 0x6c3f8e24U); lqdB = uint[13] (0x647c41acU, 0x57765776U, 0x8f7b7a6cU, 0x5d846c79U, 0x637b6a76U, 0x6a87697cU, 0x707d647dU, 0x6e7b728fU, 0x6e7e6c7cU, 0x627b6577U, 0x6d7a5f78U, 0x63796b78U, 0x6b7c677bU);}
    if (y==2) { hqdB = uint[10] (0xd64634daU, 0xbc8ebdacU, 0x77979c0cU, 0x7e3fc25dU, 0x5a7a817fU, 0x5de396eaU, 0x5b2b8102U, 0x609b758eU, 0x6f3e8e74U, 0x6fc68268U); lqdB = uint[13] (0x60865b97U, 0x5a804f85U, 0x607a637dU, 0x5e7a6979U, 0x6b7f647aU, 0x617e6774U, 0x65745f74U, 0x6f716d67U, 0x787f7375U, 0x69816d80U, 0x637a617aU, 0x6e736672U, 0x6d766a75U);}
    if (y==2 || y==3) { hqydB = uint[10] (0x98968b51U, 0x980fc32cU, 0x5e4a9a87U, 0x444e89d2U, 0x623f8d16U, 0x721464daU, 0x8076588eU, 0x889173a0U, 0x4daf9a2aU, 0x59886316U); lqydB = uint[13] (0x8613432cU, 0xc260cc23U, 0x94ffc189U, 0x57937a90U, 0x3d72528aU, 0x85745777U, 0x7c98616bU, 0x44773638U, 0x79444851U, 0x9b58a256U, 0x7987967bU, 0x678c6a88U, 0x70616869U);}
    if (y==3) { hqdB = uint[10] (0xdcc13d0dU, 0xcacd9445U, 0x71aab82fU, 0x8208ca49U, 0x62037a7cU, 0x51ada2d7U, 0x5e548418U, 0x619f638eU, 0x77919dd4U, 0x79407ee0U); lqdB = uint[13] (0x487236b7U, 0x515d254eU, 0x4c846f3bU, 0x9658a077U, 0x7775678aU, 0x54904955U, 0x77868677U, 0x6f75796bU, 0x606e4f76U, 0x6f70586dU, 0x716a7761U, 0x73687d6fU, 0x6e757178U);}
    if (y==4) { hqdB = uint[10] (0xce06441eU, 0xec54ad8fU, 0x63909693U, 0x87a2be3bU, 0x6b877b00U, 0x3f1a984bU, 0x69387c8cU, 0x59756896U, 0x80189390U, 0x70cc7fb0U); lqdB = uint[13] (0x54793798U, 0x5a5f494dU, 0x7c7c864dU, 0x737b8a7dU, 0x6f80787dU, 0x60705b6fU, 0x77777a94U, 0x6d7a707cU, 0x69746c6dU, 0x62776e73U, 0x6d72727bU, 0x74716d74U, 0x6e7c6e73U);}
    if (y==4 || y==5) { hqydB = uint[10] (0x5b8386e7U, 0x76897e06U, 0x50de6100U, 0x5ae0634aU, 0x79736ee5U, 0x775566d9U, 0x5e1d6035U, 0x7fdb6206U, 0x7cb3671dU, 0x74826a90U); lqydB = uint[13] (0xb7336153U, 0x9490b86fU, 0x60b983b9U, 0x3e483d7bU, 0x7f5e775dU, 0x64686971U, 0x72687b75U, 0x80787658U, 0x6f817c8fU, 0x56755b78U, 0x6f61655eU, 0x7676765fU, 0x6c696f6aU);}
    if (y==5) { hqdB = uint[10] (0xd9254951U, 0xc9bdab08U, 0x71b8a56fU, 0x7edfbc56U, 0x5d2383acU, 0x531c9957U, 0x622d8062U, 0x5b8b7440U, 0x6ec2925bU, 0x6c9c81abU); lqdB = uint[13] (0x51825b97U, 0x577d526eU, 0x68766a6cU, 0x5f7f6f79U, 0x68836776U, 0x637a6d72U, 0x66716476U, 0x6b706f6aU, 0x757a7375U, 0x687e7081U, 0x6578657dU, 0x6c736771U, 0x6c756a74U);}
    if (y==6) { hqdB = uint[10] (0xca6b28fdU, 0xb3f3e380U, 0x5e268261U, 0x7d6ac7fbU, 0x5b256665U, 0x647084b1U, 0x5aca7efbU, 0x566b6f80U, 0x79807681U, 0x6bef74a6U); lqdB = uint[13] (0x968c7777U, 0x819a6e97U, 0x3d7b659dU, 0x67685c91U, 0x7182615eU, 0x5287796eU, 0x5d7a7385U, 0x657b6882U, 0x616c627cU, 0x666d6472U, 0x6d756f6cU, 0x6b727079U, 0x6c756475U);}
    if (y==6 || y==7) { hqydB = uint[10] (0x78e823f5U, 0xcb574bf4U, 0x9df829c2U, 0x7ea36d07U, 0xb9cabeb4U, 0x8c5ba051U, 0x61ca36beU, 0x95b3623fU, 0xa5ffb714U, 0x8dc78f7aU); lqydB = uint[13] (0x3eba8198U, 0x674fa5U, 0x63824f68U, 0x7f435f34U, 0x86a09b7fU, 0x5c4d567eU, 0x916f5a5aU, 0x5f874278U, 0x704a6559U, 0x907d9a55U, 0x65877f82U, 0x686f6b70U, 0x78747163U);}
    if (y==7) { hqdB = uint[10] (0xd0f0389cU, 0xc476ffffU, 0x503a811dU, 0x8635c0a0U, 0x515f5d9dU, 0x4b9d7a68U, 0x65e99171U, 0x41a670f6U, 0x6f0f6693U, 0x6f227946U); lqdB = uint[13] (0x9a937586U, 0x789f6b98U, 0x45a06e8eU, 0x68554e97U, 0x72975158U, 0x46947668U, 0x64797b84U, 0x5f7e7b8eU, 0x5172537bU, 0x636e4a76U, 0x736d7069U, 0x6874747eU, 0x6d715e77U);}
    if (y==8) { hqdB = uint[10] (0xcdab3b0fU, 0xb0e9e0cbU, 0x5d967edeU, 0x7b2fbe56U, 0x5af771e0U, 0x5db1872aU, 0x63157226U, 0x59d0764fU, 0x6aae7b15U, 0x70a07044U); lqdB = uint[13] (0x8e848362U, 0x74a27aa0U, 0x458458a0U, 0x646e547aU, 0x6e756a6fU, 0x6078717bU, 0x6076697eU, 0x6a75607aU, 0x696c6f71U, 0x6c787571U, 0x6b756b79U, 0x68726a7aU, 0x71767170U);}
    if (y==8 || y==9) { hqydB = uint[10] (0x6f010000U, 0xced82a4cU, 0xbe5a2044U, 0x99176edaU, 0xa2b9a673U, 0x80ef7e7cU, 0x689b382fU, 0x9b015de0U, 0xa7e8ae68U, 0x8462822fU); lqydB = uint[13] (0x58aa6d94U, 0x2e5c5091U, 0x6c6c524fU, 0x8e4f7b4cU, 0x6e818888U, 0x705a6465U, 0x7c797672U, 0x76745e68U, 0x756b697aU, 0x7075746cU, 0x6d686f71U, 0x73766e70U, 0x6f6b6968U);}
    if (y==9) { hqdB = uint[10] (0xd13b5941U, 0xc2a8eb07U, 0x54027d5bU, 0x7d97ba2fU, 0x5b9c76b6U, 0x445e82dbU, 0x72af634dU, 0x576f75f2U, 0x5eed7cf5U, 0x722e734eU); lqdB = uint[13] (0x86778f56U, 0x7ea68b95U, 0x5791559eU, 0x61684d74U, 0x716e6a6eU, 0x6d7f6a7dU, 0x6b786c7eU, 0x68756582U, 0x616c6a72U, 0x6f776b72U, 0x6f706b79U, 0x67747077U, 0x70747273U);}
    if (y==10) { hqdB = uint[10] (0xc1698c0bU, 0xcee6dcf5U, 0x404796ddU, 0x7729a2e4U, 0x6dcb8a98U, 0x37c18ed1U, 0x722c611fU, 0x5a5a7130U, 0x5f637d59U, 0x74488186U); lqdB = uint[13] (0x73639361U, 0x9d8a9590U, 0x5b9c62abU, 0x61625384U, 0x766d648aU, 0x7893617dU, 0x6b8b6f76U, 0x72895d64U, 0x5b846d88U, 0x676a5186U, 0x72756564U, 0x6b737179U, 0x72766077U);}
    if (y==10 || y==11) { hqydB = uint[10] (0x67661516U, 0xbe6c2d80U, 0x912c3a36U, 0x805b74e8U, 0xa63a9d88U, 0x6ffe8b06U, 0x52834533U, 0x9d7666f6U, 0xacfd8459U, 0xa25ca36dU); lqydB = uint[13] (0x689a31ccU, 0x10582c87U, 0x42515167U, 0x893f772cU, 0x7e9ab670U, 0x7547458aU, 0x9775764dU, 0x626c3a81U, 0x7d506d5aU, 0x83809f62U, 0x6782857eU, 0x70716970U, 0x7374766cU);}
    if (y==11) { hqdB = uint[10] (0xdc8676d5U, 0xc979b6c9U, 0x59229fb7U, 0x66a2a433U, 0x604083bcU, 0x48138e95U, 0x663c6e72U, 0x5be26d01U, 0x5fb18baaU, 0x67bb72a2U); lqdB = uint[13] (0x666f9861U, 0x828c8680U, 0x67875ba2U, 0x5c6a4e85U, 0x75696d8cU, 0x7f855e83U, 0x65826971U, 0x65765966U, 0x6a7a6985U, 0x6e6f6586U, 0x6a74686aU, 0x74726971U, 0x6e736777U);}
    if (y==12) { hqdB = uint[10] (0xdb39683aU, 0xc027c3c0U, 0x572d921aU, 0x7407ae55U, 0x5af47e28U, 0x4c4c8c83U, 0x69c56ebdU, 0x59cb72f2U, 0x60a78b90U, 0x6fc76f04U); lqdB = uint[13] (0x6d768a5fU, 0x75987f81U, 0x61815991U, 0x5e75557cU, 0x6e757078U, 0x79796b81U, 0x66746377U, 0x65735f77U, 0x6d726b77U, 0x72796d7bU, 0x6b726777U, 0x6a746b73U, 0x6f747074U);}
    if (y==12 || y==13) { hqydB = uint[10] (0x7be41564U, 0xcdff469dU, 0xaa7d4594U, 0x840175e5U, 0x994c9f4cU, 0x76d57938U, 0x6e8e404eU, 0x98496b63U, 0xa8e69a38U, 0x7c728fceU); lqydB = uint[13] (0x6897478bU, 0x485b536eU, 0x7476635dU, 0x7f53725aU, 0x7b7f8a82U, 0x6d585e6fU, 0x7d6f7a72U, 0x7b7f6164U, 0x6a706c8aU, 0x656f6c6bU, 0x74657367U, 0x7379736dU, 0x6b6b6e6aU);}
    if (y==13) { hqdB = uint[10] (0xd6a64e47U, 0xba4cce43U, 0x61188e48U, 0x790fb85bU, 0x5a347c04U, 0x56098e06U, 0x65667411U, 0x5b6d760fU, 0x65e28647U, 0x6f6c72c9U); lqdB = uint[13] (0x747c7c6bU, 0x7297748bU, 0x57825c93U, 0x5f75567bU, 0x6c796c74U, 0x6a786e7dU, 0x61736379U, 0x69726073U, 0x70727172U, 0x6f7d7379U, 0x6974667aU, 0x6a736975U, 0x70757171U);}

    // first coeffs
    float w1 = 0.;
    
    for( int i=0; i<HQ; i++) {
        uint q = hqd[i];
    	pos+=cmul(vec2(SH(q,0,ch),SH(q,16,ch)),vec2(cos(w1),sin(w1)));w1+=s1; 
    }
    for( int i=0; i<LQ; i++) {
        uint q = lqd[i];
    	pos+=cmul(vec2(S(q,0,cl),S(q,8,cl)),vec2(cos(w1),sin(w1)));w1+=s1; 
        pos+=cmul(vec2(S(q,16,cl),S(q,24,cl)),vec2(cos(w1),sin(w1)));w1+=s1; 
    }  
    
    // and y
    w1 = 0.;
    for( int i=0; i<HQ; i++) {
        uint q = hqyd[i];
        posy+=cmul(vec2(SH(q,0,ch),SH(q,16,ch)),vec2(cos(w1),sin(w1)));w1+=s1; 
    }
    for( int i=0; i<LQ; i++) {
        uint q = lqyd[i];
        posy+=cmul(vec2(S(q,0,cl),S(q,8,cl)),vec2(cos(w1),sin(w1)));w1+=s1; 
        posy+=cmul(vec2(S(q,16,cl),S(q,24,cl)),vec2(cos(w1),sin(w1)));w1+=s1; 
    }  
    
    // last coeffs
    float w2 = (FRAMES-1.)*s1;
    
    for( int i=0; i<HQ; i++) {
        uint q = hqdB[i];
        pos+=cmul(vec2(SH(q,0,chb),SH(q,16,chb)),vec2(cos(w2),sin(w2)));w2-=s1; 
    }
    for( int i=0; i<LQ; i++) {
        uint q = lqdB[i];
        pos+=cmul(vec2(S(q,0,clb),S(q,8,clb)),vec2(cos(w2),sin(w2)));w2-=s1; 
        pos+=cmul(vec2(S(q,16,clb),S(q,24,clb)),vec2(cos(w2),sin(w2)));w2-=s1; 
    }  
    
    // and y
    w2 = (FRAMES-1.)*s1;
    for( int i=0; i<HQ; i++) {
        uint q = hqydB[i];
        posy+=cmul(vec2(SH(q,0,chb),SH(q,16,chb)),vec2(cos(w2),sin(w2)));w2-=s1; 
    }
    for( int i=0; i<LQ; i++) {
        uint q = lqydB[i];
        posy+=cmul(vec2(S(q,0,clb),S(q,8,clb)),vec2(cos(w2),sin(w2)));w2-=s1; 
        posy+=cmul(vec2(S(q,16,clb),S(q,24,clb)),vec2(cos(w2),sin(w2)));w2-=s1; 
    }  
    
    float py = (int(fragCoord.y) & 0x1) == 0 ?  posy.x : posy.y;
    vec3 p = vec3(pos.x, py, pos.y);
    
    if(iFrame == 0) {
        fragColor = vec4(p * scale,1.0);
    } else {	    
    	fragColor = mix(vec4(p * scale,1.0), texelFetch(iChannel0, ivec2(fragCoord),0),.75);
    }
}
`;

const buffB = `
// [SH18] Human Document. Created by Reinder Nijhoff 2018
// @reindernijhoff
//
// https://www.shadertoy.com/view/XtcyW4
//
//   * Created for the Shadertoy Competition 2018 *
//
// Buffer B: The BRDF integration map used for the IBL and the drawing of the humanoid 
//           are precalculated.
//

const float PI = 3.14159265359;

// see: http://blog.selfshadow.com/publications/s2013-shading-course/karis/s2013_pbs_epic_notes_v2.pdf
float PartialGeometryGGX(float NdotV, float a) {
    float k = a / 2.0;

    float nominator   = NdotV;
    float denominator = NdotV * (1.0 - k) + k;

    return nominator / denominator;
}

float GeometryGGX_Smith(float NdotV, float NdotL, float roughness) {
    float a = roughness*roughness;
    float G1 = PartialGeometryGGX(NdotV, a);
    float G2 = PartialGeometryGGX(NdotL, a);
    return G1 * G2;
}

float RadicalInverse_VdC(uint bits) {
    bits = (bits << 16u) | (bits >> 16u);
    bits = ((bits & 0x55555555u) << 1u) | ((bits & 0xAAAAAAAAu) >> 1u);
    bits = ((bits & 0x33333333u) << 2u) | ((bits & 0xCCCCCCCCu) >> 2u);
    bits = ((bits & 0x0F0F0F0Fu) << 4u) | ((bits & 0xF0F0F0F0u) >> 4u);
    bits = ((bits & 0x00FF00FFu) << 8u) | ((bits & 0xFF00FF00u) >> 8u);
    return float(bits) * 2.3283064365386963e-10; // / 0x100000000
}

vec2 Hammersley(int i, int N) {
    return vec2(float(i)/float(N), RadicalInverse_VdC(uint(i)));
} 

vec3 ImportanceSampleGGX(vec2 Xi, float roughness) {
    float a = roughness*roughness;
    float phi      = 2.0 * PI * Xi.x;
    float cosTheta = sqrt((1.0 - Xi.y) / (1.0 + (a*a - 1.0) * Xi.y));
    float sinTheta = sqrt(1.0 - cosTheta*cosTheta);

    vec3 HTangent;
    HTangent.x = sinTheta*cos(phi);
    HTangent.y = sinTheta*sin(phi);
    HTangent.z = cosTheta;

    return HTangent;
}

vec2 IntegrateBRDF(float roughness, float NdotV) {
    vec3 V;
    V.x = sqrt(1.0 - NdotV*NdotV);
    V.y = 0.0;
    V.z = NdotV;

    float A = 0.0;
    float B = 0.0;

    const int SAMPLE_COUNT = 128;

    vec3 N = vec3(0.0, 0.0, 1.0);
    vec3 UpVector = abs(N.z) < 0.999 ? vec3(0.0, 0.0, 1.0) : vec3(1.0, 0.0, 0.0);
    vec3 TangentX = normalize(cross(UpVector, N));
    vec3 TangentY = cross(N, TangentX);

    for(int i = 0; i < SAMPLE_COUNT; ++i)  {
        vec2 Xi = Hammersley(i, SAMPLE_COUNT);
        vec3 HTangent = ImportanceSampleGGX(Xi, roughness);
        
        vec3 H = normalize(HTangent.x * TangentX + HTangent.y * TangentY + HTangent.z * N);
        vec3 L = normalize(2.0 * dot(V, H) * H - V);

        float NdotL = max(L.z, 0.0);
        float NdotH = max(H.z, 0.0);
        float VdotH = max(dot(V, H), 0.0);

        if(NdotL > 0.0) {
            float G = GeometryGGX_Smith(NdotV, NdotL, roughness);
            float G_Vis = (G * VdotH) / (NdotH * NdotV);
            float Fc = pow(1.0 - VdotH, 5.0);

            A += (1.0 - Fc) * G_Vis;
            B += Fc * G_Vis;
        }
    }
    A /= float(SAMPLE_COUNT);
    B /= float(SAMPLE_COUNT);
    return vec2(A, B);
}

//
// draw paper
//


vec3 getSpherePosition(int i) {
    if (i==LEFT_LEG_1) return vec3(-.15, 0, -1.6);
    if (i==RIGHT_LEG_1) return vec3(.5, 0, -1.6);
    
    if (i==LEFT_LEG_2) return vec3(-.3, 0, -.75);
    if (i==RIGHT_LEG_2) return vec3(.3, 0, -.75);
    
    if (i==LEFT_LEG_3) return vec3(-.12, 0, .15);
    if (i==RIGHT_LEG_3) return vec3(.1, 0, .15);
        
    if (i==HEAD) return vec3(0., 0, 1.65);
    if (i==SPINE) return vec3(0., 0, 1.1);
    
    if (i==LEFT_ARM_3) return vec3(-.3, 0, 1.15);
    if (i==RIGHT_ARM_3) return vec3(.3, 0, 1.15);
    
    if (i==LEFT_ARM_2) return vec3(-.55, 0, .7);
    if (i==RIGHT_ARM_2) return vec3(.55, 0, .7);
    
    if (i==LEFT_ARM_1) return vec3(-.75, 0, 0.2);
    if (i==RIGHT_ARM_1) return vec3(.95,0,  0.4);
    
    return vec3(0);
}

float mapBody( in vec3 pos ) {
    float r = .15;
    float s = 80.1;

    vec3 p1 = getSpherePosition(LEFT_LEG_1);
    vec3 p2 = getSpherePosition(LEFT_LEG_2);
    float d = sdCapsule(pos, p1, p2, r, r*.5);
    vec2 res = vec2(d, MAT_PAPER);

    p1 = getSpherePosition(LEFT_LEG_3);
    d = sdCapsule(pos, p1, p2, r, r*.5);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(RIGHT_LEG_1);
    p2 = getSpherePosition(RIGHT_LEG_2);
    d = sdCapsule(pos, p1, p2, r, r*.5);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(RIGHT_LEG_3);
    d = sdCapsule(pos, p1, p2, r, r*.5);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(RIGHT_LEG_3);
    p2 = getSpherePosition(SPINE);
    d = sdCapsule(pos, p1, p2, r, r);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(LEFT_LEG_3);
    d = sdCapsule(pos, p1, p2, r, r);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(RIGHT_ARM_1);
    p2 = getSpherePosition(RIGHT_ARM_2);
    d = sdCapsule(pos, p1, p2, r*.5, r*.25);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(RIGHT_ARM_3);
    d = sdCapsule(pos, p1, p2, r*.5, r*.25);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(LEFT_ARM_1);
    p2 = getSpherePosition(LEFT_ARM_2);
    d = sdCapsule(pos, p1, p2, r*.5, r*.25);
    res.x = smin(res.x, d, s); 

    p1 = getSpherePosition(LEFT_ARM_3);
    d = sdCapsule(pos, p1, p2, r*.5, r*.25);
    res.x = smin(res.x, d, s);    

    return res.x;
}

vec2 drawPaper(vec2 uv) {
    float structure = 1.-texture(iChannel1, uv.yx).x;
    vec3 muv = vec3(uv.y-.5, 0., uv.x-.5)*4.;
    muv.x *= PAPER_SIZE.x / PAPER_SIZE.y;
    muv *= 2.75;
    muv.xz += vec2(.5,2.6) + .05*(texture(iChannel1, uv.yx*2.).xz-.5);
    muv.y = 0.;
    float drawing = smoothstep(.04,.03,abs(mapBody(muv))) * (.25+.75*structure);
    
    return vec2(structure, 1.-drawing);
}

bool resolutionChanged() {
    return iFrame == 0 
        || floor(texelFetch(iChannel0, ivec2(0), 0).r) != floor(iResolution.x);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    if(resolutionChanged() && iChannelResolution[1].x > 0.) {
        vec2 uv = fragCoord / iResolution.xy;
        vec2 integratedBRDF = IntegrateBRDF(uv.y, uv.x);
        vec2 paper = drawPaper(uv);
        fragColor = vec4(integratedBRDF, paper);
        
        if (fragCoord.x < 1.5 && fragCoord.y < 1.5) {
            fragColor.xy = floor(iResolution.xy);
        }
    } else {
        fragColor = texelFetch(iChannel0, ivec2(fragCoord), 0);
    }
}
`;

const buffC = `
// [SH18] Human Document. Created by Reinder Nijhoff 2018
// @reindernijhoff
//
// https://www.shadertoy.com/view/XtcyW4
//
//   * Created for the Shadertoy Competition 2018 *
//
// Buffer C: Additional custom animation of the bones is calculated for the start
//           and end of the loop.
//

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    ivec2 f = ivec2(fragCoord);
    
    if (f.x > 0 || f.y > NUM_BONES) return;
    
    initAnimation(iTime);
    
    vec3 animPos = texelFetch(iChannel0, f, 0).xyz;
    animPos.y = max(animPos.y - planeY, 1.);
    
    vec3 startPos = vec3(animPos.x,-9,animPos.z);
    
    float t = mod(offsetTime(iTime), DURATION_TOTAL);
    vec3 pos = animPos;
	
    if (t < DURATION_START + DURATION_MORPH_ANIM) {
        float tm = t-(DURATION_START-DURATION_MORPH_STILL);
        if ( tm > 0.) {
            pos = mix(startPos, animPos, smoothstep(0.,1., tm / DURATION_MORPH));
        } else {
            pos = startPos;
        }
        
        if (f.y == HEAD) {
            pos.y = max(pos.y, 1.); 
            
            float tf = max(0., (t-DURATION_START*.5))*2.;
            float atm = clamp(1.-max(0.,tf/(DURATION_START+DURATION_MORPH_ANIM)), 0., 1.);
            float maxf = 50.f * atm*atm*atm*atm;
            float freq = min(10.,1.75/(.2+atm*atm));
            float h = maxf * abs(cos(freq*tf)); 
            pos.y += h;
        }
    } else if (t > DURATION_START + DURATION_ANIM - DURATION_MORPH_ANIM) {
        float tm = t-(DURATION_START + DURATION_ANIM - DURATION_MORPH_ANIM);
        if ( tm > 0.) {
            pos = mix(startPos, animPos, smoothstep(1.,0., tm / DURATION_MORPH));
        } else {
            pos = startPos;
        }
        
        if (f.y == HEAD) {
            pos.y = max(pos.y, 1.); 
            pos.xz += max(0.,tm) * vec2(3.5,30.);
        }
    } 
    
    
    pos = pos*.11;
    pos.z -= .5;
    
    fragColor = vec4(pos, 1.);
}
`;

const fragment = `
// [SH18] Human Document. Created by Reinder Nijhoff 2018
// Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License.
// @reindernijhoff
//
// https://www.shadertoy.com/view/XtcyW4
//
//   *Created for the Shadertoy Competition 2018*
//
// 07/29/2018 I have made some optimizations and bugfixes, so I could enable AA. 
// 
//            !! Please change AA (line 47) to 1 if your framerate is below 60 
//               (or if you're running the shader fullscreen).
//
// This shader uses motion capture data to animate a humanoid. The animation data is
// compressed by storing only a fraction of the coeffecients of the Fourier transform
// of the positions of the bones (Buffer A). An inverse Fourier transform is used to 
// reconstruct the data needed.
// 
// Image Based Lighting (IBL) is used to render the scene. Have a look at my shader 
// "Old watch (IBL)" (https://www.shadertoy.com/view/lscBW4) for a clean implementation
// of IBL.
// 
// Buffer A: I have preprocessed a (motion captured) animation by taking the Fourier 
//           transform of the position of all bones (14 bones, 760 frames). Only a fraction 
//           of all calculated coefficients are stored in this shader: the first 
//           coefficients with 16 bit precision, later coefficients with 8 bit. The positions
//           of the bones are reconstructed each frame by taking the inverse Fourier
//           transform of this data.
//
//           I have used (part of) an animation from the Carnegie Mellon University Motion 
//           Capture Database. The animations of this database are free to use:
//
//           - http://mocap.cs.cmu.edu/
// 
//           Íñigo Quílez has created some excellent shaders that show the properties of 
//           Fourier transforms, for example: 
//
//           - https://www.shadertoy.com/view/4lGSDw
//           - https://www.shadertoy.com/view/ltKSWD
//
// Buffer B: The BRDF integration map used for the IBL and the drawing of the humanoid 
//           are precalculated.
//
// Buffer C: Additional custom animation of the bones is calculated for the start
//           and end of the loop.
//

#define MAX_LOD 8.
#define DIFFUSE_LOD 6.75
#define AA 2              // Please change to 1 if your framerate is below 60
#define MARCH_STEPS 40

vec3 getSpherePosition(int i) {
    return texelFetch(iChannel2, ivec2(0,i), 0 ).xyz;
}

float mapBody( in vec3 pos ) {
    float r = .1;
    float s = 80.;

    vec3 p1 = getSpherePosition(LEFT_LEG_1);
    vec3 p2 = getSpherePosition(LEFT_LEG_2);
    float d = sdCapsule(pos, p1, p2, r, r*.5);
    vec2 res = vec2(d, MAT_PAPER);

    p1 = getSpherePosition(LEFT_LEG_3);
    d = sdCapsule(pos, p1, p2, r, r*.5);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(RIGHT_LEG_1);
    p2 = getSpherePosition(RIGHT_LEG_2);
    d = sdCapsule(pos, p1, p2, r, r*.5);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(RIGHT_LEG_3);
    d = sdCapsule(pos, p1, p2, r, r*.5);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(RIGHT_LEG_3);
    p2 = getSpherePosition(SPINE);
    d = sdCapsule(pos, p1, p2, r, r);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(LEFT_LEG_3);
    d = sdCapsule(pos, p1, p2, r, r);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(RIGHT_ARM_1);
    p2 = getSpherePosition(RIGHT_ARM_2);
    d = sdCapsule(pos, p1, p2, r*.5, r*.25);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(RIGHT_ARM_3);
    d = sdCapsule(pos, p1, p2, r*.5, r*.25);
    res.x = smin(res.x, d, s);

    p1 = getSpherePosition(LEFT_ARM_1);
    p2 = getSpherePosition(LEFT_ARM_2);
    d = sdCapsule(pos, p1, p2, r*.5, r*.25);
    res.x = smin(res.x, d, s); 

    p1 = getSpherePosition(LEFT_ARM_3);
    d = sdCapsule(pos, p1, p2, r*.5, r*.25);
    res.x = smin(res.x, d, s);    

    return res.x;
}

vec2 map( in vec3 pos, bool spInt, bool pencilIntersect ) {
	// table
    vec2 res = vec2(pos.y + 0.01, MAT_TABLE);
    
    //--- paper
    float dP = pos.y;    
    if( spInt ) {   	 
        // smin with paper
        dP = smin(dP, mapBody(pos), 12.);
    }
    dP = opS(-sdBox(pos, vec3(PAPER_SIZE.x,10.,PAPER_SIZE.y)),dP);
    if (dP<res.x) { res = vec2(dP, MAT_PAPER); }
    
    // head
    float d = sdSphere(pos, vec4(getSpherePosition(HEAD),.1));
    if (d<res.x) { res = vec2(d, MAT_METAL_0); }
    
    //--- pencil
    if (pencilIntersect) {
        vec3 pen = pos;
        pen.xz = mat2(0.581683089463883,-0.813415504789374,
                      0.813415504789374, 0.581683089463883)*pen.xz;
        pen += PENCIL_POS;
        float dPencil0 = sdHexPrism(pen, vec2(.2, 2.));
        dPencil0 = opS(-sdCone(pen + (vec3(-2.05,0,0)), vec2(.95,0.3122)),dPencil0);
        dPencil0 = opS(sdSphere(pen + (vec3(-2.5,-0.82,2.86)), 3.), dPencil0);
        if (dPencil0 < res.x) res = vec2(dPencil0, MAT_PENCIL_0);

        float dPencil1 = sdCapsule(pen, - vec3(2.2,0.,0.), -vec3(2.55, 0., 0.), .21);
        if (dPencil1 < res.x) res = vec2(dPencil1, MAT_PENCIL_1);
        float ax = abs(-2.25 - pen.x );
        float r = .02*abs(2.*fract(30.*pen.x)-1.)*smoothstep(.08,.09,ax)*smoothstep(.21,.2,ax);

        float dPencil2 = sdCylinderZY(pen + vec3(2.25,-0.0125,0), vec2(.22 - r,.25));
        if (dPencil2 < res.x) res = vec2(dPencil2, MAT_PENCIL_2);
    }
 	return res;   
}

vec3 calcNormal( in vec3 pos ) {
    bool sphInt = distance(pos,getSpherePosition(LEFT_LEG_3)) <  1.25 ? true : false;
    vec3 ropen = pos;
    ropen.xz = rotate(ropen.xz, PENCIL_ROT);
    ropen += PENCIL_POS;
    bool pencilIntersect = sdBox(ropen, vec3(3.,.4,.4)) < 0.;
    
    const vec2 e = vec2(1.0,-1.0)*0.01;
    return normalize( e.xyy*map( pos + e.xyy, sphInt, pencilIntersect ).x + 
					  e.yyx*map( pos + e.yyx, sphInt, pencilIntersect ).x + 
					  e.yxy*map( pos + e.yxy, sphInt, pencilIntersect ).x + 
					  e.xxx*map( pos + e.xxx, sphInt, pencilIntersect ).x );
}

vec2 castRay( in vec3 ro, in vec3 rd ) {
    float tmax = 20.;
    
    vec3 rdpen = rd, ropen = ro;
    rdpen.xz = rotate(rdpen.xz, PENCIL_ROT);
    ropen.xz = rotate(ropen.xz, PENCIL_ROT);
    ropen += PENCIL_POS;
    
    vec2 sphDist = sphIntersect(ro-getSpherePosition(LEFT_LEG_3), rd, 1.25);
    vec2 pencilDist = boxIntersect(ropen, rdpen, vec3(3.,.24,.24));
    vec2 headDist = sphIntersect(ro-getSpherePosition(HEAD), rd, .11);
    
    bool pencilIntersect = pencilDist.x > 0.;
    bool sphInt = sphDist.y > 0.;
        
    float tmin = planeIntersect(ro,rd,.01);
    if (sphInt) {
        tmin = min(tmin, max(sphDist.x, 0.1));
    }
    if (pencilIntersect) {
        tmin = min(tmin, max(pencilDist.x, 0.11));
    }
    if (headDist.x > 0.) {
        tmin = min(tmin, headDist.x);
    }
    
    float t = tmin;
    float mat = -1.;
    
    for( int i=0; i<MARCH_STEPS; i++ ) {
	    float precis = 0.00025*t;
	    vec2 res = map( ro+rd*t, sphInt, pencilIntersect );
        if( res.x<precis || t>tmax ) break;
        t += res.x;
        mat = res.y;
    }

    if( t>tmax ) t=-1.0;
    return vec2(t, mat);
}

float calcAO( in vec3 ro, in vec3 rd ) {
	float occ = 0.0;
    float sca = 1.0;
    
    bool sphInt = sphIntersect(ro-getSpherePosition(LEFT_LEG_3), rd, 1.25).y > 0. ? true : false;
    vec3 ropen = ro;
    ropen.xz = rotate(ropen.xz, PENCIL_ROT);
    ropen += PENCIL_POS;
    bool pencilIntersect = sdBox(ropen, vec3(3.,.45,.45)) < 0.;
    
    for( int i=0; i<5; i++ ) {
        float h = 0.001 + 0.25*float(i)/4.0;
        float d = map( ro+rd*h, sphInt, pencilIntersect ).x;
        occ += (h-d)*sca;
        sca *= 0.95;
    }
    return clamp( 1.0 - 1.5*occ, 0.0, 1.0 );    
}

void getMaterialProperties(
    in vec3 pos, in float mat,
    inout vec3 normal, inout vec3 albedo, inout float ao, inout float roughness, inout float metallic) {
    
    normal = calcNormal( pos );
    ao = calcAO(pos, normal);
    metallic = 0.;
    
    vec4 noise = texNoise(iChannel1, pos * .5, normal);
    float metalnoise = 1.- noise.r;
    metalnoise*=metalnoise;

    mat -= .5;
    
    vec3 penpos = pos;
    penpos.xz = rotate(penpos.xz, PENCIL_ROT);
    penpos += PENCIL_POS;
    
    if (mat < MAT_TABLE) {
        albedo = 0.8*pow(texture(iChannel1, rotate(pos.xz * .4 + .25, -.3)).rgb, 2.2*vec3(0.45,0.5,0.5));
        roughness = 0.95 - albedo.r * .6;
    }
    else if( mat < MAT_PENCIL_0 ) {
        if (length(penpos.yz) < 0.055) {
        	albedo = vec3(0.02);
        	roughness = .9;
        } else if(sdHexPrism(penpos, vec2(.195, 3.)) < 0.) {
        	albedo = .8* texture(iChannel1, penpos.xz).rgb;
        	roughness = 0.99;
        } else {
        	albedo = .5*pow(vec3(1.,.8,.15), vec3(2.2));
        	roughness = .75 - noise.b * .4;
        }
        albedo *= noise.g * .75 + .7;
    }
    else if( mat < MAT_PENCIL_1 ) {
       	albedo = .4*pow(vec3(.85,.75,.55), vec3(2.2));
       	roughness = 1.;
    }
    else if( mat < MAT_PENCIL_2 ) {
        float ax = abs(-2.25 - penpos.x);
        float r = 1. - abs(2.*fract(30.*penpos.x)-1.)*smoothstep(.08,.09,ax)*smoothstep(.21,.2,ax);

        r -= 4. * metalnoise;  
        ao *= .5 + .5 * r;
	    albedo = mix(vec3(0.5, 0.3, 0.2),vec3(0.560, 0.570, 0.580), ao * ao); // Iron
   		roughness = 1.-.25*r;
   		metallic = 1.; 
    }
    else if( mat < MAT_PAPER ) {
        vec2 paperUV = (pos.xz-PAPER_SIZE)/(PAPER_SIZE*2.)+1.;
        vec2 tex = texture(iChannel3, paperUV.yx).zw;
    	float line = abs(paperUV.x-.5) > .45 ? 0. : smoothstep(0.1, 0.025, abs(sin(paperUV.y*75.)));

        albedo = mix(vec3(.955 - .05*tex.x), vec3(.55,.65,.9), line);    	
        float figure = 1.-tex.y;
        float time = mod(offsetTime(iTime), DURATION_TOTAL);
        float start = 1.-smoothstep(DURATION_START-DURATION_MORPH_STILL, DURATION_START+DURATION_MORPH_ANIM, time);
        float end = smoothstep(DURATION_TOTAL-DURATION_MORPH, DURATION_TOTAL, time);
        figure *= max(start, end);
        
        albedo *= 1.-figure*.8;
        
       	roughness = .65 + .3 *tex.x;
        metallic = 0.;
    }
    else if( mat < MAT_METAL_0 ) {
	    albedo = vec3(1.000, 0.766, 0.336); // Gold
   		roughness = .6;
   		metallic = 1.; 
    }   
    if (metallic > .5) {   
        albedo *= 1.-metalnoise;
        roughness += metalnoise*4.;
    }
    
    ao = clamp(.2+.8*ao, 0., 1.);
    roughness = clamp(roughness, 0., 1.);
}

//
// Image based lighting
// See: Old watch (IBL)
// https://www.shadertoy.com/view/lscBW4
//
vec3 getSpecularLightColor( vec3 N, float roughness ) {
    return pow(textureLod(iChannel0, N, roughness * MAX_LOD).rgb, vec3(4.5)) * 6.5;
}
vec3 getDiffuseLightColor( vec3 N ) {
    return .25 +pow(textureLod(iChannel0, N, DIFFUSE_LOD).rgb, vec3(3.)) * 1.;
}
vec3 FresnelSchlickRoughness(float cosTheta, vec3 F0, float roughness) {
    return F0 + (max(vec3(1.0 - roughness), F0) - F0) * pow(1.0 - cosTheta, 5.0);
}
vec3 lighting(in vec3 ro, in vec3 pos, in vec3 N, in vec3 albedo, in float ao, in float roughness, in float metallic ) {
    vec3 V = normalize(ro - pos); 
    vec3 R = reflect(-V, N);
    float NdotV = max(0.0, dot(N, V));

    vec3 F0 = vec3(0.04); 
    F0 = mix(F0, albedo, metallic);

    vec3 F = FresnelSchlickRoughness(NdotV, F0, roughness);

    vec3 kS = F;

    vec3 prefilteredColor = getSpecularLightColor(R, roughness);
    vec2 envBRDF = texture(iChannel3, vec2(NdotV, roughness)).rg;
    vec3 specular = prefilteredColor * (F * envBRDF.x + envBRDF.y);

    vec3 kD = vec3(1.0) - kS;

    kD *= 1.0 - metallic;

    vec3 irradiance = getDiffuseLightColor(N);

    vec3 diffuse  = albedo * irradiance;
    vec3 color = (kD * diffuse + specular) * ao;

    return color;
}

//
// main 
//
vec3 render( const in vec3 ro, const in vec3 rd ) {
    vec3 col = vec3(0); 
    vec2 res = castRay( ro, rd );
    
    if (res.x > 0.) {
        vec3 pos = ro + rd * res.x;
        vec3 N, albedo;
        float roughness, metallic, ao;

        getMaterialProperties(pos, res.y, N, albedo, ao, roughness, metallic);

        col = lighting(ro, pos, N, albedo, ao, roughness, metallic);
        col *= max(0.0, min(1.1, 20./dot(pos,pos)) - .1);
    }
    col = max( vec3(0), col - 0.004);
    col = (col*(6.2*col + .5)) / (col*(6.2*col+1.7) + 0.06);
    
    return col;
}

mat3 setCamera( in vec3 ro, in vec3 ta ) {
	vec3 cw = normalize(ta-ro);
	vec3 cp = vec3(0.0, 1.0,0.0);
	vec3 cu = normalize( cross(cw,cp) );
	vec3 cv = normalize( cross(cu,cw) );
    return mat3( cu, cv, cw );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    vec2 uv = fragCoord/iResolution.xy;
    vec2 mo = iMouse.xy/iResolution.xy - .5;
    if(iMouse.w <= 0.) {
        mo = vec2( 0.06+.1*sin(iTime*.035), 0. );
    }
    vec3 ro = vec3( 4.*sin(6.0*mo.x), 3. * mo.y + 3.5, -5.5*cos(6.0*mo.x) );
    vec3 ta = vec3( 0.0, 0.5, 0.0 );
    mat3 ca = setCamera( ro, ta );

    vec3 colT = vec3(0);
    for (int x=0; x<AA; x++) {
        for(int y=0; y<AA; y++) {
		    vec2 p = (-iResolution.xy + 2.0*(fragCoord + vec2(x,y)/float(AA) - .5))/iResolution.y;
   			vec3 rd = ca * normalize(vec3(p.xy,2.3));  
            colT += render( ro, rd);           
        }
    }
    colT /= float(AA*AA);
    
    colT *= smoothstep(.5, 1.5, iTime);
    fragColor = vec4(colT, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'XtcyW4';
  }
  name(): string {
    return '[SH18] Human Document';
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
      { type: 1, f: buffA, fi: 0 }, //
      { ...webglUtils.TEXTURE4 },
      { type: 1, f: buffC, fi: 2 },
      { type: 1, f: buffB, fi: 3 },
    ];
  }
}
