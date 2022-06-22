import { Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { AbortablePromise } from '../../models/abortable-promise';
import { AXIS_TO_DIMENSION, VALID_AXES } from '../../models/geometry';
import { PuzzleGame } from '../../models/puzzle-game';
import { PuzzlePreview } from '../../models/puzzle-preview';
import { PuzzleSpritesheet } from '../../models/puzzle-spritesheet';
import { FileFetchError, FileReadError, ImageCreateError, ImageLoader } from '../../services/image-loader';
import type { Point } from '../../models/geometry';

class ImageTooBigError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ImageTooBigError';
  }
}

class ImageTooSmallError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'ImageTooSmallError';
  }
}

type ImageError = 'unknown' | 'too-heavy' | 'too-small' | 'too-big' | 'file-read' | 'file-fetch' | 'image-create';

@Component({
  selector: 'app-puzzle-preview',
  templateUrl: './puzzle-preview.component.html',
  styleUrls: ['./puzzle-preview.component.scss'],
})
export class PuzzlePreviewComponent implements OnInit {

  @ViewChild('puzzleFileInput', {static: true}) private puzzleFileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('puzzlePreview', {static: true}) private puzzlePreviewRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('puzzleGameWrapper', {static: true}) private puzzleGameWrapperRef!: ElementRef<HTMLCanvasElement>;

  public readonly puzzleImageFolder = '/assets/puzzles';
  public readonly puzzleThumbnailFolder = '/assets/puzzle-thumbnails';
  public readonly puzzles = [
    'the-great-wave-off-kanagawa.jpg',
    'mandalas-by-viscious-speed.jpg',
    'blue-marble-western-hemisphere-by-nasa.jpg',
    'bridge-by-jamesdemers.jpg',
    'castle-fontainebleau-by-edmondlafoto.jpg',
    'color-by-pierre9x6.jpg',
    'eiffel-tower-by-thedigitalartist.jpg',
    'golden-gate-bridge-by-pexels.jpg',
    'horizon-forbidden-west.jpg',
    'apartment-by-pierre9x6.jpg',
    'new-york-broadway-by-schaerfsystem.jpg',
    'nightcity-by-vectorpocket.jpg',
    'osaka-by-masashiwakui.jpg',
    'owl-by-chraecker.jpg',
    'paris-by-edmondlafoto.jpg',
    'paris-louvre-by-designerpoint.jpg',
    'paris-restaurants-by-pierre9x6.jpg',
    'sci-fi-room-by-vanitjan1.jpg',
    'tokyo-street-by-edo_tokyo_.jpg',
    'tokyo-woman-by-thepoorphotographer.jpg',
    'venice-by-matteoangeloni.jpg',
    'verdon-canyon.jpg',
    'aloy.jpg',
    'tiger-by-pexels.jpg',
  ];

  public puzzleImage?: ImageBitmap;
  public selectedPuzzle?: string;
  public loadingPuzzle?: string;
  public selectedCustomPuzzle?: string;
  public loadingCustomPuzzle?: string;
  public selectedPieceSizeIndex = 1;
  public validPieceSizes: Array<number> = [50, 100, 200, 400, 500];
  public puzzleOffset: Point = {x: 0, y: 0};
  public pieceSize = 100;
  public horizontalPieceCount = 10;
  public verticalPieceCount = 10;
  public gameStarted = false;
  public imageError?: ImageError;

  private readonly minPieceCountPerAxis = 4; // 12 pieces
  private readonly maxPieceCountPerAxis = 50; // 2500 pieces
  private readonly minPieceSizeConstraint = 60; // In pixels
  private readonly maxPieceSizeConstraint = 600; // In pixels
  private readonly maxFileSize = 15 * 1024 * 1024; // In Bytes
  private readonly minPuzzleImageWidth = 450; // In pixels
  private readonly minPuzzleImageHeight = 450; // In pixels
  private readonly maxPuzzleImageWidth = 4096; // In pixels
  private readonly maxPuzzleImageHeight = 4096; // In pixels
  private readonly imageErrorDelay = 5000; // In milliseconds
  private puzzleGame?: PuzzleGame;
  private imageLoading?: AbortablePromise<ImageBitmap>;
  private renderingPreview = false;
  private imageErrorTimeout?: number;

