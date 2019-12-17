
const controllers = require('./controllers');
const midds = require('../midds');

module.exports = [
  /**
   * Request the song
   * 
   * @api {get} /client/request-song/
   * @apiParam {string} title
   * @apiParam {string} type
   */
  { 
    name: 'requestSong',
    method: 'get',
    url: '/request-song',
    fn: controllers.requestSong
  },

  /**
   * Get the song info
   * 
   * @api {post} /client/get-song-info
   * @apiParam {string} title - song title
   * @apiSuccess {object} - { info: [{...}] }
   */
  { 
    name: 'getSongInfo', 
    method: 'post', 
    url: '/get-song-info',
    fn: controllers.getSongInfo
  },

  /**
   * Get the song link
   * 
   * @api {post} /client/get-song-link
   * @apiParam {string} title - song title
   * @apiParam {string} type - file type
   * @apiSuccess {object} - { link: '' }
   */
  { 
    name: 'getSongLink', 
    method: 'post', 
    url: '/get-song-link',
    fn: controllers.getSongLink
  },
  
  /**
   * Add the song
   * 
   * @api {post} /client/add-song/
   * @apiParam {fs.ReadStream|string} file 
   * @apiSuccess {object} - { title: '', audioLink: '', coverLink: '', tags: {...} }
   */
  { 
    name: 'addSong', 
    method: 'post',
    url: '/add-song', 
    fn: node => ([
      midds.filesFormData(node), 
      controllers.addSong(node)
    ]) 
  },

  /**
   * Remove the song
   * 
   * @api {post} /client/remove-song
   * @apiParam {string} title - song title
   * @apiSuccess {object} - { removed: 0 }
   */
  { 
    name: 'removeSong',
    method: 'post', 
    url: '/remove-song',
    fn: controllers.removeSong
  }
];