"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  CircleDot,
  Crown,
  GripVertical,
  LogOut,
  Phone,
  Plus,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import AdminPanel from "./admin-panel";
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
  return data;
}
function Modal({
  label,
  children,
  onClose,
  drawer = false,
}: {
  label: string;
  children: React.ReactNode;
  onClose: () => void;
  drawer?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
    const node = ref.current;
    return () => node?.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={drawer ? "modal drawer" : "modal"}
      aria-label={label}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          const r = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < r.left ||
            event.clientX > r.right ||
            event.clientY < r.top ||
            event.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      {children}
    </dialog>
  );
}
export default function RegistrationApp({
  initialView,
}: {
  initialView: View;
}) {
  const [adminOpen, setAdminOpen] = useState(false);
  const [view, setView] = useState<View>(initialView),
    [state, setState] = useState<PublicState>(empty),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false);
  const [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [registered, setRegistered] = useState(false),
    [alreadyRegistered, setAlreadyRegistered] = useState(false),
    [needPhone, setNeedPhone] = useState(false);
  const [messagesOpen, setMessagesOpen] = useState(false),
    [recruit, setRecruit] = useState<Player | null>(null),
    [removePlayer, setRemovePlayer] = useState<Player | null>(null),
    [dragOver, setDragOver] = useState<string | null>(null),
    [createTeamOpen, setCreateTeamOpen] = useState(false),
    [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [applicationTarget, setApplicationTarget] = useState<{teamId:string; sourceTeamId:string|null} | null>(null);
  const [applicationReason, setApplicationReason] = useState("");
  const [ballRotation, setBallRotation] = useState({ x: 0, y: 0 });
  const [ballJump, setBallJump] = useState(false);
  const ballDrag = useRef({ active: false, moved: false, x: 0, y: 0 });
  const [leaveTeamId, setLeaveTeamId] = useState<string | null>(null);
  const [captainAction, setCaptainAction] = useState<"transfer_captain" | "leave_captain" | "dissolve_team" | null>(null);
  const [captainTeamId, setCaptainTeamId] = useState("");
  const [successorId, setSuccessorId] = useState("");
  const snapshot = state.snapshot,
    viewer = snapshot?.viewer;
  const canCreateTeam = viewer?.role === "player" && !viewer.teamId;
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
      setSuccessorId("");
    }
  }, [snapshot, captainAction, captainTeamId]);
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
  function startPlayerDrag(event: React.DragEvent, id: string) {
    event.dataTransfer.setData("text/plain", id);
    event.dataTransfer.setData(playerDragType, id);
    event.dataTransfer.effectAllowed = "move";
  }
  function go(next: View) {
    setView(next);
    setError("");
    setNotice("");
    setRegistered(false);
    setAlreadyRegistered(false);
    setNeedPhone(false);
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
  const refresh = useCallback(async () => {
    const data: PublicState = await request();
    setState(data);
    return data;
  }, []);
  useEffect(() => {
    let active = true;
    request()
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
      if (e instanceof ApiError && e.code === "NEED_PHONE") setNeedPhone(true);
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
      setCaptainAction(null);
      setSuccessorId("");
      setRecruit(null);
      setRemovePlayer(null);
      setNotice(
        input.action === "leave_team"
          ? "你已退出球队，成为自由球员。"
          : input.action === "switch_apply"
          ? "你已退出原球队，入队申请已发送，请等待新队长审核。"
          : input.action === "transfer_captain"
          ? "队长已转让，你仍是本队队员。"
          : input.action === "leave_captain"
          ? "队长已交接，你已成为自由球员。"
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
  const pending =
    snapshot?.applications.filter((a) => a.status === "pending").length ?? 0;
  const unavailable = loading || state.mode === "unconfigured";
  function startBallDrag(event: React.PointerEvent<HTMLDivElement>) {
    ballDrag.current = { active: true, moved: false, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveBall(event: React.PointerEvent<HTMLDivElement>) {
    if (!ballDrag.current.active) return;
    const dx = event.clientX - ballDrag.current.x;
    const dy = event.clientY - ballDrag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) ballDrag.current.moved = true;
    ballDrag.current.x = event.clientX;
    ballDrag.current.y = event.clientY;
    setBallRotation((rotation) => ({ x: rotation.x + dy * 0.35, y: rotation.y + dx * 0.35 }));
  }
  function endBallDrag() {
    if (!ballDrag.current.active) return;
    if (!ballDrag.current.moved) {
      setBallJump(false);
      requestAnimationFrame(() => setBallJump(true));
      window.setTimeout(() => setBallJump(false), 700);
    }
    ballDrag.current.active = false;
  }
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
      <header className="site-header">
        <a className="brand" href="/" aria-label="北京大学软式曲棍球">
          <span className="brand-symbol">
            <CircleDot size={28} />
          </span>
          <span>
            <strong>北京大学软式曲棍球</strong>
          </span>
        </a>
        <span className="header-divider" />
        <span className="header-label">球队报名站</span>
        <div className="header-actions">
          {viewer ? (
            <>
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
              <button
                className="icon-button"
                aria-label="退出登录"
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
            </>
          ) : (
            <span className="header-note">一支球队，一群伙伴。</span>
          )}
        </div>
      </header>
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
        <div className="feedback success" role="status">
          <CheckCircle2 size={18} />
          {notice}
        </div>
      )}
      {view === "home" && (
        <main className="home-main">
          <section className="hero">
            <div className="hero-copy">
              <div className="eyebrow">
                <span />
                PKU FLOORBALL · TEAM REGISTRATION
              </div>
              <h1>
                <span className="hero-kicker">PKU</span>
                <span className="hero-title-en">Floorball<span>.</span></span>
                <em>公开赛</em>
              </h1>
              <div className="hero-actions">
                <button
                  className="button primary"
                  onClick={() => go("register")}
                >
                  立即注册
                  <ArrowUpRight size={19} />
                </button>
                <button
                  className="button secondary"
                  onClick={() => go("login")}
                >
                  登录
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
            <div className="hero-ball-stage" aria-label="软式曲棍球视觉元素">
              <div className={`hero-ball${ballJump ? " is-jumping" : ""}`} style={{ transform: `rotateX(${ballRotation.x}deg) rotateY(${ballRotation.y}deg)` }} onPointerDown={startBallDrag} onPointerMove={moveBall} onPointerUp={endBallDrag} onPointerCancel={endBallDrag} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); setBallJump(false); requestAnimationFrame(() => setBallJump(true)); window.setTimeout(() => setBallJump(false), 700); } }} role="button" tabIndex={0} aria-label="拖动旋转或点击弹跳">
                {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
              </div>
              <span className="hero-orbit hero-orbit-one" />
              <span className="hero-orbit hero-orbit-two" />
            </div>
          </section>
        </main>
      )}
      {(view === "login" || view === "register") && (
        <main className="auth-main">
          <section className="auth-copy">
            <button className="back-link" onClick={() => go("home")}>
              <ChevronLeft size={16} />
              返回首页
            </button>
            <div className="eyebrow">
              {view === "register" ? "JOIN THE GAME" : "WELCOME BACK"}
            </div>
            <h1>
              {view === "register" ? (
                <>
                  你的球队，
                  <br />
                  从这里开始。
                </>
              ) : (
                <>
                  好久不见，
                  <br />
                  准备上场。
                </>
              )}
            </h1>
            <p>
              {view === "register"
                ? "无论是带队出发，还是寻找伙伴，都欢迎加入。"
                : "输入报名时填写的姓名，看看你的队友们。"}
            </p>
            <div className="auth-note">
              <UsersRound size={20} />
              <span>
                无需密码 · 简单报名
                <br />
                <small>姓名用于选择报名身份，不验证本人。</small>
              </span>
            </div>
            <span className="auth-watermark" aria-hidden="true">
              FLOOR
              <br />
              BALL.
            </span>
          </section>
          <section className="auth-card">
            {view === "register" && registered ? (
              <div className="registered">
                <span className="success-symbol">
                  <Check size={34} />
                </span>
                <h2>{alreadyRegistered ? "你已经注册过了" : "报名成功！"}</h2>
                <p>{alreadyRegistered ? "直接登录即可，无需重复报名。" : "你的个人信息已保存，登录后可创建球队或申请加入球队。"}</p>
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
                  <h2>{view === "register" ? "创建报名身份" : "登录报名站"}</h2>
                  <p>
                    {view === "register"
                      ? "填写信息，开启你的组队之旅。"
                      : "使用注册时的姓名进入球队大厅。"}
                  </p>
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
                      </select>
                    </label>
                    <label className="field">
                      学校信息
                      <input aria-label="学校信息" name="school" placeholder="例如：北京大学 / 北京大学校友" maxLength={80} required />
                    </label>
                    <label className="field">
                      手机号
                      <input
                        aria-label="手机号"
                        name="phone"
                        type="tel"
                        placeholder="用于联系与重名区分"
                        autoComplete="tel"
                        inputMode="numeric"
                        pattern="1[3-9][0-9]{9}"
                        maxLength={11}
                        required
                      />
                    </label>
                    <p className="privacy-note">
                      <ShieldCheck size={14} />
                      报名后先作为自由球员。创建球队后，你的手机号将作为队长联系方式展示。
                    </p>
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
                      <span>报名者登录</span>
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
                    {needPhone && (
                      <label className="field">
                        手机号
                        <input
                          aria-label="手机号"
                          name="phone"
                          type="tel"
                          placeholder="输入报名时的手机号"
                          autoComplete="tel"
                          pattern="1[3-9][0-9]{9}"
                          maxLength={11}
                          required
                          autoFocus
                        />
                        <small>有同名报名者，请用手机号区分。</small>
                      </label>
                    )}
                    <div className="login-hint">
                      <CircleDot size={17} />
                      <span>
                        无需密码，姓名即可进入。
                        <br />
                        如遇重名，再补充手机号。
                      </span>
                    </div>
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
              <div className="eyebrow">THE TEAM BOARD</div>
              <h1>
                球队大厅<span>一起集结，准备上场。</span>
              </h1>
            </div>
            <div className="board-actions">
              <button
                className="button secondary messages-button"
                onClick={() => setMessagesOpen(true)}
              >
                <Bell size={18} />
                {viewer?.role === "captain" ? "查看消息" : "我的申请"}
                {pending > 0 && <span className="count-badge">{pending}</span>}
              </button>
            </div>
          </div>
          <div className="section-heading">
            <h2>
              已集结球队<span>{snapshot.teams.length}</span>
            </h2>
            <span className="refresh-note">
              <span className="tiny-dot" />每 15 秒同步名单
            </span>
          </div>
          <section className="teams-grid" aria-label="球队名单"
            onDragOver={(e) => {
              if ((e.target as HTMLElement).closest(".team-card")) return;
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
                      <span className="my-team-label">我的球队</span>
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
                  <h3>{team.name}</h3>
                  <div className="roster">
                    {team.players.map((p) => (
                      <div className="roster-player" key={p.id} aria-label={`队员 ${p.name}`}
                        draggable={!busy && p.id === viewer?.id && viewer.role === "player"}
                        onDragStart={(e) => startPlayerDrag(e,p.id)} onDragEnd={() => setDragOver(null)}>

                        <span
                          className={`avatar ${p.role === "captain" ? "captain-avatar" : ""}`}
                        >
                          {p.name.slice(0, 1)}
                        </span>
                        <span className="player-name">
                          <span>{p.name}</span>
                          {p.id === viewer?.id && <small>你</small>}
                          {p.school && <span className="player-school">{p.school}</span>}
                        </span>
                        {p.role === "captain" ? (
                          <span className="captain-tag">
                            <Crown size={12} />
                            队长
                          </span>
                        ) : (
                          <span className="player-gender">{p.gender}</span>
                        )}
                        {canDrop && p.role === "player" && (
                          <button
                            className="remove-player-button"
                            aria-label={`移出${p.name}`}
                            disabled={busy}
                            onClick={() => {
                              setError("");
                              setRemovePlayer(p);
                            }}
                          >
                            移出
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {canDrop && (
                    <div className="drop-hint">
                      <Plus size={14} />
                      {dragOver === team.id
                        ? "松开，将球员加入本队"
                        : "拖入自由球员，或点击下方招募按钮"}
                    </div>
                  )}
                  {own && viewer?.role === "player" && (
                    <div className="member-controls">
                      <p className="modal-note">拖动自己的名字到自由球员区可退出；拖到其他球队可退出并申请加入。</p>
                      <button className="small-button" disabled={busy} onClick={() => {setError(""); setLeaveTeamId(team.id);}}>退出球队</button>
                    </div>
                  )}
                  {canDrop && (
                    <div className="captain-controls">
                      <div>
                        {(["transfer_captain", "leave_captain", "dissolve_team"] as const).map((action) => (
                          <button key={action} className="small-button" disabled={busy || (action !== "dissolve_team" && team.players.length < 2)} onClick={() => {setError(""); setSuccessorId(""); setCaptainTeamId(team.id); setCaptainAction(action);}}>
                            {{transfer_captain:"转让队长",leave_captain:"退出球队",dissolve_team:"解散球队"}[action]}
                          </button>
                        ))}
                      </div>
                      {team.players.length < 2 && <p className="modal-note">本队暂无其他队员，无法交接或退出；可先招募队员，或解散球队。</p>}
                    </div>
                  )}
                  <div className="team-contact">
                    <span>
                      <Phone size={14} />
                      队长联系
                    </span>
                    <a href={`tel:${team.captainPhone}`}>
                      {team.captainPhone}
                      <ArrowUpRight size={13} />
                    </a>
                  </div>
                </article>
              );
            })}
            {canCreateTeam && (
              <div role="group" aria-label="创建球队区域"
                className={`create-team-dropzone ${dragOver === "create-team" ? "drop-active" : ""}`}>
                <Plus size={28} aria-hidden="true" />
                <h3>创建一支新球队</h3>
                <p>把自己的自由球员卡片拖到这里，填写队名后创建球队。</p>
                <button className="button secondary" disabled={busy} onClick={openCreateTeam}>点击建队</button>
              </div>
            )}
          </section>
          {!snapshot.teams.length && !canCreateTeam && (
            <div className="empty-state">
              <UsersRound size={28} />
              <h3>还没有球队</h3>
              <p>点击“创建球队”，为你的伙伴组建第一支队伍。</p>
            </div>
          )}
          <section aria-label="自由球员区域" className={`free-section ${dragOver === "free" ? "drop-active" : ""}`}
            onDragOver={(e) => {if (!busy && viewer?.role === "player" && viewer.teamId && e.dataTransfer.types.includes(playerDragType)) {e.preventDefault(); e.dataTransfer.dropEffect="move";setDragOver("free");}}}
            onDragLeave={(e) => {if (!e.currentTarget.contains(e.relatedTarget as Node))setDragOver(null);}}
            onDrop={(e) => {e.preventDefault();setDragOver(null);if (!busy && viewer?.role === "player" && viewer.teamId && e.dataTransfer.getData(playerDragType) === viewer.id) {setError("");setLeaveTeamId(viewer.teamId);}}}>

            <div className="section-heading">
              <div>
                <h2>
                  自由球员<span>{snapshot.freePlayers.length}</span>
                </h2>
                <p>
                  {viewer?.role === "captain"
                    ? "把伙伴拖进自己的球队，或点击按钮邀请入队。"
                    : viewer?.teamId ? "拖动自己的名字到这里可退出球队；也可拖到其他球队申请换队。" : "拖动自己的卡片到已有球队可申请加入，拖到球队区域空白处可创建球队，也可使用按钮操作。"}
                </p>
              </div>
              <span className="free-label">
                <CircleDot size={14} />
                等待一起上场
              </span>
            </div>
            <div className="free-grid">
              {snapshot.freePlayers.map((p) => (
                <article
                  className={`free-card ${p.id === viewer?.id ? "self-card" : ""}`}
                  aria-label={`自由球员 ${p.name}`}
                  key={p.id}
                  draggable={!busy && (viewer?.role === "captain" || p.id === viewer?.id)}
                  onDragStart={(e) => startPlayerDrag(e,p.id)}
                  onDragEnd={() => setDragOver(null)}
                >
                  <span className="avatar">{p.name.slice(0, 1)}</span>
                  <div>
                    <h3>
                      {p.name}
                      {p.id === viewer?.id && <small>你</small>}
                    </h3>
                    <span className="player-gender">{p.gender} · 自由球员</span>
                    {p.school && <span className="player-school">{p.school}</span>}
                  </div>
                  {viewer?.role === "captain" && (
                    <>
                      <GripVertical className="drag-handle" size={16} />
                      <button
                        className="recruit-button"
                        aria-label="加入我的球队"
                        disabled={busy}
                        onClick={() => setRecruit(p)}
                      >
                        <Plus size={16} />
                        <span>加入我的球队</span>
                      </button>
                    </>
                  )}
                </article>
              ))}
            </div>
            {!snapshot.freePlayers.length && (
              <p className="empty-free">所有伙伴都已找到球队，期待一起上场。</p>
            )}
          </section>
        </main>
      )}
      {loading && view === "teams" && (
        <main className="loading-state" role="status">
          正在获取球队名单…
        </main>
      )}
      <footer className="site-footer">
        <span>北京大学软式曲棍球协会</span>
        <span>PLAY TOGETHER, GROW TOGETHER.</span>
      </footer>
      {applicationTarget && snapshot && (
        <Modal label="申请加入球队" onClose={() => {if (!busy) setApplicationTarget(null);}}>
          <div className="modal-heading"><h2>申请加入球队</h2><button className="icon-button" aria-label="关闭申请" disabled={busy} onClick={() => setApplicationTarget(null)}><X size={20}/></button></div>
          <p className="confirm-copy">申请加入 <strong>{snapshot.teams.find(t => t.id === applicationTarget.teamId)?.name}</strong></p>
          <p className="modal-note">{applicationTarget.sourceTeamId ? "确认后，你将退出当前球队并成为自由球员，同时向这支球队发送申请。新队长批准后才能加入。" : "申请发送后需等待队长批准，批准前仍是自由球员。"}</p>
          <form onSubmit={(e) => {e.preventDefault();void act({action:applicationTarget.sourceTeamId ? "switch_apply" : "apply",teamId:applicationTarget.teamId,...(applicationTarget.sourceTeamId ? {sourceTeamId:applicationTarget.sourceTeamId} : {}),reason:applicationReason});}}>
            <label className="field">申请理由（选填）<textarea aria-label="申请理由（选填）" rows={4} maxLength={500} placeholder="可以介绍自己、参加训练的时间或想加入的原因，不填写也能申请。" value={applicationReason} disabled={busy} onChange={(e) => setApplicationReason(e.target.value)} /></label>
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
              {captainAction === "dissolve_team" ? `确认解散“${snapshot.teams.find(t => t.id === captainTeamId)?.name}”？所有成员将成为自由球员，报名信息会保留，入队申请会移除。` : captainAction === "leave_captain" ? "请选择接任队长。确认后，队长权限会交接给该队员，你将退出球队并成为自由球员。" : "请选择接任队长。确认后，你仍留在本队，成为普通队员。"}
            </p>
            {captainAction !== "dissolve_team" && <label className="field">接任队长
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
                  setNotice("球队已创建，你已成为队长，所选队员已加入球队。");
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
                placeholder="给你的球队起一个名字"
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
                你将成为队长，勾选的伙伴直接加入球队。也可以先创建，再招募队员。
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
            <p className="modal-note">
              队名不可重复；你的手机号将显示为队长联系方式。
            </p>
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
          <p className="confirm-copy">
            将 <strong>{recruit.name}</strong> 加入{" "}
            <strong>
              {snapshot.teams.find((t) => t.id === viewer?.teamId)?.name}
            </strong>
            ？
          </p>
          <p className="modal-note">确认后，该球员会从自由球员区移至本队。</p>
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
      {messagesOpen && snapshot && (
        <Modal
          label={viewer?.role === "captain" ? "入队申请消息" : "我的申请"}
          drawer
          onClose={() => {
            if (!busy) setMessagesOpen(false);
          }}
        >
          <div className="modal-heading">
            <div>
              <div className="eyebrow">TEAM INBOX</div>
              <h2>{viewer?.role === "captain" ? "入队申请" : "我的申请"}</h2>
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
          <p className="modal-note">
            {viewer?.role === "captain"
              ? "看看谁想和你一起上场。"
              : "查看队长的处理结果。"}
          </p>
          {error && (
            <p className="inline-error" role="alert">
              {error}
            </p>
          )}
          {!snapshot.applications.length ? (
            <div className="empty-inbox">
              <Bell size={30} />
              <p>暂无申请消息</p>
            </div>
          ) : (
            <div className="application-list">
              {snapshot.applications.map((a) => (
                <article className="application-card" key={a.id}>
                  <div className="application-person">
                    <span className="avatar">{a.name.slice(0, 1)}</span>
                    <div>
                      <strong>{a.name}</strong>
                      <span>
                        {a.gender} · 申请加入 {a.teamName}
                      </span>
                    </div>
                  </div>
                  {a.reason && <p className="application-reason"><strong>申请理由：</strong>{a.reason}</p>}
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
