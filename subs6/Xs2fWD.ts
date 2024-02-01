import { GUI } from 'dat.gui';
import { createCanvas, iSub, PRECISION_MEDIUMP, WEBGL_2 } from '../libs';
import * as webglUtils from '../webgl-utils';

const buffA = `
// gameplay loop

//#define EASY_MODE
//#define KEY_AUTOREPEAT

const float TICK_NUM			= 10.;
const float TILE_FLOOR			= 1.;
const float TILE_DOOR_OPEN		= 2.;
const float TILE_STAIRS_DOWN	= 3.;
const float TILE_TRAP			= 4.;
const float TILE_TRAP_OFF		= 5.;
const float TILE_WALL			= 6.;
const float TILE_WALL_HOLE		= 7.;
const float TILE_DOOR_LOCKED	= 8.;
const float TILE_STAIRS_UP		= 9.;
const float ITEM_KEY			= 1.;
const float ITEM_FOOD			= 2.;
const float ITEM_POTION			= 3.;
const float ITEM_SPAWNER		= 4.;
const float ITEM_SPAWNER_2		= 5.;
const float STATE_START			= 0.;
const float STATE_GAME			= 1.;
const float STATE_NEXT_LEVEL	= 2.;
const float STATE_GAME_OVER		= 3.;

const float KEY_LEFT  			= 37.5f / 256.0f;
const float KEY_UP    			= 38.5f / 256.0f;
const float KEY_RIGHT 			= 39.5f / 256.0f;
const float KEY_DOWN  			= 40.5f / 256.0f;

const int   ENEMY_NUM			= 3;
const int   LOG_NUM				= 4;

struct GameState
{
    // 0   
    float	tick;
    float 	hp;
    float 	level;
    float 	xp;
    float 	keyNum;
    
	// 1
    vec2 	playerPos;
    float   playerFrame;
    float   playerDir;
    vec2	bodyPos;
    float   bodyId;
    
    // 2
    float 	state;
    float   keyLock;
    float 	stateTime;
    vec2	despawnPos;
    float   despawnId;

    // 3
    vec2	enemyPos[ ENEMY_NUM ];
    float 	enemyFrame[ ENEMY_NUM ];
    float 	enemyDir[ ENEMY_NUM ];
    float 	enemyHP[ ENEMY_NUM ];
    float 	enemyId[ ENEMY_NUM ];
    vec2    enemySpawnPos[ ENEMY_NUM ];
    
    // 4
    vec2	logPos[ LOG_NUM ];
    float   logLife[ LOG_NUM ];
    float   logId[ LOG_NUM ];
    float   logVal[ LOG_NUM ];
};

vec4 LoadValue( int x, int y )
{
    return texelFetch( iChannel0, ivec2( x, y ), 0 );
}    

float PackXY( float a, float b )
{
    return floor( a ) + floor( b ) / 256.;
}

float PackXY( vec2 v )
{
    return PackXY( v.x, v.y );
}

float UnpackX( float a )
{
    return floor( a );
}

float UnpackY( float a )
{
    return fract( a ) * 256.;
}

vec2 UnpackXY( float a )
{
    return vec2( UnpackX( a ), UnpackY( a ) );
}

void LoadState( out GameState s )
{
    vec4 data;

    data = LoadValue( 0, 0 );
    s.tick 		= data.x;
    s.hp    	= UnpackX( data.y );
    s.level    	= UnpackY( data.y );
    s.xp        = data.z;
    s.keyNum    = data.w;
    
    data = LoadValue( 1, 0 );
    s.playerPos   = UnpackXY( data.x );
    s.playerFrame = UnpackX( data.y );
    s.playerDir   = UnpackY( data.y );
    s.bodyPos	  = UnpackXY( data.z );
    s.bodyId      = data.w;
    
    data = LoadValue( 2, 0 );
    s.state      = UnpackX( data.x );
    s.keyLock    = UnpackY( data.x );
    s.stateTime  = data.y;
    s.despawnPos = UnpackXY( data.z );
    s.despawnId  = data.w;

    for ( int i = 0; i < ENEMY_NUM; ++i )
    {
        data = LoadValue( 3, i );
        s.enemyPos[ i ]      = UnpackXY( data.x );
        s.enemyFrame[ i ]    = UnpackX( data.y );
        s.enemyDir[ i ]      = UnpackY( data.y );
        s.enemyHP[ i ]       = UnpackX( data.z );
        s.enemyId[ i ]       = UnpackY( data.z );
        s.enemySpawnPos[ i ] = UnpackXY( data.w );
    }
    
    for ( int i = 0; i < LOG_NUM; ++i )
    {
		data = LoadValue( 4, i );
    	s.logPos[ i ]  = data.xy;
        s.logLife[ i ] = data.z;
        s.logId[ i ]   = UnpackX( data.w );
        s.logVal[ i ]  = UnpackY( data.w );
    }    
}

void StoreValue( vec2 re, vec4 va, inout vec4 fragColor, vec2 fragCoord )
{
    fragCoord = floor( fragCoord );
    fragColor = ( fragCoord.x == re.x && fragCoord.y == re.y ) ? va : fragColor;
}

vec4 SaveState( in GameState s, in vec2 fragCoord, bool reset )
{
    vec4 ret = vec4( 0. );
    StoreValue( vec2( 0., 0. ), vec4( s.tick, PackXY( s.hp, s.level ), s.xp, s.keyNum ), ret, fragCoord );
    StoreValue( vec2( 1., 0. ), vec4( PackXY( s.playerPos ), PackXY( s.playerFrame, s.playerDir ), PackXY( s.bodyPos ), s.bodyId ), ret, fragCoord );
    StoreValue( vec2( 2., 0. ), vec4( PackXY( s.state, s.keyLock ), s.stateTime, PackXY( s.despawnPos ), s.despawnId ), ret, fragCoord );

    for ( int i = 0; i < ENEMY_NUM; ++i )
    {
        StoreValue( vec2( 3., float( i ) ), 
                   vec4( PackXY( s.enemyPos[ i ] ), 
                         PackXY( s.enemyFrame[ i ], s.enemyDir[ i ] ), 
                         PackXY( s.enemyHP[ i ], s.enemyId[ i ] ),
                         PackXY( s.enemySpawnPos[ i ] ) ), ret, fragCoord );
    }
    
    for ( int i = 0; i < LOG_NUM; ++i )
    {
        StoreValue( vec2( 4., float( i ) ), vec4( s.logPos[ i ], s.logLife[ i ], PackXY( s.logId[ i ], s.logVal[ i ] ) ), ret, fragCoord );
    }

	if ( reset )    
    {
        ret = vec4( 0. );
		StoreValue( vec2( 0., 0. ), vec4( 0., 21., 0., 0. ), ret, fragCoord );        
        StoreValue( vec2( 1., 0. ), vec4( PackXY( 3., 2. ), 0., 0., 0. ), ret, fragCoord );
        StoreValue( vec2( 2., 0. ), vec4( s.state, 0., 0., 0. ), ret, fragCoord );
    }
    
    return ret;
}

void LogDmg( inout GameState s, vec2 pos, float val )
{
    float maxLife = -1.;
    if ( s.logPos[ 2 ].x > 0. && s.logPos[ 3 ].x > 0. )
    {
        maxLife = max( s.logLife[ 2 ], s.logLife[ 3 ] );
    }
    
    for ( int i = 2; i < LOG_NUM; ++i )
    {
        if ( s.logPos[ i ].x <= 0. || maxLife == s.logLife[ i ] )
        {
            s.logPos[ i ]  = pos;
            s.logLife[ i ] = 0.;
            s.logId[ i ]   = 0.;
            s.logVal[ i ]  = val;            
            break;
        }
    }   
}

void LogXP( inout GameState s, vec2 pos, float val )
{
    s.logPos[ 0 ]  = pos;
    s.logLife[ 0 ] = 0.;
    s.logId[ 0 ]   = 0.;
	s.logVal[ 0 ]  = val;
}

void LogHeal( inout GameState s, vec2 pos, float val )
{
    s.logPos[ 1 ]  = pos;
    s.logLife[ 1 ] = 0.;
    s.logId[ 1 ]   = 0.;
	s.logVal[ 1 ]  = val;
}

void LogLevelUp( inout GameState s, vec2 pos )
{
    s.logPos[ 0 ]  = pos;
    s.logLife[ 0 ] = 0.;
    s.logId[ 0 ]   = 1.;
}

float Rand( vec2 n )
{
	return fract( sin( dot( n.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
}

float MaxXP( float level )
{
	return 10. + level * 5.;	   
}

float MaxHP( float level )
{
	return 21. + level * 3.;	   
}

float EnemyDmg( float id )
{    
    float dmg = 1. + 2. * id + floor( ( 4. + 2. * id ) * Rand( vec2( iTime, iTime ) ) );
#ifdef EASY_MODE
    dmg = floor( dmg * .5 );
#endif
    return dmg;
}

float EnemyHP( float id )
{
    return 8. + id * 15.;
}

float EnemyXP( float id )
{
    return 3. + id * 5.;
}

float TrapDmg( bool player )
{
    float dmg = 10. + floor( 8. * Rand( vec2( iTime, iTime ) ) );
#ifdef EASY_MODE
    if ( player )
    	dmg = floor( dmg * .5 );
#endif    
    return dmg;
}

float PlayerDmg( inout GameState s )
{
    return s.level + 1. + floor( 4. * Rand( vec2( iTime + 11.1, iTime + 11.1 ) ) );
}

void UpdateEnemies( inout GameState s )
{
    for ( int i = 0; i < ENEMY_NUM; ++i )
    {
    	if ( s.tick == 0. )
    	{
            s.enemyFrame[ i ] = 0.;
        }
        
       	if ( s.enemyPos[ i ].x > 0. && s.enemyHP[ i ] <= 0. )
        {
            float xp = EnemyXP( s.enemyId[ i ] );
            s.xp += xp;
            s.bodyPos = s.enemyPos[ i ];
            s.bodyId  = s.enemyId[ i ] + 1.;
            s.enemyPos[ i ] = vec2( 0., 0. );
            LogXP( s, s.playerPos, xp );
        }        

        vec4 map = texelFetch( iChannel1, ivec2( s.enemyPos[ i ] ), 0 );
        if ( map.x == TILE_TRAP && s.tick == 1. )
        {
            float dmg = TrapDmg( false );
            s.enemyHP[ i ] -= dmg;
            LogDmg( s, s.enemyPos[ i ], dmg );
        }        
        
        vec2 move = vec2( 0., 0. );
    	vec2 toPlayer = s.playerPos - s.enemyPos[ i ];
        vec2 moveX = vec2( sign( toPlayer.x ), 0. );
        vec2 moveY = vec2( 0., sign( toPlayer.y ) );
        vec4 mapX  = texelFetch( iChannel1, ivec2( s.enemyPos[ i ] + moveX ), 0 );
        vec4 mapY  = texelFetch( iChannel1, ivec2( s.enemyPos[ i ] + moveY ), 0 );
        
        if ( mapX.x >= TILE_WALL )
        {
            moveX = vec2( 0. );
        }

        if ( mapY.x >= TILE_WALL )
        {
            moveY = vec2( 0. );
        }             
        
        for ( int j = 0; j < ENEMY_NUM; ++j )
        {
            if ( j != i && s.enemyPos[ j ] == s.enemyPos[ i ] + moveX )
            {
                moveX = vec2( 0. );
            }
            if ( j != i && s.enemyPos[ j ] == s.enemyPos[ i ] + moveY )
            {
                moveY = vec2( 0. );
            }
        }

        move = moveX.x != 0. ? moveX : moveY;
        if ( moveX.x != 0. && moveY.y != 0. )
        {
            move = abs( toPlayer.x ) > abs( toPlayer.y ) ? moveX : moveY;
        }
        
        if ( s.tick == TICK_NUM )
        {
        	if ( s.enemyPos[ i ] + move == s.playerPos )
            {
                float dmg = EnemyDmg( s.enemyId[ i ] );
                s.hp -= dmg;
                s.enemyFrame[ i ] = 5.;
                LogDmg( s, s.playerPos, dmg );
            }
			else
            {
				s.enemyPos[ i ] += move;
                s.enemyFrame[ i ] = move.x == 1. ? 1. : ( move.x == -1. ? 2. : ( move.y == 1. ? 3. : ( move.y == -1. ? 4. : 0. ) ) );
                s.enemyDir[ i ] = move.x > 0. ? 0. : ( move.x < 0. ? 1. : s.enemyDir[ i ] );
            }
        }
    }    
}

void CheckSpawnPos( inout vec2 spawnPos, inout float spawnId, vec2 tile )
{
	vec4 map = texelFetch( iChannel1, ivec2( tile ), 0 );
    if ( map.y == ITEM_SPAWNER || map.y == ITEM_SPAWNER_2 )
    {
        spawnPos = tile;
        spawnId  = map.y == ITEM_SPAWNER ? 0. : 1.;
    } 
}

void SpawnEnemies( inout GameState s, vec2 playerMove )
{    
    // despawn out of range
    s.despawnPos = vec2( 0. );
    for ( int i = 0; i < ENEMY_NUM; ++i )
    {
        if ( s.tick == 1. && s.enemyPos[ i ].x > 0. && length( s.playerPos - s.enemyPos[ i ] ) > 5. )
        {
            s.despawnPos    = s.enemySpawnPos[ i ];
            s.despawnId     = s.enemyId[ i ];
            s.enemyPos[ i ] = vec2( 0. );
            break;
        }
    }    
    
    vec2 spawnPos = vec2( 0., 0. );
    float spawnId = 0.;
    CheckSpawnPos( spawnPos, spawnId, s.playerPos + playerMove * 4. );
    CheckSpawnPos( spawnPos, spawnId, s.playerPos + playerMove * 3. - playerMove.yx * 1. );
    CheckSpawnPos( spawnPos, spawnId, s.playerPos + playerMove * 3. + playerMove.yx * 1. );
    CheckSpawnPos( spawnPos, spawnId, s.playerPos + playerMove * 2. - playerMove.yx * 2. );
    CheckSpawnPos( spawnPos, spawnId, s.playerPos + playerMove * 2. + playerMove.yx * 2. );
    CheckSpawnPos( spawnPos, spawnId, s.playerPos + playerMove * 1. - playerMove.yx * 3. );
    CheckSpawnPos( spawnPos, spawnId, s.playerPos + playerMove * 1. + playerMove.yx * 3. );
    CheckSpawnPos( spawnPos, spawnId, s.playerPos + playerMove * 0. - playerMove.yx * 4. );
    CheckSpawnPos( spawnPos, spawnId, s.playerPos + playerMove * 0. + playerMove.yx * 4. );    
    
    if ( spawnPos.x > 0. )
    {
        for ( int i = 0; i < ENEMY_NUM; ++i )
        {        
            if ( s.enemyPos[ i ].x <= 0. )
            {
                s.enemyId[ i ]       = spawnId;
                s.enemyPos[ i ]      = spawnPos;
                s.enemyHP[ i ]       = EnemyHP( spawnId );
                s.enemySpawnPos[ i ] = spawnPos;
                break;
            }
        }    
    }
}

void UpdateLog( inout GameState s )
{
    for ( int i = 0; i < LOG_NUM; ++i )
    {
        s.logLife[ i ] += iTimeDelta;
        if ( s.logLife[ i ] > 1. )
        {
            s.logPos[ i ] = vec2( 0. );
        }
    }
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // don't compute gameplay outside of the data area
    if ( fragCoord.x >= 8. || fragCoord.y >= 8. ) 
    {
		discard;    
    }

    // keys
    bool keyLeft  	= texture( iChannel2, vec2( KEY_LEFT, .25 ) ).x > .5;
    bool keyRight 	= texture( iChannel2, vec2( KEY_RIGHT, .25 ) ).x > .5;
    bool keyUp  	= texture( iChannel2, vec2( KEY_UP, .25 ) ).x > .5;
    bool keyDown 	= texture( iChannel2, vec2( KEY_DOWN, .25 ) ).x > .5;    
    
    GameState s;
    LoadState( s );
    
    s.tick = max( floor( s.tick - 1. ), 0. );    
    
    bool reset = false;
    if ( iFrame < 1 || s.state == STATE_START )
    {
        reset   = true;
        s.state = STATE_GAME;
    }
    else if ( s.state == STATE_GAME )
    {
        if ( s.hp <= 0. )
        {
            s.state 	= STATE_GAME_OVER;
			s.stateTime = 0.;
        }
    }
    else if ( s.state == STATE_NEXT_LEVEL )
    {
        s.state = STATE_GAME;
        s.playerPos = vec2( 3., 2. );
    	for ( int i = 0; i < ENEMY_NUM; ++i )
    	{           
            s.enemyPos[ i ] = vec2( 0. );
    	}
    }
    else if ( s.state == STATE_GAME_OVER )
    {
        s.stateTime += .33 * iTimeDelta;
        if ( s.stateTime >= 1. )
        {
            s.state = STATE_START;
        }
    }

    
    // level up
    if ( s.xp >= MaxXP( s.level ) )
    {
        s.xp -= MaxXP( s.level );
        s.level = min( s.level + 1., 9. );
        s.hp	= MaxHP( s.level );
        LogLevelUp( s, s.playerPos );
    }
    
    
#ifdef KEY_AUTOREPEAT    
    s.keyLock = 0.;
#else
    s.keyLock = keyLeft || keyRight || keyDown || keyUp ? s.keyLock : 0.;    
#endif

    vec2 move = vec2( 0., 0. );
    if ( s.state == STATE_GAME && s.tick == 0. && s.keyLock == 0. )
    {
        s.playerFrame = 0.;
        if ( keyLeft )
        {
            move.x = -1.;
            s.playerDir = 1.;
        }   
        else if ( keyRight )
        {
            move.x = 1.;
            s.playerDir = 0.;
        }   
        else if ( keyDown )
        {
            move.y = -1.;
        }
        else if ( keyUp )
        {
            move.y = 1.;
        }             
    }
  
    vec4 map = texelFetch( iChannel1, ivec2( s.playerPos + move ), 0 );
    if ( abs( move.x + move.y ) > 0. && map.x < TILE_WALL )
    {
        bool enemy = false;
        for ( int i = 0; i < ENEMY_NUM; ++i )
        {
            if ( s.enemyPos[ i ] == s.playerPos + move )        
            {
                float dmg = PlayerDmg( s );
                s.playerFrame = 6.;
                s.enemyHP[ i ] -= dmg;
                LogDmg( s, s.enemyPos[ i ], dmg );
            }
        }
        
        if ( s.playerFrame != 6. )
        {
    		s.playerPos += move;
            s.playerFrame = keyLeft ? 1. : ( keyRight ? 2. : ( keyDown ? 3. : 4. ) );
        
        	if ( map.y == ITEM_KEY )
        	{
            	s.keyNum += 1.;
        	}        
            
        	if ( map.y == ITEM_FOOD || map.y == ITEM_POTION )
        	{
                float heal = map.y == ITEM_FOOD ? 5. : 50.;
                heal = min( heal, MaxHP( s.level ) - s.hp );
            	s.hp += heal;
                LogHeal( s, s.playerPos, heal );
        	}      
            
            if ( map.x == TILE_TRAP )
            {
                float dmg = TrapDmg( true );
                s.hp -= dmg;
                LogDmg( s, s.playerPos, dmg );
            }  
        }
        
        s.tick    = TICK_NUM;
        s.keyLock = 1.;
    }
    else if ( map.x == TILE_DOOR_LOCKED && s.keyNum > 0. )
    {
        s.playerFrame = keyLeft ? 1. : ( keyRight ? 2. : ( keyDown ? 3. : 4. ) );
        s.keyNum -= 1.;
        s.playerPos += move;
        s.tick    = TICK_NUM;
        s.keyLock = 1.;
    }
    else if ( map.x >= TILE_WALL )
    {
     	// wait
        s.playerFrame = 5.;
        s.tick        = TICK_NUM;
        s.keyLock     = 1.;
    }    

    UpdateEnemies( s );
    SpawnEnemies( s, move ); 
	UpdateLog( s );
    
	// next level
    if ( map.x == TILE_STAIRS_DOWN )
    {     
        s.state = STATE_NEXT_LEVEL;
    }
    
    fragColor = SaveState( s, fragCoord, reset );
}`;

