/**
 * Local storage abstraction using IndexedDB (idb-keyval)
 * to persist large CSV datasets securely in the browser.
 */
import * as idb from 'idb-keyval';
import { v4 as uuidv4 } from 'uuid';

export interface CsvFile {
  id: string;
  name: string;
  data: Record<string, any>[];
  columns: { field: string; headerName: string }[];
  lastModified: number;
  isDirty?: boolean;
  fileHandle?: any;
}

export interface AppState {
  files: CsvFile[];
  activeFileId: string | null;
}

const STORAGE_KEY = 'swiftcsv_state';

const defaultState: AppState = {
  files: [],
  activeFileId: null,
};

export const saveState = async (state: AppState) => {
  await idb.set(STORAGE_KEY, state);
};

export const loadState = async (): Promise<AppState> => {
  try {
    const state = await idb.get<AppState>(STORAGE_KEY);
    return state || defaultState;
  } catch (e) {
    console.error("Failed to load state from idb", e);
    return defaultState;
  }
};

export const createNewFile = (name: string, data: any[], columns: any[]): CsvFile => {
  return {
    id: uuidv4(),
    name,
    data,
    columns,
    lastModified: Date.now(),
  };
};
