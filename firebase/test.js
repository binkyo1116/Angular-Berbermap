const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require('@firebase/rules-unit-testing');
const fs = require('fs');
const { getDoc, doc, setDoc, addDoc, collection } = require('firebase/firestore');
const { getDownloadURL, ref, uploadBytes, deleteObject } = require('firebase/storage');

const myId = 'my-uid';
const theirId = 'their-uid';

describe('Firebase secuirty rules', () => {
  let testEnv;

  function getFirestore(uid) {
    let testContext;
    if (uid) {
      testContext = testEnv.authenticatedContext(uid);
    } else {
      testContext = testEnv.unauthenticatedContext();
    }
    return testContext.firestore();
  }

  function getStorage(uid) {
    let testContext;
    if (uid) {
      testContext = testEnv.authenticatedContext(uid);
    } else {
      testContext = testEnv.unauthenticatedContext();
    }
    return testContext.storage();
  }

  beforeEach(async () => {
    testEnv = await initializeTestEnvironment({
      projectId: 'berbermap',
      firestore: {
        rules: fs.readFileSync(`${__dirname}/firestore.rules`, 'utf8'),
      },
      storage: {
        rules: fs.readFileSync(`${__dirname}/storage.rules`, 'utf8'),
      },
    });
  });

  afterEach(() => {
    testEnv.clearFirestore();
    testEnv.clearStorage();
  });

  after(() => {
    testEnv.cleanup();
  });

  describe('Firestore', () => {
    it('Can read items in the read-only collection', async () => {
      const db = getFirestore();
      await assertSucceeds(getDoc(doc(db, '/readonly/testDoc')));
    });

    it("Can't write to items in the read-only collection", async () => {
      const db = getFirestore(myId);
      await assertFails(setDoc(doc(db, '/readonly/testDoc'), { foo: 'bar' }));
    });

    it('Can only write to users/<uid> document if uid matches', async () => {
      const db = getFirestore(myId);
      await assertSucceeds(setDoc(doc(db, `/users/${myId}/spots/123`), { foo: 'bar' }));
      await assertFails(setDoc(doc(db, `/users/${theirId}/spots/123`), { foo: 'bar' }));
    });

    it('Can only write to checkpoints/<uid> if uid matches', async () => {
      const db = getFirestore(myId);
      // checkpoints/<uid>/createOrEditSpot/<checkpointId>/<checkpointData>
      await assertSucceeds(
        addDoc(collection(db, `/checkpoints/${myId}/createOrEditSpot`), {
          placeId: 'xyz',
          timestamp: new Date(),
        })
      );
      await assertFails(
        addDoc(collection(db, `/checkpoints/${theirId}/createOrEditSpot`), {
          placeId: 'xyz',
          timestamp: new Date(),
        })
      );
    });
  });

  describe('Storage', () => {
    it('Can read all files', async () => {
      const storageLoggedIn = getStorage(myId);
      await assertSucceeds(
        uploadBytes(ref(storageLoggedIn, `/users/${myId}/spots/xyz/456.png`), new Uint8Array(), {
          contentType: 'image/png',
        })
      );
      const storageNotLoggedIn = getStorage();
      await assertSucceeds(
        getDownloadURL(ref(storageNotLoggedIn, `/users/${myId}/spots/xyz/456.png`))
      );
    });

    it('Can only write file to /<uid>/spots if uid matches', async () => {
      const storage = getStorage(myId);
      await assertSucceeds(
        uploadBytes(ref(storage, `/users/${myId}/spots/xyz/456.png`), new Uint8Array(), {
          contentType: 'image/png',
        })
      );
      await assertFails(
        uploadBytes(ref(storage, `/users/${theirId}/spots/xyz/456.png`), new Uint8Array(), {
          contentType: 'image/png',
        })
      );
    });

    it('Can only delete file to /<uid>/spots if uid matches', async () => {
      const storage = getStorage(myId);
      await assertSucceeds(deleteObject(ref(storage, `/users/${myId}/spots/xyz/456.png`)));
      await assertFails(deleteObject(ref(storage, `/users/${theirId}/spots/xyz/456.png`)));
    });

    it('Rejects if file size or type is wrong', async () => {
      const storage = getStorage(myId);
      await assertFails(
        uploadBytes(ref(storage, `/users/${myId}/spots/xyz/456.png`), new Uint8Array())
      );
      // Writes a 11MB image.
      await assertFails(
        uploadBytes(
          ref(storage, `/users/${myId}/spots/xyz/456.png`),
          new Uint8Array(11 * 1024 * 1024),
          {
            contentType: 'image/png',
          }
        )
      );
    });
  });
});
