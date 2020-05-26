const controllers = require('./controllers');

module.exports = [
  /**
   * Get the song info
   * 
   * @api {post} /api/butler/get-song-info
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
   * @api {post} /api/butler/remove-song
   * @apiParam {string} title - song title
   */
  { 
    name: 'removeSong',
    method: 'post', 
    url: '/remove-song',
    fn: controllers.removeSong
  }
];
