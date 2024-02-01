import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
#define KEY_FORWARDS 87
#define KEY_BACKWARDS 83
#define KEY_LEFT 65
#define KEY_RIGHT 68
#define KEY_JUMP 32
#define KEY_SNEAK 16
#define KEY_PLACE 81
#define KEY_DESTROY 69
#define KEY_DECREASE_RESOLUTION 34
#define KEY_INCREASE_RESOLUTION 33
#define KEY_INCREASE_TIME_SCALE 80
#define KEY_DECREASE_TIME_SCALE 79
#define KEY_INVENTORY_NEXT 88
#define KEY_INVENTORY_PREVIOUS 90
#define KEY_INVENTORY_ABSOLUTE_START 49

const float PI = 3.14159265359;
#define var(name, x, y) const vec2 name = vec2(x, y)
#define varRow 0.
var(_pos, 0, varRow);
var(_angle, 2, varRow);
var(_mouse, 3, varRow);
var(_loadRange, 4, varRow);
var(_inBlock, 5, varRow);
var(_vel, 6, varRow);
var(_pick, 7, varRow);
var(_pickTimer, 8, varRow);
var(_renderScale, 9, varRow);
var(_selectedInventory, 10, varRow);
var(_flightMode, 11, varRow);
var(_sprintMode, 12, varRow);
var(_time, 13, varRow);
var(_old, 0, 1);



vec4 load(vec2 coord) {
	return textureLod(iChannel0, vec2((floor(coord) + 0.5) / iChannelResolution[1].xy), 0.0);
}

bool inBox(vec2 coord, vec4 bounds) {
	return coord.x >= bounds.x && coord.y >= bounds.y && coord.x < (bounds.x + bounds.z) && coord.y < (bounds.y + bounds.w);
}

vec2 currentCoord;
vec4 outValue;
bool store4(vec2 coord, vec4 value) {
	if (inBox(currentCoord, vec4(coord, 1., 1.))) {
    	outValue = value;
        return true;
    }
    else return false;
}
bool store3(vec2 coord, vec3 value) { return store4(coord, vec4(value, 1)); }
bool store2(vec2 coord, vec2 value) { return store4(coord, vec4(value, 0, 1)); }
bool store1(vec2 coord, float value) { return store4(coord, vec4(value, 0, 0, 1)); }

float keyDown(int keyCode) {
	return textureLod(iChannel2, vec2((float(keyCode) + 0.5) / 256., .5/3.), 0.0).r;   
}

float keyPress(int keyCode) {
	return textureLod(iChannel2, vec2((float(keyCode) + 0.5) / 256., 1.5/3.), 0.0).r;   
}

float keySinglePress(int keycode) {
	bool now = bool(keyDown(keycode));
    bool previous = bool(textureLod(iChannel0, vec2(256. + float(keycode) + 0.5, 0.5) / iResolution.xy, 0.0).r);
    return float(now && !previous);
}

const vec2 packedChunkSize = vec2(12,7);
const float heightLimit = packedChunkSize.x * packedChunkSize.y;

float calcLoadDist(void) {
	vec2 chunks = floor(iResolution.xy / packedChunkSize);
    float gridSize = min(chunks.x, chunks.y);
    return floor((gridSize - 1.) / 2.);
}

vec4 calcLoadRange(vec2 pos) {
	vec2 d = calcLoadDist() * vec2(-1,1);
    return floor(pos).xxyy + d.xyxy;
}

vec2 swizzleChunkCoord(vec2 chunkCoord) {
    vec2 c = chunkCoord;
    float dist = max(abs(c.x), abs(c.y));
    vec2 c2 = floor(abs(c - 0.5));
    float offset = max(c2.x, c2.y);
    float neg = step(c.x + c.y, 0.) * -2. + 1.;
    return (neg * c) + offset;
}

float rectangleCollide(vec2 p1, vec2 p2, vec2 s) {
	return float(all(lessThan(abs(p1 - p2), s)));   
}

float horizontalPlayerCollide(vec2 p1, vec2 p2, float h) {
    vec2 s = (vec2(1) + vec2(.6, h)) / 2.;
    p2.y += h / 2.;
    return rectangleCollide(p1, p2, s);
}

vec4 readMapTex(vec2 pos) {
 	return textureLod(iChannel1, (floor(pos) + 0.5) / iChannelResolution[0].xy, 0.0);   
}

vec2 voxToTexCoord(vec3 voxCoord) {
    vec3 p = floor(voxCoord);
    return swizzleChunkCoord(p.xy) * packedChunkSize + vec2(mod(p.z, packedChunkSize.x), floor(p.z / packedChunkSize.x));
}

struct voxel {
	float id;
    float sunlight;
    float torchlight;
    float hue;
};

voxel decodeTextel(vec4 textel) {
	voxel o;
    o.id = textel.r;
    o.sunlight = floor(mod(textel.g, 16.));
    o.torchlight = floor(mod(textel.g / 16., 16.));
    o.hue = textel.b;
    return o;
}

voxel getVoxel(vec3 p) {
    return decodeTextel(readMapTex(voxToTexCoord(p)));
}

bool getHit(vec3 c) {
	vec3 p = vec3(c) + vec3(0.5);
	float d = readMapTex(voxToTexCoord(p)).r;
	return d > 0.5;
}

struct rayCastResults {
	bool hit;
    vec3 rayPos;
    vec3 mapPos;
    vec3 normal;
    vec2 uv;
    vec3 tangent;
    vec3 bitangent;
    float dist;
};

    
rayCastResults rayCast(vec3 rayPos, vec3 rayDir, vec3 offset) {
	vec3 mapPos = floor(rayPos);
    vec3 deltaDist = abs(vec3(length(rayDir)) / rayDir);
    vec3 rayStep = sign(rayDir);
    vec3 sideDist = (sign(rayDir) * (mapPos - rayPos) + (sign(rayDir) * 0.5) + 0.5) * deltaDist; 
    vec3 mask;
    bool hit = false;
    for (int i = 0; i < 9; i++) {
		mask = step(sideDist.xyz, sideDist.yzx) * step(sideDist.xyz, sideDist.zxy);
		sideDist += vec3(mask) * deltaDist;
		mapPos += vec3(mask) * rayStep;
		
        if (mapPos.z < 0. || mapPos.z >= packedChunkSize.x * packedChunkSize.y) break;
        if (getHit(mapPos - offset)) { 
            hit = true; 
            break;
        }

	}
    vec3 endRayPos = rayDir / dot(mask * rayDir, vec3(1)) * dot(mask * (mapPos + step(rayDir, vec3(0)) - rayPos), vec3(1)) + rayPos;
   	vec2 uv;
    vec3 tangent1;
    vec3 tangent2;
    if (abs(mask.x) > 0.) {
        uv = endRayPos.yz;
        tangent1 = vec3(0,1,0);
        tangent2 = vec3(0,0,1);
    }
    else if (abs(mask.y) > 0.) {
        uv = endRayPos.xz;
        tangent1 = vec3(1,0,0);
        tangent2 = vec3(0,0,1);
    }
    else {
        uv = endRayPos.xy;
        tangent1 = vec3(1,0,0);
        tangent2 = vec3(0,1,0);
    }
    uv = fract(uv);
    rayCastResults res;
    res.hit = hit;
    res.uv = uv;
    res.mapPos = mapPos;
    res.normal = -rayStep * mask;
    res.tangent = tangent1;
    res.bitangent = tangent2;
    res.rayPos = endRayPos;
    res.dist = length(rayPos - endRayPos);
    return res;
}


