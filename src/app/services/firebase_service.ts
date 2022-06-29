import { Injectable, OnDestroy } from '@angular/core';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  arrayUnion,
  writeBatch,
  doc,
  collection,
  getDocs,
  CollectionReference,
  addDoc,
  getDoc,
  DocumentSnapshot,
  arrayRemove,
  query,
  where,
} from 'firebase/firestore';
import { DocumentReference } from 'firebase/firestore/lite';
import { deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from 'firebase/storage';
import { BehaviorSubject, Observable, Subject } from 'rxjs';

import { auth, db } from '../firebase';
import { iconColorMap, iconLabelMap } from './marker_icon';
import { SpotInfoDialogComponent } from '../spot_info/spot_info_dialog';
import { MatDialog } from '@angular/material/dialog';

interface CreateSpotParams {
  editingSpotId?: string;
  placeId: string;
  name: string;
  lat: number;
  lng: number;
  category: string;
  icon: string;
  tags: string[];
  notes: string;
  images: { file?: File; storedImage?: SpotImage }[];
}

export interface SpotDB {
  placeId: string;
  createdAt: Date;
  updatedAt: Date;
  name: string;
  lat: number;
  lng: number;
  category: string;
  icon: string;
  tags: string[];
  notes: string;
  images: SpotImage[];
}

export interface SpotImage {
  url: string;
  storagePath: string;
}

interface TagDB {
  spots: string[];
}

export interface Marker {
  position: google.maps.LatLngLiteral;
  options: google.maps.MarkerOptions;
  spotId: string;
  spot: SpotDB;
}

export interface Pos {
  lat: number;
  lng: number;
}

function makeMarkerOption(icon: string, markSelected: boolean): google.maps.MarkerOptions {
  return {
    draggable: false,
    icon: {
      // https://developers.google.com/maps/documentation/javascript/reference/marker#MarkerLabel
      path: 'M12,11.5A2.5,2.5 0 0,1 9.5,9A2.5,2.5 0 0,1 12,6.5A2.5,2.5 0 0,1 14.5,9A2.5,2.5 0 0,1 12,11.5M12,2A7,7 0 0,0 5,9C5,14.25 12,22 12,22C12,22 19,14.25 19,9A7,7 0 0,0 12,2Z',
      anchor: new google.maps.Point(12, 17),
      fillOpacity: 1,
      fillColor: iconColorMap[icon],
      strokeWeight: 2,
      strokeColor: markSelected ? '#daddfc' : 'white',
      scale: markSelected ? 2.7 : 2,
      labelOrigin: new google.maps.Point(12, 15),
    },
  };
}

@Injectable({ providedIn: 'root' })
export class FirebaseService implements OnDestroy {
  // https://firebase.google.com/docs/reference/js/firebase.User
  currentUser: User | null = null;

  readonly authStateChanged = new Subject<void>();
  readonly panToSubject = new Subject<Pos>();
  private readonly drawerOpenSubject = new BehaviorSubject<boolean>(false);
  readonly drawerOpenObservable: Observable<boolean> = this.drawerOpenSubject;

  categories = ['Hike', 'Food', 'Accommodation', 'Spot'];
  icons = [
    { label: iconLabelMap['favorite'], icon: 'favorite', color: iconColorMap['favorite'] },
    {
      label: iconLabelMap['check_circle'],
      icon: 'check_circle',
      color: iconColorMap['check_circle'],
    },
    { label: iconLabelMap['thumb_down'], icon: 'thumb_down', color: iconColorMap['thumb_down'] },
  ];

  // The currently selected marker. Selected marker will show a larger icon.
  private selectedSpotId?: string;
  // List of markers we get from firebase. This is all the markers, without filter.
  markers: Marker[] = [];
  // All the tags computed from `this.markers`.
  allTags = new Set<string>();

  // Filtered results.
  filteredMarkers: Marker[] = [];
  filterText = '';
  filterCategory = new Set<string>();
  filterIcon = new Set<string>();
  filterTag = new Set<string>();

  constructor(private readonly matDialog: MatDialog) {
    onAuthStateChanged(auth, (user) => {
      this.currentUser = user;
      this.authStateChanged.next();
      // Clear states when logged out.
      if (!user) {
        this.setDrawerOpen(false);
        this.selectSpot(undefined);
        this.allTags.clear();
        this.markers = [];
        this.clearFilter();
      }
    });
  }

  ngOnDestroy() {
    this.authStateChanged.complete();
    this.panToSubject.complete();
  }

  async fetchSpots() {
    this.markers = [];
    this.allTags.clear();
    if (!this.currentUser) {
      return;
    }
    const uid = this.currentUser.uid;
    const userRef = doc(db, 'users', uid);

    const spotsCollection = collection(userRef, 'spots') as CollectionReference<SpotDB>;
    const querySnapshot = await getDocs(spotsCollection);

    querySnapshot.forEach((doc) => {
      const spot = doc.data();
      this.markers.push({
        position: { lat: spot.lat, lng: spot.lng },
        options: makeMarkerOption(spot.icon, this.isSpotSelected(doc.id)),
        spotId: doc.id,
        spot,
      });
      for (const tag of spot.tags) {
        this.allTags.add(tag);
      }
    });
    // Sort tags alphabetically.
    this.allTags = new Set([...this.allTags].sort());
    this.filterMarkers();
  }

  async createOrEditSpot({
    editingSpotId,
    placeId,
    name,
    lat,
    lng,
    category,
    icon,
    tags,
    notes,
    images,
  }: CreateSpotParams) {
    if (!this.currentUser) {
      throw new Error('Cannot createOrEditSpot without logged in user.');
    }
    const uid = this.currentUser.uid;
    const timestamp = new Date();
    const userRef = doc(db, 'users', uid);
    const userSpotsCollection = collection(userRef, 'spots') as CollectionReference<SpotDB>;

    let spotId: string;
    let spotRef: DocumentReference<SpotDB>;
    let existingSpotData: SpotDB | undefined;
    if (editingSpotId) {
      // Editing an existing spot.
      spotId = editingSpotId;
      spotRef = doc(userRef, 'spots', spotId) as DocumentReference<SpotDB>;
      const existingSpotSnapshot = (await getDoc(spotRef)) as DocumentSnapshot<SpotDB>;
      if (!existingSpotSnapshot.exists()) {
        throw new Error(`Editing spot but the spot data does not exist. Spot id: ${spotId}`);
      }
      existingSpotData = existingSpotSnapshot.data();
    } else {
      // Creating a new spot.
      spotRef = doc<SpotDB>(userSpotsCollection);
      spotId = spotRef.id;
    }

    // Check if the placeId already exist, we do not allow duplicated placeIds.
    // Only need to check if we're in create mode,
    // or if the user is changing placeId in edit mode.
    if (!editingSpotId || existingSpotData?.placeId !== placeId) {
      const q = query(userSpotsCollection, where('placeId', '==', placeId));
      const querySnapshot = await getDocs(q);
      if (querySnapshot.docs.some((doc) => doc.id !== spotId)) {
        throw new Error(`The place ID ${placeId} already exist.`);
      }
    }

    // Write to /checkpoints/<uid>/createOrEditSpot/<checkpointId>/<checkpointData>
    // before uploading images, and we'll remove the checkpoint when writing to
    // firestore, so we know if things fail half way.
    const checkpointCollection = collection(db, 'checkpoints', uid, 'createOrEditSpot');
    const checkpointData: { [key: string]: string | Date } = {
      spotId,
      placeId,
      timestamp,
    };
    if (editingSpotId && existingSpotData) {
      checkpointData['editingSpotId'] = editingSpotId;
      checkpointData['oldPlaceId'] = existingSpotData.placeId;
    }
    const checkpoint = await addDoc(checkpointCollection, checkpointData);

    // Remove `existingSpotData.images` that are no longer in `images` from Storage.
    const storage = getStorage();
    const removeImagePromises: Promise<void>[] = [];
    if (existingSpotData) {
      for (const oldImage of existingSpotData.images) {
        if (!images.find((image) => image.storedImage?.storagePath === oldImage.storagePath)) {
          // Remove oldImage.
          const storageRef = ref(storage, oldImage.storagePath);
          const promise = deleteObject(storageRef).catch((error) => {
            if (`${error}`.includes('(storage/object-not-found)')) {
              // This image is already deleted, no need to throw.
              return;
            } else {
              // Otherwise throw.
              throw error;
            }
          });
          removeImagePromises.push(promise);
        }
      }
    }
    // Store new images to Firebase Storage.
    const uploadImagePromises: Promise<void>[] = [];
    const imageIds = new Set<string>();
    if (existingSpotData) {
      // To avoid conflict image name, seed the set with existing image names.
      for (const image of existingSpotData.images) {
        const parts = image.storagePath.split('/');
        const fileName = parts[parts.length - 1];
        const png = '.png';
        if (fileName && fileName.endsWith(png)) {
          imageIds.add(fileName.substring(0, fileName.length - png.length));
        }
      }
    }
    // Upload new images.
    for (const image of images) {
      if (!image.file) continue;
      let imageId = `${Math.floor(Math.random() * 10000000)}`;
      while (imageIds.has(imageId)) {
        imageId = `${Math.floor(Math.random() * 10000000)}`;
      }
      // Upload images to storage at /users/<uid>/spots/<spotId>/<imageId>.png
      const storagePath = `/users/${uid}/spots/${spotId}/${imageId}.png`;
      const storageRef = ref(storage, storagePath);
      const promise = uploadBytes(storageRef, image.file, {
        cacheControl: 'public,max-age=315360000', // 10 Years.
      })
        .then((uploadResult) => getDownloadURL(uploadResult.ref))
        .then((url) => {
          // After done uploading, update the images array with the storedImage.
          image.storedImage = { url, storagePath };
        });
      uploadImagePromises.push(promise);
    }

    // Wait for all Storage operations to finish before updating Firestore.
    await Promise.all([...removeImagePromises, ...uploadImagePromises]);

    // Check that all the images have storedImage field set.
    if (images.some((image) => !image.storedImage)) {
      console.error(images);
      throw new Error(
        'Storage (remove or upload images) done, but some image in images array still have empty storedImage field.'
      );
    }
    // We need to write spots, tags, etc. in "batch" atomically.
    const batch = writeBatch(db);
    // Spot data.
    const spotDocToWrite: Partial<SpotDB> = {
      placeId,
      updatedAt: timestamp,
      name,
      lat,
      lng,
      category,
      icon,
      tags,
      notes,
      images: images
        .map((image) => image.storedImage)
        .filter((image): image is SpotImage => !!image),
    };
    if (!existingSpotData) {
      spotDocToWrite.createdAt = timestamp;
    }
    batch.set(spotRef, spotDocToWrite, { merge: true });
    // Tags to add.
    for (const tag of tags) {
      const tagsRef = doc(userRef, 'tags', tag) as DocumentReference<TagDB>;
      batch.set(tagsRef, { spots: arrayUnion(spotId) }, { merge: true });
    }
    if (existingSpotData) {
      // Tags to remove.
      const tagsSet = new Set<string>(tags);
      for (const tag of existingSpotData.tags) {
        if (!tagsSet.has(tag)) {
          const tagsRef = doc(userRef, 'tags', tag) as DocumentReference<TagDB>;
          batch.set(tagsRef, { spots: arrayRemove(spotId) }, { merge: true });
        }
      }
    }

    // Also remove the checkpoint as part of this batch write.
    batch.delete(doc(checkpointCollection, checkpoint.id));
    // Finally commit the batch.
    await batch.commit();
  }

  async deleteSpot(spotId: string) {
    if (!this.currentUser) {
      throw new Error('Cannot deleteSpot without logged in user.');
    }
    const uid = this.currentUser.uid;

    // Get the list of images.
    const userRef = doc(db, 'users', uid);
    const spotRef = doc(userRef, 'spots', spotId) as DocumentReference<SpotDB>;
    const spotSnapshot = (await getDoc(spotRef)) as DocumentSnapshot<SpotDB>;
    if (!spotSnapshot.exists()) {
      throw new Error(`The spot ID ${spotId} you are trying to delete does not exist`);
    }
    const spotDoc = spotSnapshot.data();

    // Remove images in Firebase Storage first.
    const storage = getStorage();
    const promises: Promise<void>[] = [];
    for (const image of spotDoc.images) {
      const storageRef = ref(storage, image.storagePath);
      const promise = deleteObject(storageRef).catch((error) => {
        if (`${error}`.includes('(storage/object-not-found)')) {
          // This image is already deleted, no need to throw.
          return;
        } else {
          // Otherwise throw.
          throw error;
        }
      });
      promises.push(promise);
    }

    // We need to write spots, tags, etc. in "batch" atomically.
    const batch = writeBatch(db);
    return Promise.all(promises).then(() => {
      // Spot data.
      batch.delete(spotRef);
      // Tags data.
      for (const tag of spotDoc.tags) {
        const tagsRef = doc(userRef, 'tags', tag) as DocumentReference<TagDB>;
        batch.set(tagsRef, { spots: arrayRemove(spotId) }, { merge: true });
      }

      return batch.commit();
    });
  }

  openSpotInfoDialog(marker: Marker) {
    this.matDialog.open(SpotInfoDialogComponent, {
      maxHeight: '100vh',
      maxWidth: '100vw',
      data: marker,
      autoFocus: false,
    });
    this.selectSpot(marker.spotId);
  }

  isDrawerOpen(): boolean {
    return this.drawerOpenSubject.value;
  }

  setDrawerOpen(isOpen: boolean) {
    if (isOpen === this.drawerOpenSubject.value) return;
    this.drawerOpenSubject.next(isOpen);
  }

  isSpotSelected(spotId: string): boolean {
    return spotId === this.selectedSpotId;
  }

  selectSpot(spotId?: string): void {
    if (this.selectedSpotId === spotId) return;
    for (const marker of this.markers) {
      if (marker.spotId === this.selectedSpotId) {
        // Unselect the old one.
        marker.options = makeMarkerOption(marker.spot.icon, false);
      } else if (marker.spotId === spotId) {
        // Select the new one.
        marker.options = makeMarkerOption(marker.spot.icon, true);
      }
    }
    this.selectedSpotId = spotId;
  }

  panTo(pos: Pos) {
    this.panToSubject.next(pos);
  }

  updateFilterCategory(category: string, checked: boolean) {
    if (checked) {
      this.filterCategory.add(category);
    } else {
      this.filterCategory.delete(category);
    }
    this.filterMarkers();
  }

  updateFilterIcon(icon: string, checked: boolean) {
    if (checked) {
      this.filterIcon.add(icon);
    } else {
      this.filterIcon.delete(icon);
    }
    this.filterMarkers();
  }

  updateFilterTag(tag: string) {
    if (this.filterTag.has(tag)) {
      this.filterTag.delete(tag);
    } else {
      this.filterTag.add(tag);
    }
    this.filterMarkers();
  }

  filterMarkers() {
    if (!this.hasFilter()) {
      this.filteredMarkers = this.markers;
      return;
    }
    const tagSetToArray = [...this.filterTag];
    const keyword = this.filterText.toLowerCase();
    this.filteredMarkers = this.markers.filter(
      (marker) =>
        (!this.filterText || marker.spot.name.toLowerCase().includes(keyword)) &&
        (this.filterCategory.size === 0 || this.filterCategory.has(marker.spot.category)) &&
        (this.filterIcon.size === 0 || this.filterIcon.has(marker.spot.icon)) &&
        (this.filterTag.size === 0 || tagSetToArray.every((tag) => marker.spot.tags.includes(tag)))
    );
  }

  clearFilter() {
    this.filterText = '';
    this.filterCategory.clear();
    this.filterIcon.clear();
    this.filterTag.clear();
    this.filterMarkers();
  }

  hasFilter(): boolean {
    return (
      !!this.filterText ||
      !!this.filterCategory.size ||
      !!this.filterIcon.size ||
      !!this.filterTag.size
    );
  }
}
