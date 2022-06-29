<h1 align="center">
  <img src="src/assets/favicon.svg" width="60px" height="60px" align="center">
  Berbermap
  <h4 align="center" style="font-size: 16px; color: #888">
    Save and organize your personal places
  </h4>
  <h4 align="center" style="font-size: 16px; font-weight: normal">
    <a href="https://berbermap.netlify.app">https://berbermap.netlify.app</a>
  </h4>
</h1>

<p align="center">
  <img src="screenshots/screenshot-mobile-map.png" width="40%">
  <img src="screenshots/screenshot-mobile-spot-detail.png" width="40%">
  <img src="screenshots/screenshot-mobile-list-view.png" width="40%">
  <img src="screenshots/screenshot-mobile-list-filter.png" width="40%">
</p>

## Features

- Login / sign up.
- Add and save markers to the map.
  - Add name, descriptions, select category and icons, and add custom tags.
  - Upload photos, set photos sort orders.
  - Edit / delete saved markers.
- Show current device location on map, and center map to current location.
- View saved markers in list view.
  - Search and filter by name, category, icon, or tags.
  - Click to pan the map to the marker.
- Responsive, works on both desktop browsers and mobile phones.

## Built with

- TypeScript (frontend language)
- Angular (frontend framework)
  - Angular Material (UI library)
- Google Maps API
  - Embedded Maps Component (for embedded map and markers)
  - Google Places API Autocomplete (for searching places autocomplete)
- Firebase
  - Auth (login / sign up)
  - Firestore (primary database, stores user data)
  - Storage (storing user-uploaded images)
  - Cloud Functions (server-side operations such as batched DB operations and optimizing images)
- Sass (CSS preprocessor)
- Netlify
  - CDN hosting (hosting all frontend static assets)
  - CD (automatically builds and deploys on every git push)
- Circle CI
  - firebase security rules unit tests (automatically runs unit tests on every git push)
  - deploys firebase security rules (automatically deploys to firebase on every git push)

## Development

<a href="https://app.netlify.com/sites/berbermap/deploys"><img src="https://api.netlify.com/api/v1/badges/5808e45a-5f56-4670-99c3-7d9f84859ffd/deploy-status" alt="Deploy Status"></a>
<a href="https://circleci.com/gh/ooxxro/berbermap/tree/main"><img src="https://img.shields.io/circleci/project/github/ooxxro/berbermap/main.svg?sanitize=true" alt="Test Status"></a>

This project was generated with [Angular CLI](https://github.com/angular/angular-cli) version 13.3.1.

### Development server

Run `ng serve` for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

### Code scaffolding

Run `ng generate component component-name` to generate a new component. You can also use `ng generate directive|pipe|service|class|guard|interface|enum|module`.

### Build

Run `ng build` to build the project. The build artifacts will be stored in the `dist/` directory.

### Running unit tests

Run `ng test` to execute the unit tests via [Karma](https://karma-runner.github.io).

### Running end-to-end tests

Run `ng e2e` to execute the end-to-end tests via a platform of your choice. To use this command, you need to first add a package that implements end-to-end testing capabilities.

### Further help

To get more help on the Angular CLI use `ng help` or go check out the [Angular CLI Overview and Command Reference](https://angular.io/cli) page.
