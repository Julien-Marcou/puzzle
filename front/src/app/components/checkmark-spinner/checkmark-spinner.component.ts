import type { ElementRef } from '@angular/core';

import { Component, effect, input, viewChild } from '@angular/core';

@Component({
  selector: 'app-checkmark-spinner',
  templateUrl: './checkmark-spinner.component.html',
  styleUrl: './checkmark-spinner.component.scss',
})
export class CheckmarkSpinnerComponent {

  private static readonly MatrixRegExp = CheckmarkSpinnerComponent.getMatrixRegExp();

  public readonly hostRef = viewChild.required<ElementRef<SVGElement>>('host');
  public readonly spinnerRef = viewChild.required<ElementRef<SVGElement>>('spinner');
  public readonly arcRef = viewChild.required<ElementRef<SVGElement>>('arc');

  public readonly complete = input.required<boolean>();

  private readonly minStopAnimationDuration = 400; // In milliseconds
  private readonly maxStopAnimationDuration = 1000; // In milliseconds

  constructor() {
    effect(() => {
      if (!this.complete()) {
        this.restartSpinner();
      }
      else {
        this.stopSpinner();
      }
    });
  }

  private static getMatrixRegExp(): RegExp {
    const parameterValueRegex = '([^,]+)';
    const parameterSeparatorRegex = ',\\s*';
    const sixParameterList = Array(6)
      .fill(parameterValueRegex)
      .join(parameterSeparatorRegex);
    const matrixRegex = `matrix\\(${sixParameterList}\\)`;
    return new RegExp(matrixRegex, 'i');
  }

  private stopSpinner(): void {
    // Save the current spinner animation state,
    // compute the required angle to make the spinner's rotation stop at the beginning of the checkmark
    // and start the "complete" animation (spinner stop + checkmark drawing)
    const spinnerComputedStyle = getComputedStyle(this.spinnerRef().nativeElement);
    const arcComputedStyle = getComputedStyle(this.arcRef().nativeElement);
    const radius = parseInt(this.arcRef().nativeElement.getAttribute('r') ?? '0', 10);
    const arcOffset = Math.abs(parseFloat(arcComputedStyle.strokeDashoffset.replace('px', '')));
    const currentSpinnerAngle = this.getRotationAngle(spinnerComputedStyle);
    const targetSpinnerAngle = parseFloat(spinnerComputedStyle.getPropertyValue('--target-angle'));
    const currentArcAngle = this.getRotationAngle(arcComputedStyle);
    const missingArcAngle = arcOffset / (Math.PI / 180) / radius;
    let targetArcAngle = (targetSpinnerAngle - currentSpinnerAngle - missingArcAngle);
    if (targetArcAngle <= -360) {
      targetArcAngle += 360;
    }
    const stopDuration = Math.min(Math.abs(targetArcAngle - currentArcAngle) / 360 * this.maxStopAnimationDuration, this.minStopAnimationDuration);
    this.hostRef().nativeElement.style.setProperty('--stop-duration', `${stopDuration}ms`);
    this.spinnerRef().nativeElement.style.setProperty('--transform', `rotate(${currentSpinnerAngle}deg)`);
    this.arcRef().nativeElement.style.setProperty('--transform', `rotate(${currentArcAngle}deg)`);
    this.arcRef().nativeElement.style.setProperty('--target-transform', `rotate(${targetArcAngle}deg)`);
    this.arcRef().nativeElement.style.setProperty('--stroke-dasharray', arcComputedStyle.strokeDasharray);
    this.arcRef().nativeElement.style.setProperty('--stroke-dashoffset', arcComputedStyle.strokeDashoffset);
    this.hostRef().nativeElement.classList.add('complete');
  }

  private restartSpinner(): void {
    this.spinnerRef().nativeElement.style.removeProperty('--transform');
    this.arcRef().nativeElement.style.removeProperty('--transform');
    this.arcRef().nativeElement.style.removeProperty('--stroke-dasharray');
    this.arcRef().nativeElement.style.removeProperty('--stroke-dashoffset');
    this.hostRef().nativeElement.classList.remove('complete');
  }

  private getRotationAngle(style: CSSStyleDeclaration): number {
    const matrixValues = CheckmarkSpinnerComponent.MatrixRegExp.exec(style.transform);
    if (!matrixValues) {
      return 0;
    }
    const a = parseFloat(matrixValues[1]);
    const b = parseFloat(matrixValues[2]);
    return Math.atan2(b, a) * (180 / Math.PI);
  }

}
