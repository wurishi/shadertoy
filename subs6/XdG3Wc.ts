import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// pixelScreen - Buf A
//
// Audio filtering and shaping, frame rate calculation and mask generation.
//
// Created by Dmitry Andreev - and'2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

#define DO_CUSTOM_FRAMETIME 1
#define DEBUG_FRAMETIME     0

//

float hilbertCurve(vec2 p)
{
    const int n = 6;

    float d = 0.0;
    float s = exp2(float(n - 1));

    p = floor(p * exp2(float(n)));

    for (int i = 0; i < n; i++)
    {
        vec2 r = floor(p / s);
        r -= 2.0 * floor(r * 0.5);

        d += s * s * (r.y == 0.0 ? (r.x == 0.0 ? 0.0 : 3.0) : (r.x == 0.0 ? 1.0 : 2.0));

        p = r == vec2(1, 0) ? s - 1.0 - p : p;
        p = r.y == 0.0 ? p.yx : p;
        s *= 0.5;
    }

    return d * exp2(-float(n * 2));
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Bend UVs to get fake 3D perspective.
    vec2 mtc = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    mtc *= vec2(2.0, 0.2);
    mtc.xy -= 0.04 * normalize(mtc) * pow(length(mtc), 3.0);
    mtc /= vec2(2.0, 0.2);

    vec2 uv = 1.25 * mtc;
    vec2 ouv = uv;
    uv = fract(uv + 0.5) - 0.5;

    // Mirror side screens and reflections.
    if (ouv.x > 0.5) uv.x =  1.0 - ouv.x;
    if (ouv.x <-0.5) uv.x = -1.0 - ouv.x;
    if (ouv.y > 0.5) uv.y =  1.0 - ouv.y;
    if (ouv.y <-0.5) uv.y = -1.0 - ouv.y;

    uv *= 1.01;

    // Construct screen separating edge mask.
    vec2  edge_uv = clamp(abs(uv * 2.0 / 1.01) * 128.0 - 126.0, 0.0, 1.0);
    float edge_mask = (1.0 - edge_uv.x) * (1.0 - edge_uv.y);

    fragColor = vec4(0.0);
    uv = clamp(0.5 - uv, 0.0, 0.9999);

    if (fragCoord.x < 64.0 && fragCoord.y < 64.0)
    {
        // Map pixel screen coordinates to Hilbert curve.
        float l = hilbertCurve(clamp(floor(fragCoord) / 64.0, 0.0, 1.0));

        // Snap curve linear coordinate just in case.
        l = floor(l * 4096.0) / 4096.0;

        // Wrap it three times for aesthetics.
        l = fract(l * 3.0);

        // Read source wave and apply high-pass filter.
        float f = 3.0 * texture(iChannel0, vec2(l, 0.75)).x
            - texture(iChannel0, vec2(l - 1.0 / iChannelResolution[0].x, 0.75)).x
            - texture(iChannel0, vec2(l + 1.0 / iChannelResolution[0].x, 0.75)).x;

        fragColor.x = f;
    }

    vec4 last = texture(iChannel1, fragCoord / iChannelResolution[1].xy);

    float last_res_x = floor(texture(iChannel1, (vec2(0.5, 70.5) / iChannelResolution[1].xy)).x);
    float last_res_y = floor(texture(iChannel1, (vec2(1.5, 70.5) / iChannelResolution[1].xy)).x);

    if (last_res_x != iResolution.x || last_res_y != iResolution.y)
    {
        // Force feedback value to current one when resolution changes.
        fragColor.x *= 0.8;
        last = fragColor;
    }

    if (iFrame == 0)
    {
        // Clear the buffer.
        fragColor = vec4(0.0);
        last = fragColor;
    }

#if DO_CUSTOM_FRAMETIME
    // iTimeDelta was locked to 1/60 at the time of writing this shader.

    float last_time = texture(iChannel1, (vec2(2.5, 70.5) / iChannelResolution[1].xy)).x;
    float curr_time = fract(iTime);
    float delta_time = min(fract(curr_time - last_time), fract(last_time - curr_time));
#else
    float delta_time = iTimeDelta;
#endif

    // Adjust exponential smoothing with respect to frame rate.
    float exp_n_at_60fps = 27.57142;
    float exp_n = exp_n_at_60fps * (1.0 / 60.0) / delta_time;
    float exp_alpha = 2.0 / (1.0 + exp_n);
    float exp_scale = (2.0 / (1.0 + exp_n_at_60fps)) / exp_alpha;

    // Exponential smoothing.
    fragColor = mix(last, fragColor, exp_alpha);
    fragColor.y = last.x * exp_scale;

    // Sample accumulated data with modified bilinear interpolation.
    vec2 xt = uv * 64.0 - 0.5;
    vec2 ft = fract(xt);
    ft = smoothstep(0.0, 1.0, ft);
    ft = smoothstep(0.0, 1.0, ft);
    ft = smoothstep(0.0, 1.0, ft);
    ft = smoothstep(0.0, 1.0, ft);
    ft = smoothstep(0.0, 1.0, ft);

    fragColor.y = texture(iChannel1,
        clamp(floor(xt) + ft + 0.5, 0.0, 63.5) / iChannelResolution[1].xy).x;
    
    float side_screen_fade = mix(1.0, 0.0,
        clamp((sin((iTime + 10.0) / 9.6) - 0.5) * 2.5, 0.0, 1.0)
        * (1.0 - clamp(1.0 - 256.0 * (abs(ouv.x) - 0.5), 0.0, 1.0)));

    fragColor.y *= side_screen_fade;

    // Build single pixel vignette mask.
    vec2  pixel_uv = sqrt(1.0 - abs(fract(uv * 64.0) - 0.5) * 2.0);
    float pixel_mask = smoothstep(0.0, 1.0, pow(pixel_uv.x * pixel_uv.y, 0.5));

    fragColor.y *= 0.98 + 0.02 * pixel_mask;
    fragColor.w = pixel_mask * clamp(0.5 - 1.3 * pow(length(uv - 0.5), 3.0), 0.0, 1.0) * 2.0;

    // Extreme contrast adjustment for purely aesthetic reasons.
    fragColor.y = smoothstep(0.0, 1.0, fragColor.y);
    fragColor.y = smoothstep(0.0, 1.0, fragColor.y);
    fragColor.y = smoothstep(0.0, 1.0, fragColor.y);
    fragColor.y = smoothstep(0.0, 1.0, fragColor.y);
    fragColor.y = smoothstep(0.0, 1.0, fragColor.y);
    fragColor.y = smoothstep(0.0, 1.0, fragColor.y);
    fragColor.y = pow(fragColor.y, 3.0);

    // Highlight mask for anamorphic flares.
    fragColor.z = pow(fragColor.y, 12.0) * 14.0;

    // Add screen edges.
    fragColor.y *= 0.5 * smoothstep(0.0, 1.0, edge_mask);

    // Add screen vignette.
    fragColor.y *= clamp(0.5 - 1.0 * pow(length(uv - 0.5), 3.0), 0.0, 1.0) * 2.2;

    // Darken reflections.
    fragColor.yzw *= mix(0.8, 1.0, clamp(1.0 - 256.0 * (abs(ouv.x) - 0.5), 0.0, 1.0));
    fragColor.yzw *= mix(0.5, 1.0, clamp(1.0 - 256.0 * (abs(ouv.y) - 0.5), 0.0, 1.0));

    // Add noise to black level.
    float noise = texture(iChannel0, (vec2(1.6, 2.0) * fragCoord.xy / iResolution.yy)
        + vec2(sin(iTime * 9.7) * 11.234, 17.11 * cos(iTime))).x;

    fragColor.w += 1.5 * noise;

    // Keep track of resolution changes so we can reset feedback buffer.
    if (floor(fragCoord.xy) == vec2(0, 70)) fragColor.x = iResolution.x;
    if (floor(fragCoord.xy) == vec2(1, 70)) fragColor.x = iResolution.y;

#if DO_CUSTOM_FRAMETIME
    if (floor(fragCoord.xy) == vec2(2, 70)) fragColor.x = curr_time;
#endif

#if DEBUG_FRAMETIME
    if (fragCoord.y / iResolution.y > 0.99)
    {
        fragColor.y *= 0.5;
        fragColor.y += (fragCoord.x / iResolution.x) < delta_time * 10.0 ? 0.15 : 0.0;
        fragColor.y += pow(fract((fragCoord.x / iResolution.x) * 10.0), 32.0) * 0.15;
    }
#endif
}

