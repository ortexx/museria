

const controllers = require('./controllers');
const midds = require('../../midds');

module.exports = [
  /**
   * Add the song
   * 
   * @api {post} /api/node/add-song/
   * @apiParam {fs.ReadStream|string} file
   */
  { 
    name: 'addSong',
    method: 'post', 
    url: '/add-song',
    fn: [
      midds.requestQueueSong,
      midds.songAdditionApproval,
      midds.filesFormData,      
      midds.prepareFileToStore,
      controllers.addSong
    ]
  }
];
