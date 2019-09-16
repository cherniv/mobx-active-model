import { set, observable, isObservableProp, isComputedProp } from "mobx";
var Api:any; // should be axios
var Storage:any; // should be ReactNative' AsyncStorage

const _copy = (obj1:any, obj2:any) => {
  if (!obj2 || !Object.keys(obj2).length) return;
  for (var key in obj2) {
    //set(obj1, key, obj2[key]);
    obj1[key] = obj2[key];
  }
}

export const setApiVendor = function(_Api:any) {
  Api = _Api;
}

export const setStorageVendor = function(_Storage:any) {
  Storage = _Storage;
}

export default class Model {

  static REMOTE_PATH?:string;
  static LOCAL_PATH?:string;
  static _all?:any;

  id?:string;

  _afterSave?:Function;

  // Model.all is getter
  static get all () {
    const constructor = (this.prototype.constructor as typeof Model);
    // define its array on earliest stage
    // even before its populate() happens
    constructor._all = constructor._all || observable([])
    return constructor._all;
  }

  static cacheOnLocal = async function() {
    if (!this.LOCAL_PATH) {
      console.log('Model has no LOCAL_PATH for cacheOnLocal!');
      return;
    }
    Storage.setItem(
      this.LOCAL_PATH, 
      JSON.stringify(this.prototype.constructor.all)
    )
  }

  /**
   * @return new instance without id 
   */
  static new = function(obj:any = null) {
    // this.prototype.constructor is the trick
    return new this.prototype.constructor(obj);
  }

  static get first () {
    const constructor = (this.prototype.constructor as typeof Model);
    const {all} = constructor;
    return all && all[0];
  }

  /**
  * @return new instance with id (async (use with await))
  */
  static create = async function(obj:any = null) {
    var instance = this.new(obj);
    await instance.save();
    return instance;
  }

  /**
   * Populate from local cache
   */
  static fetchFromCache = async function() {
    var data = await Storage.getItem(this.LOCAL_PATH);
    
    data = data ? JSON.parse(data) : [];
    this.populate(data)
  }

  static fetchFromRemote = async function() {
    try {
    var {data} = await Api.get(this.REMOTE_PATH);
    //data = data ? JSON.parse(data) : [];
    this.populate(data)
    } catch (e) {
      console.warn('Model.fetchFromRemote failed', e);
    }
  }

  static fetchFromRemoteAsync = function() {
    Api.get(this.REMOTE_PATH).then((response:any) => {
      var {data} = response;
      this.populate(data)
    })
  }

  static populate = function(data:any = [], opts:any = {}) {
    const {merge} = opts;
    var oldData = this.prototype.constructor.all.slice();
    var newData = data.map((item:any) => this.new(item));
    var newAll;
    if (!merge) {
      newAll = newData;
    } else {
      newAll = oldData.concat(newData);
    }

    this.prototype.constructor.all.replace(
      newAll
    );
  }


  static find = function (id:string) {
    try {
      return this.prototype.constructor.all.find((item:Model) => item.id == id);
    } catch (e) {
      console.log('Model.find failed:', id, this.prototype.constructor.all);
      return null;
    }
  }


  constructor(obj:any) {
    _copy(this, obj);
  }
  
  update = function(obj:any) {
    _copy(this, obj);
    this.save();
  }

  async save () {

    const {REMOTE_PATH, all} = (this.constructor as typeof Model);

    if (REMOTE_PATH) {

      // taking only observable attributes, no methods etc
      var keys = Object.keys(this).filter(key => isObservableProp(this, key) && !isComputedProp(this, key));
      var obj = {}
      keys.forEach(key => obj[key] = this[key]);

      if (!this.id) {
        // "POST" call to backend api , getting ID from API
        var response = await Api.post(
          REMOTE_PATH,
          obj
        )
        _copy(this, response.data);
        
        all.push( this );
      } else {
        // "PUT" call to backend api
        await Api.put(
          REMOTE_PATH + '' + this.id,
          obj
        )
      }
    } else {
      if (!this.id) {
        this.id = ''+(new Date()).getTime();
        all.push( this );
      }
    }
    
    this.cacheOnLocal();

    if (this._afterSave) this._afterSave();
    
    return this;
  }

  cacheOnLocal() {
    (this.constructor as typeof Model).cacheOnLocal();
  }

  destroy () {
    const constructor = (this.constructor as typeof Model);
    constructor.all.remove(
      constructor.all.find((item:any) => item.id == this.id)
    );
    this.cacheOnLocal();

    // "DELETE" call to backend api
    if (constructor.REMOTE_PATH)
      Api.delete(constructor.REMOTE_PATH + '' + this.id)
    
  }
}
