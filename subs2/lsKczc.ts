import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const common = `
#define PI 3.141592654
#define TAU (PI * 2.0)

#define NO_UNROLL(X) (X + min(0,iFrame))
#define NO_UNROLLF(X) (X + (min(0.,iTime)))
#define NO_UNROLLU(X) (X + uint(min(0,iFrame)))

// http://www.cie.co.at/technical-work/technical-resources
vec3 standardObserver1931[] =
    vec3[] (
    vec3( 0.001368, 0.000039, 0.006450 ), // 380 nm
    vec3( 0.002236, 0.000064, 0.010550 ), // 385 nm
    vec3( 0.004243, 0.000120, 0.020050 ), // 390 nm
    vec3( 0.007650, 0.000217, 0.036210 ), // 395 nm
    vec3( 0.014310, 0.000396, 0.067850 ), // 400 nm
    vec3( 0.023190, 0.000640, 0.110200 ), // 405 nm
    vec3( 0.043510, 0.001210, 0.207400 ), // 410 nm
    vec3( 0.077630, 0.002180, 0.371300 ), // 415 nm
    vec3( 0.134380, 0.004000, 0.645600 ), // 420 nm
    vec3( 0.214770, 0.007300, 1.039050 ), // 425 nm
    vec3( 0.283900, 0.011600, 1.385600 ), // 430 nm
    vec3( 0.328500, 0.016840, 1.622960 ), // 435 nm
    vec3( 0.348280, 0.023000, 1.747060 ), // 440 nm
    vec3( 0.348060, 0.029800, 1.782600 ), // 445 nm
    vec3( 0.336200, 0.038000, 1.772110 ), // 450 nm
    vec3( 0.318700, 0.048000, 1.744100 ), // 455 nm
    vec3( 0.290800, 0.060000, 1.669200 ), // 460 nm
    vec3( 0.251100, 0.073900, 1.528100 ), // 465 nm
    vec3( 0.195360, 0.090980, 1.287640 ), // 470 nm
    vec3( 0.142100, 0.112600, 1.041900 ), // 475 nm
    vec3( 0.095640, 0.139020, 0.812950 ), // 480 nm
    vec3( 0.057950, 0.169300, 0.616200 ), // 485 nm
    vec3( 0.032010, 0.208020, 0.465180 ), // 490 nm
    vec3( 0.014700, 0.258600, 0.353300 ), // 495 nm
    vec3( 0.004900, 0.323000, 0.272000 ), // 500 nm
    vec3( 0.002400, 0.407300, 0.212300 ), // 505 nm
    vec3( 0.009300, 0.503000, 0.158200 ), // 510 nm
    vec3( 0.029100, 0.608200, 0.111700 ), // 515 nm
    vec3( 0.063270, 0.710000, 0.078250 ), // 520 nm
    vec3( 0.109600, 0.793200, 0.057250 ), // 525 nm
    vec3( 0.165500, 0.862000, 0.042160 ), // 530 nm
    vec3( 0.225750, 0.914850, 0.029840 ), // 535 nm
    vec3( 0.290400, 0.954000, 0.020300 ), // 540 nm
    vec3( 0.359700, 0.980300, 0.013400 ), // 545 nm
    vec3( 0.433450, 0.994950, 0.008750 ), // 550 nm
    vec3( 0.512050, 1.000000, 0.005750 ), // 555 nm
    vec3( 0.594500, 0.995000, 0.003900 ), // 560 nm
    vec3( 0.678400, 0.978600, 0.002750 ), // 565 nm
    vec3( 0.762100, 0.952000, 0.002100 ), // 570 nm
    vec3( 0.842500, 0.915400, 0.001800 ), // 575 nm
    vec3( 0.916300, 0.870000, 0.001650 ), // 580 nm
    vec3( 0.978600, 0.816300, 0.001400 ), // 585 nm
    vec3( 1.026300, 0.757000, 0.001100 ), // 590 nm
    vec3( 1.056700, 0.694900, 0.001000 ), // 595 nm
    vec3( 1.062200, 0.631000, 0.000800 ), // 600 nm
    vec3( 1.045600, 0.566800, 0.000600 ), // 605 nm
    vec3( 1.002600, 0.503000, 0.000340 ), // 610 nm
    vec3( 0.938400, 0.441200, 0.000240 ), // 615 nm
    vec3( 0.854450, 0.381000, 0.000190 ), // 620 nm
    vec3( 0.751400, 0.321000, 0.000100 ), // 625 nm
    vec3( 0.642400, 0.265000, 0.000050 ), // 630 nm
    vec3( 0.541900, 0.217000, 0.000030 ), // 635 nm
    vec3( 0.447900, 0.175000, 0.000020 ), // 640 nm
    vec3( 0.360800, 0.138200, 0.000010 ), // 645 nm
    vec3( 0.283500, 0.107000, 0.000000 ), // 650 nm
    vec3( 0.218700, 0.081600, 0.000000 ), // 655 nm
    vec3( 0.164900, 0.061000, 0.000000 ), // 660 nm
    vec3( 0.121200, 0.044580, 0.000000 ), // 665 nm
    vec3( 0.087400, 0.032000, 0.000000 ), // 670 nm
    vec3( 0.063600, 0.023200, 0.000000 ), // 675 nm
    vec3( 0.046770, 0.017000, 0.000000 ), // 680 nm
    vec3( 0.032900, 0.011920, 0.000000 ), // 685 nm
    vec3( 0.022700, 0.008210, 0.000000 ), // 690 nm
    vec3( 0.015840, 0.005723, 0.000000 ), // 695 nm
    vec3( 0.011359, 0.004102, 0.000000 ), // 700 nm
    vec3( 0.008111, 0.002929, 0.000000 ), // 705 nm
    vec3( 0.005790, 0.002091, 0.000000 ), // 710 nm
    vec3( 0.004109, 0.001484, 0.000000 ), // 715 nm
    vec3( 0.002899, 0.001047, 0.000000 ), // 720 nm
    vec3( 0.002049, 0.000740, 0.000000 ), // 725 nm
    vec3( 0.001440, 0.000520, 0.000000 ), // 730 nm
    vec3( 0.001000, 0.000361, 0.000000 ), // 735 nm
    vec3( 0.000690, 0.000249, 0.000000 ), // 740 nm
    vec3( 0.000476, 0.000172, 0.000000 ), // 745 nm
    vec3( 0.000332, 0.000120, 0.000000 ), // 750 nm
    vec3( 0.000235, 0.000085, 0.000000 ), // 755 nm
    vec3( 0.000166, 0.000060, 0.000000 ), // 760 nm
    vec3( 0.000117, 0.000042, 0.000000 ), // 765 nm
    vec3( 0.000083, 0.000030, 0.000000 ), // 770 nm
    vec3( 0.000059, 0.000021, 0.000000 ), // 775 nm
    vec3( 0.000042, 0.000015, 0.000000 )  // 780 nm
);
float standardObserver1931_w_min = 380.0f;
float standardObserver1931_w_max = 780.0f;
int standardObserver1931_length = 81;

// http://www.cvrl.org/ Cone Fundamentals
vec3 coneFundamentals[] =
	vec3[] (
	vec3( 0.000000000,  0.000000000,  0.000000000 ), // 380 nm
	vec3( 0.000000000,  0.000000000,  0.000000000 ), // 385 nm
	vec3( 4.15003E-04,  3.68349E-04,  9.54729E-03 ), // 390 nm
	vec3( 1.05192E-03,  9.58658E-04,  2.38250E-02 ), // 395 nm
	vec3( 2.40836E-03,  2.26991E-03,  5.66498E-02 ), // 400 nm
	vec3( 4.83339E-03,  4.70010E-03,  1.22451E-01 ), // 405 nm
	vec3( 8.72127E-03,  8.79369E-03,  2.33008E-01 ), // 410 nm
	vec3( 1.33837E-02,  1.45277E-02,  3.81363E-01 ), // 415 nm
	vec3( 1.84480E-02,  2.16649E-02,  5.43618E-01 ), // 420 nm
	vec3( 2.29317E-02,  2.95714E-02,  6.74474E-01 ), // 425 nm
	vec3( 2.81877E-02,  3.94566E-02,  8.02555E-01 ), // 430 nm
	vec3( 3.41054E-02,  5.18199E-02,  9.03573E-01 ), // 435 nm
	vec3( 4.02563E-02,  6.47782E-02,  9.91020E-01 ), // 440 nm
	vec3( 4.49380E-02,  7.58812E-02,  9.91515E-01 ), // 445 nm
	vec3( 4.98639E-02,  8.70524E-02,  9.55393E-01 ), // 450 nm
	vec3( 5.53418E-02,  9.81934E-02,  8.60240E-01 ), // 455 nm
	vec3( 6.47164E-02,  1.16272E-01,  7.86704E-01 ), // 460 nm
	vec3( 8.06894E-02,  1.44541E-01,  7.38268E-01 ), // 465 nm
	vec3( 9.94755E-02,  1.75893E-01,  6.46359E-01 ), // 470 nm
	vec3( 1.18802E-01,  2.05398E-01,  5.16411E-01 ), // 475 nm
	vec3( 1.40145E-01,  2.35754E-01,  3.90333E-01 ), // 480 nm
	vec3( 1.63952E-01,  2.68063E-01,  2.90322E-01 ), // 485 nm
	vec3( 1.91556E-01,  3.03630E-01,  2.11867E-01 ), // 490 nm
	vec3( 2.32926E-01,  3.57061E-01,  1.60526E-01 ), // 495 nm
	vec3( 2.88959E-01,  4.27764E-01,  1.22839E-01 ), // 500 nm
	vec3( 3.59716E-01,  5.15587E-01,  8.88965E-02 ), // 505 nm
	vec3( 4.43683E-01,  6.15520E-01,  6.08210E-02 ), // 510 nm
	vec3( 5.36494E-01,  7.19154E-01,  4.28123E-02 ), // 515 nm
	vec3( 6.28561E-01,  8.16610E-01,  2.92033E-02 ), // 520 nm
	vec3( 7.04720E-01,  8.85550E-01,  1.93912E-02 ), // 525 nm
	vec3( 7.70630E-01,  9.35687E-01,  1.26013E-02 ), // 530 nm
	vec3( 8.25711E-01,  9.68858E-01,  8.09453E-03 ), // 535 nm
	vec3( 8.81011E-01,  9.95217E-01,  5.08900E-03 ), // 540 nm
	vec3( 9.19067E-01,  9.97193E-01,  3.16893E-03 ), // 545 nm
	vec3( 9.40198E-01,  9.77193E-01,  1.95896E-03 ), // 550 nm
	vec3( 9.65733E-01,  9.56583E-01,  1.20277E-03 ), // 555 nm
	vec3( 9.81445E-01,  9.17750E-01,  7.40174E-04 ), // 560 nm
	vec3( 9.94486E-01,  8.73205E-01,  4.55979E-04 ), // 565 nm
	vec3( 9.99993E-01,  8.13509E-01,  2.81800E-04 ), // 570 nm
	vec3( 9.92310E-01,  7.40291E-01,  1.75039E-04 ), // 575 nm
	vec3( 9.69429E-01,  6.53274E-01,  1.09454E-04 ), // 580 nm
	vec3( 9.55602E-01,  5.72597E-01,  6.89991E-05 ), // 585 nm
	vec3( 9.27673E-01,  4.92599E-01,  4.39024E-05 ), // 590 nm
	vec3( 8.85969E-01,  4.11246E-01,  2.82228E-05 ), // 595 nm
	vec3( 8.33982E-01,  3.34429E-01,  1.83459E-05 ), // 600 nm
	vec3( 7.75103E-01,  2.64872E-01,  1.20667E-05 ), // 605 nm
	vec3( 7.05713E-01,  2.05273E-01,  8.03488E-06 ), // 610 nm
	vec3( 6.30773E-01,  1.56243E-01,  5.41843E-06 ), // 615 nm
	vec3( 5.54224E-01,  1.16641E-01,  0.000000000 ), // 620 nm
	vec3( 4.79941E-01,  8.55872E-02,  0.000000000 ), // 625 nm
	vec3( 4.00711E-01,  6.21120E-02,  0.000000000 ), // 630 nm
	vec3( 3.27864E-01,  4.44879E-02,  0.000000000 ), // 635 nm
	vec3( 2.65784E-01,  3.14282E-02,  0.000000000 ), // 640 nm
	vec3( 2.13284E-01,  2.18037E-02,  0.000000000 ), // 645 nm
	vec3( 1.65141E-01,  1.54480E-02,  0.000000000 ), // 650 nm
	vec3( 1.24749E-01,  1.07120E-02,  0.000000000 ), // 655 nm
	vec3( 9.30085E-02,  7.30255E-03,  0.000000000 ), // 660 nm
	vec3( 6.85100E-02,  4.97179E-03,  0.000000000 ), // 665 nm
	vec3( 4.98661E-02,  3.43667E-03,  0.000000000 ), // 670 nm
	vec3( 3.58233E-02,  2.37617E-03,  0.000000000 ), // 675 nm
	vec3( 2.53790E-02,  1.63734E-03,  0.000000000 ), // 680 nm
	vec3( 1.77201E-02,  1.12128E-03,  0.000000000 ), // 685 nm
	vec3( 1.21701E-02,  7.61051E-04,  0.000000000 ), // 690 nm
	vec3( 8.47170E-03,  5.25457E-04,  0.000000000 ), // 695 nm
	vec3( 5.89749E-03,  3.65317E-04,  0.000000000 ), // 700 nm
	vec3( 4.09129E-03,  2.53417E-04,  0.000000000 ), // 705 nm
	vec3( 2.80447E-03,  1.74402E-04,  0.000000000 ), // 710 nm
	vec3( 1.92058E-03,  1.20608E-04,  0.000000000 ), // 715 nm
	vec3( 1.32687E-03,  8.41716E-05,  0.000000000 ), // 720 nm
	vec3( 9.17777E-04,  5.89349E-05,  0.000000000 ), // 725 nm
	vec3( 6.39373E-04,  4.16049E-05,  0.000000000 ), // 730 nm
	vec3( 4.46035E-04,  2.94354E-05,  0.000000000 ), // 735 nm
	vec3( 3.10869E-04,  2.08860E-05,  0.000000000 ), // 740 nm
	vec3( 2.19329E-04,  1.50458E-05,  0.000000000 ), // 745 nm
	vec3( 1.54549E-04,  1.08200E-05,  0.000000000 ), // 750 nm
	vec3( 1.09508E-04,  7.82271E-06,  0.000000000 ), // 755 nm
	vec3( 7.79912E-05,  5.69093E-06,  0.000000000 ), // 760 nm
	vec3( 5.56264E-05,  4.13998E-06,  0.000000000 ), // 765 nm
	vec3( 3.99295E-05,  3.02683E-06,  0.000000000 ), // 770 nm
	vec3( 2.86163E-05,  2.21100E-06,  0.000000000 ), // 775 nm
	vec3( 2.07321E-05,  1.63433E-06,  0.000000000 )  // 780 nm
);


// http://www.cvrl.org/ luminous efficiency
float luminousEfficiency[] =
    float[] (
    0.0,      // 380 nm
    0.0,      // 385 nm
    4.15E-04, // 390 nm
    1.06E-03, // 395 nm
    2.45E-03, // 400 nm
    4.97E-03, // 405 nm
    9.08E-03, // 410 nm
    1.43E-02, // 415 nm
    2.03E-02, // 420 nm
    2.61E-02, // 425 nm
    3.32E-02, // 430 nm
    4.16E-02, // 435 nm
    5.03E-02, // 440 nm
    5.74E-02, // 445 nm
    6.47E-02, // 450 nm
    7.24E-02, // 455 nm
    8.51E-02, // 460 nm
    1.06E-01, // 465 nm
    1.30E-01, // 470 nm
    1.54E-01, // 475 nm
    1.79E-01, // 480 nm
    2.06E-01, // 485 nm
    2.38E-01, // 490 nm
    2.85E-01, // 495 nm
    3.48E-01, // 500 nm
    4.28E-01, // 505 nm
    5.20E-01, // 510 nm
    6.21E-01, // 515 nm
    7.18E-01, // 520 nm
    7.95E-01, // 525 nm
    8.58E-01, // 530 nm
    9.07E-01, // 535 nm
    9.54E-01, // 540 nm
    9.81E-01, // 545 nm
    9.89E-01, // 550 nm
    9.99E-01, // 555 nm
    9.97E-01, // 560 nm
    9.90E-01, // 565 nm
    9.73E-01, // 570 nm
    9.42E-01, // 575 nm
    8.96E-01, // 580 nm
    8.59E-01, // 585 nm
    8.12E-01, // 590 nm
    7.54E-01, // 595 nm
    6.92E-01, // 600 nm
    6.27E-01, // 605 nm
    5.58E-01, // 610 nm
    4.90E-01, // 615 nm
    4.23E-01, // 620 nm
    3.61E-01, // 625 nm
    2.98E-01, // 630 nm
    2.42E-01, // 635 nm
    1.94E-01, // 640 nm
    1.55E-01, // 645 nm
    1.19E-01, // 650 nm
    8.98E-02, // 655 nm
    6.67E-02, // 660 nm
    4.90E-02, // 665 nm
    3.56E-02, // 670 nm
    2.55E-02, // 675 nm
    1.81E-02, // 680 nm
    1.26E-02, // 685 nm
    8.66E-03, // 690 nm
    6.03E-03, // 695 nm
    4.20E-03, // 700 nm
    2.91E-03, // 705 nm
    2.00E-03, // 710 nm
    1.37E-03, // 715 nm
    9.45E-04, // 720 nm
    6.54E-04, // 725 nm
    4.56E-04, // 730 nm
    3.18E-04, // 735 nm
    2.22E-04, // 740 nm
    1.57E-04, // 745 nm
    1.10E-04, // 750 nm
    7.83E-05, // 755 nm
    5.58E-05, // 760 nm
    3.98E-05, // 765 nm
    2.86E-05, // 770 nm
    2.05E-05, // 775 nm
    1.49E-05  // 780 nm        
);

vec3 WavelengthToXYZLinear( float fWavelength )
{
    float fPos = ( fWavelength - standardObserver1931_w_min ) / (standardObserver1931_w_max - standardObserver1931_w_min);
    float fIndex = fPos * float(standardObserver1931_length);
    float fFloorIndex = floor(fIndex);
    float fBlend = clamp( fIndex - fFloorIndex, 0.0, 1.0 );
    int iIndex0 = int(fFloorIndex);
    int iIndex1 = iIndex0 + 1;
    iIndex0 = min( iIndex0, standardObserver1931_length - 1);
    iIndex1 = min( iIndex1, standardObserver1931_length - 1);    
    return mix( standardObserver1931[iIndex0], standardObserver1931[iIndex1], fBlend );
}

vec3 WavelengthToConeLinear( float fWavelength )
{
    float fPos = ( fWavelength - standardObserver1931_w_min ) / (standardObserver1931_w_max - standardObserver1931_w_min);
    float fIndex = fPos * float(standardObserver1931_length);
    float fFloorIndex = floor(fIndex);
    float fBlend = clamp( fIndex - fFloorIndex, 0.0, 1.0 );
    int iIndex0 = int(fFloorIndex);
    int iIndex1 = iIndex0 + 1;
    iIndex0 = min( iIndex0, standardObserver1931_length - 1);
    iIndex1 = min( iIndex1, standardObserver1931_length - 1);    
    return mix( coneFundamentals[iIndex0], coneFundamentals[iIndex1], fBlend );
}

float WavelengthToLuminosityLinear( float fWavelength )
{
    float fPos = ( fWavelength - standardObserver1931_w_min ) / (standardObserver1931_w_max - standardObserver1931_w_min);
    float fIndex = fPos * float(standardObserver1931_length);
    float fFloorIndex = floor(fIndex);
    float fBlend = clamp( fIndex - fFloorIndex, 0.0, 1.0 );
    int iIndex0 = int(fFloorIndex);
    int iIndex1 = iIndex0 + 1;
    iIndex0 = min( iIndex0, standardObserver1931_length - 1);
    iIndex1 = min( iIndex1, standardObserver1931_length - 1);    
    return mix( luminousEfficiency[iIndex0], luminousEfficiency[iIndex1], fBlend );
}



vec3 WavelengthToRGBLinear( float fWavelength )
{
     mat3 m = mat3( 2.3706743, -0.9000405, -0.4706338,
	-0.5138850,  1.4253036,  0.0885814,
 	0.0052982, -0.0146949,  1.0093968 );
    return WavelengthToXYZLinear( fWavelength ) * m;
}

vec3 XYZtosRGB( vec3 XYZ )
{
    // XYZ to sRGB
    // http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html
   mat3 m = mat3 (
        3.2404542, -1.5371385, -0.4985314,
		-0.9692660,  1.8760108,  0.0415560,
 		0.0556434, -0.2040259,  1.0572252 );
    
    return XYZ * m;
}

vec3 sRGBtoXYZ( vec3 RGB )
{
   // sRGB to XYZ
   // http://www.brucelindbloom.com/index.html?Eqn_RGB_XYZ_Matrix.html

   mat3 m = mat3(  	0.4124564,  0.3575761, 0.1804375,
 					0.2126729,  0.7151522, 0.0721750,
 					0.0193339,  0.1191920, 0.9503041 );
    
    
    return RGB * m;
}

vec3 WavelengthToXYZ( float f )
{    
    //return xyzFit_1931( f ) * mXYZtoSRGB;
    
    return WavelengthToXYZLinear( f );
}


struct Chromaticities
{
    vec2 R, G, B, W;
};
    
vec3 CIE_xy_to_xyz( vec2 xy )
{
    return vec3( xy, 1.0f - xy.x - xy.y );
}

vec3 CIE_xyY_to_XYZ( vec3 CIE_xyY )
{
    float x = CIE_xyY[0];
    float y = CIE_xyY[1];
    float Y = CIE_xyY[2];
    
    float X = (Y / y) * x;
    float Z = (Y / y) * (1.0 - x - y);
        
	return vec3( X, Y, Z );        
}

vec3 CIE_XYZ_to_xyY( vec3 CIE_XYZ )
{
    float X = CIE_XYZ[0];
    float Y = CIE_XYZ[1];
    float Z = CIE_XYZ[2];
    
    float N = X + Y + Z;
    
    float x = X / N;
    float y = Y / N;
    float z = Z / N;
    
    return vec3(x,y,Y);
}

Chromaticities Primaries_Rec709 =
Chromaticities(
        vec2( 0.6400, 0.3300 ),	// R
        vec2( 0.3000, 0.6000 ),	// G
        vec2( 0.1500, 0.0600 ), 	// B
        vec2( 0.3127, 0.3290 ) );	// W

Chromaticities Primaries_Rec2020 =
Chromaticities(
        vec2( 0.708,  0.292 ),	// R
        vec2( 0.170,  0.797 ),	// G
        vec2( 0.131,  0.046 ),  	// B
        vec2( 0.3127, 0.3290 ) );	// W

Chromaticities Primaries_DCI_P3_D65 =
Chromaticities(
        vec2( 0.680,  0.320 ),	// R
        vec2( 0.265,  0.690 ),	// G
        vec2( 0.150,  0.060 ),  	// B
        vec2( 0.3127, 0.3290 ) );	// W

mat3 RGBtoXYZ( Chromaticities chroma )
{
    // xyz is a projection of XYZ co-ordinates onto to the plane x+y+z = 1
    // so we can reconstruct 'z' from x and y
    
    vec3 R = CIE_xy_to_xyz( chroma.R );
    vec3 G = CIE_xy_to_xyz( chroma.G );
    vec3 B = CIE_xy_to_xyz( chroma.B );
    vec3 W = CIE_xy_to_xyz( chroma.W );
    
    // We want vectors in the directions R, G and B to form the basis of
    // our matrix...
    
	mat3 mPrimaries = mat3 ( R, G, B );
    
    // but we want to scale R,G and B so they result in the
    // direction W when the matrix is multiplied by (1,1,1)
    
    vec3 W_XYZ = W / W.y;
	vec3 vScale = inverse( mPrimaries ) * W_XYZ;
    
    return transpose( mat3( R * vScale.x, G * vScale.y, B * vScale.z ) );
}

mat3 XYZtoRGB( Chromaticities chroma )
{
    return inverse( RGBtoXYZ(chroma) );
}

// chromatic adaptation

// http://www.brucelindbloom.com/index.html?Eqn_ChromAdapt.html    

vec3 XYZ_A = vec3( 1.09850,	1.00000,	0.35585); // Illuminant A
vec3 XYZ_E = vec3(1.0,	1.00000,	1.0); // E
vec3 XYZ_D65 = vec3(0.95047,	1.00000,	1.08883); // D65

mat3 CA_A_to_D65_VonKries = mat3(
    0.9394987, -0.2339150,  0.4281177,
	-0.0256939,  1.0263828,  0.0051761,
 	0.0000000,  0.0000000,  3.0598005
    );


mat3 CA_A_to_D65_Bradford = mat3(
    0.8446965, -0.1179225,  0.3948108,
	-0.1366303,  1.1041226,  0.1291718,
 	0.0798489, -0.1348999,  3.1924009
    );


const mat3 mCAT_VonKries = mat3 ( 
    0.4002400,  0.7076000, -0.0808100,
	-0.2263000,  1.1653200,  0.0457000,
 	0.0000000,  0.0000000,  0.9182200 );

const mat3 mCAT_02 = mat3( 	0.7328, 0.4296, -0.1624,
							-0.7036, 1.6975, 0.0061,
 							0.0030, 0.0136, 0.9834 );

const mat3 mCAT_Bradford = mat3 (  0.8951000, 0.2664000, -0.1614000,
								-0.7502000,  1.7135000,  0.0367000,
 								0.0389000, -0.0685000,  1.0296000 );


mat3 GetChromaticAdaptionTransform( mat3 M, vec3 XYZ_w, vec3 XYZ_wr )
{
    //return inverse(CA_A_to_D65_VonKries);    
    //return inverse(CA_A_to_D65_Bradford);
        
    //return mat3(1,0,0, 0,1,0, 0,0,1); // do nothing
    
	//mat3 M = mCAT_02;
    //mat3 M = mCAT_Bradford;
    //mat3 M = mCAT_VonKries;
    //mat3 M = mat3(1,0,0,0,1,0,0,0,1);
    
    vec3 w = XYZ_w * M;
    vec3 wr = XYZ_wr * M;
    vec3 s = w / wr;
    
    mat3 d = mat3( 
        s.x,	0,		0,  
        0,		s.y,	0,
        0,		0,		s.z );
        
    mat3 cat = M * d * inverse(M);
    return cat;
}



// DrawContext simple 2d drawing

struct DrawContext
{
    vec2 vUV;
    vec3 vResult;
    float fEdgeFade;
};

DrawContext DrawContext_Init( vec2 vUV, vec3 vClearColor )
{
    vec2 vWidth = fwidth( vUV );
    
    float fEdgeFade = 1.0 / max(abs(vWidth.x), abs(vWidth.y));
    return DrawContext( vUV, vClearColor, fEdgeFade );
}

bool DrawContext_OnCanvas( DrawContext drawContext )
{
    vec2 vUV = drawContext.vUV;
    if ( (vUV.x >= 0.0f) && (vUV.y >= 0.0f) && (vUV.x < 1.0f) && (vUV.y < 1.0f) ) 
    {    
    	return true;
    }
    return false;
}
    
float LineSmooth( DrawContext drawContext, float fDist, float fThickness )
{
    return clamp( (fThickness - fDist) * drawContext.fEdgeFade, 0.0, 1.0 );
}

float LineInfo( vec2 vUV, vec2 vA, vec2 vB, out vec2 vClosest )
{
    vec2 vDir = vB - vA;

    float fLen = length(vDir);

    float fDist = 10000.0;
    float fSide = -1.0;
    
    float fEpsilon = 0.002f;
    
    if ( fLen < fEpsilon )
    {
        vClosest = vA;
    }
    else
    {
        vDir /= fLen;            
        vec2 vOffset = vUV - vA.xy;            

        float cp = vDir.x * vOffset.y - vDir.y * vOffset.x;
        if ( cp > 0.0f )
        {
            fSide = 1.0;
        }

        float d = dot( vDir, vOffset );
        d = clamp( d, 0.0, fLen );
        vClosest = vA + vDir * d;
    }  
    fDist = length( vClosest - vUV );
    
    return fDist * fSide;
}


float LineInfo( vec2 vUV, vec2 vA, vec2 vB )
{
    vec2 vClosestUnused;
    return LineInfo( vUV, vA, vB, vClosestUnused );
}

void DrawBlend( inout DrawContext drawContext, vec3 vColor, float fBlend )
{
    drawContext.vResult = mix( drawContext.vResult, vColor, clamp( fBlend, 0.0, 1.0 ) );
}

void DrawOutlinePoint( inout DrawContext drawContext, vec3 vOutlineColor, vec3 vColor, vec2 vPos, float fStrokeThickness, float fOutlineThickness )
{
    float fDist = length( drawContext.vUV - vPos );
    
    DrawBlend( drawContext, vOutlineColor, LineSmooth( drawContext, fDist, fStrokeThickness + fOutlineThickness) );
    DrawBlend( drawContext, vColor, LineSmooth( drawContext, fDist, fStrokeThickness ) );  
}

bool InUnitSquare( vec2 vPos )
{
    return (vPos.x >= 0.0) && (vPos.y >= 0.0) && (vPos.x < 1.0) && (vPos.y < 1.0);
}


bool InRect( vec2 vPos, vec2 vA, vec2 vB )
{
    return (vPos.x >= vA.x) && (vPos.y >= vA.y) && (vPos.x < vB.x) && (vPos.y < vB.y);
}

void DrawRect( inout DrawContext drawContext, vec3 vColor, vec2 vA, vec2 vB )
{
    vec2 vUV = drawContext.vUV;
    
    if ( InRect( vUV, vA, vB ) )
    {    
    	drawContext.vResult = vColor;
    }
}

void DrawLine( inout DrawContext drawContext, vec3 vColor, vec2 vA, vec2 vB, float fThickness )
{
    DrawBlend( drawContext, vColor, LineSmooth( drawContext, abs(LineInfo( drawContext.vUV, vA, vB )), fThickness ) );
}

struct PolyInfo
{
	float fDist;
	float fEdgeDist;
};

PolyInfo Poly_Init()
{
    return PolyInfo( -10000.0f, 10000.0f );
}

void Poly_Edge( inout PolyInfo polyInfo, float fEdgeInfo )
{
    polyInfo.fDist = max( polyInfo.fDist, fEdgeInfo );
    polyInfo.fEdgeDist = min( polyInfo.fEdgeDist, abs( fEdgeInfo ) );
}




// Random


// For smaller input rangers like audio tick or 0-1 UVs use these...
#define HASHSCALE1 443.8975
#define HASHSCALE3 vec3(443.897, 441.423, 437.195)
#define HASHSCALE4 vec3(443.897, 441.423, 437.195, 444.129)


//----------------------------------------------------------------------------------------
//  1 out, 1 in...
float hash11(float p)
{
	vec3 p3  = fract(vec3(p) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

//  2 out, 1 in...
vec2 hash21(float p)
{
	vec3 p3 = fract(vec3(p) * HASHSCALE3);
	p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xx+p3.yz)*p3.zy);

}

///  2 out, 3 in...
vec2 hash23(vec3 p3)
{
	p3 = fract(p3 * HASHSCALE3);
    p3 += dot(p3, p3.yzx+19.19);
    return fract((p3.xx+p3.yz)*p3.zy);
}

//  1 out, 3 in...
float hash13(vec3 p3)
{
	p3  = fract(p3 * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

///  3 out, 3 in...
vec3 hash33(vec3 p3)
{
	p3 = fract(p3 * HASHSCALE3);
    p3 += dot(p3, p3.yxz+19.19);
    return fract((p3.xxy + p3.yxx)*p3.zyx);

}

float SmoothNoise(float o) 
{
	float p = floor(o);
	float f = fract(o);
		
	//float n = p.x + p.y*57.0;

	float a = hash11(p);
	float b = hash11(p+1.0);
	
	float f2 = f * f;
	float f3 = f2 * f;
	
	float t = 3.0 * f2 - 2.0 * f3;
	
	float res = a + (b-a)*t;
    
    return res;
}

float FBM( float p, float ps ) {
	float f = 0.0;
    float tot = 0.0;
    float a = 1.0;
    for( int i=0; i<5; i++)
    {
        f += SmoothNoise( p ) * a;
        p *= 2.0;
        tot += a;
        a *= ps;
    }
    return f / tot;
}

float DigitBin( const int x )
{
    return x==0?480599.0:x==1?139810.0:x==2?476951.0:x==3?476999.0:x==4?350020.0:x==5?464711.0:x==6?464727.0:x==7?476228.0:x==8?481111.0:x==9?481095.0:0.0;
}

float PrintValue( const vec2 vStringCoords, const float fValue, const float fMaxDigits, const float fDecimalPlaces )
{
    if ((vStringCoords.y < 0.0) || (vStringCoords.y >= 1.0)) return 0.0;
	float fLog10Value = log2(abs(fValue)) / log2(10.0);
	float fBiggestIndex = max(floor(fLog10Value), 0.0);
	float fDigitIndex = fMaxDigits - floor(vStringCoords.x);
	float fCharBin = 0.0;
	if(fDigitIndex > (-fDecimalPlaces - 1.01)) {
		if(fDigitIndex > fBiggestIndex) {
			if((fValue < 0.0) && (fDigitIndex < (fBiggestIndex+1.5))) fCharBin = 1792.0;
		} else {		
			if(fDigitIndex == -1.0) {
				if(fDecimalPlaces > 0.0) fCharBin = 2.0;
			} else {
                float fReducedRangeValue = fValue;
                if(fDigitIndex < 0.0) { fReducedRangeValue = fract( fValue ); fDigitIndex += 1.0; }
				float fDigitValue = (abs(fReducedRangeValue / (pow(10.0, fDigitIndex))));
                fCharBin = DigitBin(int(floor(mod(fDigitValue, 10.0))));
			}
        }
	}
    return floor(mod((fCharBin / pow(2.0, floor(fract(vStringCoords.x) * 4.0) + (floor(vStringCoords.y * 5.0) * 4.0))), 2.0));
}

// ---- 8< -------- 8< -------- 8< -------- 8< ----




// Hacky SPD compare

float SPD_Test( float w )
{
    float n = FBM( w * 0.02, 0.5 );
    return n * n;
}

float Match( float fOffsetA, float fOffsetB )
{    
    vec3 vTotXYZA = vec3(0);
    vec3 vTotXYZB = vec3(0);
    
    for( float w = standardObserver1931_w_min; w < standardObserver1931_w_max; w += 5.0 )
    {
        vec3 vCurrXYZ = WavelengthToXYZLinear( w );

        float fPowerA = SPD_Test( w + fOffsetA );
        float fPowerB = SPD_Test( w + fOffsetB );
        
        vTotXYZA += vCurrXYZ * fPowerA;
		vTotXYZB += vCurrXYZ * fPowerB;

    }  
           
    return length( vTotXYZA - vTotXYZB );
}

const int KEY_SPACE = 32;
const int KEY_LEFT  = 37;
const int KEY_UP    = 38;
const int KEY_RIGHT = 39;
const int KEY_DOWN  = 40;
const int KEY_A     = 65;
const int KEY_B     = 66;
const int KEY_C     = 67;
const int KEY_D     = 68;
const int KEY_E     = 69;
const int KEY_F     = 70;
const int KEY_G     = 71;
const int KEY_H     = 72;
const int KEY_I     = 73;
const int KEY_J     = 74;
const int KEY_K     = 75;
const int KEY_L     = 76;
const int KEY_M     = 77;
const int KEY_N     = 78;
const int KEY_O     = 79;
const int KEY_P     = 80;
const int KEY_Q     = 81;
const int KEY_R     = 82;
const int KEY_S     = 83;
const int KEY_T     = 84;
const int KEY_U     = 85;
const int KEY_V     = 86;
const int KEY_W     = 87;
const int KEY_X     = 88;
const int KEY_Y     = 89;
const int KEY_Z     = 90;
const int KEY_COMMA = 188;
const int KEY_PER   = 190;

const int KEY_1 = 	49;
const int KEY_2 = 	50;
const int KEY_3 = 	51;
const int KEY_ENTER = 13;
const int KEY_SHIFT = 16;
const int KEY_CTRL  = 17;
const int KEY_ALT   = 18;
const int KEY_TAB	= 9;

bool Key_IsPressed( sampler2D samp, int key)
{
    return texelFetch( samp, ivec2(key, 0), 0 ).x > 0.0;    
}

bool Key_IsToggled(sampler2D samp, int key)
{
    return texelFetch( samp, ivec2(key, 2), 0 ).x > 0.0;    
}



/////////// UI DATA:

const int
    DATA_UICONTEXT						= 0,	
	DATA_WINDOW_CONTROLS   				= 1,    
	DATA_CHECKBOX_A 			= 3,
	DATA_FLOAT_A			= 4,
	DATA_FLOAT_B        		= 5,
    DATA_FLOAT_C = 6,
    DATA_WINDOW_SCROLLBAR = 7,
    DATA_FLOAT_SPD = 8
;
    
const int
	IDC_WINDOW_CONTROLS      			= 0,
    IDC_CHECKBOX_A 			= 1,
	IDC_SLIDER_FLOAT_A		= 2,
	IDC_SLIDER_FLOAT_B     	= 3,
    IDC_SLIDER_FLOAT_C 		= 4,
    IDC_WINDOW_SCROLLBAR	= 5,
    IDC_SLIDER_SPD 			= 6;
`;

