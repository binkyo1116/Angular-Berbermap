import { Component, ElementRef, Inject, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Marker } from '../services/firebase_service';
import { iconColorMap } from '../services/marker_icon';
import { Gallery, ImageItem } from 'ng-gallery';
import { Lightbox } from 'ng-gallery/lightbox';

/**
 * If the delta is greater than this, we treat it as drag and not click,
 * and do not open lightbox.
 */
const OPEN_LIGHT_BOX_THRESHOLD_PX = 5;
/**
 * The threshold (relative) to drag to trigger next/prev image.
 */
const NEXT_IMAGE_DRAG_THRESHOLD = 0.3;

/** Without this lightbox doesn't work. */
const LIGHTBOX_ID = 'lightbox_id';

@Component({
  selector: 'spot-info-dialog',
  templateUrl: 'spot_info_dialog.html',
  styleUrls: ['./spot_info_dialog.scss'],
})
export class SpotInfoDialogComponent implements OnInit, OnDestroy {
  @ViewChild('images') imagesRef?: ElementRef<HTMLElement>;
  readonly iconColorMap = iconColorMap;

  editMode = false;
  currentImageIndex = 0;
  imagePointerStartPos?: { x: number; y: number };
  private imagePointerCurrentPos?: { x: number; y: number };
  private imagesWidth?: number;

  constructor(
    @Inject(MAT_DIALOG_DATA) readonly data: Marker,
    private readonly gallery: Gallery,
    private readonly lightbox: Lightbox
  ) {}

  ngOnInit() {
    // Load items into gallery
    const items = this.data.spot.images.map(
      (image) => new ImageItem({ src: image.url, thumb: image.url })
    );
    this.gallery.ref(LIGHTBOX_ID).load(items);
  }

  ngOnDestroy() {
    this.removeImagesEventListeners();
  }

  swipeImage(newIndex: number) {
    if (newIndex < 0 || newIndex >= this.data.spot.images.length) {
      return;
    }
    this.currentImageIndex = newIndex;
  }

  onImagesPointerDown(event: PointerEvent) {
    event.preventDefault();
    event.stopPropagation();
    window.addEventListener('pointermove', this.onImagesPointerMove);
    window.addEventListener('pointerup', this.onImagesPointerUp);
    this.imagePointerStartPos = { x: event.clientX, y: event.clientY };
    this.imagesWidth = this.imagesRef?.nativeElement.clientWidth;
  }

  onImagesPointerMove = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!this.imagePointerStartPos || !this.imagesWidth) return;
    this.imagePointerCurrentPos = { x: event.clientX, y: event.clientY };
  };

  onImagesPointerUp = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    this.removeImagesEventListeners();
    if (!this.imagePointerStartPos || !this.imagesWidth) return;
    const dx = event.clientX - this.imagePointerStartPos.x;
    const threshold = this.imagesWidth * NEXT_IMAGE_DRAG_THRESHOLD;
    if (this.currentImageIndex > 0 && dx > threshold) {
      this.currentImageIndex--;
    } else if (this.currentImageIndex < this.data.spot.images.length - 1 && dx < -threshold) {
      this.currentImageIndex++;
    } else {
      const dy = event.clientY - this.imagePointerStartPos.y;
      const delta = Math.sqrt(dx * dx + dy * dy);
      if (delta <= OPEN_LIGHT_BOX_THRESHOLD_PX) {
        this.lightbox.open(this.currentImageIndex, LIGHTBOX_ID);
      }
    }
    this.imagePointerStartPos = undefined;
    this.imagePointerCurrentPos = undefined;
  };

  onImagesPointerCancel = (event: PointerEvent) => {
    this.removeImagesEventListeners();
  };

  getImageTransform(i: number) {
    if (!this.imagePointerStartPos || !this.imagePointerCurrentPos || !this.imagesWidth) {
      if (i < this.currentImageIndex) return 'translateX(-100%)';
      if (i > this.currentImageIndex) return 'translateX(100%)';
      return undefined;
    }
    const dx = this.imagePointerCurrentPos?.x - this.imagePointerStartPos?.x;
    const dxAbs = Math.abs(dx);
    const dxAbsBounded = Math.min(dxAbs, this.imagesWidth);
    let dxBounded = dxAbsBounded * Math.sign(dx);
    if (i === this.currentImageIndex) {
      // Center image.
      if (
        (this.currentImageIndex === 0 && dx > 0) ||
        (this.currentImageIndex === this.data.spot.images.length - 1 && dx < 0)
      ) {
        // Current image is the first or last one, only allow dragging a little bit.
        dxBounded = Math.min(dxAbs, 50) * Math.sign(dx);
      }
      return `translateX(${dxBounded}px)`;
    }
    if (i === this.currentImageIndex + 1 && dx < 0) {
      // Next image.
      return `translateX(calc(100% + ${dxBounded}px))`;
    }
    if (i === this.currentImageIndex - 1 && dx > 0) {
      // Prev image.
      return `translateX(calc(-100% + ${dxBounded}px))`;
    }
    if (i < this.currentImageIndex) {
      // Other left image.
      return 'translateX(-100%)';
    }
    if (i > this.currentImageIndex) {
      // Other right image.
      return 'translateX(100%)';
    }
    return undefined;
  }

  private removeImagesEventListeners() {
    window.removeEventListener('pointermove', this.onImagesPointerMove);
    window.removeEventListener('pointerup', this.onImagesPointerUp);
  }

  editSpot() {
    this.editMode = true;
  }
}