`;

const buffB = `
// pixelScreen - Buf B
//
// First 4x reduction pass for bloom and anamorphic flare.
//
// Created by Dmitry Andreev - and'2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    fragColor = vec4(0,0,0,1);
    vec2  res = iChannelResolution[0].xy;
    float s = res.y / 450.0;

    // Discard pixels outside of working area for performance.
    if (fragCoord.x > (res.x + 3.0) / 4.0) discard;

    // Horizontal reduction for anamorphic flare.
    for (int x = 0; x < 8; x++)
    {
        fragColor.z += 0.25 * texture(iChannel1, min(vec2(1.0, 1.0),
            vec2(4.0, 1.0) * (fragCoord + 0.5 * s * vec2(float(x) - 3.5, 0)) / res)).z;
    }

    if (fragCoord.y <= (iChannelResolution[0].y + 3.0) / 4.0)
    {
        // Horizontal and vertical reduction for regular bloom.

        for (int y = 0; y < 5; y++)
        for (int x = 0; x < 5; x++)
        {
            fragColor.y += 0.04 * texture(iChannel1, min(vec2(1.0),
                (4.0 * (floor(fragCoord) + s * (vec2(x,y) - 2.0))) / res)).y;
        }
    }
}

`;

const buffC = `
// pixelScreen - Buf C
//
// Second 4x reduction pass for bloom and anamorphic flare.
//
// Created by Dmitry Andreev - and'2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    fragColor = vec4(0,0,0,1);
    vec2  res = iChannelResolution[0].xy;
    float s = res.y / 450.0;

    // Discard pixels outside of working area for performance.
    if (fragCoord.x > (res.x + 31.0) / 16.0) discard;

    // Horizontal reduction for anamorphic flare.
    for (int x = 0; x < 8; x++)
    {
        fragColor.z += 0.25 * texture(iChannel2, min(vec2(1.0 / 4.0, 1.0),
            vec2(4.0, 1.0) * (fragCoord + 0.5 * s * vec2(float(x) - 3.5, 0)) / res)).z;
    }

    if (fragCoord.y <= (iChannelResolution[0].y + 31.0) / 16.0)
    {
        // Horizontal and vertical reduction for regular bloom.

        for (int y = 0; y < 5; y++)
        for (int x = 0; x < 5; x++)
        {
            fragColor.y += 0.04 * texture(iChannel2, min(vec2(1.0 / 4.0),
                (4.0 * (floor(fragCoord) + s * (vec2(x,y) - 2.0))) / res)).y;
        }
    }
}

