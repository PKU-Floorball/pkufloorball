import { expect, it } from "vitest";
import {createDemoStore} from "../src/lib/demo-store";
it("matching name and phone is an existing registration, other name is a phone conflict",async()=>{
  const store=createDemoStore();
  await expect(store.register({name:"陈宇",gender:"女",phone:"13800000001",school:"北京大学"})).rejects.toThrow("ALREADY_REGISTERED");
  await expect(store.register({name:"另一个人",gender:"男",phone:"13800000001",school:"北京大学"})).rejects.toThrow("PHONE_EXISTS");
  await store.login("陈宇","0001","old");
  expect((await store.snapshot("old")).viewer).toMatchObject({name:"陈宇",gender:"男",role:"captain"});
});