const buffB = `
// map

const float TICK_NUM			= 10.;
const float TILE_FLOOR			= 1.;
const float TILE_DOOR_OPEN		= 2.;
const float TILE_STAIRS_DOWN	= 3.;
const float TILE_TRAP			= 4.;
const float TILE_TRAP_OFF		= 5.;
const float TILE_WALL			= 6.;
const float TILE_WALL_HOLE		= 7.;
const float TILE_DOOR_LOCKED	= 8.;
const float TILE_STAIRS_UP		= 9.;
const float ITEM_KEY			= 1.;
const float ITEM_FOOD			= 2.;
const float ITEM_POTION			= 3.;
const float ITEM_SPAWNER		= 4.;
const float ITEM_SPAWNER_2		= 5.;
const float STATE_START			= 0.;
const float STATE_GAME			= 1.;
const float STATE_NEXT_LEVEL	= 2.;
const float STATE_GAME_OVER		= 3.;

const int   ENEMY_NUM			= 3;
const int   LOG_NUM				= 4;

struct GameState
{
    // 0   
    float	tick;
    float 	hp;
    float 	level;
    float 	xp;
    float 	keyNum;
    
	// 1
    vec2 	playerPos;
    float   playerFrame;
    float   playerDir;
    vec2	bodyPos;
    float   bodyId;
    
    // 2
    float 	state;
    float   keyLock;
    float 	stateTime;
    vec2	despawnPos;
    float   despawnId;

    // 3
    vec2	enemyPos[ ENEMY_NUM ];
    float 	enemyFrame[ ENEMY_NUM ];
    float 	enemyDir[ ENEMY_NUM ];
    float 	enemyHP[ ENEMY_NUM ];
    float 	enemyId[ ENEMY_NUM ];
    vec2    enemySpawnPos[ ENEMY_NUM ];
    
    // 4
    vec2	logPos[ LOG_NUM ];
    float   logLife[ LOG_NUM ];
    float   logId[ LOG_NUM ];
    float   logVal[ LOG_NUM ];
};

vec4 LoadValue( int x, int y )
{
    return texelFetch( iChannel0, ivec2( x, y ), 0 );
}    

float PackXY( float a, float b )
{
    return floor( a ) + floor( b ) / 256.;
}

float PackXY( vec2 v )
{
    return PackXY( v.x, v.y );
}

float UnpackX( float a )
{
    return floor( a );
}

float UnpackY( float a )
{
    return fract( a ) * 256.;
}

vec2 UnpackXY( float a )
{
    return vec2( UnpackX( a ), UnpackY( a ) );
}

void LoadState( out GameState s )
{
    vec4 data;

    data = LoadValue( 0, 0 );
    s.tick 		= data.x;
    s.hp    	= UnpackX( data.y );
    s.level    	= UnpackY( data.y );
    s.xp        = data.z;
    s.keyNum    = data.w;
    
    data = LoadValue( 1, 0 );
    s.playerPos   = UnpackXY( data.x );
    s.playerFrame = UnpackX( data.y );
    s.playerDir   = UnpackY( data.y );
    s.bodyPos	  = UnpackXY( data.z );
    s.bodyId      = data.w;
    
    data = LoadValue( 2, 0 );
    s.state      = UnpackX( data.x );
    s.keyLock    = UnpackY( data.x );
    s.stateTime  = data.y;
    s.despawnPos = UnpackXY( data.z );
    s.despawnId  = data.w;

    for ( int i = 0; i < ENEMY_NUM; ++i )
    {
        data = LoadValue( 3, i );
        s.enemyPos[ i ]      = UnpackXY( data.x );
        s.enemyFrame[ i ]    = UnpackX( data.y );
        s.enemyDir[ i ]      = UnpackY( data.y );
        s.enemyHP[ i ]       = UnpackX( data.z );
        s.enemyId[ i ]       = UnpackY( data.z );
        s.enemySpawnPos[ i ] = UnpackXY( data.w );
    }
    
    for ( int i = 0; i < LOG_NUM; ++i )
    {
		data = LoadValue( 4, i );
    	s.logPos[ i ]  = data.xy;
        s.logLife[ i ] = data.z;
        s.logId[ i ]   = UnpackX( data.w );
        s.logVal[ i ]  = UnpackY( data.w );
    }    
}

vec4 Map( vec2 p )
{
    int v = 0;
	v = p.y == 31. ? ( p.x < 8. ? 842150450 : ( p.x < 16. ? 573710370 : ( p.x < 24. ? 8754 : 589443584 ) ) ) : v;
	v = p.y == 30. ? ( p.x < 8. ? 286331154 : ( p.x < 16. ? 286335521 : ( p.x < 24. ? 589308177 : 554766882 ) ) ) : v;
	v = p.y == 29. ? ( p.x < 8. ? 286331154 : ( p.x < 16. ? 572592401 : ( p.x < 24. ? 287318289 : 554766609 ) ) ) : v;
	v = p.y == 28. ? ( p.x < 8. ? 572662306 : ( p.x < 16. ? 539042338 : ( p.x < 24. ? 555753745 : 554766882 ) ) ) : v;
	v = p.y == 27. ? ( p.x < 8. ? 0 : ( p.x < 16. ? 590422016 : ( p.x < 24. ? 555754002 : 572662272 ) ) ) : v;
	v = p.y == 26. ? ( p.x < 8. ? 589505314 : ( p.x < 16. ? 554770432 : ( p.x < 24. ? 555745810 : 0 ) ) ) : v;
	v = p.y == 25. ? ( p.x < 8. ? 554766610 : ( p.x < 16. ? 554770432 : ( p.x < 24. ? 555889170 : 589443634 ) ) ) : v;
	v = p.y == 24. ? ( p.x < 8. ? 554766610 : ( p.x < 16. ? 286334976 : ( p.x < 24. ? 286331153 : 554766609 ) ) ) : v;
	v = p.y == 23. ? ( p.x < 8. ? 555884834 : ( p.x < 16. ? 554770995 : ( p.x < 24. ? 555885073 : 554836514 ) ) ) : v;
	v = p.y == 22. ? ( p.x < 8. ? 287318304 : ( p.x < 16. ? 554770705 : ( p.x < 24. ? 555889169 : 554827776 ) ) ) : v;
	v = p.y == 21. ? ( p.x < 8. ? 572530976 : ( p.x < 16. ? 286335266 : ( p.x < 24. ? 555946257 : 555885106 ) ) ) : v;
	v = p.y == 20. ? ( p.x < 8. ? 143666 : ( p.x < 16. ? 572727584 : ( p.x < 24. ? 286331425 : 554832145 ) ) ) : v;
	v = p.y == 19. ? ( p.x < 8. ? 135442 : ( p.x < 16. ? 539037984 : ( p.x < 24. ? 571613713 : 554766882 ) ) ) : v;
	v = p.y == 18. ? ( p.x < 8. ? 135442 : ( p.x < 16. ? 539042336 : ( p.x < 24. ? 34734609 : 554832384 ) ) ) : v;
	v = p.y == 17. ? ( p.x < 8. ? 570560786 : ( p.x < 16. ? 539042355 : ( p.x < 24. ? 856896017 : 572662274 ) ) ) : v;
	v = p.y == 16. ? ( p.x < 8. ? 305279266 : ( p.x < 16. ? 539042065 : ( p.x < 24. ? 286331409 : 2 ) ) ) : v;
	v = p.y == 15. ? ( p.x < 8. ? 286331168 : ( p.x < 16. ? 857809169 : ( p.x < 24. ? 286331427 : 143922 ) ) ) : v;
	v = p.y == 14. ? ( p.x < 8. ? 304226592 : ( p.x < 16. ? 286331153 : ( p.x < 24. ? 286331153 : 590483729 ) ) ) : v;
	v = p.y == 13. ? ( p.x < 8. ? 570433824 : ( p.x < 16. ? 572596770 : ( p.x < 24. ? 286331426 : 554832418 ) ) ) : v;
	v = p.y == 12. ? ( p.x < 8. ? 8480 : ( p.x < 16. ? 287383552 : ( p.x < 24. ? 286331394 : 554832386 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 8. ? 840966450 : ( p.x < 16. ? 287383586 : ( p.x < 24. ? 571613698 : 554766850 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 8. ? 287318290 : ( p.x < 16. ? 286335009 : ( p.x < 24. ? 34734082 : 572658176 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 8. ? 287318290 : ( p.x < 16. ? 572596257 : ( p.x < 24. ? 34746882 : 135680 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 8. ? 304095506 : ( p.x < 16. ? 2171682 : ( p.x < 24. ? 571544064 : 36835891 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 8. ? 301998354 : ( p.x < 16. ? 2167057 : ( p.x < 24. ? 286331392 : 34672913 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 8. ? 570434082 : ( p.x < 16. ? 2171426 : ( p.x < 24. ? 304226816 : 34742818 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 8. ? 0 : ( p.x < 16. ? 2170880 : ( p.x < 24. ? 301989888 : 34738450 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 8. ? 36844082 : ( p.x < 16. ? 36778496 : ( p.x < 24. ? 302134048 : 34672914 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 8. ? 571543826 : ( p.x < 16. ? 571544099 : ( p.x < 24. ? 302125346 : 34738449 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 8. ? 286331154 : ( p.x < 16. ? 286331153 : ( p.x < 24. ? 302125329 : 34746930 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 8. ? 571543826 : ( p.x < 16. ? 571544098 : ( p.x < 24. ? 302125346 : 34672913 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 8. ? 35791394 : ( p.x < 16. ? 35791360 : ( p.x < 24. ? 570565152 : 35791394 ) ) ) : v;
    float t = float( ( v >> int( 4. * p.x ) ) & 15 );
    t = t == 2. ? 6. : t;
    t = t == 3. ? 7. : t;
    t = p.x == 15. && p.y == 30. ? 2. : t;
    t = p.x == 9. && p.y == 29. ? 2. : t;
    t = p.x == 11. && p.y == 29. ? 2. : t;
    t = p.x == 12. && p.y == 27. ? 2. : t;
    t = p.x == 17. && p.y == 27. ? 2. : t;
    t = p.x == 17. && p.y == 25. ? 2. : t;
    t = p.x == 15. && p.y == 24. ? 2. : t;
    t = p.x == 18. && p.y == 24. ? 2. : t;
    t = p.x == 21. && p.y == 24. ? 2. : t;
    t = p.x == 23. && p.y == 24. ? 2. : t;
    t = p.x == 28. && p.y == 24. ? 2. : t;
    t = p.x == 2. && p.y == 23. ? 2. : t;
    t = p.x == 6. && p.y == 23. ? 2. : t;
    t = p.x == 15. && p.y == 21. ? 2. : t;
    t = p.x == 18. && p.y == 21. ? 2. : t;
    t = p.x == 30. && p.y == 21. ? 2. : t;
    t = p.x == 16. && p.y == 20. ? 2. : t;
    t = p.x == 23. && p.y == 20. ? 2. : t;
    t = p.x == 11. && p.y == 19. ? 2. : t;
    t = p.x == 21. && p.y == 19. ? 2. : t;
    t = p.x == 28. && p.y == 19. ? 2. : t;
    t = p.x == 2. && p.y == 16. ? 2. : t;
    t = p.x == 6. && p.y == 15. ? 2. : t;
    t = p.x == 12. && p.y == 15. ? 2. : t;
    t = p.x == 11. && p.y == 14. ? 2. : t;
    t = p.x == 24. && p.y == 14. ? 2. : t;
    t = p.x == 2. && p.y == 11. ? 2. : t;
    t = p.x == 21. && p.y == 11. ? 2. : t;
    t = p.x == 28. && p.y == 11. ? 2. : t;
    t = p.x == 13. && p.y == 10. ? 2. : t;
    t = p.x == 21. && p.y == 9. ? 2. : t;
    t = p.x == 7. && p.y == 8. ? 2. : t;
    t = p.x == 27. && p.y == 8. ? 2. : t;
    t = p.x == 22. && p.y == 7. ? 2. : t;
    t = p.x == 28. && p.y == 4. ? 2. : t;
    t = p.x == 24. && p.y == 3. ? 2. : t;
    t = p.x == 10. && p.y == 2. ? 2. : t;
    t = p.x == 14. && p.y == 2. ? 2. : t;
    t = p.x == 17. && p.y == 2. ? 2. : t;
    t = p.x == 26. && p.y == 29. ? 8. : t;
    t = p.x == 22. && p.y == 25. ? 8. : t;
    t = p.x == 21. && p.y == 17. ? 8. : t;
    t = p.x == 13. && p.y == 14. ? 8. : t;
    t = p.x == 18. && p.y == 14. ? 8. : t;
    t = p.x == 12. && p.y == 4. ? 8. : t;
    t = p.x == 6. && p.y == 2. ? 8. : t;
    t = p.x == 17. && p.y == 29. ? 4. : t;
    t = p.x == 4. && p.y == 24. ? 4. : t;
    t = p.x == 16. && p.y == 23. ? 4. : t;
    t = p.x == 29. && p.y == 23. ? 4. : t;
    t = p.x == 2. && p.y == 18. ? 4. : t;
    t = p.x == 17. && p.y == 17. ? 4. : t;
    t = p.x == 8. && p.y == 15. ? 4. : t;
    t = p.x == 9. && p.y == 15. ? 4. : t;
    t = p.x == 21. && p.y == 15. ? 4. : t;
    t = p.x == 20. && p.y == 14. ? 4. : t;
    t = p.x == 22. && p.y == 14. ? 4. : t;
    t = p.x == 21. && p.y == 13. ? 4. : t;
    t = p.x == 29. && p.y == 12. ? 4. : t;
    t = p.x == 14. && p.y == 11. ? 4. : t;
    t = p.x == 26. && p.y == 4. ? 4. : t;
    t = p.x == 12. && p.y == 2. ? 4. : t;
    t = p.x == 2. && p.y == 2. ? 9. : t;
    t = p.x == 29. && p.y == 29. ? 3. : t;
    float i = 0.;
    i = p.x == 1. && p.y == 30. ? 1. : i;
    i = p.x == 1. && p.y == 24. ? 1. : i;
    i = p.x == 17. && p.y == 16. ? 1. : i;
    i = p.x == 1. && p.y == 7. ? 1. : i;
    i = p.x == 25. && p.y == 5. ? 1. : i;
    i = p.x == 1. && p.y == 3. ? 1. : i;
    i = p.x == 19. && p.y == 3. ? 1. : i;
    i = p.x == 8. && p.y == 30. ? 2. : i;
    i = p.x == 18. && p.y == 30. ? 2. : i;
    i = p.x == 27. && p.y == 28. ? 2. : i;
    i = p.x == 13. && p.y == 26. ? 2. : i;
    i = p.x == 14. && p.y == 26. ? 2. : i;
    i = p.x == 6. && p.y == 25. ? 2. : i;
    i = p.x == 13. && p.y == 25. ? 2. : i;
    i = p.x == 14. && p.y == 25. ? 2. : i;
    i = p.x == 10. && p.y == 22. ? 2. : i;
    i = p.x == 19. && p.y == 21. ? 2. : i;
    i = p.x == 3. && p.y == 19. ? 2. : i;
    i = p.x == 17. && p.y == 19. ? 2. : i;
    i = p.x == 30. && p.y == 18. ? 2. : i;
    i = p.x == 10. && p.y == 16. ? 2. : i;
    i = p.x == 23. && p.y == 16. ? 2. : i;
    i = p.x == 27. && p.y == 14. ? 2. : i;
    i = p.x == 14. && p.y == 12. ? 2. : i;
    i = p.x == 19. && p.y == 12. ? 2. : i;
    i = p.x == 23. && p.y == 12. ? 2. : i;
    i = p.x == 1. && p.y == 10. ? 2. : i;
    i = p.x == 11. && p.y == 3. ? 2. : i;
    i = p.x == 13. && p.y == 3. ? 2. : i;
    i = p.x == 27. && p.y == 3. ? 2. : i;
    i = p.x == 23. && p.y == 1. ? 2. : i;
    i = p.x == 1. && p.y == 29. ? 3. : i;
    i = p.x == 8. && p.y == 10. ? 3. : i;
    i = p.x == 19. && p.y == 7. ? 3. : i;
    i = p.x == 3. && p.y == 30. ? 4. : i;
    i = p.x == 12. && p.y == 30. ? 4. : i;
    i = p.x == 2. && p.y == 25. ? 4. : i;
    i = p.x == 20. && p.y == 24. ? 4. : i;
    i = p.x == 22. && p.y == 24. ? 4. : i;
    i = p.x == 6. && p.y == 22. ? 4. : i;
    i = p.x == 12. && p.y == 21. ? 4. : i;
    i = p.x == 19. && p.y == 20. ? 4. : i;
    i = p.x == 27. && p.y == 20. ? 4. : i;
    i = p.x == 12. && p.y == 19. ? 4. : i;
    i = p.x == 1. && p.y == 17. ? 4. : i;
    i = p.x == 19. && p.y == 16. ? 4. : i;
    i = p.x == 17. && p.y == 14. ? 4. : i;
    i = p.x == 15. && p.y == 10. ? 4. : i;
    i = p.x == 12. && p.y == 9. ? 4. : i;
    i = p.x == 7. && p.y == 7. ? 4. : i;
    i = p.x == 20. && p.y == 7. ? 4. : i;
    i = p.x == 9. && p.y == 2. ? 4. : i;
    i = p.x == 19. && p.y == 2. ? 4. : i;
    i = p.x == 10. && p.y == 29. ? 5. : i;
    i = p.x == 22. && p.y == 29. ? 5. : i;
    i = p.x == 25. && p.y == 29. ? 5. : i;
    i = p.x == 13. && p.y == 24. ? 5. : i;
    i = p.x == 30. && p.y == 24. ? 5. : i;
    i = p.x == 16. && p.y == 16. ? 5. : i;
    i = p.x == 30. && p.y == 11. ? 5. : i;
    i = p.x == 6. && p.y == 10. ? 5. : i;
    i = p.x == 1. && p.y == 8. ? 5. : i;
    i = p.x == 21. && p.y == 7. ? 5. : i;
    i = p.x == 26. && p.y == 5. ? 5. : i;
    return p.x < 0. || p.y < 0. || p.x > 31. || p.y > 31. ? vec4( 0. ) : vec4( t, i, 0., 0. );
}

float Rand( vec2 n )
{
	return fract( sin( dot( n.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{
    // don't compute map outside of map area
    if ( fragCoord.x >= 40. || fragCoord.y >= 40. ) 
    {
		discard;    
    }    
    
    vec2 tile = floor( fragCoord );
    
    vec4 map = texelFetch( iChannel1, ivec2( tile ), 0 );
    
    GameState s;
    LoadState( s );    
    
    // create map
	if ( s.state == STATE_START || s.state == STATE_NEXT_LEVEL || iFrame < 1 )
    {
        map = Map( tile );
    }   
    
    if ( tile == s.playerPos )
    {
     	if ( s.tick == 1. && ( map.y == ITEM_KEY || map.y == ITEM_FOOD || map.y == ITEM_POTION ) )
        {
            // pickup item
			map.y = 0.;
        }
     	if ( map.x == TILE_DOOR_LOCKED && s.tick == TICK_NUM )
        {
			map.x = TILE_DOOR_OPEN;
        }    
     	if ( map.x == TILE_TRAP && s.tick == 1. )
        {
			map.x = TILE_TRAP_OFF;
        }           
    }
    
    for ( int i = 0; i < ENEMY_NUM; ++i )
    {
        if ( tile == s.enemyPos[ i ] && map.x == TILE_TRAP && s.tick == 1. )
        {
            map.x = TILE_TRAP_OFF;
        }
    }
    
    if ( tile == s.bodyPos && map.x == TILE_TRAP )
    {
		map.x = TILE_TRAP_OFF;
    }
    
    // fog of war
    if ( s.state == STATE_GAME && length( s.playerPos - tile ) < 5. )
    {    
        map.w = 1.;
    }
    
    if ( s.state == STATE_GAME && tile == s.bodyPos )
    {
        map.z = s.bodyId;
    }

    if ( tile == s.playerPos && s.hp <= 0. )
    {
        map.z = 2.;
    }
    
    for ( int i = 0; i < ENEMY_NUM; ++i )
    {
        if ( s.state == STATE_GAME && s.enemyPos[ i ].x > 0. && tile == s.enemySpawnPos[ i ] )
        {
            map.y = 0.;
        }
    }
    
    if ( s.state == STATE_GAME && s.despawnPos.x > 0. && tile == s.despawnPos )
    {
        map.y = s.despawnId > 0. ? ITEM_SPAWNER_2 : ITEM_SPAWNER;
    }

 	fragColor = map;
}`;