`;

const buffD = `
// pixelScreen - Buf D
//
// Third 4x reduction pass for bloom and anamorphic flare.
//
// Created by Dmitry Andreev - and'2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

void mainImage(out vec4 fragColor, in vec2 fragCoord)
{
    fragColor = vec4(0,0,0,1);
    vec2  res = iChannelResolution[0].xy;
    float s = res.y / 450.0;

    // Discard pixels outside of working area for performance.
    if (fragCoord.x > (res.x + 127.0) / 64.0) discard;

    // Horizontal reduction for anamorphic flare.
    for (int x = 0; x < 8; x++)
    {
        fragColor.z += 0.25 * texture(iChannel3, min(vec2(1.0 / 16.0, 1.0),
            vec2(4.0, 1.0) * (fragCoord + 0.5 * s * vec2(float(x) - 3.5, 0)) / res)).z;
    }

    if (fragCoord.y <= (iChannelResolution[0].y + 127.0) / 64.0)
    {
        // Horizontal and vertical reduction for regular bloom.

        for (int y = 0; y < 5; y++)
        for (int x = 0; x < 5; x++)
        {
            fragColor.y += 0.04 * texture(iChannel3, min(vec2(1.0 / 16.0),
                (4.0 * (floor(fragCoord) + s * (vec2(x,y) - 2.0))) / res)).y;
        }
    }
}

`;

const fragment = `
// pixelScreen - Image
//
// Final compositing: aberrations, fringing, bloom, coloration and tone mapping.
//
// Created by Dmitry Andreev - and'2016
// License Creative Commons Attribution-NonCommercial-ShareAlike 3.0 Unported License.