void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    currentCoord = fragCoord;
    vec2 texCoord = floor(fragCoord);
    if (texCoord.x < 512.) {
        if (texCoord.y == varRow) {
            if (texCoord.x >= 256.) {
            	fragColor.r = texture(iChannel2, (fragCoord - 256.) / vec2(256,3)).r;
                vec4 old = texture(iChannel0, (_old + fragCoord) / iResolution.xy);
                if (fragColor.r != old.r) old.a = 0.;
                fragColor.a = old.a + iTimeDelta;
        	}
            else {
                vec3 pos = load(_pos).xyz;
                vec3 oldPos = pos;
                vec3 offset = vec3(floor(pos.xy), 0.);
                vec2 angle = load(_angle).xy;
                vec4 oldMouse = load(_mouse);
                vec3 vel = load(_vel).xyz;
                vec4 mouse = iMouse / length(iResolution.xy);
				float renderScale = load(_renderScale).r;
                vec2 time = load(_time).rg;
                vec2 flightMode = load(_flightMode).rg;
                vec2 sprintMode = load(_sprintMode).rg;
                float selected = load(_selectedInventory).r;
                float dt = min(iTimeDelta, .05);

                if (iFrame == 0) {
                    pos = vec3(0,0,52);
                    angle = vec2(-0.75,2.5);
                    oldMouse = vec4(-1);
                    vel = vec3(0);
                    renderScale = 0.;
                    time = vec2(0,4);
                    selected = 0.;
                }
                if (oldMouse.z > 0. && iMouse.z > 0.) {
                    angle += 5.*(mouse.xy - oldMouse.xy) * vec2(-1,-1);
                    angle.y = clamp(angle.y, 0.1, PI - 0.1);
                }
                vec3 dir = vec3(sin(angle.y) * cos(angle.x), sin(angle.y) * sin(angle.x), cos(angle.y));
                vec3 dirU = vec3(normalize(vec2(dir.y, -dir.x)), 0);
                vec3 dirV = cross(dirU, dir);
                vec3 move = vec3(0);

                vec3 dirFwd = vec3(cos(angle.x), sin(angle.x), 0);;
                vec3 dirRight = vec3(dirFwd.y, -dirFwd.x, 0);
                vec3 dirUp = vec3(0,0,1);
                /*move += dir * (keyDown(87)-keyDown(83));
                move += dirU * (keyDown(68) - keyDown(65));
                move += vec3(0,0,1) * (keyDown(82) - keyDown(70));*/

                float inBlock = 0.;
                float minHeight = 0.;
                vec3 vColPos, hColPos;
                for (float i = 0.; i < 4.; i++) {
                    vColPos = vec3(floor(pos.xy - 0.5), floor(pos.z - 1. - i));
                    if (getVoxel(vColPos - offset + vec3(0,0,0)).id * rectangleCollide(vColPos.xy + vec2(0.5,0.5), pos.xy, vec2(.8))
                        + getVoxel(vColPos - offset + vec3(0,1,0)).id * rectangleCollide(vColPos.xy + vec2(0.5,1.5), pos.xy, vec2(.8)) 
                        + getVoxel(vColPos - offset + vec3(1,0,0)).id * rectangleCollide(vColPos.xy + vec2(1.5,0.5), pos.xy, vec2(.8))
                        + getVoxel(vColPos - offset + vec3(1,1,0)).id * rectangleCollide(vColPos.xy + vec2(1.5,1.5), pos.xy, vec2(.8))
                        > .5) {
                        minHeight = vColPos.z + 1.001; 
                        inBlock = 1.;
                        break;
                    }
                }
                float maxHeight = heightLimit - 1.8;
                vColPos = vec3(floor(pos.xy - 0.5), floor(pos.z + 1.8 + 1.));
                if (getVoxel(vColPos - offset + vec3(0,0,0)).id * rectangleCollide(vColPos.xy + vec2(0.5,0.5), pos.xy, vec2(.8))
                    + getVoxel(vColPos - offset + vec3(0,1,0)).id * rectangleCollide(vColPos.xy + vec2(0.5,1.5), pos.xy, vec2(.8)) 
                    + getVoxel(vColPos - offset + vec3(1,0,0)).id * rectangleCollide(vColPos.xy + vec2(1.5,0.5), pos.xy, vec2(.8))
                    + getVoxel(vColPos - offset + vec3(1,1,0)).id * rectangleCollide(vColPos.xy + vec2(1.5,1.5), pos.xy, vec2(.8))
                    > .5) {
                    maxHeight = vColPos.z - 1.8 - .001; 
                    inBlock = 1.;
                }
                float minX = pos.x - 1000.;
                hColPos = vec3(floor(pos.xy - vec2(.3, .5)) + vec2(-1,0), floor(pos.z));
                if (getVoxel(hColPos - offset + vec3(0,0,0)).id * horizontalPlayerCollide(hColPos.yz + vec2(0.5, 0.5), pos.yz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,1,0)).id * horizontalPlayerCollide(hColPos.yz + vec2(1.5, 0.5), pos.yz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,0,1)).id * horizontalPlayerCollide(hColPos.yz + vec2(0.5, 1.5), pos.yz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,1,1)).id * horizontalPlayerCollide(hColPos.yz + vec2(1.5, 1.5), pos.yz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,0,2)).id * horizontalPlayerCollide(hColPos.yz + vec2(0.5, 2.5), pos.yz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,1,2)).id * horizontalPlayerCollide(hColPos.yz + vec2(1.5, 2.5), pos.yz, 1.8)
                    > .5) {
                    minX = hColPos.x + 1.301;
                }
                float maxX = pos.x + 1000.;
                hColPos = vec3(floor(pos.xy - vec2(-.3, .5)) + vec2(1,0), floor(pos.z));
                if (getVoxel(hColPos - offset + vec3(0,0,0)).id * horizontalPlayerCollide(hColPos.yz + vec2(0.5, 0.5), pos.yz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,1,0)).id * horizontalPlayerCollide(hColPos.yz + vec2(1.5, 0.5), pos.yz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,0,1)).id * horizontalPlayerCollide(hColPos.yz + vec2(0.5, 1.5), pos.yz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,1,1)).id * horizontalPlayerCollide(hColPos.yz + vec2(1.5, 1.5), pos.yz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,0,2)).id * horizontalPlayerCollide(hColPos.yz + vec2(0.5, 2.5), pos.yz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,1,2)).id * horizontalPlayerCollide(hColPos.yz + vec2(1.5, 2.5), pos.yz, 1.8)
                    > .5) {
                    maxX = hColPos.x - .301;
                }
                            float minY = pos.y - 1000.;
                hColPos = vec3(floor(pos.xy - vec2(.5, .3)) + vec2(0,-1), floor(pos.z));
                if (getVoxel(hColPos - offset + vec3(0,0,0)).id * horizontalPlayerCollide(hColPos.xz + vec2(0.5, 0.5), pos.xz, 1.8)
                    + getVoxel(hColPos - offset + vec3(1,0,0)).id * horizontalPlayerCollide(hColPos.xz + vec2(1.5, 0.5), pos.xz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,0,1)).id * horizontalPlayerCollide(hColPos.xz + vec2(0.5, 1.5), pos.xz, 1.8)
                    + getVoxel(hColPos - offset + vec3(1,0,1)).id * horizontalPlayerCollide(hColPos.xz + vec2(1.5, 1.5), pos.xz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,0,2)).id * horizontalPlayerCollide(hColPos.xz + vec2(0.5, 2.5), pos.xz, 1.8)
                    + getVoxel(hColPos - offset + vec3(1,0,2)).id * horizontalPlayerCollide(hColPos.xz + vec2(1.5, 2.5), pos.xz, 1.8)
                    > .5) {
                    minY = hColPos.y + 1.301;
                }
                float maxY = pos.y + 1000.;
                hColPos = vec3(floor(pos.xy - vec2(.5, -.3)) + vec2(0,1), floor(pos.z));
                if (getVoxel(hColPos - offset + vec3(0,0,0)).id * horizontalPlayerCollide(hColPos.xz + vec2(0.5, 0.5), pos.xz, 1.8)
                    + getVoxel(hColPos - offset + vec3(1,0,0)).id * horizontalPlayerCollide(hColPos.xz + vec2(1.5, 0.5), pos.xz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,0,1)).id * horizontalPlayerCollide(hColPos.xz + vec2(0.5, 1.5), pos.xz, 1.8)
                    + getVoxel(hColPos - offset + vec3(1,0,1)).id * horizontalPlayerCollide(hColPos.xz + vec2(1.5, 1.5), pos.xz, 1.8)
                    + getVoxel(hColPos - offset + vec3(0,0,2)).id * horizontalPlayerCollide(hColPos.xz + vec2(0.5, 2.5), pos.xz, 1.8)
                    + getVoxel(hColPos - offset + vec3(1,0,2)).id * horizontalPlayerCollide(hColPos.xz + vec2(1.5, 2.5), pos.xz, 1.8)
                    > .5) {
                    maxY = hColPos.y - .301;
                }
                                
                if (abs(pos.z - minHeight) < 0.01) flightMode.r = 0.;
                if (bool(keySinglePress(KEY_JUMP))) {
                    if (flightMode.g > 0.) {
                        flightMode.r = 1.- flightMode.r;
                        sprintMode.r = 0.;
                    }
                    flightMode.g = 0.3;
                }
                flightMode.g = max(flightMode.g - dt, 0.);
                    
                if (bool(keySinglePress(KEY_FORWARDS))) {
					if (sprintMode.g > 0.) sprintMode.r = 1.;
                    sprintMode.g = 0.3;
                }
                if (!bool(keyDown(KEY_FORWARDS))) {
                    if (sprintMode.g <= 0.) sprintMode.r = 0.;
                }
                sprintMode.g = max(sprintMode.g - dt, 0.);
				
                if (bool(flightMode.r)) {
                    if (length(vel) > 0.) vel -= min(length(vel), 25. * dt) * normalize(vel);
                    vel += 50. * dt * dirFwd * sign(keyDown(KEY_FORWARDS)-keyDown(KEY_BACKWARDS)+keyDown(38)-keyDown(40));
                    vel += 50. * dt * dirRight * sign(keyDown(KEY_RIGHT)-keyDown(KEY_LEFT)+keyDown(39)-keyDown(37));
                    vel += 50. * dt * dirUp * sign(keyDown(KEY_JUMP) - keyDown(KEY_SNEAK));
                    if (length(vel) > 20.) vel = normalize(vel) * 20.;
                }
                else {
                    vel.xy *= max(0., (length(vel.xy) - 25. * dt) / length(vel.xy));
                    vel += 50. * dt * dirFwd * sign(keyDown(KEY_FORWARDS)-keyDown(KEY_BACKWARDS)+keyDown(38)-keyDown(40));
                    vel += 50. * dt * dirFwd * 0.4 * sprintMode.r;
                    vel += 50. * dt * dirRight * sign(keyDown(KEY_RIGHT)-keyDown(KEY_LEFT)+keyDown(39)-keyDown(37));
                    if (abs(pos.z - minHeight) < 0.01) {
                        vel.z = 9. * keyDown(32);
                    }
                    else {
                        vel.z -= 32. * dt;
                        vel.z = clamp(vel.z, -80., 30.);
                    }
                    if (length(vel.xy) > 4.317 * (1. + 0.4 * sprintMode.r)) vel.xy = normalize(vel.xy) * 4.317 * (1. + 0.4 * sprintMode.r);
                }
				
                
                pos += dt * vel; 
                if (pos.z < minHeight) {
                    pos.z = minHeight;
                    vel.z = 0.;
                }
                if (pos.z > maxHeight) {
                    pos.z = maxHeight;
                    vel.z = 0.;
                }
                if (pos.x < minX) {
                    pos.x = minX;
                    vel.x = 0.;
                }
                if (pos.x > maxX) {
                    pos.x = maxX;
                    vel.x = 0.;
                }
                if (pos.y < minY) {
                    pos.y = minY;
                    vel.y = 0.;
                }
                if (pos.y > maxY) {
                    pos.y = maxY;
                    vel.y = 0.;
                }

                float timer = load(_old+_pickTimer).r;
                vec4 oldPick = load(_old+_pick);
                vec4 pick;
                float pickAction;
                if (iMouse.z > 0.) {
                    vec3 cameraDir = vec3(sin(angle.y) * cos(angle.x), sin(angle.y) * sin(angle.x), cos(angle.y));
                    vec3 cameraPlaneU = vec3(normalize(vec2(cameraDir.y, -cameraDir.x)), 0);
                    vec3 cameraPlaneV = cross(cameraPlaneU, cameraDir) * iResolution.y / iResolution.x;
                    vec2 screenPos = iMouse.xy / iResolution.xy * 2.0 - 1.0;
                    vec3 rayDir = cameraDir + screenPos.x * cameraPlaneU + screenPos.y * cameraPlaneV;
                    rayCastResults res = rayCast(pos + vec3(0,0,1.6), rayDir, offset);
                    if (res.dist <= 5.) {
                        pick.xyz = res.mapPos;
                        if (bool(keyDown(KEY_DESTROY))) {
                            pick.a = 1.;
                            store1(vec2(0,9),pick.a);
                            timer += dt / 0.25;
                        }
                        else if (bool(keySinglePress(KEY_PLACE))) {
                            pick.a = 2.;
                            pick.xyz += res.normal;
                            timer += dt / 0.3;
                        }
                		if (oldPick != pick) timer = 0.;
                    }
                    else {
                        pick = vec4(-1,-1,-1,0);
                        timer = 0.;
                    }
                }
                else {
                    pick = vec4(-1,-1,-1,0);
                    timer = 0.;
                }
				
                const int numItems = 8;
                selected += keyPress(KEY_INVENTORY_NEXT) - keyPress(KEY_INVENTORY_PREVIOUS);
                for (int i = 0; i < 9; i++) {
                	if (bool(keyPress(KEY_INVENTORY_ABSOLUTE_START + i))) selected = float(i);   
                }
				selected = mod(selected, float(numItems));
                
                renderScale = clamp(renderScale + keySinglePress(KEY_DECREASE_RESOLUTION) - keySinglePress(KEY_INCREASE_RESOLUTION), 0., 4.);
				time.g = clamp(time.g + keySinglePress(KEY_INCREASE_TIME_SCALE) - keyPress(KEY_DECREASE_TIME_SCALE), 0., 8.);
				time.r = mod(time.r + dt * sign(time.g) * pow(2., time.g - 1.), 1200.);

                store3(_pos, pos);
                store2(_angle, angle);
                store4(_loadRange, calcLoadRange(pos.xy));
                store4(_mouse, mouse);
                store1(_inBlock, inBlock);
                store3(_vel, vel);
                store4(_pick, pick);
                store1(_pickTimer, timer);
                store1(_renderScale, renderScale);
                store1(_selectedInventory, selected);
                store2(_flightMode, flightMode);
                store2(_sprintMode, sprintMode);
                store2(_time, time);
                fragColor = outValue;
            }
        }
        else fragColor = texture(iChannel0, (fragCoord - _old) / iResolution.xy);
    }
    else fragColor.rgb = vec3(0,0,0);
}
`;

const buffB = `
#define var(name, x, y) const vec2 name = vec2(x, y)
#define varRow 0.
var(_pos, 0, varRow);
var(_angle, 2, varRow);
var(_mouse, 3, varRow);
var(_loadRange, 4, varRow);
var(_inBlock, 5, varRow);
var(_vel, 6, varRow);
var(_pick, 7, varRow);
var(_pickTimer, 8, varRow);
var(_renderScale, 9, varRow);
var(_selectedInventory, 10, varRow);
var(_flightMode, 11, varRow);
var(_sprintMode, 12, varRow);
var(_time, 13, varRow);
var(_old, 0, 1);


