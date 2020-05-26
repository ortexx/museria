const controllers = require('./controllers');

module.exports = [
  /**
   * Get the song info
   * 
   * @api {post} /api/master/get-song-info
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
   * @api {post} /api/master/remove-song
   * @apiParam {string} title - song title
   */
  { 
    name: 'removeSong',
    method: 'post', 
    url: '/remove-song',
    fn: controllers.removeSong
  }
];
