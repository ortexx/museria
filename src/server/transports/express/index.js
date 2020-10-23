const ServerExpressMetastocle = require('metastocle/src/server/transports/express')();
const routes = require('./routes');
const routesClient = require('./client/routes');
const routesApi = require('./api/routes');
const routesApiMaster = require('./api/master/routes');
const routesApiButler = require('./api/butler/routes');
const routesApiSlave = require('./api/slave/routes');
const routesApiNode = require('./api/node/routes');

module.exports = (Parent) => {
  return class ServerExpressMuseria extends (Parent || ServerExpressMetastocle) {
   /**
     * @see ServerExpressMetastocle.prototype.getMainRoutes
     */
    getMainRoutes() {
      let arr = super.getMainRoutes();
      const start = routes.slice(0, routes.length - 1);
      const end = [routes[routes.length - 1]];
      arr = arr.filter(obj => obj.name != 'indexPage');
      arr.splice(arr.findIndex(r => r.name == 'bodyParser'), 0, ...start);
      arr.splice(arr.findIndex(r => r.name == 'notFound'), 0, ...end);
      return arr;
    }
  
    /**
     * @see ServerExpressMetastocle.prototype.getClientRoutes
     */
    getClientRoutes() {
      const remove = [
        'addDocument', 'updateDocuments', 
        'deleteDocuments', 'getDocuments', 
        'getDocumentsCount', 'getDocumentByPk'
      ];
      return super.getClientRoutes().filter(r => !remove.includes(r.name)).concat(routesClient);
    }
  
    /**
     * @see ServerExpressMetastocle.prototype.getApiRoutes
     */
    getApiRoutes() {      
      return super.getApiRoutes().concat(routesApi);
    }
  
    /**
     * @see ServerExpressMetastocle.prototype.getApiMasterRoutes
     */
    getApiMasterRoutes() {
      const remove = ['updateDocuments', 'deleteDocuments', 'getDocuments'];
      return super.getApiMasterRoutes().filter(r => !remove.includes(r.name)).concat(routesApiMaster);
    }

    /**
     * @see ServerExpressMetastocle.prototype.getApiButlerRoutes
     */
    getApiButlerRoutes() {
      const remove = ['updateDocuments', 'deleteDocuments', 'getDocuments'];
      return super.getApiButlerRoutes().filter(r => !remove.includes(r.name)).concat(routesApiButler);
    }
  
    /**
     * @see ServerExpressMetastocle.prototype.getApiSlaveRoutes
     */
    getApiSlaveRoutes() {
      const remove = ['updateDocuments', 'deleteDocuments', 'getDocuments'];
      return super.getApiSlaveRoutes().filter(r => !remove.includes(r.name)).concat(routesApiSlave);
    }

    /**
     * @see ServerExpressMetastocle.prototype.getApiNodeRoutes
     */
    getApiNodeRoutes() {
      const remove = ['addDocument'];
      return super.getApiNodeRoutes().filter(r => !remove.includes(r.name)).concat(routesApiNode);
    }
  }
};