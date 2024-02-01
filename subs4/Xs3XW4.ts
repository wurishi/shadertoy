import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// TODO: break

#define CURSOR 0
#define STATE 1
#define MEMORY 2

vec4 old_memory[MEMORY];
vec4 memory[MEMORY];

#define STATE_READY 0
#define STATE_PRINT_READY 1
#define STATE_PRINT_READY_NL 2
#define STATE_LISTING 3
#define STATE_RUNNING 4
#define STATE_BREAK 5

#define LINE_ZERO 30
#define MAX_LINES 200

float vec4pick(int c, vec4 v) {
    if (c == 0) return v.x;
    if (c == 1) return v.y;
    if (c == 2) return v.z;
    return v.w;
}

int vec4toint(int c, vec4 v) {
    c = int(mod(float(c), 8.0));
    float tmp = vec4pick(c / 2, v);
    if (c != (c/2) * 2) {
        return int(mod(tmp, 256.0));
    } else {
        return int(tmp) / 256;
    }
}

vec4 vec4tochar(int c, vec4 v) {
    return vec4(vec4toint(c, v), 14/* fg */, 6 /* bg */, 0);
}


void init_screen(out vec4 fragColor, int x, int y) {
    fragColor = vec4(96, 14, 6, 0);

    if(y == 1) {
        if (x > 3 && x < 35) fragColor.x = 42.0;
        if (x > 7 && x < 31) fragColor.x = 96.0;
        x -= 9;
        vec4 tmp;
        if (x < 0) return;
        if (x > 20) return;
        int n = x / 8;
        if (n == 0) tmp = vec4(0x030F, 0x0D0D, 0x0F04, 0x0F12);  // COMMODOR
        if (n == 1) tmp = vec4(0x0560, 0x3634, 0x6002, 0x0113);  // E 64 BAS
        if (n == 2) tmp = vec4(0x0903, 0x6016, 0x3200, 0x0000);  // IC V2
        fragColor = vec4tochar(x, tmp);
    }
    if (y == 3) {
        int n = x / 8;
        vec4 tmp;
        if (n == 0) tmp = vec4(0x6036, 0x340B, 0x6012, 0x010D); //  64K RAM
        if (n == 1) tmp = vec4(0x6013, 0x1913, 0x1405, 0x0D60); //  SYSTEM 
        if (n == 2) tmp = vec4(0x6033, 0x3839, 0x3131, 0x6002); //  38911 B
        if (n == 3) tmp = vec4(0x0113, 0x0903, 0x6002, 0x1914); // ASIC BYT
        if (n == 4) tmp = vec4(0x0513, 0x6006, 0x1205, 0x0560); // ES FREE
        fragColor = vec4tochar(x, tmp);
    }
}

int key = -1;
int scroll = 0;

void NL() {
   memory[CURSOR].x = 0.0;
   memory[CURSOR].y += 1.0;
   if (memory[CURSOR].y >= 20.0) {
       scroll += 1;
       memory[CURSOR].y -= 1.0;
   }
}

void putc(int c) {
    key = c;
    memory[CURSOR].x += 1.0;
    if (memory[CURSOR].x > 40.0) NL();
}

int screen_pos(vec4 v) {
    int x = int(v.x + 0.5);
    int y = int(v.y + 0.5);
    return x + y * 40;
}

vec4 peek(int x, int y) {
    return texelFetch(iChannel0, ivec2(x, y), 0 );
}

vec4 peek(int pos) {
    int y = pos / 40;
    int x = pos - y * 40;
    return peek(x, y);
}

vec4 itoa(int x, int p) {
	int c = 96;
    int len = 1;
    if (x > 9) len = 2;
    if (x > 99) len = 3;
    if (p < len) {
        int power10 = 1;
        if (len - p == 2) power10 = 10;
        if (len - p == 3) power10 = 100;
        c = 48 + int(mod(float(x / power10), 10.0));        
    }
    return vec4(c, 14, 6, 0);
}

int copy_from;
int copy_to;
int copy_length;

