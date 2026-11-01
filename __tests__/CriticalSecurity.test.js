jest.mock('@react-native-async-storage/async-storage',()=>({getItem:jest.fn(),setItem:jest.fn()}));
jest.mock('@react-native-community/netinfo',()=>({fetch:jest.fn(async()=>({isConnected:true}))}));
jest.mock('@notifee/react-native',()=>({__esModule:true,default:{},AndroidImportance:{HIGH:4}}));
jest.mock('react-native-fs',()=>({CachesDirectoryPath:'/cache',downloadFile:jest.fn(),unlink:jest.fn(async()=>{}),stat:jest.fn(),readFile:jest.fn()}));
jest.mock('react-native-share',()=>({open:jest.fn()}));
import AsyncStorage from '@react-native-async-storage/async-storage';
import RNFS from 'react-native-fs';
import {fileSource,downloadPrivateFile} from '../views/library/PrivateFiles';
import NotificationService from '../views/library/NotificationService';
const {addNotification,canReceiveMessage,getNotifications}=NotificationService;
import TrackDB from '../views/library/TrackDB';
import PlacemarkDB from '../views/library/PlacemarkDB';
let storage;
beforeEach(()=>{jest.clearAllMocks();storage={TOKEN:'token-a',PROFILE:JSON.stringify({id:'a',profile:{status:2}})};AsyncStorage.getItem.mockImplementation(async key=>storage[key]||null);AsyncStorage.setItem.mockImplementation(async(key,value)=>{storage[key]=value;});global.fetch=jest.fn();});
test('header token hanya untuk uploads server aktif, bukan domain atau path lain',()=>{
 expect(fileSource('https://fixture.invalid/uploads/a.pdf','https://fixture.invalid/','token').headers.Authorization).toBe('Bearer token');
 for(const uri of ['https://evil.invalid/uploads/a.pdf','https://fixture.invalid.evil/uploads/a.pdf','https://fixture.invalid/other'])expect(fileSource(uri,'https://fixture.invalid','token').headers).toBeUndefined();
});
test('download gagal dan pergantian akun menghapus cache sementara',async()=>{
 RNFS.downloadFile.mockReturnValueOnce({promise:Promise.resolve({statusCode:403})});
 await expect(downloadPrivateFile('https://fixture.invalid/uploads/a.pdf','https://fixture.invalid','token-a')).rejects.toThrow();
 expect(RNFS.unlink).toHaveBeenCalledTimes(1);
 RNFS.downloadFile.mockReturnValueOnce({promise:Promise.resolve({statusCode:200})});storage.TOKEN='token-b';
 await expect(downloadPrivateFile('https://fixture.invalid/uploads/a.pdf','https://fixture.invalid','token-a')).rejects.toThrow('Sesi berubah');
 expect(RNFS.unlink).toHaveBeenCalledTimes(2);
});
test('pesan privat akun lain ditolak, cache dipisah per akun',async()=>{
 expect(await canReceiveMessage({data:{recipientId:'b'}})).toBe(false);
 expect(await canReceiveMessage({data:{recipientId:'admin'}})).toBe(false);
 expect(await addNotification({body:'rahasia b',data:{recipientId:'b'}})).toBeNull();
 await addNotification({body:'milik a',data:{recipientId:'a'}});
 storage.PROFILE=JSON.stringify({id:'b',profile:{status:2}});storage.TOKEN='token-b';
 expect(await getNotifications()).toEqual([]);
 expect(JSON.parse(storage['NOTIFICATIONS_LIST:a'])[0].body).toBe('milik a');
});
for(const [name,db,key] of [['trek',TrackDB,'TRACK_HISTORY_a'],['placemark',PlacemarkDB,'PLACEMARK_LIST_a']]){
 test(`${name}: konflik server tidak menghapus data atau melaporkan sukses`,async()=>{
 storage[key]=JSON.stringify([{id:'local',userId:'a'}]);const original=storage[key];
 fetch.mockResolvedValue({ok:false,status:409});
 expect((await db.syncWithServer('a','token-a','https://fixture.invalid/')).success).toBe(false);
 expect(storage[key]).toBe(original);expect(fetch).toHaveBeenCalledTimes(1);
 });
 test(`${name}: batch 101 item dibagi dengan aman dan data tetap lengkap`,async()=>{
 storage[key]=JSON.stringify(Array.from({length:101},(_,i)=>({id:String(i),userId:'a'})));
 fetch.mockImplementation(async(url,opts)=>({ok:true,json:async()=>({success:true,data:[]})}));
 expect((await db.syncWithServer('a','token-a','https://fixture.invalid/')).success).toBe(true);
 const sizes=fetch.mock.calls.filter(([url])=>url.endsWith('/sync')).map(([,opts])=>Object.values(JSON.parse(opts.body))[0].length);
 expect(sizes).toEqual([50,50,1]);expect(JSON.parse(storage[key])).toHaveLength(101);
 });
}