const buffC = `
// background

const float TICK_NUM			= 10.;
const float TILE_FLOOR			= 1.;
const float TILE_DOOR_OPEN		= 2.;
const float TILE_STAIRS_DOWN	= 3.;
const float TILE_TRAP			= 4.;
const float TILE_TRAP_OFF		= 5.;
const float TILE_WALL			= 6.;
const float TILE_WALL_HOLE		= 7.;
const float TILE_DOOR_LOCKED	= 8.;
const float TILE_STAIRS_UP		= 9.;
const float ITEM_KEY			= 1.;
const float ITEM_FOOD			= 2.;
const float ITEM_POTION			= 3.;
const float ITEM_SPAWNER		= 3.;
const float STATE_START			= 0.;
const float STATE_GAME			= 1.;
const float STATE_NEXT_LEVEL	= 2.;
const float STATE_GAME_OVER		= 3.;

const vec2  REF_RES	            = vec2( 200. );

const int   ENEMY_NUM			= 3;
const int   LOG_NUM				= 4;

struct GameState
{
    // 0   
    float	tick;
    float 	hp;
    float 	level;
    float 	xp;
    float 	keyNum;
    
	// 1
    vec2 	playerPos;
    float   playerFrame;
    float   playerDir;
    vec2	bodyPos;
    float   bodyId;
    
    // 2
    float 	state;
    float   keyLock;
    float 	stateTime;
    vec2	despawnPos;
    float   despawnId;

    // 3
    vec2	enemyPos[ ENEMY_NUM ];
    float 	enemyFrame[ ENEMY_NUM ];
    float 	enemyDir[ ENEMY_NUM ];
    float 	enemyHP[ ENEMY_NUM ];
    float 	enemyId[ ENEMY_NUM ];
    vec2    enemySpawnPos[ ENEMY_NUM ];
    
    // 4
    vec2	logPos[ LOG_NUM ];
    float   logLife[ LOG_NUM ];
    float   logId[ LOG_NUM ];
    float   logVal[ LOG_NUM ];
};

vec4 LoadValue( int x, int y )
{
    return texelFetch( iChannel0, ivec2( x, y ), 0 );
}    

float PackXY( float a, float b )
{
    return floor( a ) + floor( b ) / 256.;
}

float PackXY( vec2 v )
{
    return PackXY( v.x, v.y );
}

float UnpackX( float a )
{
    return floor( a );
}

float UnpackY( float a )
{
    return fract( a ) * 256.;
}

vec2 UnpackXY( float a )
{
    return vec2( UnpackX( a ), UnpackY( a ) );
}

void LoadState( out GameState s )
{
    vec4 data;

    data = LoadValue( 0, 0 );
    s.tick 		= data.x;
    s.hp    	= UnpackX( data.y );
    s.level    	= UnpackY( data.y );
    s.xp        = data.z;
    s.keyNum    = data.w;
    
    data = LoadValue( 1, 0 );
    s.playerPos   = UnpackXY( data.x );
    s.playerFrame = UnpackX( data.y );
    s.playerDir   = UnpackY( data.y );
    s.bodyPos	  = UnpackXY( data.z );
    s.bodyId      = data.w;
    
    data = LoadValue( 2, 0 );
    s.state      = UnpackX( data.x );
    s.keyLock    = UnpackY( data.x );
    s.stateTime  = data.y;
    s.despawnPos = UnpackXY( data.z );
    s.despawnId  = data.w;

    for ( int i = 0; i < ENEMY_NUM; ++i )
    {
        data = LoadValue( 3, i );
        s.enemyPos[ i ]      = UnpackXY( data.x );
        s.enemyFrame[ i ]    = UnpackX( data.y );
        s.enemyDir[ i ]      = UnpackY( data.y );
        s.enemyHP[ i ]       = UnpackX( data.z );
        s.enemyId[ i ]       = UnpackY( data.z );
        s.enemySpawnPos[ i ] = UnpackXY( data.w );
    }
    
    for ( int i = 0; i < LOG_NUM; ++i )
    {
		data = LoadValue( 4, i );
    	s.logPos[ i ]  = data.xy;
        s.logLife[ i ] = data.z;
        s.logId[ i ]   = UnpackX( data.w );
        s.logVal[ i ]  = UnpackY( data.w );
    }    
}

float saturate( float x )
{
    return clamp( x, 0., 1. );
}

float Smooth( float x )
{
	return smoothstep( 0., 1., saturate( x ) );   
}

void SpriteEarth( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 15. ? ( p.x < 8. ? 17961233 : ( p.x < 16. ? 536941073 : 0 ) ) : v;
	v = p.y == 14. ? ( p.x < 8. ? 18944274 : ( p.x < 16. ? 269549841 : 0 ) ) : v;
	v = p.y == 13. ? ( p.x < 8. ? 269553937 : ( p.x < 16. ? 554766353 : 0 ) ) : v;
	v = p.y == 12. ? ( p.x < 8. ? 1118481 : ( p.x < 16. ? 572662032 : 0 ) ) : v;
	v = p.y == 11. ? ( p.x < 8. ? 554766609 : ( p.x < 16. ? 555815424 : 0 ) ) : v;
	v = p.y == 10. ? ( p.x < 8. ? 572662049 : ( p.x < 16. ? 286261777 : 0 ) ) : v;
	v = p.y == 9. ? ( p.x < 8. ? 16781602 : ( p.x < 16. ? 268440097 : 0 ) ) : v;
	v = p.y == 8. ? ( p.x < 8. ? 4385 : ( p.x < 16. ? 536875298 : 0 ) ) : v;
	v = p.y == 7. ? ( p.x < 8. ? 303108641 : ( p.x < 16. ? 286265617 : 0 ) ) : v;
	v = p.y == 6. ? ( p.x < 8. ? 35790865 : ( p.x < 16. ? 304152593 : 0 ) ) : v;
	v = p.y == 5. ? ( p.x < 8. ? 16843025 : ( p.x < 16. ? 286327056 : 0 ) ) : v;
	v = p.y == 4. ? ( p.x < 8. ? 16781841 : ( p.x < 16. ? 286261521 : 0 ) ) : v;
	v = p.y == 3. ? ( p.x < 8. ? 285352193 : ( p.x < 16. ? 287310081 : 0 ) ) : v;
	v = p.y == 2. ? ( p.x < 8. ? 70162 : ( p.x < 16. ? 269484049 : 0 ) ) : v;
	v = p.y == 1. ? ( p.x < 8. ? 4625 : ( p.x < 16. ? 269488417 : 0 ) ) : v;
	v = p.y == 0. ? ( p.x < 8. ? 529 : ( p.x < 16. ? 268505361 : 0 ) ) : v;
    float i = float( ( v >> int( 4. * p.x ) ) & 15 );
    color = vec3( 0.16, 0.14, 0.14 );
    color = i == 1. ? vec3( 0.17, 0.16, 0.15 ) : color;
    color = i == 2. ? vec3( 0.19, 0.17, 0.16 ) : color;
}

void SpriteEarth2( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 13. ? 0 : v;
	v = p.y == 12. ? ( p.x < 8. ? 0 : ( p.x < 16. ? 8960 : 0 ) ) : v;
	v = p.y == 11. ? ( p.x < 8. ? 0 : ( p.x < 16. ? 69920 : 0 ) ) : v;
	v = p.y == 10. ? ( p.x < 8. ? 16 : 0 ) : v;
	v = p.y == 9. ? 0 : v;
	v = p.y == 8. ? ( p.x < 8. ? 3342336 : 0 ) : v;
	v = p.y == 7. ? ( p.x < 8. ? 35794944 : ( p.x < 16. ? 65536 : 0 ) ) : v;
	v = p.y == 6. ? ( p.x < 8. ? 17899520 : 0 ) : v;
	v = p.y == 5. ? 0 : v;
	v = p.y == 4. ? 0 : v;
	v = p.y == 3. ? ( p.x < 8. ? 0 : ( p.x < 16. ? 1 : 0 ) ) : v;
	v = p.y == 2. ? 0 : v;
	v = p.y == 1. ? ( p.x < 8. ? 8192 : ( p.x < 16. ? 12288 : 0 ) ) : v;
	v = p.y == 0. ? ( p.x < 8. ? 0 : ( p.x < 16. ? 70144 : 0 ) ) : v;
    float i = float( ( v >> int( 4. * p.x ) ) & 15 );
    color = i == 1. ? vec3( 0.42, 0.4, 0.38 ) : color;
    color = i == 2. ? vec3( 0.55, 0.53, 0.51 ) : color;
    color = i == 3. ? vec3( 0.72, 0.69, 0.65 ) : color;
}

void SpriteWater( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 15. ? ( p.x < 8. ? 286404882 : ( p.x < 16. ? 842142226 : 0 ) ) : v;
	v = p.y == 14. ? ( p.x < 8. ? 286261795 : ( p.x < 16. ? 286405169 : 0 ) ) : v;
	v = p.y == 13. ? ( p.x < 8. ? 269553970 : ( p.x < 16. ? 286339873 : 0 ) ) : v;
	v = p.y == 12. ? ( p.x < 8. ? 17965330 : ( p.x < 16. ? 554840865 : 0 ) ) : v;
	v = p.y == 11. ? ( p.x < 8. ? 1179665 : ( p.x < 16. ? 322122513 : 0 ) ) : v;
	v = p.y == 10. ? ( p.x < 8. ? 19988481 : ( p.x < 16. ? 858923265 : 0 ) ) : v;
	v = p.y == 9. ? ( p.x < 8. ? 303108385 : ( p.x < 16. ? 303116817 : 0 ) ) : v;
	v = p.y == 8. ? ( p.x < 8. ? 273 : ( p.x < 16. ? 287449616 : 0 ) ) : v;
	v = p.y == 7. ? ( p.x < 8. ? 17826065 : ( p.x < 16. ? 303112464 : 0 ) ) : v;
	v = p.y == 6. ? ( p.x < 8. ? 285212945 : ( p.x < 16. ? 285212945 : 0 ) ) : v;
	v = p.y == 5. ? ( p.x < 8. ? 16777233 : ( p.x < 16. ? 553648400 : 0 ) ) : v;
	v = p.y == 4. ? ( p.x < 8. ? 17825793 : ( p.x < 16. ? 287375360 : 0 ) ) : v;
	v = p.y == 3. ? ( p.x < 8. ? 268435457 : ( p.x < 16. ? 571613184 : 0 ) ) : v;
	v = p.y == 2. ? ( p.x < 8. ? 268439826 : ( p.x < 16. ? 822153489 : 0 ) ) : v;
	v = p.y == 1. ? ( p.x < 8. ? 268439827 : ( p.x < 16. ? 805380369 : 0 ) ) : v;
	v = p.y == 0. ? ( p.x < 8. ? 286339345 : ( p.x < 16. ? 841158944 : 0 ) ) : v;
    float i = float( ( v >> int( 4. * p.x ) ) & 15 );
    color = vec3( 0.21, 0.38, 0.29 );
    color = i == 1. ? vec3( 0.24, 0.41, 0.33 ) : color;
    color = i == 2. ? vec3( 0.27, 0.44, 0.36 ) : color;
    color = i == 3. ? vec3( 0.3, 0.47, 0.37 ) : color;
}

void SpriteFloor( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 15. ? ( p.x < 4. ? 33555717 : ( p.x < 8. ? 84149251 : ( p.x < 12. ? 67371267 : 67437569 ) ) ) : v;
	v = p.y == 14. ? ( p.x < 4. ? 16844037 : ( p.x < 8. ? 16777216 : ( p.x < 12. ? 65793 : 50594817 ) ) ) : v;
	v = p.y == 13. ? ( p.x < 4. ? 33620997 : ( p.x < 8. ? 197893 : ( p.x < 12. ? 33752323 : 50660608 ) ) ) : v;
	v = p.y == 12. ? ( p.x < 4. ? 67109893 : ( p.x < 8. ? 328709 : ( p.x < 12. ? 67306756 : 84149504 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 4. ? 83886851 : ( p.x < 8. ? 263428 : ( p.x < 12. ? 50660099 : 84214272 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 83886337 : ( p.x < 8. ? 17040644 : ( p.x < 12. ? 65537 : 16843009 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 50397957 : ( p.x < 8. ? 328965 : ( p.x < 12. ? 84215042 : 67371266 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 83952645 : ( p.x < 8. ? 17106181 : ( p.x < 12. ? 84149508 : 67436547 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 33620485 : ( p.x < 8. ? 16909317 : ( p.x < 12. ? 84214788 : 67240197 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 16842752 : ( p.x < 8. ? 257 : ( p.x < 12. ? 84149508 : 65540 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 50594305 : ( p.x < 8. ? 132101 : ( p.x < 12. ? 67372293 : 67371269 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 67437825 : ( p.x < 8. ? 17040645 : ( p.x < 12. ? 50595075 : 67371010 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 67371777 : ( p.x < 8. ? 16974852 : ( p.x < 12. ? 65792 : 84213760 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 16777216 : ( p.x < 8. ? 16843009 : ( p.x < 12. ? 50528256 : 65537 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 33620485 : ( p.x < 8. ? 67437828 : ( p.x < 12. ? 84148226 : 67437312 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 83952645 : ( p.x < 8. ? 84214532 : ( p.x < 12. ? 84148484 : 84215040 ) ) ) : v;
    float i = float( ( v >> int( 8.0 * p.x ) ) & 255 );
    color = vec3( 0.21, 0.2, 0.19 );
    color = i == 1. ? vec3( 0.23, 0.23, 0.21 ) : color;
    color = i == 2. ? vec3( 0.27, 0.27, 0.25 ) : color;
    color = i == 3. ? vec3( 0.3, 0.29, 0.28 ) : color;
    color = i == 4. ? vec3( 0.31, 0.31, 0.29 ) : color;
    color = i == 5. ? vec3( 0.33, 0.32, 0.31 ) : color;
}

void SpriteWood( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 15. ? ( p.x < 8. ? 17830178 : ( p.x < 16. ? 286401058 : 0 ) ) : v;
	v = p.y == 14. ? 0 : v;
	v = p.y == 13. ? ( p.x < 8. ? 303182643 : ( p.x < 16. ? 806424850 : 0 ) ) : v;
	v = p.y == 12. ? 0 : v;
	v = p.y == 11. ? ( p.x < 8. ? 807481906 : ( p.x < 16. ? 858993459 : 0 ) ) : v;
	v = p.y == 10. ? ( p.x < 8. ? 537989394 : ( p.x < 16. ? 304222738 : 0 ) ) : v;
	v = p.y == 9. ? 0 : v;
	v = p.y == 8. ? ( p.x < 8. ? 572732211 : ( p.x < 16. ? 34677025 : 0 ) ) : v;
	v = p.y == 7. ? ( p.x < 8. ? 554832402 : ( p.x < 16. ? 19013905 : 0 ) ) : v;
	v = p.y == 6. ? 0 : v;
	v = p.y == 5. ? ( p.x < 8. ? 288568115 : ( p.x < 16. ? 858993410 : 0 ) ) : v;
	v = p.y == 4. ? ( p.x < 8. ? 286331426 : ( p.x < 16. ? 286331137 : 0 ) ) : v;
	v = p.y == 3. ? 0 : v;
	v = p.y == 2. ? ( p.x < 8. ? 572732208 : ( p.x < 16. ? 303174161 : 0 ) ) : v;
	v = p.y == 1. ? 0 : v;
	v = p.y == 0. ? ( p.x < 8. ? 34677011 : ( p.x < 16. ? 858993459 : 0 ) ) : v;
    float i = float( ( v >> int( 4. * p.x ) ) & 15 );
    color = vec3( 0.25, 0.18, 0.098 );
    color = i == 1. ? vec3( 0.31, 0.23, 0.11 ) : color;
    color = i == 2. ? vec3( 0.35, 0.26, 0.12 ) : color;
    color = i == 3. ? vec3( 0.4, 0.29, 0.12 ) : color;
}

void SpriteWall( inout vec3 color, vec2 p )
{    
    int v = 0;
	v = p.y == 15. ? ( p.x < 4. ? 100927239 : ( p.x < 8. ? 17106437 : ( p.x < 12. ? 67372806 : 328452 ) ) ) : v;
	v = p.y == 14. ? ( p.x < 4. ? 117901063 : ( p.x < 8. ? 17171974 : ( p.x < 12. ? 101123847 : 393991 ) ) ) : v;
	v = p.y == 13. ? ( p.x < 4. ? 84280838 : ( p.x < 8. ? 329222 : ( p.x < 12. ? 84281094 : 329221 ) ) ) : v;
	v = p.y == 12. ? ( p.x < 4. ? 1 : ( p.x < 8. ? 65537 : ( p.x < 12. ? 256 : 16777472 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 4. ? 17105926 : ( p.x < 8. ? 117703683 : ( p.x < 12. ? 17171975 : 117901062 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 17172231 : ( p.x < 8. ? 117835526 : ( p.x < 12. ? 460295 : 117901063 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 329222 : ( p.x < 8. ? 84346629 : ( p.x < 12. ? 17106437 : 84281093 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 16842753 : ( p.x < 8. ? 16843009 : ( p.x < 12. ? 16777473 : 65536 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 67372036 : ( p.x < 8. ? 101058052 : ( p.x < 12. ? 67372545 : 100664836 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 117900038 : ( p.x < 8. ? 101058311 : ( p.x < 12. ? 67503872 : 100730374 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 84280839 : ( p.x < 8. ? 84215046 : ( p.x < 12. ? 84280577 : 83887366 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 65793 : ( p.x < 8. ? 16777473 : ( p.x < 12. ? 257 : 0 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 84281095 : ( p.x < 8. ? 117703424 : ( p.x < 12. ? 33818119 : 117900032 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 117835270 : ( p.x < 8. ? 117901057 : ( p.x < 12. ? 117900806 : 101122817 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 84280583 : ( p.x < 8. ? 101123328 : ( p.x < 12. ? 84215046 : 101123584 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 16842753 : ( p.x < 8. ? 16842752 : ( p.x < 12. ? 16777472 : 16843008 ) ) ) : v;
    float i = float( ( v >> int( 8.0 * p.x ) ) & 255 );
    color = vec3( 0.33 );
    color = i == 1. ? vec3( 0.38 ) : color;
    color = i == 2. ? vec3( 0.5, 0.6, 0.56 ) : color;
    color = i == 3. ? vec3( 0.55, 0.65, 0.6 ) : color;
    color = i == 4. ? vec3( 0.61, 0.71, 0.66 ) : color;
    color = i == 5. ? vec3( 0.67 ) : color;
    color = i == 6. ? vec3( 0.75 ) : color;
    color = i == 7. ? vec3( 0.85 ) : color;
}

void SpriteWallHole( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 15. ? ( p.x < 4. ? 100992775 : ( p.x < 8. ? 50660869 : ( p.x < 12. ? 84215558 : 33883141 ) ) ) : v;
	v = p.y == 14. ? ( p.x < 4. ? 117901063 : ( p.x < 8. ? 33817606 : ( p.x < 12. ? 100992261 : 33948679 ) ) ) : v;
	v = p.y == 13. ? ( p.x < 4. ? 84280838 : ( p.x < 8. ? 117901060 : ( p.x < 12. ? 67569415 : 33883653 ) ) ) : v;
	v = p.y == 12. ? ( p.x < 4. ? 33686019 : ( p.x < 8. ? 101058054 : ( p.x < 12. ? 101058054 : 50463490 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 4. ? 100926726 : ( p.x < 8. ? 101058054 : ( p.x < 12. ? 101058054 : 117900550 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 100927239 : ( p.x < 8. ? 67078 : ( p.x < 12. ? 101056768 : 117900550 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 100926982 : ( p.x < 8. ? 518 : ( p.x < 12. ? 100794368 : 84280582 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 100794883 : ( p.x < 8. ? 16777734 : ( p.x < 12. ? 100794369 : 33751558 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 100926725 : ( p.x < 8. ? 16843014 : ( p.x < 12. ? 100729089 : 100795398 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 100992006 : ( p.x < 8. ? 33620998 : ( p.x < 12. ? 100925698 : 100860934 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 100926983 : ( p.x < 8. ? 67372550 : ( p.x < 12. ? 101057540 : 84018182 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 16909059 : ( p.x < 8. ? 67503622 : ( p.x < 12. ? 101057542 : 33686017 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 67372807 : ( p.x < 8. ? 67503617 : ( p.x < 12. ? 33949190 : 117900034 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 84280838 : ( p.x < 8. ? 50529026 : ( p.x < 12. ? 84083202 : 101123074 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 84280583 : ( p.x < 8. ? 50594818 : ( p.x < 12. ? 67371779 : 101123586 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 50528771 : ( p.x < 8. ? 33686018 : ( p.x < 12. ? 50463234 : 50529026 ) ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = vec3( 0.059, 0.059, 0.035 );
    color = i == 1. ? vec3( 0.18, 0.19, 0.16 ) : color;
    color = i == 2. ? vec3( 0.28, 0.29, 0.29 ) : color;
    color = i == 3. ? vec3( 0.4, 0.44, 0.42 ) : color;
    color = i == 4. ? vec3( 0.54, 0.58, 0.56 ) : color;
    color = i == 5. ? vec3( 0.64, 0.69, 0.67 ) : color;
    color = i == 6. ? vec3( 0.75 ) : color;
    color = i == 7. ? vec3( 0.88 ) : color;
}

void SpriteDoorClosed( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 15. ? ( p.x < 4. ? 117769991 : ( p.x < 8. ? 50661125 : ( p.x < 12. ? 84215559 : 50660613 ) ) ) : v;
	v = p.y == 14. ? ( p.x < 4. ? 16844551 : ( p.x < 8. ? 16843009 : ( p.x < 12. ? 16843009 : 50790657 ) ) ) : v;
	v = p.y == 13. ? ( p.x < 4. ? 67176199 : ( p.x < 8. ? 33686018 : ( p.x < 12. ? 33686018 : 50659586 ) ) ) : v;
	v = p.y == 12. ? ( p.x < 4. ? 67175171 : ( p.x < 8. ? 16843010 : ( p.x < 12. ? 33620225 : 50528514 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 4. ? 16844039 : ( p.x < 8. ? 258 : ( p.x < 12. ? 33619968 : 117899522 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 16844295 : ( p.x < 8. ? 258 : ( p.x < 12. ? 33619968 : 117899522 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 16844295 : ( p.x < 8. ? 16843010 : ( p.x < 12. ? 33620225 : 84345090 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 33620739 : ( p.x < 8. ? 33686018 : ( p.x < 12. ? 33817090 : 50528514 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 33621253 : ( p.x < 8. ? 33686018 : ( p.x < 12. ? 16908802 : 100925697 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 33621255 : ( p.x < 8. ? 33817090 : ( p.x < 12. ? 16909314 : 117702913 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 16844295 : ( p.x < 8. ? 33686018 : ( p.x < 12. ? 33686018 : 84148482 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 16843779 : ( p.x < 8. ? 33686018 : ( p.x < 12. ? 33686018 : 50528514 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 16844295 : ( p.x < 8. ? 33686018 : ( p.x < 12. ? 33686018 : 117899522 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 67176199 : ( p.x < 8. ? 33686018 : ( p.x < 12. ? 33686018 : 117899522 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 67175687 : ( p.x < 8. ? 33686018 : ( p.x < 12. ? 33686018 : 117899522 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 16843523 : ( p.x < 8. ? 16843009 : ( p.x < 12. ? 16843009 : 50528513 ) ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = vec3( 0 );
    color = i == 1. ? vec3( 0.19, 0.14, 0.14 ) : color;
    color = i == 2. ? vec3( 0.4, 0.26, 0.098 ) : color;
    color = i == 3. ? vec3( 0.35 ) : color;
    color = i == 4. ? vec3( 0.53, 0.38, 0.19 ) : color;
    color = i == 5. ? vec3( 0.59, 0.67, 0.64 ) : color;
    color = i == 6. ? vec3( 0.8, 0.64, 0.49 ) : color;
    color = i == 7. ? vec3( 0.8 ) : color;
}

void SpriteDoorOpen( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 15. ? ( p.x < 4. ? 100927239 : ( p.x < 8. ? 33818116 : ( p.x < 12. ? 67372806 : 33817604 ) ) ) : v;
	v = p.y == 14. ? ( p.x < 4. ? 16844551 : ( p.x < 8. ? 16843009 : ( p.x < 12. ? 16843009 : 33947905 ) ) ) : v;
	v = p.y == 13. ? ( p.x < 4. ? 67078 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 33816832 ) ) ) : v;
	v = p.y == 12. ? ( p.x < 4. ? 66050 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 33685760 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 4. ? 66566 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 117899520 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 66823 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 117899520 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 66822 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 67502336 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 66050 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 33685760 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 66564 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 84082944 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 66566 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 100860160 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 66823 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 67305728 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 66306 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 33685760 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 66823 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 117899520 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 67078 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 101122304 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 66567 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 101122304 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 66050 : ( p.x < 8. ? 0 : ( p.x < 12. ? 0 : 33685760 ) ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0.15, 0.15, 0.14 ) : color;
    color = i == 2. ? vec3( 0.35 ) : color;
    color = i == 3. ? vec3( 0.53, 0.37, 0.21 ) : color;
    color = i == 4. ? vec3( 0.59, 0.67, 0.64 ) : color;
    color = i == 5. ? vec3( 0.8, 0.64, 0.49 ) : color;
    color = i == 6. ? vec3( 0.75 ) : color;
    color = i == 7. ? vec3( 0.85 ) : color;
}

void SpriteDoorLocked( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 15. ? ( p.x < 4. ? 117769991 : ( p.x < 8. ? 50661125 : ( p.x < 12. ? 84215559 : 50660613 ) ) ) : v;
	v = p.y == 14. ? ( p.x < 4. ? 16844551 : ( p.x < 8. ? 16843009 : ( p.x < 12. ? 16843009 : 50790657 ) ) ) : v;
	v = p.y == 13. ? ( p.x < 4. ? 67176199 : ( p.x < 8. ? 33685762 : ( p.x < 12. ? 33686017 : 50659586 ) ) ) : v;
	v = p.y == 12. ? ( p.x < 4. ? 67175171 : ( p.x < 8. ? 16843010 : ( p.x < 12. ? 33620225 : 50528514 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 4. ? 16844039 : ( p.x < 8. ? 258 : ( p.x < 12. ? 33619968 : 117899522 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 16844295 : ( p.x < 8. ? 84214017 : ( p.x < 12. ? 16843525 : 117899522 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 16844295 : ( p.x < 8. ? 50529537 : ( p.x < 12. ? 16974595 : 84345090 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 33620739 : ( p.x < 8. ? 16974594 : ( p.x < 12. ? 16974593 : 50528513 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 33621253 : ( p.x < 8. ? 84215045 : ( p.x < 12. ? 84215045 : 100925697 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 33621255 : ( p.x < 8. ? 50529029 : ( p.x < 12. ? 50529027 : 117702913 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 16844295 : ( p.x < 8. ? 197381 : ( p.x < 12. ? 50529024 : 84148481 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 16843779 : ( p.x < 8. ? 197381 : ( p.x < 12. ? 50529024 : 50528513 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 16844295 : ( p.x < 8. ? 50529029 : ( p.x < 12. ? 50529027 : 117899521 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 33621767 : ( p.x < 8. ? 50529027 : ( p.x < 12. ? 50529027 : 117899521 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 33621255 : ( p.x < 8. ? 16843009 : ( p.x < 12. ? 16843265 : 117899521 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 16843523 : ( p.x < 8. ? 16843009 : ( p.x < 12. ? 16843009 : 50528513 ) ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = vec3( 0.024, 0.0078, 0 );
    color = i == 1. ? vec3( 0.19, 0.13, 0.11 ) : color;
    color = i == 2. ? vec3( 0.38, 0.25, 0.094 ) : color;
    color = i == 3. ? vec3( 0.42, 0.39, 0.38 ) : color;
    color = i == 4. ? vec3( 0.53, 0.38, 0.2 ) : color;
    color = i == 5. ? vec3( 0.59, 0.62, 0.56 ) : color;
    color = i == 6. ? vec3( 0.8, 0.64, 0.49 ) : color;
    color = i == 7. ? vec3( 0.8 ) : color;
}

void SpriteStairsDown( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 15. ? ( p.x < 4. ? 50529284 : ( p.x < 8. ? 67306243 : ( p.x < 12. ? 67372036 : 50594820 ) ) ) : v;
	v = p.y == 14. ? ( p.x < 4. ? 117901060 : ( p.x < 8. ? 117835271 : ( p.x < 12. ? 101123847 : 50726407 ) ) ) : v;
	v = p.y == 13. ? ( p.x < 4. ? 33751553 : ( p.x < 8. ? 33751555 : ( p.x < 12. ? 33620483 : 50791170 ) ) ) : v;
	v = p.y == 12. ? ( p.x < 4. ? 50529028 : ( p.x < 8. ? 16908548 : ( p.x < 12. ? 16843265 : 67568129 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 4. ? 117835523 : ( p.x < 8. ? 16843011 : ( p.x < 12. ? 16842753 : 67567873 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 117835524 : ( p.x < 8. ? 50463235 : ( p.x < 12. ? 65539 : 67567873 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 101123844 : ( p.x < 8. ? 84215044 : ( p.x < 12. ? 2 : 50790400 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 117901060 : ( p.x < 8. ? 84280580 : ( p.x < 12. ? 33620482 : 50790401 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 117900804 : ( p.x < 8. ? 84215044 : ( p.x < 12. ? 84149250 : 50724866 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 117900803 : ( p.x < 8. ? 84215044 : ( p.x < 12. ? 84149506 : 50790657 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 101123844 : ( p.x < 8. ? 84215044 : ( p.x < 12. ? 67372034 : 50725890 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 101123844 : ( p.x < 8. ? 100992260 : ( p.x < 12. ? 67372035 : 50725377 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 101123844 : ( p.x < 8. ? 84215043 : ( p.x < 12. ? 67437570 : 67568129 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 67306243 : ( p.x < 8. ? 50529028 : ( p.x < 12. ? 16908546 : 50790658 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 101123588 : ( p.x < 8. ? 117901062 : ( p.x < 12. ? 117835270 : 50792199 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 67371780 : ( p.x < 8. ? 67371779 : ( p.x < 12. ? 67306499 : 67372035 ) ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = vec3( 0.13 );
    color = i == 1. ? vec3( 0.2 ) : color;
    color = i == 2. ? vec3( 0.26 ) : color;
    color = i == 3. ? vec3( 0.31 ) : color;
    color = i == 4. ? vec3( 0.35 ) : color;
    color = i == 5. ? vec3( 0.44 ) : color;
    color = i == 6. ? vec3( 0.51 ) : color;
    color = i == 7. ? vec3( 0.56 ) : color;
}

void SpriteStairsUp( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 15. ? ( p.x < 4. ? 50529284 : ( p.x < 8. ? 84215045 : ( p.x < 12. ? 84214533 : 84215043 ) ) ) : v;
	v = p.y == 14. ? ( p.x < 4. ? 67569412 : ( p.x < 8. ? 50463234 : ( p.x < 12. ? 33751811 : 84215043 ) ) ) : v;
	v = p.y == 13. ? ( p.x < 4. ? 50791940 : ( p.x < 8. ? 50594820 : ( p.x < 12. ? 67437829 : 84215042 ) ) ) : v;
	v = p.y == 12. ? ( p.x < 4. ? 50726404 : ( p.x < 8. ? 50791943 : ( p.x < 12. ? 84215045 : 84215042 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 4. ? 67503875 : ( p.x < 8. ? 50726662 : ( p.x < 12. ? 67371780 : 84214786 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 67503876 : ( p.x < 8. ? 67503878 : ( p.x < 12. ? 50791943 : 50529027 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 50792196 : ( p.x < 8. ? 50792199 : ( p.x < 12. ? 67569414 : 50594819 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 16843009 : ( p.x < 8. ? 67569415 : ( p.x < 12. ? 67503878 : 50791942 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 17105665 : ( p.x < 8. ? 67503623 : ( p.x < 12. ? 67569158 : 50726663 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 17105664 : ( p.x < 8. ? 65793 : ( p.x < 12. ? 67503878 : 50791942 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 50529025 : ( p.x < 8. ? 16974597 : 50726663 ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 50529025 : ( p.x < 8. ? 16974595 : ( p.x < 12. ? 257 : 50726406 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 50529025 : ( p.x < 8. ? 50529027 : ( p.x < 12. ? 197379 : 67569158 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 50397440 : ( p.x < 8. ? 50529027 : ( p.x < 12. ? 196865 : 65536 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 16974080 : ( p.x < 8. ? 16974593 : ( p.x < 12. ? 50397441 : 197377 ) ) ) : v;
	v = p.y == 0. ? 0 : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = vec3( 0.12 );
    color = i == 1. ? vec3( 0.17 ) : color;
    color = i == 2. ? vec3( 0.21, 0.2, 0.19 ) : color;
    color = i == 3. ? vec3( 0.23, 0.23, 0.22 ) : color;
    color = i == 4. ? vec3( 0.26, 0.26, 0.25 ) : color;
    color = i == 5. ? vec3( 0.31, 0.31, 0.29 ) : color;
    color = i == 6. ? vec3( 0.5 ) : color;
    color = i == 7. ? vec3( 0.53 ) : color;
}

void SpriteKey( inout vec3 color, vec2 p )
{
    p -= vec2( 5., 2. );
    p = p.x < 0. ? vec2( 0. ) : p;    
    
    int v = 0;
	v = p.y == 11. ? ( p.x < 8. ? 139824 : 0 ) : v;
	v = p.y == 10. ? ( p.x < 8. ? 2232611 : 0 ) : v;
	v = p.y == 9. ? ( p.x < 8. ? 1179666 : 0 ) : v;
	v = p.y == 8. ? ( p.x < 8. ? 1245202 : 0 ) : v;
	v = p.y == 7. ? ( p.x < 8. ? 1192482 : 0 ) : v;
	v = p.y == 6. ? ( p.x < 8. ? 74256 : 0 ) : v;
	v = p.y == 5. ? ( p.x < 8. ? 4608 : 0 ) : v;
	v = p.y == 4. ? ( p.x < 8. ? 4608 : 0 ) : v;
	v = p.y == 3. ? ( p.x < 8. ? 4608 : 0 ) : v;
	v = p.y == 2. ? ( p.x < 8. ? 2232832 : 0 ) : v;
	v = p.y == 1. ? ( p.x < 8. ? 135680 : 0 ) : v;
	v = p.y == 0. ? ( p.x < 8. ? 2232832 : 0 ) : v;
    float i = float( ( v >> int( 4. * p.x ) ) & 15 );
    color = i == 1. ? vec3( 0.45 ) : color;
    color = i == 2. ? vec3( 0.83 ) : color;
    color = i == 3. ? vec3( 0.95 ) : color;
}

void SpriteFood( inout vec3 color, vec2 p )
{
    p -= vec2( 4., 4. );
    p = p.x < 0. ? vec2( 0. ) : p;
    
    int v = 0;
	v = p.y == 7. ? ( p.x < 8. ? 3355392 : 0 ) : v;
	v = p.y == 6. ? ( p.x < 8. ? 52498736 : 0 ) : v;
	v = p.y == 5. ? ( p.x < 8. ? 839979795 : 0 ) : v;
	v = p.y == 4. ? ( p.x < 8. ? 839979283 : 0 ) : v;
	v = p.y == 3. ? ( p.x < 8. ? 839979283 : 0 ) : v;
	v = p.y == 2. ? ( p.x < 8. ? 841027875 : 0 ) : v;
	v = p.y == 1. ? ( p.x < 8. ? 52568624 : 0 ) : v;
	v = p.y == 0. ? ( p.x < 8. ? 3355392 : 0 ) : v;
    float i = float( ( v >> int( 4. * p.x ) ) & 15 );
    color = i == 1. ? vec3( 0.24 ) : color;
    color = i == 2. ? vec3( 0.29, 0.74, 0.79 ) : color;
    color = i == 3. ? vec3( 0.91 ) : color;
}

void SpritePotion( inout vec3 color, vec2 p )
{
    p -= vec2( 4., 2. );
    p = p.x < 0. ? vec2( 0. ) : p;
    
    int v = 0;
	v = p.y == 11. ? ( p.x < 4. ? 50331648 : ( p.x < 8. ? 4 : 0 ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 84280832 : ( p.x < 8. ? 394757 : 0 ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 50724864 : ( p.x < 8. ? 1540 : 0 ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 17170432 : ( p.x < 8. ? 1537 : 0 ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 17170432 : ( p.x < 8. ? 1537 : 0 ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 16844288 : ( p.x < 8. ? 393473 : 0 ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 16843014 : ( p.x < 8. ? 100729089 : 0 ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 33686022 : ( p.x < 8. ? 100796162 : 0 ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 33686022 : ( p.x < 8. ? 100796162 : 0 ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 33686022 : ( p.x < 8. ? 100794882 : 0 ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 33687040 : ( p.x < 8. ? 393730 : 0 ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 101056512 : ( p.x < 8. ? 1542 : 0 ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0.24 ) : color;
    color = i == 2. ? vec3( 0.91, 0, 0.12 ) : color;
    color = i == 3. ? vec3( 0.6, 0.38, 0.2 ) : color;
    color = i == 4. ? vec3( 0.71, 0.49, 0.31 ) : color;
    color = i == 5. ? vec3( 0.83, 0.76, 0.71 ) : color;
    color = i == 6. ? vec3( 0.85 ) : color;
    color = i == 7. ? vec3( 1 ) : color;
}

void SpriteRatDead( inout vec3 color, vec2 p )
{
    p -= vec2( 2., 1. );
    p = p.x < 0. ? vec2( 9. ) : p;  
    
    int v = 0;
	v = p.y == 8. ? ( p.x < 4. ? 33685504 : ( p.x < 8. ? 5 : 0 ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 67371520 : ( p.x < 8. ? 1 : ( p.x < 12. ? 131586 : 0 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 67371522 : ( p.x < 8. ? 50397442 : ( p.x < 12. ? 84149252 : 0 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 67372034 : ( p.x < 8. ? 67240452 : ( p.x < 12. ? 33817604 : 0 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 67371521 : ( p.x < 8. ? 50594308 : ( p.x < 12. ? 16843268 : 0 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 67372033 : ( p.x < 8. ? 67372036 : ( p.x < 12. ? 84149250 : 0 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 67371264 : ( p.x < 8. ? 67371524 : ( p.x < 12. ? 50594818 : 0 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 16844289 : ( p.x < 8. ? 67240450 : ( p.x < 12. ? 16908804 : 0 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 257 : ( p.x < 8. ? 16843009 : ( p.x < 12. ? 100729089 : 460551 ) ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0.16, 0.11, 0.071 ) : color;
    color = i == 2. ? vec3( 0.33, 0.26, 0.18 ) : color;
    color = i == 3. ? vec3( 0.58, 0.25, 0.24 ) : color;
    color = i == 4. ? vec3( 0.51, 0.44, 0.35 ) : color;
    color = i == 5. ? vec3( 0.81, 0.31, 0.33 ) : color;
    color = i == 6. ? vec3( 0.8, 0.49, 0.51 ) : color;
    color = i == 7. ? vec3( 0.93, 0.58, 0.6 ) : color;
}

void SpriteSkeletonDead( inout vec3 color, vec2 p )
{
    p -= vec2( 4., 1. );
    p = p.x < 0. ? vec2( 0. ) : p;    
    
    int v = 0;
	v = p.y == 6. ? ( p.x < 4. ? 84215040 : ( p.x < 8. ? 328965 : 0 ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 101058053 : ( p.x < 8. ? 84280838 : 0 ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 67372547 : ( p.x < 8. ? 33817604 : 0 ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 17171971 : ( p.x < 8. ? 83953158 : 0 ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 101057024 : ( p.x < 8. ? 84280326 : 0 ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 50462720 : ( p.x < 8. ? 197893 : 0 ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 33554432 : ( p.x < 8. ? 131072 : 0 ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0 ) : color;
    color = i == 2. ? vec3( 0.49 ) : color;
    color = i == 3. ? vec3( 0.64 ) : color;
    color = i == 4. ? vec3( 0.7 ) : color;
    color = i == 5. ? vec3( 0.81 ) : color;
    color = i == 6. ? vec3( 0.9 ) : color;
}

void SpriteTrap( inout vec3 color, vec2 p, float pulse )
{
    int v = 0;
	v = p.y == 15. ? 0 : v;
	v = p.y == 14. ? 0 : v;
	v = p.y == 13. ? ( p.x < 4. ? 33554432 : ( p.x < 8. ? 16777218 : ( p.x < 12. ? 33554434 : 1 ) ) ) : v;
	v = p.y == 12. ? ( p.x < 4. ? 117506048 : ( p.x < 8. ? 84017157 : ( p.x < 12. ? 84017157 : 5 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 4. ? 117440512 : ( p.x < 8. ? 83887621 : ( p.x < 12. ? 83887621 : 1543 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 100663296 : ( p.x < 8. ? 67108870 : ( p.x < 12. ? 67108868 : 4 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 33554432 : ( p.x < 8. ? 16777218 : ( p.x < 12. ? 33554434 : 2 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 83951616 : ( p.x < 8. ? 84017157 : ( p.x < 12. ? 117571589 : 517 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 83886080 : ( p.x < 8. ? 83887623 : ( p.x < 12. ? 117638661 : 1029 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 67108864 : ( p.x < 8. ? 67108868 : ( p.x < 12. ? 100664070 : 6 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 33554432 : ( p.x < 8. ? 16777218 : ( p.x < 12. ? 33554434 : 2 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 117571584 : ( p.x < 8. ? 117571589 : ( p.x < 12. ? 84017157 : 5 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 83886080 : ( p.x < 8. ? 83887621 : ( p.x < 12. ? 84018181 : 1031 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 67108864 : ( p.x < 8. ? 67108868 : ( p.x < 12. ? 100663300 : 516 ) ) ) : v;
	v = p.y == 1. ? 0 : v;
	v = p.y == 0. ? 0 : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0.13, 0.13, 0.12 ) : color;
    color = i == 2. ? vec3( 0.21, 0.2, 0.19 ) : color;
    color = i == 3. ? vec3( 0.33, 0.32, 0.31 ) : color;
    color = i == 4. ? vec3( 0.37, 0.37, 0.36 ) : color;
    color = i == 5. ? pulse * vec3( 0.93, 0.35, 0 ) : color;
    color = i == 6. ? vec3( 0.44, 0.43, 0.42 ) : color;
    color = i == 7. ? pulse * vec3( 1, 0.47, 0.051 ) : color;
}

void SpriteMoss( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 15. ? 0 : v;
	v = p.y == 14. ? 0 : v;
	v = p.y == 13. ? 0 : v;
	v = p.y == 12. ? ( p.x < 8. ? 318767104 : ( p.x < 16. ? 3145731 : 0 ) ) : v;
	v = p.y == 11. ? ( p.x < 8. ? 318767360 : ( p.x < 16. ? 52428851 : 0 ) ) : v;
	v = p.y == 10. ? ( p.x < 8. ? 321912832 : ( p.x < 16. ? 1114129 : 0 ) ) : v;
	v = p.y == 9. ? ( p.x < 8. ? 322109440 : ( p.x < 16. ? 51523586 : 0 ) ) : v;
	v = p.y == 8. ? ( p.x < 8. ? 322109440 : ( p.x < 16. ? 51589120 : 0 ) ) : v;
	v = p.y == 7. ? ( p.x < 8. ? 305135616 : ( p.x < 16. ? 34799667 : 0 ) ) : v;
	v = p.y == 6. ? ( p.x < 8. ? 285212672 : ( p.x < 16. ? 819 : 0 ) ) : v;
	v = p.y == 5. ? ( p.x < 8. ? 0 : ( p.x < 16. ? 819 : 0 ) ) : v;
	v = p.y == 4. ? ( p.x < 8. ? 196608 : 0 ) : v;
	v = p.y == 3. ? ( p.x < 8. ? 3354624 : ( p.x < 16. ? 256 : 0 ) ) : v;
	v = p.y == 2. ? ( p.x < 8. ? 1118464 : 0 ) : v;
	v = p.y == 1. ? ( p.x < 8. ? 204800 : 0 ) : v;
	v = p.y == 0. ? 0 : v;
    float i = float( ( v >> int( 4. * p.x ) ) & 15 );
    color = i == 1. ? vec3( 0.37, 0.39, 0.14 ) : color;
    color = i == 2. ? vec3( 0.39, 0.41, 0.16 ) : color;
    color = i == 3. ? vec3( 0.41, 0.42, 0.18 ) : color;
}

vec2 FrameOffset( float frame, float tick )
{
    vec2 ret = vec2( 0. );
    ret.x = frame == 1. ? 1. : ( frame == 2. ? -1. : 0. );
    ret.y = frame == 3. ? 1. : ( frame == 4. ? -1. : 0. );
    return floor( 16. * ret * ( tick / TICK_NUM ) );
}

float Rand( vec2 n )
{
	return fract( sin( dot( n.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
}

float WaterSDF( vec2 p )
{
    float ret = length( p - vec2( 16., 16. ) ) - 16.;
    ret = min( ret, length( p - vec2( 20., 60. ) ) - 16. );
    ret = min( ret, length( p - vec2( 18., 38. ) ) - 12. );
    
    ret = min( ret, length( p - vec2( 286., 20. ) ) - 36. );
    
    ret = min( ret, length( p - vec2( 20., 120. ) ) - 16. );
    ret = min( ret, length( p - vec2( 20., 160. ) ) - 16. );
    
    ret = min( ret, length( p - vec2( 16., 400. ) ) - 20. );
    
    ret = min( ret, length( p - vec2( 470., 30. ) ) - 20. );
    ret = min( ret, length( p - vec2( 480., 80. ) ) - 20. );
    ret = min( ret, length( p - vec2( 430., 10. ) ) - 20. );
    
    ret = min( ret, length( p - vec2( 415., 320. ) ) - 30. );
    
    ret = min( ret, length( p - vec2( 130., 320. ) ) - 40. );
    
	ret = min( ret, length( p - vec2( 300., 100. ) ) - 50. );    
    
    ret = min( ret, length( p - vec2( 80., 480. ) ) - 50. ); 
    
    ret = min( ret, length( p - vec2( 80., 224. ) ) - 50. ); 
    
    ret = min( ret, length( p - vec2( 200., 360. ) ) - 50. ); 
    
    ret += sin( p.y * .75 ) * 1.;    
    return floor( ret );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{    
    GameState s;
    LoadState( s );    
    
    vec2 playerPos = s.playerPos * 16. + FrameOffset( s.playerFrame, s.tick ); 
    
    vec2 resMult	= floor( iResolution.xy / REF_RES );
    float resRcp    = 1. / max( min( resMult.x, resMult.y ), 1. );
    vec2 screenSize = floor( iResolution.xy * resRcp );
    vec2 pixel      = floor( fragCoord.xy * resRcp );
    vec2 camera     = clamp( playerPos - floor( screenSize / 2. ), vec2( -32. ), vec2( 32. * 16. + 32. ) - screenSize );
    vec2 world      = pixel + camera;
    vec2 tile		= floor( world / 16. );
    vec2 worldMod16 = floor( mod( world, 16. ) );
    vec4 map		= texelFetch( iChannel1, ivec2( tile ), 0 );
    
    vec3 color = vec3( 0. );
    SpriteEarth( color, worldMod16 );
    if ( Rand( tile / 32. ) > .8 )
    {
    	SpriteEarth2( color, worldMod16 );
    }

    float waterSDF = WaterSDF( world );
    if ( map.x != 0. )
    {
		SpriteFloor( color, worldMod16 );
        
 		vec3 water;
        SpriteWater( water, floor( mod( floor( world + vec2( 0., float( iFrame ) * .2 ) ), 16. ) ) );
        
        float alpha = waterSDF >= 0. ? 0. : 1.;
        alpha = waterSDF == -1. ? 0.25 : alpha;
        alpha = waterSDF == -2. ? 0.5 : alpha;
        
    	color = mix( color, water, alpha );
    }
    
    // decoration
    if ( map.x == TILE_FLOOR && waterSDF >= 0. )
    {
		if ( Rand( tile / 32. - 3.15 ) > .8 )
    	{
       		 SpriteMoss( color, worldMod16 );
        } 
        else if ( Rand( tile / 32. - 7.19 ) > .9 )
        {
            SpriteEarth2( color, worldMod16 );
        }
        else if ( Rand( tile / 32. - 13.19 ) > .95 )
        {
            SpriteTrap( color, worldMod16, 0. );
        }   
    }
    
    if ( map.x == TILE_STAIRS_UP )
    {
        SpriteStairsUp( color, worldMod16 );
    }
    if ( map.x == TILE_STAIRS_DOWN )
    {
        SpriteStairsDown( color, worldMod16 );
    }     
    
    if ( map.x == TILE_WALL )
    {
    	SpriteWall( color, worldMod16 );
    }
    if ( map.x == TILE_WALL_HOLE )
    {
    	SpriteWallHole( color, worldMod16 );
    }       
    if ( map.x == TILE_DOOR_LOCKED )
    {
        SpriteDoorLocked( color, worldMod16 );
    }
    if ( map.x == TILE_DOOR_OPEN )
    {
        bool open = s.playerPos == tile || map.z > 0.;
		for ( int i = 0; i < ENEMY_NUM; ++i )        
        {
            if ( tile == s.enemyPos[ i ] )
            {
                open = true;
            }
        }

        if ( open )
        {
        	SpriteDoorOpen( color, worldMod16 );
        }
        else
        {
            SpriteDoorClosed( color, worldMod16 );
        }
    }
    if ( map.x == TILE_TRAP || map.x == TILE_TRAP_OFF )
    {
        SpriteTrap( color, worldMod16, map.x == TILE_TRAP ? sin( iTime * 2. ) * .25 + .75 : 0. );
    }

    if ( map.y == ITEM_KEY )
    {
        SpriteKey( color, worldMod16 );
    }
    if ( map.y == ITEM_FOOD )
    {
        SpriteFood( color, worldMod16 );
    }
    if ( map.y == ITEM_POTION )
    {
        SpritePotion( color, worldMod16 );
    }
    
    if ( map.z == 1. )
    {
        SpriteRatDead( color, worldMod16 );
    }
    
    if ( map.z == 2. )
    {
        SpriteSkeletonDead( color, worldMod16 );
    }
    
	fragColor = vec4( color, 1. );
}`;

