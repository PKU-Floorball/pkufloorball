import { describe, expect, it } from "vitest";
import { parseRegistration, parseLogin } from "../src/lib/validation";

describe("personal registration", () => {
  const personal = { name: " 张三 ", gender: "男", phone: "13800138000", school: "北京大学" };
  it("needs only personal details and ignores obsolete role/team fields", () => {
    expect(parseRegistration(personal)).toEqual({
      name: "张三",
      gender: "男",
      phone: "13800138000",
      school: "北京大学",
    });
    expect(
      parseRegistration({
        ...personal,
        role: "captain",
        teamName: "旧队",
        teamId: "invalid",
      }),
    ).toEqual({ name: "张三", gender: "男", phone: "13800138000", school: "北京大学" });
  });
  it("rejects invalid personal details", () => {
    for (const fields of [
      { name: "" },
      { name: "张".repeat(31) },
      { gender: "other" },
      { phone: "123" },
    ])
      expect(() => parseRegistration({ ...personal, ...fields })).toThrow();
  });
});
describe("name and phone suffix login", () => {
  it("requires exactly four digits, preserving leading zeroes", () => {
    expect(parseLogin({name:" 张三 ",phone:"0001"})).toEqual({name:"张三",phone:"0001"});
    for (const phone of [undefined,null,"123","12345","13800138000","abcd"," 0001 "])
      expect(()=>parseLogin({name:"张三",phone})).toThrow();
    expect(()=>parseLogin({name:" ",phone:"0001"})).toThrow();
  });
});

it("validates new-team names and rejects malformed or repeated member selections", async () => {
  const { parseTeamCreation } = await import("../src/lib/validation");
  const id = "11111111-1111-4111-8111-111111111111";
  expect(parseTeamCreation({ name: " 新队 ", memberIds: [id] })).toEqual({
    name: "新队",
    memberIds: [id],
  });
  for (const body of [
    { name: "", memberIds: [] },
    { name: "队".repeat(41), memberIds: [] },
    { name: "队", memberIds: ["bad"] },
    { name: "队", memberIds: [id, id] },
    { name: "队", memberIds: null },
  ])
    expect(() => parseTeamCreation(body)).toThrow("INVALID_INPUT");
});

it("requires school information and trims it",()=>{
  const personal={name:"学校测试",gender:"女",phone:"13800138600",school:" 北京大学校友 "};
  expect(parseRegistration(personal)).toMatchObject({school:"北京大学校友"});
  for(const school of [undefined,null,"","  ","校".repeat(81)]) expect(()=>parseRegistration({...personal,school})).toThrow("INVALID_INPUT");
});
