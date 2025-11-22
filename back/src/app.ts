import { inject, injectable } from 'inversify';

import { HttpServer } from './services/http-server';

@injectable()
export class App {

  constructor(@inject(HttpServer) private readonly httpServer: HttpServer) {}

  public start(): void {
    this.httpServer.start();
  }

  public stop(): void {
    this.httpServer.stop(true);
  }

}
