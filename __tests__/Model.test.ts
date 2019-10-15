import Model, {setApiVendor, setStorageVendor} from '../src/Model';

const AsyncStorage = {
  removeItem: jest.fn(),
  setItem: jest.fn(),
  getItem: async () => '[{"id":"100"}]',
}

const HttpClient = {
  get: jest.fn(),
  post: jest.fn(() => ({data:{id:"200"}})),
  put: jest.fn(),
  delete: jest.fn(),
}

describe('Medication model', () => {
  beforeEach(() => {
    setApiVendor(HttpClient);
    setStorageVendor(AsyncStorage);
    Model.populate([])
    Model.LOCAL_PATH = 'models/'
    jest.clearAllMocks();
  });
  it('"New" method: Should create instance without id ', async () => {
    var med = Model.new();
    expect(med.id).toBeUndefined();
  })
  it('"Save" method: Should set id to instance created by "new", without REMOTE_PATH ', async () => {
    var med = Model.new();
    await med.save();
    expect(med.id).not.toBeUndefined();
  })
  it('"Create" method: Should create instance with id ', async () => {
    var med = await Model.create();
    expect(med.id).not.toBeUndefined();
  })

  it('Should pre populate', async () => {
    await Model.fetchFromCache();
    expect(Model.all.length).toBe(1)
    expect(Model.all[0].id).toBe("100");
  });
  it('Should auto save after adding new medication', async () => {
    var med = Model.new();
    await med.save();
    expect(Model.all.length).toBe(1);
    expect(AsyncStorage.setItem).toBeCalled();
  });
  it('Should destroy medication when calling remove method', async () => {
    var med = Model.new();
    med.save();
    med.destroy();
    expect(Model.all.length).toBe(0);
    expect(AsyncStorage.setItem).toBeCalled();
  })
  it('Should find medication by id', async () => {
    await Model.fetchFromCache();
    expect(Model.find('100')).toBeDefined()
  })
  it('Should get first medication by first() method', async () => {
    await Model.fetchFromCache();
    expect(Model.first.id).toBe('100')
  })
  it('"Save" method: Should set id to instance created by "new", with REMOTE_PATH  ', async () => {
    Model.REMOTE_PATH = 'models/'
    var med = Model.new();
    await med.save();
    expect(med.id).not.toBeUndefined();
  })
  it('"Populate" method with `merge` setting should not add new item if exists already in list', async () => {
    Model.populate([{id: 1}, {id: 2}]);
    Model.populate([{id: 2}, {id: 3}], {merge: true}); // will not add {id:2} again
    expect(Model.all.length).toBe(3);
  })
})