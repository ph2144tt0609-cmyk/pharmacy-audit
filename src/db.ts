import Dexie, { type EntityTable } from 'dexie';

export interface Item {
  id: string;
  drugName?: string;
  gs1Raw?: string;
  gtin?: string;
  lot?: string;
  expiry?: string;
  serial?: string;
  grams?: string;
  weighPhoto?: Blob;
  weighPhotoMime?: string;
}

export interface Prescription {
  id?: number;
  number: string;
  operator: string;
  createdAt: Date;
  items: Item[];
}

class PharmacyDB extends Dexie {
  prescriptions!: EntityTable<Prescription, 'id'>;

  constructor() {
    super('PharmacyAudit');
    this.version(1).stores({
      prescriptions: '++id, createdAt, number',
    });
  }
}

export const db = new PharmacyDB();
