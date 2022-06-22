import { Application, Container, Graphics, Text, LINE_JOIN } from 'pixi.js';
import { environment } from '../../environments/environment';
import { FpsGraph } from './fps-graph';
import { Point } from './geometry';
import { PieceSprite } from './piece-sprite';
import { PuzzleSpritesheet } from './puzzle-spritesheet';
import type { Renderer, InteractionManager, AccessibilityManager, TilingSpriteRenderer, Extract } from 'pixi.js';

type PointerId = number;
type Pointer = {
  id: PointerId;
  origin: Point;
  position: Point;
  timestamp: number;
};
type PinchToZoomInitialState = {
  pinchOrigin: Point;
  meanDistance: number;
  viewportOrigin: Point;
  viewportScale: number;
  pointerCount: number;
};
type ViewportDragInitialState = {
  dragOrigin: Point;
  viewportOrigin: Point;
};
type PieceDragInitialState = {
  piece: PieceSprite;
  dragOrigin: Point;
  pieceOrigin: Point;
};
const enum ViewportState {
  Manipulation = 'manipulation',
  Interaction = 'interaction',
  Idle = 'idle',
}
const enum ManipulationType {
  Pan = 'pan',
  Pinch = 'pinch',
}

export class PuzzleGame {

  private readonly gameBackgroundColor = 0x262524;
  private readonly puzzleBackgroundColor = 0x1a1918;
  private readonly gamePadding = 40;
  private readonly gameBorderThickness = 3;

  private readonly puzzleWidth: number;
  private readonly puzzleHeight: number;
  private readonly playableAreaWidth: number;
  private readonly playableAreaHeight: number;
  private readonly puzzleOrigin: Point;
  private readonly pieceSnappingMargin: number;
  private readonly pieces: Array<PieceSprite> = [];

  private readonly canvas: HTMLCanvasElement;
  private readonly application: Application;
  private readonly border: Graphics;
  private readonly viewportContainer: Container;
  private readonly pieceContainer: Container;
  private readonly resizeObserver: ResizeObserver;
  private readonly canvasOrigin: Point;

  private readonly capturedPointers: Map<PointerId, Pointer> = new Map();
  private viewportState = ViewportState.Idle;
  private viewportManipulation?: ManipulationType;
  private canInteract = false;
  private initialPinch?: PinchToZoomInitialState;
  private initalViewportDrag?: ViewportDragInitialState;
  private hoveredPiece?: PieceSprite;
  private initialPieceDrag?: PieceDragInitialState;

  constructor(
    private readonly wrapper: HTMLElement,
    private readonly spritesheet: PuzzleSpritesheet,
    private readonly pieceSize: number,
    public readonly horizontalPieceCount: number,
    public readonly verticalPieceCount: number,
  ) {
    this.puzzleWidth = this.pieceSize * this.horizontalPieceCount;
    this.puzzleHeight = this.pieceSize * this.verticalPieceCount;
    const playableAreaPadding = Math.max(this.puzzleWidth * 2, this.puzzleHeight * 2);
    this.playableAreaWidth = this.puzzleWidth + playableAreaPadding;
    this.playableAreaHeight = this.puzzleHeight + playableAreaPadding;
    this.puzzleOrigin = {
      x: Math.round((this.playableAreaWidth - this.puzzleWidth) / 2),
      y: Math.round((this.playableAreaHeight - this.puzzleHeight) / 2),
    };
    this.pieceSnappingMargin = Math.ceil(this.pieceSize / 4);
    if (this.pieceSnappingMargin < 18) {
      this.pieceSnappingMargin = 18;
    }

    this.canvas = document.createElement('canvas');
    this.canvas.classList.add('pixijs-canvas');
    this.wrapper.appendChild(this.canvas);
    this.canvasOrigin = {
      x: this.canvas.offsetLeft,
      y: this.canvas.offsetTop,
    };

    this.pieceContainer = new Container();
    this.pieceContainer.x = this.puzzleOrigin.x;
    this.pieceContainer.y = this.puzzleOrigin.y;

    const puzzleArea = new Graphics();
    puzzleArea.x = this.puzzleOrigin.x;
    puzzleArea.y = this.puzzleOrigin.y;
    puzzleArea.beginFill(this.puzzleBackgroundColor);
    puzzleArea.drawRect(0, 0, this.puzzleWidth, this.puzzleHeight);
    puzzleArea.endFill();

    this.border = new Graphics();

    this.viewportContainer = new Container();
    this.viewportContainer.addChild(this.border);
    this.viewportContainer.addChild(puzzleArea);
    this.viewportContainer.addChild(this.pieceContainer);
    this.viewportContainer.visible = false;

    this.application = new Application({
      view: this.canvas,
      width: this.wrapper.clientWidth,
      height: this.wrapper.clientHeight,
      backgroundColor: this.gameBackgroundColor,
      autoStart: false,
    });
    (this.application.renderer.plugins['accessibility'] as AccessibilityManager).destroy();
    (this.application.renderer.plugins['tilingSprite'] as TilingSpriteRenderer).destroy();
    (this.application.renderer.plugins['extract'] as Extract).destroy();
    (this.application.renderer.plugins['interaction'] as InteractionManager).destroy();
    this.application.stage.interactiveChildren = false;
    this.application.stage.addChild(this.viewportContainer);

    if (!environment.production) {
      const fpsGraph = new FpsGraph(this.application.ticker);
      fpsGraph.x = 10;
      fpsGraph.y = 10;
      this.application.stage.addChild(fpsGraph);
    }

    this.resizeObserver = new ResizeObserver(() => {
      this.resize();
    });
    try {
      this.resizeObserver.observe(this.wrapper);
      this.resize();
      this.addGameEventListeners();
      this.start();
    }
    catch (error) {
      this.debug(error);
    }
  }