vec4 load(vec2 coord) {
	return texture(iChannel0, vec2((floor(coord) + 0.5) / iChannelResolution[1].xy));
}

#define HASHSCALE1 .1031
#define HASHSCALE3 vec3(.1031, .1030, .0973)
#define HASHSCALE4 vec4(1031, .1030, .0973, .1099)

float hash13(vec3 p3)
{
	p3  = fract(p3 * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

vec3 hash33(vec3 p3)
{
	p3 = fract(p3 * HASHSCALE3);
    p3 += dot(p3, p3.yxz+19.19);
    return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
}

vec4 hash44(vec4 p4)
{
	p4 = fract(p4  * HASHSCALE4);
    p4 += dot(p4, p4.wzxy+19.19);
    return fract(vec4((p4.x + p4.y)*p4.z, (p4.x + p4.z)*p4.y, (p4.y + p4.z)*p4.w, (p4.z + p4.w)*p4.x));
}

//
// Description : Array and textureless GLSL 2D,3D simplex noise function.
//      Author : Ian McEwan, Ashima Arts.
//  Maintainer : stegu
//     Lastmod : 20110822 (ijm)
//     License : Copyright (C) 2011 Ashima Arts. All rights reserved.
//               Distributed under the MIT License. See LICENSE file.
//               https://github.com/ashima/webgl-noise
//               https://github.com/stegu/webgl-noise
//
vec2 mod289(vec2 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec3 mod289(vec3 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}

vec4 mod289(vec4 x) {
  return x - floor(x * (1.0 / 289.0)) * 289.0;
}
vec3 permute(vec3 x) {
  return mod289(((x*34.0)+1.0)*x);
}
vec4 permute(vec4 x) {
     return mod289(((x*34.0)+1.0)*x);
}
vec4 taylorInvSqrt(vec4 r)
{
  return 1.79284291400159 - 0.85373472095314 * r;
}

float snoise(vec3 v)
  { 
  const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
  const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

// First corner
  vec3 i  = floor(v + dot(v, C.yyy) );
  vec3 x0 =   v - i + dot(i, C.xxx) ;

// Other corners
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min( g.xyz, l.zxy );
  vec3 i2 = max( g.xyz, l.zxy );

  //   x0 = x0 - 0.0 + 0.0 * C.xxx;
  //   x1 = x0 - i1  + 1.0 * C.xxx;
  //   x2 = x0 - i2  + 2.0 * C.xxx;
  //   x3 = x0 - 1.0 + 3.0 * C.xxx;
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy; // 2.0*C.x = 1/3 = C.y
  vec3 x3 = x0 - D.yyy;      // -1.0+3.0*C.x = -0.5 = -D.y

// Permutations
  i = mod289(i); 
  vec4 p = permute( permute( permute( 
             i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
           + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
           + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

// Gradients: 7x7 points over a square, mapped onto an octahedron.
// The ring size 17*17 = 289 is close to a multiple of 49 (49*6 = 294)
  float n_ = 0.142857142857; // 1.0/7.0
  vec3  ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);  //  mod(p,7*7)

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_ );    // mod(j,N)

  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4( x.xy, y.xy );
  vec4 b1 = vec4( x.zw, y.zw );

  //vec4 s0 = vec4(lessThan(b0,0.0))*2.0 - 1.0;
  //vec4 s1 = vec4(lessThan(b1,0.0))*2.0 - 1.0;
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

  vec3 p0 = vec3(a0.xy,h.x);
  vec3 p1 = vec3(a0.zw,h.y);
  vec3 p2 = vec3(a1.xy,h.z);
  vec3 p3 = vec3(a1.zw,h.w);

//Normalise gradients
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

// Mix final noise value
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                dot(p2,x2), dot(p3,x3) ) );
}
float snoise(vec2 v)
  {
  const vec4 C = vec4(0.211324865405187,  // (3.0-sqrt(3.0))/6.0
                      0.366025403784439,  // 0.5*(sqrt(3.0)-1.0)
                     -0.577350269189626,  // -1.0 + 2.0 * C.x
                      0.024390243902439); // 1.0 / 41.0
// First corner
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);

// Other corners
  vec2 i1;
  //i1.x = step( x0.y, x0.x ); // x0.x > x0.y ? 1.0 : 0.0
  //i1.y = 1.0 - i1.x;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  // x0 = x0 - 0.0 + 0.0 * C.xx ;
  // x1 = x0 - i1 + 1.0 * C.xx ;
  // x2 = x0 - 1.0 + 2.0 * C.xx ;
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;

// Permutations
  i = mod289(i); // Avoid truncation effects in permutation
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
		+ i.x + vec3(0.0, i1.x, 1.0 ));

  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;

// Gradients: 41 points uniformly over a line, mapped onto a diamond.
// The ring size 17*17 = 289 is close to a multiple of 41 (41*7 = 287)

  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;

// Normalise gradients implicitly by scaling m
// Approximation of: m *= inversesqrt( a0*a0 + h*h );
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );

