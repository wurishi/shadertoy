import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const f = `
//comment this for a 3 move look ahead (which seems one less buggy)
#define FOURMOVES

//The idea was to flatten a min-max search tree by assigning each pixel a series of moves to attempt.
//That idea went south pretty fast but I was able to cram a 4 move look ahead in one frame.
//Thats 146410000 moves analyzed in 83187.5 pixels!
//What follows is a bunch of hideous 24 bit, bit manipulation of vec4 structures. 
//... like freezing your GPU and using it as a hammer. Enjoy!  
#define KEY_RIGHT 37.
#define KEY_UP 38.
#define KEY_LEFT 39.
#define KEY_DOWN 40.
#define PAWN 1.
#define ROOK 4.
#define KNIGHT 3.
#define BISHOP 5.
#define QUEEN 2.
#define KING 15.
#define ILLEGAL -32.
#define MOVES 110.
#define wid 8.
#define zero 0.
#define one 1.
#define two 2.
#define get(v) texture(iChannel0,(v+vec2(.5))/iResolution.xy)
#define same(x,y) all(equal(x,y))
#define STATEVEC vec2(iResolution.x-one,iResolution.y-one)
#define ENDFRAME 9.
#define ssgn(x) ((x)-.1>0.?1.:(x)+.1<0.?-1.:0.)
#define FL(x) floor((x)+.5)
#define VEC2ID(U) (U.y*iResolution.x+U.x-7.)*16.
#define NOSEL 2056.
//packed board, pieces and moves
vec4 B[4],P[3],M[14];
void Init(){
  B[0]=vec4(274759,1589376,3199887,2134667);B[1]=vec4(4260880,4260880,4260880,4260880);
  B[2]=vec4(4260880,4260880,4260880,4260880);B[3]=vec4(5321873,6387093,8247001,6932384);
  P[0]=vec4(328452,67074,983047,789774);P[1]=vec4(592395,3145736,3355185,3552564);
  P[2]=vec4(4143159,3817017,3947325,0);//B=pc6,  P=x3,y3,dead2,  M=pc4,dx4,dy4
  M[0]=vec4(5309728,5379376,5444881,5317922);M[1]=vec4(5387570,5453075,5326116,5395764); 
  M[2]=vec4(5461269,5334310,5403958,5469463);M[3]=vec4(2589288,2720392,2851496,2982600);
  M[4]=vec4(7505448,9603112,11700776,13798440);M[5]=vec4(2593385,2724489,2855593,2986697);
  M[6]=vec4(7509545,9607209,11704873,13802537);M[7]=vec4(3449914,237898,1089562,4301578);
  M[8]=vec4(3454011,241995,1093659,4305675);M[9]=vec4(3392812,1163580,4375324,2409548);
  M[10]=vec4(180300,2146316,5428236,1299261);M[11]=vec4(3264797,4510765,315981,53293);
  M[12]=vec4(4248077,1303358,3268894,3404591);M[13]=vec4(1307199,1175855,3273247,2228768);
}
bool Key(in float key){return (texture(iChannel1,vec2((key+0.5)/256.0, 0.25)).x>0.0);}
void loadBoard(){for(int i=0;i<4;i++)B[i]=get(vec2(i,0));}//load to edit
void loadPieces(){for(int i=0;i<3;i++)P[i]=get(vec2(i+4,0));}
vec4 gB(float i){return i<1.?B[0]:i<2.?B[1]:i<3.?B[2]:B[3];}//hacks for const array index
vec4 gP(float i){return i<1.?P[0]:i<2.?P[1]:P[2];}
float gC(float i,vec4 b){return i<1.?b.x:i<2.?b.y:i<3.?b.z:b.w;}//get channel
float gb(float c, float start, float bits){return mod(floor(c/pow(two,start)),pow(two,bits));}//get bits
#define sb(f,s,b,v) f+=(v-gb(f,s,b))*pow(two,s)
//set the bits of a vec4 field (xyzw), should be sb(B[m][n].. but for loop "constants" don't work on fields
void sVb(inout vec4 b, float field, float start, float bits, float value){//yuk
  if(field<1.)sb(b.x,start,bits,value); //i love a good hack, this isn't one of them
  else if(field<2.)sb(b.y,start,bits,value);
  else if(field<3.)sb(b.z,start,bits,value);
  else sb(b.w,start,bits,value);
}
float pc2s(float b){//piece#(1-16) to score/type (scores must be unique as they are reused as type)
  float ab=abs(b),s=16.;
  if(ab<9.)s=PAWN;
  else if(ab<11.)s=ROOK;
  else if(ab<13.)s=KNIGHT;
  else if(ab<15.)s=BISHOP;
  else if(ab<16.)s=QUEEN;
  return s*sign(b);
}
float getB(vec2 v){//unpack 6 bits per cell, 4 cells per float, 16 cells per pixel
  v=FL(v);
  vec2 av=abs(v-vec2(3.5));if(max(av.x,av.y)>4.)return ILLEGAL;
  float cell=v.y*8.+v.x;
  vec4 b=gB(cell/16.);
  float c=gC(mod(cell/4.,4.),b);
  return gb(c,mod(cell,4.)*6.,6.)-16.;
}
void putB(float pc, vec2 v){//repackage yikes! webgl didn't expect this
  pc=floor(pc+16.5);v=FL(v);
  vec2 av=abs(v-vec2(3.5));if(max(av.x,av.y)>4.)return;// ILLEGAL
  float cell=v.y*8.+v.x;
  int i=int(cell/16.);
  float c=mod(cell/4.,4.),start=mod(cell,4.)*6.;
  //sb(B[i][int(c)],start,6.,pc);//when var index is allowed (outside webgl) this should work but doesn't!
  for(int n=0;n<4;n++)if(n==i){  //the field index requires a TRUE constant (not even a for loop works)
    sVb(B[n],c,start,6.,pc);return; //when passing inout
  }
}
vec2 getP(float pc){//get a piece's position, unpack 3 bits x, 3 y and 2 status (dead)
  pc=floor(pc+16.5);
  vec4 b=gP(pc/12.);
  float c=gC(mod(pc/3.,4.),b);
  float start=mod(pc,3.)*8.;
  float dead=gb(c,start+6.,1.);
  if(dead>0.)return vec2(-2);
  return vec2(gb(c,start,3.),gb(c,start+3.,3.));
}
void putP(float pc, vec2 p){//update a piece
  pc=floor(pc+16.5);p=FL(p);//from -16,16 to 0,32
  float f=p.x<0.?64.:p.x+8.*p.y;//value to store
  int i=int(pc/12.);
  float start=mod(pc,3.)*8.,c=mod(pc/3.,4.);
  for(int n=0;n<3;n++)if(n==i){sVb(P[n],c,start,7.,f);return;}
}
void putBP(float pc, vec2 v){putB(pc,v);putP(pc,v);}//why not do both
vec3 getM(float id){id=floor(id);//unpack move, 4 bits piece #, 4 delta x, 4 delta y
  int i=int(id/8.);float j=mod(id/2.,4.),start=mod(id,2.)*12.;//vec4,chan,startbit
  for(int n=0;n<14;n++)if(n==i){
    float c=gC(j,M[n]);
    return vec3(gb(c,start,4.)+1.,gb(c,start+4.,4.)-2.,gb(c,start+8.,4.)-2.);
  }
  return vec3(ILLEGAL);
}
float getS(float id){//unpack a 6 bit score, each pixel holds 16 scores for series of moves
  float pid=floor(id/16.)+7.;
  vec4 b=get(vec2(mod(pid,iResolution.x),floor(pid/iResolution.x)));//pixel
  float c=gC(mod(id/4.,4.),b);//channel
  return gb(c,mod(id,4.)*6.,6.)-32.;//bits
}
vec4 bestLvlScore(float p, vec2 U, float lvl){//the minmax part
  float bs=ILLEGAL*-p,bid=0.;//player -1 wants high score
  for(float i=0.;i<MOVES;i+=one){
    float s;
    if(lvl==two)s=getS(U.x*MOVES+(U.y-1.)*(MOVES*MOVES)+i);
    else{
      vec2 v=vec2(i,U.y);if(lvl==0.)v=vec2(0.,i+1.);
      s=get(v).x;
    }
    if(abs(s)>31.)continue;//illegal move
    float rs=sin(iTime+i)+s;
    if((p>0. && rs<bs) || (p<0. && rs>bs)){bs=s;bid=i;}
  }
  return vec4(bs,bid,0,0);
}

float legalS(float t, float p, vec2 p1, vec2 p2){//is the move legal and was a piece captured?
  if(p2.x<zero||p2.x>=wid||p2.y<zero||p2.y>wid)return ILLEGAL;//off board
  if(same(p1,p2))return ILLEGAL;
  float cap=getB(p2);
  if(cap!=zero){//not empty 
    if(sign(cap)==p)return ILLEGAL;//landed on own piece  
  }//cap=abs(cap);
  if(t!=PAWN && t!=ROOK)return cap;//these cannot be blocked and have no special rules
  if(t==PAWN){//pawn needs special checks for diag capture
    vec2 a=abs(p2-p1);
    if((a.x==one && cap==zero) || (a.x==zero && cap!=zero))return ILLEGAL;//only captures diag 
    else return cap;
  }
  vec2 d=vec2(ssgn(p2.x-p1.x),ssgn(p2.y-p1.y)),w=p1+d;
  for(int i=0;i<8;i++){//that leaves the rook that can be blocked (this works for chess bishops/queens as well)
    if(same(w,p2))break;//not blocked
    if(getB(w)!=zero)return ILLEGAL;//blocked
    w+=d;
  }
  return cap;
}
float legalC(float t, float p, vec2 p1, vec2 p2){//check the human more carefully
  float cap=legalS(t,p,p1,p2);
  if(cap==ILLEGAL) return cap;//this covers offboard, cap own piece, blocked
  vec2 a=abs(p2-p1);
  float dy=p2.y-p1.y,mna=min(a.x,a.y),mxa=max(a.x,a.y);
  if(t==PAWN){if(dy!=-p || a.x>1.)return ILLEGAL;}//capture handled in legalS
  else if(t==ROOK){if(mna>0.)return ILLEGAL;}
  else if(t==KNIGHT){if(mxa!=2. || mna != 1.)return ILLEGAL;}
  else if(t==BISHOP){if(mxa>2. || (a.x==1. && a.y==0.) || (a.x==0. && dy==p) || (mna>0. && a.x!=a.y))return ILLEGAL;}
  else if(t==QUEEN){if(mna==0. || mxa>1.)return ILLEGAL;}
  else if(mxa>1.)return ILLEGAL;//king
  return cap;
}
vec3 getLvlMove(float id, int lvl){return getM(mod(lvl==2?id:lvl==1?id/MOVES:id/(MOVES*MOVES),MOVES));}
vec2 deltaMove(float p, vec2 p1, vec2 m){//the moves store a delta but some are absolute
  if(m.y==3.)m.y=-p;//move player's forward 
  else if(m.y>=4.)m.y=m.y-4.-p1.y; //rook slides are absolute 
  if(m.x>=4.)m.x=m.x-4.-p1.x;
  return p1+m;
}
float doMove(float p, float id, int lvl){//the id determines a series of moves, do 1
  float score=0.;
  vec3 m=getLvlMove(id,lvl);//get the move for this level from the id (coord)
  if(m.x==ILLEGAL)return ILLEGAL;//not used
  m.x*=p;
  vec2 p1=getP(m.x);//get the position of the piece
  if(p1.x<0.)return ILLEGAL;//end of branch, piece is captured
  vec2 p2=deltaMove(p,p1,m.yz);
  float cap=legalS(abs(pc2s(m.x)),p,p1,p2);
  if(cap==ILLEGAL)return ILLEGAL;//end of branch, bad move
  if(cap!=0.){
    score=pc2s(cap);
    putP(cap,vec2(-2));//wipe piece off board
  }
  putB(0.,p1);putB(m.x,p2);putP(m.x,p2);//remove from old position and set at new
  return score;
}
vec4 doMoves(float player, vec2 U){//p=player -1,1, each pixel holds 16 scores (do a bunch)
  vec4 sc=vec4(0);
  float id=VEC2ID(U);
  if(id>MOVES*MOVES*MOVES)return sc;//returns 16 illegal scores -32
  for(float i=0.;i<16.;i+=one){//the pixel is filled with 16 scores
    loadBoard();loadPieces();//reset the board and pieces
    float p=player,score=0.;
    for(int lvl=0;lvl<3;lvl++){//do a series of moves flipping players and keeping score
      float s=doMove(p,id+i,lvl);
      if(s==ILLEGAL){score=ILLEGAL;break;}else {
        score+=s;
        if(abs(s)==KING)break;//should have better end game now
      }
      p=-p;
    }
    //find worst (min) of next moves for 4th level (play as human)
#ifdef FOURMOVES
    if(abs(score)<KING){//we never made it 4 moves if score==illegal or king taken
      float ws=-ILLEGAL;vec2 p1,p2;
      for(float id=zero;id<MOVES;id+=one){
        vec3 m=getM(id);
        p1=getP(m.x);//player 1 hardcoded
        if(p1.x>=zero){//piece is on board
          p2=deltaMove(1.,p1,m.yz);//player 1 hardcoded
          float cap=legalS(abs(pc2s(m.x)),1.,p1,p2);//cap will be negative
          if(cap!=ILLEGAL && cap!=zero){cap=pc2s(cap);if(cap<ws)ws=cap;}
        }
      }
      if(abs(ws)<31.)score+=ws;
    }
#endif
    sVb(sc,i/4.,mod(i,4.)*6.,6.,score+32.);
  }
  return sc;
}
vec2 getMouseCell(float y){//find clicked on square  
  float viewAng0=gb(y,0.,4.)*0.0625*6.283,viewAng1=0.1+gb(y,4.,4.)*0.0625;
  vec2 uv=(iMouse.xy-0.5*iResolution.xy)/iResolution.x; 
  vec3 rd=normalize(vec3(uv,3.));
  vec3 ro=vec3(sin(viewAng0)*cos(viewAng1),sin(viewAng1),cos(viewAng0)*cos(viewAng1))*33.;
  vec3 fw=normalize(vec3(0.,-0.5,0.)-ro),rt=normalize(cross(fw,vec3(0.0,1.0,0.0))),up=cross(rt,fw);
  rd=mat3(rt,up,fw)*rd;
  float t=(-0.33-ro.y)/rd.y;
  vec2 v=(ro.xz+rd.xz*t);  
  if(max(abs(v.x),abs(v.y))>4.)return vec2(8.); 
  return floor(v+vec2(4.));
}
void mainImage(out vec4 O, vec2 U){
  U=floor(U);Init();
  O=get(U);//maintain pixels by default
  if(same(U,STATEVEC)){//state vector rez.x,viewangles,frame,selections
    if(O.x!=iResolution.x){O.x=iResolution.x;O.y=128.;O.z=zero;O.w=NOSEL;}
    else{//game state loop
      if(O.z==zero || O.z==two){//check for user's selected cells
        if(iMouse.z>0.){//wait for mouse down
          vec2 v=getMouseCell(O.y);
          if(O.z==zero)O.w=NOSEL;//clear selection
          else {//validate move
            loadBoard();
            vec2 p1=vec2(gb(O.w,0.,4.),gb(O.w,4.,4.));
            float pc=getB(p1);if(pc<=0.){O.z=zero;O.w=NOSEL;return;}//clicked empty or black piece
            float cap=legalC(abs(pc2s(pc)),1.,p1,v);
            if(cap==ILLEGAL){O.z=zero;O.w=NOSEL;return;}
          }
          sb(O.w,O.z*4.,8.,v.x+v.y*16.);
          if(v.x<8.)O.z+=one;
        }else if(Key(KEY_DOWN))sb(O.y,4.,4.,clamp(gb(O.y,4.,4.)-one,0.,15.));
        else if(Key(KEY_UP))sb(O.y,4.,4.,clamp(gb(O.y,4.,4.)+one,0.,15.));
        else if(Key(KEY_LEFT))sb(O.y,0.,4.,mod(gb(O.y,0.,4.)-one,16.));//touchy :)
        else if(Key(KEY_RIGHT))sb(O.y,0.,4.,mod(gb(O.y,0.,4.)+one,16.));
      }else if(O.z==one || O.z==3.){//wait for mouse up
        if(iMouse.z<=0.)O.z+=one;
      }else if(O.z<ENDFRAME)O.z+=one;
      else {//loop back to zero
        O.z=zero;
        vec3 m=getM(get(vec2(0,1)).y);loadPieces();
        vec2 p1=getP(-m.x),p2=deltaMove(-1.,p1,m.yz);//player -1 hardcoded
        O.w=p1.x+p1.y*16.+p2.x*256.+p2.y*4096.;//show to/from
      }
    }
    return;//done with state
  }
  vec4 st=get(STATEVEC);
  if(U.y==zero && U.x<7.){//board and pieces
    if(iFrame==0){if(U.x<4.)O=gB(U.x);else O=gP(U.x-4.);}//save setup board and pieces
    else if(st.z==4. || st.z==ENDFRAME){
      loadBoard();loadPieces();//load the board and pieces to edit them
      if(st.z<ENDFRAME){//the users move is packed in st.w
        vec2 p1=vec2(gb(st.w,0.,4.),gb(st.w,4.,4.)),p2=vec2(gb(st.w,8.,4.),gb(st.w,12.,4.));
        float pc=getB(p1),cap=getB(p2);
        if(cap<0.)putP(cap,vec2(-2));//wipe piece from board
        putB(0.,p1);putB(pc,p2);putP(pc,p2);
      }else{//the best silicon move is in vec2(0,1).y
        vec2 id=get(vec2(0,1)).xy;
        float s=doMove(-1.,id.y,2);//do move #id 0-110
        //if(s==ILLEGAL){}//debug
      }
      if(U.x<4.)O=gB(U.x);else O=gP(U.x-4.);//save board and pieces
    }
    return;//done with board and pieces
  }else if(U.y*iResolution.x+U.x-7.>7.*MOVES*MOVES)return;//not used
  if(st.z<5. || st.z>=ENDFRAME)return;//nothing to do
  else if(st.z==5.)O=doMoves(-1.,U);//score the moves
  else if(U.y>=1. && U.y<MOVES+one && U.x<MOVES){//best score box
    float lvl=8.-st.z;//2,1,0
    if(lvl<two && U.x>0.5)return;//just a column of pixels left
    if(lvl<one && U.y>1.5)return;//just 1 pixel left to do the work
    O=bestLvlScore(lvl==one?1.:-1.,U,lvl);//find best moves in 110x110 grid, row then column
  }
}

`;

