import { Component, ElementRef, Input, OnInit, ViewChild } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { MatAutocompleteTrigger } from '@angular/material/autocomplete';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';

import { FirebaseService, SpotDB, SpotImage } from '../services/firebase_service';
import { loadingColorMap } from '../services/marker_icon';
import { resizeImg } from '../image_processing';
import { ConfirmDialog } from '../confirm_dialog/confirm_dialog';
import { NewSpotDialogComponent } from '../new_spot_dialog/new_spot_dialog';

@Component({
  selector: 'new-spot',
  templateUrl: 'new_spot.html',
  styleUrls: ['./new_spot.scss'],
})
export class NewSpotComponent implements OnInit {
  @Input() edit = false;
  @Input() spotData?: SpotDB;
  @Input() spotId?: string;

  @ViewChild('spotInput') spotInput!: ElementRef;
  @ViewChild('tagInput', { read: MatAutocompleteTrigger })
  tagInput!: MatAutocompleteTrigger;

  placesAutocomplete!: google.maps.places.Autocomplete;
  selectedPlaceId?: string;
  spotAlreadyExistWarning = false;
  lat?: number;
  lng?: number;
  name = '';
  address = '';
  originalAddress = '';
  editAddress = false;

  selectedCategory?: string;
  selectedIcon?: string;

  tags: Set<string> = new Set<string>();
  tagValue = '';
  filteredTagOptions: string[] = [];
  notes = '';
  // Selecting a new file will populate only previewURL and file (storedImage will be undefined);
  // Already uploaded file will only populate storedImage(previewURL and file will be undefined).
  uploadImages: { previewURL?: SafeUrl; file?: File; storedImage?: SpotImage }[] = [];

  loading = false;
  loadingColor = '';

  errorMsg = '';

  constructor(
    private readonly domSanitizer: DomSanitizer,
    private readonly matDialogRef: MatDialogRef<NewSpotDialogComponent>,
    private readonly matSnackBar: MatSnackBar,
    private readonly matDialog: MatDialog,
    readonly firebaseService: FirebaseService
  ) {
    this.filterTags();
  }

  ngOnInit() {
    const spot = this.spotData;
    if (!this.edit || !spot) {
      return;
    }
    this.selectedPlaceId = spot.placeId;
    this.lat = spot.lat;
    this.lng = spot.lng;
    this.name = spot.name;
    this.selectedCategory = spot.category;
    this.selectedIcon = spot.icon;
    this.tags = new Set(spot.tags);
    this.notes = spot.notes;
    this.uploadImages = spot.images.map((img) => ({ storedImage: img }));
    let geocoder = new google.maps.Geocoder();
    geocoder
      .geocode({ placeId: this.selectedPlaceId })
      .then(({ results }) => {
        if (results[0]) {
          this.address = results[0].formatted_address;
          this.originalAddress = this.address;
        }
      })
      .catch((e) => {
        this.errorMsg = `Geocoder failed when looking up address: ${e}`;
      });
  }

  ngAfterViewInit() {
    this.placesAutocomplete = new google.maps.places.Autocomplete(this.spotInput.nativeElement, {
      fields: ['place_id', 'geometry', 'icon', 'name'],
    });
    this.placesAutocomplete.addListener('place_changed', () => {
      const place = this.placesAutocomplete.getPlace();
      if (place.geometry?.location) {
        this.selectedPlaceId = place.place_id;
        this.lat = place.geometry.location.lat();
        this.lng = place.geometry.location.lng();
        if (!this.edit) {
          this.name = place.name ?? '';
        }

        // Show a warning if this placeID already exist.
        if (
          this.spotData?.placeId !== place.place_id &&
          this.firebaseService.markers.find((marker) => marker.spot.placeId === place.place_id)
        ) {
          this.spotAlreadyExistWarning = true;
        } else {
          this.spotAlreadyExistWarning = false;
        }
      } else {
        this.spotAlreadyExistWarning = false;
        this.selectedPlaceId = undefined;
        this.lat = undefined;
        this.lng = undefined;
        if (!this.edit) {
          this.name = '';
        }
      }
    });
  }

  ngOnDestroy() {
    google.maps.event.clearInstanceListeners(this.placesAutocomplete);
  }

  filterTags() {
    const keyword = this.tagValue.trim().toLowerCase();
    const removeDupOpt = [];
    for (const tag of this.firebaseService.allTags) {
      if (!this.tags.has(tag)) {
        removeDupOpt.push(tag);
      }
    }
    if (!keyword) {
      this.filteredTagOptions = removeDupOpt;
    } else {
      let hasTagValue = false;
      this.filteredTagOptions = [];
      for (const tag of removeDupOpt) {
        if (tag.toLowerCase().includes(keyword)) {
          this.filteredTagOptions.push(tag);
          if (tag === this.tagValue) {
            hasTagValue = true;
          }
        }
      }
      if (!hasTagValue) {
        this.filteredTagOptions.unshift(this.tagValue);
      }
    }
  }

