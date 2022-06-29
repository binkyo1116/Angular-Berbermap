import { TestBed } from '@angular/core/testing';
import { MatDialogModule } from '@angular/material/dialog';
import { FirebaseService } from './firebase_service';

describe('FirebaseService', () => {
  let firebaseService: FirebaseService;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [MatDialogModule],
    });
    firebaseService = TestBed.inject(FirebaseService);
  });

  it('dummy test', () => {
    // TODO: Ideally we can test firebase operations with the emulator.
    // But the emulator doesn't work with Karma so will need some setup work.
    expect(firebaseService.createOrEditSpot).toBeTruthy();
  });
});
