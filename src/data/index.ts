export {
  APP_STORAGE_KEY,
  createTaskDataAccess,
  DuplicateTaskIdError,
  InvalidTaskError,
  LocalStorageUnavailableError,
  STORAGE_DATA_FORMAT_VERSION,
  StorageDataCorruptedError,
  StorageQuotaExceededError,
  StorageReadError,
  StorageVersionIncompatibleError,
  StorageWriteError,
  TaskDataAccessError,
  TaskNotFoundError,
} from './taskDataAccess'

export type {
  AppDataSnapshot,
  StorageLike,
  TaskDataAccess,
  TaskDataAccessDependencies,
  TaskDataAccessErrorCode,
} from './taskDataAccess'