let fragment = `
#define SHOW_SPECTRUM  1
#define SHOW_SPD_GRAPH 1

// Set SPD below to positive value if compilation is crashing with these options.

#define SHOW_RESPONSE_GRAPH 0
#define RESPONSE_GRAPH_LMS 0
#define RESPONSE_GRAPH_RGB 1

#define SEPARATE_SPD_GRAPH 0
#define SEPARATE_SPECTRUM 0
#define SEPARATE_RESPONSE_GRAPH 0
#define SHOW_WEIGHTED_RESPONSE 0

// Set to 0, 1 or 2
#define SHOW_LUMINOSITY_GRAPH 0
#define SHOW_LUMINOSITY_BAR 0

#define DRAW_PRISM     1
#define SHOW_SPREAD    1
#define SHOW_BEAM      1

const int 	SPD_UNITY = 0,
    		SPD_GAUSSIAN_A = 1,
    		SPD_GAUSSIAN_B = 2,	
    		SPD_GAUSSIAN_ANIMATED = 3,
    		SPD_NOISE_A = 4,
    		SPD_NOISE_B = 5,
    		SPD_NOISE_C = 6,
    		SPD_BLACKBODY = 7,
    		SPD_RGB = 8;

const int SPD = -1;

    
//#define BLACKBODY_TEMP 1000.0
//#define BLACKBODY_TEMP 2000.0
//#define BLACKBODY_TEMP 6500.0
#define BLACKBODY_TEMP 10000.0

#define iChannelUI 			iChannel1

float UI_GetFloat( int iData )
{
    return texelFetch( iChannelUI, ivec2(iData,0), 0 ).x;
}

bool UI_GetBool( int iData )
{
    return UI_GetFloat( iData ) > 0.5;
}

vec3 UI_GetColor( int iData )
{
    return texelFetch( iChannelUI, ivec2(iData,0), 0 ).rgb;
}

int GetSPD()
{
    if ( SPD < 0 )
    {
		return int( UI_GetFloat( DATA_FLOAT_SPD ) );
    }
    else
    {
        return SPD;
    }
}

vec3 GetRGBFactor()
{
    //return vec3(1.0);
    //return vec3(0.0583, 0.2416, 0.2000 );
        float r = UI_GetFloat( DATA_FLOAT_A );
        float g = UI_GetFloat( DATA_FLOAT_B );
        float b = UI_GetFloat( DATA_FLOAT_C );
        vec3 vRGBFactor = vec3(r,g,b);
    return vRGBFactor;
}

const float fGlobalXOffset = 0.3;
const float fSpHScale = 0.75;
const float fSpMinX = fGlobalXOffset + 0.5 - fSpHScale * 0.5;
const float fSpMaxX = fGlobalXOffset + 0.5 + fSpHScale * 0.5;
const float fSpMinY = 0.7;
const float fSpMaxY = 0.75;

const float fSpdMinY = 0.76;
const float fSpdMaxY = 0.99;

const float fGraphSpacing = 0.3;

vec2 GetSpectrumUV( vec2 vUV, int index )
{
    vec2 vSpectrumUV = vUV;
    float fMinY = fSpMinY - float(index) * fGraphSpacing;
    float fMaxY = fSpMaxY - float(index) * fGraphSpacing;
    
    vSpectrumUV.x = (vSpectrumUV.x - fSpMinX) / (fSpMaxX - fSpMinX);
    vSpectrumUV.y = (vSpectrumUV.y - fMinY) / (fMaxY - fMinY);
    
    return vSpectrumUV;
}

vec2 GetGraphUV( vec2 vUV, int index )
{
    vec2 vGraphUV = vUV;
    float fMinY = fSpdMinY - float(index) * fGraphSpacing;
    float fMaxY = fSpdMaxY - float(index) * fGraphSpacing;   
    
    vGraphUV.x = (vGraphUV.x - fSpMinX) / (fSpMaxX - fSpMinX);
    vGraphUV.y = (vGraphUV.y - fMinY) / (fMaxY - fMinY);
    
    return vGraphUV;
}


float BlackBody( float w_nm, float t )
{
    float h = 6.6e-34; // Planck constant
    float k = 1.4e-23; // Boltzmann constant
    float c = 3e8;// Speed of light

    float w = w_nm / 1e9;

    // Planck's law https://en.wikipedia.org/wiki/Planck%27s_law
    
    float w5 = w*w*w*w*w;
    float o = 2.*h*(c*c) / (w5 * (exp(h*c/(w*k*t)) - 1.0));

    return o;
}

float SPD_BlackBody( float w, float t )
{
    return BlackBody( w, t ) / BlackBody( 600.0, t );
}


float SPD_Sin( float w )
{
    return sin( w * 0.06 + iTime * 2.0) * 0.5 + 0.5;
}

float SPD_Noise( float w )
{
    //float fOffset = 0.0;
    //float fOffset = iTime;
    //float fOffset = 10.0;
    //float fOffset = 784.0;
    //float fOffset = 15825.0;
        
    //float fOffset = iMouse.x;
    
    //w += fOffset;
    
    float n = FBM( (w) * 0.02, 0.5 );
    return n * n;
}

float Gaussian( float x, float u, float sd )
{
    float v = sd * sd;
        
    float d = x - u;
    
    float fScale = 1.0 / sqrt( TAU * v );
    return fScale * exp( - ( d * d ) / 2.0 * v );    
}

float UnitGaussian( float x, float u, float sd )
{
    float v = sd * sd;
        
    float d = x - u;
    
    //float fScale = 1.0 / sqrt( TAU * v );
    float fScale = 1.0;
    return fScale * exp( - ( d * d ) / 2.0 * v );    
}

float SPD_Gaussian( float w )
{
    //float u = 780.0;//380.0;
    
    float u = 500.0 + sin(iTime) * 200.0;        
    float sd = 0.04;  
    
    return UnitGaussian( w, u, sd );
    
    //return clamp( 1.0 - abs(d) * 0.02, 0.0, 1.0 );    
    //return smoothstep( 0.0, 1.0, 1.0 - abs(d) * 0.02 );
    
}

float GetSPD( float w )
{
    float result = 1.0;
    switch( GetSPD() )
    {
        default:
        case SPD_UNITY:
        {
            result = 1.0;    
        }
        break;

    //return WavelengthToXYZLinear( w ).x;
    //return WavelengthToConeLinear( w ).x;
    //return SPD_Gaussian( w );
    
    //return WavelengthToLuminosityLinear( w );
    
		case SPD_GAUSSIAN_A:
        {
		    result = UnitGaussian( w, 600.0, 0.02 ) * sqrt(SPD_Noise( w + 123. ));
    	}
        break;

        case SPD_GAUSSIAN_B:
        {
            result = UnitGaussian( w, 500.0, 0.02 ) * sqrt(SPD_Noise( w + 234. ));            
        }
        break;

		case SPD_GAUSSIAN_ANIMATED:
        {
            result = UnitGaussian( w, 500.0 + sin(iTime) * 200.0, 0.02 ) * sqrt(SPD_Noise( w ));            
        }
        break;

    //return SPD_Sin( w );
    
    //return SPD_Noise( w + 784.0 ) * WavelengthToXYZLinear(w).z;

    //return dot( WavelengthToXYZLinear( w ), vec3(0.01, 0.3, 0.2));
    
        case SPD_NOISE_A:
        {    
            result = SPD_Noise( w + 784.0 );    
        }
        break;

        case SPD_NOISE_B:
        {    
            result = SPD_Noise( w + 15825.0 );
        }
        break;
    
        case SPD_NOISE_C:
        {    
            result = SPD_Noise( w + 43.0 );
        }
        break;
    
        case SPD_BLACKBODY:
        {    
            float t = BLACKBODY_TEMP;
            result = SPD_BlackBody( w, t ) * 0.4;
        }
        break;
    
        case SPD_RGB:
        {    
            bool show = UI_GetBool( DATA_CHECKBOX_A );

            if ( show )
            {    
                vec3 vRGBFactor = GetRGBFactor();
                result = dot( WavelengthToRGBLinear(w), vRGBFactor );
            }
            else
            {
                result = SPD_Noise( w + 784.0 );  
            }
        }    
        break;
    }

    return result;
}


const int 
    GRAPH_SPD = 0,
    GRAPH_CONE_L = 1,
    GRAPH_CONE_M = 2,
    GRAPH_CONE_S = 3,
    GRAPH_LUMINOSITY = 4,
    GRAPH_R = 5,
    GRAPH_G = 6, 
    GRAPH_B = 7;

const int 
    GRAPH_SCALE_UNITY = 0,
    GRAPH_SCALE_L = 1,
    GRAPH_SCALE_M = 2,
    GRAPH_SCALE_S = 3,
    GRAPH_SCALE_R = 4,
    GRAPH_SCALE_G = 5,
    GRAPH_SCALE_B = 6;

const int GRAPH_Y_NORMAL = 0,
    GRAPH_Y_RGB = 1;

float GraphFunction( float x, int function, int scale, int graphY )
{
    float w = mix(standardObserver1931_w_min, standardObserver1931_w_max, x);

    float fScale = 1.0;
    
    switch ( scale )
    {
        case GRAPH_SCALE_UNITY:
        break;
        case GRAPH_SCALE_L:
		    fScale = WavelengthToConeLinear( w ).x;
        break;
        case GRAPH_SCALE_M:
		    fScale = WavelengthToConeLinear( w ).y;
        break;
        case GRAPH_SCALE_S:
		    fScale = WavelengthToConeLinear( w ).z;
        break;
        
        case GRAPH_SCALE_R:
		    fScale = WavelengthToRGBLinear( w ).x;
        break;
        case GRAPH_SCALE_G:
		    fScale = WavelengthToRGBLinear( w ).y;
        break;
        case GRAPH_SCALE_B:
		    fScale = WavelengthToRGBLinear( w ).z;
        break;        
    }
    
    float fValue = 0.0;
    
    if ( function == GRAPH_SPD )
    {
    	fValue = GetSPD( w );
    }
    
    if ( function == GRAPH_CONE_L )
    {
		fValue = WavelengthToConeLinear( w ).x;
    }
    if ( function == GRAPH_CONE_M )
    {
		fValue = WavelengthToConeLinear( w ).y;
    }
    if ( function == GRAPH_CONE_S )
    {
		fValue = WavelengthToConeLinear( w ).z;   
    }
    if ( function == GRAPH_LUMINOSITY )
    {
		fValue = WavelengthToLuminosityLinear( w );
    }
    
    if ( function == GRAPH_R )
    {
		fValue = WavelengthToRGBLinear( w ).x; 
        fValue *= GetRGBFactor().r;
    }
    if ( function == GRAPH_G )
    {
		fValue = WavelengthToRGBLinear( w ).y;
        fValue *= GetRGBFactor().g;
    }
    if ( function == GRAPH_B )
    {
		fValue = WavelengthToRGBLinear( w ).z;
        fValue *= GetRGBFactor().b;
    }    
    
    fValue *= fScale;
    
    if ( graphY == GRAPH_Y_RGB )
    {
        fValue = fValue * 0.4 + 0.2;
    }
    
    return fValue;
}

float GraphDyDx( float x, int function, int scale, int graphY )
{
    //float w = mix(standardObserver1931_w_min, standardObserver1931_w_max, x);    
    //return cos( w * 0.06 + iTime * 2.0);
    
    float fDx = 0.01;
    float fMagicNumber = 10.0;
    return (GraphFunction( x + fDx, function, scale, graphY ) - GraphFunction( x -fDx, function, scale, graphY )) / (fMagicNumber * fDx);
}


float GraphInfo( DrawContext drawContext, int function, int scale, int graphY )
{
    vec2 vPos = drawContext.vUV;
    vPos.y = vPos.y * 1.1 - 0.05;

    float x = vPos.x;
    
    float fDyDx = GraphDyDx( x, function, scale, graphY );
    float fDistScale = 1.0;
    fDistScale = sqrt( 1.0 + fDyDx * fDyDx );
    return (vPos.y - GraphFunction( x, function, scale, graphY )) / fDistScale;
}

float cross2d( in vec2 a, in vec2 b ) { return a.x*b.y - a.y*b.x; }

// given a point p and a quad defined by four points {a,b,c,d}, return the bilinear
// coordinates of p in the quad. Returns (-1,-1) if the point is outside of the quad.
vec2 invBilinear( in vec2 p, in vec2 a, in vec2 b, in vec2 c, in vec2 d )
{
    vec2 res = vec2(-1.0);

    vec2 e = b-a;
    vec2 f = d-a;
    vec2 g = a-b+c-d;
    vec2 h = p-a;
        
    float k2 = cross2d( g, f );
    float k1 = cross2d( e, f ) + cross2d( h, g );
    float k0 = cross2d( h, e );
    
    // if edges are parallel, this is a linear equation. Do not this test here though, do
    // it in the user code
    //if( abs(k2)<0.001 )
    //{
	//	  float v = -k0/k1;
	//    float u  = (h.x*k1+f.x*k0) / (e.x*k1-g.x*k0);
    //    
    //    if( v>0.0 && v<1.0 && u>0.0 && u<1.0 )  res = vec2( u, v );
    //}
	//else
    {
        // otherwise, it's a quadratic
        float w = k1*k1 - 4.0*k0*k2;
        if( w<0.0 ) return vec2(-1.0);
        w = sqrt( w );

        #if 1
            float ik2 = 0.5/k2;
            float v = (-k1 - w)*ik2; if( v<0.0 || v>1.0 ) v = (-k1 + w)*ik2;
            float u = (h.x - f.x*v)/(e.x + g.x*v);
            if( u<0.0 || u>1.0 || v<0.0 || v>1.0 ) return vec2(-1.0);
            res = vec2( u, v );
		#else
            float v1 = (-k1 - w)/(2.0*k2);
            float v2 = (-k1 + w)/(2.0*k2);
            float u1 = (h.x - f.x*v1)/(e.x + g.x*v1);
            float u2 = (h.x - f.x*v2)/(e.x + g.x*v2);
            bool  b1 = v1>0.0 && v1<1.0 && u1>0.0 && u1<1.0;
            bool  b2 = v2>0.0 && v2<1.0 && u2>0.0 && u2<1.0;

            if(  b1 && !b2 ) res = vec2( u1, v1 );
            if( !b1 &&  b2 ) res = vec2( u2, v2 );
		#endif
    }
    
    return res;
}

float GetGlare( float fDist )
{
    float fGlare = 0.0;
    fDist = 1.0f - fDist;
    if ( fDist < 0.0 )
        return 0.0;
    fGlare += pow(fDist, 20.0);
    fGlare += pow(fDist, 4.0) * 0.1;
    fGlare += pow(fDist, 100.0) * 5.0;    
    
    return fGlare;
}

float GetSpectrumGlare( float fDist )
{
    float fGlare = 0.0;
    fDist = 1.0f - fDist;
    if ( fDist < 0.0 )
        return 0.0;
    
    fGlare += pow( fDist, 30.0);
    fGlare += pow( fDist, 10.0) * 0.1;
    //return UnitGaussian( fDist, 0.0, 20.0 );
    
    return fGlare * 0.005;
}



float GetPrismGlare( float fDist )
{
    float fGlare = 0.0;
    fDist = 1.0f - fDist;
    if ( fDist < 0.0 )
        return 0.0;
    
    fGlare += pow( fDist, 100.0);
    fGlare += pow( fDist, 30.0) * 0.1;
    //return UnitGaussian( fDist, 0.0, 20.0 );
    
    return fGlare * 0.05;
}

const vec2 vPrismPoint = vec2(fGlobalXOffset + 0.8, 0.2);
const vec2 vPrismN1 = normalize( vec2( 1, sqrt(3.0) ) );    
const vec2 vPrismN2 = normalize( -vec2( -1, sqrt(3.0) ) );    
const vec2 vPrismN3 = normalize( vec2( -1, 0 ) );    
const float fPrismD1 = -dot( vPrismN1, vPrismPoint );
const float fPrismD2 = -dot( vPrismN2, vPrismPoint );
const float fPrismD3 = vPrismPoint.x - 0.2;


float GetPrismDist( vec2 vUV )
{    
    float fD1 = dot( vUV, vPrismN1 ) + fPrismD1;
    float fD2 = dot( vUV, vPrismN2 ) + fPrismD2;
    float fD3 = dot( vUV, vPrismN3 ) + fPrismD3;
                       
    return max(max( fD1, fD2 ), fD3);
}

float ProjectPlane( float x, vec2 n, float d )
{
    float yi = d / n.y;
    
    float y = x * -n.x / n.y - yi;
    
    return y;
}

float PrismShade( vec2 vUV )
{
    float d = GetPrismDist( vUV );
    
    float fEpsilon = 0.001;
    float fDX = GetPrismDist( vUV + vec2( fEpsilon, 0 ) );
    float fDY = GetPrismDist( vUV + vec2( 0, fEpsilon ) );
    
    vec2 vNorm = normalize( vec2( fDX - d, fDY -d ) / fEpsilon );
    
	float fEdge = clamp( 1.0 - abs(d) * 200.0, 0.0, 1.0 );
    
    float fLight = dot( normalize( vec2(0.5, -0.4) ), vNorm );
    
    float fLightA = clamp( fLight * 0.5 + 0.5, 0.0, 1.0 );
    float fLightB = pow( clamp( fLight, 0.0, 1.0 ), 100.0 ) * 2.0;
    
    float fShade = fEdge * (fLightA + fLightB + 0.5);
        
    if ( d < 0.0 )
    {
        fShade = max( fShade, 0.25 );   
    }
    
    fShade = max( 0.0f, fShade );
    
	return fShade * 0.05;
}

void DrawSpectrum( inout DrawContext drawContext, vec3 vColBG )
{   
    vec2 vSpectrumUV = GetSpectrumUV( drawContext.vUV, 0 );
    
    float fGap = 0.01;

    float fSpread0 = 0.01;
    float x0 = vPrismPoint.x - 0.1 - fSpread0;
    float x1 = vPrismPoint.x - 0.1 + fSpread0;
    
    vec2 v0 = vec2(x0, ProjectPlane( x0, vPrismN1, fPrismD1 ) );
    vec2 v1 = vec2(x1, ProjectPlane( x1, vPrismN1, fPrismD1 ) );
    vec2 v2 = vec2(fSpMaxX, fSpMinY - fGap);
    vec2 v3 = vec2(fSpMinX, fSpMinY - fGap);
    
    vec2 vSpreadUV = invBilinear( drawContext.vUV, v0, v1, v2, v3 );    
    bool inSpreadLight = InUnitSquare( vSpreadUV );

    float fSpread1 = 0.005;
    float x4 = vPrismPoint.x - 0.09 - fSpread1;
    float x5 = vPrismPoint.x - 0.09 + fSpread1;
    
    vec2 v4 = vec2(x4, ProjectPlane( x4, vPrismN2, fPrismD2 ) );
    vec2 v5 = vec2(x5, ProjectPlane( x5, vPrismN2, fPrismD2 ) );

    vec2 vSpreadUV_B = invBilinear( drawContext.vUV, v0, v1, v5, v4 );    
    bool inSpreadLightB = InUnitSquare( vSpreadUV_B );
    

    
    if ( !inSpreadLight )
    {
        if ( inSpreadLightB )
        {
            inSpreadLight = true;
            vSpreadUV = vSpreadUV_B;
            vSpreadUV.y = 0.0;
        }
    }
    
#if !SHOW_SPREAD
    inSpreadLight = false;
#endif    
    
    // Hack convergence color
    vSpreadUV.y = vSpreadUV.y * 0.96 + 0.04;
    
    vec2 vBeamA = (v4 + v5) * 0.5;
    vec2 vBeamB = vec2(0.66 + fGlobalXOffset,0);
    
    float fBeamDist = LineInfo( drawContext.vUV, vBeamA, vBeamB );
    float fBeam = clamp( abs(fBeamDist) * 200.0, 0.0, 1.0 );
    fBeam = sqrt( 1.0 - fBeam * fBeam);
    fBeam += GetGlare( abs( fBeamDist ) ) * 0.2;
    
    float fGlareDist = length( drawContext.vUV - vBeamA );
    float fBeamGlare = GetGlare( fGlareDist );

    
#if !SHOW_BEAM    
    fBeam = 0.0;
    fBeamGlare = 0.0;
#endif    

    bool inSpectrum = InUnitSquare( vSpectrumUV );    

#if SEPARATE_SPECTRUM    
	inSpectrum = inSpectrum || InUnitSquare( GetSpectrumUV( drawContext.vUV, 1 ) ) || InUnitSquare( GetSpectrumUV( drawContext.vUV, 2 ) );
#endif
    
#if !SHOW_SPECTRUM
    inSpectrum = false;
#endif
    
    float fSpreadLightW0 = mix(standardObserver1931_w_min - 20.0, standardObserver1931_w_max + 20.0, vSpreadUV.x);
    float fSpectrumW0 = mix(standardObserver1931_w_min - 20.0, standardObserver1931_w_max + 20.0, vSpectrumUV.x);
    
    
    vec3 vLightColor = vec3(0);
    
    vec3 vTotXYZ = vec3(0);
    for( float w = standardObserver1931_w_min; w < NO_UNROLLF(standardObserver1931_w_max); w += 5.0 )
    {
        vec3 vCurrXYZ = WavelengthToXYZLinear( w );

        float fPower = GetSPD( w );
        
        if ( inSpreadLight )
        {
            float fWeight = UnitGaussian( w, fSpreadLightW0, 0.2 * vSpreadUV.y);
        	vTotXYZ += vCurrXYZ * fWeight * fPower * 0.01;
        }

        float t = (w - standardObserver1931_w_min) / (standardObserver1931_w_max - standardObserver1931_w_min);
        
#if SHOW_SPREAD        
        {
            vec2 vSpPos = vec2( mix( fSpMinX, fSpMaxX, t), fSpMinY - fGap);
            
            vec2 vOffset = vSpPos - drawContext.vUV;
            float d = length( vOffset );
            if ( vOffset.y > 0.0 && d < 0.5 )
            {
	        	vTotXYZ += vCurrXYZ * GetSpectrumGlare( d ) * fPower;
            }
        }
        
        {
            vec2 vPrismPos = mix( v0, v1, t );
            
            vec2 vOffset = vPrismPos - drawContext.vUV;
            float d = length( vOffset );
            if ( d < 0.5 )
            {
	        	vTotXYZ += vCurrXYZ * GetPrismGlare( d ) * fPower;
            }
        }
#endif        
        
        vLightColor += vCurrXYZ * fPower;
    }
    
    vTotXYZ += vLightColor * (fBeam + fBeamGlare) * 0.03;

#if DRAW_PRISM        
    float fPrismShade = PrismShade( drawContext.vUV );    
    vTotXYZ += vLightColor * fPrismShade * 0.1 * vec3( 0.8, 0.9, 1 );
    vTotXYZ += fPrismShade * .3 * vec3( 0.8, 0.9, 1 );
#endif    
    
    if ( inSpectrum )
    {
        vTotXYZ += WavelengthToXYZLinear(fSpectrumW0) * 0.3;
    }
    
    /*if (  drawContext.vUV.y > fSpMinY - fGap )
    {
    	vTotXYZ += 0.5;
    }*/
    
    mat3 cat = GetChromaticAdaptionTransform( mCAT_Bradford, XYZ_D65, XYZ_E );           
	vTotXYZ = vTotXYZ * cat;
        
    vec3 vColor = XYZtosRGB( vTotXYZ );    
    vColor = max( vColor, vec3(0) );
    
    vColor += vColBG;

#if SHOW_LUMINOSITY_BAR    
    vec2 vLuminosityUV = vSpectrumUV;
    vLuminosityUV.y += 1.5;
    if ( InUnitSquare( vLuminosityUV ) )
    {
        float l = WavelengthToLuminosityLinear( fSpectrumW0 ) ;
        vColor += vec3(l);
    }
#endif    
    
    vColor = 1.0 - exp2( vColor * -2.0 ); // Tonemap
    
    vColor = pow( vColor, vec3(1.0 / 2.2) );
        
    drawContext.vResult = vColor;
}

void mainSPD( out vec4 fragColor, in vec2 fragCoord )
{
    // Normalized pixel coordinates (from 0 to 1)
    vec2 vUV = fragCoord / iResolution.xy;

    float fScale = 1.0f;
    // scale down around centre of square
    vec2 vDiagramUV = (vUV - 0.5) * fScale + 0.5;
    
    // aspect ratio adjust
    vDiagramUV.x *= iResolution.x / iResolution.y;
        
    
    // centre image horizontally
    vDiagramUV.x += (1.0 - (iResolution.x / iResolution.y)) / 2.0;
    
    vec3 vColBg = texture( iChannel0, vUV * 2.0 ).rgb;
    vColBg = vColBg * vColBg * 0.01;     
    
    vec3 vClearColor = vec3( 0.0 );
    DrawContext drawContext = DrawContext_Init( vDiagramUV, vClearColor );
    
    DrawSpectrum( drawContext, vColBg );    
    
    //DrawLine( drawContext, vec3(0.5), vec2(0.1, 0.1), vec2(0.9, 0.9),  0.1 );
    //DrawLine( drawContext, vec3(0.5), vec2(0.1, 0.9), vec2(0.9, 0.1),  0.1 );    
            
    vec2 vA = vec2(0.1, 0.5);
    vec2 vB = vec2(0.9, 0.75);       

    float fGraphLineThickness = 0.015;
    vec3 vSPDColor = vec3(1);

    int graphY = GRAPH_Y_NORMAL;
#if RESPONSE_GRAPH_RGB
    graphY = GRAPH_Y_RGB;
#endif
    
    //graphY = GRAPH_Y_RGB;
    
#if SHOW_WEIGHTED_RESPONSE
	{
#if RESPONSE_GRAPH_LMS        
        vec3 vGraphCols[3] = vec3[3]( 
            vec3( .1, 0, 1 ), 
            vec3( .3,1,.3 ), 
            vec3( 1,1,.1 ) );
        int graphScale[3] = int[3] ( GRAPH_SCALE_S, GRAPH_SCALE_M, GRAPH_SCALE_L );
#endif        
#if RESPONSE_GRAPH_RGB
        vec3 vGraphCols[3] = vec3[3]( 
            vec3( .8,0,0 ), 
            vec3( 0,.8,0 ), 
            vec3( 0,0,.8 ) );        
        int graphScale[3] = int[3] ( GRAPH_SCALE_R, GRAPH_SCALE_G, GRAPH_SCALE_B );
#endif        
        for ( int i=0; i<NO_UNROLL(3); i++ )
        {
            int graphIndex = i;
            vec2 vGraphUV = GetGraphUV( vDiagramUV, graphIndex );       
            drawContext = DrawContext_Init( vGraphUV, drawContext.vResult );    
		    if ( InUnitSquare(drawContext.vUV) )
            {
                        
                float fGraphInfo = GraphInfo( drawContext, GRAPH_SPD, graphScale[i], graphY );

                if ( graphY == GRAPH_Y_RGB )
                {
                	if ( drawContext.vUV.y < 0.21 ) fGraphInfo  = -fGraphInfo;
                }                
                
                float fBlend = LineSmooth( drawContext, fGraphInfo, 0.0 );
                
                if ( graphY == GRAPH_Y_NORMAL )
                {
                	if ( drawContext.vUV.y < 0.03 ) fBlend  = 0.0;
                }

                
                
                fBlend *= 0.75;
                DrawBlend( drawContext, vGraphCols[i], fBlend );
            }
        }
    }        
#endif
    
#if SHOW_RESPONSE_GRAPH    
	{
        
#if RESPONSE_GRAPH_LMS
        vec3 vGraphCols[3] = vec3[3]( 
            vec3( .1, 0, 1 ), 
            vec3( .3,1,.3 ), 
            vec3( 1,1,.1 ) );
        
        int graphType[3] = int[3] ( GRAPH_CONE_S, GRAPH_CONE_M, GRAPH_CONE_L );
#endif 
#if RESPONSE_GRAPH_RGB
        vec3 vGraphCols[3] = vec3[3]( 
            vec3( 1,0,0 ), 
            vec3( 0,1,0 ), 
            vec3( 0,0,1 ) );
        
        int graphType[3] = int[3] ( GRAPH_R, GRAPH_G, GRAPH_B );
#endif 
        
        for ( int i=0; i<NO_UNROLL(3); i++ )
        {
            int graphIndex = 0;
            #if SEPARATE_RESPONSE_GRAPH
			graphIndex = i;
			#endif            
            vec2 vGraphUV = GetGraphUV( vDiagramUV, graphIndex );       
            drawContext = DrawContext_Init( vGraphUV, drawContext.vResult );    
            
		    if ( InUnitSquare(drawContext.vUV) )
            {   
#if RESPONSE_GRAPH_RGB                
                {
                    float fAxisInfo = drawContext.vUV.y - 0.22;
                    float fBlend = LineSmooth( drawContext, abs(fAxisInfo), fGraphLineThickness );
                    DrawBlend( drawContext, vec3(0.25), fBlend );
                }
#endif                
                
                float fGraphInfo = GraphInfo( drawContext, graphType[i], GRAPH_SCALE_UNITY, graphY );
                float fBlend = LineSmooth( drawContext, abs(fGraphInfo), fGraphLineThickness );
                DrawBlend( drawContext, vGraphCols[i], fBlend );
            }
        }
    }
#endif
    

#if SHOW_SPD_GRAPH    
	{
#if SEPARATE_SPD_GRAPH
        for ( int i=0; i<NO_UNROLL(3); i++ )
#else
        int i = 0;
#endif            
        {
            vec2 vGraphUV = GetGraphUV( vDiagramUV, i );       
            drawContext = DrawContext_Init( vGraphUV, drawContext.vResult );    

            if ( InUnitSquare(drawContext.vUV) )
            {            
                //float fLineInfo = LineInfo( drawContext.vUV, vA, vB );
                float fGraphInfo = GraphInfo( drawContext, GRAPH_SPD, GRAPH_SCALE_UNITY, graphY );

                float fBlend = LineSmooth( drawContext, abs(fGraphInfo), fGraphLineThickness );
                DrawBlend( drawContext, vSPDColor, fBlend );
            }
        }
    }
#endif    
        
#if SHOW_LUMINOSITY_GRAPH
	{
        vec2 vGraphUV = GetGraphUV( vDiagramUV, 0 );       
        drawContext = DrawContext_Init( vGraphUV, drawContext.vResult );    
        
        vec3 vGraphCols[2] = vec3[2]( 
            vec3( 1,1,1 ),
            vec3( .3,1,.3 )
        );
        
        int graphType[2] = int[2] ( GRAPH_LUMINOSITY, GRAPH_CONE_M );
        for ( int i=0; i<NO_UNROLL(SHOW_LUMINOSITY_GRAPH); i++ )
        {
		    if ( InUnitSquare(drawContext.vUV) )
            {            
                float fGraphInfo = GraphInfo( drawContext, graphType[i], GRAPH_SCALE_UNITY, 0 );
                float fBlend = LineSmooth( drawContext, abs(fGraphInfo), fGraphLineThickness );
                DrawBlend( drawContext, vGraphCols[i], fBlend );
            }
        }
    }        
#endif
        
            
	//DrawLine( drawContext, vec3(0), vec2(0, 0), vec2(1, 0),  0.1 );

    // Output to screen
    fragColor = vec4(drawContext.vResult,1.0);

    
#if 0    
    vec2 vNumSize = vec2(16);

    vec4 vSample = texelFetch( iChannel2, ivec2(0), 0 );
    float fBestOffset = vSample.x;
    float fMin = vSample.y;
    fragColor = mix( fragColor, vec4(1), PrintValue( (fragCoord - vec2(40,30)) / vNumSize, fBestOffset, 3.0, 2.0 ) );
    fragColor = mix( fragColor, vec4(1), PrintValue( (fragCoord - vec2(160,30)) / vNumSize, fMin, 8.0, 6.0 ) );
#endif    
}


void UI_Compose( vec2 fragCoord, inout vec3 vColor, out int windowId, out vec2 vWindowCoord, out float fShadow )
{
    vec4 vUISample = texelFetch( iChannelUI, ivec2(fragCoord), 0 );
    
    if ( fragCoord.y < 2.0 )
    {
        // Hide data
        vUISample = vec4(1.0, 1.0, 1.0, 1.0);
        return;
    }
    
    vColor.rgb = vColor.rgb * (1.0f - vUISample.w) + vUISample.rgb;    
    
    windowId = -1;
    vWindowCoord = vec2(0);
    
    fShadow = 1.0f;
    if ( vUISample.a < 0.0 )
    {
        vWindowCoord = vUISample.rg;
        windowId = int(round(vUISample.b));
        
        fShadow = clamp( -vUISample.a - 1.0, 0.0, 1.0);
    }
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    mainSPD( fragColor, fragCoord );
    
    int windowId;
    vec2 vWindowCoord;
    float fShadow;
    UI_Compose( fragCoord, fragColor.rgb, windowId, vWindowCoord, fShadow );
    
}
`;

