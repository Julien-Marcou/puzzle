import { readFileSync, watch } from 'fs';
import { createServer as createUnsecureServer, Server as UnsecureServer } from 'http';
import { createServer as createSecureServer, Server as SecureServer } from 'https';
import { inject, injectable } from 'inversify';
import type { SSLConfig } from '../env';
import type { FSWatcher } from 'fs';
import type { Duplex } from 'stream';
import type { SecureContextOptions } from 'tls';

@injectable()
export class HttpServer {

  private static SSLUpdateDelay = 10000;

  private server: SecureServer | UnsecureServer;
  private sslFileWatchers?: ReadonlyArray<FSWatcher>;
  private connections: Set<Duplex> = new Set();
  private sslUpdateTimeout?: NodeJS.Timeout;

  constructor(
    @inject('PORT') private readonly port: number,
    @inject('HOSTNAME') private readonly hostname: string,
    @inject('SSL_CONFIG') private readonly sslConfig?: SSLConfig,
  ) {
    this.server = this.createServer();

    this.server.on('connection', (socket) => {
      this.connections.add(socket);
      socket.on('close', () => {
        this.connections.delete(socket);
      });
    });

    this.server.on('error', (error) => {
      console.error(error);
    });
  }

  public start(): void {
    this.startWatchingSslCertificateFiles();
    this.startListening();
  }

  public stop(closeAllConnections = false): void {
    this.stopWatchingSslCertificateFiles();
    this.stopListening();
    if (closeAllConnections) {
      this.closeAllConnections();
    }
  }

  private createServer(): SecureServer | UnsecureServer {
    if (this.sslConfig) {
      try {
        return createSecureServer(this.getSecureContext());
      }
      catch (error) {
        console.error(error);
        console.log('Could not create HTTPS server, switching to HTTP');
      }
    }
    return createUnsecureServer();
  }

  private startListening(): void {
    if (this.server.listening) {
      return;
    }
    this.server.listen(this.port, this.hostname, () => {
      console.log(`${
        this.server instanceof SecureServer ? 'HTTPS' : 'HTTP'
      } Server is running at ${
        this.server instanceof SecureServer ? 'https' : 'http'}://${this.hostname}:${this.port} (${this.getCurrentDateTime()
      })`);
    });
  }

  private stopListening(): void {
    if (!this.server.listening) {
      return;
    }
    this.server.close(() => {
      console.log(`${
        this.server instanceof SecureServer ? 'HTTPS' : 'HTTP'
      } Server stopped (${this.getCurrentDateTime()})`);
    });
  }

  private startWatchingSslCertificateFiles(): void {
    if (!this.sslConfig || !(this.server instanceof SecureServer) || this.sslFileWatchers) {
      return;
    }
    this.sslFileWatchers = [
      watch(this.sslConfig.certificateFile, () => {
        this.scheduleSecureContextUpdate();
      }),
      watch(this.sslConfig.privateKeyFile, () => {
        this.scheduleSecureContextUpdate();
      }),
    ];
  }

  private stopWatchingSslCertificateFiles(): void {
    if (!this.sslFileWatchers) {
      return;
    }
    this.sslFileWatchers.forEach((fileWatcher) => {
      fileWatcher.close();
    });
    this.sslFileWatchers = undefined;
  }

  private closeAllConnections(): void {
    this.connections.forEach((socket) => {
      socket.destroy();
    });
    this.connections = new Set();
  }

  private scheduleSecureContextUpdate(): void {
    if (!(this.server instanceof SecureServer) || this.sslUpdateTimeout) {
      return;
    }
    this.sslUpdateTimeout = setTimeout(() => {
      this.sslUpdateTimeout = undefined;
      this.updateSecureContext();
    }, HttpServer.SSLUpdateDelay);
  }

  private updateSecureContext(): void {
    if (!(this.server instanceof SecureServer)) {
      return;
    }
    try {
      this.server.setSecureContext(this.getSecureContext());
    }
    catch (error) {
      console.error(error);
      console.log('Could not update Secure Context for HTTPS Server, keeping old context');
    }
  }

  private getSecureContext(): SecureContextOptions {
    if (!this.sslConfig) {
      return {};
    }
    return {
      cert: readFileSync(this.sslConfig.certificateFile),
      key: readFileSync(this.sslConfig.privateKeyFile),
    };
  }

  private getCurrentDateTime(): string {
    return new Date().toLocaleString('en-US', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  }

}