const buffD = `
// items and enemies

const float TICK_NUM			= 10.;
const float TILE_FLOOR			= 1.;
const float TILE_DOOR_OPEN		= 2.;
const float TILE_STAIRS_DOWN	= 3.;
const float TILE_TRAP			= 4.;
const float TILE_TRAP_OFF		= 5.;
const float TILE_WALL			= 6.;
const float TILE_WALL_HOLE		= 7.;
const float TILE_DOOR_LOCKED	= 8.;
const float TILE_STAIRS_UP		= 9.;
const float ITEM_KEY			= 1.;
const float ITEM_POTION			= 2.;
const float ITEM_SPAWNER		= 3.;
const float LOG_ID_DMG			= 1.;
const float LOG_ID_XP			= 2.;
const float LOG_ID_LEVEL_UP		= 3.;
const float STATE_START			= 0.;
const float STATE_GAME			= 1.;
const float STATE_NEXT_LEVEL	= 2.;
const float STATE_GAME_OVER		= 3.;

const vec2  REF_RES	            = vec2( 200. );

const int   ENEMY_NUM			= 3;
const int   LOG_NUM				= 4;

struct GameState
{
    // 0   
    float	tick;
    float 	hp;
    float 	level;
    float 	xp;
    float 	keyNum;
    
	// 1
    vec2 	playerPos;
    float   playerFrame;
    float   playerDir;
    vec2	bodyPos;
    float   bodyId;
    
    // 2
    float 	state;
    float   keyLock;
    float 	stateTime;
    vec2	despawnPos;
    float   despawnId;

    // 3
    vec2	enemyPos[ ENEMY_NUM ];
    float 	enemyFrame[ ENEMY_NUM ];
    float 	enemyDir[ ENEMY_NUM ];
    float 	enemyHP[ ENEMY_NUM ];
    float 	enemyId[ ENEMY_NUM ];
    vec2    enemySpawnPos[ ENEMY_NUM ];
    
    // 4
    vec2	logPos[ LOG_NUM ];
    float   logLife[ LOG_NUM ];
    float   logId[ LOG_NUM ];
    float   logVal[ LOG_NUM ];
};

vec4 LoadValue( int x, int y )
{
    return texelFetch( iChannel0, ivec2( x, y ), 0 );
}    

float PackXY( float a, float b )
{
    return floor( a ) + floor( b ) / 256.;
}

float PackXY( vec2 v )
{
    return PackXY( v.x, v.y );
}

float UnpackX( float a )
{
    return floor( a );
}

float UnpackY( float a )
{
    return fract( a ) * 256.;
}

vec2 UnpackXY( float a )
{
    return vec2( UnpackX( a ), UnpackY( a ) );
}

void LoadState( out GameState s )
{
    vec4 data;

    data = LoadValue( 0, 0 );
    s.tick 		= data.x;
    s.hp    	= UnpackX( data.y );
    s.level    	= UnpackY( data.y );
    s.xp        = data.z;
    s.keyNum    = data.w;
    
    data = LoadValue( 1, 0 );
    s.playerPos   = UnpackXY( data.x );
    s.playerFrame = UnpackX( data.y );
    s.playerDir   = UnpackY( data.y );
    s.bodyPos	  = UnpackXY( data.z );
    s.bodyId      = data.w;
    
    data = LoadValue( 2, 0 );
    s.state      = UnpackX( data.x );
    s.keyLock    = UnpackY( data.x );
    s.stateTime  = data.y;
    s.despawnPos = UnpackXY( data.z );
    s.despawnId  = data.w;

    for ( int i = 0; i < ENEMY_NUM; ++i )
    {
        data = LoadValue( 3, i );
        s.enemyPos[ i ]      = UnpackXY( data.x );
        s.enemyFrame[ i ]    = UnpackX( data.y );
        s.enemyDir[ i ]      = UnpackY( data.y );
        s.enemyHP[ i ]       = UnpackX( data.z );
        s.enemyId[ i ]       = UnpackY( data.z );
        s.enemySpawnPos[ i ] = UnpackXY( data.w );
    }
    
    for ( int i = 0; i < LOG_NUM; ++i )
    {
		data = LoadValue( 4, i );
    	s.logPos[ i ]  = data.xy;
        s.logLife[ i ] = data.z;
        s.logId[ i ]   = UnpackX( data.w );
        s.logVal[ i ]  = UnpackY( data.w );
    }    
}

float saturate( float x )
{
    return clamp( x, 0., 1. );
}

float Smooth( float x )
{
	return smoothstep( 0., 1., saturate( x ) );   
}

void SpriteRat( inout vec3 color, vec2 p )
{
	p -= vec2( 0., 1. );    
    
    int v = 0;
	v = p.y == 11. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 33554946 : ( p.x < 12. ? 131586 : 0 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 67241730 : ( p.x < 12. ? 33817604 : 0 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 67371520 : ( p.x < 12. ? 33948678 : 0 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 67371520 : ( p.x < 12. ? 67372036 : 2 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 67372034 : ( p.x < 12. ? 67372036 : 2 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 67372034 : ( p.x < 12. ? 16843010 : 5 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 33554432 : ( p.x < 8. ? 67372036 : ( p.x < 12. ? 66052 : 0 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 33554432 : ( p.x < 8. ? 67372036 : ( p.x < 12. ? 197635 : 0 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 16777216 : ( p.x < 8. ? 33686532 : ( p.x < 12. ? 33817604 : 0 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 16777216 : ( p.x < 8. ? 67372034 : ( p.x < 12. ? 33817602 : 0 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 16777216 : ( p.x < 8. ? 67371522 : ( p.x < 12. ? 16909313 : 0 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 117901063 : ( p.x < 8. ? 50397441 : ( p.x < 12. ? 83951877 : 0 ) ) ) : v;
    float i = float( ( v >> int( 8.0 * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0.16, 0.11, 0.071 ) : color;
    color = i == 2. ? vec3( 0.33, 0.26, 0.18 ) : color;
    color = i == 3. ? vec3( 0.58, 0.25, 0.24 ) : color;
    color = i == 4. ? vec3( 0.51, 0.44, 0.35 ) : color;
    color = i == 5. ? vec3( 0.81, 0.31, 0.33 ) : color;
    color = i == 6. ? vec3( 1, 0.4, 0.3 ) : color;
    color = i == 7. ? vec3( 0.86, 0.53, 0.55 ) : color;
}

void SpriteRatAttack( inout vec3 color, vec2 p )
{
	p -= vec2( 0., 1. );    
    
    int v = 0;
	v = p.y == 10. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 33685504 : ( p.x < 12. ? 33686016 : 2 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 117571584 : ( p.x < 12. ? 67372034 : 516 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 67240448 : ( p.x < 12. ? 67503108 : 518 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 67372034 : ( p.x < 12. ? 67372036 : 132100 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 67372034 : ( p.x < 12. ? 67372036 : 132100 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 33554432 : ( p.x < 8. ? 67372036 : ( p.x < 12. ? 83952644 : 393477 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 33554432 : ( p.x < 8. ? 67372036 : ( p.x < 12. ? 50397953 : 0 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 16777216 : ( p.x < 8. ? 33686532 : ( p.x < 12. ? 33817604 : 0 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 16777216 : ( p.x < 8. ? 67372034 : ( p.x < 12. ? 33817602 : 0 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 16777216 : ( p.x < 8. ? 67371522 : ( p.x < 12. ? 16909313 : 0 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 117901063 : ( p.x < 8. ? 50397441 : ( p.x < 12. ? 100729094 : 0 ) ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0.16, 0.11, 0.071 ) : color;
    color = i == 2. ? vec3( 0.33, 0.26, 0.18 ) : color;
    color = i == 3. ? vec3( 0.58, 0.25, 0.24 ) : color;
    color = i == 4. ? vec3( 0.51, 0.44, 0.35 ) : color;
    color = i == 5. ? vec3( 1, 0.09, 0.09 ) : color;
    color = i == 6. ? vec3( 0.9, 0.36, 0.31 ) : color;
    color = i == 7. ? vec3( 0.86, 0.53, 0.55 ) : color;
}

void SpriteRatWalk( inout vec3 color, vec2 p )
{
    p -= vec2( 0., 1. );
    
    int v = 0;
	v = p.y == 12. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 33554946 : ( p.x < 12. ? 131586 : 0 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 67241730 : ( p.x < 12. ? 33817604 : 0 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 67371520 : ( p.x < 12. ? 33948678 : 0 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 67371520 : ( p.x < 12. ? 67372036 : 2 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 67372034 : ( p.x < 12. ? 67372036 : 2 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 67372034 : ( p.x < 12. ? 16843010 : 5 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 33554432 : ( p.x < 8. ? 67372036 : ( p.x < 12. ? 66052 : 0 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 33554432 : ( p.x < 8. ? 67372036 : ( p.x < 12. ? 197635 : 0 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 16777216 : ( p.x < 8. ? 33686532 : ( p.x < 12. ? 33817604 : 0 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 16777216 : ( p.x < 8. ? 67372034 : ( p.x < 12. ? 33817602 : 0 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 16777216 : ( p.x < 8. ? 67371522 : ( p.x < 12. ? 16909313 : 0 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 117440512 : ( p.x < 8. ? 16974081 : ( p.x < 12. ? 65793 : 0 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 460551 : ( p.x < 8. ? 83886080 : ( p.x < 12. ? 327680 : 0 ) ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0.16, 0.11, 0.071 ) : color;
    color = i == 2. ? vec3( 0.33, 0.26, 0.18 ) : color;
    color = i == 3. ? vec3( 0.58, 0.25, 0.24 ) : color;
    color = i == 4. ? vec3( 0.51, 0.44, 0.35 ) : color;
    color = i == 5. ? vec3( 0.81, 0.31, 0.33 ) : color;
    color = i == 6. ? vec3( 1, 0.4, 0.3 ) : color;
    color = i == 7. ? vec3( 0.86, 0.53, 0.55 ) : color;
}

void SpriteSkeleton( inout vec3 color, vec2 p )
{
    p -= vec2( 4., 1. );
    p = p.x < 0. ? vec2( 8. ) : p;        
    
    int v = 0;
	v = p.y == 13. ? ( p.x < 4. ? 101056512 : ( p.x < 8. ? 101058054 : 0 ) ) : v;
	v = p.y == 12. ? ( p.x < 4. ? 117900800 : ( p.x < 8. ? 117901063 : ( p.x < 12. ? 6 : 0 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 4. ? 67568384 : ( p.x < 8. ? 67372036 : ( p.x < 12. ? 2 : 0 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 117900032 : ( p.x < 8. ? 17237761 : ( p.x < 12. ? 6 : 0 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 117571584 : ( p.x < 8. ? 117704455 : ( p.x < 12. ? 6 : 0 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 33554432 : ( p.x < 8. ? 50726403 : 0 ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 33554434 : 0 ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 117835264 : ( p.x < 8. ? 101123847 : 0 ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 67108870 : ( p.x < 8. ? 328965 : ( p.x < 12. ? 2 : 0 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 1539 : ( p.x < 8. ? 33554944 : ( p.x < 12. ? 2 : 0 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 101057282 : ( p.x < 8. ? 101058054 : ( p.x < 12. ? 2 : 0 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 196608 : ( p.x < 8. ? 393216 : 0 ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 1536 : ( p.x < 8. ? 393216 : 0 ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 771 : ( p.x < 8. ? 50528256 : 0 ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0 ) : color;
    color = i == 2. ? vec3( 0.49 ) : color;
    color = i == 3. ? vec3( 0.64 ) : color;
    color = i == 4. ? vec3( 0.7 ) : color;
    color = i == 5. ? vec3( 0.8 ) : color;
    color = i == 6. ? vec3( 0.81 ) : color;
    color = i == 7. ? vec3( 0.9 ) : color;
}

void SpriteSkeletonWalk( inout vec3 color, vec2 p )
{
    p -= vec2( 4., 1. );
    p = p.x < 0. ? vec2( 8. ) : p;     
    
    int v = 0;
	v = p.y == 13. ? ( p.x < 4. ? 101056512 : ( p.x < 8. ? 101058054 : 0 ) ) : v;
	v = p.y == 12. ? ( p.x < 4. ? 117900800 : ( p.x < 8. ? 117901063 : ( p.x < 12. ? 6 : 0 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 4. ? 67568384 : ( p.x < 8. ? 67372036 : ( p.x < 12. ? 2 : 0 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 117900032 : ( p.x < 8. ? 17237761 : ( p.x < 12. ? 6 : 0 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 117571584 : ( p.x < 8. ? 117704455 : ( p.x < 12. ? 6 : 0 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 33554432 : ( p.x < 8. ? 50726403 : 0 ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 33554434 : 0 ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 117835264 : ( p.x < 8. ? 101123847 : 0 ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 67108870 : ( p.x < 8. ? 328965 : ( p.x < 12. ? 2 : 0 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 393984 : ( p.x < 8. ? 33554944 : ( p.x < 12. ? 2 : 0 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 100860416 : ( p.x < 8. ? 101058054 : ( p.x < 12. ? 2 : 0 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 196608 : ( p.x < 8. ? 100990976 : 0 ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 1536 : ( p.x < 8. ? 393984 : 0 ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 197376 : 0 ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0 ) : color;
    color = i == 2. ? vec3( 0.49 ) : color;
    color = i == 3. ? vec3( 0.64 ) : color;
    color = i == 4. ? vec3( 0.7 ) : color;
    color = i == 5. ? vec3( 0.8 ) : color;
    color = i == 6. ? vec3( 0.81 ) : color;
    color = i == 7. ? vec3( 0.9 ) : color;
}

void SpriteSkeletonAttack( inout vec3 color, vec2 p )
{
    p -= vec2( 4., 1. );
    p = p.x < 0. ? vec2( 10. ) : p;    
    
    int v = 0;
	v = p.y == 13. ? ( p.x < 4. ? 100663296 : ( p.x < 8. ? 101058054 : ( p.x < 12. ? 6 : 0 ) ) ) : v;
	v = p.y == 12. ? ( p.x < 4. ? 117833728 : ( p.x < 8. ? 117901063 : ( p.x < 12. ? 1543 : 0 ) ) ) : v;
	v = p.y == 11. ? ( p.x < 4. ? 117637120 : ( p.x < 8. ? 67372036 : ( p.x < 12. ? 516 : 0 ) ) ) : v;
	v = p.y == 10. ? ( p.x < 4. ? 117637120 : ( p.x < 8. ? 117899527 : ( p.x < 12. ? 1537 : 0 ) ) ) : v;
	v = p.y == 9. ? ( p.x < 4. ? 33554432 : ( p.x < 8. ? 67569415 : ( p.x < 12. ? 1543 : 0 ) ) ) : v;
	v = p.y == 8. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 101057794 : ( p.x < 12. ? 3 : 0 ) ) ) : v;
	v = p.y == 7. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 512 : ( p.x < 12. ? 2 : 0 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 101058048 : ( p.x < 8. ? 100861446 : 0 ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 84213760 : ( p.x < 8. ? 50464005 : ( p.x < 12. ? 2 : 0 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 33554944 : ( p.x < 12. ? 2 : 0 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 101056512 : ( p.x < 8. ? 101058054 : 0 ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 196608 : ( p.x < 8. ? 393216 : 0 ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 1536 : ( p.x < 8. ? 393216 : 0 ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 771 : ( p.x < 8. ? 50528256 : 0 ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0 ) : color;
    color = i == 2. ? vec3( 0.49 ) : color;
    color = i == 3. ? vec3( 0.64 ) : color;
    color = i == 4. ? vec3( 0.7 ) : color;
    color = i == 5. ? vec3( 0.8 ) : color;
    color = i == 6. ? vec3( 0.81 ) : color;
    color = i == 7. ? vec3( 0.9 ) : color;
}

void SpriteWarriorHead( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 7. ? ( p.x < 4. ? 0 : ( p.x < 8. ? 33686016 : ( p.x < 12. ? 2 : 0 ) ) ) : v;
	v = p.y == 6. ? ( p.x < 4. ? 33685504 : ( p.x < 8. ? 67372034 : ( p.x < 12. ? 516 : 0 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 67371520 : ( p.x < 8. ? 67372036 : ( p.x < 12. ? 132100 : 0 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 67239936 : ( p.x < 8. ? 117901062 : ( p.x < 12. ? 132103 : 0 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 84148736 : ( p.x < 8. ? 84214021 : ( p.x < 12. ? 769 : 0 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 84148992 : ( p.x < 8. ? 101057798 : ( p.x < 12. ? 1029 : 0 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 67239936 : ( p.x < 8. ? 67372038 : ( p.x < 12. ? 1028 : 0 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 67239936 : ( p.x < 8. ? 33686020 : ( p.x < 12. ? 514 : 0 ) ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0 ) : color;
    color = i == 2. ? vec3( 0.64, 0.2, 0.047 ) : color;
    color = i == 3. ? vec3( 0.52, 0.35, 0.22 ) : color;
    color = i == 4. ? vec3( 0.77, 0.47, 0.29 ) : color;
    color = i == 5. ? vec3( 0.72, 0.59, 0.47 ) : color;
    color = i == 6. ? vec3( 0.86, 0.71, 0.59 ) : color;
    color = i == 7. ? vec3( 1, 0.85, 0.75 ) : color;
}

void SpriteWarriorStand( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 6. ? ( p.x < 4. ? 101057536 : ( p.x < 8. ? 33620485 : ( p.x < 12. ? 770 : 0 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 16908802 : ( p.x < 8. ? 117901061 : ( p.x < 12. ? 261 : 0 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 17040897 : ( p.x < 8. ? 33686018 : ( p.x < 12. ? 258 : 0 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 33620736 : ( p.x < 8. ? 117901061 : ( p.x < 12. ? 770 : 0 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 33619968 : ( p.x < 8. ? 33685761 : ( p.x < 12. ? 1 : 0 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 16908544 : ( p.x < 8. ? 33619968 : ( p.x < 12. ? 1 : 0 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 16843008 : ( p.x < 8. ? 16842752 : ( p.x < 12. ? 1 : 0 ) ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0.09, 0.11, 0.18 ) : color;
    color = i == 2. ? vec3( 0.28, 0.35, 0.45 ) : color;
    color = i == 3. ? vec3( 1, 0.36, 0.043 ) : color;
    color = i == 4. ? vec3( 1, 0.65, 0.25 ) : color;
    color = i == 5. ? vec3( 0.54, 0.67, 0.73 ) : color;
    color = i == 6. ? vec3( 1, 0.85, 0.56 ) : color;
    color = i == 7. ? vec3( 0.91, 1, 1 ) : color;
}

void SpriteWarriorWalk( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 6. ? ( p.x < 4. ? 101057536 : ( p.x < 8. ? 33620485 : ( p.x < 12. ? 770 : 0 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 33620481 : ( p.x < 8. ? 117901061 : ( p.x < 12. ? 261 : 0 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 67371521 : ( p.x < 8. ? 33686018 : ( p.x < 12. ? 257 : 0 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 33751296 : ( p.x < 8. ? 33687301 : ( p.x < 12. ? 1797 : 0 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 33619968 : ( p.x < 8. ? 33620225 : ( p.x < 12. ? 1 : 0 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 16842752 : ( p.x < 8. ? 16842752 : 0 ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 16842752 : 0 ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0.09, 0.11, 0.18 ) : color;
    color = i == 2. ? vec3( 0.29, 0.34, 0.45 ) : color;
    color = i == 3. ? vec3( 1, 0.36, 0.043 ) : color;
    color = i == 4. ? vec3( 1, 0.62, 0.23 ) : color;
    color = i == 5. ? vec3( 0.54, 0.67, 0.73 ) : color;
    color = i == 6. ? vec3( 1, 0.91, 0.62 ) : color;
    color = i == 7. ? vec3( 0.87, 1, 1 ) : color;
}

void SpriteWarriorAttack( inout vec3 color, vec2 p )
{
    int v = 0;
	v = p.y == 6. ? ( p.x < 4. ? 101057536 : ( p.x < 8. ? 16910085 : ( p.x < 12. ? 1026 : 0 ) ) ) : v;
	v = p.y == 5. ? ( p.x < 4. ? 33687298 : ( p.x < 8. ? 117901061 : ( p.x < 12. ? 67503367 : 0 ) ) ) : v;
	v = p.y == 4. ? ( p.x < 4. ? 16844292 : ( p.x < 8. ? 33686018 : ( p.x < 12. ? 50528770 : 0 ) ) ) : v;
	v = p.y == 3. ? ( p.x < 4. ? 16777987 : ( p.x < 8. ? 117901058 : ( p.x < 12. ? 261 : 0 ) ) ) : v;
	v = p.y == 2. ? ( p.x < 4. ? 16777216 : ( p.x < 8. ? 33620226 : ( p.x < 12. ? 263 : 0 ) ) ) : v;
	v = p.y == 1. ? ( p.x < 4. ? 33619968 : ( p.x < 8. ? 16777217 : ( p.x < 12. ? 258 : 0 ) ) ) : v;
	v = p.y == 0. ? ( p.x < 4. ? 16842752 : ( p.x < 8. ? 16777217 : ( p.x < 12. ? 257 : 0 ) ) ) : v;
    float i = float( ( v >> int( 8. * p.x ) ) & 255 );
    color = i == 1. ? vec3( 0.09, 0.11, 0.18 ) : color;
    color = i == 2. ? vec3( 0.28, 0.35, 0.45 ) : color;
    color = i == 3. ? vec3( 1, 0.36, 0.043 ) : color;
    color = i == 4. ? vec3( 1, 0.65, 0.25 ) : color;
    color = i == 5. ? vec3( 0.54, 0.67, 0.73 ) : color;
    color = i == 6. ? vec3( 1, 0.85, 0.56 ) : color;
    color = i == 7. ? vec3( 0.91, 1, 1 ) : color;
}

vec2 FrameOffset( float frame, float tick )
{
    vec2 ret = vec2( 0. );
    ret.x = frame == 1. ? 1. : ( frame == 2. ? -1. : 0. );
    ret.y = frame == 3. ? 1. : ( frame == 4. ? -1. : 0. );
    return floor( 16. * ret * ( tick / TICK_NUM ) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{    
    GameState s;
    LoadState( s );    
    
    vec2 playerPos = s.playerPos * 16. + FrameOffset( s.playerFrame, s.tick ); 
    
    vec2 resMult	= floor( iResolution.xy / REF_RES );
    float resRcp    = 1. / max( min( resMult.x, resMult.y ), 1. );
    vec2 screenSize = floor( iResolution.xy * resRcp );
    vec2 pixel      = floor( fragCoord.xy * resRcp );
	vec2 camera     = clamp( playerPos - floor( screenSize / 2. ), vec2( -32. ), vec2( 32. * 16. + 32. ) - screenSize );
    vec2 world      = pixel + camera;
    vec2 tile		= floor( world / 16. );
    vec2 worldMod16 = floor( mod( world, 16. ) );
    vec4 map		= texelFetch( iChannel1, ivec2( tile ), 0 );
    float tick2     = s.tick > TICK_NUM / 2. ? 1. : 0.;
    
    vec3 color = texelFetch( iChannel2, ivec2( fragCoord ), 0 ).xyz;
    
    vec2 warrior = world - playerPos;
    warrior.x = s.playerDir > 0. ? 13. - warrior.x : warrior.x - 2.;
    warrior.y -= 1.;
    if ( warrior.x >= 0. && warrior.y >= 0. && warrior.x < 16. && warrior.y < 16. 
         && s.hp > 0. )
    {
        float walk = s.playerFrame > 0. && tick2 == 1. ? 1. : 0.;
        if ( warrior.x >= 1. - walk )
        {
        	SpriteWarriorHead( color, warrior - vec2( 1. - walk, 7. ) );   
        }

        if ( s.playerFrame == 6. && tick2 == 1. )
        {
            SpriteWarriorAttack( color, warrior );
        }        
        else if ( walk == 1. )
        {
			SpriteWarriorWalk( color, warrior );
        }
        else if ( warrior.x >= 1. )
        {
			SpriteWarriorStand( color, warrior - vec2( 1., 0. ) );
        }
    }
    
    for ( int i = 0; i < ENEMY_NUM; ++i )
    {
    	vec3 enemyColor = color;
        
        vec2 enemy = world - s.enemyPos[ i ] * 16. + FrameOffset( s.enemyFrame[ i ], s.tick );
		enemy.x = s.enemyDir[ i ] > 0. ? 15. - enemy.x : enemy.x;
        if ( enemy.x >= 0. && enemy.y >= 0. && enemy.x < 16. && enemy.y < 16. && s.enemyPos[ i ].x > 0. )
    	{
            if ( s.enemyFrame[ i ] == 5. && tick2 == 1. )
            {
                if ( s.enemyId[ i ] == 0. )
                	SpriteRatAttack( enemyColor, enemy );
                else
                    SpriteSkeletonAttack( enemyColor, enemy );
            }
            else if ( s.enemyFrame[ i ] > 0. && tick2 == 1. )
            {
                if ( s.enemyId[ i ] == 0. )
                	SpriteRatWalk( enemyColor, enemy );
                else
                	SpriteSkeletonWalk( enemyColor, enemy );
            }
            else
            {
                if ( s.enemyId[ i ] == 0. )
        			SpriteRat( enemyColor, enemy );
                else
                    SpriteSkeleton( enemyColor, enemy );
			}
        }
        
        // fog of war
        float dist = length( playerPos - s.enemyPos[ i ] * 16. );
		color = mix( color, enemyColor, saturate( ( 64. + 16. - dist ) / 32. ) );
    }
    
	fragColor = vec4( color, 1. );
}
`;