fragment = common + fragment;

const fa = `
#define iChannelUI 			iChannel0
#define iChannelKeyboard 	iChannel1
#define iChannelFont 		iChannel2

#define SHADOW_TEST

#define NEW_THEME

#ifdef NEW_THEME
vec3 cCheckboxOutline = vec3(0.4);
vec3 cSliderLineCol = vec3(0.7);
vec3 cSliderHandleOutlineCol = vec3(0.5);
vec3 cButtonActive = vec3(0.6, 0.6, 0.9 );
vec3 cButtonInactive = vec3( 0.5 );
vec3 cWindowBorder = vec3(0.5, 0.5, 0.6 );
vec3 cActiveWindowBorder = vec3(0.3, 0.3, 0.5 );
vec3 cWindowBackgroundColor = vec3(0.9);
const vec3 cTitleBarA = vec3(0.7);
const vec3 cTitleBarB = cTitleBarA + 0.1;
vec3 cTitleBarAActive = cTitleBarA + 0.05;
vec3 cTitleBarBActive = cTitleBarB + 0.05; 
vec3 cWindowTitle = vec3(0.0);
vec3 cResize = vec3( 0.7 );
vec3 cResizeActive = vec3( 0.8 );
vec3 cScrollPanelCorner = vec3(0.6);
vec3 cScrollPanelCornerOutline = vec3(0.7);
#else
vec3 cWindowBackgroundColor = vec3(0.75);
const vec3 cTitleBarA = vec3(0.0, 0.0, 0.5);
const vec3 cTitleBarB = vec3(0.03, 0.5, 0.8);
vec3 cTitleBarAActive = cTitleBarA + 0.1;
vec3 cTitleBarBActive = cTitleBarB + 0.1; 
vec3 cWindowTitle = vec3(1.0);        
vec3 cResize = vec3( 0.6 );
vec3 cResizeActive = vec3( 0.8 );
vec3 cScrollPanelCorner = vec3(0.7);
#endif

///////////////////////////
// Data Storage
///////////////////////////

vec4 LoadVec4( sampler2D sampler, in ivec2 vAddr )
{
    return texelFetch( sampler, vAddr, 0 );
}

vec3 LoadVec3( sampler2D sampler, in ivec2 vAddr )
{
    return LoadVec4( sampler, vAddr ).xyz;
}

bool AtAddress( ivec2 p, ivec2 c ) { return all( equal( p, c ) ); }

void StoreVec4( in ivec2 vAddr, in vec4 vValue, inout vec4 fragColor, in ivec2 fragCoord )
{
    fragColor = AtAddress( fragCoord, vAddr ) ? vValue : fragColor;
}

void StoreVec3( in ivec2 vAddr, in vec3 vValue, inout vec4 fragColor, in ivec2 fragCoord )
{
    StoreVec4( vAddr, vec4( vValue, 0.0 ), fragColor, fragCoord);
}

///////////////////////////
// Rect
///////////////////////////

struct Rect
{
    vec2 vPos;
    vec2 vSize;
};      

bool Inside( vec2 vPos, vec2 vMin, vec2 vMax )
{
    return all( greaterThanEqual( vPos, vMin ) ) && all( lessThan( vPos, vMax ) );
}

bool Outside( vec2 vPos, vec2 vMin, vec2 vMax )
{
    return any( lessThan( vPos, vMin ) ) || any( greaterThanEqual( vPos, vMax ) );
}

bool Inside( vec2 vPos, Rect rect )
{
    return Inside( vPos, rect.vPos, rect.vPos + rect.vSize );
}
    
bool Outside( vec2 vPos, Rect rect )
{
    return Outside( vPos, rect.vPos, rect.vPos + rect.vSize );
}

void RectExpand( inout Rect region, vec2 vPadding )
{
    // Padding
    region.vPos -= vPadding;
    region.vSize += vPadding * 2.0;        
}

void RectShrink( inout Rect region, vec2 vPadding )
{
    RectExpand( region, -vPadding);
}

#define AUTO_FONT_SPACING
//#define HANDLE_EOL
//#define HANDLE_PRINT_STYLES

// Font characters
const uint
   	// HTML Entity Names
    
    _SP = 0x20u,		// ' '
    _EXCL = 0x21u, 		// '!' 
    _QUOT = 0x22u, 		// '"'
    _NUM = 0x23u,  		// '#'
    _DOLLAR = 0x24u, 	// '$'
    _PERCNT = 0x25u, 	// '%'
    _AMP = 0x26u, 		// '&'
    _APOS = 0x27u,		// '''    
    _LPAR = 0x28u, 		// '('
    _RPAR= 0x29u, 		// ')'
    _AST = 0x2Au,		// '*'
    _PLUS = 0x2Bu,		// '+'
    _COMMA = 0x2Cu,		// ','    
    _MINUS = 0x2Du,		// '-'
    _PERIOD = 0x2Eu,	// '.'
    _SOL = 0x2Fu,		// '/' 

    _0 = 0x30u, _1 = 0x31u, _2 = 0x32u, _3 = 0x33u, _4 = 0x34u, 
    _5 = 0x35u, _6 = 0x36u, _7 = 0x37u, _8 = 0x38u, _9 = 0x39u, 

    _COLON = 0x3Au,		// ':' 
    _SEMI = 0x3Bu,		// ';' 
    _LT = 0x3Cu,		// '<' 
    _EQUALS = 0x3Du,	// '=' 
    _GT = 0x3Eu,		// '>' 
    _QUEST = 0x3Fu,		// '?' 
    _COMAT = 0x40u,		// '@' 
    
    _A = 0x41u, _B = 0x42u, _C = 0x43u, _D = 0x44u, _E = 0x45u, 
    _F = 0x46u, _G = 0x47u, _H = 0x48u, _I = 0x49u, _J = 0x4Au,
    _K = 0x4Bu, _L = 0x4Cu, _M = 0x4Du, _N = 0x4Eu, _O = 0x4Fu,
    _P = 0x50u, _Q = 0x51u, _R = 0x52u, _S = 0x53u, _T = 0x54u,
    _U = 0x55u, _V = 0x56u, _W = 0x57u, _X = 0x58u, _Y = 0x59u,
    _Z = 0x5Au,

    _LSQB = 0x5Bu,		// '[' 
    _BSOL = 0x5Cu,		// '\'
    _RSQB = 0x5Du,		// ']' 
    _CIRC = 0x5Eu,		// '^' 
    _LOWBAR = 0x5Fu,	// '_' 
    _GRAVE = 0x60u,		//  
    
    _a = 0x61u, _b = 0x62u, _c = 0x63u, _d = 0x64u, _e = 0x65u,
    _f = 0x66u, _g = 0x67u, _h = 0x68u, _i = 0x69u, _j = 0x6Au,
    _k = 0x6Bu, _l = 0x6Cu, _m = 0x6Du, _n = 0x6Eu, _o = 0x6Fu,
    _p = 0x70u, _q = 0x71u, _r = 0x72u, _s = 0x73u, _t = 0x74u,
    _u = 0x75u, _v = 0x76u, _w = 0x77u, _x = 0x78u, _y = 0x79u,
    _z = 0x7Au

	,_LCUB = 0x7Bu		// '{'
    ,_VERBAR = 0x7Cu	// '|'
    ,_RCUB = 0x7Du		// '}'
    ,_TILDE = 0x7Eu		// '~'
    
#ifdef HANDLE_EOL       
    ,_EOL = 0x1000u 	// End of Line - Carriage Return & Line Feed    
#endif    
#ifdef HANDLE_PRINT_STYLES    
    ,_BOLDON = 0x1001u	// Special
    ,_BOLDOFF = 0x1002u	// Special
    ,_ITALON = 0x1003u	// Special
    ,_ITALOFF = 0x1004u	// Special    
#endif    
;


vec4 SampleCharacterTex( uint iChar, vec2 vCharUV )
{
    uvec2 iChPos = uvec2( iChar % 16u, iChar / 16u );
    vec2 vUV = (vec2(iChPos) + vCharUV) / 16.0f;
    return textureLod( iChannelFont, vUV, 0.0 );
}
    
vec4 SampleCharacter( uint iChar, vec2 vCharUV )
{
    uvec2 iChPos = uvec2( iChar % 16u, iChar / 16u );
    vec2 vClampedCharUV = clamp(vCharUV, vec2(0.01), vec2(0.99));
    vec2 vUV = (vec2(iChPos) + vClampedCharUV) / 16.0f;

    vec4 vSample;
    
    float l = length( (vClampedCharUV - vCharUV) );

    // Skip texture sample when not in character boundary
    // Ok unless we have big font weight
    if ( l > 0.01f )
    {
        vSample.rgb = vec3(0);
		vSample.w = 2000000.0; 
    }
    else
    {
		vSample = textureLod( iChannelFont, vUV, 0.0 );    
        vSample.gb = vSample.gb * 2.0f - 1.0f;
        vSample.a -= 0.5f + 1.0/256.0;    
    }
        
    return vSample;
}


struct CharExtents
{
    float left;
    float width;
};
    
float CharVerticalPos(uint iChar, vec2 vUV) 
{
    vec4 vSample = SampleCharacterTex(iChar, vUV);
    float dist = vSample.a - (127.0/255.0);
    dist *= vSample.g * 2.0 - 1.0;
    return vUV.x - dist;
}

CharExtents GetCharExtents( uint iChar )
{
    CharExtents result;

    result.left = CharVerticalPos( iChar, vec2(0.02, 0.5) );
    float right = CharVerticalPos( iChar, vec2(0.98, 0.5) );
    result.width = right - result.left;
    
    if ( iChar == _SP )
    {
        result.left = 0.3f;
        result.width = 0.4f;
    }
    return result;
}

struct PrintState
{
    vec2 vPixelPos;
    
    vec2 vLayoutStart;
    // print position
    vec2 vCursorPos;
    vec2 vPixelSize;

#ifdef HANDLE_EOL
    bool EOL;
#endif

    // result
    float fDistance;
};    

void MoveTo( inout PrintState state, vec2 vPos )
{
    state.vLayoutStart = vPos;
    state.vCursorPos = vPos;
#ifdef HANDLE_EOL
    state.EOL = false;
#endif
}

void ClearPrintResult( inout PrintState state )
{
    state.fDistance = 1000000.0;   
}

PrintState PrintState_InitCanvas( vec2 vCoords, vec2 vPixelSize )
{
    PrintState state;
    state.vPixelPos = vCoords;
    state.vPixelSize = vPixelSize;
    
    MoveTo( state, vec2(0) );

    ClearPrintResult( state );
    
    return state;
}

struct LayoutStyle
{
    vec2 vSize;
    float fLineGap;
    float fAdvancement;
#ifdef HANDLE_PRINT_STYLES    
    bool bItalic;
    bool bBold;  
#endif    
};
    
LayoutStyle LayoutStyle_Default()
{
    LayoutStyle style;
    style.vSize = vec2(24.0f, 32.0f);    
    style.fLineGap = 0.1f;
    style.fAdvancement = 0.1f;
#ifdef HANDLE_PRINT_STYLES    
    style.bItalic = false;
    style.bBold = false;       
#endif    
    return style;
}

struct RenderStyle
{
    vec3 vFontColor;
    float fFontWeight;   
};

RenderStyle RenderStyle_Default( vec3 vFontColor )
{
    RenderStyle style;
    style.vFontColor = vFontColor;
    style.fFontWeight = 0.0f;  
    return style;
}

const float g_fFontDescent = 0.15f;
const float g_fFontAscent = 0.65f;

void PrintEndCurrentLine( inout PrintState state, const LayoutStyle style )
{
    // Apply CR
    state.vCursorPos.x = state.vLayoutStart.x;
    
    // advance Y position to bottom of descender based on current font size.
	state.vCursorPos.y += style.vSize.y * g_fFontDescent;    
}

void PrintBeginNextLine( inout PrintState state, const LayoutStyle style )
{
    // move Y position to baseline based on current font size
	state.vCursorPos.y += style.vSize.y * (g_fFontAscent + style.fLineGap);
}

#ifdef HANDLE_EOL
void PrintEOL( inout PrintState state, const LayoutStyle style )
{
    if ( state.EOL )
    {
        PrintBeginNextLine( state, style );
    }
    PrintEndCurrentLine( state, style );
    state.EOL = true;
}
#endif

void PrintCh( inout PrintState state, inout LayoutStyle style, const uint iChar )
{
#ifdef HANDLE_EOL
    if ( iChar == _EOL )
    {
        PrintEOL( state, style );
        return;
    }
    else
#endif
#ifdef HANDLE_PRINT_STYLES            
    if ( iChar == _BOLDON )
    {
        style.bBold = true;
        return;
    }
    else
    if ( iChar == _BOLDOFF )
    {
        style.bBold = false;
        return;
    }
    else
    if ( iChar == _ITALON )
    {
        style.bItalic = true;
        return;
    }
    else
    if ( iChar == _ITALOFF )
    {
        style.bItalic = false;
        return;
    }
#endif
    
#ifdef HANDLE_EOL
    if ( state.EOL )
    {
        PrintBeginNextLine( state, style );
		state.EOL = false;
    }
#endif
    
    vec2 vUV = ((state.vPixelPos - state.vCursorPos) / style.vSize);

    /*if ( (vUV.y > -0.1) && (vUV.y < 0.1) && (abs(vUV.x) < 0.02 || abs(vUV.x - CharWidth(iChar)) < 0.02) )
    {
        state.fDistance = -10.0;
    }*/
    
	CharExtents extents = GetCharExtents( iChar );    
    vUV.y += 0.8f; // Move baseline
    vUV.x += extents.left - style.fAdvancement;
    
#ifdef HANDLE_PRINT_STYLES    
    if ( style.bItalic )
    {
    	vUV.x += (1.0 - vUV.y) * -0.4f;
    }
#endif
    
    vec3 v = SampleCharacter( iChar, vUV ).agb;

#ifdef HANDLE_PRINT_STYLES    
    if ( style.bBold )
    {
    	v.x -= 0.025f;
    }
#endif    
    
    if ( v.x < state.fDistance )
    {
        state.fDistance = v.x;       
    }
    
    state.vCursorPos.x += style.vSize.x * (extents.width + style.fAdvancement);
}


Rect GetFontRect( PrintState state, LayoutStyle style, bool initialLineOffset )
{
    Rect rect;
    
    rect.vPos = state.vLayoutStart;
    if ( initialLineOffset )
    {
    	rect.vPos.y += style.vSize.y * (style.fLineGap + g_fFontAscent);
    }
	rect.vPos.y -= style.vSize.y * (g_fFontAscent);
    rect.vSize.x = state.vCursorPos.x - state.vLayoutStart.x;
    rect.vSize.y = style.vSize.y * ( g_fFontAscent + g_fFontDescent );
    
    return rect;
}

float GetFontBlend( PrintState state, LayoutStyle style, float size )
{
    float fFeatherDist = 1.0f * length(state.vPixelSize / style.vSize);    
    float f = clamp( (size-state.fDistance + fFeatherDist * 0.5f) / fFeatherDist, 0.0, 1.0);
    return f;
}

void RenderFont( PrintState state, LayoutStyle style, RenderStyle renderStyle, inout vec3 color )
{   
    float f = GetFontBlend( state, style, renderStyle.fFontWeight );

    vec3 vCol = renderStyle.vFontColor;
    
    color.rgb = mix( color.rgb, vCol, f);    
}

// Font print helpers

#define NO_UNROLL(X) (X + min(0,iFrame))
#define NO_UNROLLU(X) (X + uint(min(0,iFrame)))

#define ARRAY_PRINT( STATE, STYLE, CHAR_ARRAY ) { for (int i=0; i< NO_UNROLL( CHAR_ARRAY.length() ); i++) PrintCh( STATE, STYLE, CHAR_ARRAY[i] ); }

void Print( inout PrintState state, LayoutStyle style, uint value )
{
	uint place = 1000000000u;

    bool leadingZeros = true;
    while( place > NO_UNROLLU( 0u ) )
    {
        uint digit = (value / place) % 10u;
        if ( place == 1u || digit != 0u )
        {
            leadingZeros = false;
        }
        
        if (!leadingZeros)
        {
            PrintCh( state, style, _0 + digit );
        }
        place = place / 10u;
    }    
}

void Print( inout PrintState state, LayoutStyle style, int value )
{
    if ( value < 0 )
    {
        PrintCh( state, style, _MINUS );
        value = -value;
    }

    Print ( state, style, uint(value) );    
}

void Print( inout PrintState state, LayoutStyle style, float value, int decimalPlaces )
{
    if ( value < 0.0f )
    {
        PrintCh( state, style, _MINUS );
    }
    value = abs(value);
    
    int placeIndex = 10;
    
    bool leadingZeros = true;
    while( placeIndex >= NO_UNROLL( -decimalPlaces ) )
    {
        float place = pow(10.0f, float(placeIndex) );
        float digitValue = floor( value / place );
        value -= digitValue * place;
        
        
        uint digit = min( uint( digitValue ), 9u );
        
        if ( placeIndex == -1 )
        {
            PrintCh( state, style, _PERIOD );
        }
        
        if ( placeIndex == 0 || digit != 0u )
        {
            leadingZeros = false;
        }        
        
        if ( !leadingZeros )
        {
        	PrintCh( state, style, _0 + digit );
        }
                
        placeIndex--;
    }
}



///////////////////////////////////////////
// General 2d Drawing
///////////////////////////////////////////

void DrawRect( vec2 vCanvasPos, Rect rect, vec4 vColor, inout vec4 vOutColor )
{
	if ( Inside( vCanvasPos, rect ) )
    {
        vOutColor = vColor;
    }
}

void DrawLine( vec2 vCanvasPos, vec2 vA, vec2 vB, float fThickness, vec4 vColor, inout vec4 vOutColor )
{
    vec2 vDir = vB - vA;
    float l = length( vDir );
    vDir = normalize( vDir );

    vec2 vOffset = vCanvasPos - vA;
    float fDot = dot( vOffset, vDir );
    float fT = clamp( fDot, 0.0, l );

    vec2 vClosest = vA + vDir * fT;
    float fDist = length(vClosest - vCanvasPos) - fThickness;

    if ( fDist < 0.0 )
    {
        vOutColor = vColor;
    }    
}

void DrawBorderOutdent( vec2 vCanvasPos, Rect rect, inout vec4 vOutColor )
{    
    vec2 vThickness = vec2(1.0);
    
	if ( Inside( vCanvasPos, rect ) )
    {
        if ( any( lessThanEqual( vCanvasPos, rect.vPos + vThickness) ) )
        {
            vOutColor.rgb = vec3(0.85);
        }
        else
        if ( any( greaterThan( vCanvasPos, rect.vPos + rect.vSize - vThickness) ) )
        {
            vOutColor.rgb = vec3(0.0);
        }
        else
        if ( any( lessThanEqual( vCanvasPos, rect.vPos + vThickness * 2.0) ) )
        {
            vOutColor.rgb = vec3(1.0);
        }
        else
        if ( any( greaterThan( vCanvasPos, rect.vPos + rect.vSize - vThickness * 2.0) ) )
        {
            vOutColor.rgb = vec3(0.4);
        }
    }
}

void DrawBorderRect( vec2 vCanvasPos, Rect rect, vec3 vOutlineColor, inout vec4 vOutColor )
{ 
    vec2 vThickness = vec2(1.0);
    
	if ( Inside( vCanvasPos, rect ) )
    {        
        if ( any( lessThanEqual( vCanvasPos, rect.vPos + vThickness) ) )
        {
            vOutColor.rgb = vOutlineColor;
        }
        else
        if ( any( greaterThan( vCanvasPos, rect.vPos + rect.vSize - vThickness) ) )
        {
            vOutColor.rgb = vOutlineColor;
        }
        else
        if ( any( lessThanEqual( vCanvasPos, rect.vPos + vThickness * 2.0) ) )
        {
            vOutColor.rgb = vOutlineColor;
        }
        else
        if ( any( greaterThan( vCanvasPos, rect.vPos + rect.vSize - vThickness * 2.0) ) )
        {
            vOutColor.rgb = vOutlineColor;
        }
    }    
}

void DrawBorderIndent( vec2 vCanvasPos, Rect rect, inout vec4 vOutColor )
{    
    vec2 vThickness = vec2(1.0);
    
	if ( Inside( vCanvasPos, rect ) )
    {        
        if ( any( lessThanEqual( vCanvasPos, rect.vPos + vThickness) ) )
        {
            vOutColor.rgb = vec3(0.0);
        }
        else
        if ( any( greaterThan( vCanvasPos, rect.vPos + rect.vSize - vThickness) ) )
        {
            vOutColor.rgb = vec3(0.85);
        }
        else
        if ( any( lessThanEqual( vCanvasPos, rect.vPos + vThickness * 2.0) ) )
        {
            vOutColor.rgb = vec3(0.4);
        }
        else
        if ( any( greaterThan( vCanvasPos, rect.vPos + rect.vSize - vThickness * 2.0) ) )
        {
            vOutColor.rgb = vec3(1.0);
        }
    }
}
    
struct UIDrawContext
{        
    vec2 vCanvasSize;
    
    // position and size of unclipped viewport on the screen
    Rect viewport;
    
    // visible region of viewport on the screen
    Rect clip;
    
    // canvas co-ordinates at top-left corner of viewport
    vec2 vOffset;
};

vec2 UIDrawContext_ScreenPosToCanvasPos( UIDrawContext drawContext, vec2 vScreenPos )
{
    vec2 vViewPos = vScreenPos - drawContext.viewport.vPos;
    return vViewPos + drawContext.vOffset;
}

vec2 UIDrawContext_CanvasPosToScreenPos( UIDrawContext drawContext, vec2 vCanvasPos )
{
    return vCanvasPos - drawContext.vOffset + drawContext.viewport.vPos;
}

bool UIDrawContext_ScreenPosInView( UIDrawContext drawContext, vec2 vScreenPos )
{
    return Inside( vScreenPos, drawContext.clip );
}

bool UIDrawContext_ScreenPosInCanvasRect( UIDrawContext drawContext, vec2 vScreenPos, Rect canvasRect )
{
	vec2 vCanvasPos = UIDrawContext_ScreenPosToCanvasPos( drawContext, vScreenPos );    
    return Inside( vCanvasPos, canvasRect );
}

UIDrawContext UIDrawContext_SetupFromRect( Rect rect )
{
    UIDrawContext drawContext;
    drawContext.viewport = rect;
    drawContext.vOffset = vec2(0);
    drawContext.vCanvasSize = rect.vSize;
	return drawContext;
}


UIDrawContext UIDrawContext_TransformChild( UIDrawContext parentContext, UIDrawContext childContext )
{
    UIDrawContext result;
    
    // The child canvas size is unmodified
    result.vCanvasSize = childContext.vCanvasSize;

    // Child viewport positions are in the parent's canvas
    // Transform them to screen co-ordinates    
    result.viewport.vPos = UIDrawContext_CanvasPosToScreenPos( parentContext, childContext.viewport.vPos );
    vec2 vMax = childContext.viewport.vPos + childContext.viewport.vSize;
    vec2 vScreenMax = UIDrawContext_CanvasPosToScreenPos( parentContext, vMax );
    result.viewport.vSize = vScreenMax - result.viewport.vPos;
    result.vOffset = childContext.vOffset;
    
    // Now clip the view so that it is within the parent view
    vec2 vViewMin = max( result.viewport.vPos, parentContext.clip.vPos );
    vec2 vViewMax = min( result.viewport.vPos + result.viewport.vSize, parentContext.clip.vPos + parentContext.clip.vSize );

    // Clip view to current canvas
    vec2 vCanvasViewMin = result.viewport.vPos - result.vOffset;
    vec2 vCanvasViewMax = vCanvasViewMin + result.vCanvasSize;
    
    vViewMin = max( vViewMin, vCanvasViewMin );
	vViewMax = min( vViewMax, vCanvasViewMax );
    
    result.clip = Rect( vViewMin, vViewMax - vViewMin );
    
    return result;
}

float 	UIStyle_TitleBarHeight();
vec2 	UIStyle_WindowBorderSize();
vec2 	UIStyle_WindowContentPadding();
vec2 	UIStyle_ControlSpacing();
vec2 	UIStyle_FontPadding();
vec2 	UIStyle_CheckboxSize();
vec2 	UIStyle_SliderSize();
vec3 	UIStyle_ColorPickerSize();
float 	UIStyle_ScrollBarSize();
float   UIStyle_WindowTransparency();

struct UILayout
{
    float fTabPosition;
    vec2 vCursor;
    Rect controlRect;
    
    // Bounds of controls in current stack
    vec2 vControlMax;
    vec2 vControlMin;
};
    
UILayout UILayout_Reset()
{
    UILayout uiLayout;
    
    uiLayout.fTabPosition = 0.0;
    uiLayout.vCursor = vec2(0);
    uiLayout.controlRect = Rect( vec2(0), vec2(0) );
    uiLayout.vControlMax = vec2(0);
    uiLayout.vControlMin = vec2(0);
    
    return uiLayout;
}

Rect UILayout_GetStackedControlRect( inout UILayout uiLayout, vec2 vSize )
{
    return Rect( uiLayout.vCursor, vSize );
}

void UILayout_SetControlRect( inout UILayout uiLayout, Rect rect )
{
    uiLayout.controlRect = rect;
    
    uiLayout.vControlMax = max( uiLayout.vControlMax, rect.vPos + rect.vSize );
    uiLayout.vControlMin = max( uiLayout.vControlMin, rect.vPos );    
}

Rect UILayout_StackControlRect( inout UILayout uiLayout, vec2 vSize )
{
    Rect rect = UILayout_GetStackedControlRect( uiLayout, vSize );
    UILayout_SetControlRect( uiLayout, rect );
    return rect;
}

void UILayout_SetX( inout UILayout uiLayout, float xPos )
{
    uiLayout.vCursor.x = xPos;
    uiLayout.vControlMax.x = uiLayout.vCursor.x;
    uiLayout.vControlMin.x = uiLayout.vCursor.x;
}

void UILayout_StackRight( inout UILayout uiLayout )
{
    UILayout_SetX( uiLayout, uiLayout.vControlMax.x + UIStyle_ControlSpacing().x );
}

void UILayout_StackDown( inout UILayout uiLayout )
{
    uiLayout.vCursor.x = uiLayout.fTabPosition;
    uiLayout.vCursor.y = uiLayout.vControlMax.y + UIStyle_ControlSpacing().y;    
    uiLayout.vControlMax.x = uiLayout.vCursor.x;
    uiLayout.vControlMin.x = uiLayout.vCursor.x;
    uiLayout.vControlMax.y = uiLayout.vCursor.y;
    uiLayout.vControlMin.y = uiLayout.vCursor.y;
}

#define IDC_NONE            -1

struct UIContext
{
    vec2 vPixelPos;
    
    vec2 vMousePos;
    bool bMouseDown;
    bool bMouseWasDown;
    bool bHandledClick;
    
    ivec2 vFragCoord;
    vec4 vOutColor;
    float fBlendRemaining;

    vec4 vOutData;
    
    int iActiveControl;
    vec2 vActivePos;

    UIDrawContext drawContext;
    bool bPixelInView; // derived from drawContext
    vec2 vPixelCanvasPos; // derived from drawContext
    bool bMouseInView; // derived from drawContext
    vec2 vMouseCanvasPos; // derived from drawContext

    vec4 vWindowOutColor; // Output for current window draw pass
#ifdef SHADOW_TEST
    float fShadow;
    float fOutShadow;
#endif    
};

void UI_SetDrawContext( inout UIContext uiContext, UIDrawContext drawContext )
{
    uiContext.drawContext = drawContext;
    
    uiContext.vPixelCanvasPos = UIDrawContext_ScreenPosToCanvasPos( drawContext, uiContext.vPixelPos );
    uiContext.bPixelInView = UIDrawContext_ScreenPosInView( drawContext, uiContext.vPixelPos );

    uiContext.vMouseCanvasPos = UIDrawContext_ScreenPosToCanvasPos( drawContext, uiContext.vMousePos );
    uiContext.bMouseInView = UIDrawContext_ScreenPosInView( drawContext, uiContext.vMousePos );
}    

UIContext UI_GetContext( vec2 fragCoord, int iData )
{
    UIContext uiContext;
    
    uiContext.vPixelPos = fragCoord;
    uiContext.vPixelPos.y = iResolution.y - uiContext.vPixelPos.y;
    uiContext.vMousePos = iMouse.xy;
    uiContext.vMousePos.y = iResolution.y - uiContext.vMousePos.y;
    uiContext.bMouseDown = iMouse.z > 0.0;       
    
    vec4 vData0 = LoadVec4( iChannelUI, ivec2(iData,0) );
    
    uiContext.bMouseWasDown = (vData0.x > 0.0);
    
    uiContext.vFragCoord = ivec2(fragCoord);
    uiContext.vOutColor = vec4(0.0);
#ifdef SHADOW_TEST    
    uiContext.fShadow = 1.0;
    uiContext.fOutShadow = 1.0f;
#endif    
    uiContext.fBlendRemaining = 1.0;
    
    uiContext.vOutData = vec4(0.0);
    if ( int(uiContext.vFragCoord.y) < 2 )
    {
        // Initialize data with previous value
	    uiContext.vOutData = texelFetch( iChannelUI, uiContext.vFragCoord, 0 );     
    }
    uiContext.bHandledClick = false;
    
    uiContext.iActiveControl = int(vData0.y);
    uiContext.vActivePos = vec2(vData0.zw);
        
    
    UIDrawContext rootContext;
    
    rootContext.vCanvasSize = iResolution.xy;
    rootContext.vOffset = vec2(0);
    rootContext.viewport = Rect( vec2(0), vec2(iResolution.xy) );
    rootContext.clip = rootContext.viewport;

    UI_SetDrawContext( uiContext, rootContext );
    
    uiContext.vWindowOutColor = vec4(0);    
        
    if ( iFrame == 0 )
    {
        uiContext.bMouseWasDown = false;
        uiContext.iActiveControl = IDC_NONE;
    }
    
    return uiContext;
}///

void UI_StoreContext( inout UIContext uiContext, int iData )
{
    vec4 vData0 = vec4( uiContext.bMouseDown ? 1.0 : 0.0, float(uiContext.iActiveControl), uiContext.vActivePos.x, uiContext.vActivePos.y );
    StoreVec4( ivec2(iData,0), vData0, uiContext.vOutData, ivec2(uiContext.vFragCoord) );
}

vec4 UI_GetFinalColor( UIContext uiContext )
{
    if ( int(uiContext.vFragCoord.y) < 2 )
    {
        return uiContext.vOutData;
    }
    
    if ( uiContext.vOutColor.a >= 0.0 )
    {
        // Apply premultiplied alpha.
        uiContext.vOutColor.rgb *= uiContext.vOutColor.a;
  
#ifdef SHADOW_TEST
        // Shadow composite for premultiplied alpha.
        // Don't even ask how this works - I'm not sure I know
        uiContext.vOutColor.rgb *= uiContext.fOutShadow;
        uiContext.vOutColor.a = 1.0 - ((1.0 - uiContext.vOutColor.a) * uiContext.fOutShadow);
#endif 	
    }
    else
    {
#ifdef SHADOW_TEST
        uiContext.vOutColor.a = -1.0 -uiContext.fOutShadow;
#else
        uiContext.vOutColor.a = -2.0;
#endif 
    }
    
    return uiContext.vOutColor;
}

void UI_ComposeWindowLayer( inout UIContext uiContext, float fTransparency, Rect windowRect )
{
#ifdef SHADOW_TEST   
  	if ( !uiContext.bPixelInView )
    {
        return;
    }

#if 1
    // cull window?
    Rect boundsRect = windowRect;
    RectExpand( boundsRect, vec2( 16.0 ) );
    if ( !Inside( uiContext.vPixelPos, boundsRect ) )
    {
        return;
    }
#endif
    
    // We need to compose in the parent drawContext for this to work...
    float fPrevShadow = uiContext.fShadow;
    
    vec2 vShadowOffset = vec2( 5.0, 8.0 );
    float fShadowInner = 3.0;
	float fShadowOuter = 12.0;
    
    Rect shadowRect = windowRect;
    RectShrink( shadowRect, vec2( fShadowInner ) );
    
    vec2 vShadowTestPos = uiContext.vPixelPos - vShadowOffset;
    vec2 vWindowClosest = clamp( vShadowTestPos, shadowRect.vPos, shadowRect.vPos + shadowRect.vSize );

    float fWindowDist = length( vWindowClosest - vShadowTestPos );
    
    float fCurrentShadow = clamp( (fWindowDist) / (fShadowOuter + fShadowInner), 0.0, 1.0 );
    fCurrentShadow = sqrt( fCurrentShadow );
    float fShadowTransparency = 0.5;
	uiContext.fShadow *= fCurrentShadow * (1.0 - fShadowTransparency) + fShadowTransparency; 
#endif    

  	if ( !Inside( uiContext.vPixelPos, windowRect ) )
    {
        return;
    }

    float fBlend = uiContext.fBlendRemaining * (1.0f - fTransparency);

#ifdef SHADOW_TEST
    uiContext.fOutShadow *= fPrevShadow * (fBlend) + (1.0 - fBlend);
#endif
    
    // never blend under "ID" window
    if ( uiContext.vOutColor.a < 0.0 )
    {
        return;
    }
    
    if ( uiContext.vWindowOutColor.a < 0.0 )
    {
        if ( uiContext.fBlendRemaining == 1.0f )
        {
            // Ouput ID without blending
            uiContext.vOutColor = uiContext.vWindowOutColor;
            uiContext.fBlendRemaining = 0.0f;
            return;
        }
        else
        {
            // blending id under existing color - blend in grey instead of ID
            uiContext.vWindowOutColor = vec4(0.75, 0.75, 0.75, 1.0);
        }
    }

    uiContext.vOutColor += uiContext.vWindowOutColor * fBlend;
    
    uiContext.fBlendRemaining *= fTransparency;
}

///////////////////////////
// UI Data
///////////////////////////

#define DIRTY_DATA_MAGIC			123.456

const float eps = 0.0000001;

vec3 hsv2rgb( in vec3 c )
{
    vec3 rgb = clamp( abs(mod(c.x*6.0+vec3(0.0,4.0,2.0),6.0)-3.0)-1.0, 0.0, 1.0 );
    return c.z * mix( vec3(1.0), rgb, c.y);
}

vec3 rgb2hsv( in vec3 c)
{
    vec4 k = vec4(0.0, -1.0/3.0, 2.0/3.0, -1.0);
    vec4 p = mix(vec4(c.zy, k.wz), vec4(c.yz, k.xy), (c.z<c.y) ? 1.0 : 0.0);
    vec4 q = mix(vec4(p.xyw, c.x), vec4(c.x, p.yzx), (p.x<c.x) ? 1.0 : 0.0);
    float d = q.x - min(q.w, q.y);
    return vec3(abs(q.z + (q.w - q.y) / (6.0*d+eps)), d / (q.x+eps), q.x);
}

struct UIData_Bool
{
    bool bValue;
};
    
UIData_Bool UI_GetDataBool( int iData, bool bDefault )  
{
    UIData_Bool dataBool;
        
	vec4 vData0 = LoadVec4( iChannelUI, ivec2(iData,0) );
    
    if ( iFrame == 0 )
    {
        dataBool.bValue = bDefault;
    }
    else
    {
        dataBool.bValue =  vData0.x > 0.5;
    }
    
    return dataBool;
}

void UI_StoreDataBool( inout UIContext uiContext, UIData_Bool dataBool, int iData )
{
    vec4 vData0 = vec4(0);
    vData0.x = dataBool.bValue ? 1.0 : 0.0;
    StoreVec4( ivec2(iData,0), vData0, uiContext.vOutData, ivec2(uiContext.vFragCoord) );            
}


struct UIData_Value
{
    float fValue;
    float fRangeMin;
    float fRangeMax;
    bool bInteger;
};

UIData_Value UI_GetDataValue( int iData, float fDefaultValue, float fRangeMin, float fRangeMax, bool bInteger )  
{
    UIData_Value dataValue;
    
    vec4 vData0 = LoadVec4( iChannelUI, ivec2(iData,0) );
    
    if ( iFrame == 0 )
    {
        dataValue.fValue = fDefaultValue;
    }
    else
    {
        dataValue.fValue = vData0.x;
    }
    
    dataValue.fRangeMin = fRangeMin;
    dataValue.fRangeMax = fRangeMax;
    dataValue.bInteger = bInteger;
    
    return dataValue;
}

void UI_StoreDataValue( inout UIContext uiContext, UIData_Value dataValue, int iData )
{
    vec4 vData0 = vec4(0);
    vData0.x = dataValue.fValue;
    StoreVec4( ivec2(iData,0), vData0, uiContext.vOutData, ivec2(uiContext.vFragCoord) );            
}

struct UIData_Color
{    
    vec3 vHSV;
};

UIData_Color UI_GetDataColor( int iData, vec3 cDefaultRGB )  
{
    UIData_Color dataColor;
    
    vec4 vData1 = LoadVec4( iChannelUI, ivec2(iData,1) );
    
    if ( iFrame == 0 )
    {
        dataColor.vHSV = rgb2hsv( cDefaultRGB );
    }
    else
    {
        dataColor.vHSV = vData1.rgb;
    }
    
    return dataColor;
}

void UI_StoreDataColor( inout UIContext uiContext, UIData_Color dataColor, int iData )
{
    vec4 vData0 = vec4(0);
    vData0.rgb = hsv2rgb( dataColor.vHSV );
        
    StoreVec4( ivec2(iData,0), vData0, uiContext.vOutData, ivec2(uiContext.vFragCoord) );            

    vec4 vData1 = vec4(0);
    vData1.rgb = dataColor.vHSV;
        
    StoreVec4( ivec2(iData,1), vData1, uiContext.vOutData, ivec2(uiContext.vFragCoord) );            
}

PrintState UI_PrintState_Init( inout UIContext uiContext, LayoutStyle style, vec2 vPosition )
{
    vec2 vCanvasPos = uiContext.vPixelCanvasPos;
    
    PrintState state = PrintState_InitCanvas( vCanvasPos, vec2(1.0) );
    MoveTo( state, vPosition + UIStyle_FontPadding() );
	PrintBeginNextLine(state, style);

	return state;
}

Rect UI_GetFontRect( PrintState state, LayoutStyle style )
{
    Rect rect;
    rect = GetFontRect( state, style, true );
    vec2 vExpand = UIStyle_FontPadding();
    vExpand.y += style.vSize.y * style.fLineGap;
    RectExpand( rect, vExpand );
	return rect;
}

void UI_RenderFont( inout UIContext uiContext, PrintState state, LayoutStyle style, RenderStyle renderStyle )
{
    if( uiContext.bPixelInView )
    {
        RenderFont( state, style, renderStyle, uiContext.vWindowOutColor.rgb );
    }
}

void UILayout_SetControlRectFromText( inout UILayout uiLayout, PrintState state, LayoutStyle style )
{
    UILayout_SetControlRect( uiLayout, UI_GetFontRect( state, style ) );
}

struct UIPanelState
{
    UIDrawContext parentDrawContext;
	vec4 vParentWindowColor;
};
    
void UI_PanelBegin( inout UIContext uiContext, inout UIPanelState panelState )
{
    panelState.parentDrawContext = uiContext.drawContext;
    panelState.vParentWindowColor = uiContext.vWindowOutColor;
}

void UI_PanelEnd( inout UIContext uiContext, inout UIPanelState panelState )
{
    if ( !uiContext.bPixelInView )
    {
        // Restore parent window color if outside view
	    uiContext.vWindowOutColor = panelState.vParentWindowColor;    
    }

    UI_SetDrawContext( uiContext, panelState.parentDrawContext );
}

#define FLAG_SET(X,F) (( X & F ) != 0u)
    
const uint	WINDOW_CONTROL_FLAG_CLOSE_BOX 		= 1u,
			WINDOW_CONTROL_FLAG_MINIMIZE_BOX	= 2u,
			WINDOW_CONTROL_FLAG_RESIZE_WIDGET 	= 4u,
			WINDOW_CONTROL_FLAG_TITLE_BAR 		= 8u;
    
struct UIWindowDesc
{
    Rect initialRect;
    bool bStartMinimized;
    bool bStartClosed;
    
    uint uControlFlags;    
    vec2 vMaxSize;
};


struct UIWindowState
{
    UIPanelState panelState;

    Rect rect;
    bool bMinimized;
    bool bClosed;
    
    uint uControlFlags;    
    vec2 vMaxSize;
    int iControlId;

    Rect drawRect;
};


UIWindowState UI_GetWindowState( UIContext uiContext, int iControlId, int iData, UIWindowDesc desc )
{
    UIWindowState window;    
    
    vec4 vData0 = LoadVec4( iChannelUI, ivec2(iData,0) );
        
    window.rect = Rect( vData0.xy, vData0.zw );
    
    vec4 vData1 = LoadVec4( iChannelUI, ivec2(iData,1) );
    
    window.bMinimized = (vData1.x > 0.0);    
    window.bClosed = (vData1.y > 0.0);    
    
    // Clamp window position so title bar is always on canvas
	vec2 vSafeMin = vec2(24.0);        
	vec2 vSafeMax = vec2(32.0);        
    vec2 vPosMin = vec2( -window.rect.vSize.x + vSafeMin.x, -vSafeMin.y);//vec2( -window.rect.vSize.x, 0.0) + 24.0, -24.0 );
    vec2 vPosMax = uiContext.drawContext.vCanvasSize - vSafeMax;
    window.rect.vPos = clamp( window.rect.vPos, vPosMin, vPosMax );
    
    if ( iFrame == 0 || vData1.z != DIRTY_DATA_MAGIC)
    {
        window.rect = desc.initialRect;
        window.bMinimized = desc.bStartMinimized;
	    window.bClosed = desc.bStartClosed;
    }       
    
    window.uControlFlags = desc.uControlFlags;
    window.vMaxSize = desc.vMaxSize;
    
    window.iControlId = iControlId;
        
    return window;
}

void UI_StoreWindowState( inout UIContext uiContext, UIWindowState window, int iData )
{    
    vec4 vData0;
    vData0.xy = window.rect.vPos;
    vData0.zw = window.rect.vSize;
    
    StoreVec4( ivec2(iData,0), vData0, uiContext.vOutData, ivec2(uiContext.vFragCoord) );        

    vec4 vData1;
    
    vData1.x = window.bMinimized ? 1.0f : 0.0f;
    vData1.y = window.bClosed ? 1.0f : 0.0f;
    vData1.z = DIRTY_DATA_MAGIC;
    vData1.w = 0.0f;

    StoreVec4( ivec2(iData,1), vData1, uiContext.vOutData, ivec2(uiContext.vFragCoord) );        
}

void UI_WriteCanvasPos( inout UIContext uiContext, int iControlId )        
{
	if (!uiContext.bPixelInView)
        return;
    Rect rect = Rect( vec2(0), uiContext.drawContext.vCanvasSize );
    DrawRect( uiContext.vPixelCanvasPos, rect, vec4(uiContext.vPixelCanvasPos, float(iControlId), -1.0 ), uiContext.vWindowOutColor );
}    

void UI_WriteCanvasUV( inout UIContext uiContext, int iControlId )        
{
	if (!uiContext.bPixelInView)
        return;
    Rect rect = Rect( vec2(0), uiContext.drawContext.vCanvasSize );
    DrawRect( uiContext.vPixelCanvasPos, rect, vec4(uiContext.vPixelCanvasPos / uiContext.drawContext.vCanvasSize, float(iControlId), -1.0 ), uiContext.vWindowOutColor );
}

void UI_DrawButton( inout UIContext uiContext, bool bActive, bool bMouseOver, Rect buttonRect )
{
	if (!uiContext.bPixelInView)
        return;
    
    if ( bActive && bMouseOver )
    {
#ifdef NEW_THEME
    	DrawBorderRect( uiContext.vPixelCanvasPos, buttonRect, cButtonActive, uiContext.vWindowOutColor );
#else
    	DrawBorderIndent( uiContext.vPixelCanvasPos, buttonRect, uiContext.vWindowOutColor );
#endif        
    }
    else
    {
#ifdef NEW_THEME
    	DrawBorderRect( uiContext.vPixelCanvasPos, buttonRect, cButtonInactive, uiContext.vWindowOutColor );
#else
    	DrawBorderOutdent( uiContext.vPixelCanvasPos, buttonRect, uiContext.vWindowOutColor );
#endif        
    }
}

bool UI_ProcessButton( inout UIContext uiContext, int iControlId, Rect buttonRect )
{    
    bool bMouseOver = Inside( uiContext.vMouseCanvasPos, buttonRect ) && uiContext.bMouseInView;
    
    bool bButtonPressed = false;
    
    if ( uiContext.iActiveControl == IDC_NONE )
    {
        if ( uiContext.bMouseDown && (!uiContext.bMouseWasDown) && bMouseOver && !uiContext.bHandledClick )
        {
            uiContext.iActiveControl = iControlId;
            uiContext.bHandledClick = true;
        }
    }
    else
    if ( uiContext.iActiveControl == iControlId )
    {
        if ( !uiContext.bMouseDown )
        {
            uiContext.iActiveControl = IDC_NONE;
            if ( bMouseOver )
            {
                bButtonPressed = true;
            }
        }
    }

    bool bActive = (uiContext.iActiveControl == iControlId);
    
    UI_DrawButton( uiContext, bActive, bMouseOver, buttonRect );    
        
    return bButtonPressed;
}

void UI_DrawCheckbox( inout UIContext uiContext, bool bActive, bool bMouseOver, bool bChecked, Rect checkBoxRect )
{
	if (!uiContext.bPixelInView || Outside( uiContext.vPixelCanvasPos, checkBoxRect ))
        return;
    
    uiContext.vWindowOutColor = vec4(1.0);
    
    if ( bActive && bMouseOver )
    {
        uiContext.vWindowOutColor = vec4(0.85,0.85,0.85,1.0);
    }

#ifdef NEW_THEME
    DrawBorderRect( uiContext.vPixelCanvasPos, checkBoxRect, cCheckboxOutline, uiContext.vWindowOutColor );
#else    
    DrawBorderIndent( uiContext.vPixelCanvasPos, checkBoxRect, uiContext.vWindowOutColor );
#endif    

    Rect smallerRect = checkBoxRect;
    RectShrink( smallerRect, vec2(6.0));

    if ( bChecked )
    {
        vec4 vCheckColor = vec4(0.0, 0.0, 0.0, 1.0);
        DrawLine( uiContext.vPixelCanvasPos, smallerRect.vPos+ smallerRect.vSize * vec2(0.0, 0.75), smallerRect.vPos+ smallerRect.vSize * vec2(0.25, 1.0), 2.0f, vCheckColor, uiContext.vWindowOutColor );
        DrawLine( uiContext.vPixelCanvasPos, smallerRect.vPos+ smallerRect.vSize * vec2(0.25, 1.0), smallerRect.vPos+ smallerRect.vSize * vec2(1.0, 0.25), 2.0f, vCheckColor, uiContext.vWindowOutColor );
    }
}

void UI_ProcessCheckbox( inout UIContext uiContext, int iControlId, inout UIData_Bool data, Rect checkBoxRect )
{    
    bool bMouseOver = Inside( uiContext.vMouseCanvasPos, checkBoxRect ) && uiContext.bMouseInView;
    
    if ( uiContext.iActiveControl == IDC_NONE )
    {
        if ( uiContext.bMouseDown && (!uiContext.bMouseWasDown) && bMouseOver && !uiContext.bHandledClick )
        {
            uiContext.iActiveControl = iControlId;
            uiContext.bHandledClick = true;
        }
    }
    else
    if ( uiContext.iActiveControl == iControlId )
    {
        if ( !uiContext.bMouseDown )
        {
            uiContext.iActiveControl = IDC_NONE;
            if ( bMouseOver )
            {
                data.bValue = !data.bValue;
            }
        }
    }
    
    bool bActive = (uiContext.iActiveControl == iControlId);
    
    UI_DrawCheckbox( uiContext, bActive, bMouseOver, data.bValue, checkBoxRect );    
}

void UI_DrawSliderX( inout UIContext uiContext, bool bActive, bool bMouseOver, float fPosition, Rect sliderRect, float fHandleSize, bool scrollbarStyle )
{
	if (!uiContext.bPixelInView || Outside( uiContext.vPixelCanvasPos, sliderRect ))
        return;
    
    Rect horizLineRect;
    
    horizLineRect = sliderRect;
    if (!scrollbarStyle)
    {
	    float fMid = sliderRect.vPos.y + sliderRect.vSize.y * 0.5;
    	horizLineRect.vPos.y = fMid - 2.0;
    	horizLineRect.vSize.y = 4.0;
    }

#ifdef NEW_THEME    
    DrawBorderRect( uiContext.vPixelCanvasPos, horizLineRect, cSliderLineCol, uiContext.vWindowOutColor );
#else    
    DrawBorderIndent( uiContext.vPixelCanvasPos, horizLineRect, uiContext.vWindowOutColor );
#endif

    float fSlideMin = sliderRect.vPos.x + fHandleSize * 0.5f;
    float fSlideMax = sliderRect.vPos.x + sliderRect.vSize.x - fHandleSize * 0.5f;

    float fDistSlider = (fSlideMin + (fSlideMax-fSlideMin) * fPosition);

    Rect handleRect;

    handleRect = sliderRect;
    handleRect.vPos.x = fDistSlider - fHandleSize * 0.5f;
    handleRect.vSize.x = fHandleSize;

    vec4 handleColor = vec4(0.75, 0.75, 0.75, 1.0);
    if ( bActive )
    {
        handleColor.rgb += 0.1;
    }       
    
    // highlight
#ifdef NEW_THEME     
    if ( (uiContext.vPixelCanvasPos.y - handleRect.vPos.y) < handleRect.vSize.y * 0.3 )
    {
        handleColor.rgb += 0.05;
    }
#endif    

    DrawRect( uiContext.vPixelCanvasPos, handleRect, handleColor, uiContext.vWindowOutColor );

#ifdef NEW_THEME   
    DrawBorderRect( uiContext.vPixelCanvasPos, handleRect, cSliderHandleOutlineCol, uiContext.vWindowOutColor );
#else    
    DrawBorderOutdent( uiContext.vPixelCanvasPos, handleRect, uiContext.vWindowOutColor );
#endif    
}

void UI_DrawSliderY( inout UIContext uiContext, bool bActive, bool bMouseOver, float fPosition, Rect sliderRect, float fHandleSize, bool scrollbarStyle )
{
	if (!uiContext.bPixelInView || Outside( uiContext.vPixelCanvasPos, sliderRect ))
        return;
    
    Rect horizLineRect;
    
    horizLineRect = sliderRect;
    if (!scrollbarStyle)
    {
	    float fMid = sliderRect.vPos.x + sliderRect.vSize.x * 0.5;
    	horizLineRect.vPos.x = fMid - 2.0;
    	horizLineRect.vSize.x = 4.0;
    }

#ifdef NEW_THEME    
    DrawBorderRect( uiContext.vPixelCanvasPos, horizLineRect, cSliderLineCol, uiContext.vWindowOutColor );
#else    
    DrawBorderIndent( uiContext.vPixelCanvasPos, horizLineRect, uiContext.vWindowOutColor );
#endif    

    float fSlideMin = sliderRect.vPos.y + fHandleSize * 0.5f;
    float fSlideMax = sliderRect.vPos.y + sliderRect.vSize.y - fHandleSize * 0.5f;

    float fDistSlider = (fSlideMin + (fSlideMax-fSlideMin) * fPosition);

    Rect handleRect;

    handleRect = sliderRect;
    handleRect.vPos.y = fDistSlider - fHandleSize * 0.5f;
    handleRect.vSize.y = fHandleSize;

    vec4 handleColor = vec4(0.75, 0.75, 0.75, 1.0);
    if ( bActive )
    {
        handleColor.rgb += 0.1;
    }
    
    // highlight
#ifdef NEW_THEME     
    if ( (uiContext.vPixelCanvasPos.y - handleRect.vPos.y) < handleRect.vSize.y * 0.3 )
    {
        handleColor.rgb += 0.05;
    }
#endif    

    DrawRect( uiContext.vPixelCanvasPos, handleRect, handleColor, uiContext.vWindowOutColor );
#ifdef NEW_THEME   
    DrawBorderRect( uiContext.vPixelCanvasPos, handleRect, cSliderHandleOutlineCol, uiContext.vWindowOutColor );
#else     
    DrawBorderOutdent( uiContext.vPixelCanvasPos, handleRect, uiContext.vWindowOutColor );
#endif    
}

void UI_ProcessSlider( inout UIContext uiContext, int iControlId, inout UIData_Value data, Rect sliderRect )
{    
    float fHandleSize = 8.0;
    
    bool bMouseOver = Inside( uiContext.vMouseCanvasPos, sliderRect ) && uiContext.bMouseInView;
    
    if ( uiContext.iActiveControl == IDC_NONE )
    {
        if ( uiContext.bMouseDown && (!uiContext.bMouseWasDown) && bMouseOver && !uiContext.bHandledClick )
        {
            uiContext.iActiveControl = iControlId;
            uiContext.bHandledClick = true;
        }
    }
    else
    if ( uiContext.iActiveControl == iControlId )
    {
        float fSlidePosMin = sliderRect.vPos.x + fHandleSize * 0.5f;
        float fSlidePosMax = sliderRect.vPos.x + sliderRect.vSize.x - fHandleSize * 0.5f;
        float fPosition = (uiContext.vMouseCanvasPos.x - fSlidePosMin) / (fSlidePosMax - fSlidePosMin);
        fPosition = clamp( fPosition, 0.0f, 1.0f );
        data.fValue = data.fRangeMin + fPosition * (data.fRangeMax - data.fRangeMin);
        if ( data.bInteger )
        {
            data.fValue = floor( data.fValue + 0.5 );
        }
        if ( !uiContext.bMouseDown )
        {
            uiContext.iActiveControl = IDC_NONE;
        }
    }
        
    bool bActive = (uiContext.iActiveControl == iControlId);
    float fPosition = (data.fValue - data.fRangeMin) / (data.fRangeMax - data.fRangeMin);
    
    UI_DrawSliderX( uiContext, bActive, bMouseOver, fPosition, sliderRect, fHandleSize, false );    
}

void UI_ProcessScrollbarX( inout UIContext uiContext, int iControlId, inout UIData_Value data, Rect sliderRect, float fHandleSize )
{    
    bool bMouseOver = Inside( uiContext.vMouseCanvasPos, sliderRect ) && uiContext.bMouseInView;
        
    if ( uiContext.iActiveControl == IDC_NONE )
    {
        if ( uiContext.bMouseDown && (!uiContext.bMouseWasDown) && bMouseOver && !uiContext.bHandledClick )
        {
            uiContext.iActiveControl = iControlId;
            uiContext.bHandledClick = true;
        }
    }
    else
    if ( uiContext.iActiveControl == iControlId )
    {
        float fSlidePosMin = sliderRect.vPos.x + fHandleSize * 0.5f;
        float fSlidePosMax = sliderRect.vPos.x + sliderRect.vSize.x - fHandleSize * 0.5f;
        float fPosition = (uiContext.vMouseCanvasPos.x - fSlidePosMin) / (fSlidePosMax - fSlidePosMin);
        fPosition = clamp( fPosition, 0.0f, 1.0f );
        data.fValue = data.fRangeMin + fPosition * (data.fRangeMax - data.fRangeMin);
        if ( !uiContext.bMouseDown )
        {
            uiContext.iActiveControl = IDC_NONE;
        }
    }
        
    bool bActive = (uiContext.iActiveControl == iControlId);
    float fPosition = (data.fValue - data.fRangeMin) / (data.fRangeMax - data.fRangeMin);
    
    UI_DrawSliderX( uiContext, bActive, bMouseOver, fPosition, sliderRect, fHandleSize, true );    
}

void UI_ProcessScrollbarY( inout UIContext uiContext, int iControlId, inout UIData_Value data, Rect sliderRect, float fHandleSize )
{    
    bool bMouseOver = Inside( uiContext.vMouseCanvasPos, sliderRect ) && uiContext.bMouseInView;
    
    if ( uiContext.iActiveControl == IDC_NONE )
    {
        if ( uiContext.bMouseDown && (!uiContext.bMouseWasDown) && bMouseOver && !uiContext.bHandledClick )
        {
            uiContext.iActiveControl = iControlId;
            uiContext.bHandledClick = true;
        }
    }
    else
    if ( uiContext.iActiveControl == iControlId )
    {
        float fSlidePosMin = sliderRect.vPos.y + fHandleSize * 0.5f;
        float fSlidePosMax = sliderRect.vPos.y + sliderRect.vSize.y - fHandleSize * 0.5f;
        float fPosition = (uiContext.vMouseCanvasPos.y - fSlidePosMin) / (fSlidePosMax - fSlidePosMin);
        fPosition = clamp( fPosition, 0.0f, 1.0f );
        data.fValue = data.fRangeMin + fPosition * (data.fRangeMax - data.fRangeMin);
        if ( !uiContext.bMouseDown )
        {
            uiContext.iActiveControl = IDC_NONE;
        }
    }
        
    bool bActive = (uiContext.iActiveControl == iControlId);
    float fPosition = (data.fValue - data.fRangeMin) / (data.fRangeMax - data.fRangeMin);
    
    UI_DrawSliderY( uiContext, bActive, bMouseOver, fPosition, sliderRect, fHandleSize, true );    
}

void UI_DrawColorPickerSV( inout UIContext uiContext, bool bActive, vec3 vHSV, Rect pickerRect )
{
	if (!uiContext.bPixelInView || Outside( uiContext.vPixelCanvasPos, pickerRect ))
        return;
    
    vec2 vCurrPixelPos = (uiContext.vPixelCanvasPos - pickerRect.vPos) / pickerRect.vSize;
    vCurrPixelPos.y = 1.0f - vCurrPixelPos.y;
    vec3 vHSVCurr = vHSV;
    vHSVCurr.yz = vCurrPixelPos;

    uiContext.vWindowOutColor = vec4( hsv2rgb( vHSVCurr ), 1.0 );
    
    vec2 vSelectedPos = vHSV.yz;
    vSelectedPos.y = 1.0f - vSelectedPos.y;
    vSelectedPos = vSelectedPos * pickerRect.vSize + pickerRect.vPos;
        
    float l = length( vSelectedPos - uiContext.vPixelCanvasPos );
    float d = l - 3.0;
    d = min(d, 5.0 - l);
    if ( bActive )
    {
        float d2 = l - 5.0;
    	d2 = min(d2, 7.0 - l);
	    d = max(d, d2);
    }
    
    float fBlend = clamp(d, 0.0, 1.0);
    
    uiContext.vWindowOutColor.rgb = mix(uiContext.vWindowOutColor.rgb, vec3(1.0) - uiContext.vWindowOutColor.rgb, fBlend);
}

void UI_ProcessColorPickerSV( inout UIContext uiContext, int iControlId, inout UIData_Color data, Rect pickerRect )
{
    bool bMouseOver = Inside( uiContext.vMouseCanvasPos, pickerRect ) && uiContext.bMouseInView;
    
    vec3 vHSV = data.vHSV;
    
    if ( uiContext.iActiveControl == IDC_NONE )
    {
        if ( uiContext.bMouseDown && (!uiContext.bMouseWasDown) && bMouseOver && !uiContext.bHandledClick )
        {
            uiContext.iActiveControl = iControlId;
            uiContext.bHandledClick = true;
        }
    }
    else
    if ( uiContext.iActiveControl == iControlId )
    {
        vec2 vPos = (uiContext.vMouseCanvasPos - pickerRect.vPos) / pickerRect.vSize;
        vPos = clamp( vPos, vec2(0), vec2(1) );
        
        vHSV.yz = vPos;
        vHSV.z = 1.0f - vHSV.z;
        
        if ( !uiContext.bMouseDown )
        {
            uiContext.iActiveControl = IDC_NONE;
        }
    }
    
    data.vHSV = vHSV;
    
    bool bActive = (uiContext.iActiveControl == iControlId);
    
    UI_DrawColorPickerSV( uiContext, bActive, vHSV, pickerRect );    
}

void UI_DrawColorPickerH( inout UIContext uiContext, bool bActive, vec3 vHSV, Rect pickerRect )
{
	if (!uiContext.bPixelInView || Outside( uiContext.vPixelCanvasPos, pickerRect ))
        return;
    
    vec2 vCurrPixelPos = (uiContext.vPixelCanvasPos - pickerRect.vPos) / pickerRect.vSize;
    vec3 vHSVCurr = vHSV;
    vHSVCurr.x = vCurrPixelPos.y;
    vHSVCurr.yz = vec2(1.0, 1.0);
    
    float fSelectedPos = vHSV.x * pickerRect.vSize.y + pickerRect.vPos.y;

	uiContext.vWindowOutColor = vec4( hsv2rgb( vHSVCurr ), 1.0 );
        
    float l = length( fSelectedPos - uiContext.vPixelCanvasPos.y );
    float d = l - 1.0;
    d = min(d, 5.0 - l);
    if ( bActive )
    {
        float d2 = l - 4.0;
    	d2 = min(d2, 6.0 - l);
	    d = max(d, d2);
    }
    
    float fBlend = clamp(d, 0.0, 1.0);
    
    uiContext.vWindowOutColor.rgb = mix(uiContext.vWindowOutColor.rgb, vec3(0.5), fBlend);    
}

void UI_ProcessColorPickerH( inout UIContext uiContext, int iControlId, inout UIData_Color data, Rect pickerRect )
{
    bool bMouseOver = Inside( uiContext.vMouseCanvasPos, pickerRect ) && uiContext.bMouseInView;
    
    vec3 vHSV = data.vHSV;
    
    if ( uiContext.iActiveControl == IDC_NONE )
    {
        if ( uiContext.bMouseDown && (!uiContext.bMouseWasDown) && bMouseOver && !uiContext.bHandledClick )
        {
            uiContext.iActiveControl = iControlId;
            uiContext.bHandledClick = true;
        }
    }
    else
    if ( uiContext.iActiveControl == iControlId )
    {
        float fPos = (uiContext.vMouseCanvasPos.y - pickerRect.vPos.y) / pickerRect.vSize.y;
        fPos = clamp( fPos, 0.0f, 1.0f );
        
        vHSV.x = fPos;
        
        if ( !uiContext.bMouseDown )
        {
            uiContext.iActiveControl = IDC_NONE;
        }
    }
    
    data.vHSV = vHSV;
    
    bool bActive = (uiContext.iActiveControl == iControlId);
    
    UI_DrawColorPickerH( uiContext, bActive, vHSV, pickerRect );
}

bool UI_DrawWindowCloseBox( inout UIContext uiContext, Rect closeBoxRect )
{
	if (!uiContext.bPixelInView || !Inside( uiContext.vPixelCanvasPos, closeBoxRect ))
        return false;
    
    vec2 vCrossPos = closeBoxRect.vPos + closeBoxRect.vSize * 0.5;        
    vec2 vCrossSize = closeBoxRect.vSize * 0.5 * 0.4;
    vec4 crossColor = vec4(0.0, 0.0, 0.0, 1.0);

    vec2 vCrossSizeFlip = vCrossSize * vec2(1.0, -1.0);
    
    DrawLine( uiContext.vPixelCanvasPos, vCrossPos - vCrossSize, vCrossPos + vCrossSize, 2.0f, crossColor, uiContext.vWindowOutColor );
    DrawLine( uiContext.vPixelCanvasPos, vCrossPos - vCrossSizeFlip, vCrossPos + vCrossSizeFlip, 2.0f, crossColor, uiContext.vWindowOutColor );
    
    return true;
}

bool UI_ProcessWindowCloseBox( inout UIContext uiContext, inout UIWindowState window, int iControlId, Rect closeBoxRect )
{
    bool bPressed = UI_ProcessButton( uiContext, iControlId, closeBoxRect );
    
    if ( bPressed )
    {
 		window.bClosed = true;
    }

    bool bActive = (uiContext.iActiveControl == iControlId);
    
    return UI_DrawWindowCloseBox( uiContext, closeBoxRect );
}
    
bool UI_DrawWindowMinimizeWidget( inout UIContext uiContext, bool bMinimized, Rect minimizeBoxRect )
{
	if (!uiContext.bPixelInView || !Inside( uiContext.vPixelCanvasPos, minimizeBoxRect ))
        return false;
    
    vec2 vArrowPos = minimizeBoxRect.vPos + minimizeBoxRect.vSize * 0.5;        
    vec2 vArrowSize = minimizeBoxRect.vSize * 0.25;
    vec4 arrowColor = vec4(0.0, 0.0, 0.0, 1.0);
    if ( !bMinimized )
    {
        DrawLine( uiContext.vPixelCanvasPos, vArrowPos + vec2(-1.0, -0.5) * vArrowSize, vArrowPos + vec2(0.0, 0.5) * vArrowSize, 2.0f, arrowColor, uiContext.vWindowOutColor );
        DrawLine( uiContext.vPixelCanvasPos, vArrowPos + vec2( 1.0, -0.5) * vArrowSize, vArrowPos + vec2(0.0, 0.5) * vArrowSize, 2.0f, arrowColor, uiContext.vWindowOutColor );
    }
    else
    {
        DrawLine( uiContext.vPixelCanvasPos, vArrowPos + vec2( 0.5, 0.0 )* vArrowSize, vArrowPos + vec2(-0.5, -1.0) * vArrowSize, 2.0f, arrowColor, uiContext.vWindowOutColor );
        DrawLine( uiContext.vPixelCanvasPos, vArrowPos + vec2( 0.5, 0.0 )* vArrowSize, vArrowPos + vec2(-0.5,  1.0) * vArrowSize, 2.0f, arrowColor, uiContext.vWindowOutColor );
    }    
    
    return true;
}

bool UI_ProcessWindowMinimizeWidget( inout UIContext uiContext, inout UIWindowState window, int iControlId, Rect minimizeBoxRect )
{    
    bool bPressed = UI_ProcessButton( uiContext, iControlId, minimizeBoxRect );
    
    if ( bPressed )
    {
 		window.bMinimized = !window.bMinimized;        
    }

    bool bActive = (uiContext.iActiveControl == iControlId);
    
    return UI_DrawWindowMinimizeWidget( uiContext, window.bMinimized, minimizeBoxRect );
}

void UI_ProcessScrollbarPanelBegin( inout UIContext uiContext, inout UIPanelState scrollbarState, int iControlId, int iData, Rect scrollbarPanelRect, vec2 vScrollbarCanvasSize )
{
    float styleSize = UIStyle_ScrollBarSize();
    
	bool bScrollbarHorizontal = (scrollbarPanelRect.vSize.x < vScrollbarCanvasSize.x);
    if ( bScrollbarHorizontal )
    {        
        scrollbarPanelRect.vSize.y -= styleSize;
    }

    bool bScrollbarVertical = (scrollbarPanelRect.vSize.y < vScrollbarCanvasSize.y);
    if ( bScrollbarVertical )
    {
        scrollbarPanelRect.vSize.x -= styleSize;
    }

    // Adding a vertical scrollbar may mean we now need a horizontal one
    if ( !bScrollbarHorizontal )
    {
        bScrollbarHorizontal = (scrollbarPanelRect.vSize.x < vScrollbarCanvasSize.x);
        if ( bScrollbarHorizontal )
        {        
            scrollbarPanelRect.vSize.y -= styleSize;
        }
    }
    
    // Todo : Force enable or disable ?

	vec4 vData0 = LoadVec4( iChannelUI, ivec2(iData,0) );   
        
    UIData_Value scrollValueX;
    scrollValueX.fRangeMin = 0.0;
    scrollValueX.fRangeMax = max(0.0, vScrollbarCanvasSize.x - scrollbarPanelRect.vSize.x);
        
    UIData_Value scrollValueY;
    scrollValueY.fRangeMin = 0.0;
    scrollValueY.fRangeMax = max(0.0, vScrollbarCanvasSize.y - scrollbarPanelRect.vSize.y);
    
    if ( iFrame == 0 || vData0.z != DIRTY_DATA_MAGIC )
    {
        scrollValueX.fValue = 0.0;
        scrollValueY.fValue = 0.0;
    }
    else
    {
        scrollValueX.fValue = vData0.x;
        scrollValueY.fValue = vData0.y;
    }    
    
    scrollValueX.fValue = clamp( scrollValueX.fValue, scrollValueX.fRangeMin, scrollValueX.fRangeMax );
    scrollValueY.fValue = clamp( scrollValueY.fValue, scrollValueY.fRangeMin, scrollValueY.fRangeMax );
    
    if ( bScrollbarHorizontal )
    {
        Rect scrollbarRect;
        scrollbarRect.vPos = scrollbarPanelRect.vPos;
        scrollbarRect.vPos.y += scrollbarPanelRect.vSize.y;
        scrollbarRect.vSize.x = scrollbarPanelRect.vSize.x;
        scrollbarRect.vSize.y = styleSize;
        
        float fHandleSize = scrollbarRect.vSize.x * (scrollbarPanelRect.vSize.x / vScrollbarCanvasSize.x);

        if ( uiContext.bPixelInView ) 
        {
	        DrawRect( uiContext.vPixelCanvasPos, scrollbarRect, vec4(0.6, 0.6, 0.6, 1.0), uiContext.vWindowOutColor );
        }        
        UI_ProcessScrollbarX( uiContext, iControlId, scrollValueX, scrollbarRect, fHandleSize );
    }
        
    if ( bScrollbarVertical )
    {        
        Rect scrollbarRect;
        scrollbarRect.vPos = scrollbarPanelRect.vPos;
        scrollbarRect.vPos.x += scrollbarPanelRect.vSize.x;
        scrollbarRect.vSize.x = styleSize;
        scrollbarRect.vSize.y = scrollbarPanelRect.vSize.y;
        
        float fHandleSize = scrollbarRect.vSize.y * (scrollbarPanelRect.vSize.y / vScrollbarCanvasSize.y);
        
        if ( uiContext.bPixelInView ) 
        {
	        DrawRect( uiContext.vPixelCanvasPos, scrollbarRect, vec4(0.6, 0.6, 0.6, 1.0), uiContext.vWindowOutColor );
        }
        
        UI_ProcessScrollbarY( uiContext, iControlId + 1000, scrollValueY, scrollbarRect, fHandleSize );
    }
    
    if ( bScrollbarHorizontal && bScrollbarVertical ) 
    {
        Rect cornerRect;
        cornerRect.vPos = scrollbarPanelRect.vPos;
        cornerRect.vPos += scrollbarPanelRect.vSize;
        cornerRect.vSize = vec2(styleSize);
        
        if ( uiContext.bPixelInView ) 
        {
            DrawRect( uiContext.vPixelCanvasPos, cornerRect, vec4(cScrollPanelCorner, 1.0), uiContext.vWindowOutColor );
#ifdef NEW_THEME  
        	DrawBorderRect( uiContext.vPixelCanvasPos, cornerRect, cScrollPanelCornerOutline, uiContext.vWindowOutColor );
#else            
        	DrawBorderIndent( uiContext.vPixelCanvasPos, cornerRect, uiContext.vWindowOutColor );
#endif            
        }
    }

    UI_PanelBegin( uiContext, scrollbarState );    
    
    vData0.x = scrollValueX.fValue;
    vData0.y = scrollValueY.fValue;
    vData0.z = DIRTY_DATA_MAGIC;
    StoreVec4( ivec2(iData,0), vData0, uiContext.vOutData, ivec2(uiContext.vFragCoord) );    
        
            
    UIDrawContext scrollbarPanelContextDesc = UIDrawContext_SetupFromRect( scrollbarPanelRect );
    scrollbarPanelContextDesc.vCanvasSize = vScrollbarCanvasSize;
    scrollbarPanelContextDesc.vOffset = vec2(scrollValueX.fValue, scrollValueY.fValue);

    UIDrawContext scrollbarPanelContext = UIDrawContext_TransformChild( scrollbarState.parentDrawContext, scrollbarPanelContextDesc );
    UI_SetDrawContext( uiContext, scrollbarPanelContext );
}

void UI_ProcessScrollbarPanelEnd( inout UIContext uiContext, inout UIPanelState scrollbarState )
{
    UI_PanelEnd( uiContext, scrollbarState );    
}


void UIStyle_GetFontStyleTitle( inout LayoutStyle style, inout RenderStyle renderStyle );
void PrintWindowTitle( inout PrintState state, LayoutStyle style, int controlId );

vec2 UI_WindowGetTitleBarSize( UIContext uiContext, inout UIWindowState window )
{
    return vec2(window.drawRect.vSize.x - UIStyle_WindowBorderSize().x * 2.0, UIStyle_TitleBarHeight() );
}

void UI_DrawWindowTitleBar( inout UIContext uiContext, bool bActive, Rect titleBarRect, inout UIWindowState window )
{   
	if (!uiContext.bPixelInView || Outside( uiContext.vPixelCanvasPos, titleBarRect ))
        return;
    
    vec4 colorA = vec4(cTitleBarA, 1.0);
    vec4 colorB = vec4(cTitleBarB, 1.0);
       
    if ( bActive )
    {
        colorA.rgb = cTitleBarAActive;
        colorB.rgb = cTitleBarBActive;
    }

    float t = (uiContext.vPixelCanvasPos.x - titleBarRect.vPos.x) / 512.0;
    t = clamp( t, 0.0f, 1.0f );
    uiContext.vWindowOutColor = mix( colorA, colorB, t );
    
    {
        LayoutStyle style;
        RenderStyle renderStyle;
        UIStyle_GetFontStyleTitle( style, renderStyle );

        vec2 vTextOrigin = vec2(0);
        if ( FLAG_SET(window.uControlFlags, WINDOW_CONTROL_FLAG_MINIMIZE_BOX) )
        {
        	vTextOrigin.x += titleBarRect.vSize.y;
        }
        
        PrintState state = UI_PrintState_Init( uiContext, style, vTextOrigin );    
        PrintWindowTitle( state, style, window.iControlId );    
        RenderFont( state, style, renderStyle, uiContext.vWindowOutColor.rgb );
    }
}

bool UI_ProcessWindowTitleBar( inout UIContext uiContext, inout UIWindowState window )
{
    int iWindowTitleBarControlId = window.iControlId;
    int iWindowMinimizeControlId = window.iControlId + 1000;
    int iWindowCloseControlId = window.iControlId + 3000;
    Rect titleBarRect = Rect( vec2(0.0), UI_WindowGetTitleBarSize( uiContext, window ) );
    
    bool bRenderedWidget = false;
    if ( FLAG_SET(window.uControlFlags, WINDOW_CONTROL_FLAG_MINIMIZE_BOX) )
    {
        Rect minimizeBoxRect = Rect( vec2(0.0), vec2(titleBarRect.vSize.y) );
        RectShrink( minimizeBoxRect, vec2(4.0) );
        
    	bRenderedWidget = UI_ProcessWindowMinimizeWidget( uiContext, window, iWindowMinimizeControlId, minimizeBoxRect );
    }

    if ( FLAG_SET(window.uControlFlags, WINDOW_CONTROL_FLAG_CLOSE_BOX) )
    {
        Rect closeBoxRect = Rect( vec2(0.0), vec2(titleBarRect.vSize.y) ); 
        closeBoxRect.vPos.x = titleBarRect.vSize.x - closeBoxRect.vSize.x;
        RectShrink( closeBoxRect, vec2(4.0) );
        
        if( UI_ProcessWindowCloseBox( uiContext, window, iWindowCloseControlId, closeBoxRect ) )
        {
            bRenderedWidget = true;
        }
    }
            
    bool bMouseOver = Inside( uiContext.vMouseCanvasPos, titleBarRect ) && uiContext.bMouseInView;
        
    if ( uiContext.iActiveControl == IDC_NONE )
    {
        if ( uiContext.bMouseDown && (!uiContext.bMouseWasDown) && bMouseOver && !uiContext.bHandledClick )
        {
            uiContext.iActiveControl = iWindowTitleBarControlId;
            uiContext.vActivePos = window.rect.vPos - uiContext.vMousePos;
            uiContext.bHandledClick = true;
        }
    }
    else
    if ( uiContext.iActiveControl == iWindowTitleBarControlId )
    {
        if ( !uiContext.bMouseDown )
        {
            uiContext.iActiveControl = IDC_NONE;
        }
    }    
    
    bool bActive = (uiContext.iActiveControl == iWindowTitleBarControlId);
    
    if ( bActive )
    {
        window.rect.vPos = uiContext.vMousePos + uiContext.vActivePos;
    }   
    
    if (!bRenderedWidget)
    {
    	UI_DrawWindowTitleBar( uiContext, bActive, titleBarRect, window );
    }
    
    return Inside( uiContext.vPixelCanvasPos, titleBarRect );
}

bool ScreenPosInResizeWidget( inout UIContext uiContext, vec2 vCorner, float fControlSize, vec2 vTestPos )
{
    vec2 vTestCanvasPos = UIDrawContext_ScreenPosToCanvasPos( uiContext.drawContext, vTestPos );
    vec2 vOffset = vTestCanvasPos - vCorner + vec2( fControlSize, 0.0 );
    bool bInCorner = (vOffset.x + vOffset.y) > 0.0;
    
    return bInCorner;
}

void UI_ProcessWindowResizeWidget( inout UIContext uiContext, inout UIWindowState window, int iControlId )
{
    vec2 vCorner = uiContext.drawContext.vCanvasSize;
    float fControlSize = 24.0;
    
    bool bMouseOver = ScreenPosInResizeWidget( uiContext, vCorner, fControlSize, uiContext.vMousePos )
        && uiContext.bMouseInView;
        
    if ( uiContext.iActiveControl == IDC_NONE )
    {
        if ( uiContext.bMouseDown && (!uiContext.bMouseWasDown) && bMouseOver && !uiContext.bHandledClick)
        {
            uiContext.iActiveControl = iControlId;
            
            uiContext.vActivePos = window.rect.vSize - uiContext.vMousePos;
            
            uiContext.bHandledClick = true;
        }
    }
    else
    if ( uiContext.iActiveControl == iControlId )
    {
        if ( !uiContext.bMouseDown )
        {
            uiContext.iActiveControl = IDC_NONE;
        }
    }
        
    bool bActive = (uiContext.iActiveControl == iControlId);        
    
    if ( bActive )
    {
        window.rect.vSize = uiContext.vMousePos + uiContext.vActivePos;
        vec2 vMinWindowSize = vec2( 96.0, 64.0 );
        window.rect.vSize = max( vMinWindowSize, window.rect.vSize );
        window.rect.vSize = min( window.vMaxSize, window.rect.vSize );
    }
    
    
    if ( uiContext.bPixelInView &&
        ScreenPosInResizeWidget( uiContext, vCorner, fControlSize, uiContext.vPixelPos ) )
    {
        vec4 vColor = vec4(cResize, 1.0);
        
        if( bActive )
        {
            vColor = vec4(cResizeActive, 1.0);
        }
        uiContext.vWindowOutColor = vColor;
    }    
}

vec2 UI_GetWindowSizeForContent( vec2 vContentSize )
{
    return vContentSize 
        + vec2( 0.0, UIStyle_TitleBarHeight() )
    	+ UIStyle_WindowBorderSize() * 2.0
    	+ UIStyle_WindowContentPadding() * 2.0;
}

UIWindowState UI_ProcessWindowCommonBegin( inout UIContext uiContext, int iControlId, int iData, UIWindowDesc desc )
{   
    UIWindowState window = UI_GetWindowState( uiContext, iControlId, iData, desc );
        
    if ( window.bClosed )
    {
        return window;
    }
    
    UI_PanelBegin( uiContext, window.panelState );
    
    uiContext.vWindowOutColor.rgba = vec4( cWindowBackgroundColor, 1.0 );
    
    window.drawRect = window.rect;
    
    Rect contextRect = window.drawRect;    
    RectShrink( contextRect, UIStyle_WindowBorderSize() );
    
    vec2 vTitleBarSize = UI_WindowGetTitleBarSize( uiContext, window );
    if ( window.bMinimized )
    {
	    window.drawRect.vSize.y = vTitleBarSize.y + UIStyle_WindowBorderSize().y * 2.0;
    }
    
    // Get window main panel view
    Rect panelRect = contextRect;
    
    panelRect.vPos.y += vTitleBarSize.y;
    panelRect.vSize.y -= vTitleBarSize.y;
    
    if ( window.bMinimized )
    {
        panelRect.vSize.y = 0.0;
    }           
    
    
    UIDrawContext panelDesc = UIDrawContext_SetupFromRect( panelRect );
    UIDrawContext panelContext = UIDrawContext_TransformChild( window.panelState.parentDrawContext, panelDesc );
    UI_SetDrawContext( uiContext, panelContext );
    
    if ( FLAG_SET(window.uControlFlags, WINDOW_CONTROL_FLAG_RESIZE_WIDGET) )
    {
        int iWindowResizeControlId = window.iControlId + 2000; // hack        
    	UI_ProcessWindowResizeWidget( uiContext, window, iWindowResizeControlId );
    }
            
    // Get window content panel view
    UIDrawContext contentPanelDesc;
    contentPanelDesc.viewport = Rect( vec2(0.0), uiContext.drawContext.viewport.vSize );
    RectShrink( contentPanelDesc.viewport, UIStyle_WindowContentPadding() );
    contentPanelDesc.vOffset = vec2(0);
    contentPanelDesc.vCanvasSize = contentPanelDesc.viewport.vSize;

    UI_SetDrawContext( uiContext, UIDrawContext_TransformChild( panelContext, contentPanelDesc ) ); 
    
    return window;
}

void UI_ProcessWindowCommonEnd( inout UIContext uiContext, inout UIWindowState window, int iData )
{    
    bool bPixelInPanel = uiContext.bPixelInView;
    
    Rect contextRect = window.drawRect;    
    RectShrink( contextRect, UIStyle_WindowBorderSize() );
    
    UIDrawContext windowContextDesc = UIDrawContext_SetupFromRect( contextRect );
    UIDrawContext windowContext = UIDrawContext_TransformChild( window.panelState.parentDrawContext, windowContextDesc );
	UI_SetDrawContext( uiContext, windowContext );
    
    bool inTitleBar = false;
    if (  FLAG_SET(window.uControlFlags, WINDOW_CONTROL_FLAG_TITLE_BAR)  )
    {
    	inTitleBar = UI_ProcessWindowTitleBar( uiContext, window );
    }
    
    UIDrawContext windowBackgroundContextDesc = UIDrawContext_SetupFromRect( window.drawRect );
    UIDrawContext windowBackgroundContext = UIDrawContext_TransformChild( window.panelState.parentDrawContext, windowBackgroundContextDesc );    

    UI_SetDrawContext( uiContext, windowBackgroundContext );
    if ( !bPixelInPanel && !inTitleBar )
    {
        Rect rect = Rect( vec2(0), window.drawRect.vSize );
#ifdef NEW_THEME        
	    DrawBorderRect( uiContext.vPixelCanvasPos, rect, cWindowBorder, uiContext.vWindowOutColor );                            
#else        
	    DrawBorderOutdent( uiContext.vPixelCanvasPos, rect, uiContext.vWindowOutColor );                    
#endif
        
    }    
    
    if ( uiContext.bMouseDown && uiContext.bMouseInView && !uiContext.bHandledClick )
    {
        uiContext.bHandledClick = true;
    }
    
    Rect windowRect = uiContext.drawContext.clip;

    UI_PanelEnd( uiContext, window.panelState );
    UI_ComposeWindowLayer( uiContext, UIStyle_WindowTransparency(), windowRect );
    
    UI_StoreWindowState( uiContext, window, iData );    
}


////////////////////////////////////////////////////////////////////////
// Client Code Below Here
////////////////////////////////////////////////////////////////////////

//#define MAIN_WINDOW_ONLY

float 	UIStyle_TitleBarHeight() 		{ return 32.0; }
vec2 	UIStyle_WindowBorderSize() 		{ return vec2(6.0); }
vec2 	UIStyle_WindowContentPadding() 	{ return vec2(16.0, 8.0); }
vec2 	UIStyle_ControlSpacing() 		{ return  vec2(6.0); }
vec2 	UIStyle_FontPadding() 			{ return vec2(8.0, 2.0); }
vec2 	UIStyle_CheckboxSize() 			{ return vec2(24.0); }
vec2 	UIStyle_SliderSize()			{ return vec2(128.0, 32.0f); }
vec3 	UIStyle_ColorPickerSize()		{ return vec3(128.0, 128.0, 32.0); }
float 	UIStyle_ScrollBarSize() 		{ return 24.0; }
float   UIStyle_WindowTransparency() 	{ return 0.025f; }

void UIStyle_GetFontStyleWindowText( inout LayoutStyle style, inout RenderStyle renderStyle )
{
    style = LayoutStyle_Default();
	renderStyle = RenderStyle_Default( vec3(0.0) );
}

void UIStyle_GetFontStyleTitle( inout LayoutStyle style, inout RenderStyle renderStyle )
{
    style = LayoutStyle_Default();
	renderStyle = RenderStyle_Default( cWindowTitle );
}

void PrintWindowTitle( inout PrintState state, LayoutStyle style, int controlId )
{
    if ( controlId == IDC_WINDOW_CONTROLS )
    {
        uint strA[] = uint[] ( _C, _o, _n, _t, _r, _o, _l, _s );
        ARRAY_PRINT(state, style, strA);
    }
}

struct UIData
{
    UIData_Bool checkboxA;
    //DATA_WINDOW_VISIBLE
    
    UIData_Value floatA;
    UIData_Value floatB;
    UIData_Value floatC;    

    UIData_Value floatSPD;    
};    

    
UIData UI_GetControlData()
{
    UIData data;
    
    data.checkboxA = UI_GetDataBool( DATA_CHECKBOX_A, true );
    
    data.floatA = UI_GetDataValue( DATA_FLOAT_A, 0.0583, 0.0, 1.0, false );
    data.floatB = UI_GetDataValue( DATA_FLOAT_B, 0.2416,  0.0, 1.0, false );
    data.floatC = UI_GetDataValue( DATA_FLOAT_C, 0.2000, 0.0, 1.0, false );

    data.floatSPD = UI_GetDataValue( DATA_FLOAT_SPD, 3.0, 0.0, 8.0, true );
        
    return data;
}

void UI_StoreControlData( inout UIContext uiContext, UIData data )
{
    UI_StoreDataBool( uiContext, data.checkboxA, DATA_CHECKBOX_A );

    UI_StoreDataValue( uiContext, data.floatA, DATA_FLOAT_A );
    UI_StoreDataValue( uiContext, data.floatB, DATA_FLOAT_B );
    UI_StoreDataValue( uiContext, data.floatC, DATA_FLOAT_C );

    UI_StoreDataValue( uiContext, data.floatSPD, DATA_FLOAT_SPD );
}

void UI_ProcessWindowMain( inout UIContext uiContext, inout UIData uiData, int iControlId, int iData )
{
    UIWindowDesc desc;
    
    desc.initialRect = Rect( vec2(32, 128), vec2(380, 180) );
    desc.bStartMinimized = false;
    desc.bStartClosed = true;
    desc.uControlFlags = WINDOW_CONTROL_FLAG_TITLE_BAR | WINDOW_CONTROL_FLAG_MINIMIZE_BOX | WINDOW_CONTROL_FLAG_RESIZE_WIDGET | WINDOW_CONTROL_FLAG_CLOSE_BOX;    
    desc.vMaxSize = vec2(100000.0);
    
    UIWindowState window = UI_ProcessWindowCommonBegin( uiContext, iControlId, iData, desc );
    
    if ( window.bClosed )
    {
        //if ( uiContext.bMouseDown )
        if ( Key_IsPressed( iChannelKeyboard, KEY_SPACE ) )
        {
            window.bClosed = false;
        }
    }
    
    if ( !window.bMinimized )
    {
        // Controls...

        Rect scrollbarPanelRect = Rect( vec2(0), vec2( 300.0 + UIStyle_ScrollBarSize(), uiContext.drawContext.vCanvasSize.y ) );

        vec2 vScrollbarCanvasSize = vec2(300, 200);

        UIPanelState scrollbarPanelState;            
        UI_ProcessScrollbarPanelBegin( uiContext, scrollbarPanelState, IDC_WINDOW_SCROLLBAR, DATA_WINDOW_SCROLLBAR, scrollbarPanelRect, vScrollbarCanvasSize );

        {        
            UILayout uiLayout = UILayout_Reset();

            LayoutStyle style;
            RenderStyle renderStyle;             
            UIStyle_GetFontStyleWindowText( style, renderStyle );       

            
            UILayout_StackControlRect( uiLayout, UIStyle_SliderSize() );                
            UI_ProcessSlider( uiContext, IDC_SLIDER_SPD, uiData.floatSPD, uiLayout.controlRect );       
            //UILayout_StackDown( uiContext.uiLayout );    
            UILayout_StackRight( uiLayout );

            {
                PrintState state = UI_PrintState_Init( uiContext, style, uiLayout.vCursor );        
                uint strA[] = uint[] ( _S, _P, _D, _COLON, _SP );
                ARRAY_PRINT(state, style, strA);
                Print(state, style, int(uiData.floatSPD.fValue) );
                UI_RenderFont( uiContext, state, style, renderStyle );
                UILayout_SetControlRectFromText( uiLayout, state, style );
            }
            UILayout_StackDown( uiLayout );              

            
            
            UILayout_StackControlRect( uiLayout, UIStyle_CheckboxSize() );                
            UI_ProcessCheckbox( uiContext, IDC_CHECKBOX_A, uiData.checkboxA, uiLayout.controlRect );

            UILayout_StackRight( uiLayout );
            UILayout_StackDown( uiLayout );    


            
            UILayout_StackControlRect( uiLayout, UIStyle_SliderSize() );                
            UI_ProcessSlider( uiContext, IDC_SLIDER_FLOAT_A, uiData.floatA, uiLayout.controlRect );

            UILayout_StackRight( uiLayout );

            {
                PrintState state = UI_PrintState_Init( uiContext, style, uiLayout.vCursor );        
                uint strA[] = uint[] ( _R, _COLON, _SP );

                ARRAY_PRINT(state, style, strA);

                Print(state, style, uiData.floatA.fValue, 4 );

                UI_RenderFont( uiContext, state, style, renderStyle );

                UILayout_SetControlRectFromText( uiLayout, state, style );
            }

            UILayout_StackDown( uiLayout );    

            UILayout_StackControlRect( uiLayout, UIStyle_SliderSize() );                
            UI_ProcessSlider( uiContext, IDC_SLIDER_FLOAT_B, uiData.floatB, uiLayout.controlRect );       
            //UILayout_StackDown( uiContext.uiLayout );    
            UILayout_StackRight( uiLayout );

            {
                PrintState state = UI_PrintState_Init( uiContext, style, uiLayout.vCursor );        
                uint strA[] = uint[] ( _G, _COLON, _SP );
                ARRAY_PRINT(state, style, strA);
                Print(state, style, uiData.floatB.fValue, 4 );
                UI_RenderFont( uiContext, state, style, renderStyle );
                UILayout_SetControlRectFromText( uiLayout, state, style );
            }
            UILayout_StackDown( uiLayout );



            UILayout_StackControlRect( uiLayout, UIStyle_SliderSize() );                
            UI_ProcessSlider( uiContext, IDC_SLIDER_FLOAT_C, uiData.floatC, uiLayout.controlRect );       
            //UILayout_StackDown( uiContext.uiLayout );    
            UILayout_StackRight( uiLayout );

            {
                PrintState state = UI_PrintState_Init( uiContext, style, uiLayout.vCursor );        
                uint strA[] = uint[] ( _B, _COLON, _SP );
                ARRAY_PRINT(state, style, strA);
                Print(state, style, uiData.floatC.fValue, 4 );
                UI_RenderFont( uiContext, state, style, renderStyle );
                UILayout_SetControlRectFromText( uiLayout, state, style );
            }
            UILayout_StackDown( uiLayout );     
            
            

            #if 0
            // Debug state
            {
                PrintState state = UI_PrintState_Init( uiContext, style, uiLayout.vCursor );
                uint strA[] = uint[] ( _C, _t, _r, _l, _COLON );
                ARRAY_PRINT(state, style, strA);

                Print(state, style, uiContext.iActiveControl );
                UI_RenderFont( uiContext, state, style, renderStyle );

                UILayout_SetControlRectFromText( uiLayout, state, style );            
            }        
            #endif
        }
           
        UI_ProcessScrollbarPanelEnd(uiContext, scrollbarPanelState);
    }    
    
    UI_ProcessWindowCommonEnd( uiContext, window, iData );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    UIContext uiContext = UI_GetContext( fragCoord, DATA_UICONTEXT );
    UIData uiData = UI_GetControlData();
        
    // Content...
    
    UI_ProcessWindowMain( uiContext, uiData, IDC_WINDOW_CONTROLS, DATA_WINDOW_CONTROLS );
    
    Rect composeRect = uiContext.drawContext.clip;
    UI_ComposeWindowLayer( uiContext, 0.0f, composeRect );

    UI_StoreControlData( uiContext, uiData );
    
    UI_StoreContext( uiContext, DATA_UICONTEXT );
    
    fragColor = UI_GetFinalColor( uiContext );    
}
`;

