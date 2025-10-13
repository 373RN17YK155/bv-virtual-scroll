import { Routes } from '@angular/router';
import { DemoComponent } from './demo.component';
import { CleanComponent } from './clean.component';
import { ObserverDemoComponent } from './observer-demo.component';

export const routes: Routes = [
  { path: '', redirectTo: '/observer-demo', pathMatch: 'full' },
  { path: 'demo', component: DemoComponent },
  { path: 'clean', component: CleanComponent },
  { path: 'observer-demo', component: ObserverDemoComponent },
];
