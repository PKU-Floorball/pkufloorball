import {test,expect,vi} from 'vitest';
import {AppError} from '../src/lib/validation';
test('development recognizes the prior demo-store error constructor after a bundle reload',()=>{
 const PriorAppError=class AppError extends Error {code='PLAYER_UNAVAILABLE';status=400};
 const earlier=new PriorAppError('PLAYER_UNAVAILABLE');
 try {
  vi.stubEnv('NODE_ENV','development');expect(earlier instanceof AppError).toBe(true);expect(new Error('PLAYER_UNAVAILABLE') instanceof AppError).toBe(false);
  vi.stubEnv('NODE_ENV','production');expect(earlier instanceof AppError).toBe(false);expect(new AppError('PLAYER_UNAVAILABLE') instanceof AppError).toBe(true);
 }finally{vi.unstubAllEnvs()}
});