// Compute final noise value at P
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}


const vec2 packedChunkSize = vec2(12,7);
const float heightLimit = packedChunkSize.x * packedChunkSize.y;

vec2 unswizzleChunkCoord(vec2 storageCoord) {
 	vec2 s = floor(storageCoord);
    float dist = max(s.x, s.y);
    float offset = floor(dist / 2.);
    float neg = step(0.5, mod(dist, 2.)) * 2. - 1.;
    return neg * (s - offset);
}

vec2 swizzleChunkCoord(vec2 chunkCoord) {
    vec2 c = chunkCoord;
    float dist = max(abs(c.x), abs(c.y));
    vec2 c2 = floor(abs(c - 0.5));
    float offset = max(c2.x, c2.y);
    float neg = step(c.x + c.y, 0.) * -2. + 1.;
    return (neg * c) + offset;
}

float calcLoadRange(void) {
	vec2 chunks = floor(iResolution.xy / packedChunkSize);
    float gridSize = min(chunks.x, chunks.y);
    return floor((gridSize - 1.) / 2.);
}

vec4 readMapTex(vec2 pos) {
 	return texture(iChannel1, (floor(pos) + 0.5) / iChannelResolution[0].xy);   
}

vec3 texToVoxCoord(vec2 textelCoord, vec3 offset) {
	vec3 voxelCoord = offset;
    voxelCoord.xy += unswizzleChunkCoord(textelCoord / packedChunkSize);
    voxelCoord.z += mod(textelCoord.x, packedChunkSize.x) + packedChunkSize.x * mod(textelCoord.y, packedChunkSize.y);
    return voxelCoord;
}

vec2 voxToTexCoord(vec3 voxCoord) {
    vec3 p = floor(voxCoord);
    return swizzleChunkCoord(p.xy) * packedChunkSize + vec2(mod(p.z, packedChunkSize.x), floor(p.z / packedChunkSize.x));
}

struct voxel {
	float id;
    float sunlight;
    float torchlight;
    float hue;
};

voxel decodeTextel(vec4 textel) {
	voxel o;
    o.id = textel.r;
    o.sunlight = floor(mod(textel.g, 16.));
    o.torchlight = floor(mod(textel.g / 16., 16.));
    o.hue = textel.b;
    return o;
}

vec4 encodeVoxel(voxel v) {
	vec4 o;
    o.r = v.id;
    o.g = clamp(floor(v.sunlight), 0., 15.) + 16. * clamp(floor(v.torchlight), 0., 15.);
    o.b = v.hue;
    o.a = 1.;
    return o;
}

bool inRange(vec2 p, vec4 r) {
	return (p.x > r.x && p.x < r.y && p.y > r.z && p.y < r.w);
}

voxel getVoxel(vec3 p) {
    return decodeTextel(readMapTex(voxToTexCoord(p)));
}

bool overworld(vec3 p) {
	float density = 48. - p.z;
    density += mix(0., 40., pow(.5 + .5 * snoise(p.xy /557. + vec2(0.576, .492)), 2.)) * snoise(p / 31.51 + vec3(0.981, .245, .497));
    return density > 0.;
}

