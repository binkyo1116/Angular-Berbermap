import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';

@Component({
  selector: 'confirm-dialog',
  templateUrl: './confirm_dialog.html',
  styleUrls: ['./confirm_dialog.scss'],
})
export class ConfirmDialog {
  title = '';
  description = '';
  confirmButtonText = '';

  constructor(
    @Inject(MAT_DIALOG_DATA)
    readonly data: {
      title: string;
      description: string;
      confirmButtonText: string;
      onConfirm: () => void;
    },
    private readonly matDialogRef: MatDialogRef<ConfirmDialog>
  ) {
    this.title = this.data.title;
    this.description = this.data.description;
    this.confirmButtonText = this.data.confirmButtonText;
  }

  onConfirm() {
    this.data.onConfirm();
    this.matDialogRef.close();
  }
}
