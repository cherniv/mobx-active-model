import { set, observable, isObservableProp, isComputedProp } from "mobx";
import Api from 'axios';
var Storage; // should be ReactNative' AsyncStorage

const _copy = (obj1, obj2) => {
  if (!obj2 || !Object.keys(obj2).length) return;
  for (var key in obj2) {
    //set(obj1, key, obj2[key]);
    obj1[key] = obj2[key];
  }
}

export default class Model {

  id;

  static get first () {
    const {all} = this.prototype.constructor;
    return all && all[0];
  }

  // Model.all is getter
  static get all () {
    const {constructor} = this.prototype;
    // define its array on earliest stage
    // even before its populate() happens
    constructor._all = constructor._all || observable([])
    return constructor._all;
  }

  constructor(obj) {
    _copy(this, obj);
  }
  
  update = function(obj) {
    _copy(this, obj);
    this.save();
  }

  async save () {

    const {REMOTE_PATH, all} = this.constructor;

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
        this.id = (new Date()).getTime();
        all.push( this );
      }
    }
    
    this.cacheOnLocal();

    if (this._afterSave) this._afterSave();
    
    return this;
  }

  cacheOnLocal() {
    this.constructor.cacheOnLocal();
  }

  destroy () {
    this.constructor.all.remove(
      this.constructor.all.find(i => i.id == this.id)
    );
    this.cacheOnLocal();

    // "DELETE" call to backend api
    if (this.constructor.REMOTE_PATH)
      Api.delete(this.constructor.REMOTE_PATH + '' + this.id)
    
  }
}

Model.setStorage = function(_Storage) {
  Storage = _Storage;
}

/**
 * @return new instance without id 
 */
Model.new = function(obj) {
  // this.prototype.constructor is the trick
  return new this.prototype.constructor(obj);
}

/**
 * @return new instance with id (async (use with await))
 */
Model.create = async function(obj) {
  var instance = this.new(obj);
  await instance.save();
  return instance;
}

/**
 * Populate from local cache
 */
Model.fetchFromCache = async function() {
  var data = await Storage.getItem(this.LOCAL_PATH);
  data = data ? JSON.parse(data) : [];
  this.populate(data)
}

Model.fetchFromRemote = async function() {
  try {
  var {data} = await Api.get(this.REMOTE_PATH);
  //data = data ? JSON.parse(data) : [];
  this.populate(data)
  } catch (e) {
    console.warn('Model.fetchFromRemote failed', e);
  }
}

Model.fetchFromRemoteAsync = function() {
  Api.get(this.REMOTE_PATH).then(response => {
    var {data} = response;
    this.populate(data)
  })
}

Model.populate = function(data = [], opts = {}) {
  const {merge} = opts;
  var oldData = this.prototype.constructor.all.slice();
  var newData = data.map(med => this.new(med));
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

Model.cacheOnLocal = async function() {
  if (!this.LOCAL_PATH) {
    console.log('Model has no LOCAL_PATH for cacheOnLocal!');
    return;
  }
  Storage.setItem(
    this.LOCAL_PATH, 
    JSON.stringify(this.prototype.constructor.all)
  )
}

Model.find = function (id) {
  try {
    return this.prototype.constructor.all.find(m => m.id == id);
  } catch (e) {
    console.log('Model.find failed:', id, this.prototype.constructor.all);
    return null;
  }
}
