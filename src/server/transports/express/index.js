import expressStoracle from "storacle/src/server/transports/express/index.js";
import expressMetastocle from "metastocle/src/server/transports/express/index.js";
import routes from "./routes.js";
import routesClient from "./client/routes.js";
import routesApi from "./api/routes.js";
import routesApiMaster from "./api/master/routes.js";
import routesApiButler from "./api/butler/routes.js";
import routesApiSlave from "./api/slave/routes.js";
import routesApiNode from "./api/node/routes.js";

const ServerExpressStoracle = expressStoracle();
const ServerExpressMetastocle = expressMetastocle(ServerExpressStoracle);

export default (Parent) => {
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
                'deleteDocuments', 'getDocumentsCount',
                'getDocumentByPk', 'getDocuments', 'removeFile'
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
            const remove = ['updateDocuments', 'deleteDocuments', 'removeFile'];
            return super.getApiMasterRoutes().filter(r => !remove.includes(r.name)).concat(routesApiMaster);
        }
        /**
         * @see ServerExpressMetastocle.prototype.getApiButlerRoutes
         */
        getApiButlerRoutes() {
            const remove = ['updateDocuments', 'deleteDocuments', 'removeFile'];
            return super.getApiButlerRoutes().filter(r => !remove.includes(r.name)).concat(routesApiButler);
        }
        /**
         * @see ServerExpressMetastocle.prototype.getApiSlaveRoutes
         */
        getApiSlaveRoutes() {
            const remove = ['updateDocuments', 'deleteDocuments', 'removeFile'];
            return super.getApiSlaveRoutes().filter(r => !remove.includes(r.name)).concat(routesApiSlave);
        }
        /**
         * @see ServerExpressMetastocle.prototype.getApiNodeRoutes
         */
        getApiNodeRoutes() {
            const remove = ['addDocument', 'storFile'];
            return super.getApiNodeRoutes().filter(r => !remove.includes(r.name)).concat(routesApiNode);
        }
    };
};
