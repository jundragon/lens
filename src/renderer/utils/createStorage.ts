// Helper for better work with web-storage api (e.g. window.localStorage)
import { observable, toJS } from "mobx"
import { Draft, produce } from "immer"

export function createStorage<T>(key: string, defaultValue?: T, options?: IStorageHelperOptions<T>) {
  return new StorageHelper(key, defaultValue, options);
}

export interface IStorageHelperOptions<T = any> {
  autoInit?: boolean; // default: true, preload data at early stage (in place of use)
  observable?: boolean; // default: true, make state observable (keeps copy in memory)
  webStorage?: "local" | "session" | false; // type of web-storage for persistence, "false" - skip saving
  preload?(instance: StorageHelper<T>): T | Promise<T>; // customize initial data loading from the storage
}

export class StorageHelper<T> {
  static defaultOptions: IStorageHelperOptions = {
    autoInit: true,
    observable: true,
    webStorage: "local",
    preload: instance => instance.getStorageValue(),
  };

  @observable.shallow protected value: T;
  protected options: IStorageHelperOptions;
  protected initialized = false;

  constructor(readonly key: string, readonly defaultValue?: T, options: IStorageHelperOptions = {}) {
    this.options = { ...StorageHelper.defaultOptions, ...options };

    if (this.options.autoInit) {
      this.init();
    }
  }

  async init() {
    if (this.initialized) return;
    try {
      const preload = this.options.preload(this);
      let initialValue: T = preload instanceof Promise ? await preload : preload;
      this.set(initialValue);
      this.initialized = true;
    } catch (error) {
    }
  }

  protected get storage(): Storage | null {
    switch (this.options.webStorage) {
      case "local":
        return window.localStorage;
      case "session":
        return window.sessionStorage;
    }
  }

  getObservableValue(): T {
    return toJS(this.value);
  }

  getStorageValue(): T {
    const rawValue = this.storage?.getItem(this.key);

    if (typeof rawValue === "string") {
      try {
        return JSON.parse(rawValue);
      } catch (e) {
      }
    }

    return this.defaultValue;
  }

  get(): T {
    if (this.options.observable) {
      return this.getObservableValue();
    }

    return this.getStorageValue();
  }

  set(value: T) {
    try {
      if (this.options.observable) this.value = value;
      this.storage?.setItem(this.key, JSON.stringify(value));
    } catch (error) {
    }
  }

  merge(updater: (draft: Draft<T>) => Partial<T> | void) {
    try {
      const currentValue = this.get();
      const nextValue = produce(currentValue, updater) as T;
      this.set(nextValue);
    } catch (error) {
    }
  }

  clear() {
    this.storage?.removeItem(this.key);
    delete this.value;
  }
}
