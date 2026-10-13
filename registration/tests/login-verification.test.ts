import {describe,it,expect,vi,beforeEach} from 'vitest';
const mocks=vi.hoisted(()=>({limit:vi.fn(),rpc:vi.fn(),eq:vi.fn(),like:vi.fn(),select:vi.fn(),from:vi.fn()}));
vi.mock('@supabase/supabase-js',()=>({createClient:()=>({from:mocks.from,rpc:mocks.rpc})}));
import {supabaseStore} from '../src/lib/supabase-store';
import {createDemoStore} from '../src/lib/demo-store';
beforeEach(()=>{vi.clearAllMocks();mocks.from.mockReturnValue({select:mocks.select});mocks.select.mockReturnValue({eq:mocks.eq});mocks.eq.mockReturnValue({like:mocks.like});mocks.like.mockReturnValue({limit:mocks.limit});mocks.rpc.mockResolvedValue({data:null,error:null})});
describe('server suffix verification',()=>{
 it('does not create a session for absent, invalid, wrong or ambiguous suffixes',async()=>{
  const store=supabaseStore();
  for(const phone of [null,'123','13800000001','%001'])await expect(store.login('陈宇',phone,'hash')).rejects.toThrow('INVALID_PHONE_SUFFIX');
  mocks.limit.mockResolvedValue({data:[],error:null});await expect(store.login('陈宇','9999','hash')).rejects.toThrow('NOT_FOUND');
  mocks.limit.mockResolvedValue({data:[{phone:'13800000001'},{phone:'13900000001'}],error:null});await expect(store.login('陈宇','0001','hash')).rejects.toThrow('LOGIN_AMBIGUOUS');
  expect(mocks.rpc).not.toHaveBeenCalled();
 });
 it('passes the private full number to the existing RPC only after a unique match',async()=>{
  mocks.limit.mockResolvedValue({data:[{phone:'13800000001'}],error:null});
  await supabaseStore().login('陈宇','0001','hash');
  expect(mocks.eq).toHaveBeenCalledWith('name','陈宇');expect(mocks.like).toHaveBeenCalledWith('phone','%0001');
  expect(mocks.rpc).toHaveBeenCalledWith('login_player',{p_name:'陈宇',p_phone:'13800000001',p_hash:'hash'});
 });
 it('applies the same verification in demo mode',async()=>{
  const s=createDemoStore();await expect(s.login('陈宇','9999','bad')).rejects.toThrow('NOT_FOUND');await expect(s.snapshot('bad')).rejects.toThrow('UNAUTHORIZED');
  await s.login('陈宇','0001','valid');expect((await s.snapshot('valid')).viewer.name).toBe('陈宇');
 });
});