  addTag(tagValue: string) {
    if (!tagValue) return;

    this.tags.add(tagValue);
    setTimeout(() => {
      this.tagValue = '';
      this.tagInput.openPanel();
    });
  }

  onSelectImg(e: Event) {
    const files = (e.target as HTMLInputElement).files;
    if (!files) return;
    for (let i = 0; i < files.length; ++i) {
      resizeImg(files[i], 'image.png', 2000, 2000)
        .then(({ file }) => {
          this.uploadImages.push({
            file,
            previewURL: this.domSanitizer.bypassSecurityTrustUrl(URL.createObjectURL(file)),
          });
        })
        .catch((error) => {
          // TODO: color too dark
          this.matSnackBar.open(error.message, 'Dismiss');
        });
    }
  }

  moveImage(index: number, newIndex: number) {
    if (
      index < 0 ||
      index >= this.uploadImages.length ||
      newIndex < 0 ||
      newIndex >= this.uploadImages.length
    ) {
      return;
    }
    const temp = this.uploadImages[index];
    this.uploadImages[index] = this.uploadImages[newIndex];
    this.uploadImages[newIndex] = temp;
  }

  onSave(): void {
    if (this.loading) {
      return;
    }
    if (!this.name) {
      this.errorMsg = 'Name is required';
      return;
    }
    if (!this.selectedPlaceId || this.lat === undefined || this.lng === undefined) {
      this.errorMsg = 'No Spot (or latitude/longitude) selected';
      return;
    }
    if (!this.selectedCategory) {
      this.errorMsg = 'Category is required';
      return;
    }
    if (!this.selectedIcon) {
      this.errorMsg = 'Mark is required';
      return;
    }
    this.loadingColor = loadingColorMap[this.selectedIcon];
    this.loading = true;
    this.errorMsg = '';

    this.firebaseService
      .createOrEditSpot({
        editingSpotId: this.spotId,
        placeId: this.selectedPlaceId,
        name: this.name,
        lat: this.lat,
        lng: this.lng,
        category: this.selectedCategory,
        icon: this.selectedIcon,
        tags: [...this.tags],
        notes: this.notes,
        images: this.uploadImages.map((image) => ({
          file: image.file,
          storedImage: image.storedImage,
        })),
      })
      .then(async () => {
        await this.firebaseService.fetchSpots();
        const spotMarker = this.firebaseService.markers.find(
          (marker) => marker.spot.placeId === this.selectedPlaceId
        );
        this.matDialogRef.close();
        this.loading = false;
        if (spotMarker) {
          this.firebaseService.openSpotInfoDialog(spotMarker);
          const pos = {
            lat: spotMarker.spot.lat,
            lng: spotMarker.spot.lng,
          };
          this.firebaseService.panTo(pos);
        }
      })
      .catch((error) => {
        this.errorMsg = `Error saving spot: ${error}`;
        this.loading = false;
      });
  }

  deleteSpot() {
    if (!this.spotData || !this.spotId || this.loading) return;
    this.errorMsg = '';
    this.loadingColor = loadingColorMap[this.spotData.icon];

    this.matDialog.open(ConfirmDialog, {
      maxHeight: '100vh',
      maxWidth: '100vw',
      data: {
        title: 'Are you sure you want to delete this spot?',
        description: 'This is permanent and cannot be undone.',
        confirmButtonText: 'Delete',
        onConfirm: () => {
          if (!this.spotData || !this.spotId || this.loading) return;
          this.loading = true;
          this.firebaseService
            .deleteSpot(this.spotId)
            .then(() => {
              this.matDialogRef.close();
              this.firebaseService.fetchSpots();
            })
            .catch((error) => {
              this.errorMsg = `Error deleting spot: ${error}`;
            })
            .finally(() => {
              this.loading = false;
            });
        },
      },
    });
  }

  changeAddress() {
    this.editAddress = true;
    const input = this.spotInput.nativeElement;
    setTimeout(() => {
      input.select();
      input.focus();
    }, 0);
  }

  cancelChangeAddress() {
    this.editAddress = false;
    this.address = this.originalAddress;
    this.selectedPlaceId = this.spotData?.placeId;
    this.lat = this.spotData?.lat;
    this.lng = this.spotData?.lng;
  }
}
