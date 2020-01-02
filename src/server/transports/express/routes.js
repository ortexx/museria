const midds = require('./midds');
const controllers = require('./controllers');

module.exports = [
  { name: 'favicon', fn: controllers.favicon },
  { name: 'static', url: '/', fn: controllers.static },
  { 
    name: 'audio', 
    mehtod: 'get', 
    url: '/audio/:hash', 
    fn: node => ([
      midds.networkAccess(node),
      midds.audio(node)
    ])
  },
  { 
    name: 'cover', 
    mehtod: 'get', 
    url: '/cover/:hash', 
    fn: node => ([
      midds.networkAccess(node),
      midds.cover(node)
    ])
  },
  { name: 'indexPage', mehtod: 'get', url: '*', fn: controllers.indexPage }
];