const fragment = `
// Based on "Pixel Dungeon" (http://pixeldungeon.watabou.ru/)

const float TICK_NUM			= 10.;
const float TILE_FLOOR			= 1.;
const float TILE_DOOR_OPEN		= 2.;
const float TILE_STAIRS_DOWN	= 3.;
const float TILE_TRAP			= 4.;
const float TILE_TRAP_OFF		= 5.;
const float TILE_WALL			= 6.;
const float TILE_WALL_HOLE		= 7.;
const float TILE_DOOR_LOCKED	= 8.;
const float TILE_STAIRS_UP		= 9.;
const float ITEM_KEY			= 1.;
const float ITEM_POTION			= 2.;
const float ITEM_SPAWNER		= 3.;
const float LOG_ID_DMG			= 1.;
const float LOG_ID_XP			= 2.;
const float LOG_ID_LEVEL_UP		= 3.;
const float STATE_START			= 0.;
const float STATE_GAME			= 1.;
const float STATE_NEXT_LEVEL	= 2.;
const float STATE_GAME_OVER		= 3.;

const vec2  REF_RES	            = vec2( 200. );

const int   ENEMY_NUM			= 3;
const int   LOG_NUM				= 4;

struct GameState
{
    // 0   
    float	tick;
    float 	hp;
    float 	level;
    float 	xp;
    float 	keyNum;
    
	// 1
    vec2 	playerPos;
    float   playerFrame;
    float   playerDir;
    vec2	bodyPos;
    float   bodyId;
    
    // 2
    float 	state;
    float   keyLock;
    float 	stateTime;
    vec2	despawnPos;
    float   despawnId;

    // 3
    vec2	enemyPos[ ENEMY_NUM ];
    float 	enemyFrame[ ENEMY_NUM ];
    float 	enemyDir[ ENEMY_NUM ];
    float 	enemyHP[ ENEMY_NUM ];
    float 	enemyId[ ENEMY_NUM ];
    vec2    enemySpawnPos[ ENEMY_NUM ];
    
    // 4
    vec2	logPos[ LOG_NUM ];
    float   logLife[ LOG_NUM ];
    float   logId[ LOG_NUM ];
    float   logVal[ LOG_NUM ];
};

vec4 LoadValue( int x, int y )
{
    return texelFetch( iChannel0, ivec2( x, y ), 0 );
}    

float PackXY( float a, float b )
{
    return floor( a ) + floor( b ) / 256.;
}

float PackXY( vec2 v )
{
    return PackXY( v.x, v.y );
}

float UnpackX( float a )
{
    return floor( a );
}

float UnpackY( float a )
{
    return fract( a ) * 256.;
}

vec2 UnpackXY( float a )
{
    return vec2( UnpackX( a ), UnpackY( a ) );
}

void LoadState( out GameState s )
{
    vec4 data;

    data = LoadValue( 0, 0 );
    s.tick 		= data.x;
    s.hp    	= UnpackX( data.y );
    s.level    	= UnpackY( data.y );
    s.xp        = data.z;
    s.keyNum    = data.w;
    
    data = LoadValue( 1, 0 );
    s.playerPos   = UnpackXY( data.x );
    s.playerFrame = UnpackX( data.y );
    s.playerDir   = UnpackY( data.y );
    s.bodyPos	  = UnpackXY( data.z );
    s.bodyId      = data.w;
    
    data = LoadValue( 2, 0 );
    s.state      = UnpackX( data.x );
    s.keyLock    = UnpackY( data.x );
    s.stateTime  = data.y;
    s.despawnPos = UnpackXY( data.z );
    s.despawnId  = data.w;

    for ( int i = 0; i < ENEMY_NUM; ++i )
    {
        data = LoadValue( 3, i );
        s.enemyPos[ i ]      = UnpackXY( data.x );
        s.enemyFrame[ i ]    = UnpackX( data.y );
        s.enemyDir[ i ]      = UnpackY( data.y );
        s.enemyHP[ i ]       = UnpackX( data.z );
        s.enemyId[ i ]       = UnpackY( data.z );
        s.enemySpawnPos[ i ] = UnpackXY( data.w );
    }
    
    for ( int i = 0; i < LOG_NUM; ++i )
    {
		data = LoadValue( 4, i );
    	s.logPos[ i ]  = data.xy;
        s.logLife[ i ] = data.z;
        s.logId[ i ]   = UnpackX( data.w );
        s.logVal[ i ]  = UnpackY( data.w );
    }    
}

float saturate( float x )
{
    return clamp( x, 0., 1. );
}

float Smooth( float x )
{
	return smoothstep( 0., 1., saturate( x ) );   
}

void SpriteKey( inout vec3 color, vec2 p )
{
    p -= vec2( 5., 2. );
    p = p.x < 0. ? vec2( 0. ) : p;    
    
    int v = 0;
	v = p.y == 11. ? ( p.x < 8. ? 139824 : 0 ) : v;
	v = p.y == 10. ? ( p.x < 8. ? 2232611 : 0 ) : v;
	v = p.y == 9. ? ( p.x < 8. ? 1179666 : 0 ) : v;
	v = p.y == 8. ? ( p.x < 8. ? 1245202 : 0 ) : v;
	v = p.y == 7. ? ( p.x < 8. ? 1192482 : 0 ) : v;
	v = p.y == 6. ? ( p.x < 8. ? 74256 : 0 ) : v;
	v = p.y == 5. ? ( p.x < 8. ? 4608 : 0 ) : v;
	v = p.y == 4. ? ( p.x < 8. ? 4608 : 0 ) : v;
	v = p.y == 3. ? ( p.x < 8. ? 4608 : 0 ) : v;
	v = p.y == 2. ? ( p.x < 8. ? 2232832 : 0 ) : v;
	v = p.y == 1. ? ( p.x < 8. ? 135680 : 0 ) : v;
	v = p.y == 0. ? ( p.x < 8. ? 2232832 : 0 ) : v;
    float i = float( ( v >> int( 4. * p.x ) ) & 15 );
    color = i == 1. ? vec3( 0.45 ) : color;
    color = i == 2. ? vec3( 0.83 ) : color;
    color = i == 3. ? vec3( 0.95 ) : color;
}

vec2 FrameOffset( float frame, float tick )
{
    vec2 ret = vec2( 0. );
    ret.x = frame == 1. ? 1. : ( frame == 2. ? -1. : 0. );
    ret.y = frame == 3. ? 1. : ( frame == 4. ? -1. : 0. );
    return floor( 16. * ret * ( tick / TICK_NUM ) );
}

float EnemyHP( float id )
{
    return 8. + id * 15.;
}

float MaxXP( float level )
{
	return 10. + level * 5.;	   
}

float MaxHP( float level )
{
	return 21. + level * 3.;	   
}

float TextSDF( vec2 p, float glyph )
{
    p = abs( p.x - .5 ) > .5 || abs( p.y - .5 ) > .5 ? vec2( 0. ) : p;
    return texture( iChannel3, p / 16. + fract( vec2( glyph, 15. - floor( glyph / 16. ) ) / 16. ) ).w - 127. / 255.;
}

void PrintChar( inout float sdf, inout vec2 p, float c )
{
    p.x -= 4.;
    sdf = min( sdf, TextSDF( p * .1, c ) );
}

void PrintVal( inout float sdf, inout vec2 p, float val )
{
    if ( val > 9. )
    {
        p.x -= 4.;
        float d = floor( val * 0.1 );
        sdf = min( sdf, TextSDF( p * .1, 48. + d ) );
        val -= d * 10.;
    }
    
    p.x -= 4.;
	sdf = min( sdf, TextSDF( p * .1, 48. + val ) );
}

void RastText( inout vec3 color, float t, float l, vec3 textColor )
{
    float alpha = Smooth( 1. - ( 2. * l - 1. ) );
    color = mix( color, vec3( 0. ), saturate( exp( -t * 20. ) ) * alpha );
    color = mix( color, textColor, Smooth( -t * 100. ) * alpha );    
}

void DrawText( inout vec3 color, vec2 edge, vec2 center, vec2 world, in GameState s )
{
    // xp
    if ( s.logPos[ 0 ].x > 0. )
    {
        float t = 1e4;
        
        vec2 p = world;
        p -= s.logPos[ 0 ] * 16.;
        p.x += 8.;
        p.y -= s.logLife[ 0 ] * 16.;
        PrintChar( t, p, 43. );
        PrintVal( t, p, s.logVal[ 0 ] );
        PrintChar( t, p, 69. );
        PrintChar( t, p, 88. );
        PrintChar( t, p, 80. );
        
		if ( s.logId[ 0 ] > 0. )
        {
            p = world;
            p -= s.logPos[ 0 ] * 16.;
            p.x += 16.;
            p.y -= s.logLife[ 0 ] * 16. - 8.;
           	PrintChar( t, p, 76. );
            PrintChar( t, p, 69. );
            PrintChar( t, p, 86. );
            PrintChar( t, p, 69. );
            PrintChar( t, p, 76. );
            PrintChar( t, p, 32. );
            PrintChar( t, p, 85. );
            PrintChar( t, p, 80. );
            PrintChar( t, p, 33. );
        }
        
        RastText( color, t, s.logLife[ 0 ], vec3( 1., 1., 0. ) );
    }    
    
    // heal
    if ( s.logPos[ 1 ].x > 0. )
    {
        float t = 1e4; 
        vec2 p = world;
        p -= s.logPos[ 1 ] * 16.;
        p.x += 8.;
        p.y -= s.logLife[ 1 ] * 16.;      
        PrintChar( t, p, 43. );
        PrintVal( t, p, s.logVal[ 1 ] );
        PrintChar( t, p, 72. );
        PrintChar( t, p, 80. );
        RastText( color, t, s.logLife[ 1 ], vec3( 0., 1., 0. ) ); 
    }
    
    // dmg
    for ( int i = 2; i < LOG_NUM; ++i )
    {
		float t = 1e4;        
        
        if ( s.logPos[ i ].x > 0. )
        {
            vec2 p = world;
            p -= s.logPos[ i ] * 16.;
            p.y -= s.logLife[ i ] * 16.;        
            PrintVal( t, p, s.logVal[ i ] );
        }
        
        RastText( color, t, s.logLife[ i ], vec3( 1., 0., 0. ) );     
    }
    
    // game over
    if ( s.state == STATE_GAME_OVER )
    {      
        float alpha = Smooth( ( s.stateTime - 0.33 ) * 4. );
        
        color = mix( color, color.yyy * .5, alpha );
        
        float t = 1e4; 
        
        vec2 p = .25 * center;
        p.x += 24.;
        p.y += 6.;
        PrintChar( t, p, 89. );
        PrintChar( t, p, 79. );
        PrintChar( t, p, 85. );
        p.x -= 4.;
        PrintChar( t, p, 68. );
        PrintChar( t, p, 73. );
        PrintChar( t, p, 69. );
        PrintChar( t, p, 68. );
        
        RastText( color, t, 1. - alpha, vec3( 1., 0., 0. ) );     
    }
    
    // level
    vec2 p = edge + vec2( 2.2, 20.8 );
    float t = 1e4;
    PrintChar( t, p, 48. + s.level + 1. );
    color = mix( color, vec3( 1. ), Smooth( -t * 100. ) ); 
}

float Rectangle( vec2 p, vec2 b )
{
    vec2 d = abs( p ) - b;
    return min( max( d.x, d.y ), 0. ) + length( max( d, 0. ) );
}

void mainImage( out vec4 fragColor, in vec2 fragCoord )
{    
    GameState s;
    LoadState( s );    
    
    vec2 playerPos = s.playerPos * 16. + FrameOffset( s.playerFrame, s.tick ); 
    
    vec2 resMult	= floor( iResolution.xy / REF_RES );
    float resRcp    = 1. / max( min( resMult.x, resMult.y ), 1. );
    vec2 screenSize = floor( iResolution.xy * resRcp );
    vec2 pixel      = floor( fragCoord.xy * resRcp );
	vec2 camera     = clamp( playerPos - floor( screenSize / 2. ), vec2( -32. ), vec2( 32. * 16. + 32. ) - screenSize );
    vec2 world      = pixel + camera;
    vec2 tile		= floor( world / 16. );
    vec2 worldMod16 = floor( mod( world, 16. ) );
    vec4 map		= texelFetch( iChannel1, ivec2( tile ), 0 );
    vec2 edgeFlt	= fragCoord.xy * resRcp - vec2( 0., screenSize.y );
    vec2 centerFlt	= fragCoord.xy * resRcp - screenSize / 2.;
    vec2 worldFlt	= fragCoord.xy * resRcp - vec2( 0., 16. ) + camera;
    float fog		= texture( iChannel1, ( tile + worldMod16 / 16. ) / iChannelResolution[ 0 ].xy ).w;
    float tick2     = s.tick > TICK_NUM / 2. ? 1. : 0.;
    
    vec3 color = texelFetch( iChannel2, ivec2( fragCoord ), 0 ).xyz;
    
    color *= fog;    
    float light = length( playerPos + 8. - world );
	color *= vec3( Smooth( ( 4. * 16. - light ) * .05 ) * .8 + .2 );
    
    for ( int i = 0; i < ENEMY_NUM; ++i )
    {
        float maxHP = EnemyHP( s.enemyId[ i ] );
		vec2 enemy = world - s.enemyPos[ i ] * 16. + FrameOffset( s.enemyFrame[ i ], s.tick );        
        if ( s.enemyPos[ i ].x > 0.
             && s.enemyHP[ i ] < maxHP
             && enemy.x >= 0. && enemy.x < 16. && enemy.y - 16. >= 0. && enemy.y - 16. < 2. )
        {
            color = enemy.x < 16. * s.enemyHP[ i ] / maxHP ? vec3( 0., 1., 0. ) : vec3( 1., 0., 0. );
        }
    }
    
	if ( pixel.x >= screenSize.x - 8. - 16. * s.keyNum && pixel.x < screenSize.x - 8. )
    {
        SpriteKey( color, vec2( mod( pixel.x - 8., 16. ), pixel.y - screenSize.y + 24. ) );
    }
    
    if ( pixel.y >= screenSize.y - 9. && pixel.x < 4. * MaxHP( s.level ) + 7. + pixel.y - screenSize.y )
    {
       	color = vec3( .33, .35, .31 );
    }
    if ( pixel.y >= screenSize.y - 8. && pixel.x < 4. * MaxHP( s.level ) + 6. + pixel.y - screenSize.y )
    {
       	color = vec3( .64, .65, .58 );
    }
    if ( pixel.y >= screenSize.y - 7. && pixel.x < 4. * MaxHP( s.level ) + 5. + pixel.y - screenSize.y )
    {
       	color = vec3( .24, .25, .22 );
    }    
    if ( pixel.y >= screenSize.y - 3. )
    {
  		color = vec3( .33, .35, .31 );
    }
    if ( pixel.y >= screenSize.y - 2. )
    {
  		color = vec3( .48, .5, .45 );
    }    
    if ( pixel.y >= screenSize.y - 1. )
    {
        color = vec3( .24, .25, .22 );
    }
    
    float rect = floor( Rectangle( pixel - vec2( 6., screenSize.y - 16. ), vec2( 5. ) ) );
    color = rect == 0. ? vec3( .64, .65, .58 ) : color;
    color = rect == 1. ? vec3( .33, .35, .31 ) : color;
    color = rect <  0. ? vec3( .24, .25, .22 ) : color;
    
    float xpBar = s.xp / MaxXP( s.level );
    if ( pixel.y >= screenSize.y - 1. && pixel.x < screenSize.x * xpBar )
    {
        color = mix( vec3( 1., .8, .4 ), vec3( 1. ), pixel.x / screenSize.x );
    } 
    
    if ( pixel.y >= screenSize.y - 7. && pixel.y < screenSize.y - 3. && pixel.x < 4. * s.hp + 5. + pixel.y - screenSize.y )
    {
       color = mix( vec3( .65, .22, .29 ), vec3( .9, .4, .36 ), ( pixel.y - screenSize.y + 5. ) / 3. );
    }
    
    if ( pixel.x == 0. && pixel.y >= screenSize.y - 9. && pixel.y < screenSize.y - 2. )
    {
       	color = vec3( .33, .35, .31 );
    }
    
    DrawText( color, edgeFlt, centerFlt, worldFlt, s );
    
	fragColor = vec4( color, 1. );
}
`;

export default class implements iSub {
  key(): string {
    return 'Xs2fWD';
  }
  name(): string {
    return '[SH17B] Pixel Shader Dungeon';
  }
  // sort() {
  //   return 0;
  // }
  tags?(): string[] {
    return [];
  }
  main(): HTMLCanvasElement {
    return createCanvas();
  }
  webgl() {
    return WEBGL_2;
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
    ];
  }
}
