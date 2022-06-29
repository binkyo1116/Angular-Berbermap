import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';
import { execSync } from 'child_process';
import { createRequire } from 'module'; // Bring in the ability to create the 'require' method
import { fileURLToPath } from 'url';
import { dirname } from 'path';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const require = createRequire(import.meta.url); // construct the require method
const serviceAccount = require('./berbermap-firebase-adminsdk.json');

function backupFirestoreToJson() {
  // https://stackoverflow.com/a/62718371/12017013
  // First dump the whole Firestore into a json as a backup (gitignored).
  execSync(
    `../node_modules/.bin/firestore-export --accountCredentials ./berbermap-firebase-adminsdk.json --backupFile ./firestore-backup-${new Date().toISOString()}.json`,
    {
      cwd: __dirname,
      stdio: 'inherit', // Still print to console.
    }
  );
}
backupFirestoreToJson();

const app = initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore(app);
const storage = getStorage(app).bucket('gs://berbermap.appspot.com');

// const collections = await db.listCollections();
// if (collections.length !== 1 && collections[0].id !== 'users') {
//   console.warn('There should be only 1 root collection but found many:');
//   for (const collection of collections) {
//     console.warn(collection.id);
//   }
// } else {
//   console.info('✅ root collection OK');
// }

async function checkUsers() {
  const users = await db.collection('users').listDocuments();
  for (const userRef of users) {
    console.log(`checking "users/${userRef.id}`);

    // users/<uid> should only contain collections, not documents.
    const userSnapshot = await userRef.get();
    const user = userSnapshot.data();
    if (user) {
      console.warn(`users/${userRef.id} should be empty, but it contains some documents:`, user);
    }

    const userCollections = await userRef.listCollections();
    const allowedUserCollections = new Set(['spots', 'tags']);
    const unknownUserCollections = userCollections.filter((c) => !allowedUserCollections.has(c.id));
    if (userCollections.length !== 2 || unknownUserCollections.length) {
      console.warn(
        `Found unknown collection in users/${userRef.id}/`,
        unknownUserCollections.map((c) => c.id).join(', ')
      );
    }

    // Check Spots.
    checkSpots(userRef);
  }
}

async function checkSpots(userRef) {
  const spotsSnapshot = await userRef.collection('spots').get();
  console.log('found', spotsSnapshot.docs.length, 'spots');
  for (const spotSnapshot of spotsSnapshot.docs) {
    const spot = spotSnapshot.data();
    let needUpdate = false;
    let safe = true;
    const urlMap = new Map();
    for (const image of spot.images) {
      if (typeof image === 'string') {
        console.log(
          'found legacy format for image: string, converting to {url:string,storagePath:string}'
        );
        needUpdate = true;
        // https://firebasestorage.googleapis.com/v0/b/berbermap.appspot.com/o/users%2FoFziFBunvAh3OsZTDAROFEU0Xse2%2Fspots%2FChIJ2dQVnHexj4ARXlmGG7n0BsQ%2F5204236.png?alt=media&token=0b601aae-d70d-4511-a92c-aa57169b2fe9
        const prefix = 'https://firebasestorage.googleapis.com/v0/b/berbermap.appspot.com/o/';
        const queryParam = '?alt=media&token=';
        if (!image.startsWith(prefix) || !image.includes(queryParam)) {
          console.error('dont know how to convert this image URL', image);
          safe = false;
          continue;
        }
        const storagePath = image
          .substring(prefix.length, image.indexOf(queryParam))
          .replaceAll('%2F', '/');
        console.log('converting to storagePath:', storagePath);
        if (
          !storagePath.startsWith(`users/${userRef.id}/spots/`) &&
          !storagePath.endsWith('.png')
        ) {
          console.error('ERROR! The converted storagePath is probably wrong!');
          safe = false;
          continue;
        }
        urlMap.set(image, storagePath);
      }
    }
    if (needUpdate && !safe) {
      console.warn("didn't update the DB because it's not safe");
    } else if (needUpdate && safe) {
      console.warn(`Updating DB: ${spotSnapshot.ref.path}...`);
      const images = spot.images.map((image) => {
        if (typeof image === 'string' && urlMap.has(image)) {
          return {
            url: image,
            storagePath: urlMap.get(image),
          };
        }
        return image;
      });
      await spotSnapshot.ref.update({ images });
    }
  }
}

// Check if all images in storage has metadata cache-control set
const CACHE_CONTROL = 'public,max-age=315360000'; // 10 Years.
async function checkStorageMetadata() {
  const [files] = await storage.getFiles();
  console.log(`Found ${files.length} files.`);
  for (const file of files) {
    if (file.metadata.cacheControl !== CACHE_CONTROL) {
      console.warn('found file with wrong cacheControl!', file.name);
      await file.setMetadata({ cacheControl: CACHE_CONTROL });
    }
  }
}
// checkStorageMetadata();
