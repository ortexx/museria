
const controllers = require('./controllers');
const midds = require('../../midds');

module.exports = [
  /**
   * Get the song info
   * 
   * @api {post} /api/slave/get-song-info
   * @apiParam {string} title - song title
   */
  { 
    name: 'getSongInfo',
    method: 'post', 
    url: '/get-song-info', 
    fn: controllers.getSongInfo
  },

  /**
   * Remove the song
   * 
   * @api {post} /api/slave/remove-song
   * @apiParam {string} title - song title
   */
  { 
    name: 'removeSong',
    method: 'post', 
    url: '/remove-song',
    fn: [
      midds.requestQueueFileHash, 
      controllers.removeSong
    ]
  }
];
