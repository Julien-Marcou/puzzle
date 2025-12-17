import type { Point } from './geometry';
import type { PuzzleGameParameters } from './puzzle-game-parameters';
import type { PointerId, Pointer, PinchToZoomInitialState, ViewportDragInitialState, PieceGroupDragInitialState, GroupSnapping, PuzzleEventListeners } from './puzzle-manipulation';
import type { PuzzleSpritesheet } from './puzzle-spritesheet';
import type { PuzzleSpritesheetParameters } from './puzzle-spritesheet-parameters';

import { isDevMode } from '@angular/core';
import { AbstractRenderer, Application, Container, Graphics, ImageSource, Text } from 'pixi.js';
import { Subject } from 'rxjs';

import { PieceShape } from './piece-shape';
import { ViewportState, ManipulationType } from './puzzle-manipulation';
import { environment } from '../../environments/environment';
import { FpsGraph } from '../display-objects/fps-graph';
import { PieceGroup } from '../display-objects/piece-group';
import { PieceSprite } from '../display-objects/piece-sprite';

export class PuzzleGame {

  private readonly gameBackgroundColor = 0x262524;
  private readonly puzzleBackgroundColor = 0x1a1918;
  private readonly gamePadding = 40;
  private readonly gameBorderThickness = 3;
  private readonly minimumPieceSnappingMargin = 18;

  private readonly puzzleWidth: number;
  private readonly puzzleHeight: number;
  private readonly playableAreaWidth: number;
  private readonly playableAreaHeight: number;
  private readonly puzzleOrigin: Point;
  private readonly pieceMargin: number;
  private readonly pieceSpriteSize: number;
  private readonly pieceSnappingMargin: number;
  private readonly pieces: PieceSprite[][] = [];

  private readonly canvas: HTMLCanvasElement;
  private readonly application: Application;
  private readonly border: Graphics;
  private readonly viewportContainer: Container;
  private readonly pieceContainer: Container<PieceGroup>;
  private readonly resizeObserver: ResizeObserver;
  private readonly canvasOrigin: Point;

  private readonly capturedPointers = new Map<PointerId, Pointer>();
  private viewportState = ViewportState.Idle;
  private viewportManipulation?: ManipulationType;
  private canInteract = false;
  private initialPinch?: PinchToZoomInitialState;
  private initalViewportDrag?: ViewportDragInitialState;
  private hoveredPieceGroup?: PieceGroup;
  private initialPieceGroupDrag?: PieceGroupDragInitialState;

  private playTime = 0;
  private startDate?: Date;

  private readonly onFinish = new Subject<{ playTime: number }>();
  public readonly onFinish$ = this.onFinish.asObservable();

  private readonly eventListeners: PuzzleEventListeners = {
    beforeunload: (event) => {
      this.preventLosingProgress(event);
    },
    visibilitychange: () => {
      this.computePlayTime();
    },
    pointerdown: (event) => {
      this.startPointerDrag(event);
    },
    pointerup: (event) => {
      this.stopPointerDrag(event);
    },
    pointercancel: (event) => {
      this.stopPointerDrag(event);
    },
    pointermove: (event) => {
      this.computePointerMove(event);
    },
    pointerleave: () => {
      this.releasePieceHover();
    },
    wheel: (event) => {
      this.computeWheelZoom(event);
    },
    contextmenu: (event) => {
      event.preventDefault();
    },
  };

