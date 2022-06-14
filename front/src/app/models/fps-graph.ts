import { Container, Sprite, Text, Texture } from 'pixi.js';
import type { Ticker } from 'pixi.js';

export class FpsGraph extends Container {

  private readonly background: Sprite;
  private readonly fpsLabel: Text;
  private readonly fpsBarContainer: Container;
  private readonly fpsBars: Array<{
    fps: number;
    sprite: Sprite;
  }> = [];

  private internalWidth: number;
  private internalHeight: number;

  private fps: Array<number> = [];
  private cumulativeElapsed = 0;
  private cumulativeFps = 0;
  private fpsBarWidth = 0;
  private fpsBarMaxHeight = 0;

  constructor(
    private readonly ticker: Ticker,
    width: number = 200,
    height: number = 125,
    private readonly padding: number = 10,
    private readonly fontSize: number = 16,
    private readonly fontSpacing: number = 10,
    private readonly sampleSize: number = 30,
    private readonly sampleDuration: number = 300,
    private readonly fpsTarget: number = 60,
  ) {
    super();
    this.internalWidth = width;
    this.internalHeight = height;
    this.background = this.buildBackground();
    this.fpsLabel = this.buildFpsLabel();
    this.fpsBarContainer = this.buildFpsContainer();
    this.addChild(this.background);
    this.addChild(this.fpsLabel);
    this.addChild(this.fpsBarContainer);
    this.resize();
    this.ticker.add(() => {
      this.tick();
    });
  }

  public override set width(value: number) {
    this.internalWidth = value;
    this.resize();
  }

  public override set height(value: number) {
    this.internalHeight = value;
    this.resize();
  }

  private buildBackground(): Sprite {
    const background = new Sprite(Texture.WHITE);
    background.tint = 0x000000;
    background.alpha = 0.5;
    return background;
  }

  private buildFpsLabel(): Text {
    return new Text('0 fps', {
      fill: 0xffffff,
      stroke: 0x000000,
      strokeThickness: 1,
      dropShadow: true,
      dropShadowAngle: Math.PI / 2,
      dropShadowDistance: 0,
      dropShadowColor: 0x000000,
      dropShadowBlur: 3,
      dropShadowAlpha: 0.5,
      fontSize: this.fontSize,
      fontFamily: 'sans-serif',
    });
  }

  private buildFpsContainer(): Container {
    return new Container();
  }

  private buildFpsBar(averageFps: number): Sprite {
    const fpsBar = new Sprite(Texture.WHITE);
    fpsBar.tint = this.getFpsBarColor(averageFps);
    fpsBar.alpha = 0.75;
    return fpsBar;
  }

  private resize(): void {
    this.resizeBackground();
    this.resizeFpsLabel();
    this.resizeFpsBarContainer();
    this.resizeFpsBars();
  }

  private resizeBackground(): void {
    this.background.width = this.internalWidth;
    this.background.height = this.internalHeight;
  }

  private resizeFpsLabel(): void {
    this.fpsLabel.x = this.padding;
    this.fpsLabel.y = this.padding - (this.fpsLabel.height - this.fontSize) / 2;
  }

  private resizeFpsBarContainer(): void {
    this.fpsBarContainer.x = this.padding;
    this.fpsBarContainer.y = this.padding + this.fontSize + this.fontSpacing;
  }

  private resizeFpsBars(): void {
    this.fpsBarWidth = (this.internalWidth - this.padding * 2) / this.sampleSize;
    this.fpsBarMaxHeight = this.internalHeight - this.padding * 2 - this.fontSize - this.fontSpacing;
    this.fpsBars.forEach((fpsBar, index) => {
      this.resizeFpsBar(index, fpsBar.fps, fpsBar.sprite);
    });
  }

  private resizeFpsBar(index: number, averageFps: number, fpsBar: Sprite): void {
    const fpsBarHeight = Math.min(
      this.fpsBarMaxHeight,
      this.fpsBarMaxHeight * (averageFps / this.fpsTarget),
    );
    const paddedIndex = this.sampleSize - this.fpsBars.length + index;
    fpsBar.x = this.fpsBarWidth * paddedIndex;
    fpsBar.y = this.fpsBarMaxHeight - fpsBarHeight;
    fpsBar.width = this.fpsBarWidth;
    fpsBar.height = fpsBarHeight;
  }

  private tick(): void {
    // Cumulate fps
    this.fps.push(this.ticker.FPS);
    this.cumulativeFps += this.ticker.FPS;

    this.cumulativeElapsed += this.ticker.deltaMS;
    if (this.cumulativeElapsed >= this.sampleDuration) {
      // Compute everage fps
      const averageFps = Math.min(this.cumulativeFps / this.fps.length, this.fpsTarget);

      // Reset cumulative fps
      this.cumulativeElapsed = this.cumulativeElapsed - this.sampleDuration;
      this.fps = [];
      this.cumulativeFps = 0;

      // Add new average fps sample
      this.addNewFpsBar(averageFps);
    }
  }

  private addNewFpsBar(averageFps: number): void {
    // Update fps label
    this.fpsLabel.text = `${Math.round(averageFps)} fps`;

    // Offset previous fps bars
    this.fpsBars.forEach((addedFpsBar) => {
      addedFpsBar.sprite.x -= this.fpsBarWidth;
    });

    // Add new everage fps bar
    const fpsBar = this.buildFpsBar(averageFps);
    this.fpsBars.push({
      fps: averageFps,
      sprite: fpsBar,
    });
    this.fpsBarContainer.addChild(fpsBar);
    this.resizeFpsBar(this.fpsBars.length - 1, averageFps, fpsBar);

    // Remove oldest fps bar
    if (this.fpsBars.length > this.sampleSize) {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      this.fpsBarContainer.removeChild(this.fpsBars.shift()!.sprite);
    }
  }

  private getFpsBarColor(fps: number): number {
    if (fps > 56) {
      return 0x41ce57;
    }
    else if(fps > 49) {
      return 0xa2e72a;
    }
    else if (fps > 39) {
      return 0xd3f414;
    }
    else if (fps > 29) {
      return 0xfeff00;
    }
    else if (fps > 24) {
      return 0xffcb00;
    }
    else if (fps > 15) {
      return 0xff9e00;
    }
    else if (fps > 4) {
      return 0xff0000;
    }
    else {
      return 0xa60000;
    }
  }

}