#define MSG_SYNTAX_ERROR -1
#define MSG_READY -2
#define MSG_ZERO -3
#define MSG_BREAK -4

void copy(int pos, inout vec4 tmp) {
    int c = pos - copy_to;
    if (c >= 0 && c < copy_length) {
        tmp = vec4(0,0,0,0);
        if (copy_from == MSG_SYNTAX_ERROR) {
            vec4 ch;
            if (c / 8 == 0)
              ch = vec4(0x3F13, 0x190E, 0x1401, 0x1860);  // ?SYNTAX 
            if (c / 8 == 1)
              ch = vec4(0x6005, 0x1212, 0x0F12, 0x0000);  // ERROR
            tmp = vec4tochar(c, ch);
        } else if (copy_from == MSG_READY) {
            vec4 ch = vec4(0x1205, 0x0104, 0x192E, 0);
            tmp = vec4tochar(c, ch) ; 
        } else if (copy_from == MSG_ZERO) {
            tmp = vec4(0);
        } else if (copy_from == MSG_BREAK) {
            vec4 ch;
            if (c < 8)
              tmp = vec4tochar(c, vec4(0x0212, 0x0501, 0x0B60, 0x090E));  // BREAK IN
            if (c == 8)
              tmp = vec4(96, 14, 6, 0);
            if (c > 8)
              tmp = itoa(int(memory[STATE].y), c - 9);
        } else {
	        tmp = peek(copy_from + c);
            if (tmp.x >= 128.0) tmp.x -= 128.0;
        }
    }
}

void memcpy(int dst, int src, int len) {
    copy_from = src;
    copy_to = dst;
    copy_length = len;
}


void print(int msg, int msg_len) {
    NL();
    memcpy(screen_pos(memory[CURSOR]) - 40, msg, msg_len);
}

void list() {
      memory[STATE].x = float(STATE_LISTING);
      memory[STATE].y = float(0);
}

int getchar(int x, int y) {
    int c = int(peek(x, y).x);
    if (c > 128) c -= 128;
    return c;
}

int getchar(int pos) {
    int c = int(peek(pos).x);
    if (c > 128) c -= 128;
    return c;
}

void skipwhite(inout int pos) {
    int c = getchar(pos);
    if (c == 96) pos = pos + 1;    
    c = getchar(pos);
    if (c == 96) pos = pos + 1;    
    c = getchar(pos);
    if (c == 96) pos = pos + 1;    
}

bool strtod(inout int pos, inout int value) {
  skipwhite(pos);
  int c = getchar(pos);
  int num = c - 48;
  if (num < 0 || num > 9) return false;
  value = num;
  pos = pos + 1;
  c = getchar(pos);
  num = c - 48;
  if (num < 0 || num > 9) return true;
  value = value * 10 + num;
  pos = pos + 1;
  c = getchar(pos);
  num = c - 48;
  if (num < 0 || num > 9) return true;
  value = value * 10 + num;
  return true;  
}

void skipnum(inout int pos) {
    int value;
    strtod(pos, value);
}

