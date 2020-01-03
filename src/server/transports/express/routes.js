const midds = require('./midds');
const controllers = require('./controllers');

module.exports = [
  { name: 'favicon', fn: controllers.favicon },
  { name: 'static', url: '/', fn: controllers.static },
  { 
    name: 'audio', 
    mehtod: 'get', 
    url: '/audio/:hash', 
    fn: [
      midds.networkAccess,
      midds.fileAccess,
      midds.audio
    ]
  },
  { 
    name: 'cover', 
    mehtod: 'get', 
    url: '/cover/:hash', 
    fn: [
      midds.networkAccess,
      midds.fileAccess,
      midds.cover
    ]
  },
  { name: 'indexPage', mehtod: 'get', url: '*', fn: controllers.indexPage }
];