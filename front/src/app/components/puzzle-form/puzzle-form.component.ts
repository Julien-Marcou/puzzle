import type { AbortablePromise } from '../../models/abortable-promise';
import type { Point } from '../../models/geometry';
import type { ElementRef, OnInit } from '@angular/core';

import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AXIS_TO_DIMENSION, VALID_AXES } from '../../models/geometry';
import { CurrentPuzzleGameService } from '../../services/current-puzzle-parameters.service';
import { FileFetchError, FileReadError, ImageCreateError, ImageLoader } from '../../services/image-loader';
import { CheckmarkSpinnerComponent } from '../checkmark-spinner/checkmark-spinner.component';
import { PuzzlePreviewComponent } from '../puzzle-preview/puzzle-preview.component';

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
  selector: 'app-puzzle-form',
  templateUrl: './puzzle-form.component.html',
  styleUrl: './puzzle-form.component.scss',
  imports: [FormsModule, CheckmarkSpinnerComponent, PuzzlePreviewComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleFormComponent implements OnInit {

  private readonly router = inject(Router);
  private readonly currentPuzzleGameService = inject(CurrentPuzzleGameService);

  private readonly puzzleFileInput = viewChild.required<ElementRef<HTMLInputElement>>('puzzleFileInput');

  public readonly puzzleImageFolder = '/img/puzzles';
  public readonly puzzleThumbnailFolder = '/img/puzzle-thumbnails';
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

  public readonly puzzleImage = signal<ImageBitmap | null>(null);
  public readonly selectedPuzzle = signal<string | null>(null);
  public readonly loadingPuzzle = signal<string | null>(null);
  public readonly selectedCustomPuzzle = signal<string | null>(null);
  public readonly loadingCustomPuzzle = signal<string | null>(null);
  public readonly selectedPieceSizeIndex = signal<number>(1);
  public readonly validPieceSizes = signal<number[]>([50, 100, 200, 400, 500]);
  public readonly puzzleOffset = signal<Point>({ x: 0, y: 0 });
  public readonly pieceSize = signal<number>(100);
  public readonly horizontalPieceCount = signal<number>(10);
  public readonly verticalPieceCount = signal<number>(10);
  public readonly gameStarted = signal<boolean>(false);
  public readonly gameFinished = signal<boolean>(false);
  public readonly gamePlayTime = signal<string>('');
  public readonly imageError = signal<ImageError | null>(null);

  protected readonly maxFileSize = 15; // In Megabytes
  protected readonly minPuzzleImageWidth = 450; // In pixels
  protected readonly minPuzzleImageHeight = 450; // In pixels
  protected readonly maxPuzzleImageWidth = 4096; // In pixels
  protected readonly maxPuzzleImageHeight = 4096; // In pixels

  private readonly minPieceCountPerAxis = 4; // 12 pieces
  private readonly maxPieceCountPerAxis = 50; // 2500 pieces
  private readonly minPieceSizeConstraint = 60; // In pixels
  private readonly maxPieceSizeConstraint = 600; // In pixels
  private readonly imageErrorDelay = 5000; // In milliseconds
  private imageLoading?: AbortablePromise<ImageBitmap>;
  private imageErrorTimeout?: number;

  public ngOnInit(): void {
    this.puzzleFileInput().nativeElement.addEventListener('dragover', () => {
      this.puzzleFileInput().nativeElement.classList.add('drop');
    }, { passive: true });
    this.puzzleFileInput().nativeElement.addEventListener('dragleave', () => {
      this.puzzleFileInput().nativeElement.classList.remove('drop');
    }, { passive: true });
    this.puzzleFileInput().nativeElement.addEventListener('drop', () => {
      this.puzzleFileInput().nativeElement.classList.remove('drop');
    }, { passive: true });

    // Exec order :
    // - load puzzle image
    // - update puzzle image
    // - update valide piece sizes (select one by default)
    // - update piece size
    // - update puzzle size
    // - render puzzle preview
    this.setPuzzle(this.puzzles[0]).catch((error: unknown) => {
      console.error(error);
    });
  }

  public clearImageError(): void {
    if (this.imageErrorTimeout) {
      window.clearTimeout(this.imageErrorTimeout);
    }
    this.imageError.set(null);
  }

  public async setPuzzle(puzzleImageUrl: string): Promise<void> {
    this.loadingPuzzle.set(puzzleImageUrl);
    const updated = await this.updatePuzzleImage(ImageLoader.loadFromUrl(`${this.puzzleImageFolder}/${puzzleImageUrl}`));
    this.loadingPuzzle.set(null);
    if (updated) {
      this.selectedPuzzle.set(puzzleImageUrl);
      this.selectedCustomPuzzle.set(null);
    }
  }

  public async setCustomPuzzle(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.puzzleFileInput().nativeElement.value = '';

    if (file.size > (this.maxFileSize * 1024 * 1024)) {
      this.displayImageError('too-heavy');
      return;
    }

    this.loadingCustomPuzzle.set(file.name);
    const updated = await this.updatePuzzleImage(ImageLoader.loadFromFile(file));
    this.loadingCustomPuzzle.set(null);
    if (updated) {
      this.selectedPuzzle.set(null);
      this.selectedCustomPuzzle.set(file.name);
    }
  }

  public updatePieceSize(): void {
    this.pieceSize.set(this.validPieceSizes()[this.selectedPieceSizeIndex()]);
    this.updatePuzzleSize();
  }

  public async startPuzzle(): Promise<void> {
    const puzzleImage = this.puzzleImage();
    if (!puzzleImage) {
      return;
    }

    this.currentPuzzleGameService.setParameters({
      puzzleImage,
      puzzleOffset: this.puzzleOffset(),
      pieceSize: this.pieceSize(),
      horizontalPieceCount: this.horizontalPieceCount(),
      verticalPieceCount: this.verticalPieceCount(),
    });
    await this.router.navigate(['/play']);
  }

  private async updatePuzzleImage(imageLoading: AbortablePromise<ImageBitmap>): Promise<boolean> {
    if (this.imageLoading) {
      await this.imageLoading.abort();
    }

    let success = false;
    this.imageLoading = imageLoading;
    try {
      const newPuzzleImage = await imageLoading;
      if (newPuzzleImage.width > this.maxPuzzleImageWidth || newPuzzleImage.height > this.maxPuzzleImageHeight) {
        throw new ImageTooBigError('The image is too big to be used');
      }
      if (newPuzzleImage.width < this.minPuzzleImageWidth || newPuzzleImage.height < this.minPuzzleImageHeight) {
        throw new ImageTooSmallError('The image is too small to be used');
      }
      const currentPuzzleImage = this.puzzleImage();
      if (currentPuzzleImage) {
        currentPuzzleImage.close();
      }
      this.puzzleImage.set(newPuzzleImage);
      this.updateValidPieceSizes();
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

  private updateValidPieceSizes(): void {
    const puzzleImage = this.puzzleImage();
    if (!puzzleImage) {
      return;
    }
    const minPieceSize = Math.max(
      Math.floor(puzzleImage.width / this.maxPieceCountPerAxis),
      Math.floor(puzzleImage.height / this.maxPieceCountPerAxis),
      this.minPieceSizeConstraint,
    );
    const maxPieceSize = Math.min(
      Math.floor(puzzleImage.width / this.minPieceCountPerAxis),
      Math.floor(puzzleImage.height / this.minPieceCountPerAxis),
      this.maxPieceSizeConstraint,
    );

    const validPieceSizes = [];
    for (const axis of VALID_AXES) {
      const puzzleDimension = puzzleImage[AXIS_TO_DIMENSION[axis]];
      const minPieceCount = Math.floor(puzzleDimension / maxPieceSize);
      const maxPieceCount = Math.floor(puzzleDimension / minPieceSize);
      for (let pieceCount = minPieceCount; pieceCount <= maxPieceCount; pieceCount++) {
        const pieceSize = Math.max(minPieceSize, Math.min(maxPieceSize, Math.floor(puzzleDimension / pieceCount)));
        const pieceSizeIndex = validPieceSizes.findIndex((validPieceSize) => validPieceSize <= pieceSize);
        // Add values in descending order (from the biggest piece to the smallest piece)
        // So the range input is going from the smallest to the biggest number of pieces
        if (pieceSizeIndex === -1) {
          validPieceSizes.push(pieceSize);
        }
        else if (validPieceSizes[pieceSizeIndex] !== pieceSize) {
          validPieceSizes.splice(pieceSizeIndex, 0, pieceSize);
        }
      }
    }

    this.validPieceSizes.set(validPieceSizes);
    this.selectedPieceSizeIndex.set(Math.floor(this.validPieceSizes().length / 4));
    this.updatePieceSize();
  }

  private updatePuzzleSize(): void {
    const puzzleImage = this.puzzleImage();
    if (!puzzleImage) {
      return;
    }
    this.horizontalPieceCount.set(Math.floor(puzzleImage.width / this.pieceSize()));
    this.verticalPieceCount.set(Math.floor(puzzleImage.height / this.pieceSize()));
    const puzzleWidth = this.horizontalPieceCount() * this.pieceSize();
    const puzzleHeight = this.verticalPieceCount() * this.pieceSize();
    this.puzzleOffset.set({
      x: Math.floor((puzzleImage.width - puzzleWidth) / 2),
      y: Math.floor((puzzleImage.height - puzzleHeight) / 2),
    });
  }

  private displayImageError(error: ImageError): void {
    if (this.imageErrorTimeout) {
      window.clearTimeout(this.imageErrorTimeout);
    }
    this.imageError.set(error);
    this.imageErrorTimeout = window.setTimeout(() => {
      this.imageErrorTimeout = undefined;
      this.imageError.set(null);
    }, this.imageErrorDelay);
  }

}
