import { set, observable, isObservableProp, isComputedProp } from 'mobx';

const _copy = (obj1: any, obj2: any) => {
  if (!obj2 || !Object.keys(obj2).length) return;
  for (var key in obj2) {
    //set(obj1, key, obj2[key]);
    if (!isComputedProp(obj1, key)) {
      obj1[key] = obj2[key];
    }
  }
};

export default class Model {
  static REMOTE_PATH?: string;
  static LOCAL_PATH?: string;
  static _all?: any;

  id?: string;

  _afterSave?: Function;

  static _Api?: any;
  static get Api() {
    const constructor = this.prototype.constructor as typeof Model;
    return constructor._Api;
  }
  static set Api(_Api: any) {
    const constructor = this.prototype.constructor as typeof Model;
    constructor._Api = _Api;
  }
  static _Storage?: any;
  static get Storage() {
    const constructor = this.prototype.constructor as typeof Model;
    return constructor._Storage;
  }
  static set Storage(_Storage: any) {
    const constructor = this.prototype.constructor as typeof Model;
    constructor._Storage = _Storage;
  }

  // Model.all is getter
  static get all() {
    const constructor = this.prototype.constructor as typeof Model;
    // define its array on earliest stage
    // even before its populate() happens
    constructor._all = constructor._all || observable([]);
    return constructor._all;
  }

  static cacheOnLocal = async function() {
    if (!this.LOCAL_PATH) {
      console.log('Model has no LOCAL_PATH for cacheOnLocal!');
      return;
    }
    const { Storage, LOCAL_PATH } = this;
    Storage.setItem(LOCAL_PATH, JSON.stringify(this.prototype.constructor.all));
  };

  /**
   * @return new instance without id
   */
  static new = function(obj: any = null) {
    // this.prototype.constructor is the trick
    return new this.prototype.constructor(obj);
  };

  static get first() {
    const constructor = this.prototype.constructor as typeof Model;
    const { all } = constructor;
    return all && !!all.length && all[0];
  }

  /**
   * @return new instance with id (async (use with await))
   */
  static create = async function(obj: any = null) {
    var instance = this.new(obj);
    await instance.save();
    return instance;
  };

  /**
   * Populate from local cache
   */
  static fetchFromCache = async function() {
    const { Storage, LOCAL_PATH } = this;
    var data = await Storage.getItem(LOCAL_PATH);

    data = data ? JSON.parse(data) : [];
    this.populate(data);
  };

  /**
   * fetchFromRemote(null) calls Api.get('users/')
   * fetchFromRemote(id) calls Api.get('users/:id')
   * fetchFromRemote([id1,id2,...]) calls Api.get('users/:id1,:id2') => firestore.collection.where(documentId(),'in',ids)
   * fetchFromRemote(query) calls Api.post(':runQuery')
   */
  static fetchFromRemote = async function(query: any = null, autoMerge: boolean = true) {
    const { Api, REMOTE_PATH } = this;
    var id;
    var to: string = typeof query;
    if (to == 'number' || to == 'string' || Array.isArray(query)) id = query;
    try {
      var _data;
      if (!query || id) {
        var { data } = await Api.get(REMOTE_PATH + (id || ''));
        if (!Array.isArray(data)) data = [data];
        _data = data;
      } else if (!id && query) {
        var { data } = await Api.post(':runQuery', query);
        _data = data;
      }
      autoMerge && this.merge(_data);
      return _data;
    } catch (e) {
      console.warn('Model.fetchFromRemote failed', e);
    }
  };

  static populate = function(data: any = [], opts: any = {}) {
    var newData = this.convert(data);
    var newAll = newData;
    this.prototype.constructor.all.replace(newAll);
  };

  /**
   * updating items instead of overwriting them
   * otherwise references created by fetchFromCache are lost
   * */

  static merge = function(data: any = [], opts: any = {}) {
    const { mergeProp = 'id' } = opts;
    var oldData = this.prototype.constructor.all.slice();
    var newData = this.convert(data);
    var newAll;
    newAll = oldData;
    newData.forEach((newItem: any) => {
      var oldItem = oldData.find((oldItem: any) => {
        return oldItem[mergeProp] == newItem[mergeProp];
      });
      if (oldItem) {
        _copy(oldItem, newItem);
      } else {
        newAll.push(newItem);
      }
    });
    this.prototype.constructor.all.replace(newAll);
  };

  static convert = function(data: any = []) {
    return data.map((item: any) => this.new(item));
  };

  static populateAndCacheOnLocal = function(data: any = [], opts: any = {}) {
    this.populate(data, opts);
    this.cacheOnLocal();
  };

  static find = function(id: string) {
    try {
      return this.prototype.constructor.all.find((item: Model) => item.id == id);
    } catch (e) {
      console.log('Model.find failed:', id);
      return null;
    }
  };

  constructor(obj: any) {
    _copy(this, obj);
  }

  update = function(obj: any) {
    _copy(this, obj);
    this.save();
  };

  async save() {
    const constructor = this.constructor as typeof Model;
    const { REMOTE_PATH, all, Api } = constructor;

    if (REMOTE_PATH) {
      // taking only observable attributes, no methods etc
      var keys = Object.keys(this).filter(key => isObservableProp(this, key) && !isComputedProp(this, key));
      var obj = {};
      keys.forEach(key => (obj[key] = this[key]));

      if (!this.id) {
        // "POST" call to backend api , getting ID from API
        var response = await Api.post(REMOTE_PATH, obj);
        _copy(this, response.data);

        all.push(this);
      } else {
        // "PUT" call to backend api
        await Api.put(REMOTE_PATH + '' + this.id, obj);

        if (!constructor.find(this.id)) all.push(this);
      }
    } else {
      if (!this.id) {
        this.id = '' + new Date().getTime();
        all.push(this);
      }
    }

    this.cacheOnLocal();

    if (this._afterSave) this._afterSave();

    return this;
  }

  cacheOnLocal() {
    (this.constructor as typeof Model).cacheOnLocal();
  }

  destroy() {
    const constructor = this.constructor as typeof Model;
    const { all, REMOTE_PATH, Api } = constructor;
    all.remove(all.find((item: any) => item.id == this.id));
    this.cacheOnLocal();

    // "DELETE" call to backend api
    if (REMOTE_PATH) Api.delete(REMOTE_PATH + '' + this.id);
  }
}
