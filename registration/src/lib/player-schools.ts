/** Group the supplied affiliation without changing players' original information. */
export function groupPlayersBySchool<T extends { school?: string | null }>(players: T[]) {
  const groups = new Map<string, T[]>();
  for (const player of players) {
    const affiliation = player.school?.trim() || "";
    const other = /校友|毕业|往届|社会|公司|企业|已工作|非在校|alumni|alumnus|alumna|\bgraduated\b|\bgraduate\b(?!\s+school)/i.test(affiliation);
    const school = /大学|学院|学校|中学|小学|附中|附小|技校|职校|高中|初中|\buniversity\b|\bcollege\b|\bschool\b/i.test(affiliation);
    const name = school && !other ? affiliation : "其他";
    const members = groups.get(name) || [];
    members.push(player);
    groups.set(name, members);
  }
  return [...groups].sort(([a], [b]) => a === "其他" ? 1 : b === "其他" ? -1 : a.localeCompare(b, "zh-CN"))
    .map(([school, players]) => ({ school, players }));
}
