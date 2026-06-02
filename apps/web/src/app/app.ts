import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from '@shared/components/toast/toast';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastContainer],
  templateUrl: './app.html',
  host: { class: 'contents' }
})
export class AppComponent {
}
