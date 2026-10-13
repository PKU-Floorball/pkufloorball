import { describe, expect, it } from "vitest";
import { groupPlayersBySchool } from "../src/lib/player-schools";

describe("free player school groups", () => {
  it("groups schools, keeps member order and puts alumni and other affiliations last", () => {
    const players = [
      { id: 1, school: "北京大学" },
      { id: 2, school: "清华大学" },
      { id: 3, school: " 北京大学 " },
      { id: 4, school: "北京大学校友" },
      { id: 5, school: "清华大学（已毕业）" },
      { id: 6, school: "某科技公司" },
      { id: 7, school: "" },
      { id: 8, school: "某学校校友会" },
    ];
    const groups = groupPlayersBySchool(players);
    expect(groups.map(g => [g.school, g.players.map(p => p.id)])).toEqual([
      ["北京大学", [1, 3]], ["清华大学", [2]], ["其他", [4, 5, 6, 7, 8]],
    ]);
    expect(players[3].school).toBe("北京大学校友");
  });

  it("recognizes school types and English names, without creating empty groups", () => {
    expect(groupPlayersBySchool([])).toEqual([]);
    const names = ["北京体育大学", "中央美术学院", "北京市第四中学", "Peking University", "Peking University alumni", "自由职业"];
    const groups = groupPlayersBySchool(names.map(school => ({ school })));
    expect(groups).toHaveLength(5);
    expect(groups.at(-1)?.players.map(p => p.school)).toEqual(names.slice(-2));
    for (const school of ["Peking University undergraduate", "Peking University Graduate School", "北京大学（在职研究生）"]) {
      expect(groupPlayersBySchool([{ school }])[0].school).toBe(school);
    }
  });
});
