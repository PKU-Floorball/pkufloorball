"use client";

import { useState } from "react";
import { CalendarDays, ChartNoAxesColumnIncreasing, Clock3, Goal, Trophy, ArrowUpRight } from "lucide-react";

const firstRound = [
  { id: "group-r1-1", date: "10.23", time: "18:20", dateTime: "2026-10-23T18:20:00+08:00", home: "未命名(1)", away: "未名队" },
  { id: "group-r1-2", date: "10.24", time: "19:00", dateTime: "2026-10-24T19:00:00+08:00", home: "五四的血脉", away: "博雅队" },
];

export default function CompetitionBoard() {
  const [tab, setTab] = useState<"schedule" | "data">("schedule");
  const [stage, setStage] = useState<"group" | "placement">("group");
  const [ranking, setRanking] = useState<"goals" | "assists">("goals");
  return <section className="competition-board" aria-label="比赛赛程与数据">
    <header className="competition-hero">
      <div><span className="competition-eyebrow">PKU FLOORBALL · 2026</span><h2>每一场，都全力以赴。</h2><p>北京大学软式曲棍球公开赛</p></div>
      <div className="competition-hero-mark" aria-hidden="true"><Trophy strokeWidth={1.2} /><span>OPEN TO ALL</span></div>
    </header>
    <div className="competition-tabs" aria-label="赛程与数据切换">
      <button type="button" aria-pressed={tab === "schedule"} onClick={() => setTab("schedule")}><CalendarDays size={18} />赛程</button>
      <button type="button" aria-pressed={tab === "data"} onClick={() => setTab("data")}><ChartNoAxesColumnIncreasing size={18} />数据</button>
    </div>
    {tab === "schedule" ? <div className="competition-schedule">
      <div className="competition-section-head">
        <div className="competition-segment" aria-label="比赛阶段">
          <button type="button" aria-pressed={stage === "group"} onClick={() => setStage("group")}>小组赛</button>
          <button type="button" aria-pressed={stage === "placement"} onClick={() => setStage("placement")}>排位赛</button>
        </div>
        <span className="competition-timezone"><Clock3 size={14} />北京时间</span>
      </div>
      {stage === "group" ? <div className="competition-rounds">
        {["第一轮", "第二轮", "第三轮"].map((round, index) => <section className="competition-round" key={round} aria-label={round}>
          <header className="competition-round-title"><h3>{round}</h3></header>
          {index === 0 ? firstRound.map(match => <article className="competition-match" key={match.id} aria-label={`${match.home} 对阵 ${match.away}`}>
            <div className="competition-match-teams">
              {[match.home, match.away].map((team, teamIndex) => <div className="competition-team-row" key={teamIndex}>
                <span className={`competition-team-emblem${teamIndex ? " away" : ""}`} aria-hidden="true">{team.slice(0, 1)}</span>
                <strong>{team}</strong>
                <span className="competition-score" aria-label={`${team}比分待更新`}>—</span>
              </div>)}
            </div>
            <footer><time dateTime={match.dateTime}>{match.date} {match.time}</time></footer>
          </article>) : <div className="competition-round-pending"><CalendarDays size={24} strokeWidth={1.4} /><h4>赛程待公布</h4><p>对阵与比赛时间确认后更新</p></div>}
        </section>)}
      </div> : <div className="competition-empty competition-placement"><Trophy size={38} strokeWidth={1.3} /><h3>排位赛赛程待公布</h3><p>对阵与比赛时间将在确认后公布，敬请关注。</p></div>}
    </div> : <div className="competition-data">
      <section className="competition-stat-panel" aria-labelledby="standings-title">
        <header><div><span className="competition-eyebrow">TEAM STANDINGS</span><h3 id="standings-title"><Trophy size={20} />球队积分榜</h3></div><span className="competition-status">待更新</span></header>
        <div className="competition-table-scroll"><table><caption className="sr-only">球队积分榜，比赛结果录入后更新</caption><thead><tr>{["排名", "球队", "场次", "胜", "平", "负", "进球", "失球", "净胜球", "积分"].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody><tr><td colSpan={10}><div className="competition-empty"><ChartNoAxesColumnIncreasing size={32} strokeWidth={1.4} /><h4>积分榜待更新</h4><p>比赛结果公布后展示球队积分与排名</p></div></td></tr></tbody></table></div>
      </section>
      <section className="competition-stat-panel" aria-labelledby="player-stats-title">
        <header><div><span className="competition-eyebrow">PLAYER LEADERBOARD</span><h3 id="player-stats-title"><Goal size={20} />球员个人数据统计</h3></div><div className="competition-segment" aria-label="个人数据榜单"><button type="button" aria-pressed={ranking === "goals"} onClick={() => setRanking("goals")}>进球榜</button><button type="button" aria-pressed={ranking === "assists"} onClick={() => setRanking("assists")}>助攻榜</button></div></header>
        <div className="competition-player-columns" aria-hidden="true"><span>排名</span><span>球员 / 球队</span><span>{ranking === "goals" ? "进球" : "助攻"}</span></div>
        <div className="competition-empty">{ranking === "goals" ? <Goal size={32} strokeWidth={1.4} /> : <ArrowUpRight size={32} strokeWidth={1.4} />}<h4>暂无{ranking === "goals" ? "进球" : "助攻"}数据</h4><p>球员表现将在比赛数据确认后更新</p></div>
      </section>
    </div>}
  </section>;
}