  constructor(
    private readonly wrapper: HTMLElement,
    private readonly parameters: PuzzleGameParameters,
  ) {
    this.puzzleWidth = this.parameters.pieceSize * this.parameters.horizontalPieceCount;
    this.puzzleHeight = this.parameters.pieceSize * this.parameters.verticalPieceCount;
    this.pieceMargin = Math.ceil(PieceShape.MarginFactor * this.parameters.pieceSize) + PieceShape.Parameters.strokeThickness;
    this.pieceSpriteSize = this.parameters.pieceSize + this.pieceMargin * 2;

    const playableAreaPadding = Math.max(this.puzzleWidth * 2, this.puzzleHeight * 2);
    this.playableAreaWidth = this.puzzleWidth + playableAreaPadding;
    this.playableAreaHeight = this.puzzleHeight + playableAreaPadding;
    this.puzzleOrigin = {
      x: Math.round((this.playableAreaWidth - this.puzzleWidth) / 2),
      y: Math.round((this.playableAreaHeight - this.puzzleHeight) / 2),
    };
    this.pieceSnappingMargin = Math.max(this.minimumPieceSnappingMargin, Math.ceil(this.parameters.pieceSize / 3.5));

    this.canvas = document.createElement('canvas');
    this.canvas.classList.add('pixijs-canvas');
    this.wrapper.appendChild(this.canvas);
    this.canvasOrigin = {
      x: this.canvas.offsetLeft,
      y: this.canvas.offsetTop,
    };

    this.pieceContainer = new Container();
    this.pieceContainer.interactive = false;
    this.pieceContainer.interactiveChildren = false;
    this.pieceContainer.x = this.puzzleOrigin.x;
    this.pieceContainer.y = this.puzzleOrigin.y;

    const puzzleArea = new Graphics();
    puzzleArea.x = this.puzzleOrigin.x;
    puzzleArea.y = this.puzzleOrigin.y;
    puzzleArea.rect(0, 0, this.puzzleWidth, this.puzzleHeight).fill(this.puzzleBackgroundColor);
    puzzleArea.interactive = false;

    this.border = new Graphics();
    this.border.interactive = false;

    this.viewportContainer = new Container();
    this.viewportContainer.addChild(this.border);
    this.viewportContainer.addChild(puzzleArea);
    this.viewportContainer.addChild(this.pieceContainer);
    this.viewportContainer.visible = false;
    this.viewportContainer.interactive = false;

    this.application = new Application();
    this.application.stage.addChild(this.viewportContainer);

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
  }

  public async start(): Promise<void> {
    try {
      await this.application.init({
        canvas: this.canvas,
        width: this.wrapper.clientWidth,
        height: this.wrapper.clientHeight,
        backgroundColor: this.gameBackgroundColor,
        autoStart: false,
        resolution: AbstractRenderer.defaultOptions.resolution,
        autoDensity: true,
        manageImports: false,
      });

      // Render first frame with loading text
      if (environment.showFpsGraph) {
        this.displayFpsGraph();
      }
      const loadingText = this.displayLoadingMessage();
      await this.renderFrame();

      // Waiting for piece sprites to be ready
      const spritesheet = await this.buildSpritesheet();
      await this.addPieces(spritesheet);

      // Switch from loading text to puzzle view
      this.viewportContainer.visible = true;
      this.application.stage.removeChild(loadingText);
      await this.renderFrame();

      // Start events & render loop
      this.resizeObserver.observe(this.wrapper);
      this.startGameEventListeners();
      this.application.start();
      this.startPlayTime();
    }
    catch (error) {
      console.error(error);
    }
  }

  public stop(): void {
    try {
      this.resizeObserver.disconnect();
      this.stopGameEventListeners();
      this.application.stop();
      this.application.destroy(true, true);
      this.onFinish.complete();
    }
    catch (error) {
      console.error(error);
    }
  }

