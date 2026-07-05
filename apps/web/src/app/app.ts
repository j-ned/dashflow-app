import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainer } from '@shared/components/toast/toast';
import { ConfettiContainer } from '@shared/components/celebration/celebration';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, ToastContainer, ConfettiContainer],
  templateUrl: './app.html',
  host: { class: 'contents' },
})
export class AppComponent {}
