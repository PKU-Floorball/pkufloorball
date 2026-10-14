"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowRightLeft,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  CircleHelp,
  Eye,
  EyeOff,
  LogOut,
  Minus,
  MessageCircle,
  Mars,
  NonBinary,
  Plus,
  Pencil,
  ShieldCheck,
  Trash2,
  UserRound,
  UsersRound,
  Venus,
  X,
} from "lucide-react";
import Modal from "./modal";
import AdminPanel from "./admin-panel";
import AssociationHeader from "./association-header";
import AssociationFooter from "./association-footer";
import { groupPlayersBySchool } from "@/lib/player-schools";
import type { Action, Player, PublicState } from "@/lib/types";
type View = "home" | "login" | "register" | "teams";
const playerDragType = "application/x-pku-player";
const empty: PublicState = { mode: "unconfigured", teams: [], snapshot: null };
class ApiError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}
async function request(body?: Record<string, unknown>) {
  const response = await fetch("/registration/api/registration", {
    method: body ? "POST" : "GET",
    credentials: "same-origin",
    cache: "no-store",
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError(
      "暂时无法连接报名服务，请稍后重试。",
      "SERVICE_UNAVAILABLE",
    );
  }
  if (!response.ok)
    throw new ApiError(
      data.error || "操作失败，请稍后再试。",
      data.code || "SERVICE_UNAVAILABLE",
    );
  if (body?.action === "login") sessionStorage.setItem("floorball-tab-login", "1");
  if (body?.action === "logout") sessionStorage.removeItem("floorball-tab-login");
  return data;
}
export default function RegistrationApp({
  initialView,
}: {
  initialView: View;
}) {
  const [adminOpen, setAdminOpen] = useState(false);
  const [teamContactOpen, setTeamContactOpen] = useState(false);
  const [view, setView] = useState<View>(initialView),
    [state, setState] = useState<PublicState>(empty),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [registered, setRegistered] = useState(false),
    [alreadyRegistered, setAlreadyRegistered] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  const [noticeFading, setNoticeFading] = useState(false);
  const [readApplications, setReadApplications] = useState<Record<string, string>>({});
  const [messagesOpen, setMessagesOpen] = useState(false),
    [recruit, setRecruit] = useState<Player | null>(null),
    [removePlayer, setRemovePlayer] = useState<Player | null>(null),
    [dragOver, setDragOver] = useState<string | null>(null),
    [createTeamOpen, setCreateTeamOpen] = useState(false),
    [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [applicationTarget, setApplicationTarget] = useState<{teamId:string; sourceTeamId:string|null} | null>(null);
  const [applicationReason, setApplicationReason] = useState("");
  const [leaveTeamId, setLeaveTeamId] = useState<string | null>(null);
  const [captainAction, setCaptainAction] = useState<"transfer_captain" | "leave_captain" | "dissolve_team" | null>(null);
  const [editingTeamId, setEditingTeamId] = useState<string | null>(null);
  const [editedTeamName, setEditedTeamName] = useState("");
  const [captainTeamId, setCaptainTeamId] = useState("");
  const [successorId, setSuccessorId] = useState("");
  const snapshot = state.snapshot,
    viewer = snapshot?.viewer;
  const dragPreview = useRef<HTMLDivElement | null>(null);
  useEffect(() => () => { dragPreview.current?.remove(); }, []);
  const canCreateTeam = viewer?.role === "player" && !viewer.teamId;
  useEffect(() => {
    if (!viewer) { setReadApplications({}); return; }
    try { setReadApplications(JSON.parse(sessionStorage.getItem(`floorball-messages-${viewer.id}`) || "{}")); }
    catch { setReadApplications({}); }
  }, [viewer?.id]);
  const markingMessages = useRef(false);
  useEffect(() => {
    if (!snapshot) return;
    const receipts = [
      ...(snapshot.notifications || []).map(n => ({id:n.id,status:"received"})),
      ...snapshot.applications.map(a => ({id:a.id,status:a.status})),
    ].filter(r => snapshot.readMessages?.[r.id] !== r.status && (messagesOpen || readApplications[r.id] === r.status));
    if (!receipts.length || markingMessages.current) return;
    const viewerId = snapshot.viewer.id;
    const batch = receipts.slice(0,30);
    markingMessages.current = true;
    void request({action:"read_messages",receipts:batch}).then(() => {
      const saved = Object.fromEntries(batch.map(r=>[r.id,r.status]));
      setState(previous => previous.snapshot?.viewer.id === viewerId
        ? {...previous,snapshot:{...previous.snapshot,readMessages:{...previous.snapshot.readMessages,...saved}}} : previous);
    }).catch(() => {
      if (messagesOpen) setError("已读状态同步失败，请重新打开消息重试。");
    }).finally(() => {markingMessages.current = false;});
  }, [messagesOpen, snapshot, readApplications]);
  useEffect(() => {
    if (!notice) return;
    setNoticeFading(false);
    window.scrollTo({top:0,behavior:"instant"});
    const fade = window.setTimeout(() => setNoticeFading(true), 7000);
    const remove = window.setTimeout(() => setNotice(""), 8400);
    return () => {window.clearTimeout(fade);window.clearTimeout(remove);};
  }, [notice]);
  const editingTeam = snapshot?.teams.find(t => t.id === editingTeamId && t.captainId === snapshot.viewer.id);
  function openCreateTeam() {
    if (!canCreateTeam || busy) return;
    setError("");
    setSelectedMembers([]);
    setCreateTeamOpen(true);
  }
  useEffect(() => {
    if (snapshot && createTeamOpen && !canCreateTeam) {
      setCreateTeamOpen(false);
      setSelectedMembers([]);
    }
  }, [snapshot, createTeamOpen, canCreateTeam]);
  useEffect(() => {
    if (captainAction && snapshot && !snapshot.teams.some(t => t.id === captainTeamId && t.captainId === snapshot.viewer.id)) {
      setCaptainAction(null);
      setEditingTeamId(null);
      setSuccessorId("");
    }
    if (editingTeamId && snapshot && !snapshot.teams.some(t => t.id === editingTeamId && t.captainId === snapshot.viewer.id)) setEditingTeamId(null);
  }, [snapshot, captainAction, captainTeamId, editingTeamId]);
  useEffect(() => {
    if (!snapshot) return;
    if (applicationTarget && (snapshot.viewer.role !== "player" || snapshot.viewer.teamId !== applicationTarget.sourceTeamId || !snapshot.teams.some(t => t.id === applicationTarget.teamId))) setApplicationTarget(null);
    if (leaveTeamId && (snapshot.viewer.role !== "player" || snapshot.viewer.teamId !== leaveTeamId)) setLeaveTeamId(null);
  }, [snapshot, applicationTarget, leaveTeamId]);
  function openApplication(teamId: string) {
    if (!viewer || viewer.role !== "player" || busy) return;
    setError(""); setApplicationReason("");
    setApplicationTarget({teamId, sourceTeamId:viewer.teamId});
  }
  function startPlayerDrag(event: React.DragEvent, id: string, name: string) {
    event.stopPropagation();
    window.getSelection()?.removeAllRanges();
    dragPreview.current?.remove();
    const preview = document.createElement("div");
    preview.className = "player-drag-preview";
    preview.textContent = name;
    preview.setAttribute("aria-hidden", "true");
    preview.style.fontFamily = getComputedStyle(event.currentTarget).fontFamily;
    document.body.appendChild(preview);
    dragPreview.current = preview;
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.setData(playerDragType, id);
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setDragImage(preview, 20, 22);
  }
  function endPlayerDrag() {
    dragPreview.current?.remove();
    dragPreview.current = null;
    setDragOver(null);
  }
  function go(next: View) {
    setView(next);
    setError("");
    setNotice("");
    setRegistered(false);
    setAlreadyRegistered(false);
    setShowVerification(false);
    window.history.pushState({}, "", next === "home" ? "/registration" : `/registration/${next}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  useEffect(() => {
    const listener = () => {
      const path = location.pathname.replace(/^\/registration\/?/, "");
      setView(
        ["login", "register", "teams"].includes(path) ? (path as View) : "home",
      );
      setError("");
    };
    window.addEventListener("popstate", listener);
    return () => window.removeEventListener("popstate", listener);
  }, []);
  useEffect(() => {
    if (view !== "home") return;
    const court = document.querySelector<HTMLElement>(".race-court");
    if (!court) return;
    const measure = () => court.style.setProperty("--race-top", `${court.getBoundingClientRect().top + window.scrollY}px`);
    const observer = new ResizeObserver(measure);
    document.querySelectorAll(".association-header,.environment-banner,.registration-identity,.feedback").forEach(el => observer.observe(el));
    window.addEventListener("resize", measure);
    measure();
    return () => { observer.disconnect(); window.removeEventListener("resize", measure); };
  }, [view, state.mode, loading, notice, error, viewer?.id]);
  useEffect(() => {
    if (view !== "home") return;
    const title = document.querySelector<HTMLElement>(".race-chinese-title");
    const line = title?.querySelector<HTMLElement>(".floorball-word");
    if (!title || !line) return;
    const fit = () => line.style.setProperty("--title-scale", String(Math.min(1, title.clientWidth / line.scrollWidth)));
    const observer = new ResizeObserver(fit); observer.observe(title);
    void document.fonts.ready.then(fit); fit();
    return () => observer.disconnect();
  }, [view]);
  const refresh = useCallback(async () => {
    const data: PublicState = await request();
    setState(data);
    return data;
  }, []);
  useEffect(() => {
    let active = true;
    // A newly opened tab never restores an identity from a previous page session.
    const initialize = async () => {
      if (!sessionStorage.getItem("floorball-tab-login")) await request({action:"logout"});
      return request();
    };
    initialize()
      .then((data: PublicState) => {
        if (active) setState(data);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!loading && view === "teams" && !viewer) {
      setView("login");
      window.history.replaceState({}, "", "/registration/login");
    }
  }, [loading, view, viewer]);
  useEffect(() => {
    if (!viewer) return;
    let active = true;
    const poll = () => {
      if (document.visibilityState === "visible")
        request()
          .then((data: PublicState) => {
            if (active) {
              setState(data);
              setError("");
            }
          })
          .catch((e) => {
            if (active) setError(e.message);
          });
    };
    const timer = setInterval(poll, 15000);
    window.addEventListener("focus", poll);
    document.addEventListener("visibilitychange", poll);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", poll);
      document.removeEventListener("visibilitychange", poll);
    };
  }, [viewer?.id]);
  async function run(
    body: Record<string, unknown>,
    success: () => void | Promise<void>,
  ) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await request(body);
      await success();
    } catch (e) {
      if (body.action === "register" && e instanceof ApiError && e.code === "ALREADY_REGISTERED") {
        setAlreadyRegistered(true);
        setRegistered(true);
        return;
      }
      if (e instanceof ApiError && e.code === "PLAYER_UNAVAILABLE") {
        setSelectedMembers([]);
        await refresh().catch(() => {});
      }
      setError(e instanceof Error ? e.message : "操作失败，请重试。");
    } finally {
      setBusy(false);
    }
  }
  async function submitRegistration(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await run(
      {
        ...data,
        action: "register",
      },
      async () => {
        setRegistered(true);
        await refresh().catch(() =>
          setNotice("报名已保存；名单暂未刷新，可继续登录。"),
        );
      },
    );
  }
  async function submitLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(event.currentTarget));
    await run({ ...data, action: "login" }, async () => {
      await refresh();
      go("teams");
    });
  }
  async function act(input: Action) {
    await run({ ...input }, async () => {
      setApplicationTarget(null);
      setApplicationReason("");
      setLeaveTeamId(null);
      setEditingTeamId(null);
      setCaptainAction(null);
      setSuccessorId("");
      setRecruit(null);
      setRemovePlayer(null);
      setNotice(
        input.action === "rename_team" ? "球队名称已更新。" : input.action === "leave_team"
          ? "您已退出球队，成为自由球员。"
          : input.action === "switch_apply"
          ? "您已退出原球队，入队申请已发送，请等待新队长审核。"
          : input.action === "transfer_captain"
          ? "队长已转让，您仍是本队队员。"
          : input.action === "leave_captain"
          ? "队长已交接，您已成为自由球员。"
          : input.action === "dissolve_team"
          ? "球队已解散，所有成员已成为自由球员，报名信息已保留。"
          : input.action === "remove"
          ? "队员已移出球队，现在是自由球员。"
          : input.action === "apply"
            ? "申请已发送，等待队长审核。"
            : input.action === "reject"
              ? "已拒绝这条申请。"
              : "加入成功，球队名单已更新。",
      );
      await refresh().catch(() => setNotice("操作已保存；名单暂未刷新，请刷新页面查看。"));
    });
  }
  const unread = (snapshot?.applications.filter(a =>
    (viewer?.role === "captain" || a.status !== "pending") && readApplications[a.id] !== a.status && snapshot.readMessages?.[a.id] !== a.status
  ).length ?? 0) + (snapshot?.notifications?.filter(n => readApplications[n.id] !== "received" && snapshot.readMessages?.[n.id] !== "received").length ?? 0);
  const unavailable = loading || state.mode === "unconfigured";
  if (adminOpen)
    return (
      <AdminPanel
        onExit={() => {
          setAdminOpen(false);
          go("login");
          void refresh();
        }}
      />
    );
  return (
    <div className="site-shell">
      <AssociationHeader />
      {state.mode === "demo" && !loading && (
        <div className="environment-banner">
          <CircleDot size={14} />
          本地演示 · 使用示例数据，重启后重置，请勿填写真实手机号。
        </div>
      )}
      {state.mode === "unconfigured" && !loading && (
        <div className="environment-banner setup-banner">
          报名数据库尚未配置。组织者连接 Supabase 后即可开始报名。
        </div>
      )}
      {error && (
        <div className="feedback error" role="alert">
          <span>{error}</span>
          <button
            className="text-button"
            onClick={() => {
              setError("");
              refresh().catch((e) => setError(e.message));
            }}
          >
            重新获取
          </button>
        </div>
      )}
      {notice && (
        <div className={`feedback success ${noticeFading ? "is-fading" : ""}`} role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      {view === "home" && (
        <main className="race-home">
          <section className="race-court"><div className="race-wrap race-court-inner">
            <h1 className="race-latin race-chinese-title"><span className="pku-word">北京大学</span><span className="floorball-word">软式曲棍球公开赛</span></h1>
            <iframe className="race-ball-frame" src="/registration-visual/ball.html" title="互动三维软式曲棍球：拖动旋转、点击沿轨道滚动" />
            <div className="race-title-row"><p className="race-event-title">PKU Floorball</p><div className="race-actions">
              <button className="race-btn" onClick={() => go("register")}>立即注册<ArrowRight size={21} strokeWidth={1.8} aria-hidden="true" /></button>
              <button className="race-btn secondary" onClick={() => go("login")}>登录<ArrowRight size={21} strokeWidth={1.8} aria-hidden="true" /></button>
            </div></div>
          </div></section><div className="race-court-space" />
        </main>
      )}
      {(view === "login" || view === "register") && (
        <main className="auth-main">
          <section className="auth-copy">
            <button className="back-link" onClick={() => go("home")}>
              <ChevronLeft size={16} />
              返回
            </button>
            <h1 className="champion-title">
              <span>报名参赛</span>
              <span>您就是下一个冠军！</span>
            </h1>
            <span className="auth-watermark" aria-hidden="true">FLOORBALL</span>
          </section>
          <section className="auth-card">
            {view === "register" && registered ? (
              <div className="registered">
                <span className="success-symbol">
                  <Check size={34} />
                </span>
                <h2>{alreadyRegistered ? "您已经注册过了" : "报名成功！"}</h2>
                <p>{alreadyRegistered ? "直接登录即可，无需重复报名。" : "您的个人信息已保存，登录后可创建球队或申请加入球队。"}</p>
                <button
                  className="button primary full"
                  onClick={() => go("login")}
                >
                  前往登录
                  <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              <>
                <div className="form-heading">
                  <h2>{view === "register" ? "创建报名身份" : "登陆"}</h2>
                </div>
                {view === "register" ? (
                  <form onSubmit={submitRegistration}>
                    <label className="field">
                      姓名
                      <input
                        name="name"
                        placeholder="请输入真实姓名"
                        autoComplete="name"
                        maxLength={30}
                        required
                      />
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
                        <option value="男">男</option>
                        <option value="女">女</option>
                        <option value="非二元性别">非二元性别</option>
                        <option value="不愿意透露">不愿意透露</option>
                      </select>
                    </label>
                    <label className="field">
                      学校信息（填写学校全称）
                      <input aria-label="学校信息" name="school" placeholder="例如：北京大学 / 北京大学校友" maxLength={80} required />
                    </label>
                    <label className="field">
                      手机号
                      <input
                        aria-label="手机号"
                        name="phone"
                        type="tel"
                        autoComplete="tel"
                        inputMode="numeric"
                        pattern="1[3-9][0-9]{9}"
                        maxLength={11}
                        required
                      />
                    </label>
                    <button
                      className="button primary full"
                      disabled={busy || unavailable}
                    >
                      {busy ? "正在保存…" : "完成注册"}
                      <ArrowRight size={18} />
                    </button>
                    <p className="form-switch">
                      已有报名身份？
                      <button type="button" onClick={() => go("login")}>
                        前往登录
                      </button>
                    </p>
                  </form>
                ) : (
                  <form onSubmit={submitLogin}>
                    <div className="admin-login-option">
                      <span>参赛选手登陆</span>
                      <button
                        type="button"
                        className="small-button"
                        onClick={() => setAdminOpen(true)}
                      >
                        <ShieldCheck size={14} />
                        管理员登录
                      </button>
                    </div>
                    <label className="field">
                      姓名
                      <input
                        name="name"
                        placeholder="请输入报名时填写的姓名"
                        autoComplete="name"
                        maxLength={30}
                        required
                      />
                    </label>
                    <label className="field">
                      安全验证
                      <span className="secure-input">
                        <input aria-label="安全验证" name="phone" type={showVerification ? "text" : "password"}
                          placeholder="请输入手机号后四位" inputMode="numeric"
                          autoComplete="off" pattern="[0-9]{4}" minLength={4} maxLength={4} required />
                        <button type="button" className="verification-toggle"
                          aria-label={showVerification ? "隐藏安全验证数字" : "显示安全验证数字"}
                          aria-pressed={showVerification} onClick={() => setShowVerification(value => !value)}>
                          {showVerification ? <EyeOff size={21} /> : <Eye size={21} />}
                        </button>
                      </span>
                    </label>
                    <button
                      className="button primary full"
                      disabled={busy || unavailable}
                    >
                      {busy ? "正在进入…" : "进入球队大厅"}
                      <ArrowRight size={18} />
                    </button>
                    <p className="form-switch">
                      还没有报名？
                      <button type="button" onClick={() => go("register")}>
                        立即注册
                      </button>
                    </p>
                  </form>
                )}
              </>
            )}
          </section>
        </main>
      )}
      {view === "teams" && snapshot && (
        <main className="board-main">
          <div className="board-heading">
            <div>
              <h1>
                球队大厅
              </h1>
            </div>
            <div className="board-actions lobby-actions">
              {viewer && (
              <span className="identity">
                <span className="tiny-dot" />
                {viewer.name}
                <span className="identity-role">
                  {viewer.role === "captain"
                    ? "队长"
                    : viewer.teamId
                      ? "队员"
                      : "自由球员"}
                </span>
              </span>
              )}
              <button
                className="button secondary messages-button"
                aria-label={"查看消息"}
                title={"查看消息"}
                onClick={() => setMessagesOpen(true)}
              >
                <Bell size={18} />
                <span className="mobile-action-label">{"查看消息"}</span>
                {unread > 0 && <span className="message-bubble" aria-label={`${unread} 条新消息`}>{unread}</span>}
              </button>
              <button
                className="icon-button"
                aria-label="退出登录"
                title="退出登录"
                disabled={busy}
                onClick={() =>
                  run({ action: "logout" }, () => {
                    setState((s) => ({ ...s, snapshot: null }));
                    go("home");
                  })
                }
              >
                <LogOut size={18} />
              </button>

            </div>
          </div>
          <div className="section-heading">
            <h2>
              已集结球队<span>{snapshot.teams.length}</span>
            </h2>
            <button className="button secondary lobby-create-button create-team-button" disabled={busy || !canCreateTeam} title={canCreateTeam ? "创建球队" : "退出当前球队后可创建新球队"} onClick={openCreateTeam}><Plus size={18} aria-hidden="true" />点击建队</button>
          </div>
          <section className={`teams-grid tournament-teams ${canCreateTeam ? "can-create-team" : ""} ${dragOver === "create-team" ? "create-drop-active" : ""}`} aria-label="球队名单"
            onDragOver={(e) => {
              if ((e.target as HTMLElement).closest(".team-card")) {
                setDragOver(current => current === "create-team" ? null : current);
                return;
              }
              if (canCreateTeam && !busy && e.dataTransfer.types.includes(playerDragType)) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOver("create-team");
              }
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
            }}
            onDrop={(e) => {
              if ((e.target as HTMLElement).closest(".team-card")) return;
              setDragOver(null);
              if (!canCreateTeam || busy) return;
              e.preventDefault();
              const id = e.dataTransfer.getData(playerDragType);
              if (id === viewer?.id && snapshot.freePlayers.some(p => p.id === id)) openCreateTeam();
            }}
          >
            {snapshot.teams.map((team, index) => {
              const own = team.id === viewer?.teamId,
                canDrop = own && viewer?.role === "captain";
              const applied = snapshot.applications.some(
                (a) => a.teamId === team.id && a.status === "pending",
              );
              const canSelfApply = viewer?.role === "player" && !own && !applied;
              const acceptsDrop = canDrop || canSelfApply;
              return (
                <article
                  aria-label={team.name}
                  className={`team-card ${own ? "my-team" : ""} ${dragOver === team.id ? "drop-active" : ""}`}
                  key={team.id}
                  onDragOver={(e) => {
                    if (!busy && acceptsDrop && e.dataTransfer.types.includes(playerDragType)) {
                      e.preventDefault(); e.dataTransfer.dropEffect = "move";
                      setDragOver(team.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null);
                  }}
                  onDrop={(e) => {
                    e.preventDefault(); setDragOver(null);
                    if (busy) return;
                    const id = e.dataTransfer.getData(playerDragType);
                    if (canDrop) {
                      const p = snapshot.freePlayers.find(p => p.id === id);
                      if (p) {setError(""); setRecruit(p);}
                    } else if (canSelfApply && id === viewer?.id) openApplication(team.id);
                  }}
                >
                  <div className="team-top">
                    <span className="team-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {own ? (
                      <span className="team-summary">
                        <span className="team-member-count">{team.players.length} 人</span>
                        <span className="my-team-label">我的球队</span>
                      </span>
                    ) : viewer?.role === "player" ? (
                      <button
                        className="apply-button"
                        disabled={busy || applied}
                        onClick={() => openApplication(team.id)}
                      >
                        {applied ? "等待审核" : "申请加入"}
                        {!applied && <Plus size={14} />}
                      </button>
                    ) : (
                      <span className="team-member-count">
                        {team.players.length} 人
                      </span>
                    )}
                  </div>
                  <div className="team-title-row">
                    <h3>{team.name}</h3>
                    {own && <span className="team-summary">
                        {canDrop && <button className="small-button" aria-label="编辑球队" title="编辑球队" aria-haspopup="dialog" disabled={busy} onClick={() => {setError(""); setEditedTeamName(team.name); setEditingTeamId(team.id);}}><Pencil className="mobile-action-icon" size={16} aria-hidden="true" /><span className="mobile-action-label">编辑球队</span></button>}
                        <button className="small-button" aria-label="退出球队" title="退出球队" disabled={busy || (viewer?.role === "captain" && team.players.length < 2)} onClick={() => {
                          setError("");
                          if (viewer?.role === "captain") {
                            setSuccessorId(""); setCaptainTeamId(team.id); setCaptainAction("leave_captain");
                          } else setLeaveTeamId(team.id);
                        }}><LogOut className="mobile-action-icon" size={16} aria-hidden="true" /><span className="mobile-action-label">退出球队</span></button>
                    </span>}
                  </div>
                  <div className="roster">
                    {team.players.map((p) => (
                      <div className="roster-player" key={p.id} aria-label={`队员 ${p.name}`}
                        draggable={!busy && p.id === viewer?.id && viewer.role === "player"}
                        onDragStart={(e) => startPlayerDrag(e,p.id,p.name)} onDragEnd={endPlayerDrag}>

                        <span
                          className={`avatar ${p.role === "captain" ? "captain-avatar" : ""}`}
                        >
                          {p.name.slice(0, 1)}
                        </span>
                        <span className="player-name" title={p.name}>
                          <span>{p.name}</span>
                          {p.id === viewer?.id && <small>您</small>}
                        </span>
                        <span className="player-details">
                          <span className={`player-gender gender-icon ${p.gender === "男" ? "male" : p.gender === "女" ? "female" : "neutral"}`} role="img" aria-label={p.gender} title={p.gender}>
                            {p.gender === "男" ? <Mars size={14} aria-hidden="true" /> : p.gender === "女" ? <Venus size={14} aria-hidden="true" /> : p.gender === "非二元性别" ? <NonBinary size={14} aria-hidden="true" /> : <CircleHelp size={14} aria-hidden="true" />}
                          </span>
                          {p.school && <span className="player-school" title={p.school}>{p.school}</span>}
                        </span>
                        {p.role === "captain" && (
                          <span className="captain-tag" aria-label="队长" title="队长">
                            <span className="captain-c" aria-hidden="true">C</span>
                          </span>
                        )}
                        {canDrop && p.role === "player" && (
                          <button
                            className="remove-player-button"
                            aria-label={`移出${p.name}`}
                            title={`移出${p.name}`}
                            disabled={busy}
                            onClick={() => {
                              setError("");
                              setRemovePlayer(p);
                            }}
                          >
                            <Minus size={14} aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {dragOver === team.id && acceptsDrop && (
                    <div className="team-drop-feedback" role="status">
                      <Plus size={18} aria-hidden="true" />
                      {canDrop ? "松开，将球员加入本队" : "松开，申请加入这支球队"}
                    </div>
                  )}
                </article>
              );
            })}
            {dragOver === "create-team" && canCreateTeam && <div className="create-drop-feedback" role="status"><Plus size={18} aria-hidden="true" />松开，创建您的球队</div>}
          </section>
          {!snapshot.teams.length && !canCreateTeam && (
            <div className="empty-state">
              <UsersRound size={28} />
              <h3>还没有球队</h3>
              <p>点击“创建球队”，为您的伙伴组建第一支队伍。</p>
            </div>
          )}
          <section aria-label="自由球员区域" className={`free-section ${dragOver === "free" ? "drop-active" : ""}`}
            onDragOver={(e) => {if (!busy && viewer?.role === "player" && viewer.teamId && e.dataTransfer.types.includes(playerDragType)) {e.preventDefault(); e.dataTransfer.dropEffect="move";setDragOver("free");}}}
            onDragLeave={(e) => {if (!e.currentTarget.contains(e.relatedTarget as Node))setDragOver(null);}}
            onDrop={(e) => {e.preventDefault();setDragOver(null);if (!busy && viewer?.role === "player" && viewer.teamId && e.dataTransfer.getData(playerDragType) === viewer.id) {setError("");setLeaveTeamId(viewer.teamId);}}}>

            <div className="section-heading free-heading">
              <h2>自由球员<span>{snapshot.freePlayers.length}</span></h2>
              <button className="small-button team-contact-button" onClick={() => setTeamContactOpen(true)}>
                <MessageCircle size={16} aria-hidden="true" />联系管理员组队
              </button>
              <p>
                {viewer?.role === "captain"
                  ? "将自由球员卡片拖入您的球队，或点击球员右上角的“＋”邀请加入。"
                  : viewer?.teamId ? "拖动自己的名字到这里可退出球队；也可拖到其他球队申请换队。" : "拖动您的卡片到球队申请加入，或拖到“已集结球队”的空白处创建球队。"}
              </p>
            </div>
            {groupPlayersBySchool(snapshot.freePlayers).map(({ school, players }) => (
              <div className="school-free-group" role="group" aria-label={`${school}自由球员`} key={school}>
                <h3 className="school-group-title">{school}<span>{players.length} 人</span></h3>
                <div className="free-grid">
              {players.map((p) => (
                <article
                  className={`free-card ${p.id === viewer?.id ? "self-card" : ""}`}
                  aria-label={`自由球员 ${p.name}`}
                  key={p.id}
                  draggable={!busy && (viewer?.role === "captain" || p.id === viewer?.id)}
                  onDragStart={(e) => startPlayerDrag(e,p.id,p.name)}
                  onDragEnd={endPlayerDrag}
                >
                  <span className="avatar">{p.name.slice(0, 1)}</span>
                  <h3 className="player-name" title={p.name}>
                    {p.name}
                    {p.id === viewer?.id && <small>您</small>}
                  </h3>
                  <span className="player-details">
                    <span className={`player-gender gender-icon ${p.gender === "男" ? "male" : p.gender === "女" ? "female" : "neutral"}`} role="img" aria-label={p.gender} title={p.gender}>
                      {p.gender === "男" ? <Mars size={14} aria-hidden="true" /> : p.gender === "女" ? <Venus size={14} aria-hidden="true" /> : p.gender === "非二元性别" ? <NonBinary size={14} aria-hidden="true" /> : <CircleHelp size={14} aria-hidden="true" />}
                    </span>
                    {p.school && <span className="player-school" title={p.school}>{p.school}</span>}
                  </span>
                  {viewer?.role === "captain" && (
                    <button className="recruit-button" aria-label="邀请加入我的球队" title="邀请加入我的球队" disabled={busy} onClick={() => setRecruit(p)}>
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  )}
                </article>
              ))}
                </div>
              </div>
            ))}
            {!snapshot.freePlayers.length && (
              <p className="empty-free">选手组队完毕，蓄势待发！</p>
            )}
          </section>
        </main>
      )}
      {loading && view === "teams" && (
        <main className="loading-state" role="status">
          正在获取球队名单…
        </main>
      )}
      <AssociationFooter />
      {applicationTarget && snapshot && (
        <Modal label="申请加入球队" onClose={() => {if (!busy) setApplicationTarget(null);}}>
          <div className="modal-heading"><h2>申请加入球队</h2><button className="icon-button" aria-label="关闭申请" disabled={busy} onClick={() => setApplicationTarget(null)}><X size={20}/></button></div>
          <p className="confirm-copy">申请加入 <strong>{snapshot.teams.find(t => t.id === applicationTarget.teamId)?.name}</strong></p>
          <p className="modal-note">{applicationTarget.sourceTeamId ? "确认后，您将退出当前球队并成为自由球员，同时向这支球队发送申请。新队长批准后才能加入。" : "申请后请耐心等待审批~"}</p>
          <form onSubmit={(e) => {e.preventDefault();void act({action:applicationTarget.sourceTeamId ? "switch_apply" : "apply",teamId:applicationTarget.teamId,...(applicationTarget.sourceTeamId ? {sourceTeamId:applicationTarget.sourceTeamId} : {}),reason:applicationReason});}}>
            <label className="field">申请理由（选填）<textarea aria-label="申请理由（选填）" rows={4} maxLength={500} placeholder="可以介绍自己、参加训练的时间或想要加入的原因" value={applicationReason} disabled={busy} onChange={(e) => setApplicationReason(e.target.value)} /></label>
            {error && <p className="inline-error" role="alert">{error}</p>}
            <div className="modal-actions"><button type="button" className="button secondary" disabled={busy} onClick={() => setApplicationTarget(null)}>取消</button><button className="button primary" disabled={busy}>{busy ? "正在提交…" : applicationTarget.sourceTeamId ? "退出并提交申请" : "提交申请"}</button></div>
          </form>
        </Modal>
      )}
      {leaveTeamId && snapshot && (
        <Modal label="退出球队" onClose={() => {if (!busy) setLeaveTeamId(null);}}>
          <div className="modal-heading"><h2>退出球队</h2><button className="icon-button" aria-label="关闭退出确认" disabled={busy} onClick={() => setLeaveTeamId(null)}><X size={20}/></button></div>
          <p className="confirm-copy">确认退出 <strong>{snapshot.teams.find(t => t.id === leaveTeamId)?.name}</strong>？</p>
          <p className="modal-note">退出后成为自由球员，个人报名信息保留，可以申请加入其他球队。</p>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <div className="modal-actions"><button className="button secondary" disabled={busy} onClick={() => setLeaveTeamId(null)}>取消</button><button className="button primary" disabled={busy} onClick={() => act({action:"leave_team",teamId:leaveTeamId})}>{busy ? "正在退出…" : "确认退出"}</button></div>
        </Modal>
      )}
      {captainAction && snapshot && (
        <Modal label={{transfer_captain:"转让队长",leave_captain:"退出球队",dissolve_team:"解散球队"}[captainAction]} onClose={() => {if (!busy) setCaptainAction(null);}}>
          <div className="modal-heading">
            <h2>{{transfer_captain:"转让队长",leave_captain:"退出球队",dissolve_team:"解散球队"}[captainAction]}</h2>
            <button className="icon-button" aria-label="关闭队长操作" disabled={busy} onClick={() => setCaptainAction(null)}><X size={20}/></button>
          </div>
          <form onSubmit={(e) => {e.preventDefault(); act({action:captainAction,teamId:captainTeamId, ...(captainAction === "dissolve_team" ? {} : {playerId:successorId})});}}>
            <p className="confirm-copy">
              {captainAction === "dissolve_team" ? `确认解散“${snapshot.teams.find(t => t.id === captainTeamId)?.name}”？所有成员将成为自由球员，报名信息会保留，入队申请会移除。` : captainAction === "leave_captain" ? "请选择接任队长。确认后，队长权限会交接给该队员，您将退出球队并成为自由球员。" : "请选择接任队长"}
            </p>
            {captainAction !== "dissolve_team" && <label className="field"><span className="sr-only">接任队长</span>
              <select aria-label="接任队长" value={successorId} required disabled={busy} onChange={(e) => setSuccessorId(e.target.value)}>
                <option value="">请选择本队队员</option>
                {snapshot.teams.find(t => t.id === captainTeamId)?.players.filter(p => p.role === "player").map(p => <option value={p.id} key={p.id}>{p.name}</option>)}
              </select>
            </label>}
            {error && <p className="inline-error" role="alert">{error}</p>}
            <div className="modal-actions">
              <button type="button" className="button secondary" disabled={busy} onClick={() => setCaptainAction(null)}>取消</button>
              <button className="button primary" disabled={busy || (captainAction !== "dissolve_team" && !successorId)}>{busy ? "正在保存…" : {transfer_captain:"确认转让",leave_captain:"交接并退出",dissolve_team:"确认解散"}[captainAction]}</button>
            </div>
          </form>
        </Modal>
      )}
      {createTeamOpen && snapshot && (
        <Modal
          label="创建球队"
          onClose={() => {
            if (!busy) setCreateTeamOpen(false);
          }}
        >
          <div className="modal-heading">
            <h2>创建球队</h2>
            <button
              className="icon-button"
              aria-label="关闭创建球队"
              disabled={busy}
              onClick={() => setCreateTeamOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <form
            className="create-team-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const data = Object.fromEntries(
                new FormData(event.currentTarget),
              );
              await run(
                {
                  action: "create_team",
                  name: data.name,
                  memberIds: selectedMembers,
                },
                async () => {
                  setCreateTeamOpen(false);
                  setSelectedMembers([]);
                  setNotice("球队已创建，您已成为队长，所选队员已加入球队。");
                  await refresh().catch(() =>
                    setNotice("球队已创建；名单暂未刷新，请刷新页面查看。"),
                  );
                },
              );
            }}
          >
            <label className="field">
              队伍名称
              <input
                aria-label="队伍名称"
                name="name"
                placeholder="快来给您的球队起名吧！"
                maxLength={40}
                required
                disabled={busy}
              />
            </label>
            <fieldset className="member-picker" disabled={busy}>
              <legend>
                选择自由球员 <span>已选 {selectedMembers.length} 人</span>
              </legend>
              <p className="modal-note">
                请组建属于您的队伍！后续也可以再招募队友喔~
              </p>
              <div className="member-options">
                {snapshot.freePlayers
                  .filter((p) => p.id !== viewer?.id)
                  .map((p) => (
                    <label className="member-option" key={p.id}>
                      <input
                        type="checkbox"
                        checked={selectedMembers.includes(p.id)}
                        disabled={
                          !selectedMembers.includes(p.id) &&
                          selectedMembers.length >= 80
                        }
                        onChange={(e) =>
                          setSelectedMembers((ids) =>
                            e.target.checked
                              ? [...ids, p.id]
                              : ids.filter((id) => id !== p.id),
                          )
                        }
                      />
                      <span className="avatar">{p.name.slice(0, 1)}</span>
                      <span>
                        <strong>{p.name}</strong>
                        <small>{p.gender}{p.school ? ` · ${p.school}` : ""}</small>
                      </span>
                    </label>
                  ))}
              </div>
              {snapshot.freePlayers.filter((p) => p.id !== viewer?.id)
                .length === 0 && (
                <p className="empty-free">
                  暂时没有其他自由球员，可先创建球队。
                </p>
              )}
            </fieldset>
            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setCreateTeamOpen(false)}
              >
                取消
              </button>
              <button className="button primary" disabled={busy}>
                {busy ? "正在创建…" : "确认创建球队"}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {recruit && snapshot && (
        <Modal
          label="确认加入球队"
          onClose={() => {
            if (!busy) setRecruit(null);
          }}
        >
          <div className="modal-heading">
            <h2>欢迎新的队友</h2>
            <button
              className="icon-button"
              aria-label="关闭确认"
              disabled={busy}
              onClick={() => setRecruit(null)}
            >
              <X size={20} />
            </button>
          </div>
          <p className="confirm-copy recruit-confirm-copy">
            将 <strong>{recruit.name}</strong> 加入{" "}
            <strong>
              {snapshot.teams.find((t) => t.id === viewer?.teamId)?.name}
            </strong>
            ？
          </p>
          <p className="modal-note recruit-confirm-note">确认后，该球员会从自由球员区移至您的队伍</p>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setRecruit(null)}
            >
              取消
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                act({
                  action: "recruit",
                  teamId: viewer!.teamId!,
                  playerId: recruit.id,
                })
              }
            >
              {busy ? "正在加入…" : "确认加入"}
            </button>
          </div>
        </Modal>
      )}
      {removePlayer && snapshot && (
        <Modal
          label="确认移出队员"
          onClose={() => {
            if (!busy) setRemovePlayer(null);
          }}
        >
          <div className="modal-heading">
            <h2>移出球队</h2>
            <button
              className="icon-button"
              aria-label="关闭移出确认"
              disabled={busy}
              onClick={() => setRemovePlayer(null)}
            >
              <X size={20} />
            </button>
          </div>
          <p className="confirm-copy">
            将 <strong>{removePlayer.name}</strong> 移出{" "}
            <strong>
              {snapshot.teams.find((t) => t.id === viewer?.teamId)?.name}
            </strong>
            ？
          </p>
          <p className="modal-note">
            移出后，该队员将进入自由球员区，报名信息会保留。
          </p>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          <div className="modal-actions">
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => setRemovePlayer(null)}
            >
              取消
            </button>
            <button
              className="button primary"
              disabled={busy}
              onClick={() =>
                act({
                  action: "remove",
                  teamId: viewer!.teamId!,
                  playerId: removePlayer.id,
                })
              }
            >
              {busy ? "正在移出…" : "确认移出"}
            </button>
          </div>
        </Modal>
      )}
      {editingTeam && (
        <Modal label="编辑球队" onClose={() => {if (!busy) setEditingTeamId(null);}}>
          <div className="modal-heading"><h2>编辑球队</h2><button className="icon-button" aria-label="关闭编辑球队" disabled={busy} onClick={() => setEditingTeamId(null)}><X size={20}/></button></div>
          {error && <p role="alert" className="feedback error">{error}</p>}
          <div className="team-editor">
            <form onSubmit={e => {e.preventDefault(); void act({action:"rename_team", teamId:editingTeam.id, name:editedTeamName});}}>
              <label className="field">球队名称<input aria-label="球队名称" value={editedTeamName} maxLength={40} required disabled={busy} onChange={e => setEditedTeamName(e.target.value)} /></label>
              <button className="small-button" disabled={busy || !editedTeamName.trim() || editedTeamName.trim() === editingTeam.name}>{busy ? "正在保存…" : "保存队名"}</button>
            </form>
            <div className="team-editor-actions">
              <button className="small-button" disabled={busy || editingTeam.players.length < 2} onClick={() => {setError(""); setSuccessorId(""); setCaptainTeamId(editingTeam.id); setEditingTeamId(null); setCaptainAction("transfer_captain");}}><ArrowRightLeft size={15} aria-hidden="true" />转让队长</button>
              <button className="small-button" disabled={busy} onClick={() => {setError(""); setCaptainTeamId(editingTeam.id); setEditingTeamId(null); setCaptainAction("dissolve_team");}}><Trash2 size={15} aria-hidden="true" />解散球队</button>
            </div>
          </div>
        </Modal>
      )}
      {teamContactOpen && snapshot && (
        <Modal label="联系管理员组队" onClose={() => setTeamContactOpen(false)}>
          <div className="modal-heading">
            <h2>联系管理员组队</h2>
            <button className="icon-button" aria-label="关闭联系方式" onClick={() => setTeamContactOpen(false)}><X size={20} /></button>
          </div>
          <p className="modal-note">暂时找不到队伍？添加管理员微信，协助您联系组队。</p>
          <label className="field admin-wechat">管理员微信号
            <input aria-label="管理员微信号" value="_xhhwyh_" readOnly onFocus={e => e.currentTarget.select()} />
          </label>
          <p className="modal-note">点击微信号可选中复制，添加好友时请备注“北京大学软式曲棍球公开赛+姓名+学校/校友”。</p>
        </Modal>
      )}
      {messagesOpen && snapshot && (
        <Modal
          label="我的消息"
          drawer
          onClose={() => {
            if (!busy) setMessagesOpen(false);
          }}
        >
          <div className="modal-heading">
            <div>
              <h2>我的消息</h2>
            </div>
            <button
              className="icon-button"
              aria-label="关闭消息"
              disabled={busy}
              onClick={() => setMessagesOpen(false)}
            >
              <X size={20} />
            </button>
          </div>

          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {!!snapshot.notifications?.length && <div className="application-list recruitment-notifications">
            {snapshot.notifications.map(n => <article className="application-card" key={n.id}>
              <div className="application-person"><div><strong>{n.message || `${n.actorName}将您加入了「${n.teamName}」`}</strong></div></div>
              <div className="application-bottom"><time dateTime={n.createdAt}>{new Intl.DateTimeFormat("zh-CN", { timeZone: "Asia/Shanghai", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(n.createdAt))}</time><span className="status approved">{n.message ? "管理员调整" : "直接加入"}</span></div>
            </article>)}
          </div>}
          {!snapshot.applications.length ? (
            !snapshot.notifications?.length && <div className="empty-inbox">
              <Bell size={30} />
              <p>暂无消息</p>
            </div>
          ) : (
            <div className="application-list">
              {snapshot.applications.map((a) => (
                <article className="application-card" key={a.id}>
                  <div className="application-person">
                    {viewer?.role === "captain" && <span className="avatar">{a.name.slice(0, 1)}</span>}
                    <div>
                      {viewer?.role === "captain" ? <>
                        <strong>{a.name}</strong>
                        <span>{a.gender} · {([...snapshot.freePlayers, ...snapshot.teams.flatMap(t => t.players)].find(p => p.id === a.playerId)?.school) || "未填写学校"}</span>
                      </> : <strong>申请加入 {a.teamName}</strong>}
                    </div>
                  </div>
                  {viewer?.role === "captain" && a.reason && <p className="application-reason"><strong>申请理由：</strong>{a.reason}</p>}
                  <div className="application-bottom">
                    <time dateTime={a.createdAt}>
                      {new Intl.DateTimeFormat("zh-CN", {
                        timeZone: "Asia/Shanghai",
                        month: "numeric",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(a.createdAt))}
                    </time>
                    {a.status === "pending" && viewer?.role === "captain" ? (
                      <div>
                        <button
                          className="small-button"
                          disabled={busy}
                          onClick={() =>
                            act({ action: "reject", applicationId: a.id })
                          }
                        >
                          拒绝
                        </button>
                        <button
                          className="small-button approve"
                          disabled={busy}
                          onClick={() =>
                            act({ action: "approve", applicationId: a.id })
                          }
                        >
                          批准
                        </button>
                      </div>
                    ) : (
                      <span className={`status ${a.status}`}>
                        {
                          {
                            pending: "等待审核",
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
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