const fragment = `
//Almost Playable Chaturanga - by eiffie (because you almost want to play Chaturanga don't you)
//Chaturanga is chess before there was chess. I'm not sure of all the rules but following wikipedia...
//ROOKS, KNIGHTS and KINGS move as in chess
//PAWNS move one forward or diagonally forward to capture
//QUEENS just move 1 diagonally (they should probably also move as rooks)
//BISHOPS jump 2 diagonally or orthogonally or move 1 diagonally or 1 forward.

//This is more of an experiment than an actual game. The end game is non-existent.. literally.

#define PAWN 1.
#define ROOK 4.
#define KNIGHT 3.
#define BISHOP 5.
#define QUEEN 2.
#define KING 15.
#define get(v) texture(iChannel0,(v+vec2(.5))/iResolution.xy)
#define STATEVEC vec2(iResolution.x-1.,iResolution.y-1.)

vec4 B[4],sel;//packed board, cell selection
void loadBoard(){//load board into memory
  for(int i=0;i<4;i++)B[i]=get(vec2(i,0));
}
vec4 gB(float i){return i<1.?B[0]:i<2.?B[1]:i<3.?B[2]:B[3];}//hacks for const array index
float gC(float i,vec4 b){return i<1.?b.x:i<2.?b.y:i<3.?b.z:b.w;}
float gb(float c, float start, float bits){return mod(floor(c/pow(2.,start)),pow(2.,bits));}//get bits
float getB(vec2 v){//unpack 6 bits per cell,4 cells per float, 16 cells per pixel
  v=floor(v);
  vec2 av=abs(v-vec2(3.5));//if(max(av.x,av.y)>4.)return -32.;
  float cell=v.y*8.+v.x;
  vec4 b=gB(cell/16.);
  float c=gC(mod(cell/4.,4.),b);
  return gb(c,mod(cell,4.)*6.,6.)-16.;
}
float pc2tp(float b){//piece#(1-16) to score/type (scores must be unique per type)
  b=abs(b);
  if(b<1.)return 0.;
  else if(b<9.)return PAWN;
  else if(b<11.)return ROOK;
  else if(b<13.)return KNIGHT;
  else if(b<15.)return BISHOP;
  else if(b<16.)return QUEEN;
  return KING;
}
vec3 mcol=vec3(0.0); 
float DE(vec3 p0){ 
  vec3 p=vec3(fract(p0.x)-0.5,p0.y,fract(p0.z)-0.5); 
  float mx=0.65-max(abs(p.x),abs(p.z)); 
  if(max(abs(p0.x),abs(p0.z))>4.)return mx; 
  float ts=getB(p0.xz+4.),tp=pc2tp(ts);
  if(tp==0.)return mx;//don't step too far into the next square 
  float f0=0.46,f1=2.7,f2=0.0,f3=0.25,f4=0.66,f5=-1.,f6=2.;//base config 
  float da=1.0,ds=1.0;//bits to add and subtract to the dif type pieces 
  if(tp!=QUEEN && tp<BISHOP){p.y+=0.15;f6*=1.5;} 
  p*=f6;
  float r=length(p.xz); 
  if(p.y>0.8){f5=1.;f0=0.;//swap base for head config 
    if(tp==PAWN || tp==BISHOP){//pawns and bishop 
      f1=3.3;f2=1.1;f3=(tp<4.?.3:.22);f4=1.57; 
      if(tp==PAWN)da=length(p-vec3(0.,1.56,0.))-0.08;//pawn 
      else ds=max(-p.y+1.0,abs(p.z-p.y*0.5+.5)-0.05); 
    }else if(tp==ROOK){//rook 
      f1=2.6;f2=8.;f3=.5;f4=1.3; 
      ds=max(-p.y+1.,min(r-.37,min(abs(p.x),abs(p.z))-0.09)); 
    }else if(tp==QUEEN || tp==KING){//queen and king 
      f1=3.3;f2=0.81;f3=.28;f4=1.3; 
      if(tp==QUEEN){//queen 
        da=length(vec3(abs(p.x)-.19,p.y-1.33,abs(p.z)-.19))-0.1; 
      }else{ 
        da=max(p.y-1.75,min(r-0.02,max(abs(p.x)-.2,length(p.yz-vec2(1.59,0.))-0.02))); 
      } 
    }else{//knight 
      f1=2.,f2=3.4,f3=.31,f4=1.5; 
      float az=abs(p.z)-(p.y-1.)*0.18; 
      da=max(az-.16-p.x*.25,max(abs(p.x+.2-az*.17)-.34,abs(p.y-p.x*.16-1.19-az*.24)-.29-p.x*.16*2.)); 
      ds=min(length(p.xy-vec2(-.53,1.09)),length(p.xy-vec2(0.,1.3)))-.07; 
    } 
  }  
  float d=r-f0+sin(p.y*f1+f2)*f3; 
  d=max(d,p.y*f5-f4); 
  da=min(da,length(max(vec2(r-0.28,abs(p.y-0.8)),0.))-0.05); 
  d=max(min(d,da),-ds); 
  if(mcol.x>0.)mcol+=ts<0.?vec3(0.4,0.45,0.5):vec3(1.); 
  return min(0.8*d/f6,mx); 
} 
vec3 normal(vec3 p, float d){vec2 e=vec2(d,0.);
  return normalize(vec3(DE(p+e.xyy)-DE(p-e.xyy),DE(p+e.yxy)-DE(p-e.yxy),DE(p+e.yyx)-DE(p-e.yyx)));
} 
float spow(float a,float p){return sign(a)*pow(abs(a),p);} 
vec4 sky(vec3 ro, vec3 rd, vec3 L){ 
  vec3 bgr=vec3(0.2,0.35,0.25); 
  if(rd.y>0.){ 
    return vec4(bgr,100.0); 
  }else{ 
    float t=(-0.33-ro.y)/rd.y; 
    vec2 v=(ro.xz+rd.xz*t);//a silly way to make antialiased checks  
    if(abs(v.x)>4. || abs(v.y)>4.)return vec4(bgr,t); 
    vec3 glow=vec3(0.);vec2 fv=floor(v+vec2(4.)); 
    if(fv.x==sel.x && fv.y==sel.y)glow=vec3(0.6,0.6,0.0); 
    if(fv.x==sel.z && fv.y==sel.w)glow=vec3(0.0,0.75,0.2); 
    v=abs(fract(vec2(v.x-v.y,v.x+v.y)*0.5)-0.5);//turn 45 deg, fract, re-center 
    v=vec2(v.x-v.y,v.x+v.y);//turn again and multiply x*y 
    float d=spow(v.x*v.y,sqrt(t)*0.03);///(1.0+t*t*0.008); 
    return vec4(glow+vec3(clamp(d,0.,1.)),t); 
  } 
} 
float rnd; 
void randomize(in vec2 p){rnd=fract(float(iTime)+sin(dot(p,vec2(13.3145,117.7391)))*42317.7654321);} 
float DES(vec3 p){return min(DE(p),p.y+0.33);} 
float ShadAO(in vec3 ro, in vec3 rd){  
 float t=0.01*rnd,s=1.0,d,mn=0.01; 
 for(int i=0;i<12;i++){ 
  d=max(DES(ro+rd*t),mn); 
  s=min(s,d/t+t*0.5); 
  t+=d; 
 } 
 return s; 
} 
vec3 scene(vec3 ro, vec3 rd){ 
  vec3 L=normalize(vec3(0.4,0.25,0.5)); 
  vec4 col=vec4(0.,0.,0.,1.);float px=1.0/iResolution.x; 
  float d,t=length(ro)-6.0; 
  ro+=t*rd;t=DE(ro)*rnd; 
  vec4 bcol=sky(ro,rd,L); 
  for(int i=0;i<99;i++){ 
    t+=d=DE(ro+rd*t); 
    if(t>bcol.w || d<px*t)break; 
  } 
  bool bHit=d<px*t?true:false; 
  if(bHit || rd.y<0.){
    vec3 so,N,scol; 
    if(bHit){ 
      mcol=vec3(0.001); 
      so=ro+rd*t; 
      N=normal(so,px*t);if(N!=N)N=-rd; 
      scol=mcol/6.; 
    }else{ 
      t=bcol.w; 
      so=ro+rd*t;so.y+=0.01; 
      N=vec3(0.,1.,0.); 
      scol=bcol.xyz; 
    } 
    float dif=0.5+0.5*dot(N,L); 
    float spec=pow(max(dot(reflect(rd,N),L),0.),12.0); 
    float shad=ShadAO(so,L); 
    col=vec4((scol*dif+vec3(0.5,0.4,.2)*spec)*shad,0.); 
  } 
  col.xyz+=bcol.xyz*col.w; 
  return col.xyz; 
} 
void mainImage(out vec4 O, in vec2 U){
  vec2 uv=(U.xy-0.5*iResolution.xy)/iResolution.x; 
  randomize(U);
  vec4 st=get(STATEVEC);
  loadBoard();
  float viewAng0=gb(st.y,0.,4.)*0.0625*6.283,viewAng1=0.1+gb(st.y,4.,4.)*0.0625;
  vec3 rd=normalize(vec3(uv,3.));
  vec3 ro=vec3(sin(viewAng0)*cos(viewAng1),sin(viewAng1),cos(viewAng0)*cos(viewAng1))*33.;
  vec3 fw=normalize(vec3(0.,-0.5,0.)-ro),rt=normalize(cross(fw,vec3(0.0,1.0,0.0))),up=cross(rt,fw);
  sel=vec4(gb(st.w,0.,4.),gb(st.w,4.,4.),gb(st.w,8.,4.),gb(st.w,12.,4.));
  O=vec4(scene(ro,mat3(rt,up,fw)*rd),1.0);
}
`;

export default class implements iSub {
  key(): string {
    return 'wsBfzW';
  }
  name(): string {
    return 'Chaturanga';
  }
  sort() {
    return 571;
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
    return [{ type: 1, f, fi: 0 }];
  }
}
