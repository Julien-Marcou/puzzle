export class AbortError extends Error {

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AbortError';
  }

}

export class ImageTooBigError extends Error {

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ImageTooBigError';
  }

}

export class ImageTooSmallError extends Error {

  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ImageTooSmallError';
  }

}

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