  public async ngOnInit(): Promise<void> {
    this.puzzleFileInput.nativeElement.addEventListener('dragover', () => {
      this.puzzleFileInput.nativeElement.classList.add('drop');
    });
    this.puzzleFileInput.nativeElement.addEventListener('dragleave', () => {
      this.puzzleFileInput.nativeElement.classList.remove('drop');
    });
    this.puzzleFileInput.nativeElement.addEventListener('drop', () => {
      this.puzzleFileInput.nativeElement.classList.remove('drop');
    });

    // Exec order :
    // - load puzzle image
    // - update puzzle image
    // - update valide piece sizes (select one by default)
    // - update piece size
    // - update puzzle size
    // - render puzzle preview
    await this.setPuzzle(this.puzzles[0]);
  }

  public async setCustomPuzzle(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.puzzleFileInput.nativeElement.value = '';

    if (file.size > this.maxFileSize) {
      this.displayImageError('too-heavy');
      return;
    }

    this.loadingCustomPuzzle = file.name;
    const updated = await this.updatePuzzleImage(ImageLoader.loadFromFile(file));
    this.loadingCustomPuzzle = undefined;
    if (updated) {
      this.selectedPuzzle = undefined;
      this.selectedCustomPuzzle = file.name;
    }
  }

  public clearImageError(): void {
    if (this.imageErrorTimeout) {
      window.clearTimeout(this.imageErrorTimeout);
    }
    this.imageError = undefined;
  }

  public async setPuzzle(puzzleImageUrl: string): Promise<void> {
    this.loadingPuzzle = puzzleImageUrl;
    const updated = await this.updatePuzzleImage(ImageLoader.loadFromUrl(`${this.puzzleImageFolder}/${puzzleImageUrl}`));
    this.loadingPuzzle = undefined;
    if (updated) {
      this.selectedPuzzle = puzzleImageUrl;
      this.selectedCustomPuzzle = undefined;
    }
  }

  public async updatePieceSize(): Promise<void> {
    this.pieceSize = this.validPieceSizes[this.selectedPieceSizeIndex];
    await this.updatePuzzleSize();
  }

  public async startPuzzle(): Promise<void> {
    if (!this.puzzleImage) {
      return;
    }
    const puzzleSpritesheet = new PuzzleSpritesheet(
      this.puzzleImage,
      this.puzzleOffset,
      this.pieceSize,
      this.horizontalPieceCount,
      this.verticalPieceCount,
    );
    window.requestAnimationFrame(() => {
      this.puzzleGame = new PuzzleGame(
        this.puzzleGameWrapperRef.nativeElement,
        puzzleSpritesheet,
        this.pieceSize,
        this.horizontalPieceCount,
        this.verticalPieceCount,
      );
    });
    this.gameStarted = true;
  }

  public exitPuzzle(): void {
    if (this.puzzleGame) {
      this.puzzleGame.stop();
    }
    this.gameStarted = false;
  }

  public debugWebGL(): void {
    if (this.puzzleGame) {
      this.puzzleGame.debug();
    }
  }

  private async updatePuzzleImage(imageLoading: AbortablePromise<ImageBitmap>): Promise<boolean> {
    if (this.imageLoading) {
      await this.imageLoading.abort();
    }

    let success = false;
    this.imageLoading = imageLoading;
    try {
      const puzzleImage = await imageLoading;
      if (puzzleImage.width > this.maxPuzzleImageWidth || puzzleImage.height > this.maxPuzzleImageHeight) {
        throw new ImageTooBigError('The image is too big to be used');
      }
      if (puzzleImage.width < this.minPuzzleImageWidth || puzzleImage.height < this.minPuzzleImageHeight) {
        throw new ImageTooSmallError('The image is too small to be used');
      }
      if (this.puzzleImage) {
        this.puzzleImage.close();
      }
      this.puzzleImage = puzzleImage;
      await this.updateValidPieceSizes();
      success = true;
    }
    catch (error) {
      if (!this.imageLoading.aborted) {
        console.error(error);
        if (error instanceof ImageTooBigError) {
          this.displayImageError('too-big');
        }
        else if (error instanceof ImageTooSmallError) {
          this.displayImageError('too-small');
        }
        else if (error instanceof FileReadError) {
          this.displayImageError('file-read');
        }
        else if (error instanceof FileFetchError) {
          this.displayImageError('file-fetch');
        }
        else if (error instanceof ImageCreateError) {
          this.displayImageError('image-create');
        }
        else {
          this.displayImageError('unknown');
        }
      }
    }
    this.imageLoading = undefined;

    return success;
  }