  public start(): void {
    const loadingText = new Text('Chargement...', {
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 4,
      lineJoin: LINE_JOIN.BEVEL,
      fontSize: 42,
      fontFamily: 'sans-serif',
    });
    loadingText.x = Math.round((this.canvas.clientWidth - loadingText.width) / 2);
    loadingText.y = Math.round((this.canvas.clientHeight - loadingText.height) / 2);
    this.application.stage.addChild(loadingText);
    this.application.render();

    window.requestAnimationFrame(async () => {
      await this.addPieces();
      this.viewportContainer.visible = true;
      this.application.stage.removeChild(loadingText);
      this.application.start();
    });
  }

  public stop(): void {
    this.resizeObserver.disconnect();
    this.application.stop();
    this.spritesheet.destroy();
    this.application.destroy(true, {children: true, texture: true, baseTexture: true});
  }

  public debug(message?: string | unknown): void {
    this.wrapper.innerHTML =`<p>${message}<p>`;
    const renderer =(this.application.renderer as Renderer);
    const webglVersion = renderer.context.webGLVersion;
    const maxTextureSize = renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_SIZE);
    const maxViewportDims = renderer.gl.getParameter(renderer.gl.MAX_VIEWPORT_DIMS);
    const currentViewport = renderer.gl.getParameter(renderer.gl.VIEWPORT);
    const maxRenderBufferSize = renderer.gl.getParameter(renderer.gl.MAX_RENDERBUFFER_SIZE);
    const maxTextureImageUnits = renderer.gl.getParameter(renderer.gl.MAX_TEXTURE_IMAGE_UNITS);
    const maxCombinedTextureImageUnits = renderer.gl.getParameter(renderer.gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS);
    const currentRenderBufferWidth = renderer.gl.getRenderbufferParameter(renderer.gl.RENDERBUFFER, renderer.gl.RENDERBUFFER_WIDTH);
    const currentRenderBufferHeight = renderer.gl.getRenderbufferParameter(renderer.gl.RENDERBUFFER, renderer.gl.RENDERBUFFER_HEIGHT);
    this.wrapper.innerHTML =`<p style="overflow-y: auto; overflow-x: hidden; display: block; width: 100%; height: 100%; padding: 5px;">
      ${message ? `${message}<br><br>` : ''}
      WebGL ${webglVersion}<br>
      Pixel Density: ${window.devicePixelRatio}<br>
      Max texture size: ${maxTextureSize}<br>
      Max texture image units: ${maxTextureImageUnits}<br>
      Max combined texture image units: ${maxCombinedTextureImageUnits}<br>
      Max render buffer size: ${maxRenderBufferSize}<br>
      Max viewport size: ${maxViewportDims}<br>
      Current render buffer width: ${currentRenderBufferWidth}<br>
      Current render buffer height: ${currentRenderBufferHeight}<br>
      Current viewport size: ${currentViewport}<br>
    </p>`;
    try {
      this.stop();
    }
    catch {
      // Silently fail
    }
  }

  private drawBorder(scale: number): void {
    const borderThickness = this.gameBorderThickness / scale;
    this.border.clear();
    this.border.lineStyle({
      width: borderThickness,
      color: this.puzzleBackgroundColor,
      alignment: 1,
    });
    this.border.moveTo(0, 0);
    this.border.lineTo(this.playableAreaWidth, 0);
    this.border.lineTo(this.playableAreaWidth, this.playableAreaHeight);
    this.border.lineTo(0, this.playableAreaHeight);
    this.border.closePath();
  }

  private updateViewportScale(targetScale: number): void {
    // if (targetScale >= 1) {
    //   this.spritesheet.setScaleModeToNearest();
    // }
    // else {
    //   this.spritesheet.setScaleModeToLinear();
    // }
    this.viewportContainer.scale.set(targetScale);
    this.drawBorder(targetScale);
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

  private async addPieces(): Promise<void> {
    const renderingContext = (this.application.renderer as Renderer).gl;
    const maxTextureSize = renderingContext.getParameter(renderingContext.MAX_TEXTURE_SIZE);
    const pieceTextures = await this.spritesheet.parse(maxTextureSize);

    for (let x = 0; x < this.horizontalPieceCount; x++) {
      for (let y = 0; y < this.verticalPieceCount; y++) {
        const pieceSprite = new PieceSprite(
          {x: x, y: y},
          pieceTextures.textures[x][y],
          pieceTextures.alphaChannels[x][y],
        );
        this.pieces.push(pieceSprite);
        this.pieceContainer.addChild(pieceSprite);
      }
    }
    this.shufflePieces();
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
    const center = {x: 0, y: 0};
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
    const result = {x: 0, y: 0};
    this.pieceContainer.toLocal(point, this.application.stage, result);
    return result;
  }

  private addGameEventListeners():  void {
    const handlePieceHovering = (event: PointerEvent): void => {
      const previousCanInteract = this.canInteract;
      const canvasPosition = this.getCanvasPosition(event);
      const mousePositionInPieceContainer = this.getPieceContainerPosition(canvasPosition);
      const piece = this.getPieceAt(mousePositionInPieceContainer);
      if (this.hoveredPiece && this.hoveredPiece !== piece) {
        this.hoveredPiece.removeOutline();
      }
      if (!piece) {
        this.hoveredPiece = undefined;
      }
      else if (this.hoveredPiece !== piece) {
        this.hoveredPiece = piece;
        this.hoveredPiece.addOutline();
      }
      this.canInteract = !!this.hoveredPiece;
      if (previousCanInteract !== this.canInteract) {
        this.canvas.setAttribute('data-can-interact', this.canInteract ? 'true' : 'false');
      }
    };

    const releasePieceHover = (): void => {
      if (!this.hoveredPiece) {
        return;
      }
      this.hoveredPiece.removeOutline();
      this.hoveredPiece = undefined;
    };

    const startPieceDragging = (): void => {
      if (!this.hoveredPiece) {
        return;
      }
      const [capturedPointer] = this.capturedPointers.values();
      const piece = this.hoveredPiece;
      releasePieceHover();
      const mousePositionInPieceContainer = this.getPieceContainerPosition(capturedPointer.position);
      this.initialPieceDrag = {
        piece: piece,
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
    };

    const computePieceDragging = (): void => {
      if (!this.initialPieceDrag) {
        return;
      }
      const [capturedPointer] = this.capturedPointers.values();
      const mousePositionInPieceContainer = this.getPieceContainerPosition(capturedPointer.position);
      const dragVector = {
        x: mousePositionInPieceContainer.x - this.initialPieceDrag.dragOrigin.x,
        y: mousePositionInPieceContainer.y - this.initialPieceDrag.dragOrigin.y,
      };
      const x = Math.round(this.initialPieceDrag.pieceOrigin.x + dragVector.x);
      const y = Math.round(this.initialPieceDrag.pieceOrigin.y + dragVector.y);
      const minX = - this.pieceContainer.x - this.spritesheet.pieceMargin;
      const minY = - this.pieceContainer.y - this.spritesheet.pieceMargin;
      const maxX = this.playableAreaWidth - this.pieceContainer.x - this.spritesheet.pieceSpriteSize + this.spritesheet.pieceMargin;
      const maxY = this.playableAreaHeight - this.pieceContainer.y - this.spritesheet.pieceSpriteSize + this.spritesheet.pieceMargin;
      this.initialPieceDrag.piece.x = Math.min(Math.max(x, minX), maxX);
      this.initialPieceDrag.piece.y = Math.min(Math.max(y, minY), maxY);
    };

    const stopPieceDragging = (): void => {
      if (!this.initialPieceDrag) {
        return;
      }
      const piece = this.initialPieceDrag.piece;
      const validX = (piece.cell.x * this.pieceSize) - this.spritesheet.pieceMargin;
      const validY = (piece.cell.y * this.pieceSize) - this.spritesheet.pieceMargin;
      if (Math.abs(piece.x - validX) < this.pieceSnappingMargin && Math.abs(piece.y - validY) < this.pieceSnappingMargin) {
        piece.x = validX;
        piece.y = validY;
        piece.lock();
        // TODO create sub assembly when 2 pieces can be assembled together
        this.movePieceToBottom(piece);
        this.checkIfPuzzleIsFinished();
      }
      this.initialPieceDrag = undefined;
    };

    const startViewportDragging = (): void => {
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
    };

    const computeViewportDragging = (): void => {
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
    };

    const stopViewportDragging = (): void => {
      if (!this.initalViewportDrag) {
        return;
      }
      this.initalViewportDrag = undefined;
    };

    const viewportWheelZoom = (event: WheelEvent): void => {
      const scaleStep = 0.1;
      const zoomDirection = - Math.sign(event.deltaY);
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
    };

    const capturePointerEvent = (event: PointerEvent): void => {
      this.canvas.setPointerCapture(event.pointerId);
      const pointerPosition = this.getCanvasPosition(event);
      this.capturedPointers.set(event.pointerId, {
        id: event.pointerId,
        origin: pointerPosition,
        position: pointerPosition,
        timestamp: performance.now(),
      });
    };

    const releasePointerEvent = (event: PointerEvent): void => {
      const pointer = this.capturedPointers.get(event.pointerId);
      if (!pointer) {
        return;
      }
      this.canvas.releasePointerCapture(event.pointerId);
      this.capturedPointers.delete(event.pointerId);
    };

    const movePointerEvent = (event: PointerEvent): void => {
      const pointer = this.capturedPointers.get(event.pointerId);
      if (!pointer) {
        return;
      }
      pointer.position = this.getCanvasPosition(event);
    };

    const startViewportPinching = (): void => {
      const pointerCount = this.capturedPointers.size;
      const pinchOrigin = this.getPointersCenter();
      const initialMeanDistance = this.getPointersMeanDistanceTo(pinchOrigin);

      this.initialPinch = {
        pinchOrigin: pinchOrigin,
        meanDistance: initialMeanDistance,
        viewportScale: this.viewportContainer.scale.x,
        viewportOrigin: {
          x: this.viewportContainer.x,
          y: this.viewportContainer.y,
        },
        pointerCount: pointerCount,
      };
    };

    const stopViewportPinching = (): void => {
      if (!this.initialPinch) {
        return;
      }
      this.initialPinch = undefined;
    };

    const computePinchToZoom = (): void => {
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
    };

    const updateViewportState = (): void => {
      const previousState = this.viewportState;
      const previousManipulation = this.viewportManipulation;
      if (this.capturedPointers.size === 0) {
        this.viewportState = ViewportState.Idle;
        this.viewportManipulation = undefined;
      }
      else if (this.capturedPointers.size === 1) {
        if (this.viewportState === ViewportState.Idle && this.hoveredPiece) {
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
    };

    this.canvas.addEventListener('pointerdown', (event) => {
      capturePointerEvent(event);
      if (this.viewportState === ViewportState.Idle) {
        handlePieceHovering(event);
      }
      updateViewportState();
      if (this.viewportState === ViewportState.Interaction) {
        startPieceDragging();
      }
      else if (this.viewportState === ViewportState.Manipulation) {
        if (this.viewportManipulation === ManipulationType.Pan) {
          startViewportDragging();
        }
        else if (this.viewportManipulation === ManipulationType.Pinch) {
          startViewportPinching();
        }
      }
    });

    this.canvas.addEventListener('pointerup', (event) => {
      releasePointerEvent(event);
      if (this.viewportState === ViewportState.Interaction) {
        stopPieceDragging();
      }
      else if (this.viewportState === ViewportState.Manipulation) {
        if (this.viewportManipulation === ManipulationType.Pan) {
          stopViewportDragging();
        }
        else if (this.viewportManipulation === ManipulationType.Pinch) {
          stopViewportPinching();
        }
      }
      updateViewportState();
      if (this.viewportState === ViewportState.Idle) {
        handlePieceHovering(event);
      }
      else if (this.viewportState === ViewportState.Manipulation) {
        // The pointerup event may trigger when going from 2 to 1 active pointer,
        // in this case, we immediatly move from a "pinching" to a "panning" manipulation
        if (this.viewportManipulation === ManipulationType.Pan) {
          startViewportDragging();
        }
        // It may also trigger when going from 3 to 2 active pointers,
        // in this case, we immediatly create a new "pinching" manipulation
        else if (this.viewportManipulation === ManipulationType.Pinch) {
          startViewportPinching();
        }
      }
    });

    this.canvas.addEventListener('pointermove', (event) => {
      movePointerEvent(event);
      if (this.viewportState === ViewportState.Idle) {
        handlePieceHovering(event);
      }
      else if (this.viewportState === ViewportState.Interaction) {
        computePieceDragging();
      }
      else if (this.viewportState === ViewportState.Manipulation) {
        if (this.viewportManipulation === ManipulationType.Pan) {
          computeViewportDragging();
        }
        else if (this.viewportManipulation === ManipulationType.Pinch) {
          computePinchToZoom();
        }
      }
    });

    this.canvas.addEventListener('pointerleave', () => {
      releasePieceHover();
    });

    this.canvas.addEventListener('wheel', (event: WheelEvent) => {
      viewportWheelZoom(event);
    });
  }

  private getPieceAt(point: Point): PieceSprite | undefined {
    for (let i = this.pieces.length - 1; i >= 0; i--) {
      const piece = this.pieces[i];
      if (!piece.isLocked() && piece.isPointInBoundingBox(point) && !piece.isPixelTransparentAt(point)) {
        return piece;
      }
    }
    return undefined;
  }

  private checkIfPuzzleIsFinished(): void {
    if (!this.pieces.every((piece) => piece.isLocked())) {
      return;
    }
    const finishedText = new Text('GG', {
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 4,
      lineJoin: LINE_JOIN.BEVEL,
      fontSize: 60,
      fontFamily: 'sans-serif',
    });
    finishedText.x = Math.round((document.documentElement.clientWidth - finishedText.width) / 2);
    finishedText.y = Math.round((document.documentElement.clientHeight - finishedText.height) / 2);
    this.application.stage.addChild(finishedText);
  }

  private shufflePieces(): void {
    const remainingPieces = [...this.pieces];
    const horizontalSpriteCount = Math.floor(this.puzzleWidth / this.spritesheet.pieceSpriteSize);
    const verticalSpriteCount = Math.floor(this.puzzleHeight / this.spritesheet.pieceSpriteSize);
    const cellWidth = this.puzzleWidth / horizontalSpriteCount;
    const cellHeight = this.puzzleHeight / verticalSpriteCount;
    let horizontalCellCount = horizontalSpriteCount + 2;
    let verticalCellCount = verticalSpriteCount;
    let outlineIndex = 1;
    let outlineCellIndex = 0;
    while (remainingPieces.length > 0) {
      // Compute current outline settings
      const outlineOrigin = {
        x: - outlineIndex * cellWidth,
        y: - outlineIndex * cellHeight,
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

  private movePieceToTop(pieceToMove: PieceSprite): void {
    const pieceIndex = this.pieces.findIndex((piece) => piece === pieceToMove);
    this.pieces.splice(pieceIndex, 1);
    this.pieces.push(pieceToMove);
    this.pieceContainer.removeChild(pieceToMove);
    this.pieceContainer.addChild(pieceToMove);
  }

  private movePieceToBottom(pieceToMove: PieceSprite): void {
    const pieceIndex = this.pieces.findIndex((piece) => piece === pieceToMove);
    this.pieces.splice(pieceIndex, 1);
    this.pieces.push(pieceToMove);
    this.pieceContainer.removeChild(pieceToMove);
    this.pieceContainer.addChildAt(pieceToMove,0);
  }

}
