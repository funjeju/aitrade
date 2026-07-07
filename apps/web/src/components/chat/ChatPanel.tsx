"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { StrategyDSL } from "@ats/strategy-engine";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import {
  createStrategy,
  addStrategyVersion,
  listStrategies,
  type StrategySummary,
} from "@/lib/strategy/strategies";
import styles from "./ChatPanel.module.css";

type Turn = { role: "user" | "assistant"; content: string };

type AiReply = {
  mode: "ask" | "draft";
  reply: string;
  questions: string[];
  dsl: unknown | null;
  transparency: Array<{ param: string; formula: string }>;
};

type ThreadItem =
  | { kind: "user"; text: string }
  | { kind: "ai"; reply: AiReply };

const THREAD_KEY = "ats-chat-thread";

export function ChatPanel({ configured }: { configured: boolean }) {
  const t = useTranslations("aiChat");
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  // 마운트 시 이 브라우저에 저장된 대화 복원.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(THREAD_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as ThreadItem[];
        if (Array.isArray(saved) && saved.length > 0) {
          setItems(saved);
          setRestored(true);
        }
      }
    } catch {
      /* 손상 시 무시 */
    }
  }, []);

  // 대화가 바뀔 때마다 저장(사라지지 않게).
  useEffect(() => {
    try {
      if (items.length > 0) localStorage.setItem(THREAD_KEY, JSON.stringify(items));
    } catch {
      /* 용량 초과 등 무시 */
    }
  }, [items]);

  function clearChat() {
    setItems([]);
    setRestored(false);
    try {
      localStorage.removeItem(THREAD_KEY);
    } catch {
      /* 무시 */
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setError(null);
    setBusy(true);
    setInput("");

    const nextItems: ThreadItem[] = [...items, { kind: "user", text }];
    setItems(nextItems);

    // 서버로 보낼 대화 히스토리(user/assistant 텍스트만)
    const turns: Turn[] = nextItems.map((it) =>
      it.kind === "user"
        ? { role: "user", content: it.text }
        : { role: "assistant", content: it.reply.reply },
    );

    try {
      const res = await fetch("/api/strategy/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ turns }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.message || t("error"));
      } else {
        setItems((prev) => [...prev, { kind: "ai", reply: data as AiReply }]);
      }
    } catch {
      setError(t("error"));
    } finally {
      setBusy(false);
      requestAnimationFrame(() => {
        threadRef.current?.scrollTo({ top: threadRef.current.scrollHeight });
      });
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  }

  if (!configured) {
    return <p className={styles.err}>{t("notConfigured")}</p>;
  }

  return (
    <div className={styles.wrap}>
      {items.length > 0 && (
        <div className={styles.toolbar}>
          {restored && <span className={styles.restored}>{t("restored")}</span>}
          <button type="button" className={styles.newChatBtn} onClick={clearChat}>
            {t("newChat")}
          </button>
        </div>
      )}
      <div className={styles.thread} ref={threadRef}>
        {items.length === 0 && <p className={styles.intro}>{t("intro")}</p>}
        {items.map((it, i) =>
          it.kind === "user" ? (
            <div key={i} className={`${styles.msg} ${styles.user}`}>
              {it.text}
            </div>
          ) : (
            <AiMessage key={i} reply={it.reply} />
          ),
        )}
      </div>

      {error && <p className={styles.err}>{error}</p>}

      <div className={styles.composer}>
        <textarea
          className={styles.input}
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t("placeholder")}
          disabled={busy}
        />
        <button className={styles.sendBtn} onClick={() => void send()} disabled={busy}>
          {busy ? t("sending") : t("send")}
        </button>
      </div>

      <p className={styles.disclaimer}>{t("disclaimer")}</p>
    </div>
  );
}

function AiMessage({ reply }: { reply: AiReply }) {
  const t = useTranslations("aiChat");
  return (
    <>
      {reply.reply && <div className={`${styles.msg} ${styles.ai}`}>{reply.reply}</div>}

      {reply.mode === "ask" && reply.questions.length > 0 && (
        <div className={styles.block}>
          <div className={styles.blockHead}>{t("questionsTitle")}</div>
          <ol className={styles.questions}>
            {reply.questions.map((q, i) => (
              <li key={i}>{q}</li>
            ))}
          </ol>
        </div>
      )}

      {reply.mode === "draft" && reply.dsl != null && (
        <DraftView dsl={reply.dsl as StrategyDSL} transparency={reply.transparency} />
      )}
    </>
  );
}

type TRow = { param: string; formula: string };

