import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// Buffer A : Sliders
//
// Author : SÃ©bastien BÃ©rubÃ©
// Created : Dec 2015
// Modified : Mar 2016
#define saturate(x) clamp(x,0.0,1.0)
vec4 sliderVal = vec4(0.30,0.75,0.0,0.10); //Default slider values [0-1]

void SLIDER_setValue(float idx, float val)
{
    if(idx<0.) return;
    else if(idx<0.25) sliderVal[0] = saturate(val);
	else if(idx<0.50) sliderVal[1] = saturate(val);
	else if(idx<0.75) sliderVal[2] = saturate(val);
	else if(idx<1.00) sliderVal[3] = saturate(val);
}

float SLIDER_getValue(float idx)
{
    if     (idx<0.25) return sliderVal[0];
    else if(idx<0.50) return sliderVal[1];
    else if(idx<0.75) return sliderVal[2];
    else if(idx<1.00) return sliderVal[3];
	else return 0.;
}

void SLIDER_init(vec2 mousePos, vec2 cMin, vec2 cMax )
{
    vec4 cPingPong = texture(iChannel0,vec2(0));
    if(length(cPingPong)>0.001)
        sliderVal = cPingPong;
        
    float width = cMax.x-cMin.x;
    float height = cMax.y-cMin.y;
    if(mousePos.x>cMin.x && mousePos.x<cMax.x &&
       mousePos.y>cMin.y && mousePos.y<cMax.y )
    {
        float t = (mousePos.y-cMin.y)/height;
        t = clamp(t/0.75-0.125,0.,1.); //25% top/bottom margins
		SLIDER_setValue((mousePos.x-cMin.x)/width, t);
    }
}

//Returns the distance from point "p" to a given line segment defined by 2 points [a,b]
float UTIL_distanceToLineSeg(vec2 p, vec2 a, vec2 b)
{
    //       p
    //      /
    //     /
    //    a--e-------b
    vec2 ap = p-a;
    vec2 ab = b-a;
    //Scalar projection of ap in the ab direction = dot(ap,ab)/|ab| : Amount of ap aligned towards ab
    //Divided by |ab| again, it becomes normalized along ab length : dot(ap,ab)/(|ab||ab|) = dot(ap,ab)/dot(ab,ab)
    //The clamp provides the line seg limits. e is therefore the "capped orthogogal projection", and length(p-e) is dist.
    vec2 e = a+clamp(dot(ap,ab)/dot(ab,ab),0.0,1.0)*ab;
    return length(p-e);
}

//uv = slider pixel in local space [0-1], t = slider value [0-1], ar = aspect ratio (w/h)
vec4 SLIDER_drawSingle(vec2 uv, float t, vec2 ar, bool bHighlighted)
{
    const vec3  ITEM_COLOR = vec3(1);
    const vec3  HIGHLIGHT_COLOR = vec3(0.2,0.7,0.8);
    const float RAD = 0.05;  //Cursor radius, in local space
    const float LW  = 0.030; //Line width
    float aa  = 14./iResolution.x; //antialiasing width (smooth transition)
    vec3 selectionColor = bHighlighted?HIGHLIGHT_COLOR:ITEM_COLOR;
    vec3 cheapGloss   = 0.8*selectionColor+0.2*smoothstep(-aa,aa,uv.y-t-0.01+0.01*sin(uv.x*12.));
    vec2 bottomCenter = vec2(0.5,0.0);
	vec2 topCenter    = vec2(0.5,1.0);
    vec2 cursorPos    = vec2(0.5,t);
    float distBar = UTIL_distanceToLineSeg(uv*ar, bottomCenter*ar, topCenter*ar);
    float distCur = length((uv-cursorPos)*ar)-RAD;
    float alphaBar = 1.0-smoothstep(2.0*LW-aa,2.0*LW+aa, distBar);
    float alphaCur = 1.0-smoothstep(2.0*LW-aa,2.0*LW+aa, distCur);
    vec4  colorBar = vec4(mix(   vec3(1),vec3(0),smoothstep(LW-aa,LW+aa, distBar)),alphaBar);
    vec4  colorCur = vec4(mix(cheapGloss,vec3(0),smoothstep(LW-aa,LW+aa, distCur)),alphaCur);
    return mix(colorBar,colorCur,colorCur.a);
}

