import BaseModel from "./Model";

var firebase: any;
export const setFirebaseInstance = function(_firebase: any) {
  firebase = _firebase;
};

export default class Model extends BaseModel {
  constructor(obj: any = null) {
    super(obj);
    this.listenForRemoteChanges();
    if (firebase) {
      this.listenForRemoteChanges();
    } else {
      console.log("No Firebase instance is set");
    }
  }

  listenForRemoteChanges() {
    const path = Object.getPrototypeOf(this).constructor.REMOTE_PATH + this.id;
    firebase
      .firestore()
      .doc(path)
      .onSnapshot((snapshot: any) => {
        var data = snapshot.data();
        Object.assign(this, data);
      });
  }
}