/** DSL/transparency를 조건검색·매매기준 두 섹션으로 나눠 보여준다. */
function DraftView({ dsl, transparency }: { dsl: StrategyDSL; transparency: TRow[] }) {
  const t = useTranslations("aiChat");

  // 조건검색: 어떤 종목을 찾을지
  const screeningDsl = {
    universe: dsl.universe,
    referenceCandle: dsl.referenceCandle,
    pullback: dsl.entry.pullback,
    volumeHealth: dsl.entry.volumeHealth,
    maSlope: dsl.entry.maSlope,
  };
  // 매매기준: 찾은 종목을 어떻게 매매할지
  const tradingDsl = {
    splits: dsl.entry.splits,
    exit: dsl.exit,
  };

  const isTrading = (p: string) =>
    p.startsWith("entry.splits") || p.startsWith("exit") || p.startsWith("splits");
  const screeningRows = transparency.filter((r) => !isTrading(r.param));
  const tradingRows = transparency.filter((r) => isTrading(r.param));

  return (
    <>
      <Section
        title={t("screeningTitle")}
        hint={t("screeningHint")}
        dsl={screeningDsl}
        rows={screeningRows}
      />
      <Section
        title={t("tradingTitle")}
        hint={t("tradingHint")}
        dsl={tradingDsl}
        rows={tradingRows}
      />
      <SaveRow dsl={dsl} />
    </>
  );
}

function Section({
  title,
  hint,
  dsl,
  rows,
}: {
  title: string;
  hint: string;
  dsl: unknown;
  rows: TRow[];
}) {
  const t = useTranslations("aiChat");
  return (
    <div className={styles.block}>
      <div className={styles.blockHead}>{title}</div>
      <p className={styles.sectionHint}>{hint}</p>
      <pre className={styles.code}>{JSON.stringify(dsl, null, 2)}</pre>
      {rows.length > 0 && (
        <table className={styles.table}>
          <thead>
            <tr>
              <td colSpan={2} className={styles.tableCaption}>
                {t("transparencyTitle")}
              </td>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td>{row.param}</td>
                <td>{row.formula}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "savedNew" }
  | { status: "savedVersion" }
  | { status: "error"; message: string };

function SaveRow({ dsl }: { dsl: StrategyDSL }) {
  const t = useTranslations("aiChat");
  const { user } = useAuth();
  const [state, setState] = useState<SaveState>({ status: "idle" });
  const [mode, setMode] = useState<"new" | "version">("new");
  const [strategies, setStrategies] = useState<StrategySummary[]>([]);
  const [targetId, setTargetId] = useState("");
  const [summary, setSummary] = useState("");

  useEffect(() => {
    if (!user) return;
    const db = getFirebaseDb();
    if (!db) return;
    let alive = true;
    listStrategies(db, user.uid)
      .then((items) => {
        if (!alive) return;
        setStrategies(items);
        if (items[0]) setTargetId(items[0].id);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  async function save() {
    if (!user) return;
    const db = getFirebaseDb();
    if (!db) {
      setState({ status: "error", message: t("saveFailed") });
      return;
    }
    setState({ status: "saving" });
    try {
      if (mode === "version" && targetId) {
        await addStrategyVersion(db, user.uid, targetId, { dsl, changeSummary: summary });
        setState({ status: "savedVersion" });
      } else {
        const name = window.prompt(t("saveNamePrompt"));
        if (!name) {
          setState({ status: "idle" });
          return;
        }
        await createStrategy(db, user.uid, { name, dsl });
        setState({ status: "savedNew" });
      }
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : t("saveFailed") });
    }
  }

  if (!user) {
    return (
      <div className={styles.block}>
        <div className={styles.saveRow}>
          <Link href="/login" className={styles.saveBtn}>
            {t("saveNeedLogin")}
          </Link>
        </div>
      </div>
    );
  }

  if (state.status === "savedNew" || state.status === "savedVersion") {
    return (
      <div className={styles.block}>
        <div className={styles.saveBody}>
          <span className={styles.saveNote}>
            ✓ {state.status === "savedVersion" ? t("savedVersion") : t("saved")}
          </span>
          <Link href="/scanner" className={styles.scanLink}>
            {t("goScan")}
          </Link>
          <span className={styles.saveNote}>{t("scanNote")}</span>
        </div>
      </div>
    );
  }

  const canVersion = strategies.length > 0;

  return (
    <div className={styles.block}>
      <div className={styles.saveBody}>
        <div className={styles.saveModes}>
          <button
            type="button"
            className={`${styles.modeBtn} ${mode === "new" ? styles.modeActive : ""}`}
            onClick={() => setMode("new")}
          >
            {t("saveAsNew")}
          </button>
          {canVersion && (
            <button
              type="button"
              className={`${styles.modeBtn} ${mode === "version" ? styles.modeActive : ""}`}
              onClick={() => setMode("version")}
            >
              {t("saveAsVersion")}
            </button>
          )}
        </div>

        {mode === "version" && canVersion && (
          <div className={styles.saveFields}>
            <select
              className={styles.saveSelect}
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              aria-label={t("pickStrategy")}
            >
              {strategies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.currentVersion})
                </option>
              ))}
            </select>
            <input
              className={styles.saveInput}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder={t("changeSummaryPlaceholder")}
              aria-label={t("changeSummary")}
            />
          </div>
        )}

        <div className={styles.saveRow}>
          <button
            className={styles.saveBtn}
            onClick={() => void save()}
            disabled={state.status === "saving"}
          >
            {state.status === "saving" ? t("saving") : t("saveDraft")}
          </button>
          {state.status === "error" && (
            <span className={styles.saveNote}>✗ {state.message}</span>
          )}
          {state.status === "idle" && <span className={styles.saveNote}>{t("saveNote")}</span>}
        </div>
      </div>
    </div>
  );
}
