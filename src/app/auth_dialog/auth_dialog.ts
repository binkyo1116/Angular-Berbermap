import { Component, OnDestroy } from '@angular/core';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { ResetPasswordDialog } from '../reset_password_dialog/reset_password_dialog';

import { auth } from '../firebase';

@Component({
  selector: 'auth-dialog',
  templateUrl: 'auth_dialog.html',
  styleUrls: ['./auth_dialog.scss'],
})
export class AuthDialog implements OnDestroy {
  selectedTabIndex = 0;

  email = '';
  password = '';
  errorMsg?: string;

  loading = false;

  constructor(
    private readonly matDialogRef: MatDialogRef<AuthDialog>,
    private readonly matDialog: MatDialog
  ) {}

  ngOnDestroy() {}

  onSubmit() {
    if (this.selectedTabIndex === 0) {
      this.login();
    } else if (this.selectedTabIndex === 1) {
      this.signUp();
    } else {
      console.error('Unknown selectedTabIndex');
    }
  }

  private async login() {
    if (this.loading) return;
    this.loading = true;
    this.errorMsg = undefined;
    try {
      await signInWithEmailAndPassword(auth, this.email, this.password);
      this.matDialogRef.close();
    } catch (error) {
      this.errorMsg = `${error}`;
    } finally {
      this.loading = false;
    }
  }

  private async signUp() {
    if (this.loading) return;
    this.loading = true;
    this.errorMsg = undefined;

    try {
      await createUserWithEmailAndPassword(auth, this.email, this.password);
      this.matDialogRef.close();
    } catch (error) {
      this.errorMsg = `${error}`;
    } finally {
      this.loading = false;
    }
  }

  onClickForgotPassword() {
    // pop up a dialog for users to enter their email.
    this.matDialog.open(ResetPasswordDialog, {
      maxHeight: '100vh',
      maxWidth: '100vw',
      data: this.email,
    });
  }

  async signInWithGoogle() {
    if (this.loading) return;
    this.loading = true;
    this.errorMsg = undefined;
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
      this.matDialogRef.close();
    } catch (error) {
      this.errorMsg = `${error}`;
      if (this.errorMsg.includes('auth/popup-closed-by-user')) {
        // User closed the popup, no need to show this error.
        this.errorMsg = undefined;
        return;
      }
    } finally {
      this.loading = false;
    }
  }
}
