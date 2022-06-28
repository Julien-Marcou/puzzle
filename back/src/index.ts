import { Env } from './env';

const app = new Env().getApp();
app.start();
process.on('SIGINT', () => {
  app.stop();
});
