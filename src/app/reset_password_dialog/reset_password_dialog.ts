import { Component, Inject } from '@angular/core';
import { MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { sendPasswordResetEmail } from '@firebase/auth';
import { auth } from '../firebase';
import { FirebaseService } from '../services/firebase_service';

@Component({
  selector: 'reset-password-dialog',
  templateUrl: './reset_password_dialog.html',
  styleUrls: ['./reset_password_dialog.scss'],
})
export class ResetPasswordDialog {
  readonly auth = auth;
  email = '';
  errorMsg?: string;

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: string,
    readonly firebaseService: FirebaseService,
    private readonly matDialogRef: MatDialogRef<ResetPasswordDialog>,
    private readonly matSnackBar: MatSnackBar
  ) {
    this.email = this.data;
  }

  onSubmit() {
    this.errorMsg = undefined;
    sendPasswordResetEmail(auth, this.email)
      .then(() => {
        this.matSnackBar.open('Password reset email sent. Please check your email.', 'Dismiss');
        this.matDialogRef.close();
      })
      .catch((error) => {
        this.errorMsg = error;
      });
  }
}
