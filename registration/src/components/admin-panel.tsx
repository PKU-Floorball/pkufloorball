"use client";
import { useEffect, useState } from "react";
import {
  CircleDot,
  LogOut,
  ShieldCheck,
  Plus,
  UsersRound,
  Bell,
} from "lucide-react";
import type { AdminSnapshot, AdminPlayer } from "@/lib/admin-types";
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
  const [data, setData] = useState<AdminSnapshot | null>(null),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [tab, setTab] = useState<"teams" | "players" | "messages">("teams"),
    [search, setSearch] = useState("");
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
    setNotice("");
    try {
      await api(body);
      if (logout) {
        setData(null);
        onExit();
        return;
      }
      setNotice(body.action === "login" ? "管理员登录成功。" : body.action === "delete_player" ? "选手已删除，相关申请和登录会话已清理。" : "修改已保存。");
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
  const available = data?.players.filter((p) => p.role !== "captain") || [];
  return (
    <div className="site-shell">
      <header className="site-header">
        <button className="brand" onClick={onExit}>
          <span className="brand-symbol">
            <CircleDot size={28} />
          </span>
          <span>
            <strong>北大地板球</strong>
            <small>PKU FLOORBALL</small>
          </span>
        </button>
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
                <h1>
                  报名管理
                  <span>
                    {data.teams.length} 支球队 · {data.players.length} 位报名者
                  </span>
                </h1>
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
            {notice && (
              <p className="admin-notice" role="status">
                {notice}
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
                    <article
                      className="team-card admin-team"
                      key={team.id}
                      aria-label={team.name}
                    >
                      <h2>{team.name}</h2>
                      <form
                        onSubmit={(e) =>
                          submit(e, { action: "rename_team", teamId: team.id })
                        }
                        className="admin-inline-form"
                      >
                        <label className="field">
                          队伍名称
                          <input
                            key={team.name}
                            name="name"
                            defaultValue={team.name}
                            maxLength={40}
                            required
                          />
                        </label>
                        <button className="button secondary" disabled={busy}>
                          保存队名
                        </button>
                      </form>
                      <form
                        onSubmit={(e) =>
                          submit(e, { action: "set_captain", teamId: team.id })
                        }
                        className="admin-inline-form"
                      >
                        <label className="field">
                          队长
                          <select
                            key={team.captainId}
                            name="playerId"
                            defaultValue={team.captainId}
                          >
                            {data.players
                              .filter(
                                (p) =>
                                  p.role !== "captain" ||
                                  p.id === team.captainId,
                              )
                              .map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.name}
                                  {p.id === team.captainId ? "（现任）" : ""}
                                </option>
                              ))}
                          </select>
                        </label>
                        <button className="button secondary" disabled={busy}>
                          更换队长
                        </button>
                      </form>
                      <div className="admin-roster">
                        {data.players
                          .filter((p) => p.teamId === team.id)
                          .sort(
                            (a, b) =>
                              Number(b.id === team.captainId) -
                              Number(a.id === team.captainId),
                          )
                          .map((p) => (
                            <p key={p.id}>
                              <span>{p.name}</span>
                              <span>
                                {p.role === "captain" ? "队长" : p.gender}
                              </span>
                            </p>
                          ))}
                      </div>
                      <p className="modal-note">
                        队长联系：
                        {
                          data.players.find((p) => p.id === team.captainId)
                            ?.phone
                        }
                      </p>
                      <button
                        className="small-button admin-danger"
                        disabled={busy}
                        onClick={() => {
                          if (
                            window.confirm(
                              `删除“${team.name}”？所有成员将保留报名信息并转为自由球员。`,
                            )
                          )
                            void run({
                              action: "delete_team",
                              teamId: team.id,
                            });
                        }}
                      >
                        删除球队
                      </button>
                    </article>
                  ))}
                </section>
                {!data.teams.length && (
                  <p className="empty-free">还没有球队，可在上方创建。</p>
                )}
              </>
            )}
            {tab === "players" && (
              <>
                <section className="admin-create">
                  <h2>
                    <Plus size={19} />
                    新增报名者
                  </h2>
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
                      </select>
                    </label>
                    <label className="field">
                      学校信息
                      <input aria-label="学校信息" name="school" placeholder="例如：北京大学 / 北京大学校友" maxLength={80} required />
                      <small>请填写就读学校；已毕业请注明“某学校校友”，如“北京大学校友”。</small>
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
                </section>
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
                  {data.players
                    .filter(
                      (p) =>
                        p.name.includes(search) || p.phone.includes(search) || p.school.includes(search),
                    )
                    .map((p) => (
                      <PlayerEditor
                        key={p.id}
                        player={p}
                        data={data}
                        busy={busy}
                        submit={submit}
                        remove={() => run({ action: "delete_player", playerId: p.id })}
                        move={(teamId) =>
                          run({ action: "move_player", playerId: p.id, teamId })
                        }
                      />
                    ))}
                </section>
              </>
            )}
            {tab === "messages" && (
              <section className="admin-applications">
                {data.applications.map((a) => (
                  <article className="application-card" key={a.id}>
                    <div className="application-person">
                      <span className="avatar">{a.name.slice(0, 1)}</span>
                      <div>
                        <strong>{a.name}</strong>
                        <span>申请加入 {a.teamName}</span>
                      </div>
                    </div>
                    {a.reason && <p className="application-reason"><strong>申请理由：</strong>{a.reason}</p>}
                    <div className="application-bottom">
                      <span>
                        {new Date(a.createdAt).toLocaleString("zh-CN", {
                          timeZone: "Asia/Shanghai",
                        })}
                      </span>
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
      <footer className="site-footer">
        <span>北京大学软式曲棍球协会</span>
        <span>报名管理</span>
      </footer>
    </div>
  );
}
function PlayerEditor({
  player: p,
  data,
  busy,
  submit,
  move,
  remove,
}: {
  player: AdminPlayer;
  data: AdminSnapshot;
  busy: boolean;
  submit: (
    e: React.FormEvent<HTMLFormElement>,
    body: Record<string, unknown>,
  ) => void;
  move: (teamId: string | null) => Promise<void>;
  remove: () => Promise<void>;
}) {
  return (
    <article className="admin-player-card" aria-label={`管理球员 ${p.name}`}>
      <div className="admin-player-heading">
        <strong>{p.name}</strong>
        <span className="my-team-label">
          {p.role === "captain" ? "队长" : "队员"}
        </span>
      </div>
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
          </select>
        </label>
        <label className="field">学校信息
          <input aria-label="学校信息" name="school" defaultValue={p.school} maxLength={80} required />
          <small>请填写就读学校；已毕业请注明“某学校校友”，如“北京大学校友”。</small>
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
      <label className="field">
        调整所属球队
        <select
          value={p.teamId || ""}
          disabled={busy || p.role === "captain"}
          onChange={(e) => move(e.target.value || null)}
        >
          <option value="">自由球员</option>
          {data.teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
      </label>
      <button type="button" className="button secondary" disabled={busy || p.role === "captain"} onClick={() => {
        if (confirm(`确认删除“${p.name}”（${p.phone}）的报名信息？相关申请和登录会话也会清除，删除后需重新注册。`)) void remove();
      }}>删除选手</button>
      {p.role === "captain" && (
        <p className="modal-note">
          调配或删除现任队长前，请先在球队管理中更换队长或解散球队。
        </p>
      )}
    </article>
  );
}
