import ClientMuseria from '../../../dist/museria.client.js';
const https = location.protocol == 'https:';
const client = new ClientMuseria({ 
  address: `${location.hostname}:${location.port || (https? 443: 80) }`, 
  https
});
export default client;