#define withinUnitRect(a) (a.x>=0. && a.x<=1. && a.y>=0. && a.y<=1.0)
vec4 SLIDER_drawAll(vec2 uv, vec2 cMin, vec2 cMax, vec2 muv)
{
    float width = cMax.x-cMin.x;
    float height = cMax.y-cMin.y;
    vec2 ar = vec2(0.30,1.0);
    uv  = (uv -cMin)/vec2(width,height); //pixel Normalization
    muv = (muv-cMin)/vec2(width,height); //mouse Normalization
    if( withinUnitRect(uv) )
    {
        float t = SLIDER_getValue(uv.x);
		bool bHighlight = withinUnitRect(muv) && abs(floor(uv.x*4.0)-floor(muv.x*4.0))<0.01;
		uv.x = fract(uv.x*4.0); //repeat 4x
		uv.y = uv.y/0.75-0.125; //25% margins
        return SLIDER_drawSingle(uv,t,ar,bHighlight);
    }
    return vec4(0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 cMinSliders = vec2(0.9,0.80);
    vec2 cMaxSliders = vec2(1.0,1.00);
    vec2 uvSliders = fragCoord.xy / iResolution.xy;
    vec2 mousePos = iMouse.xy / iResolution.xy;
    SLIDER_init(mousePos, cMinSliders, cMaxSliders);
    vec4 cSlider = SLIDER_drawAll(uvSliders,cMinSliders, cMaxSliders, mousePos);
    
    if(length(fragCoord.xy-vec2(0,0))<1.) 
        fragColor = sliderVal;
	else fragColor = cSlider;
}`;

const buffB = `
// Buffer B : Material Roughness map
//
// Author : SÃ©bastien BÃ©rubÃ©
//
// This is just noise, you could implement whatever roughness map you want.
// This needs some clean-up, as it was originally coded as 3D noise, but only a 2D slice is used here.

#define saturate(x) clamp(x,0.0,1.0)
float UTIL_distanceToLineSeg(vec2 p, vec2 a, vec2 b)
{
    //Scalar projection of ap in the ab direction = dot(ap,ab)/|ab| : Amount of ap aligned towards ab
    //Divided by |ab| again, it becomes normalized along ab length : dot(ap,ab)/(|ab||ab|) = dot(ap,ab)/dot(ab,ab)
    //The clamp provides the line seg limits. e is therefore the "capped orthogogal projection".
    //       p
    //      /
    //     /
    //    a--e-------b
    vec2 ap = p-a;
    vec2 ab = b-a;
    vec2 e = a+clamp(dot(ap,ab)/dot(ab,ab),0.0,1.0)*ab;
    return length(p-e);
}
vec2 noise(vec2 p)
{
    return texture(iChannel2,p,-100.0).xy;
}
struct repeatInfo
{
	vec2 pRepeated;
    vec2 anchor;
};
repeatInfo UTIL_repeat(vec2 p, float interval)
{
    repeatInfo rInfo;
    rInfo.pRepeated = p / interval; //Normalize
    rInfo.pRepeated = fract(rInfo.pRepeated+0.5)-0.5; //centered fract
    rInfo.pRepeated *= interval; //Rescale
    rInfo.anchor = p-rInfo.pRepeated;
    return rInfo;
}
float MAT_scratchTexture(vec2 p)
{
    const float squareWidth = 0.10*2.0;
    const float moveAmp   = squareWidth*0.75;
    const float lineWidth = 0.0005;
    float repeatInterval = squareWidth+moveAmp;
    repeatInfo rInfo = UTIL_repeat(p,repeatInterval);
    float margin = repeatInterval-squareWidth;
    
    vec2 a = moveAmp*noise(rInfo.anchor);
    vec2 b = -moveAmp*noise(rInfo.anchor+10.0);
    float dseg = 1000.0*UTIL_distanceToLineSeg(rInfo.pRepeated, a, b)/squareWidth;
    return saturate(10.0/dseg-0.5)*0.25;
}

float MAT_layeredScratches(vec2 p)
{
    const mat2 m2 = mat2(0.8,-0.6,0.6,0.8);
    float I = MAT_scratchTexture(p);
    p = m2*p;
    I += MAT_scratchTexture(p*1.11+2.0);
    p = m2*p;
    I += MAT_scratchTexture(p*1.24+3.8);
    p = m2*p;
    I += MAT_scratchTexture(p*1.34+5.3);
    p = m2*p;
    I += MAT_scratchTexture(p*1.34+5.3);
    p = m2*p;
    I += MAT_scratchTexture(p*1.34+5.3);
        
    return I;
}

float MAT_triplanarScratches(vec3 p, vec3 n)
{
    //Idea from http://http.developer.nvidia.com/GPUGems3/gpugems3_ch01.html
    //Figure 1-23 Triplanar Texturing
    float fTotal = abs(n.x)+abs(n.y)+abs(n.z);
    return ( abs(n.x)*MAT_layeredScratches(p.zy)
            +abs(n.y)*MAT_layeredScratches(p.xz)
            +abs(n.z)*MAT_layeredScratches(p.xy))/fTotal;
}

vec4 NOISE_trilinearWithDerivative(vec3 p)
{
    //Trilinear extension over noise derivative from (Elevated), & using the noise stacking trick from (Clouds).
	//Inspiration & Idea from :
    //https://www.shadertoy.com/view/MdX3Rr (Elevated)
    //https://www.shadertoy.com/view/XslGRr (Clouds)
    
    //For more information, see also:
    //NoiseVolumeExplained : https://www.shadertoy.com/view/XsyGWz
	//2DSignalDerivativeViewer : https://www.shadertoy.com/view/ldGGDR
    
    const float TEXTURE_RES = 256.0; //Noise texture resolution
    vec3 pixCoord = floor(p);//Pixel coord, integer [0,1,2,3...256...]
    //noise volume stacking trick : g layer = r layer shifted by (37x17 pixels)
    //(37x17)-> this value is the actual translation embedded in the noise texture, can't get around it.
	//Note : shift is different from g to b layer (but it also works)
    vec2 layer_translation = -pixCoord.z*vec2(37.0,17.0)/TEXTURE_RES; 
    
    vec2 c1 = texture(iChannel3,layer_translation+(pixCoord.xy+vec2(0,0)+0.5)/TEXTURE_RES,-100.0).rg;
    vec2 c2 = texture(iChannel3,layer_translation+(pixCoord.xy+vec2(1,0)+0.5)/TEXTURE_RES,-100.0).rg; //+x
    vec2 c3 = texture(iChannel3,layer_translation+(pixCoord.xy+vec2(0,1)+0.5)/TEXTURE_RES,-100.0).rg; //+z
    vec2 c4 = texture(iChannel3,layer_translation+(pixCoord.xy+vec2(1,1)+0.5)/TEXTURE_RES,-100.0).rg; //+x+z
    
    vec3 x = p-pixCoord; //Pixel interpolation position, linear range [0-1] (fractional part)
    
    vec3 x2 = x*x;
    vec3 t = (6.*x2-15.0*x+10.)*x*x2; //Quintic ease-in/ease-out function.
    vec3 d_xyz = (30.*x2-60.*x+30.)*x2; //dt/dx : Ease-in ease-out derivative.
    
    //Lower quad corners
    float a = c1.x; //(x+0,y+0,z+0)
    float b = c2.x; //(x+1,y+0,z+0)
    float c = c3.x; //(x+0,y+1,z+0)
    float d = c4.x; //(x+1,y+1,z+0)
    
    //Upper quad corners
    float e = c1.y; //(x+0,y+0,z+1)
    float f = c2.y; //(x+1,y+0,z+1)
    float g = c3.y; //(x+0,y+1,z+1)
    float h = c4.y; //(x+1,y+1,z+1)
    
    //Trilinear noise interpolation : (1-t)*v1+(t)*v2, repeated along the 3 axis of the interpolation cube.
    float za = ((a+(b-a)*t.x)*(1.-t.y)
               +(c+(d-c)*t.x)*(   t.y));
    float zb = ((e+(f-e)*t.x)*(1.-t.y)
               +(g+(h-g)*t.x)*(   t.y));
    float value = (1.-t.z)*za+t.z*zb;
    
    //Derivative scaling (texture lookup slope, along interpolation cross sections).
    //This could be factorized/optimized but I fear it would make it cryptic.
    float sx =  ((b-a)+t.y*(a-b-c+d))*(1.-t.z)
               +((f-e)+t.y*(e-f-g+h))*(   t.z);
    float sy =  ((c-a)+t.x*(a-b-c+d))*(1.-t.z)
               +((g-e)+t.x*(e-f-g+h))*(   t.z);
    float sz =  zb-za;
    
    return vec4(value,d_xyz*vec3(sx,sy,sz));
}

float ROUGHNESS_MAP_UV_SCALE = 6.00;//Valid range : [0.1-100.0]

//Stacked perlin noise
vec3 NOISE_volumetricRoughnessMap(vec3 p, float rayLen)
{
    vec4 sliderVal = vec4(0.5,0.85,0,0.5);
    ROUGHNESS_MAP_UV_SCALE *= 0.1*pow(10.,2.0*sliderVal[0]);
    
    float f = iTime;
    const mat3 R1  = mat3(0.500, 0.000, -.866,
	                     0.000, 1.000, 0.000,
                          .866, 0.000, 0.500);
    const mat3 R2  = mat3(1.000, 0.000, 0.000,
	                      0.000, 0.500, -.866,
                          0.000,  .866, 0.500);
    const mat3 R = R1*R2;
    p *= ROUGHNESS_MAP_UV_SCALE;
    p = R1*p;
    vec4 v1 = NOISE_trilinearWithDerivative(p);
    p = R1*p*2.021;
    vec4 v2 = NOISE_trilinearWithDerivative(p);
    p = R1*p*2.021+1.204*v1.xyz;
    vec4 v3 = NOISE_trilinearWithDerivative(p);
    p = R1*p*2.021+0.704*v2.xyz;
    vec4 v4 = NOISE_trilinearWithDerivative(p);
    
    return (v1
	      +0.5*(v2+0.25)
	      +0.4*(v3+0.25)
	      +0.6*(v4+0.25)).yzw;
}

void processSliders(in vec2 fragCoord)
{
    vec4 sliderVal = texture(iChannel0,vec2(0,0));
	ROUGHNESS_MAP_UV_SCALE *= 0.1*pow(10.,2.0*sliderVal[0]);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    processSliders(fragCoord);
    vec2 uv = 3.0*fragCoord.xy/iResolution.xy;
    vec3 roughnessNoise = NOISE_volumetricRoughnessMap(vec3(2.0*uv,0),1.0).rgb;
    float scratchTex = MAT_scratchTexture(2.0*uv);
    scratchTex += MAT_layeredScratches(uv+0.25);
    scratchTex += MAT_layeredScratches(1.7*uv+vec2(0.35));
    scratchTex += MAT_scratchTexture(uv+vec2(1.15));
    scratchTex += MAT_scratchTexture(uv+vec2(2.75));
    fragColor = vec4(roughnessNoise,scratchTex*0.3);
}
`;

const fragment = `
// Author : SÃ©bastien BÃ©rubÃ©
// Created : Dec 2015
// Modified : Jan 2016
//
// A ShaderToy implementation of Image Based PBR Material.
// I struggled quite a bit with the TextureCubes available :
// 		-One is gamma corrected, the other is not.
//      -The skylight boundary between low and the high detail Cubemaps won't align
//       with each other, unless the sky color value is cranked up very much where saturated.
//       With the Cubemaps "HDR remapped", they finally aligned properly.
//       
// Importance Sampling is used, where mipmaps would usually be used in a game engine (much more efficient).
// I ended up using a mix between random samples and a fixed sampling pattern.
// Random sampling was too jittery, unless a very high sample count was used.
//
// Platic Materials lack a diffuse base. I have a WIP coming for this. It requires another cubemap lightness
// hemisphere integration, for the diffuse part. Should be done in a seperate pass, not to kill the framerate.
//
// Regarding the IBL version of the PBR Equation, I also struggled to balance lighting. Most articles
// and code examples are about point lights, and some pieces of code I found could not be used in the 
// IBL Scenario. A popular version of the geometric term as proposed by Disney, for example, has a modified "k" value 
// to "reduce hotness", which don't give good results with IBL (edges reflections, at grazing angles, would be
// too dark, see Unreal4 2013SiggraphPresentationsNotes pdf link p.3 below).
// Also, GGX Distribution term must not be used with IBL, because 1) it will look like garbage and 2)it makes no
// sense (for "perfect" reflection angles (H==N), GGX value goes to the stratosphere, which you really don't want
// with IBL). Energy conservation problems don't show as much with point lights, but they really do with Image Based
// Lighting.
//
// HDR Color was choosen arbitrarily. You can change from red to blue using the second rightmost slider.
// 
// Sources:
// https://de45xmedrsdbp.cloudfront.net/Resources/files/2013SiggraphPresentationsNotes-26915738.pdf
// https://seblagarde.wordpress.com/2011/08/17/feeding-a-physical-based-lighting-mode/
// http://blog.selfshadow.com/publications/s2012-shading-course/burley/s2012_pbs_disney_brdf_slides_v2.pdf
// https://www.youtube.com/watch?v=LP7HgIMv4Qo [impressive realtime materials with Substance, see 16m00s, 25m00s]
// http://sirkan.iit.bme.hu/~szirmay/fresnel.pdf
// http://www.codinglabs.net/article_physically_based_rendering_cook_torrance.aspx
// http://refractiveindex.info/?shelf=3d&book=liquids&page=water
// http://www.filmetrics.com/refractive-index-database/Al/Aluminium
// https://www.shadertoy.com/view/4djSRW Dave Hoskin's hash without sine
//
// License : Creative Commons Non-commercial (NC) license
//

//----------------------
// Constants 
const float GEO_MAX_DIST   = 50.0;
const int MATERIALID_SKY    = 2;
const int MATERIALID_SPHERE = 3;
const vec3  F_ALU_N  = vec3(1.600,0.912,0.695); //(Red ~ 670 nm; Green ~ 540 nm; Blue ~ 475 nm)
const vec3  F_ALU_K  = vec3(8.010,6.500,5.800); //(Red ~ 670 nm; Green ~ 540 nm; Blue ~ 475 nm)

//----------------------
// Slider bound globals. Use the slider, don't change the value here.
float ROUGHNESS_AMOUNT       = 0.85;//Valid range : [0-1] 0=shiny, 1=rough map
float SKY_COLOR              = 0.0; //[0.0=Red, 1.0=Blue)
float ABL_LIGHT_CONTRIBUTION = 0.0; //[0-1] Additional ABL Light Contribution

#define saturate(x) clamp(x,0.0,1.0)

//PBR Equation for both (IBL) or (ABL), plastic or metal.
vec3 PBR_Equation(vec3 V, vec3 L, vec3 N, float roughness, const vec3 ior_n, const vec3 ior_k, const bool metallic, const bool bIBL)
{
    float cosT = saturate( dot(L, N) );
    float sinT = sqrt( 1.0 - cosT * cosT);
	vec3 H = normalize(L+V);
	float NdotH = dot(N,H);//Nn.H;
	float NdotL = dot(N,L);//Nn.Ln;
	float VdotH = dot(V,H);//Vn.H;
    float NdotV = dot(N,V);//Nn.Vn;
    
    //Distribution Term
    float PI = 3.14159;
    float alpha2 = roughness * roughness;
    float NoH2 = NdotH * NdotH;
    float den = NoH2*(alpha2-1.0)+1.0;
    float D = 1.0; //Distribution term is externalized from IBL version
    if(!bIBL)
        D = (NdotH>0.)?alpha2/(PI*den*den):0.0; //GGX Distribution.
	
    //Fresnel Term
	vec3 F;
    if(metallic)
    {
        float cos_theta = 1.0-NdotV;
        F =  ((ior_n-1.)*(ior_n-1.)+ior_k*ior_k+4.*ior_n*pow(1.-cos_theta,5.))
		    /((ior_n+1.)*(ior_n+1.)+ior_k*ior_k);
    }
    else //Dielectric (Note: R/G/B do not really differ for dielectric materials)
    {
        float F0 = pow((1.0 - ior_n.x) / (1.0 + ior_n.x),2.0);
  		F = vec3(F0 + (1.-F0) * pow( 1. - VdotH, 5.));
    }
    
    //Geometric term (Source: Real Shading in Unreal Engine 4 2013 Siggraph Presentation p.3/59)
    //k = Schlick model (IBL) : Disney's modification to reduce hotness (point light)
    float k = bIBL?(roughness*roughness/2.0):(roughness+1.)*(roughness+1.)/8.; 
    float Gl = max(NdotL,0.)/(NdotL*(1.0-k)+k);
    float Gv = max(NdotV,0.)/(NdotV*(1.0-k)+k);
    float G = Gl*Gv;
    
    float softTr = 0.1; // Valid range : [0.001-0.25]. Transition softness factor, close from dot(L,N) ~= 0
    float angleLim = 0.;//2.75; // Valid range : [0-0.75]. Compensates for IBL integration suface size.
    //sinT = 1.;
    if(bIBL)
        return (F*G*(angleLim+sinT)/(angleLim+1.0) / (4.*NdotV*saturate(NdotH)*(1.0-softTr)+softTr));
    else
        return D*F*G / (4.*NdotV*NdotL*(1.0-softTr)+softTr);
}

vec3 PBR_HDRremap(vec3 c)
{
    float fHDR = smoothstep(2.900,3.0,c.x+c.y+c.z);
    vec3 cRedSky   = mix(c,1.3*vec3(4.5,2.5,2.0),fHDR);
    vec3 cBlueSky  = mix(c,1.8*vec3(2.0,2.5,3.0),fHDR);
    return mix(cRedSky,cBlueSky,SKY_COLOR);
}

vec3 PBR_HDRCubemap(vec3 sampleDir, float LOD_01)
{
    // vec3 linearGammaColor_sharp = PBR_HDRremap(pow(texture( iChannel2, sampleDir ).rgb,vec3(2.2)));
    // vec3 linearGammaColor_blur  = PBR_HDRremap(pow(texture( iChannel3, sampleDir ).rgb,vec3(1)));
    // vec3 linearGammaColor = mix(linearGammaColor_sharp,linearGammaColor_blur,saturate(LOD_01));
    // return linearGammaColor; 颜色
    return vec3(1, 1, 1);
    // return texture(iChannel3, sampleDir.xy).rgb;
}

//Arbitrary axis rotation (around u, normalized)
mat3 PBR_axisRotationMatrix( vec3 u, float ct, float st ) //u=axis, co=cos(t), st=sin(t)
{
    return mat3(  ct+u.x*u.x*(1.-ct),     u.x*u.y*(1.-ct)-u.z*st, u.x*u.z*(1.-ct)+u.y*st,
	              u.y*u.x*(1.-ct)+u.z*st, ct+u.y*u.y*(1.-ct),     u.y*u.z*(1.-ct)-u.x*st,
	              u.z*u.x*(1.-ct)-u.y*st, u.z*u.y*(1.-ct)+u.x*st, ct+u.z*u.z*(1.-ct) );
}

vec3 PBR_importanceSampling(vec3 sampleDir, float roughness, float e1, float e2, out float range)
{
    const float PI = 3.14159;
    range = atan( roughness*sqrt(e1)/sqrt(1.0-e1) );
    float phi = 2.0*PI*e2;
    //Improve this? https://blog.selfshadow.com/2011/10/17/perp-vectors/
    vec3 notColinear   = (abs(sampleDir.y)<0.8)?vec3(0,1,0):vec3(1,0,0);
    vec3 othogonalAxis = normalize(cross(notColinear,sampleDir));
	mat3 m1 = PBR_axisRotationMatrix(normalize(othogonalAxis), cos(range), sin(range));
	mat3 m2 = PBR_axisRotationMatrix(normalize(sampleDir),     cos(phi),   sin(phi));
	return sampleDir*m1*m2;
}

vec3 PBR_visitSamples(vec3 V, vec3 N, float roughness, bool metallic, vec3 ior_n, vec3 ior_k )
{
    const float MIPMAP_SWITCH  = 0.29; //sampling angle delta (rad) equivalent to the lowest LOD.
    const ivec2 SAMPLE_COUNT = ivec2(05,15); //(5 random, 15 fixed) samples
    const vec2 weight = vec2(1./float(SAMPLE_COUNT.x),1./float(SAMPLE_COUNT.y));
    float angularRange = 0.;    
    vec3 vCenter = reflect(-V,N);
    
    //Randomized Samples : more realistic, but jittery
    float randomness_range = 0.75; //Cover only the closest 75% of the distribution. Reduces range, but improves stability.
    float fIdx = 0.0;              //valid range = [0.5-1.0]. Note : it is physically correct at 1.0.
    vec3 totalRandom = vec3(0.0);
    for(int i=0; i < SAMPLE_COUNT[0]; ++i)
    {
        //Random noise from DaveHoskin's hash without sine : https://www.shadertoy.com/view/4djSRW
        vec3 p3 = fract(vec3(fIdx*10.0+vCenter.xyx*100.0) * vec3(.1031,.11369,.13787)); 
    	p3 += dot(p3.zxy, p3.yzx+19.19);
    	vec2 jitter = fract(vec2((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y));
        vec3 sampleDir    = PBR_importanceSampling(vCenter, roughness, jitter.x*randomness_range, jitter.y, angularRange);
        vec3 sampleColor  = PBR_HDRCubemap( sampleDir, angularRange/MIPMAP_SWITCH);
        vec3 contribution = PBR_Equation(V, sampleDir, N, roughness, ior_n, ior_k, metallic, true)*weight[0];
    	totalRandom += contribution*sampleColor;
		++fIdx;
    }
    
    //Fixed Samples : More stable, but can create sampling pattern artifacts (revealing the sampling pattern)
    fIdx = 0.0;
    vec3 totalFixed = vec3(0.0);
    for(int i=0; i < SAMPLE_COUNT[1]; ++i)
    {
        vec2 jitter = vec2( clamp(weight[1]*fIdx,0.0,0.50), fract(weight[1]*fIdx*1.25)+3.14*fIdx); //Fixed sampling pattern.
        vec3 sampleDir    = PBR_importanceSampling(vCenter, roughness, jitter.x, jitter.y, angularRange);
        vec3 sampleColor  = PBR_HDRCubemap( sampleDir, angularRange/MIPMAP_SWITCH);
        vec3 contribution = PBR_Equation(V, sampleDir, N, roughness, ior_n, ior_k, metallic, true)*weight[1];
        totalFixed += contribution*sampleColor;
		++fIdx;
    }
    
    return (totalRandom*weight[1]+totalFixed*weight[0])/(weight[0]+weight[1]);
}

vec4 MAT_triplanarTexturing(vec3 p, vec3 n)
{
    p = fract(p+0.5);
    
    float sw = 0.20; //stiching width
    vec3 stitchingFade = vec3(1.)-smoothstep(vec3(0.5-sw),vec3(0.5),abs(p-0.5));
    
    float fTotal = abs(n.x)+abs(n.y)+abs(n.z);
    vec4 cX = abs(n.x)*texture(iChannel1,p.zy);
    vec4 cY = abs(n.y)*texture(iChannel1,p.xz);
    vec4 cZ = abs(n.z)*texture(iChannel1,p.xy);
    
    return  vec4(stitchingFade.y*stitchingFade.z*cX.rgb
                +stitchingFade.x*stitchingFade.z*cY.rgb
                +stitchingFade.x*stitchingFade.y*cZ.rgb,cX.a+cY.a+cZ.a)/fTotal;
}

struct TraceData
{
    float rayLen; //Run Distance
    vec3  rayDir; //Run Direction
    vec3  normal; //Hit normal
    int   matID;  //Hit material ID
};

//The main material function.
vec3 MAT_apply(vec3 pos, TraceData traceData)
{
    //Roughness texture
    vec4 roughnessBuffer = MAT_triplanarTexturing(pos*1.5,traceData.normal);
    roughnessBuffer += MAT_triplanarTexturing(pos*1.5+0.75,traceData.normal);
    float roughness = (roughnessBuffer.x+roughnessBuffer.y+roughnessBuffer.z)/3.0;
    roughness = roughnessBuffer.w+saturate(roughness-1.00+ROUGHNESS_AMOUNT)*0.25;
    
    //IBL and ABL PBR Lighting
    vec3 rd  = traceData.rayDir;
    vec3 V = normalize(-traceData.rayDir);
    vec3 N = traceData.normal;
    vec3 L = normalize(vec3(1,1,0));
    vec3 col = PBR_visitSamples(V,N,roughness, true, F_ALU_N, F_ALU_K);
    vec3 L0  = PBR_Equation(V,L,N,roughness+0.01, F_ALU_N, F_ALU_K, true, false);
    col     += PBR_HDRremap(vec3(1))*L0*ABL_LIGHT_CONTRIBUTION;
    
    //Anti-aliasing trick (normal-based)
    // vec3 backgroundColor = pow(texture( iChannel2, traceData.rayDir ).xyz,vec3(2.2)); 背景
    vec3 backgroundColor = vec3(1, 1, 1);
    float aaAmount = 0.095;
    float smoothFactor = 1.0-clamp(-dot(N,traceData.rayDir)/(aaAmount), 0.0, 1.0);
    col = (dot(N,-traceData.rayDir)<aaAmount)? mix(col, backgroundColor, smoothFactor) : col;
    
    return traceData.matID==MATERIALID_SKY?backgroundColor:col;
}

float map( in vec3 pos )
{
    const float GEO_SPHERE_RAD = 0.5;
    return length(pos)-GEO_SPHERE_RAD;
}

//o=ray origin, d=ray direction
TraceData TRACE_geometry(vec3 o, vec3 d)
{
    float t = 0.0;
    float tmax = GEO_MAX_DIST;
    float dist = GEO_MAX_DIST;
    for( int i=0; i<50; i++ )
    {
	    dist = map( o+d*t );
        if( abs(dist)<0.001 || t>GEO_MAX_DIST ) break;
        t += dist;
    }
    
    vec3 dfHitPosition  = o+t*d;
    bool bBackground = (dist>0.01 || t>GEO_MAX_DIST);
    
    return TraceData(t,d,normalize(dfHitPosition),bBackground?MATERIALID_SKY:MATERIALID_SPHERE);
}

vec4 processSliders(in vec2 fragCoord)
{
    vec4 sliderVal = texture(iChannel0,vec2(0,0));
	ROUGHNESS_AMOUNT        = sliderVal[1];
    SKY_COLOR               = sliderVal[2];
    ABL_LIGHT_CONTRIBUTION  = sliderVal[3];
    
    if(length(fragCoord.xy-vec2(0,0))>1.)
    {
    	return texture(iChannel0,fragCoord.xy/iResolution.xy);
    }
    return vec4(0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    //Camera & setup
    vec4 cSlider = processSliders(fragCoord);
    float rotX = ((iMouse.z>0.)&&any(lessThan(iMouse.xy/iResolution.xy,vec2(0.9,0.80))))?
	             ((iMouse.x/iResolution.x)*2.0*3.14) : (iTime*0.3);
    vec2 uv = 2.5*(fragCoord.xy-0.5*iResolution.xy) / iResolution.xx;
    vec3 camO = vec3(cos(rotX),0.4,sin(rotX))*0.95;
    vec3 camD = normalize(vec3(0)-camO);
    vec3 camR = normalize(cross(camD,vec3(0,1,0)));
    vec3 camU = cross(camR,camD);
   	vec3 dir =  normalize(uv.x*camR+uv.y*camU+camD);
    
    //Raytrace
    TraceData geometryTraceData = TRACE_geometry(camO, dir);
    vec3 ptGeo = (geometryTraceData.rayLen < GEO_MAX_DIST)? camO+dir*geometryTraceData.rayLen : vec3(0);
    
    //Material
    vec3 c = MAT_apply(ptGeo,geometryTraceData).xyz;
    
    //Post-processing
    float sin2 = dot(uv/1.6,uv/1.6);
    float vignetting = pow(1.0-min(sin2*sin2,1.0),2.);
    c = pow(c*vignetting,vec3(0.4545)); //2.2 Gamma compensation
    
    //Slider overlay
    fragColor = vec4(mix(c,cSlider.rgb,cSlider.a),1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'ld3SRr';
  }
  name(): string {
    return 'Image Based PBR Material 颜色背景';
  }
  // sort() {
  //   return 0;
  // }
  tags?(): string[] {
    return [];
  }
  webgl() {
    return WEBGL_2;
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
      webglUtils.DEFAULT_NOISE3,
      webglUtils.DEFAULT_NOISE,
    ];
  }
}
