// Future WebSocket message types (stub for multiplayer)
export const MSG = {
  // Client → Server
  PLAYER_MOVE:    'player_move',
  PLAYER_ATTACK:  'player_attack',
  PLAYER_GATHER:  'player_gather',
  CHAT_SEND:      'chat_send',
  SAVE_REQUEST:   'save_request',

  // Server → Client
  WORLD_STATE:    'world_state',
  PLAYER_UPDATE:  'player_update',
  ENTITY_UPDATE:  'entity_update',
  CHAT_BROADCAST: 'chat_broadcast',
  ERROR:          'error',
};
