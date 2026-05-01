export const TS = 32;
export const CW = 640;
export const CH = 480;

export const T = { GRASS:0, WATER:1, MOUNTAIN:2, PATH:3, SAND:4, DGRASS:5, FLOOR:6, WALL:7, DFLOOR:8 };

export const WALKABLE = new Set([T.GRASS, T.PATH, T.SAND, T.DGRASS, T.FLOOR, T.DFLOOR]);

export const TCOL  = { 0:'#4a8c48',1:'#1e5ea8',2:'#7a6a58',3:'#c4a87e',4:'#d4b882',5:'#3a7038',6:'#b89060',7:'#2a2018',8:'#1e1428' };
export const TEDGE = { 0:'#3a7a38',1:'#144e98',2:'#6a5a48',3:'#b4986e',4:'#c4a872',5:'#2a6028',6:'#a07850',7:'#1a1008',8:'#140c1c' };

export const ZONE_SIZES = {
  overworld: { w: 42, h: 30 },
  dungeon:   { w: 28, h: 20 },
};

export const SAVE_KEY = 'grimveil_v1';