void parse(int pos) {
    skipwhite(pos);
    int c1 = getchar(pos);
    int c2 = getchar(pos + 1);
    int c3 = getchar(pos + 2);
    int c4 = getchar(pos + 3);
    if (c1 == 12 && c2 == 9 && c3 == 19 && c4 == 20) { // list
        list();
        
    } else if (c1 == 18 && c2 == 21 && c3 == 14) { // run
        memory[STATE].x = float(STATE_RUNNING);
        int line = 0;
        int p = pos + 3;
        strtod(p, line);
        memory[STATE].y = float(line);
    } else if (c1 == 7 && c2 == 15 && c3 == 20 && c2 == 15) { // goto
        memory[STATE].x = float(STATE_RUNNING);
        int line = 0;
        int p = pos + 4;
        strtod(p, line);
        memory[STATE].y = float(line);
    } else if (c1 == 16 && c2 == 18 && c3 == 9 && c4 == 14) {
        // print
        NL();
        int p = pos + 7;
        int len = 0;
        for (int l = 0; l < 33; l++) {
            if (len == 0 && int(peek(p + l).x) == 34)
                len = l;
        }
        
        memcpy(screen_pos(memory[CURSOR]) - 40, pos + 7, len);
    } else if (c1 == 96 && c2 == 96 && c3 == 96 && c4 == 96) {
        // Do nothing
    } else {
        int value = 0;
        int p = pos;
        if (strtod(p, value)) {
            if (getchar(p) == 96 && getchar(p+1) == 96 && getchar(p+2) == 96) {
				memcpy((LINE_ZERO + value) * 40, MSG_ZERO, 10);
            } else {
	          memcpy((LINE_ZERO + value) * 40, pos, 40);
            }
        } else {
          NL();
          NL();
          // ?SYNTAX ERROR
          memcpy(screen_pos(memory[CURSOR]) - 40, MSG_SYNTAX_ERROR, 14);
          memory[STATE].x = float(STATE_PRINT_READY);
        }
    }
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    copy_length = 0;
	int x = int(fragCoord.x);
    int y = int(fragCoord.y);
    if (x > 40 && y > 25) discard;
    
    if (iFrame < 3) {
    	memory[CURSOR] = vec4(0, 5, 0, 0);
        memory[STATE].x = float(STATE_PRINT_READY);
    } else {
	    for (int i = 0; i < MEMORY; i++) {
    		memory[i] = peek(i + 40, 0);
            old_memory[i] = memory[i];
   		}
    } 

    fragColor = peek(x, y);

    if (memory[STATE].x == float(STATE_LISTING)) {
        int line = int(memory[STATE].y);
        memory[STATE].x = float(STATE_PRINT_READY_NL);
        
        for (int i = 0; i < 50; i++) {
            if (getchar(0, LINE_ZERO + line + i) != 0) {
                memory[STATE].x = float(STATE_LISTING);
                memory[STATE].y = float(line + i + 1);
                NL();
                memcpy(screen_pos(memory[CURSOR]) - 40, 40 * (LINE_ZERO + line + i), 40);
                break;
            }
        }
    } else if (memory[STATE].x == float(STATE_RUNNING)) {
        bool esc = texture(iChannel1, vec2(27.5 / 256.0, 0.5/3.0)).x > 0.5;
        if (esc) {
            NL();
            memory[STATE].x = float(STATE_BREAK);
        } else {
           	int line = int(memory[STATE].y);
	        memory[STATE].x = float(STATE_PRINT_READY_NL);
        
    	    for (int i = 0; i < 50; i++) {
        	    if (getchar(0, LINE_ZERO + line + i) != 0) {
            	    memory[STATE].x = float(STATE_RUNNING);
                	memory[STATE].y = float(line + i + 1);
    	            int pos = 40 * (LINE_ZERO + line + i);
	                skipnum(pos);
        	        parse(pos);
            	    break;
        	    }
     	   }
        }
    } else if (memory[STATE].x == float(STATE_BREAK)) {
  		memory[STATE].x = float(STATE_PRINT_READY);
        print(MSG_BREAK, 12);
    } else if (memory[STATE].x == float(STATE_PRINT_READY)) {
  		memory[STATE].x = float(STATE_READY);
        print(MSG_READY, 6);
    } else if (memory[STATE].x == float(STATE_PRINT_READY_NL)) {
  		memory[STATE].x = float(STATE_READY);
        NL();
        print(MSG_READY, 6);
    } else {
 	   bool shift = texture(iChannel1, vec2(16.5 / 256.0, 0.5/3.0)).x > 0.5;

    	for (int key = 0; key < 64; key++) {
        	float key_val = texture(iChannel1, vec2((float(key) + 32.5)/256.0, 0.5)).x;
	        if (key_val > 0.6) {
    	        if (key > 32)
        	        putc(key - 32 + (shift ? 64 : 0));
            	else if (key == 0)
                	putc(96);
	            else if (key >= 16)
    	            putc(key + 32 + (shift ? -16 : 0));
        	}
 	   }
    
  	  if (texture(iChannel1, vec2(13.5/256.0, 0.5)).x > 0.6) {
          int y = int(memory[CURSOR].y);
    	    NL();
     	   parse(y * 40);
  	      // Enter
  	  }
        if (texture(iChannel1, vec2(8.5/256.0, 0.5)).x > 0.6) {
            int x = int(memory[CURSOR].x);
            if (x > 0) {
                x = x - 1;
                int p = screen_pos(memory[CURSOR]);
                memcpy(p - 1, p, 40 - x);
                memory[CURSOR].x = float(x);
            }
        }
    }
     
    if (x >= 0 && x < 40 && y >=0 && y < 20) {
      if (iFrame < 2) {
        init_screen(fragColor, x, y);
        return;
      }
      fragColor = peek(x, y + scroll);
      int sp = x + y * 40;
      
      if (sp + 40 * scroll == screen_pos(old_memory[CURSOR])) {
          fragColor.x = mod(fragColor.x, 128.0);
          if (key != -1)
          {
              fragColor.x = float(key);
          }
      }

      if (sp == screen_pos(memory[CURSOR])) {
          if (fract(iTime) > 0.5) {
            fragColor.x += 128.0;
         }
      }
      copy(sp, fragColor);
      return;
    }
    copy(x + y * 40, fragColor);
    if (x >= 0 && x < 40 && y >= 20 && y <= 25) {
       fragColor = vec4(96, 14, 6, 0);
    }
    if (y == 0) {
 		for (int i = 0; i < MEMORY; i++) {
 	    	if (i + 40 == x) {
				fragColor = memory[i];
            	return;
          	}
        }
    }
}
`;

const fragment = `
highp vec4 font2(int c) {
  vec4 v = vec4(0);
  v=mix(v, vec4(0x3c66, 0x6e6e, 0x6062, 0x3c00), step(-0.500, float(c)));
  v=mix(v, vec4(0x183c, 0x667e, 0x6666, 0x6600), step(0.500, float(c)));
  v=mix(v, vec4(0x7c66, 0x667c, 0x6666, 0x7c00), step(1.500, float(c)));
  v=mix(v, vec4(0x3c66, 0x6060, 0x6066, 0x3c00), step(2.500, float(c)));
  v=mix(v, vec4(0x786c, 0x6666, 0x666c, 0x7800), step(3.500, float(c)));
  v=mix(v, vec4(0x7e60, 0x6078, 0x6060, 0x7e00), step(4.500, float(c)));
  v=mix(v, vec4(0x7e60, 0x6078, 0x6060, 0x6000), step(5.500, float(c)));
  v=mix(v, vec4(0x3c66, 0x606e, 0x6666, 0x3c00), step(6.500, float(c)));
  v=mix(v, vec4(0x6666, 0x667e, 0x6666, 0x6600), step(7.500, float(c)));
  v=mix(v, vec4(0x3c18, 0x1818, 0x1818, 0x3c00), step(8.500, float(c)));
  v=mix(v, vec4(0x1e0c, 0xc0c, 0xc6c, 0x3800), step(9.500, float(c)));
  v=mix(v, vec4(0x666c, 0x7870, 0x786c, 0x6600), step(10.500, float(c)));
  v=mix(v, vec4(0x6060, 0x6060, 0x6060, 0x7e00), step(11.500, float(c)));
  v=mix(v, vec4(0x6377, 0x7f6b, 0x6363, 0x6300), step(12.500, float(c)));
  v=mix(v, vec4(0x6676, 0x7e7e, 0x6e66, 0x6600), step(13.500, float(c)));
  v=mix(v, vec4(0x3c66, 0x6666, 0x6666, 0x3c00), step(14.500, float(c)));
  v=mix(v, vec4(0x7c66, 0x667c, 0x6060, 0x6000), step(15.500, float(c)));
  v=mix(v, vec4(0x3c66, 0x6666, 0x663c, 0xe00), step(16.500, float(c)));
  v=mix(v, vec4(0x7c66, 0x667c, 0x786c, 0x6600), step(17.500, float(c)));
  v=mix(v, vec4(0x3c66, 0x603c, 0x666, 0x3c00), step(18.500, float(c)));
  v=mix(v, vec4(0x7e18, 0x1818, 0x1818, 0x1800), step(19.500, float(c)));
  v=mix(v, vec4(0x6666, 0x6666, 0x6666, 0x3c00), step(20.500, float(c)));
  v=mix(v, vec4(0x6666, 0x6666, 0x663c, 0x1800), step(21.500, float(c)));
  v=mix(v, vec4(0x6363, 0x636b, 0x7f77, 0x6300), step(22.500, float(c)));
  v=mix(v, vec4(0x6666, 0x3c18, 0x3c66, 0x6600), step(23.500, float(c)));
  v=mix(v, vec4(0x6666, 0x663c, 0x1818, 0x1800), step(24.500, float(c)));
  v=mix(v, vec4(0x7e06, 0xc18, 0x3060, 0x7e00), step(25.500, float(c)));
  v=mix(v, vec4(0x3c30, 0x3030, 0x3030, 0x3c00), step(26.500, float(c)));
  v=mix(v, vec4(0xc12, 0x307c, 0x3062, 0xfc00), step(27.500, float(c)));
  v=mix(v, vec4(0x3c0c, 0xc0c, 0xc0c, 0x3c00), step(28.500, float(c)));
  v=mix(v, vec4(0x18, 0x3c7e, 0x1818, 0x1818), step(29.500, float(c)));
  v=mix(v, vec4(0x10, 0x307f, 0x7f30, 0x1000), step(30.500, float(c)));
  v=mix(v, vec4(0x0, 0x0, 0x0, 0x0), step(31.500, float(c)));
  v=mix(v, vec4(0x1818, 0x1818, 0x0, 0x1800), step(32.500, float(c)));
  v=mix(v, vec4(0x6666, 0x6600, 0x0, 0x0), step(33.500, float(c)));
  v=mix(v, vec4(0x6666, 0xff66, 0xff66, 0x6600), step(34.500, float(c)));
  v=mix(v, vec4(0x183e, 0x603c, 0x67c, 0x1800), step(35.500, float(c)));
  v=mix(v, vec4(0x6266, 0xc18, 0x3066, 0x4600), step(36.500, float(c)));
  v=mix(v, vec4(0x3c66, 0x3c38, 0x6766, 0x3f00), step(37.500, float(c)));
  v=mix(v, vec4(0x60c, 0x1800, 0x0, 0x0), step(38.500, float(c)));
  v=mix(v, vec4(0xc18, 0x3030, 0x3018, 0xc00), step(39.500, float(c)));
  v=mix(v, vec4(0x3018, 0xc0c, 0xc18, 0x3000), step(40.500, float(c)));
  v=mix(v, vec4(0x66, 0x3cff, 0x3c66, 0x0), step(41.500, float(c)));
  v=mix(v, vec4(0x18, 0x187e, 0x1818, 0x0), step(42.500, float(c)));
  v=mix(v, vec4(0x0, 0x0, 0x18, 0x1830), step(43.500, float(c)));
  v=mix(v, vec4(0x0, 0x7e, 0x0, 0x0), step(44.500, float(c)));
  v=mix(v, vec4(0x0, 0x0, 0x18, 0x1800), step(45.500, float(c)));
  v=mix(v, vec4(0x3, 0x60c, 0x1830, 0x6000), step(46.500, float(c)));
  v=mix(v, vec4(0x3c66, 0x6e76, 0x6666, 0x3c00), step(47.500, float(c)));
  v=mix(v, vec4(0x1818, 0x3818, 0x1818, 0x7e00), step(48.500, float(c)));
  v=mix(v, vec4(0x3c66, 0x60c, 0x3060, 0x7e00), step(49.500, float(c)));
  v=mix(v, vec4(0x3c66, 0x61c, 0x666, 0x3c00), step(50.500, float(c)));
  v=mix(v, vec4(0x60e, 0x1e66, 0x7f06, 0x600), step(51.500, float(c)));
  v=mix(v, vec4(0x7e60, 0x7c06, 0x666, 0x3c00), step(52.500, float(c)));
  v=mix(v, vec4(0x3c66, 0x607c, 0x6666, 0x3c00), step(53.500, float(c)));
  v=mix(v, vec4(0x7e66, 0xc18, 0x1818, 0x1800), step(54.500, float(c)));
  v=mix(v, vec4(0x3c66, 0x663c, 0x6666, 0x3c00), step(55.500, float(c)));
  v=mix(v, vec4(0x3c66, 0x663e, 0x666, 0x3c00), step(56.500, float(c)));
  v=mix(v, vec4(0x0, 0x1800, 0x18, 0x0), step(57.500, float(c)));
  v=mix(v, vec4(0x0, 0x1800, 0x18, 0x1830), step(58.500, float(c)));
  v=mix(v, vec4(0xe18, 0x3060, 0x3018, 0xe00), step(59.500, float(c)));
  v=mix(v, vec4(0x0, 0x7e00, 0x7e00, 0x0), step(60.500, float(c)));
  v=mix(v, vec4(0x7018, 0xc06, 0xc18, 0x7000), step(61.500, float(c)));
  v=mix(v, vec4(0x3c66, 0x60c, 0x1800, 0x1800), step(62.500, float(c)));
  v=mix(v, vec4(0x0, 0xff, 0xff00, 0x0), step(63.500, float(c)));
  v=mix(v, vec4(0x81c, 0x3e7f, 0x7f1c, 0x3e00), step(64.500, float(c)));
  v=mix(v, vec4(0x1818, 0x1818, 0x1818, 0x1818), step(65.500, float(c)));
  v=mix(v, vec4(0x0, 0xff, 0xff00, 0x0), step(66.500, float(c)));
  v=mix(v, vec4(0x0, 0xffff, 0x0, 0x0), step(67.500, float(c)));
  v=mix(v, vec4(0xff, 0xff00, 0x0, 0x0), step(68.500, float(c)));
  v=mix(v, vec4(0x0, 0x0, 0xffff, 0x0), step(69.500, float(c)));
  v=mix(v, vec4(0x3030, 0x3030, 0x3030, 0x3030), step(70.500, float(c)));
  v=mix(v, vec4(0xc0c, 0xc0c, 0xc0c, 0xc0c), step(71.500, float(c)));
  v=mix(v, vec4(0x0, 0xe0, 0xf038, 0x1818), step(72.500, float(c)));
  v=mix(v, vec4(0x1818, 0x1c0f, 0x700, 0x0), step(73.500, float(c)));
  v=mix(v, vec4(0x1818, 0x38f0, 0xe000, 0x0), step(74.500, float(c)));
  v=mix(v, vec4(0xc0c0, 0xc0c0, 0xc0c0, 0xffff), step(75.500, float(c)));
  v=mix(v, vec4(0xc0e0, 0x7038, 0x1c0e, 0x703), step(76.500, float(c)));
  v=mix(v, vec4(0x307, 0xe1c, 0x3870, 0xe0c0), step(77.500, float(c)));
  v=mix(v, vec4(0xffff, 0xc0c0, 0xc0c0, 0xc0c0), step(78.500, float(c)));
  v=mix(v, vec4(0xffff, 0x303, 0x303, 0x303), step(79.500, float(c)));
  v=mix(v, vec4(0x3c, 0x7e7e, 0x7e7e, 0x3c00), step(80.500, float(c)));
  v=mix(v, vec4(0x0, 0x0, 0xff, 0xff00), step(81.500, float(c)));
  v=mix(v, vec4(0x367f, 0x7f7f, 0x3e1c, 0x800), step(82.500, float(c)));
  v=mix(v, vec4(0x6060, 0x6060, 0x6060, 0x6060), step(83.500, float(c)));
  v=mix(v, vec4(0x0, 0x7, 0xf1c, 0x1818), step(84.500, float(c)));
  v=mix(v, vec4(0xc3e7, 0x7e3c, 0x3c7e, 0xe7c3), step(85.500, float(c)));
  v=mix(v, vec4(0x3c, 0x7e66, 0x667e, 0x3c00), step(86.500, float(c)));
  v=mix(v, vec4(0x1818, 0x6666, 0x1818, 0x3c00), step(87.500, float(c)));
  v=mix(v, vec4(0x606, 0x606, 0x606, 0x606), step(88.500, float(c)));
  v=mix(v, vec4(0x81c, 0x3e7f, 0x3e1c, 0x800), step(89.500, float(c)));
  v=mix(v, vec4(0x1818, 0x18ff, 0xff18, 0x1818), step(90.500, float(c)));
  v=mix(v, vec4(0xc0c0, 0x3030, 0xc0c0, 0x3030), step(91.500, float(c)));
  v=mix(v, vec4(0x1818, 0x1818, 0x1818, 0x1818), step(92.500, float(c)));
  v=mix(v, vec4(0x0, 0x33e, 0x7636, 0x3600), step(93.500, float(c)));
  v=mix(v, vec4(0xff7f, 0x3f1f, 0xf07, 0x301), step(94.500, float(c)));
  v=mix(v, vec4(0x0, 0x0, 0x0, 0x0), step(95.500, float(c)));
  v=mix(v, vec4(0xf0f0, 0xf0f0, 0xf0f0, 0xf0f0), step(96.500, float(c)));
  v=mix(v, vec4(0x0, 0x0, 0xffff, 0xffff), step(97.500, float(c)));
  v=mix(v, vec4(0xff00, 0x0, 0x0, 0x0), step(98.500, float(c)));
  v=mix(v, vec4(0x0, 0x0, 0x0, 0xff), step(99.500, float(c)));
  v=mix(v, vec4(0xc0c0, 0xc0c0, 0xc0c0, 0xc0c0), step(100.500, float(c)));
  v=mix(v, vec4(0xcccc, 0x3333, 0xcccc, 0x3333), step(101.500, float(c)));
  v=mix(v, vec4(0x303, 0x303, 0x303, 0x303), step(102.500, float(c)));
  v=mix(v, vec4(0x0, 0x0, 0xcccc, 0x3333), step(103.500, float(c)));
  v=mix(v, vec4(0xfffe, 0xfcf8, 0xf0e0, 0xc080), step(104.500, float(c)));
  v=mix(v, vec4(0x303, 0x303, 0x303, 0x303), step(105.500, float(c)));
  v=mix(v, vec4(0x1818, 0x181f, 0x1f18, 0x1818), step(106.500, float(c)));
  v=mix(v, vec4(0x0, 0x0, 0xf0f, 0xf0f), step(107.500, float(c)));
  v=mix(v, vec4(0x1818, 0x181f, 0x1f00, 0x0), step(108.500, float(c)));
  v=mix(v, vec4(0x0, 0xf8, 0xf818, 0x1818), step(109.500, float(c)));
  v=mix(v, vec4(0x0, 0x0, 0x0, 0xffff), step(110.500, float(c)));
  v=mix(v, vec4(0x0, 0x1f, 0x1f18, 0x1818), step(111.500, float(c)));
  v=mix(v, vec4(0x1818, 0x18ff, 0xff00, 0x0), step(112.500, float(c)));
  v=mix(v, vec4(0x0, 0xff, 0xff18, 0x1818), step(113.500, float(c)));
  v=mix(v, vec4(0x1818, 0x18f8, 0xf818, 0x1818), step(114.500, float(c)));
  v=mix(v, vec4(0xc0c0, 0xc0c0, 0xc0c0, 0xc0c0), step(115.500, float(c)));
  v=mix(v, vec4(0xe0e0, 0xe0e0, 0xe0e0, 0xe0e0), step(116.500, float(c)));
  v=mix(v, vec4(0x707, 0x707, 0x707, 0x707), step(117.500, float(c)));
  v=mix(v, vec4(0xffff, 0x0, 0x0, 0x0), step(118.500, float(c)));
  v=mix(v, vec4(0xffff, 0xff00, 0x0, 0x0), step(119.500, float(c)));
  v=mix(v, vec4(0x0, 0x0, 0xff, 0xffff), step(120.500, float(c)));
  v=mix(v, vec4(0x303, 0x303, 0x303, 0xffff), step(121.500, float(c)));
  v=mix(v, vec4(0x0, 0x0, 0xf0f0, 0xf0f0), step(122.500, float(c)));
  v=mix(v, vec4(0xf0f, 0xf0f, 0x0, 0x0), step(123.500, float(c)));
  v=mix(v, vec4(0x1818, 0x18f8, 0xf800, 0x0), step(124.500, float(c)));
  v=mix(v, vec4(0xf0f0, 0xf0f0, 0x0, 0x0), step(125.500, float(c)));
  v=mix(v, vec4(0xf0f0, 0xf0f0, 0xf0f, 0xf0f), step(126.500, float(c)));
  return v;
}

