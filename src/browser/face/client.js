import ClientMuseria from '../../../dist/museria.client.js';
const client = new ClientMuseria({ address: `${location.hostname}:${location.port || (location.protocol == 'https:'? 443: 80) }` });
export default client;