  private async updateValidPieceSizes(): Promise<void> {
    if (!this.puzzleImage) {
      return;
    }
    const minPieceSize = Math.max(
      Math.floor(this.puzzleImage.width / this.maxPieceCountPerAxis),
      Math.floor(this.puzzleImage.height / this.maxPieceCountPerAxis),
      this.minPieceSizeConstraint,
    );
    const maxPieceSize = Math.min(
      Math.floor(this.puzzleImage.width / this.minPieceCountPerAxis),
      Math.floor(this.puzzleImage.height / this.minPieceCountPerAxis),
      this.maxPieceSizeConstraint,
    );

    this.validPieceSizes = [];
    for (const axis of VALID_AXES) {
      const puzzleDimension = this.puzzleImage[AXIS_TO_DIMENSION[axis]];
      const minPieceCount = Math.floor(puzzleDimension / maxPieceSize);
      const maxPieceCount = Math.floor(puzzleDimension / minPieceSize);
      for (let pieceCount = minPieceCount; pieceCount <= maxPieceCount; pieceCount++) {
        const pieceSize = Math.max(minPieceSize, Math.min(maxPieceSize, Math.floor(puzzleDimension / pieceCount)));
        const pieceSizeIndex = this.validPieceSizes.findIndex((validPieceSize) => validPieceSize <= pieceSize);
        // Add values in descending order (from the biggest piece to the smallest piece)
        // So the range input is going from the smallest to the biggest number of pieces
        if (pieceSizeIndex === -1) {
          this.validPieceSizes.push(pieceSize);
        }
        else if (this.validPieceSizes[pieceSizeIndex] !== pieceSize) {
          this.validPieceSizes.splice(pieceSizeIndex, 0, pieceSize);
        }
      }
    }

    this.selectedPieceSizeIndex = Math.floor(this.validPieceSizes.length / 4);
    await this.updatePieceSize();
  }

  private async updatePuzzleSize(): Promise<void> {
    if (!this.puzzleImage) {
      return;
    }
    this.horizontalPieceCount = Math.floor(this.puzzleImage.width / this.pieceSize);
    this.verticalPieceCount = Math.floor(this.puzzleImage.height / this.pieceSize);
    const puzzleWidth = this.horizontalPieceCount * this.pieceSize;
    const puzzleHeight = this.verticalPieceCount * this.pieceSize;
    this.puzzleOffset = {
      x: Math.floor((this.puzzleImage.width - puzzleWidth) / 2),
      y: Math.floor((this.puzzleImage.height - puzzleHeight) / 2),
    };
    await this.updatePuzzlePreview();
  }

  private async updatePuzzlePreview(): Promise<void> {
    // Throttle the rendering so that we are not rendering it too often
    // (the user may change the puzzle size faster than the canvas is able to render it during one frame)
    if (this.renderingPreview) {
      return;
    }
    return new Promise((resolve) => {
      this.renderingPreview = true;
      window.requestAnimationFrame(() => {
        // The rendering must be synchronous,
        // so that cancelling a new puzzle image loading and immediatly loading another one
        // will guarantee that that the first one will not render after the second one
        this.renderingPreview = false;
        if (!this.puzzleImage) {
          return;
        }
        new PuzzlePreview(
          this.puzzlePreviewRef.nativeElement,
          this.puzzleImage,
          this.puzzleOffset,
          this.pieceSize,
          this.horizontalPieceCount,
          this.verticalPieceCount,
        );
        resolve();
      });
    });
  }

  private displayImageError(error: ImageError): void {
    if (this.imageErrorTimeout) {
      window.clearTimeout(this.imageErrorTimeout);
    }
    this.imageError = error;
    this.imageErrorTimeout = window.setTimeout(() => {
      this.imageErrorTimeout = undefined;
      this.imageError = undefined;
    }, this.imageErrorDelay);
  }

}