float getInventory(float slot) {
	return slot + 1. + step(2.5, slot);  
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    vec2 textelCoord = floor(fragCoord);
    vec3 offset = floor(vec3(load(_pos).xy, 0.));
    vec3 oldOffset = floor(vec3(load(_old+_pos).xy, 0.));
    vec3 voxelCoord = texToVoxCoord(textelCoord, offset);            
    
    voxel vox;
    vec4 range = load(_old+_loadRange);
    vec4 pick = load(_pick);
    if (!inRange(voxelCoord.xy, range) || iFrame == 0 ) {
    	bool solid = overworld(voxelCoord);
        if (solid) {
            vox.id = 3.;
            if (overworld(voxelCoord + vec3(0,0,1))) vox.id = 2.;
            if (overworld(voxelCoord + vec3(0,0,3))) vox.id = 1.;
    		if (hash13(voxelCoord) > 0.98 && !overworld(voxelCoord + vec3(0,0,-1))) vox.id = 6.;
        }
        if (snoise(voxelCoord / 27.99 + vec3(0.981, .245, .497).yzx * 17.) > 1. - (smoothstep(0., 5., voxelCoord.z) - 0.7 * smoothstep(32., 48., voxelCoord.z))) vox.id = 0.;
        if (voxelCoord.z < 1.) vox.id = 16.;
        vox.hue = fract(hash13(voxelCoord));
        vox.sunlight = 0.;
        vox.torchlight = 0.;
    }
    else {
    	vox = getVoxel(voxelCoord - oldOffset);
    }

    if (voxelCoord == pick.xyz) {
        if (pick.a == 1. && load(_pickTimer).r > 1. && vox.id != 16.) vox.id = 0.;
        if (pick.a == 2.) vox.id = getInventory(load(_selectedInventory).r);
    }
    
    voxel temp;
    if (voxelCoord.z == heightLimit - 1.) {
    	vox.sunlight = 15.;   
    }
    else vox.sunlight = 0.;
    vox.torchlight = 0.;
    //if (length(voxelCoord + .5 - load(_pos).xyz) < 1.) vox.torchlight = 15.;
    if (voxelCoord.z < heightLimit - 1.) {
    	temp = getVoxel(voxelCoord + vec3(0,0,1) - oldOffset);
        vox.sunlight = max(vox.sunlight, temp.sunlight);
        vox.torchlight = max(vox.torchlight, temp.torchlight - 1.);
    }
    if (voxelCoord.z > 1.) {
    	temp = getVoxel(voxelCoord + vec3(0,0,-1) - oldOffset);
        vox.sunlight = max(vox.sunlight, temp.sunlight - 1.);
        vox.torchlight = max(vox.torchlight, temp.torchlight - 1.);
    }
    if (voxelCoord.x > range.x + 1.) {
    	temp = getVoxel(voxelCoord + vec3(-1,0,0) - oldOffset);
        vox.sunlight = max(vox.sunlight, temp.sunlight - 1.);
        vox.torchlight = max(vox.torchlight, temp.torchlight - 1.);
    }
    if (voxelCoord.x < range.y - 1.) {
    	temp = getVoxel(voxelCoord + vec3(1,0,0) - oldOffset);
        vox.sunlight = max(vox.sunlight, temp.sunlight - 1.);
        vox.torchlight = max(vox.torchlight, temp.torchlight - 1.);
    }
    if (voxelCoord.y > range.z + 1.) {
    	temp = getVoxel(voxelCoord + vec3(0,-1,0) - oldOffset);
        vox.sunlight = max(vox.sunlight, temp.sunlight - 1.);
        vox.torchlight = max(vox.torchlight, temp.torchlight - 1.);
    }
    if (voxelCoord.y < range.w - 1.) {
    	temp = getVoxel(voxelCoord + vec3(0,1,0) - oldOffset);
        vox.sunlight = max(vox.sunlight, temp.sunlight - 1.);
        vox.torchlight = max(vox.torchlight, temp.torchlight - 1.);
    }
    
    if (vox.id > 0.) {
        vox.sunlight = 0.;
        vox.torchlight = 0.;
    }
    
    if (vox.id == 6.) {
    	vox.torchlight = 15.;   
    }
    fragColor = encodeVoxel(vox);
}
`;

const buffC = `
#define var(name, x, y) const vec2 name = vec2(x, y)
#define varRow 0.
var(_pos, 0, varRow);
var(_angle, 2, varRow);
var(_mouse, 3, varRow);
var(_loadRange, 4, varRow);
var(_inBlock, 5, varRow);
var(_vel, 6, varRow);
var(_pick, 7, varRow);
var(_pickTimer, 8, varRow);
var(_renderScale, 9, varRow);
var(_selectedInventory, 10, varRow);
var(_flightMode, 11, varRow);
var(_sprintMode, 12, varRow);
var(_time, 13, varRow);
var(_old, 0, 1);



vec4 load(vec2 coord) {
	return texture(iChannel0, vec2((floor(coord) + 0.5) / iChannelResolution[0].xy));
}


#define HASHSCALE1 .1031
#define HASHSCALE3 vec3(.1031, .1030, .0973)
#define HASHSCALE4 vec4(1031, .1030, .0973, .1099)

vec4 noiseTex(vec2 c) {
	return texture(iChannel1, c / iChannelResolution[1].xy);   
}

float hash12(vec2 p)
{
	vec3 p3  = fract(vec3(p.xyx) * HASHSCALE1);
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.x + p3.y) * p3.z);
}

