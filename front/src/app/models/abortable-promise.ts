import { AbortError } from './error';

export const enum PromiseState {
  Running = 'running',
  Resolved = 'resolved',
  Rejected = 'rejecte',
  Aborted = 'aborted',
}

export type AbortableExecutor<T> = (
  resolve: (value: T) => void,
  reject: (reason?: unknown) => void,
  abortSignal: AbortSignal,
) => void | Promise<void>;

export class AbortablePromise<T> extends Promise<T> {

  private readonly abortController: AbortController;
  private state = PromiseState.Running;

  constructor(executor: AbortableExecutor<T>) {
    const abortController = new AbortController();
    super((innerResolve, innerReject) => {
      const resolve = (value: T): void => {
        this.state = PromiseState.Resolved;
        innerResolve(value);
      };
      const reject = (reason?: unknown): void => {
        this.state = PromiseState.Rejected;
        innerReject(reason);
      };
      abortController.signal.addEventListener('abort', () => {
        this.state = PromiseState.Aborted;
        innerReject(new AbortError('Promise has been aborted'));
      });
      Promise.resolve(executor(resolve, reject, abortController.signal)).catch((error: unknown) => {
        console.error(error);
        reject(error);
      });
    });
    this.abortController = abortController;
  }

  public get resolved(): boolean {
    return this.state === PromiseState.Resolved;
  }

  public get rejected(): boolean {
    return this.state === PromiseState.Rejected;
  }

  public get aborted(): boolean {
    return this.state === PromiseState.Aborted;
  }

  public async abort(): Promise<void> {
    if (this.state !== PromiseState.Running) {
      return;
    }
    this.abortController.abort();
    try {
      await this;
    }
    catch {
      // Silently fail, as this should be handled where this class has been instantiated
    }
  }

}
