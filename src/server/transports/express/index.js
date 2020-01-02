const ServerExpressMetastocle = require('metastocle/src/server/transports/express')();
const routes = require('./routes');
const routesClient = require('./client/routes');
const routesApi = require('./api/routes');
const routesApiMaster = require('./api/master/routes');
const routesApiSlave = require('./api/slave/routes');
const routesApiNode = require('./api/node/routes');

module.exports = (Parent) => {
  return class ServerExpressMuseria extends (Parent || ServerExpressMetastocle) {
   /**
     * @see ServerExpressMetastocle.prototype.getMainRoutes
     */
    getMainRoutes() {
      let arr = super.getMainRoutes();
      const current = routes.slice(2);
      arr = [routes[0], routes[1]].concat(arr.filter(obj => obj.name != 'indexPage'));
      arr.splice(arr.findIndex(r => r.name == 'notFound'), 0, ...current); 
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