vec2 hash22(vec2 p)
{
	vec3 p3 = fract(vec3(p.xyx) * HASHSCALE3);
    p3 += dot(p3, p3.yzx+19.19);
    return fract(vec2((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y));
}

float signed(float x) {
	return x * 2. - 1.;   
}


float tileableWorley(in vec2 p, in float numCells)
{
	p *= numCells;
	float d = 1.0e10;
	for (int xo = -1; xo <= 1; xo++)
	{
		for (int yo = -1; yo <= 1; yo++)
		{
			vec2 tp = floor(p) + vec2(xo, yo);
			tp = p - tp - hash22(256. * mod(tp, numCells));
			d = min(d, dot(tp, tp));
		}
	}
	return sqrt(d);
	//return 1.0 - d;// ...Bubbles.
}

float crackingAnimation(vec2 p, float t) {
    t = ceil(t * 8.) / 8.;
	float d = 1.0e10;
    //t *= ;
    for (float i = 0.; i < 25.; i++) {
    	vec2 tp = texture(iChannel1, vec2(4, i) / 256.).xy - 0.5;
        tp *= max(0., (length(tp) + clamp(t, 0., 1.) - 1.) / length(tp));
        d = min(d, length(tp + 0.5 - p));
    }
    return pow(mix(clamp(1. - d * 3., 0., 1.), 1., smoothstep(t - 0.3, t + 0.3, max(abs(p.x - 0.5), abs(p.y - 0.5)) * 2.)), .6) * 1.8 - 0.8;
}

float brickPattern(vec2 c) {
	float o = 1.;
    if (mod(c.y, 4.) < 1.) o = 0.;
    if (mod(c.x - 4. * step(4., mod(c.y, 8.)), 8.) > 7.) o = 0.;
    return o;
}
float woodPattern(vec2 c) {
	float o = 1.;
    if (mod(c.y, 4.) < 1.) o = 0.;
    if (mod(c.x + 2. - 6. * step(4., mod(c.y, 8.)), 16.) > 15.) o = 0.;
    return o;
}

//From https://github.com/hughsk/glsl-hsv2rgb
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec4 getTexture(float id, vec2 c) {
    vec2 gridPos = vec2(mod(id, 16.), floor(id / 16.));
	return texture(iChannel2, (c + gridPos * 16.) / iChannelResolution[3].xy);
}



void mainImage( out vec4 o, in vec2 fragCoord )
{
    
    vec2 gridPos = floor(fragCoord / 16.);
    vec2 c = mod(fragCoord, 16.);
    int id = int(gridPos.x + gridPos.y * 16.);
    o.a = 1.;
    if (id == 0) {
    	o = vec4(1,0,1,1);
    }
    if (id == 1) {
        o.rgb = 0.45 + 0.2 * vec3(noiseTex(c * vec2(.5, 1.) + vec2(floor(hash12(c + vec2(27,19)) * 3. - 1.), 0.)).b);
    }
    if (id == 2) {
    	o.rgb = vec3(0.55,0.4,0.3) * (1. + 0.3 * signed(noiseTex(c + 37.).r));
        if (hash12(c * 12.) > 0.95) o.rgb = vec3(0.4) + 0.2 * noiseTex(c + 92.).g;
    }
    if (id == 3) {
    	o.rgb = getTexture(2., c).rgb;
        if (noiseTex(vec2(0, c.x) + 12.).a * 3. + 1. > 16. - c.y) o.rgb = getTexture(4., c).rgb;
    }
    if (id == 4) {
    	o.rgb = hsv2rgb(vec3(0.22, .8 - 0.3 * noiseTex(c + 47.).b, 0.6 + 0.1 * noiseTex(c + 47.).b));
    }
    if (id == 5) {
    	o.rgb = vec3(clamp(pow(1. - tileableWorley(c / 16., 4.), 2.), 0.2, 0.6) + 0.2 * tileableWorley(c / 16., 5.));
    }
    if (id == 6) {
        float w = 1. - tileableWorley(c / 16., 4.);
        float l = clamp(0.7 * pow(w, 4.) + 0.5 * w, 0., 1.);
        o.rgb = mix(vec3(.3, .1, .05), vec3(1,1,.6), l);
        if (w < 0.2) o.rgb = vec3(0.3, 0.25, 0.05);
    }
    if (id == 7) {
    	o.rgb = -0.1 * hash12(c) + mix(vec3(.6,.3,.2) + 0.1 * (1. - brickPattern(c + vec2(-1,1)) * brickPattern(c)), vec3(0.8), 1. - brickPattern(c));
    }
    if (id == 8) {
    	o.rgb = mix(vec3(1,1,.2), vec3(1,.8,.1), sin((c.x - c.y) / 3.) * .5 + .5);
        if (any(greaterThan(abs(c - 8.), vec2(7)))) o.rgb = vec3(1,.8,.1);
    }
    if (id == 9) {
        o.rgb = vec3(0.5,0.4,0.25)*(0.5 + 0.5 * woodPattern(c)) * (1. + 0.2 * noiseTex(c * vec2(.5, 1.) + vec2(floor(hash12(c + vec2(27,19)))) * 3. - 1.).b);
    }
    if (id == 16) {
      	o.rgb = (-1. + 2. * getTexture(1., c).rgb) * 2.5;
    }
    if (id == 32) {
    	o.rgb = vec3(crackingAnimation(c / 16., load(_pickTimer).r));
    }
    if (id == 48) {
    	o = vec4(vec3(0.2), 0.7);
        vec2 p = c - 8.;
        float d = max(abs(p.x), abs(p.y));
        if (d > 6.) {
            o.rgb = vec3(0.7);
            o.rgb += 0.05 * hash12(c);
            o.a = 1.;
            if ((d < 7. && p.x < 6.)|| (p.x > 7. && abs(p.y) < 7.)) o.rgb -= 0.3;
        }
        o.rgb += 0.05 * hash12(c);
        
    }
    
}
`;

const buffD = `
const float PI = 3.14159265359;

#define var(name, x, y) const vec2 name = vec2(x, y)
#define varRow 0.
var(_pos, 0, varRow);
var(_angle, 2, varRow);
var(_mouse, 3, varRow);
var(_loadRange, 4, varRow);
var(_inBlock, 5, varRow);
var(_vel, 6, varRow);
var(_pick, 7, varRow);
var(_pickTimer, 8, varRow);
var(_renderScale, 9, varRow);
var(_selectedInventory, 10, varRow);
var(_flightMode, 11, varRow);
var(_sprintMode, 12, varRow);
var(_time, 13, varRow);
var(_old, 0, 1);


vec4 load(vec2 coord) {
	return textureLod(iChannel0, vec2((floor(coord) + 0.5) / iChannelResolution[0].xy), 0.0);
}

vec2 unswizzleChunkCoord(vec2 storageCoord) {
 	vec2 s = storageCoord;
    float dist = max(s.x, s.y);
    float offset = floor(dist / 2.);
    float neg = step(0.5, mod(dist, 2.)) * 2. - 1.;
    return neg * (s - offset);
}

vec2 swizzleChunkCoord(vec2 chunkCoord) {
    vec2 c = chunkCoord;
    float dist = max(abs(c.x), abs(c.y));
    vec2 c2 = floor(abs(c - 0.5));
    float offset = max(c2.x, c2.y);
    float neg = step(c.x + c.y, 0.) * -2. + 1.;
    return (neg * c) + offset;
}


const vec2 packedChunkSize = vec2(12,7);

vec4 readMapTex(vec2 pos) {
 	return textureLod(iChannel1, (floor(pos) + 0.5) / iChannelResolution[0].xy, 0.0);   
}

vec2 voxToTexCoord(vec3 p) {
 	p = floor(p);
    return swizzleChunkCoord(p.xy) * packedChunkSize + vec2(mod(p.z, packedChunkSize.x), floor(p.z / packedChunkSize.x));
}

bool getHit(vec3 c) {
	vec3 p = vec3(c) + vec3(0.5);
	float d = readMapTex(voxToTexCoord(p)).r;
	return d > 0.5;
}

vec2 rotate2d(vec2 v, float a) {
	float sinA = sin(a);
	float cosA = cos(a);
	return vec2(v.x * cosA - v.y * sinA, v.y * cosA + v.x * sinA);	
}

//From https://github.com/hughsk/glsl-hsv2rgb
vec3 hsv2rgb(vec3 c) {
  vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
  vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
  return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
}

vec4 getTexture(float id, vec2 c) {
    vec2 gridPos = vec2(mod(id, 16.), floor(id / 16.));
	return textureLod(iChannel2, 16. * (c + gridPos) / iChannelResolution[3].xy, 0.0);
}


bool inRange(vec2 p, vec4 r) {
	return (p.x > r.x && p.x < r.y && p.y > r.z && p.y < r.w);
}

struct voxel {
	float id;
    vec2 light;
    float hue;
};

voxel decodeTextel(vec4 textel) {
	voxel o;
    o.id = textel.r;
    o.light.s = floor(mod(textel.g, 16.));
    o.light.t = floor(mod(textel.g / 16., 16.));
    o.hue = textel.b;
    return o;
}

voxel getVoxel(vec3 p) {
    return decodeTextel(readMapTex(voxToTexCoord(p)));
}

vec2 max24(vec2 a, vec2 b, vec2 c, vec2 d) {
	return max(max(a, b), max(c, d));   
}

float lightLevelCurve(float t) {
    t = mod(t, 1200.);
	return 1. - ( smoothstep(400., 700., t) - smoothstep(900., 1200., t));
}

vec3 lightmap(vec2 light) {
    light = 15. - light;
    return clamp(mix(vec3(0), mix(vec3(0.11, 0.11, 0.21), vec3(1), lightLevelCurve(load(_time).r)), pow(.8, light.s)) + mix(vec3(0), vec3(1.3, 1.15, 1), pow(.75, light.t)), 0., 1.);   
}

float vertexAo(float side1, float side2, float corner) {
	return 1. - (side1 + side2 + max(corner, side1 * side2)) / 5.0;
}

float opaque(float id) {
	return id > .5 ? 1. : 0.;   
}

vec3 calcLightingFancy(vec3 r, vec3 s, vec3 t, vec2 uv) {
	voxel v1, v2, v3, v4, v5, v6, v7, v8, v9;
    //uv = (floor(uv * 16.) + .5) / 16.;
    v1 = getVoxel(r - s + t);
    v2 = getVoxel(r + t);
    v3 = getVoxel(r + s + t);
    v4 = getVoxel(r - s);
    v5 = getVoxel(r);
    v6 = getVoxel(r + s);
    v7 = getVoxel(r - s - t);
    v8 = getVoxel(r - t);
    v9 = getVoxel(r + s - t);
    
    //return vec3(uv, 0.) - .5 * opaque(v6.id);
    
    vec2 light1, light2, light3, light4, light;
    light1 = max24(v1.light, v2.light, v4.light, v5.light);
    light2 = max24(v2.light, v3.light, v5.light, v6.light);
    light3 = max24(v4.light, v5.light, v7.light, v8.light);
    light4 = max24(v5.light, v6.light, v8.light, v9.light);
    
    float ao1, ao2, ao3, ao4, ao;
    ao1 = vertexAo(opaque(v2.id), opaque(v4.id), opaque(v1.id));
    ao2 = vertexAo(opaque(v2.id), opaque(v6.id), opaque(v3.id));
    ao3 = vertexAo(opaque(v8.id), opaque(v4.id), opaque(v7.id));
    ao4 = vertexAo(opaque(v8.id), opaque(v6.id), opaque(v9.id));
    
    light = mix(mix(light3, light4, uv.x), mix(light1, light2, uv.x), uv.y);
    ao = mix(mix(ao3, ao4, uv.x), mix(ao1, ao2, uv.x), uv.y);
    
    return lightmap(light) * pow(ao, 1. / 1.);
}

vec3 calcLightingFast(vec3 r, vec3 s, vec3 t, vec2 uv) {
    return lightmap(min(getVoxel(r).light + 0.2, 15.));
}

struct rayCastResults {
	bool hit;
    vec3 rayPos;
    vec3 mapPos;
    vec3 normal;
    vec2 uv;
    vec3 tangent;
    vec3 bitangent;
    float dist;
};

rayCastResults rayCast(vec3 rayPos, vec3 rayDir, vec3 offset, vec4 range) {
	vec3 mapPos = floor(rayPos);
    vec3 deltaDist = abs(vec3(length(rayDir)) / rayDir);
    vec3 rayStep = sign(rayDir);
    vec3 sideDist = (sign(rayDir) * (mapPos - rayPos) + (sign(rayDir) * 0.5) + 0.5) * deltaDist; 
    vec3 mask;
    bool hit = false;
    for (int i = 0; i < 384; i++) {
		mask = step(sideDist.xyz, sideDist.yzx) * step(sideDist.xyz, sideDist.zxy);
		sideDist += vec3(mask) * deltaDist;
		mapPos += vec3(mask) * rayStep;
		
        if (!inRange(mapPos.xy, range) || mapPos.z < 0. || mapPos.z >= packedChunkSize.x * packedChunkSize.y) break;
        if (getHit(mapPos - offset)) { 
            hit = true; 
            break;
        }

	}
    vec3 endRayPos = rayDir / dot(mask * rayDir, vec3(1)) * dot(mask * (mapPos + step(rayDir, vec3(0)) - rayPos), vec3(1)) + rayPos;
   	vec2 uv;
    vec3 tangent1;
    vec3 tangent2;
    if (abs(mask.x) > 0.) {
        uv = endRayPos.yz;
        tangent1 = vec3(0,1,0);
        tangent2 = vec3(0,0,1);
    }
    else if (abs(mask.y) > 0.) {
        uv = endRayPos.xz;
        tangent1 = vec3(1,0,0);
        tangent2 = vec3(0,0,1);
    }
    else {
        uv = endRayPos.xy;
        tangent1 = vec3(1,0,0);
        tangent2 = vec3(0,1,0);
    }
    uv = fract(uv);
    rayCastResults res;
    res.hit = hit;
    res.uv = uv;
    res.mapPos = mapPos;
    res.normal = -rayStep * mask;
    res.tangent = tangent1;
    res.bitangent = tangent2;
    res.rayPos = endRayPos;
    res.dist = length(rayPos - endRayPos);
    return res;
}


vec3 skyColor(vec3 rayDir) {
    float t = load(_time).r;
    float lightLevel = lightLevelCurve(t);
    float sunAngle = (t * PI * 2. / 1200.) + PI / 4.;
    vec3 sunDir = vec3(cos(sunAngle), 0, sin(sunAngle));
    
    vec3 daySkyColor = vec3(.5,.75,1);
    vec3 dayHorizonColor = vec3(0.8,0.8,0.9);
    vec3 nightSkyColor = vec3(0.1,0.1,0.2) / 2.;
    
    vec3 skyColor = mix(nightSkyColor, daySkyColor, lightLevel);
    vec3 horizonColor = mix(nightSkyColor, dayHorizonColor, lightLevel);
    float sunVis = smoothstep(.99, 0.995, dot(sunDir, rayDir));
    float moonVis = smoothstep(.999, 0.9995, dot(-sunDir, rayDir));
    return mix(mix(mix(horizonColor, skyColor, clamp(dot(rayDir, vec3(0,0,1)), 0., 1.)), vec3(1,1,0.95), sunVis), vec3(0.8), moonVis);
    
}

void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    float scaleFactor = pow(sqrt(2.), load(_renderScale).r);
    vec2 renderResolution = ceil(iResolution.xy / scaleFactor); 
    if (any(greaterThan(fragCoord, renderResolution))) {
        fragColor = vec4(0);
        return;
    }
    vec2 screenPos = (fragCoord.xy / renderResolution.xy) * 2.0 - 1.0;
	vec3 rayPos = load(_pos).xyz + vec3(0,0,1.6);
    vec2 angle = load(_angle).xy;
    vec4 range = load(_loadRange);
    vec3 cameraDir = vec3(sin(angle.y) * cos(angle.x), sin(angle.y) * sin(angle.x), cos(angle.y));
    vec3 cameraPlaneU = vec3(normalize(vec2(cameraDir.y, -cameraDir.x)), 0);
    vec3 cameraPlaneV = cross(cameraPlaneU, cameraDir) * renderResolution.y / renderResolution.x;
	vec3 rayDir = normalize(cameraDir + screenPos.x * cameraPlaneU + screenPos.y * cameraPlaneV);
	
	vec3 mapPos = vec3(floor(rayPos));
    vec3 offset = vec3(floor(load(_pos).xy), 0.);
	vec3 deltaDist = abs(vec3(length(rayDir)) / rayDir);
	
	vec3 rayStep = vec3(sign(rayDir));

	vec3 sideDist = (sign(rayDir) * (vec3(mapPos) - rayPos) + (sign(rayDir) * 0.5) + 0.5) * deltaDist; 
	
	vec3 mask;
    
    mapPos;
    
    rayCastResults res = rayCast(rayPos, rayDir, offset, range);
	
	vec3 color = vec3(0);
    voxel vox = getVoxel(res.mapPos - offset);
    if (res.hit) {
        
        color = calcLightingFancy(res.mapPos - offset + res.normal, res.tangent, res.bitangent, res.uv);
        //color *= hsv2rgb(vec3(getVoxel(mapPos + .5 - offset).hue, .1, 1));
        float textureId = vox.id;
        if (textureId == 3.) textureId += res.normal.z;
        color *= getTexture(textureId, res.uv).rgb;
        vec4 pick = load(_pick);
        if (res.mapPos == pick.xyz) {
            if (pick.a == 1.) color *= getTexture(32., res.uv).r;
            else color = mix(color, vec3(1), 0.2);
        }
        //color.rgb = res.uv.xyx;
    }
    //else color = mix(lightmap(vec2(0)) / 2., skyColor(rayDir), vox.light.s / 15.);
    else color = skyColor(rayDir);
    fragColor.rgb = pow(color, vec3(1.));
    
}


