import ClientMuseria from '../../../dist/museria.client.js';
const client = new ClientMuseria({ https: ClientMuseria.getPageProtocol() == 'https' });
export default client;