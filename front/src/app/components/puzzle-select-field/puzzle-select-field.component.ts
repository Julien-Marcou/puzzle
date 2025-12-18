import type { AbortablePromise } from '../../models/abortable-promise';
import type { ElementRef, OnInit } from '@angular/core';

import { ChangeDetectionStrategy, Component, model, signal, viewChild } from '@angular/core';

import { ImageTooBigError, ImageTooSmallError, FileReadError, FileFetchError, ImageCreateError } from '../../models/error';
import { ImageLoader } from '../../utils/image-loader';
import { CheckmarkSpinnerComponent } from '../checkmark-spinner/checkmark-spinner.component';

type ImageErrorType = 'unknown' | 'too-heavy' | 'too-small' | 'too-big' | 'file-read' | 'file-fetch' | 'image-create';

type ImageError = {
  id: number;
  type: ImageErrorType;
};

@Component({
  selector: 'app-puzzle-select-field',
  templateUrl: './puzzle-select-field.component.html',
  styleUrl: './puzzle-select-field.component.scss',
  imports: [CheckmarkSpinnerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleSelectFieldComponent implements OnInit {

  private readonly puzzleFileInput = viewChild.required<ElementRef<HTMLInputElement>>('puzzleFileInput');

  protected readonly puzzleImageFolder = '/img/puzzles';
  protected readonly puzzleThumbnailFolder = '/img/puzzle-thumbnails';
  protected readonly puzzles = [
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

  public readonly puzzleId = model.required<string | null>();
  public readonly puzzleImage = model.required<ImageBitmap | null>();
  public readonly puzzleImageLoading = model.required<boolean>();

  protected readonly puzzleIdLoading = signal<string | null>(null);
  protected readonly imageErrors = signal<ImageError[]>([]);

  protected readonly maxFileSize = 15; // In Megabytes
  protected readonly minPuzzleImageWidth = 450; // In pixels
  protected readonly minPuzzleImageHeight = 450; // In pixels
  protected readonly maxPuzzleImageWidth = 4096; // In pixels
  protected readonly maxPuzzleImageHeight = 4096; // In pixels

  private readonly imageErrorDelay = 5000; // In milliseconds
  private imageLoading?: AbortablePromise<ImageBitmap>;

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

    if (!this.puzzleImage()) {
      this.setPuzzle(this.puzzles[0]).catch((error: unknown) => {
        console.error(error);
      });
    }
  }

  protected async setPuzzle(puzzleId: string): Promise<void> {
    await this.updatePuzzleImage(puzzleId, ImageLoader.loadFromUrl(`${this.puzzleImageFolder}/${puzzleId}`));
  }

  protected async setCustomPuzzle(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) {
      return;
    }

    if (file.size > (this.maxFileSize * 1024 * 1024)) {
      this.displayImageError('too-heavy');
      return;
    }

    const puzzleId = crypto.randomUUID();
    await this.updatePuzzleImage(puzzleId, ImageLoader.loadFromFile(file));
  }

  private async updatePuzzleImage(puzzleId: string, imageLoading: AbortablePromise<ImageBitmap>): Promise<void> {
    if (this.imageLoading) {
      await this.imageLoading.abort();
    }

    this.puzzleImageLoading.set(true);
    this.puzzleIdLoading.set(puzzleId);

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
      this.puzzleId.set(puzzleId);
    }
    catch (error) {
      if (error instanceof Error && error.name !== 'AbortError') {
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
    finally {
      this.puzzleImageLoading.set(false);
      this.puzzleIdLoading.set(null);
    }
  }

  protected clearImageError(id: number): void {
    window.clearTimeout(id);
    this.removeImageError(id);
  }

  private clearAllImageErrors(): void {
    this.imageErrors().forEach(({ id }) => {
      window.clearTimeout(id);
    });
    this.imageErrors.set([]);
  }

  private removeImageError(id: number): void {
    this.imageErrors.update((imageErrors) => {
      return [...imageErrors.filter((error) => error.id !== id)];
    });
  }

  private displayImageError(type: ImageErrorType): void {
    this.clearAllImageErrors();

    const id = window.setTimeout(() => {
      this.removeImageError(id);
    }, this.imageErrorDelay);

    this.imageErrors.update((imageErrors) => {
      return [...imageErrors, { id, type }];
    });
  }

}