  private async renderFrame(): Promise<void> {
    this.application.render();
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => {
        resolve();
      });
    });
  }

  private displayFpsGraph(): void {
    const fpsGraph = new FpsGraph(this.application.ticker);
    fpsGraph.x = 10;
    fpsGraph.y = 10;
    this.application.stage.addChild(fpsGraph);
  }

  private displayLoadingMessage(): Text {
    const loadingText = new Text({
      text: 'Chargement...',
      style: {
        fill: 0xffffff,
        stroke: {
          color: 0x000000,
          width: 4,
          join: 'bevel',
        },
        fontSize: 42,
        fontFamily: 'sans-serif',
      },
    });
    loadingText.x = Math.round((this.canvas.clientWidth - loadingText.width) / 2);
    loadingText.y = Math.round((this.canvas.clientHeight - loadingText.height) / 2);
    this.application.stage.addChild(loadingText);
    return loadingText;
  }

  private async buildSpritesheet(): Promise<PuzzleSpritesheet> {
    // Cloning original image, so that we can transfer it to the worker, and still be able to use it on the frontend
    const clonedImage = await createImageBitmap(this.parameters.puzzleImage);

    const { promise, resolve, reject } = Promise.withResolvers<PuzzleSpritesheet>();
    const worker = new Worker(new URL('../utils/puzzle-spritesheet-worker', import.meta.url));
    worker.postMessage(
      {
        ...this.parameters,
        pieceMargin: this.pieceMargin,
        pieceSpriteSize: this.pieceSpriteSize,
      } satisfies PuzzleSpritesheetParameters,
      {
        transfer: [clonedImage],
      },
    );
    worker.onmessage = ({ data }: MessageEvent<PuzzleSpritesheet | null>): void => {
      if (data) {
        resolve(data);
      }
      else {
        reject(new Error('Spritesheet build error'));
      }
    };

    return await promise;
  }

  private async addPieces(spritesheet: PuzzleSpritesheet): Promise<void> {
    const puzzleTexture = new ImageSource({
      resource: spritesheet.image,
      autoGenerateMipmaps: true,
      resolution: 1,
      minFilter: 'linear',
      magFilter: 'linear',
      mipmapFilter: 'linear',
      sampleCount: 8,
      antialias: true,
    });
    await this.application.renderer.prepare.upload(puzzleTexture);

    for (let x = 0; x < this.parameters.horizontalPieceCount; x++) {
      const pieceColumn = [];
      for (let y = 0; y < this.parameters.verticalPieceCount; y++) {
        const pieceSprite = new PieceSprite(
          { x, y },
          this.pieceSpriteSize,
          puzzleTexture,
          spritesheet.alphaData,
        );
        const pieceGroup = new PieceGroup();
        pieceGroup.addChild(pieceSprite);
        pieceColumn.push(pieceSprite);
        this.pieceContainer.addChild(pieceGroup);
      }
      this.pieces.push(pieceColumn);
    }
    this.shufflePieces();
  }

  private shufflePieces(): void {
    const remainingPieces = [...this.pieceContainer.children];
    const horizontalSpriteCount = Math.floor(this.puzzleWidth / this.pieceSpriteSize);
    const verticalSpriteCount = Math.floor(this.puzzleHeight / this.pieceSpriteSize);
    const cellWidth = this.puzzleWidth / horizontalSpriteCount;
    const cellHeight = this.puzzleHeight / verticalSpriteCount;
    let horizontalCellCount = horizontalSpriteCount + 2;
    let verticalCellCount = verticalSpriteCount;
    let outlineIndex = 1;
    let outlineCellIndex = 0;
    while (remainingPieces.length > 0) {
      // Compute current outline settings
      const outlineOrigin = {
        x: -outlineIndex * cellWidth,
        y: -outlineIndex * cellHeight,
      };
      const leftSideLastIndex = verticalCellCount - 1;
      const rightSideLastIndex = leftSideLastIndex + verticalCellCount;
      const topSideLastIndex = rightSideLastIndex + horizontalCellCount;

      // Compute the cell coordinates from its index on the outline, and following that order:
      // - left side, top to bottom
      // - right side, top to bottom
      // - top side, left to right
      // - bottom side, left to right
      let cellCoordinate: Point;

      // Left side
      if (outlineCellIndex <= leftSideLastIndex) {
        cellCoordinate = {
          x: 0,
          y: outlineCellIndex + 1,
        };
      }
      // Right side
      else if (outlineCellIndex <= rightSideLastIndex) {
        cellCoordinate = {
          x: horizontalCellCount - 1,
          y: outlineCellIndex - leftSideLastIndex,
        };
      }
      // Top side
      else if (outlineCellIndex <= topSideLastIndex) {
        cellCoordinate = {
          x: outlineCellIndex - rightSideLastIndex - 1,
          y: 0,
        };
      }
      // Bottom side
      else {
        cellCoordinate = {
          x: outlineCellIndex - topSideLastIndex - 1,
          y: verticalCellCount + 1,
        };
      }

      // Move a random piece to the current outline cell position
      const pieceIndex = Math.floor(Math.random() * remainingPieces.length);
      const piece = remainingPieces.splice(pieceIndex, 1)[0];
      piece.x = Math.round(cellCoordinate.x * cellWidth + outlineOrigin.x + (cellWidth - piece.width) / 2);
      piece.y = Math.round(cellCoordinate.y * cellHeight + outlineOrigin.y + (cellHeight - piece.height) / 2);

      // Move to the next cell and wrap to the next outline if needed
      outlineCellIndex++;
      const outlineCellCount = (horizontalCellCount + verticalCellCount) * 2;
      if (outlineCellIndex === outlineCellCount) {
        outlineCellIndex = 0;
        outlineIndex++;
        horizontalCellCount += 2;
        verticalCellCount += 2;
      }
    }
  }

  private movePieceToTop(pieceToMove: PieceGroup): void {
    this.pieceContainer.removeChild(pieceToMove);
    this.pieceContainer.addChild(pieceToMove);
  }

  private movePieceToBottom(pieceToMove: PieceGroup): void {
    this.pieceContainer.removeChild(pieceToMove);
    this.pieceContainer.addChildAt(pieceToMove, 0);
  }

  private resize(): void {
    this.application.renderer.resize(
      this.wrapper.clientWidth,
      this.wrapper.clientHeight,
    );
    this.fit();
  }

  private fit(): void {
    const canvasWidth = this.canvas.clientWidth;
    const canvasHeight = this.canvas.clientHeight;
    const worldWidth = (this.playableAreaWidth + this.gamePadding * 2);
    const worldHeight = (this.playableAreaHeight + this.gamePadding * 2);
    const scaleX = canvasWidth / worldWidth * 0.9;
    const scaleY = canvasHeight / worldHeight * 0.9;
    const scale = Math.min(scaleX, scaleY);
    this.updateViewportScale(scale);
    const offsetX = Math.round((canvasWidth - worldWidth * scale) / 2);
    const offsetY = Math.round((canvasHeight - worldHeight * scale) / 2);
    this.viewportContainer.x = offsetX;
    this.viewportContainer.y = offsetY;
  }

  private updateBorder(scale: number): void {
    const borderThickness = this.gameBorderThickness / scale;
    this.border.clear();
    this.border.rect(0, 0, this.playableAreaWidth, this.playableAreaHeight).stroke({
      width: borderThickness,
      color: this.puzzleBackgroundColor,
      alignment: 0,
    });
  }

  private updateViewportScale(targetScale: number): void {
    this.viewportContainer.scale.set(targetScale);
    this.updateBorder(targetScale);
  }

  private startGameEventListeners(): void {
    window.addEventListener('beforeunload', this.eventListeners.beforeunload);
    document.addEventListener('visibilitychange', this.eventListeners.visibilitychange, { passive: true });
    this.canvas.addEventListener('pointerdown', this.eventListeners.pointerdown, { passive: true });
    this.canvas.addEventListener('pointerup', this.eventListeners.pointerup, { passive: true });
    this.canvas.addEventListener('pointercancel', this.eventListeners.pointercancel, { passive: true });
    this.canvas.addEventListener('pointermove', this.eventListeners.pointermove, { passive: true });
    this.canvas.addEventListener('pointerleave', this.eventListeners.pointerleave, { passive: true });
    this.canvas.addEventListener('wheel', this.eventListeners.wheel);
    this.canvas.addEventListener('contextmenu', this.eventListeners.contextmenu);
  }

  private stopGameEventListeners(): void {
    window.removeEventListener('beforeunload', this.eventListeners.beforeunload);
    document.removeEventListener('visibilitychange', this.eventListeners.visibilitychange);
    this.canvas.removeEventListener('pointerdown', this.eventListeners.pointerdown);
    this.canvas.removeEventListener('pointerup', this.eventListeners.pointerup);
    this.canvas.removeEventListener('pointercancel', this.eventListeners.pointercancel);
    this.canvas.removeEventListener('pointermove', this.eventListeners.pointermove);
    this.canvas.removeEventListener('pointerleave', this.eventListeners.pointerleave);
    this.canvas.removeEventListener('wheel', this.eventListeners.wheel);
    this.canvas.removeEventListener('contextmenu', this.eventListeners.contextmenu);
  }

  private preventLosingProgress(event: Event): string | false {
    if (isDevMode()) {
      return false;
    }
    event.preventDefault();
    return 'Êtes-vous sûr de vouloir quitter la partie ?';
  }

  private startPlayTime(): void {
    if (document.hidden) {
      return;
    }
    this.startDate = new Date();
  }

  private computePlayTime(): void {
    const now = new Date();
    // Pause
    if (document.hidden) {
      if (this.startDate) {
        this.playTime += now.getTime() - this.startDate.getTime();
        this.startDate = undefined;
      }
    }
    // Play
    else {
      this.startDate = now;
    }
  }

  private stopPlayTime(): void {
    if (!this.startDate) {
      return;
    }
    const now = new Date();
    this.playTime += now.getTime() - this.startDate.getTime();
    this.startDate = undefined;
  }

  private isPointerCaptured(event: PointerEvent): boolean {
    return this.capturedPointers.has(event.pointerId);
  }

  private isLeftOrMiddleClick(event: PointerEvent): boolean {
    return event.button === 0 || event.button === 1;
  }

  private capturePointerEvent(event: PointerEvent): void {
    this.canvas.setPointerCapture(event.pointerId);
    const pointerPosition = this.getCanvasPosition(event);
    this.capturedPointers.set(event.pointerId, {
      id: event.pointerId,
      origin: pointerPosition,
      position: pointerPosition,
      timestamp: performance.now(),
    });
  }

  private releasePointerEvent(event: PointerEvent): void {
    const pointer = this.capturedPointers.get(event.pointerId);
    if (!pointer) {
      return;
    }
    this.canvas.releasePointerCapture(event.pointerId);
    this.capturedPointers.delete(event.pointerId);
  };

  private startPointerDrag(event: PointerEvent): void {
    if (!this.isLeftOrMiddleClick(event)) {
      return;
    }
    this.capturePointerEvent(event);
    if (this.viewportState === ViewportState.Idle) {
      this.computePieceHovering(event);
    }
    this.computeViewportState();
    if (this.viewportState === ViewportState.Interaction) {
      this.startPieceDragging();
    }
    else if (this.viewportState === ViewportState.Manipulation) {
      if (this.viewportManipulation === ManipulationType.Pan) {
        this.startViewportDragging();
      }
      else if (this.viewportManipulation === ManipulationType.Pinch) {
        this.startViewportPinching();
      }
    }
  }

  private stopPointerDrag(event: PointerEvent): void {
    if (!this.isPointerCaptured(event)) {
      return;
    }
    this.releasePointerEvent(event);
    if (this.viewportState === ViewportState.Interaction) {
      this.stopPieceDragging();
    }
    else if (this.viewportState === ViewportState.Manipulation) {
      if (this.viewportManipulation === ManipulationType.Pan) {
        this.stopViewportDragging();
      }
      else if (this.viewportManipulation === ManipulationType.Pinch) {
        this.stopViewportPinching();
      }
    }
    this.computeViewportState();
    if (this.viewportState === ViewportState.Idle) {
      this.computePieceHovering(event);
    }
    else if (this.viewportState === ViewportState.Manipulation) {
      // The pointerup event may trigger when going from 2 to 1 active pointer,
      // in this case, we immediatly move from a "pinching" to a "panning" manipulation
      if (this.viewportManipulation === ManipulationType.Pan) {
        this.startViewportDragging();
      }
      // It may also trigger when going from 3 to 2 active pointers,
      // in this case, we immediatly create a new "pinching" manipulation
      else if (this.viewportManipulation === ManipulationType.Pinch) {
        this.startViewportPinching();
      }
    }
  }

  private computePointerMove(event: PointerEvent): void {
    this.setPointerPositionFromEvent(event);
    if (this.viewportState === ViewportState.Idle) {
      this.computePieceHovering(event);
    }
    else if (this.viewportState === ViewportState.Interaction) {
      this.computePieceDragging();
    }
    else {
      if (this.viewportManipulation === ManipulationType.Pan) {
        this.computeViewportDragging();
      }
      else if (this.viewportManipulation === ManipulationType.Pinch) {
        this.computePinchToZoom();
      }
    }
  }

  private computeWheelZoom(event: WheelEvent): void {
    event.preventDefault();
    if (this.viewportState === ViewportState.Manipulation) {
      return;
    }
    const scaleStep = 0.1;
    const zoomDirection = -Math.sign(event.deltaY);
    const currentScale = this.viewportContainer.scale.x;
    const scaleFactor = this.getClampedScaleFactor(currentScale, 1 + zoomDirection * scaleStep);
    this.updateViewportScale(currentScale * scaleFactor);
    const mousePositionInCanvas = this.getCanvasPosition(event);
    const currentMousePositionInContainer = {
      x: mousePositionInCanvas.x - this.viewportContainer.x,
      y: mousePositionInCanvas.y - this.viewportContainer.y,
    };
    const scaledMousePositionInContainer = {
      x: currentMousePositionInContainer.x * scaleFactor,
      y: currentMousePositionInContainer.y * scaleFactor,
    };
    const offsetVector = {
      x: scaledMousePositionInContainer.x - currentMousePositionInContainer.x,
      y: scaledMousePositionInContainer.y - currentMousePositionInContainer.y,
    };
    this.viewportContainer.x -= offsetVector.x;
    this.viewportContainer.y -= offsetVector.y;
  }

  private setPointerPositionFromEvent(event: PointerEvent): void {
    const pointer = this.capturedPointers.get(event.pointerId);
    if (!pointer) {
      return;
    }
    pointer.position = this.getCanvasPosition(event);
  }

  private computeViewportState(): void {
    const previousState = this.viewportState;
    const previousManipulation = this.viewportManipulation;
    if (this.capturedPointers.size === 0) {
      this.viewportState = ViewportState.Idle;
      this.viewportManipulation = undefined;
    }
    else if (this.capturedPointers.size === 1) {
      if (this.viewportState === ViewportState.Idle && this.hoveredPieceGroup) {
        this.viewportState = ViewportState.Interaction;
        this.viewportManipulation = undefined;
      }
      else if (this.viewportState !== ViewportState.Interaction) {
        this.viewportState = ViewportState.Manipulation;
        this.viewportManipulation = ManipulationType.Pan;
      }
    }
    else if (this.capturedPointers.size > 1) {
      this.viewportState = ViewportState.Manipulation;
      this.viewportManipulation = ManipulationType.Pinch;
    }
    if (previousState !== this.viewportState) {
      this.canvas.setAttribute('data-viewport-state', this.viewportState);
    }
    if (previousManipulation !== this.viewportManipulation) {
      this.canvas.setAttribute('data-viewport-manipulation', this.viewportManipulation ?? '');
    }
  }

  private computePieceHovering(event: PointerEvent): void {
    const previousCanInteract = this.canInteract;
    const canvasPosition = this.getCanvasPosition(event);
    const mousePositionInPieceContainer = this.getPieceContainerPosition(canvasPosition);
    const pieceGroup = this.getPieceGroupAt(mousePositionInPieceContainer);
    if (this.hoveredPieceGroup && this.hoveredPieceGroup !== pieceGroup) {
      this.hoveredPieceGroup.removeOutline();
    }
    if (!pieceGroup) {
      this.hoveredPieceGroup = undefined;
    }
    else if (this.hoveredPieceGroup !== pieceGroup) {
      this.hoveredPieceGroup = pieceGroup;
      this.hoveredPieceGroup.addOutline();
    }
    this.canInteract = !!this.hoveredPieceGroup;
    if (previousCanInteract !== this.canInteract) {
      this.canvas.setAttribute('data-can-interact', this.canInteract ? 'true' : 'false');
    }
  }

  private releasePieceHover(): void {
    if (!this.hoveredPieceGroup) {
      return;
    }
    this.hoveredPieceGroup.removeOutline();
    this.hoveredPieceGroup = undefined;
  }

  private startPieceDragging(): void {
    if (!this.hoveredPieceGroup) {
      return;
    }
    const [capturedPointer] = this.capturedPointers.values();
    const piece = this.hoveredPieceGroup;
    this.releasePieceHover();
    const mousePositionInPieceContainer = this.getPieceContainerPosition(capturedPointer.position);
    this.initialPieceGroupDrag = {
      pieceGroup: piece,
      dragOrigin: {
        x: mousePositionInPieceContainer.x,
        y: mousePositionInPieceContainer.y,
      },
      pieceOrigin: {
        x: piece.x,
        y: piece.y,
      },
    };
    this.movePieceToTop(piece);
  }

  private computePieceDragging(): void {
    if (!this.initialPieceGroupDrag) {
      return;
    }
    const [capturedPointer] = this.capturedPointers.values();
    const mousePositionInPieceContainer = this.getPieceContainerPosition(capturedPointer.position);
    const dragVector = {
      x: mousePositionInPieceContainer.x - this.initialPieceGroupDrag.dragOrigin.x,
      y: mousePositionInPieceContainer.y - this.initialPieceGroupDrag.dragOrigin.y,
    };
    const x = Math.round(this.initialPieceGroupDrag.pieceOrigin.x + dragVector.x);
    const y = Math.round(this.initialPieceGroupDrag.pieceOrigin.y + dragVector.y);
    const minX = -this.pieceContainer.x - this.pieceMargin;
    const minY = -this.pieceContainer.y - this.pieceMargin;
    const maxX = this.playableAreaWidth - this.pieceContainer.x - this.initialPieceGroupDrag.pieceGroup.width + this.pieceMargin;
    const maxY = this.playableAreaHeight - this.pieceContainer.y - this.initialPieceGroupDrag.pieceGroup.height + this.pieceMargin;
    this.initialPieceGroupDrag.pieceGroup.x = Math.min(Math.max(x, minX), maxX);
    this.initialPieceGroupDrag.pieceGroup.y = Math.min(Math.max(y, minY), maxY);
  }

  private stopPieceDragging(): void {
    if (!this.initialPieceGroupDrag) {
      return;
    }
    const pieceGroup = this.initialPieceGroupDrag.pieceGroup;
    this.initialPieceGroupDrag = undefined;

    const lockPosition = this.getPieceGroupLockPosition(pieceGroup);
    if (lockPosition) {
      pieceGroup.x = lockPosition.x;
      pieceGroup.y = lockPosition.y;
      pieceGroup.lock();
      this.movePieceToBottom(pieceGroup);
      this.checkIfPuzzleIsFinished();
      return;
    }

    const snapping = this.getPieceGroupSnapping(pieceGroup);
    if (snapping) {
      pieceGroup.x = snapping.snapPosition.x;
      pieceGroup.y = snapping.snapPosition.y;
      pieceGroup.mergeWith(snapping.pieceGroup);
      this.pieceContainer.removeChild(pieceGroup);
      return;
    }
  }

  private startViewportDragging(): void {
    const [capturedPointer] = this.capturedPointers.values();
    this.initalViewportDrag = {
      dragOrigin: {
        x: capturedPointer.position.x,
        y: capturedPointer.position.y,
      },
      viewportOrigin: {
        x: this.viewportContainer.x,
        y: this.viewportContainer.y,
      },
    };
  }

  private computeViewportDragging(): void {
    if (!this.initalViewportDrag) {
      return;
    }
    const [capturedPointer] = this.capturedPointers.values();
    const dragVector = {
      x: capturedPointer.position.x - this.initalViewportDrag.dragOrigin.x,
      y: capturedPointer.position.y - this.initalViewportDrag.dragOrigin.y,
    };
    this.viewportContainer.x = Math.round(this.initalViewportDrag.viewportOrigin.x + dragVector.x);
    this.viewportContainer.y = Math.round(this.initalViewportDrag.viewportOrigin.y + dragVector.y);
  }

  private stopViewportDragging(): void {
    if (!this.initalViewportDrag) {
      return;
    }
    this.initalViewportDrag = undefined;
  }

  private startViewportPinching(): void {
    const pointerCount = this.capturedPointers.size;
    const pinchOrigin = this.getPointersCenter();
    const initialMeanDistance = this.getPointersMeanDistanceTo(pinchOrigin);

    this.initialPinch = {
      pinchOrigin,
      meanDistance: initialMeanDistance,
      viewportScale: this.viewportContainer.scale.x,
      viewportOrigin: {
        x: this.viewportContainer.x,
        y: this.viewportContainer.y,
      },
      pointerCount,
    };
  }

  private computePinchToZoom(): void {
    if (!this.initialPinch) {
      return;
    }

    const currentPinchCenter = this.getPointersCenter();
    const currentMeanDistance = this.getPointersMeanDistanceTo(currentPinchCenter);

    // Update scale
    const initialScale = this.initialPinch.viewportScale;
    const scaleFactor = this.getClampedScaleFactor(initialScale, currentMeanDistance / this.initialPinch.meanDistance);
    this.updateViewportScale(initialScale * scaleFactor);

    // Update panning
    const dragOffset = {
      x: currentPinchCenter.x - this.initialPinch.pinchOrigin.x,
      y: currentPinchCenter.y - this.initialPinch.pinchOrigin.y,
    };
    const newViewportPosition = {
      x: this.initialPinch.viewportOrigin.x + dragOffset.x,
      y: this.initialPinch.viewportOrigin.y + dragOffset.y,
    };
    const pinchCenter = {
      x: currentPinchCenter.x - newViewportPosition.x,
      y: currentPinchCenter.y - newViewportPosition.y,
    };
    const scaledPinchCenter = {
      x: pinchCenter.x * scaleFactor,
      y: pinchCenter.y * scaleFactor,
    };
    const scaleOffset = {
      x: scaledPinchCenter.x - pinchCenter.x,
      y: scaledPinchCenter.y - pinchCenter.y,
    };
    this.viewportContainer.x = Math.round(newViewportPosition.x - scaleOffset.x);
    this.viewportContainer.y = Math.round(newViewportPosition.y - scaleOffset.y);
  }

  private stopViewportPinching(): void {
    if (!this.initialPinch) {
      return;
    }
    this.initialPinch = undefined;
  }

  private getClampedScale(targetScale: number): number {
    const minScale = 0.04;
    const maxScale = 1;
    return Math.min(Math.max(targetScale, minScale), maxScale);
  }

  private getClampedScaleFactor(currentScale: number, scaleFactor: number): number {
    const targetScale = this.getClampedScale(currentScale * scaleFactor);
    return targetScale / currentScale;
  }

  private getPointersCenter(): Point {
    const pointerCount = this.capturedPointers.size;
    const center = { x: 0, y: 0 };
    this.capturedPointers.forEach((capturedPointer) => {
      center.x += capturedPointer.position.x;
      center.y += capturedPointer.position.y;
    });
    center.x /= pointerCount;
    center.y /= pointerCount;
    return center;
  }

  private getPointersMeanDistanceTo(point: Point): number {
    const pointerCount = this.capturedPointers.size;
    let meanDistance = 0;
    this.capturedPointers.forEach((capturedPointer) => {
      meanDistance += Math.hypot(
        capturedPointer.position.x - point.x,
        capturedPointer.position.y - point.y,
      );
    });
    meanDistance /= pointerCount;
    return meanDistance;
  }

  private getCanvasPosition(event: MouseEvent): Point {
    return {
      x: event.pageX - this.canvasOrigin.x,
      y: event.pageY - this.canvasOrigin.y,
    };
  }

  private getPieceContainerPosition(point: Point): Point {
    const result = { x: 0, y: 0 };
    this.pieceContainer.toLocal(point, this.application.stage, result);
    return result;
  }

  private getPieceGroupAt(point: Point): PieceGroup | undefined {
    for (let i = this.pieceContainer.children.length - 1; i >= 0; i--) {
      const pieceGroup = this.pieceContainer.children[i];
      if (pieceGroup.hitBy(point)) {
        return pieceGroup;
      }
    }
    return undefined;
  }

  private getPieceGroupLockPosition(pieceGroup: PieceGroup): Point | undefined {
    const piece = pieceGroup.children[0];
    const validX = (piece.cell.x * this.parameters.pieceSize) - this.pieceMargin;
    const validY = (piece.cell.y * this.parameters.pieceSize) - this.pieceMargin;
    if (Math.abs(pieceGroup.x - validX) < this.pieceSnappingMargin && Math.abs(pieceGroup.y - validY) < this.pieceSnappingMargin) {
      return { x: validX, y: validY };
    }
    return undefined;
  }

  private getPieceGroupSnapping(pieceGroup: PieceGroup): GroupSnapping | undefined {
    const pieces = pieceGroup.children;
    const neighborOffsets = [
      { x: -1, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: -1 },
      { x: 0, y: 1 },
    ];
    for (const piece of pieces) {
      for (const neighborOffset of neighborOffsets) {
        const neighborPiece = this.pieces.at(piece.cell.x + neighborOffset.x)?.at(piece.cell.y + neighborOffset.y);
        if (neighborPiece && neighborPiece.parent !== pieceGroup) {
          const validX = neighborPiece.parent.x + neighborPiece.x - (this.parameters.pieceSize * neighborOffset.x) - piece.x;
          const validY = neighborPiece.parent.y + neighborPiece.y - (this.parameters.pieceSize * neighborOffset.y) - piece.y;
          if (Math.abs(pieceGroup.x - validX) < this.pieceSnappingMargin && Math.abs(pieceGroup.y - validY) < this.pieceSnappingMargin) {
            return {
              pieceGroup: neighborPiece.parent,
              snapPosition: { x: validX, y: validY },
            };
          }
        }
      }
    }
    return undefined;
  }

  private checkIfPuzzleIsFinished(): boolean {
    if (!this.pieceContainer.children.every((pieceGroup) => pieceGroup.isLocked())) {
      return false;
    }
    this.stopPlayTime();
    this.onFinish.next({ playTime: this.playTime });
    this.border.visible = false;
    return true;
  }

}
