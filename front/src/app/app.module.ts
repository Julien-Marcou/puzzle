import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { CheckmarkSpinnerComponent } from './components/checkmark-spinner/checkmark-spinner.component';
import { PuzzlePreviewComponent } from './components/puzzle-preview/puzzle-preview.component';

@NgModule({
  declarations: [
    AppComponent,
    PuzzlePreviewComponent,
    CheckmarkSpinnerComponent,
  ],
  imports: [
    BrowserModule,
    FormsModule,
    AppRoutingModule,
  ],
  providers: [],
  bootstrap: [AppComponent],
})
export class AppModule { }
