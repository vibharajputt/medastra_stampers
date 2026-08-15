const DB_NAME = 'mediverse_offline_db';
const DB_VERSION = 1;

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('care_plans')) {
        db.createObjectStore('care_plans', { keyPath: 'id' });
      }
    };
  });
}

export const indexedDbHelper = {
  async saveCarePlan(carePlan) {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['care_plans'], 'readwrite');
        const store = transaction.objectStore('care_plans');
        
        // Save using a static key 'patient_care_plan'
        const request = store.put({ id: 'patient_care_plan', data: carePlan, updatedAt: Date.now() });

        request.onsuccess = () => {
          resolve(true);
        };

        request.onerror = (e) => {
          reject(e.target.error);
        };
      });
    } catch (err) {
      console.error('Failed to save care plan in IndexedDB', err);
      return false;
    }
  },

  async getCarePlan() {
    try {
      const db = await openDB();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(['care_plans'], 'readonly');
        const store = transaction.objectStore('care_plans');
        const request = store.get('patient_care_plan');

        request.onsuccess = (event) => {
          const result = event.target.result;
          resolve(result ? result.data : null);
        };

        request.onerror = (e) => {
          reject(e.target.error);
        };
      });
    } catch (err) {
      console.error('Failed to read care plan from IndexedDB', err);
      return null;
    }
  }
};
