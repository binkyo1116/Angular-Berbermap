import { animate, style, transition, trigger } from '@angular/animations';
import { Component, ElementRef, OnDestroy, ViewChild } from '@angular/core';
import { ReplaySubject, takeUntil } from 'rxjs';
import { FirebaseService, Marker } from '../services/firebase_service';
import { iconColorMap } from '../services/marker_icon';

const heightAutoStyle = {
  height: '*',
  marginTop: '*',
  marginBottom: '*',
  paddingTop: '*',
  paddingBottom: '*',
};

const heightZeroStyle = {
  height: 0,
  marginTop: 0,
  marginBottom: 0,
  paddingTop: 0,
  paddingBottom: 0,
};

@Component({
  selector: 'list-view',
  templateUrl: 'list_view.html',
  styleUrls: ['./list_view.scss'],
  animations: [
    trigger('expandY', [
      transition(':enter', [
        style(heightZeroStyle),
        animate('0.3s ease-in-out', style(heightAutoStyle)),
      ]),
      transition(':leave', [
        style(heightAutoStyle),
        animate('0.3s ease-in-out', style(heightZeroStyle)),
      ]),
    ]),
  ],
})
export class ListViewComponent implements OnDestroy {
  @ViewChild('searchInput') searchInput!: ElementRef;

  readonly iconColorMap = iconColorMap;

  isFilterCardOpen = false;
  categories = ['Hike', 'Food', 'Accommodation'];

  private readonly destroyed = new ReplaySubject<void>(1);

  constructor(readonly firebaseService: FirebaseService) {
    this.firebaseService.drawerOpenObservable
      .pipe(takeUntil(this.destroyed))
      .subscribe((isOpen: boolean) => {
        if (isOpen) {
          this.focusOnSearchBox();
        }
      });
  }

  ngOnDestroy() {
    this.destroyed.next();
    this.destroyed.complete();
  }

  focusOnSearchBox() {
    setTimeout(() => {
      this.searchInput.nativeElement.focus();
    }, 0);
  }

  openSpotInfo(marker: Marker) {
    if (this.firebaseService.isSpotSelected(marker.spotId)) {
      this.firebaseService.openSpotInfoDialog(marker);
    }
    this.firebaseService.selectSpot(marker.spotId);
    this.firebaseService.panTo({ lat: marker.position.lat, lng: marker.position.lng });
  }

  openFilterCard() {
    this.isFilterCardOpen = !this.isFilterCardOpen;
  }

  trackByMarker(index: number, marker: Marker) {
    return marker.spotId;
  }
}