const fb = `

#define ACTIVE 0


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
#if !ACTIVE
    discard;
#endif    
    
    if ( fragCoord.x > 4. || fragCoord.y > 4.) discard;
    
    float fOffsetA = 784.0;
    
    float steps = 1000.0;
    
    float fStart = float(iFrame) * steps;
    
    float fMin = 10000.0;
    float fBestOffset = -1.0;
    
#if ACTIVE
    for ( float f =0.; f< steps + max(0., -iTime); f+=1.0 )
    {
        float fCurr = fStart + f;
        float t = Match( fOffsetA, fCurr );
        
        if ( t < fMin )
        {
            fMin = t;
            fBestOffset = fCurr;
        }
    }

    
    if ( iFrame > 1 )
    {
        vec4 vSample = texelFetch( iChannel0, ivec2(0), 0 );
        float fPrevBestOffset = vSample.x;
        float fPrevMin = vSample.y;

        if ( fPrevMin < fMin )
        {
            fBestOffset = fPrevBestOffset;
            fMin = fPrevMin;
        }
    }
#endif    
    
    fragColor = vec4(fBestOffset,fMin,1.0,1.0);
    
    
}
`;

export default class implements iSub {
  key(): string {
    return 'lsKczc';
  }
  name(): string {
    return 'Spectral Power Distribution';
  }
  sort() {
    return 285;
  }
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
      { type: 3 }, //
      { type: 3 },
      { type: 1, f: fb, fi: 2 },
    ];
  }
}
