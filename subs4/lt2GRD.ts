import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const fragment = `
// Lighting is done by Spherical Harmonics:
// This one is a cheap variant presented in 2001 by Ravi Ramamoorthi
// and Pat Hanrahan: http://graphics.stanford.edu/papers/envmap/
// http://graphics.stanford.edu/papers/envmap/envmap.pdf
// There's a C program (prefilter.c) provided to compute spherical harmonic
// coefficients from light probe images (in the floating point format).
// I used pvalue tool from Radiance package on my Ubuntu system to convert
// angular light probe images in HDR format to floating point format with
// the following command:
// $ pvalue -df -H -h grace_probe.hdr > grace_probe.float
// I then have slightly modified prefilter.c to output values with a factor
// applied to have coefficients in a correct range (I used a factor of 0.315),
// and ran the following command:
// $ ./prefilter grace_probe.float 1000
// You can read too the Orange Book, chapter 12.3 (OpenGL Shading Language
// by Randi J. Rost), it has been very useful.

struct SHCoefficients {
    vec3 l00, l1m1, l10, l11, l2m2, l2m1, l20, l21, l22;
};

// These constants have been calculated with a light probe from this website:
// http://www.pauldebevec.com/Probes/
// The light probe image used is Grace Cathedral.
const SHCoefficients grace = SHCoefficients(
    vec3( 0.7953949,  0.4405923,  0.5459412 ),
    vec3( 0.3981450,  0.3526911,  0.6097158 ),
    vec3(-0.3424573, -0.1838151, -0.2715583 ),
    vec3(-0.2944621, -0.0560606,  0.0095193 ),
    vec3(-0.1123051, -0.0513088, -0.1232869 ),
    vec3(-0.2645007, -0.2257996, -0.4785847 ),
    vec3(-0.1569444, -0.0954703, -0.1485053 ),
    vec3( 0.5646247,  0.2161586,  0.1402643 ),
    vec3( 0.2137442, -0.0547578, -0.3061700 )
);

vec3 calcIrradiance(vec3 nor) {
    const SHCoefficients c = grace;
    const float c1 = 0.429043;
    const float c2 = 0.511664;
    const float c3 = 0.743125;
    const float c4 = 0.886227;
    const float c5 = 0.247708;
    return (
        c1 * c.l22 * (nor.x * nor.x - nor.y * nor.y) +
        c3 * c.l20 * nor.z * nor.z +
        c4 * c.l00 -
        c5 * c.l20 +
        2.0 * c1 * c.l2m2 * nor.x * nor.y +
        2.0 * c1 * c.l21  * nor.x * nor.z +
        2.0 * c1 * c.l2m1 * nor.y * nor.z +
        2.0 * c2 * c.l11  * nor.x +
        2.0 * c2 * c.l1m1 * nor.y +
        2.0 * c2 * c.l10  * nor.z
    );
}

vec3 spherePos = vec3(0.0, 1.0, 0.0);
vec3 planePos = vec3(0.0, 0.05, 0.0);
float sphereRadius = 1.0;

float raytracePlane(in vec3 ro, in vec3 rd, float tmin, float tmax) {
    vec3 p = ro - planePos;
    float t = -p.y / rd.y;
    if (t > tmin && t < tmax) {
        return t;
    }
    return -1.0;
}

float raytraceSphere(in vec3 ro, in vec3 rd, float tmin, float tmax, float r) {
    vec3 ce = ro - spherePos;
    float b = dot(rd, ce);
    float c = dot(ce, ce) - r * r;
    float t = b * b - c;
    if (t > tmin) {
        t = -b - sqrt(t);
        if (t < tmax)
            return t;
        }
    return -1.0;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 p = (2.0 * fragCoord.xy - iResolution.xy) / iResolution.y;

    vec3 eye = vec3(0.0, 2.0, 3.0);
    vec2 rot = 6.2831 * (vec2(0.6 + iTime * 0.25, sin(iTime * 0.5) * 0.06) + vec2(1.0, 0.0) * (iMouse.xy - iResolution.xy * 0.25) / iResolution.x);
    eye.yz = cos(rot.y) * eye.yz + sin(rot.y) * eye.zy * vec2(-1.0, 1.0);
    eye.xz = cos(rot.x) * eye.xz + sin(rot.x) * eye.zx * vec2(1.0, -1.0);

    vec3 ro = eye;
    vec3 ta = vec3(0.0, 1.0, 0.0);

    vec3 cw = normalize(ta - ro);
    vec3 cu = normalize(cross(vec3(0.0, 1.0, 0.0), cw));
    vec3 cv = normalize(cross(cw, cu));
    mat3 cam = mat3(cu, cv, cw);

    vec3 rd = cam * normalize(vec3(p.xy, 1.0));   

    vec3 col = vec3(0.0);
    vec3 nor;
    float occ = 1.0;

    float tmin = 0.1;
    float tmax = 50.0;

    // raytrace the plane
    float tpla = raytracePlane(ro, rd, tmin, tmax);
    if (tpla > tmin) {
        vec3 ppos = ro + rd * tpla;
        nor = normalize(vec3(0.0, 1.0, 0.0) + ppos);
        vec3 d = spherePos - ppos;
        float l = length(d);
        occ = 1.0 - (dot(nor, d / l) * (sphereRadius * sphereRadius) / (l * l));
    }

    // raytrace the sphere
    float tsph = raytraceSphere(ro, rd, tmin, tmax, sphereRadius);
    if (tsph > tmin) {
        vec3 spos = ro + rd * tsph;
        nor = normalize(spos - spherePos);
        occ = 0.5 + 0.5 * nor.y;
    }

    if (tpla > tmin || tsph > tmin) {
        col = calcIrradiance(nor) * occ;

        // distant fog if we don't hit the sphere
        if (tsph < tmin) {
            col = mix(col, vec3(0.0), 1.0 - exp(-0.001 * tpla * tpla));
        }
    }

	fragColor = vec4(col, 1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'lt2GRD';
  }
  name(): string {
    return 'Spherical Harmonics lighting';
  }
  sort() {
    return 468;
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
