import { config } from 'dotenv';
import { Container } from 'inversify';
import { normalize } from 'node:path';

import 'reflect-metadata';

import { App } from './app';

export type SSLConfig = {
  certificateFile: string;
  privateKeyFile: string;
};

export class Env {

  private readonly lookupDirectory = __dirname;
  private readonly container: Container;

  constructor() {
    config({ path: normalize(`${this.lookupDirectory}/.env`), quiet: true });
    this.container = new Container({ autobind: true, defaultScope: 'Singleton' });
    this.bindHostname();
    this.bindPort();
    this.bindSSLConfig();
  }

  public getApp(): App {
    return this.container.get(App);
  }

  private bindHostname(): void {
    if (!process.env['HOSTNAME']) {
      throw new Error('HOSTNAME is not defined in the .env file');
    }
    this.container.bind<string>('HOSTNAME').toConstantValue(process.env['HOSTNAME']);
  }

  private bindPort(): void {
    if (!process.env['PORT']) {
      throw new Error('PORT is not defined in the .env file');
    }
    this.container.bind<number>('PORT').toConstantValue(parseInt(process.env['PORT'], 10));
  }

  private bindSSLConfig(): void {
    if (process.env['SECURE']?.toLowerCase() !== 'true') {
      this.container.bind<undefined>('SSL_CONFIG').toConstantValue(undefined);
      return;
    }
    if (!process.env['SSL_CERTIFICATE_FILE']) {
      throw new Error('SSL_CERTIFICATE_FILE is not defined in the .env file');
    }
    if (!process.env['SSL_PRIVATE_KEY_FILE']) {
      throw new Error('SSL_PRIVATE_KEY_FILE is not defined in the .env file');
    }
    this.container.bind<SSLConfig>('SSL_CONFIG').toConstantValue({
      certificateFile: normalize(`${this.lookupDirectory}/${process.env['SSL_CERTIFICATE_FILE']}`),
      privateKeyFile: normalize(`${this.lookupDirectory}/${process.env['SSL_PRIVATE_KEY_FILE']}`),
    });
  }

}
