import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PuzzlePreviewComponent } from './components/puzzle-preview/puzzle-preview.component';

const routes: Routes = [
  {
    path: '',
    component: PuzzlePreviewComponent,
  },
  {
    path: '**',
    redirectTo: '',
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule { }
