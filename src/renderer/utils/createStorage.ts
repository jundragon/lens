// Helper for work with storage api (e.g. window.localStorage)

import { observable, toJS } from "mobx"
import { Draft, produce } from "immer"

export function createStorage<T>(key: string, defaultValue?: T, options?: IStorageHelperOptions<T>) {
  return new StorageHelper(key, defaultValue, options);
}

export interface IStorageHelperOptions<T = any> {
  autoInit?: boolean; // default: true, preload data at early stages (e.g. in place of use)
  observable?: boolean; // default: true, keeps observable state in memory
  webStorage?: "local" | "session" | false; // type of web-storage for persistence, "false" - skip saving to storage.
  preload?(instance: StorageHelper<T>): T | Promise<T>; // customize data loading
}

export class StorageHelper<T> {
  static defaultOptions: IStorageHelperOptions = {
    webStorage: "local",
    autoInit: true,
    observable: true,
    preload: instance => instance.getStorageValue(),
  };

  @observable.shallow protected data: T;
  protected initialized = false;
  protected options: IStorageHelperOptions;

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
      return this.data;
    }

    return this.getStorageValue();
  }

  set(value: T) {
    try {
      this.storage?.setItem(this.key, JSON.stringify(value));
      if (this.options.observable) {
        this.data = value;
      }
    } catch (error) {
    }
  }

  merge(updater: (draft: Draft<T>) => Partial<T> | void) {
    try {
      const currentValue = toJS(this.get());
      const nextValue = produce(currentValue, updater) as T;
      this.set(nextValue);
    } catch (error) {
    }
  }

  clear() {
    this.data = null;
    this.storage?.removeItem(this.key);
  }
}