`;

const fragment = `
/* 
Voxel Game
fb39ca4's SH16C Entry

This was an attempt to make something like Minecraft entirely in
Shadertoy. The world around the player is saved in a buffer, and as long
as an an area is loaded, changes remain. However, if you go too far
away, blocks you have modified will reset. To load more blocks, go to 
fullscreen to increase the size of the buffers. I tried to implement
many of the features from Minecraft's Creative mode, but at this point,
this shader is more of a tech demo to prove that interactive voxel games
are possible.

Features:
    Semi-persistent world
    Flood-fill sky and torch lighting
    Smooth lighting and ambient occlusion
    Day/Night cycle
    Movement with collision detection
    Flying and sprinting mode
    Block placment and removal
    Hotbar to choose between: Stone, Dirt, Grass, Cobblestone, Glowstone, 
        Brick, Gold, Wood
    
Controls:
    Click and drag mouse to look, select blocks
    WASD to move
    Space to jump
    Double-tap space to start flying, use space and shift to go up and down.
    Q + mouse button to place block
    E + mouse button to destroy blocks
    Z/X to cycle through available blocks for placement
    0-8 to choose a block type for placement
    Page Up/Down to increase or decrease render resolution
    O,P to decrease/increase speed of day/night cycles

	There are #defines in Buffer A to change the controls.

TODO:
âœ“ Voxel Raycaster
âœ“ Free camera controls
âœ“ Store map in texture
âœ“ Infinite World
âœ“ Persistent World
âœ“ Sky Lighting
âœ“ Torch Lighting
âœ“ Smooth Lighting, Ambient Occlusion
âœ“ Vertical Collision Detection
âœ“ Walking, Jumping
âœ“ Horizontal collision detection
âœ“ Textures
âœ“ Proper world generation
âœ“ Block picking
âœ“ Adding/Removing blocks
âœ“ GUI for block selection
âœ“ Sun, Moon, Sky
âœ“ Day/Night Cycle
âœ“ Double jump to fly, double tap forwards to run
*/