highp vec4 font(int c) {
    if (c < 128) return font2(c);
    return vec4(0xffff) - font2(c - 128);
}

vec4 colors(int c) {
    if (c ==  0) return vec4(0x00,0x00,0x00,1);
    if (c ==  1) return vec4(0xFF,0xFF,0xFF,1);
    if (c ==  2) return vec4(0x68,0x37,0x2B,1);
    if (c ==  3) return vec4(0x70,0xA4,0xB2,1);
    if (c ==  4) return vec4(0x6F,0x3D,0x86,1);
    if (c ==  5) return vec4(0x58,0x8D,0x43,1);
    if (c ==  6) return vec4(0x35,0x28,0x79,1);
    if (c ==  7) return vec4(0xB8,0xC7,0x6F,1);
    if (c ==  8) return vec4(0x6F,0x4F,0x25,1);
    if (c ==  9) return vec4(0x43,0x39,0x00,1);
    if (c == 10) return vec4(0x9A,0x67,0x59,1);
    if (c == 11) return vec4(0x44,0x44,0x44,1);
    if (c == 12) return vec4(0x6C,0x6C,0x6C,1);
    if (c == 13) return vec4(0x9A,0xD2,0x84,1);
    if (c == 14) return vec4(0x6C,0x5E,0xB5,1);
    if (c == 15) return vec4(0x95,0x95,0x95,1);
    return vec4(0);
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{    
	vec2 uv = fragCoord.xy / iResolution.xy;
    vec2 sz = vec2(40.0, 20.0);
    vec2 fb_pos = floor(uv * sz) + vec2(0.5, 0.5);
    fb_pos.y = sz.y - fb_pos.y;
    fb_pos /= iResolution.xy;
    
	vec4 fb = texture(iChannel0, fb_pos);
    highp vec4 char = font(int(fb.x));

    vec2 p = mod(uv * sz * 8.0, 8.0);
	int line = 7 - int(p.y);
    highp float pixels = 0.0;
    if (line == 0) pixels = char.x / 256.0;
    if (line == 1) pixels = char.x;
    if (line == 2) pixels = char.y / 256.0;
    if (line == 3) pixels = char.y;
    if (line == 4) pixels = char.z / 256.0;
    if (line == 5) pixels = char.z;
    if (line == 6) pixels = char.w / 256.0;
    if (line == 7) pixels = char.w;

    if (mod(pixels * pow(2.0, floor(p.x)), 256.0) > 127.5) {
        fragColor = colors(int(fb.y)) / 180.0;
    } else {
        fragColor = colors(int(fb.z)) / 180.0;
    }
    fragColor.a = 1.;
}
`;

export default class implements iSub {
  key(): string {
    return 'Xs3XW4';
  }
  name(): string {
    return 'Commodore 64';
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
    return [{ type: 1, f: buffA, fi: 0 }];
  }
}
