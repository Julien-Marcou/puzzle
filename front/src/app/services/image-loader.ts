import { AbortablePromise } from '../models/abortable-promise';

export class FileReadError extends Error {

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FileReadError';
  }

}
export class FileFetchError extends Error {

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FileFetchError';
  }

}

export class ImageCreateError extends Error {

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ImageCreateError';
  }

}

export class ImageLoader {

  public static loadFromFile(file: File): AbortablePromise<ImageBitmap> {
    return new AbortablePromise((resolve, reject, abortSignal) => {
      const fileReader = new FileReader();

      abortSignal.addEventListener('abort', () => {
        fileReader.abort();
      });

      fileReader.addEventListener('load', () => {
        const blob = new Blob([fileReader.result as ArrayBuffer]);
        ImageLoader.createFromBlob(blob)
          .then((imageBitmap) => {
            resolve(imageBitmap);
          })
          .catch((error: unknown) => {
            reject(error);
          });
      });

      fileReader.addEventListener('error', () => {
        reject(new FileReadError('An error occurred while reading the file'));
      });

      fileReader.addEventListener('abort', () => {
        if (!abortSignal.aborted) {
          reject(new FileReadError('An error caused the file reading to be aborted'));
        }
      });

      fileReader.readAsArrayBuffer(file);
    });
  }

  public static loadFromUrl(src: string): AbortablePromise<ImageBitmap> {
    return new AbortablePromise(async (resolve, reject, abortSignal) => {
      try {
        const response = await fetch(src, { signal: abortSignal });
        if (response.status !== 200) {
          throw new FileFetchError(`Image fetching ended with HTTP error code ${response.status}`);
        }
        const blob = await response.blob();
        const imageBitmap = await ImageLoader.createFromBlob(blob);
        resolve(imageBitmap);
      }
      catch (error) {
        reject(error);
      }
    });
  }

  private static async createFromBlob(blob: Blob): Promise<ImageBitmap> {
    try {
      return await createImageBitmap(blob);
    }
    catch (error) {
      throw new ImageCreateError('Could not convert the file to ImageBitmap', { cause: error instanceof Error ? error : undefined });
    }
  }

}
