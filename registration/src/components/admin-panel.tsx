"use client";
import { useEffect, useRef, useState } from "react";
import {
  X,
  CircleDot,
  LogOut,
  ShieldCheck,
  Plus,
  UsersRound,
  Bell,
  Pencil,
  Phone,
  Crown,
  GripVertical,
} from "lucide-react";
import Modal from "./modal";
import AssociationHeader from "./association-header";
import AssociationFooter from "./association-footer";
import type { AdminSnapshot, AdminPlayer, AdminTeam } from "@/lib/admin-types";
const adminDragType = "application/x-pku-admin-player";
type MovePlayer = (playerId: string, teamId: string | null) => void;
async function api(body?: Record<string, unknown>) {
  const res = await fetch("/registration/api/admin", {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok)
    throw Object.assign(new Error(data.error || "操作失败，请重试。"), {
      status: res.status,
    });
  return data;
}
export default function AdminPanel({ onExit }: { onExit: () => void }) {
  const dragPreview = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => { dragPreview.current?.remove(); }, []);
  const [data, setData] = useState<AdminSnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [tab, setTab] = useState<"teams" | "players" | "messages">("teams"),
    [search, setSearch] = useState(""),
    [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null),
    [dropTarget, setDropTarget] = useState<string | null>(null);
  async function refresh() {
    setData(await api());
  }
  useEffect(() => {
    let active = true;
    api()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => {
        if (active && e.status !== 401) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  async function run(body: Record<string, unknown>, logout = false) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await api(body);
      if (logout) {
        setData(null);
        onExit();
        return;
      }

      await refresh().catch(() =>
        setError("操作已保存；名单刷新失败，请点击刷新名单。"),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  function submit(
    e: React.FormEvent<HTMLFormElement>,
    body: Record<string, unknown>,
  ) {
    e.preventDefault();
    const form = e.currentTarget;
    void run({ ...Object.fromEntries(new FormData(form)), ...body });
  }
  function movePlayer(playerId: string, teamId: string | null) {
    const player = data?.players.find(p => p.id === playerId);
    if (busy || !player || player.role === "captain" || player.teamId === teamId) return;
    if (teamId && !data?.teams.some(t => t.id === teamId)) return;
    void run({ action: "move_player", playerId, teamId });
  }
  function startDrag(e: React.DragEvent, player: AdminPlayer) {
    if (busy || player.role === "captain") { e.preventDefault(); return; }
    e.stopPropagation();
    window.getSelection()?.removeAllRanges();
    dragPreview.current?.remove();
    const preview = document.createElement("div");
    preview.className = "admin-player-drag-preview";
    preview.textContent = player.name;
    preview.setAttribute("aria-hidden", "true");
    preview.style.fontFamily = getComputedStyle(e.currentTarget).fontFamily;
    document.body.appendChild(preview);
    dragPreview.current = preview;
    e.dataTransfer.setData(adminDragType, player.id);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setDragImage(preview, 20, 22);
    setDraggedPlayerId(player.id);
  }
  function endDrag() {
    dragPreview.current?.remove();
    dragPreview.current = null;
    setDraggedPlayerId(null);
    setDropTarget(null);
  }
  function dropProps(teamId: string | null) {
    const key = teamId || "free";
    const player = data?.players.find(p => p.id === draggedPlayerId);
    const canDrop = !busy && player && player.role !== "captain" && player.teamId !== teamId;
    return {
      onDragOver: (e: React.DragEvent<HTMLElement>) => {
        if (!canDrop || !e.dataTransfer.types.includes(adminDragType)) return;
        e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDropTarget(key);
      },
      onDragLeave: (e: React.DragEvent<HTMLElement>) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropTarget(null);
      },
      onDrop: (e: React.DragEvent<HTMLElement>) => {
        if (!canDrop) return;
        e.preventDefault();
        const id = e.dataTransfer.getData(adminDragType);
        if (id === draggedPlayerId) movePlayer(id, teamId);
        endDrag();
      },
    };
  }
  const available = data?.players.filter((p) => p.role !== "captain") || [];
  const filteredPlayers = data?.players.filter(p =>
    p.name.includes(search) || p.phone.includes(search) || p.school.includes(search)
  ) || [];
  return (
    <div className="site-shell admin-shell">
      <AssociationHeader />
      <header className="site-header admin-session-header">
        <span className="admin-label">
          <ShieldCheck size={16} />
          管理员
        </span>
        {data && (
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => run({ action: "logout" }, true)}
          >
            <LogOut size={16} />
            退出管理
          </button>
        )}
      </header>
      <main className="board-main admin-main">
        {loading ? (
          <p role="status">正在获取管理数据…</p>
        ) : !data ? (
          <section className="admin-login-card">
            <div className="eyebrow">ADMIN ACCESS</div>
            <h1>管理员登录</h1>
            <p className="modal-note">管理所有球队、队长、队员和入队申请。</p>
            <form onSubmit={(e) => submit(e, { action: "login" })}>
              <label className="field">
                管理员密码
                <input
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={256}
                />
              </label>
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              <button className="button primary full" disabled={busy}>
                {busy ? "正在登录…" : "进入管理面板"}
              </button>
            </form>
            <button
              className="button secondary full admin-back"
              onClick={onExit}
            >
              返回普通登录
            </button>
          </section>
        ) : (
          <>
            <div className="board-heading">
              <div>
                <div className="eyebrow">ADMIN DASHBOARD</div>
                <h1>报名管理</h1>
              </div>
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  setError("");
                  refresh().catch((e) => setError(e.message));
                }}
              >
                刷新名单
              </button>
            </div>
            {error && (
              <p className="inline-error admin-feedback" role="alert">
                {error}
              </p>
            )}
            <nav className="admin-tabs" aria-label="管理分类">
              {(
                [
                  ["teams", "球队管理", UsersRound],
                  ["players", "球员管理", UsersRound],
                  ["messages", "申请管理", Bell],
                ] as const
              ).map(([key, title, Icon]) => (
                <button
                  key={key}
                  className={`button ${tab === key ? "primary" : "secondary"}`}
                  onClick={() => setTab(key)}
                >
                  <Icon size={17} />
                  {title}
                  {key === "messages" &&
                    data.applications.some((a) => a.status === "pending") && (
                      <span className="count-badge">
                        {
                          data.applications.filter(
                            (a) => a.status === "pending",
                          ).length
                        }
                      </span>
                    )}
                </button>
              ))}
            </nav>
            {tab === "teams" && (
              <>
                <section className="admin-create">
                  <h2>
                    <Plus size={19} />
                    新建球队
                  </h2>
                  <form
                    className="admin-inline-form"
                    onSubmit={(e) => submit(e, { action: "create_team" })}
                  >
                    <label className="field">
                      新球队名称
                      <input
                        name="name"
                        maxLength={40}
                        required
                        placeholder="输入队名"
                      />
                    </label>
                    <label className="field">
                      选择队长
                      <select name="playerId" required defaultValue="">
                        <option value="" disabled>
                          选择已报名的球员
                        </option>
                        {available.map((p) => (
                          <option value={p.id} key={p.id}>
                            {p.name} ·{" "}
                            {data.teams.find((t) => t.id === p.teamId)?.name ||
                              "自由球员"}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      className="button primary"
                      disabled={busy || !available.length}
                    >
                      创建球队
                    </button>
                  </form>
                  <p className="modal-note">
                    新队长需要先报名，也可以在“球员管理”中新增。现任队长需先为原球队更换队长。
                  </p>
                </section>
                <section className="teams-grid" aria-label="管理员球队名单">
                  {data.teams.map((team) => (
                    <TeamCard
                      key={team.id}
                      team={team}
                      error={error}
                      clearFeedback={() => setError("")}
                      data={data}
                      busy={busy}
                      submit={submit}
                      move={movePlayer}
                      startDrag={startDrag}
                      endDrag={endDrag}
                      dropHandlers={dropProps(team.id)}
                      dropActive={dropTarget === team.id}
                      remove={() => {
                        if (window.confirm(`删除“${team.name}”？所有成员将保留报名信息并转为自由球员。`))
                          void run({ action: "delete_team", teamId: team.id });
                      }}
                    />
                  ))}
                </section>
                {!data.teams.length && (
                  <p className="empty-free">还没有球队，可在上方创建。</p>
                )}
                <section className={`admin-free-players ${dropTarget === "free" ? "drop-active" : ""}`} aria-label="管理员自由球员" {...dropProps(null)}>
                  <div className="admin-free-heading"><h2><UsersRound size={18} />自由球员 <span>{data.players.filter(p => !p.teamId).length}</span></h2><p>选择球队加入，或将球员拖到球队卡片；队员也可拖回这里。</p></div>
                  <ul className="admin-team-roster admin-free-roster">
                    {data.players.filter(p => !p.teamId).map(p => <RosterMember key={p.id} player={p} teams={data.teams} busy={busy} move={movePlayer} startDrag={startDrag} endDrag={endDrag} />)}
                  </ul>
                  {!data.players.some(p => !p.teamId) && <p className="modal-note">暂无自由球员</p>}
                </section>
              </>
            )}
            {tab === "players" && (
              <>
                <details className="admin-create admin-create-compact">
                  <summary><Plus size={18} />新增报名者</summary>
                  <div className="admin-create-body">
                  <form
                    className="admin-inline-form"
                    onSubmit={(e) => submit(e, { action: "create_player" })}
                  >
                    <label className="field">
                      姓名
                      <input name="name" maxLength={30} required />
                    </label>
                    <label className="field">
                      性别
                      <select
                        name="gender"
                        defaultValue=""
                        required
                        aria-label="性别"
                      >
                        <option
                          value=""
                          disabled
                          aria-label="请选择性别"
                        ></option>
                        <option>男</option>
                        <option>女</option>
                        <option>非二元性别</option>
                        <option>不愿意透露</option>
                      </select>
                    </label>
                    <label className="field">
                      学校信息
                      <input aria-label="学校信息" name="school" placeholder="例如：北京大学 / 北京大学校友" maxLength={80} required />
                    </label>
                    <label className="field">
                      手机号
                      <input
                        name="phone"
                        type="tel"
                        pattern="1[3-9][0-9]{9}"
                        maxLength={11}
                        required
                      />
                    </label>
                    <button className="button primary" disabled={busy}>
                      保存报名信息
                    </button>
                  </form>
                  <p className="modal-note">
                    新增报名者统一进入自由球员区，之后可以创建球队或加入已有球队。
                  </p>
                  </div>
                </details>
                <label className="field admin-search">
                  搜索球员
                  <input
                    placeholder="输入姓名、手机号或学校"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </label>
                <section
                  className="admin-player-list"
                  aria-label="管理员球员名单"
                >
                  {filteredPlayers.map((p) => (
                      <PlayerEditor
                        key={p.id}
                        player={p}
                        data={data}
                        busy={busy}
                        submit={submit}
                        remove={() => run({ action: "delete_player", playerId: p.id })}
                      />
                    ))}
                </section>
                {!filteredPlayers.length && <p className="empty-free">{search ? "没有匹配的球员" : "暂无报名球员"}</p>}
              </>
            )}
            {tab === "messages" && (
              <section className="admin-applications">
                {data.applications.map((a) => (
                  <article className="application-card admin-application-card" key={a.id}>
                    <div className="application-person">
                      <span className="avatar">{a.name.slice(0, 1)}</span>
                      <div>
                        <strong>{a.name}</strong>
                        <span>申请加入 {a.teamName}</span>
                        <time dateTime={a.createdAt}>{new Date(a.createdAt).toLocaleString("zh-CN", {
                          timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
                        })}</time>
                      </div>
                    </div>
                    <div className="admin-application-actions">
                      {a.status === "pending" ? (
                        <div>
                          <button
                            className="small-button"
                            disabled={busy}
                            onClick={() =>
                              run({ action: "reject", applicationId: a.id })
                            }
                          >
                            拒绝
                          </button>
                          <button
                            className="small-button approve"
                            disabled={busy}
                            onClick={() =>
                              run({ action: "approve", applicationId: a.id })
                            }
                          >
                            批准
                          </button>
                        </div>
                      ) : (
                        <span className={`status ${a.status}`}>
                          {
                            {
                              approved: "已批准",
                              rejected: "已拒绝",
                              cancelled: "已失效",
                            }[a.status]
                          }
                        </span>
                      )}
                    </div>
                    {a.reason && <p className="application-reason"><strong>申请理由：</strong>{a.reason}</p>}
                  </article>
                ))}
                {!data.applications.length && (
                  <p className="empty-free">暂无入队申请。</p>
                )}
              </section>
            )}
          </>
        )}
      </main>
      <AssociationFooter />
    </div>
  );
}
function TeamCard({ team, data, busy, error, clearFeedback, submit, remove, move, startDrag, endDrag, dropHandlers, dropActive }: {
  team: AdminTeam;
  error: string;
  clearFeedback: () => void;
  data: AdminSnapshot;
  busy: boolean;
  submit: (e: React.FormEvent<HTMLFormElement>, body: Record<string, unknown>) => void;
  remove: () => void;
  move: MovePlayer;
  startDrag: (e: React.DragEvent, player: AdminPlayer) => void;
  endDrag: () => void;
  dropHandlers: React.HTMLAttributes<HTMLElement>;
  dropActive: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const captain = data.players.find(p => p.id === team.captainId);
  const members = data.players
    .filter(p => p.teamId === team.id)
    .sort((a, b) => Number(b.id === team.captainId) - Number(a.id === team.captainId));
  return (
    <article className={`team-card admin-team ${dropActive ? "drop-active" : ""}`} aria-label={team.name} {...dropHandlers}>
      <div className="admin-team-heading">
        <div>
          <h2>{team.name}</h2>
          <span className="admin-team-count"><UsersRound size={14} />{members.length} 位成员</span>
        </div>
        <button
          className="button secondary admin-team-edit-toggle"
          disabled={busy}
          aria-haspopup="dialog"
          onClick={() => {clearFeedback(); setEditing(true);}}
        >
          <Pencil size={14} />编辑
        </button>
      </div>
      <div className="admin-team-contact">
        <span><Crown size={15} /><span className="admin-team-caption">队长</span><strong>{captain?.name || "暂无队长"}</strong></span>
        {captain?.phone && <a href={`tel:${captain.phone}`}><Phone size={14} />{captain.phone}</a>}
      </div>
      <div className="admin-team-members">
        <h3>成员名单</h3>
        <ul className="admin-team-roster">
          {members.map(p => <RosterMember key={p.id} player={p} teams={data.teams} busy={busy} move={move} startDrag={startDrag} endDrag={endDrag} />)}
        </ul>
        {!members.length && <p className="modal-note">暂无成员</p>}
        <details className="admin-team-add">
          <summary><Plus size={14} />添加球员</summary>
          <form className="admin-roster-form" onSubmit={e => {
            e.preventDefault();
            move(String(new FormData(e.currentTarget).get("playerId")), team.id);
          }}>
            <label className="field">选择要添加的球员
              <select name="playerId" aria-label="选择要添加的球员" defaultValue="" required disabled={busy}>
                <option value="" disabled>选择自由球员或其他队员</option>
                {data.players.filter(p => p.role !== "captain" && p.teamId !== team.id).map(p => <option key={p.id} value={p.id}>{p.name} · {data.teams.find(t => t.id === p.teamId)?.name || "自由球员"}</option>)}
              </select>
            </label>
            <button className="button secondary" disabled={busy || !data.players.some(p => p.role !== "captain" && p.teamId !== team.id)}>确认添加</button>
          </form>
        </details>
        <p className="admin-roster-hint">可拖入自由球员或其他队员；队长需先更换队长才能调配。</p>
      </div>
      {editing && (
        <Modal label="编辑球队" onClose={() => {if (!busy) setEditing(false);}}>
          <div className="modal-heading"><h2>编辑球队</h2><button className="icon-button" aria-label="关闭编辑球队" disabled={busy} onClick={() => setEditing(false)}><X size={20}/></button></div>
          {error && <p role="alert" className="feedback error">{error}</p>}
          <div className="admin-team-editor">
          <form className="admin-inline-form" onSubmit={e => submit(e, { action: "rename_team", teamId: team.id })}>
            <label className="field">队伍名称
              <input key={team.name} name="name" defaultValue={team.name} maxLength={40} required disabled={busy} />
            </label>
            <button className="button secondary" disabled={busy}>保存队名</button>
          </form>
          <form className="admin-inline-form" onSubmit={e => submit(e, { action: "set_captain", teamId: team.id })}>
            <label className="field">队长
              <select key={team.captainId} name="playerId" defaultValue={team.captainId} disabled={busy}>
                {data.players.filter(p => p.role !== "captain" || p.id === team.captainId).map(p => (
                  <option key={p.id} value={p.id}>{p.name}{p.id === team.captainId ? "（现任）" : ""}</option>
                ))}
              </select>
            </label>
            <button className="button secondary" disabled={busy}>更换队长</button>
          </form>
          <div className="admin-team-danger-zone">
            <p>删除后，成员将转为自由球员。</p>
            <button className="small-button admin-danger" disabled={busy} onClick={remove}>删除球队</button>
          </div>
        </div>
        </Modal>
      )}
    </article>
  );
}
function RosterMember({ player: p, teams, busy, move, startDrag, endDrag }: {
  player: AdminPlayer;
  teams: AdminTeam[];
  busy: boolean;
  move: MovePlayer;
  startDrag: (e: React.DragEvent, player: AdminPlayer) => void;
  endDrag: () => void;
}) {
  const canMove = p.role !== "captain";
  const [transferOpen, setTransferOpen] = useState(false);
  return (
    <li draggable={canMove && !busy} onDragStart={e => startDrag(e, p)} onDragEnd={endDrag}>
      <div className="admin-roster-row">
      <div className="admin-roster-member-info">
        {canMove && <GripVertical size={14} className="admin-drag-handle" aria-hidden="true" />}
        <span className="admin-team-member-name"><span className="admin-team-avatar" aria-hidden="true">{p.name.slice(0, 1)}</span><span>{p.name}</span></span>
        <span className={canMove ? "admin-team-gender" : "admin-team-captain-badge"}>{canMove ? p.gender : "队长"}</span>
      </div>
      {canMove && <button type="button" className="admin-roster-toggle" disabled={busy} aria-expanded={transferOpen} aria-controls={`transfer-${p.id}`} onClick={() => setTransferOpen(!transferOpen)}>{transferOpen ? "取消" : p.teamId ? "转队" : "加入球队"}</button>}
      </div>
      {canMove && transferOpen && (
          <form className="admin-roster-form admin-member-transfer" id={`transfer-${p.id}`} onSubmit={e => {
            e.preventDefault();
            const target = String(new FormData(e.currentTarget).get("teamId"));
            move(p.id, target === "free" ? null : target);
          }}>
            <label className="field">目标球队
              <select name="teamId" aria-label="目标球队" defaultValue="" required disabled={busy}>
                <option value="" disabled>选择目标球队</option>
                {teams.filter(t => t.id !== p.teamId).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                {p.teamId && <option value="free">自由球员</option>}
              </select>
            </label>
            <button className="button secondary" disabled={busy || (!p.teamId && !teams.length)}>确认调配</button>
          </form>
      )}
    </li>
  );
}
function PlayerEditor({
  player: p,
  data,
  busy,
  submit,
  remove,
}: {
  player: AdminPlayer;
  data: AdminSnapshot;
  busy: boolean;
  submit: (
    e: React.FormEvent<HTMLFormElement>,
    body: Record<string, unknown>,
  ) => void;
  remove: () => Promise<void>;
}) {
  return (
    <article className="admin-player-card" aria-label={`管理球员 ${p.name}`}>
      <details className="admin-player-details">
        <summary>
          <div className="admin-player-overview">
            <strong>{p.name}</strong>
            <div className="admin-player-metadata">
              <span>{p.gender}</span>
              <span>{p.school}</span>
              <span className="admin-player-phone">{p.phone}</span>
              <span>{data.teams.find(t => t.id === p.teamId)?.name || "自由球员"}</span>
            </div>
          </div>
          <span className="admin-player-role">{p.role === "captain" ? "队长" : p.teamId ? "队员" : ""}</span>
          <span className="admin-player-toggle"><span className="when-closed">编辑</span><span className="when-open">收起</span></span>
        </summary>
        <div className="admin-player-edit-body">
      <form
        className="admin-inline-form"
        key={`${p.name}-${p.phone}-${p.gender}-${p.school}`}
        onSubmit={(e) => submit(e, { action: "edit_player", playerId: p.id })}
      >
        <label className="field">
          姓名
          <input name="name" defaultValue={p.name} maxLength={30} required />
        </label>
        <label className="field">
          性别
          <select name="gender" defaultValue={p.gender}>
            <option>男</option>
            <option>女</option>
            <option>非二元性别</option>
            <option>不愿意透露</option>
          </select>
        </label>
        <label className="field">学校信息
          <input aria-label="学校信息" name="school" defaultValue={p.school} maxLength={80} required />
        </label>
        <label className="field">
          手机号
          <input
            name="phone"
            type="tel"
            defaultValue={p.phone}
            pattern="1[3-9][0-9]{9}"
            maxLength={11}
            required
          />
        </label>
        <button className="button secondary" disabled={busy}>
          保存信息
        </button>
      </form>
      <div className="admin-player-edit-actions">
      <button type="button" className="button secondary" disabled={busy || p.role === "captain"} onClick={() => {
        if (confirm(`确认删除“${p.name}”（${p.phone}）的报名信息？相关申请和登录会话也会清除，删除后需重新注册。`)) void remove();
      }}>删除选手</button>
      </div>
      {p.role === "captain" && (
        <p className="modal-note">
          调配或删除现任队长前，请先在球队管理中更换队长或解散球队。
        </p>
      )}
        </div>
      </details>
    </article>
  );
}