#define var(name, x, y) const vec2 name = vec2(x, y)
#define varRow 0.
var(_pos, 0, varRow);
var(_angle, 2, varRow);
var(_mouse, 3, varRow);
var(_loadRange, 4, varRow);
var(_inBlock, 5, varRow);
var(_vel, 6, varRow);
var(_pick, 7, varRow);
var(_pickTimer, 8, varRow);
var(_renderScale, 9, varRow);
var(_selectedInventory, 10, varRow);
var(_flightMode, 11, varRow);
var(_sprintMode, 12, varRow);
var(_time, 13, varRow);
var(_old, 0, 1);


vec4 load(vec2 coord) {
	return textureLod(iChannel0, vec2((floor(coord) + 0.5) / iChannelResolution[0].xy), 0.0);
}

float keyToggled(int keyCode) {
	return textureLod(iChannel1, vec2((float(keyCode) + 0.5) / 256., 2.5/3.), 0.0).r;   
}


// ---- 8< ---- GLSL Number Printing - @P_Malin ---- 8< ----
// Creative Commons CC0 1.0 Universal (CC-0) 

float DigitBin(const in int x)
{
    return x==0?480599.0:x==1?139810.0:x==2?476951.0:x==3?476999.0:x==4?350020.0:x==5?464711.0:x==6?464727.0:x==7?476228.0:x==8?481111.0:x==9?481095.0:0.0;
}

float PrintValue(const in vec2 fragCoord, const in vec2 vPixelCoords, const in vec2 vFontSize, const in float fValue, const in float fMaxDigits, const in float fDecimalPlaces)
{
    vec2 vStringCharCoords = (fragCoord.xy - vPixelCoords) / vFontSize;
    if ((vStringCharCoords.y < 0.0) || (vStringCharCoords.y >= 1.0)) return 0.0;
	float fLog10Value = log2(abs(fValue)) / log2(10.0);
	float fBiggestIndex = max(floor(fLog10Value), 0.0);
	float fDigitIndex = fMaxDigits - floor(vStringCharCoords.x);
	float fCharBin = 0.0;
	if(fDigitIndex > (-fDecimalPlaces - 1.01)) {
		if(fDigitIndex > fBiggestIndex) {
			if((fValue < 0.0) && (fDigitIndex < (fBiggestIndex+1.5))) fCharBin = 1792.0;
		} else {		
			if(fDigitIndex == -1.0) {
				if(fDecimalPlaces > 0.0) fCharBin = 2.0;
			} else {
				if(fDigitIndex < 0.0) fDigitIndex += 1.0;
				float fDigitValue = (abs(fValue / (pow(10.0, fDigitIndex))));
                float kFix = 0.0001;
                fCharBin = DigitBin(int(floor(mod(kFix+fDigitValue, 10.0))));
			}		
		}
	}
    return floor(mod((fCharBin / pow(2.0, floor(fract(vStringCharCoords.x) * 4.0) + (floor(vStringCharCoords.y * 5.0) * 4.0))), 2.0));
}

float getInventory(float slot) {
	return slot + 1. + step(2.5, slot);  
}

vec4 getTexture(float id, vec2 c) {
    vec2 gridPos = vec2(mod(id, 16.), floor(id / 16.));
	return textureLod(iChannel2, 16. * (c + gridPos) / iChannelResolution[2].xy, 0.0);
}

const float numItems = 8.;

vec4 drawSelectionBox(vec2 c) {
	vec4 o = vec4(0.);
    float d = max(abs(c.x), abs(c.y));
    if (d > 6. && d < 9.) {
        o.a = 1.;
        o.rgb = vec3(0.9);
        if (d < 7.) o.rgb -= 0.3;
        if (d > 8.) o.rgb -= 0.1;
    }
    return o;
}

mat2 inv2(mat2 m) {
  return mat2(m[1][1],-m[0][1], -m[1][0], m[0][0]) / (m[0][0]*m[1][1] - m[0][1]*m[1][0]);
}

vec4 drawGui(vec2 c) {
	float scale = floor(iResolution.y / 128.);
    c /= scale;
    vec2 r = iResolution.xy / scale;
    vec4 o = vec4(0);
    float xStart = (r.x - 16. * numItems) / 2.;
    c.x -= xStart;
    float selected = load(_selectedInventory).r;
    vec2 p = (fract(c / 16.) - .5) * 3.;
    vec2 u = vec2(sqrt(3.)/2.,.5);
    vec2 v = vec2(-sqrt(3.)/2.,.5);
    vec2 w = vec2(0,-1);
    if (c.x < numItems * 16. && c.x >= 0. && c.y < 16.) {
        float slot = floor(c.x / 16.);
    	o = getTexture(48., fract(c / 16.));
        vec3 b = vec3(dot(p,u), dot(p,v), dot(p,w));
        vec2 texCoord;
        //if (all(lessThan(b, vec3(1)))) o = vec4(dot(p,u), dot(p,v), dot(p,w),1.);
        float top = 0.;
        float right = 0.;
        if (b.z < b.x && b.z < b.y) {
        	texCoord = inv2(mat2(u,v)) * p.xy;
            top = 1.;
        }
        else if(b.x < b.y) {
        	texCoord = 1. - inv2(mat2(v,w)) * p.xy;
            right = 1.;
        }
        else {
        	texCoord = inv2(mat2(u,w)) * p.xy;
            texCoord.y = 1. - texCoord.y;
        }
        if (all(lessThanEqual(abs(texCoord - .5), vec2(.5)))) {
            float id = getInventory(slot);
            if (id == 3.) id += top;
            o.rgb = getTexture(id, texCoord).rgb * (0.5 + 0.25 * right + 0.5 * top);
            o.a = 1.;
        }
    }
    vec4 selection = drawSelectionBox(c - 8. - vec2(16. * selected, 0));
    o = mix(o, selection, selection.a);
    return o;
}

// ---- 8< -------- 8< -------- 8< -------- 8< ----

const vec2 packedChunkSize = vec2(11,6);
void mainImage( out vec4 fragColor, in vec2 fragCoord ) {
    float scaleFactor = pow(sqrt(2.), load(_renderScale).r);
    vec2 renderResolution = ceil(iResolution.xy / scaleFactor); 
    fragColor = texture(iChannel3, fragCoord * renderResolution / iResolution.xy / iResolution.xy);
    vec4 gui = drawGui(fragCoord);
    fragColor = mix(fragColor, gui, gui.a);
    
    vec3 pos = load(_pos).xyz;
        
    if (bool(keyToggled(114))) {
        if (fragCoord.x < 20.) fragColor.rgb = mix(fragColor.rgb, texture(iChannel0, fragCoord / iResolution.xy).rgb, texture(iChannel0, fragCoord / iResolution.xy).a);
        fragColor = mix( fragColor, vec4(1,1,0,1), PrintValue(fragCoord, vec2(0.0, 5.0), vec2(8,15), iTimeDelta, 4.0, 1.0));
        fragColor = mix( fragColor, vec4(1,0,1,1), PrintValue(fragCoord, vec2(0.0, 25.0), vec2(8,15), load(_time).r, 6.0, 1.0));
        fragColor = mix( fragColor, vec2(1,.5).xyyx, PrintValue(fragCoord, vec2(0., iResolution.y - 20.), vec2(8,15), pos.x, 4.0, 5.0));
        fragColor = mix( fragColor, vec2(1,.5).yxyx, PrintValue(fragCoord, vec2(0., iResolution.y - 40.), vec2(8,15), pos.y, 4.0, 5.0));
        fragColor = mix( fragColor, vec2(1,.5).yyxx, PrintValue(fragCoord, vec2(0., iResolution.y - 60.), vec2(8,15), pos.z, 4.0, 5.0));
        
    }
	
    //fragColor = texture(iChannel2, fragCoord / 3. / iResolution.xy);
}
`;

export default class implements iSub {
  key(): string {
    return 'MtcGDH';
  }
  name(): string {
    return '[SH16C] Voxel Game';
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
      { type: 1, f: buffA, fi: 0 },
      { type: 1, f: buffB, fi: 1 },
      { type: 1, f: buffC, fi: 2 },
      { type: 1, f: buffD, fi: 3 },
    ];
  }
}
