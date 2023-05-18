import { Application } from '@pixi/app';
import { settings } from '@pixi/core';
import { Container } from '@pixi/display';
import { Graphics, LINE_JOIN } from '@pixi/graphics';
import { Text } from '@pixi/text';
import { environment } from '../../environments/environment';
import { FpsGraph } from '../display-objects/fps-graph';
import { PieceGroup } from '../display-objects/piece-group';
import { PieceSprite } from '../display-objects/piece-sprite';
import type { Point } from './geometry';
import type { PuzzleSpritesheet } from './puzzle-spritesheet';
import type { Renderer } from '@pixi/core';

type GroupSnapping = {
  pieceGroup: PieceGroup;
  snapPosition: Point;
};

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
type PieceGroupDragInitialState = {
  pieceGroup: PieceGroup;
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
  private readonly pieces: Array<Array<PieceSprite>> = [];

  private readonly canvas: HTMLCanvasElement;
  private readonly application: Application;
  private readonly border: Graphics;
  private readonly viewportContainer: Container;
  private readonly pieceContainer: Container<PieceGroup>;
  private readonly resizeObserver: ResizeObserver;
  private readonly canvasOrigin: Point;

  private readonly capturedPointers: Map<PointerId, Pointer> = new Map();
  private viewportState = ViewportState.Idle;
  private viewportManipulation?: ManipulationType;
  private canInteract = false;
  private initialPinch?: PinchToZoomInitialState;
  private initalViewportDrag?: ViewportDragInitialState;
  private hoveredPieceGroup?: PieceGroup;
  private initialPieceGroupDrag?: PieceGroupDragInitialState;

  constructor(
    private readonly wrapper: HTMLElement,
    private readonly spritesheet: PuzzleSpritesheet,
    public readonly pieceSize: number,
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

    this.pieceContainer = new Container<PieceGroup>();
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
      resolution: settings.RESOLUTION,
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      autoDensity: settings.RENDER_OPTIONS!.autoDensity,
    });
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
    const renderer = (this.application.renderer as Renderer);
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
      const pieceColumn = [];
      for (let y = 0; y < this.verticalPieceCount; y++) {
        const pieceSprite = new PieceSprite(
          {x: x, y: y},
          pieceTextures.textures[x][y],
          pieceTextures.alphaChannels[x][y],
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

  private addGameEventListeners(): void {
    const handlePieceHovering = (event: PointerEvent): void => {
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
    };

    const releasePieceHover = (): void => {
      if (!this.hoveredPieceGroup) {
        return;
      }
      this.hoveredPieceGroup.removeOutline();
      this.hoveredPieceGroup = undefined;
    };

    const startPieceDragging = (): void => {
      if (!this.hoveredPieceGroup) {
        return;
      }
      const [capturedPointer] = this.capturedPointers.values();
      const piece = this.hoveredPieceGroup;
      releasePieceHover();
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
    };

    const computePieceDragging = (): void => {
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
      const minX = - this.pieceContainer.x - this.spritesheet.pieceMargin;
      const minY = - this.pieceContainer.y - this.spritesheet.pieceMargin;
      const maxX = this.playableAreaWidth - this.pieceContainer.x - this.spritesheet.pieceSpriteSize + this.spritesheet.pieceMargin;
      const maxY = this.playableAreaHeight - this.pieceContainer.y - this.spritesheet.pieceSpriteSize + this.spritesheet.pieceMargin;
      this.initialPieceGroupDrag.pieceGroup.x = Math.min(Math.max(x, minX), maxX);
      this.initialPieceGroupDrag.pieceGroup.y = Math.min(Math.max(y, minY), maxY);
    };

    const stopPieceDragging = (): void => {
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

    const isPointerCaptured = (event: PointerEvent): boolean => this.capturedPointers.has(event.pointerId);

    const isLeftOrMiddleClick = (event: PointerEvent): boolean => event.button === 0 || event.button === 1;

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
    };

    this.canvas.addEventListener('pointerdown', (event) => {
      if (!isLeftOrMiddleClick(event)) {
        return;
      }
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
      if (!isPointerCaptured(event)) {
        return;
      }
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
      if (this.viewportState === ViewportState.Manipulation) {
        return;
      }
      viewportWheelZoom(event);
    });
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
    const validX = (piece.cell.x * this.pieceSize) - this.spritesheet.pieceMargin;
    const validY = (piece.cell.y * this.pieceSize) - this.spritesheet.pieceMargin;
    if (Math.abs(pieceGroup.x - validX) < this.pieceSnappingMargin && Math.abs(pieceGroup.y - validY) < this.pieceSnappingMargin) {
      return {x: validX, y: validY};
    }
    return undefined;
  }

  private getPieceGroupSnapping(pieceGroup: PieceGroup): GroupSnapping | undefined {
    const pieces = pieceGroup.children;
    const neighborOffsets = [
      {x: -1, y: 0},
      {x: 1, y: 0},
      {x: 0, y: -1},
      {x: 0, y: 1},
    ];
    for (const piece of pieces) {
      for (const neighborOffset of neighborOffsets) {
        const neighborPiece = this.pieces[piece.cell.x + neighborOffset.x]?.[piece.cell.y + neighborOffset.y];
        if (neighborPiece && neighborPiece.parent !== pieceGroup) {
          const validX = neighborPiece.parent.x + neighborPiece.x - (this.pieceSize * neighborOffset.x) - piece.x;
          const validY = neighborPiece.parent.y + neighborPiece.y - (this.pieceSize * neighborOffset.y) - piece.y;
          if (Math.abs(pieceGroup.x - validX) < this.pieceSnappingMargin && Math.abs(pieceGroup.y - validY) < this.pieceSnappingMargin) {
            return {
              pieceGroup: neighborPiece.parent,
              snapPosition: {x: validX, y: validY},
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
    return true;
  }

  private shufflePieces(): void {
    const remainingPieces = [...this.pieceContainer.children];
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

  private movePieceToTop(pieceToMove: PieceGroup): void {
    this.pieceContainer.removeChild(pieceToMove);
    this.pieceContainer.addChild(pieceToMove);
  }

  private movePieceToBottom(pieceToMove: PieceGroup): void {
    this.pieceContainer.removeChild(pieceToMove);
    this.pieceContainer.addChildAt(pieceToMove,0);
  }

}
