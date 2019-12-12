import BaseModel from './Model';

export default class Model extends BaseModel {
  static _Firebase?: any;
  static get Firebase() {
    const constructor = this.prototype.constructor as typeof Model;
    return constructor._Firebase;
  }
  static set Firebase(_Firebase: any) {
    const constructor = this.prototype.constructor as typeof Model;
    constructor._Firebase = _Firebase;
  }
  constructor(obj: any = null) {
    super(obj);
    const { Firebase } = this.constructor as typeof Model;
    if (Firebase) {
      this.listenForRemoteChangesForInstance();
    } else {
      console.log('No Firebase instance is set');
    }
  }

  listenForRemoteChangesForInstance() {
    const { constructor } = Object.getPrototypeOf(this);
    const path = constructor.REMOTE_PATH + this.id;
    const { Firebase } = this.constructor as typeof Model;
    Firebase.firestore()
      .doc(path)
      .onSnapshot((snapshot: any) => this._updateInstance(this, snapshot));
  }

  _updateInstance(instance: any, snapshot: any) {
    var data = snapshot.data();
    Object.assign(instance, data);
  }
}
