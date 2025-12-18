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

  constructor(executor: AbortableExecutor<T>) {
    const abortController = new AbortController();
    super((resolve, reject) => {
      Promise.resolve(executor(resolve, reject, abortController.signal)).catch((error: unknown) => {
        console.error(error);
        reject(error);
      });
    });
    this.abortController = abortController;
  }

  public async abort(): Promise<void> {
    this.abortController.abort();
    try {
      await this;
    }
    catch {
      // Silently fail, as this should be handled where this class has been instantiated
    }
  }

}