float drawLogo(in vec2 fragCoord)
{
    float val = 0.0;
    float res = max(iResolution.x, iResolution.y) * 0.75;
    vec2  pos = vec2(floor((fragCoord.xy / res) * 128.0));

    // AND'16 bitmap
    val = pos.y == 2.0 ? 4873775.5 : val;
    val = pos.y == 3.0 ? 8049193.5 : val;
    val = pos.y == 4.0 ? 2839727.5 : val;
    val = pos.y == 5.0 ? 1726632.5 : val;
    val = pos.x >168.0 ? 0.0 : val;

    float bit = floor(val * exp2(pos.x - 168.0));

    return bit != floor(bit / 2.0) * 2.0 ? 1.0 : 0.0;
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // Read base mask and slightly offset one for fringing and aberrations.
    vec4 base_clr = texture(iChannel0, fragCoord / iChannelResolution[0].xy);
    vec4 offs_clr = texture(iChannel0,
        (fragCoord + (1.5 * iChannelResolution[0].y / 1600.0)) / iChannelResolution[0].xy);

    fragColor.rgb = base_clr.ggg;

    // Offset green channel.
    fragColor.g = mix(fragColor.g, offs_clr.g, 0.5);
    fragColor *= 1.6;

    // Add base level noise.
    fragColor.rgb += 0.007 * vec3(base_clr.a, offs_clr.a, base_clr.a);

    // Apply bloom.
    float level1 = texture(iChannel1, (fragCoord +  1.5) / ( 4.0 * iChannelResolution[1].xy)).y;
    float level2 = texture(iChannel2, (fragCoord +  7.5) / (16.0 * iChannelResolution[2].xy)).y;
    float level3 = texture(iChannel3, (fragCoord + 31.5) / (64.0 * iChannelResolution[3].xy)).y;

    fragColor.rgb += 0.2 * vec3(level1 + level2 + level3);

    // Add some foggy medium.
    fragColor.rgb = mix(fragColor.rgb, vec3(level3 * 4.0), 0.07);
    fragColor.rgb = mix(fragColor.rgb, vec3(level2 * 4.0), 0.03);
    fragColor *= 0.5;

    // Colorize image by cycling rgb gammas.
    float t = 4.0 + iTime * 0.15;
    vec3  gamma = 2.4 + vec3(1.3 * sin(t), 1.0 * sin(t * 2.0 + 0.75), 1.3 * sin(t + 3.0));

    fragColor.r = pow(fragColor.r, gamma.r);
    fragColor.g = pow(fragColor.g, gamma.g);
    fragColor.b = pow(fragColor.b, gamma.b);

    // Normalize luminance.
    vec3  mag = vec3(pow(0.25, gamma.r), pow(0.25, gamma.g), pow(0.25, gamma.b));
    float luma = dot(mag, vec3(0.333));
    fragColor.rgb /= 10.0 * luma;

    // Darken the edges for aesthetics.
    vec2 mtc = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
    mtc *= vec2(2.0, 0.2);
    mtc.xy -= 0.04 * normalize(mtc) * pow(length(mtc), 3.0);
    mtc /= vec2(2.0, 0.2);
    
    vec2  ouv = 1.01 * 1.25 * mtc;
    float wx = max(0.0, 1.5 - 2.0 * clamp(abs(ouv.x) - 0.5, 0.0, 1.0));
    float wy = max(0.0, 1.0 - 3.0 * clamp(abs(ouv.y) - 0.5, 0.0, 1.0));

    fragColor.rgb *= wx * wy;

    // Add logo when side screen are on.
    fragColor.rgb += 0.1 * mag * drawLogo(fragCoord) *
        (1.0 - clamp((sin((iTime + 10.0) / 9.6) - 0.5) * 10.0, 0.0, 1.0));

    // Apply anamorphic flare.
    float flare = base_clr.z;
    flare += texture(iChannel1, fragCoord / (vec2( 4, 1) * iChannelResolution[1].xy)).z;
    flare += texture(iChannel2, fragCoord / (vec2(16, 1) * iChannelResolution[2].xy)).z;
    flare += texture(iChannel3, fragCoord / (vec2(64, 1) * iChannelResolution[3].xy)).z;
    fragColor.rgb += flare * vec3(0.05, 0.2, 5.0) * 8e-4;

    // Compress dynamic range.
    fragColor.rgb *= 5.0;
    fragColor.rgb = 1.5 * fragColor.rgb / (1.0 + fragColor.rgb);

    // Linear to sRGB.
    fragColor.rgb = sqrt(fragColor.rgb);

    // Add additional nonlinearities to shadows and highlights.
    vec3 sclr = smoothstep(0.0, 1.0, fragColor.rgb);

    fragColor.r = mix(fragColor.r, sclr.r, 0.6);
    fragColor.g = mix(fragColor.g, sclr.g, 0.8);
    fragColor.b = mix(fragColor.b, sclr.b, 1.0);
    fragColor.a = 1.;
}

`;

export default class implements iSub {
  key(): string {
    return 'XdG3Wc';
  }
  name(): string {
    return 'pixelScreen';
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
      webglUtils.DEFAULT_NOISE, //
      { type: 1, f: buffA, fi: 1 },
      { type: 1, f: buffB, fi: 2 },
      { type: 1, f: buffC, fi: 3 },
    ];
  }
}
