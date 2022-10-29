/* eslint-disable @typescript-eslint/member-ordering */
import { Filter, Point, DEG_TO_RAD } from '@pixi/core';
import { vertex } from './default-vertex';
import { godray } from './godray-fragment';
import type { CLEAR_MODES, FilterSystem, RenderTexture, Rectangle } from '@pixi/core';

interface GodrayFilterOptions {
  angle: number;
  gain: number;
  lacunarity: number;
  parallel: boolean;
  time: number;
  center: Array<number> | Point;
  alpha: number;
}

export class GodrayFilter extends Filter {

  public static readonly Defaults: GodrayFilterOptions = {
    angle: 30,
    gain: 0.5,
    lacunarity: 2.5,
    time: 0,
    parallel: true,
    center: [0, 0],
    alpha: 1,
  };

  public parallel = true;
  public center: Array<number> | Point;
  public time = 0;
  private angleLight: Point;
  private angleInDegree = 0;

  constructor(options?: Partial<GodrayFilterOptions>) {
    super(vertex, godray);
    this.uniforms['dimensions'] = new Float32Array(2);
    const assignedOptions = Object.assign(GodrayFilter.Defaults, options);
    this.angleLight = new Point();
    this.angle = assignedOptions.angle;
    this.gain = assignedOptions.gain;
    this.lacunarity = assignedOptions.lacunarity;
    this.alpha = assignedOptions.alpha;
    this.parallel = assignedOptions.parallel;
    this.center = assignedOptions.center;
    this.time = assignedOptions.time;
  }

  public get angle(): number {
    return this.angleInDegree;
  }

  public set angle(value: number) {
    this.angleInDegree = value;
    const angleInRadians = value * DEG_TO_RAD;
    this.angleLight.x = Math.cos(angleInRadians);
    this.angleLight.y = Math.sin(angleInRadians);
  }

  public get gain(): number {
    return this.uniforms['gain'];
  }

  public set gain(value: number) {
    this.uniforms['gain'] = value;
  }

  public get lacunarity(): number {
    return this.uniforms['lacunarity'];
  }

  public set lacunarity(value: number) {
    this.uniforms['lacunarity'] = value;
  }

  public get alpha(): number {
    return this.uniforms['alpha'];
  }

  public set alpha(value: number) {
    this.uniforms['alpha'] = value;
  }

  public override apply(filterManager: FilterSystem, input: RenderTexture, output: RenderTexture, clear: CLEAR_MODES): void {
    const { width, height } = input.filterFrame as Rectangle;
    this.uniforms['light'] = this.parallel ? this.angleLight : this.center;
    this.uniforms['parallel'] = this.parallel;
    this.uniforms['dimensions'][0] = width;
    this.uniforms['dimensions'][1] = height;
    this.uniforms['aspect'] = height / width;
    this.uniforms['time'] = this.time;
    this.uniforms['alpha'] = this.alpha;
    filterManager.applyFilter(this, input, output, clear);
  }

}
