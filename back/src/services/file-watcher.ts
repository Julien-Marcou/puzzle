import { watch, statSync } from 'fs';
import type { FSWatcher } from 'fs';

export class FileWatcher {

  private static WatchInode = process.platform === 'linux';

  private inode?: number;
  private watcher?: FSWatcher;

  constructor(private readonly path: string, private readonly callback: () => void) {
    if (FileWatcher.WatchInode) {
      this.inode = this.getInode();
    }
    this.updateWatcher();
  }

  public close(): void {
    if (!this.watcher) {
      return;
    }
    this.watcher.close();
    this.watcher = undefined;
  }

  private getInode(): number {
    return statSync(this.path).ino;
  }

  private updateWatcher(): void {
    if (this.watcher) {
      this.watcher.close();
    }
    this.watcher = watch(this.path, () => {
      this.fileChange();
    });
  }

  private fileChange(): void {
    if (FileWatcher.WatchInode) {
      const inode = this.getInode();
      if (this.inode !== inode) {
        this.inode = inode;
        this.updateWatcher();
      }
    }
    this.callback();
  }

}
