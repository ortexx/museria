const midds = require('./midds');

module.exports = [
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
  }
];