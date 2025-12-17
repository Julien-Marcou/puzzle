import type { PuzzleGameParameters } from '../../models/puzzle-game-parameters';
import type { ElementRef, OnInit } from '@angular/core';

import { Location } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, input, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { PuzzleGame } from '../../models/puzzle-game';

@Component({
  selector: 'app-puzzle-game',
  templateUrl: './puzzle-game.component.html',
  styleUrl: './puzzle-game.component.scss',
  imports: [FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PuzzleGameComponent implements OnInit {

  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly destroyRef = inject(DestroyRef);

  private readonly puzzleGameWrapperRef = viewChild.required<ElementRef<HTMLElement>>('puzzleGameWrapper');

  private puzzleGame?: PuzzleGame;
  public readonly puzzleGameParameters = input.required<PuzzleGameParameters>();
  public readonly displayEndDialog = signal<boolean>(false);
  public readonly gamePlayTime = signal<string>('');

  public ngOnInit(): void {
    this.puzzleGame = new PuzzleGame(
      this.puzzleGameWrapperRef().nativeElement,
      this.puzzleGameParameters(),
    );

    this.puzzleGame.onFinish$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(({ playTime }) => {
      const playTimeInSeconds = playTime / 1000;
      const playTimeHours = Math.floor(playTimeInSeconds / 3600);
      const playTimeMinutes = Math.floor(playTimeInSeconds % 3600 / 60);
      const playTimeSeconds = Math.floor(playTimeInSeconds % 3600 % 60);
      this.displayEndDialog.set(true);
      this.gamePlayTime.set(`${playTimeHours}h ${playTimeMinutes}m ${playTimeSeconds}s`);
    });

    this.puzzleGame.start().catch((error: unknown) => {
      console.error(error);
    });
  }

  public async exitPuzzle(): Promise<void> {
    if (this.puzzleGame) {
      this.puzzleGame.stop();
    }
    if (this.router.navigated) {
      this.location.back();
    }
    else {
      await this.router.navigate(['/']);
    }
  }

  public closeEndDialog(): void {
    this.displayEndDialog.set(false);
  }

  public debugWebGL(): void {
    if (this.puzzleGame) {
      this.puzzleGame.debug();
    }
  }

}
