import './styles/main.scss';
import Akili from 'akili';
import router from 'akili/src/services/router.js';
import App from './controllers/app/app.js';
import client from './client.js';

App.define();

document.addEventListener('DOMContentLoaded', async () => {
  try {    
    router.init('/app', false);
    await client.init();
    await Akili.init();
  }
  catch(err) {
    // eslint-disable-next-line no-console
    console.error(err);
  }
});