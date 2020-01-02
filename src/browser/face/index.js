import './styles/main.scss';
import Akili from 'akili';
import router from 'akili/src/services/router';
import App from './controllers/app/app';
import client from './client';

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