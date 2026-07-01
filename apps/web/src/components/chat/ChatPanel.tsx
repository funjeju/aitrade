"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { StrategyDSL } from "@ats/strategy-engine";
import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/AuthProvider";
import { getFirebaseDb } from "@/lib/firebase/client";
import { createStrategy } from "@/lib/strategy/strategies";
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

export function ChatPanel({ configured }: { configured: boolean }) {
  const t = useTranslations("aiChat");
  const [items, setItems] = useState<ThreadItem[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const threadRef = useRef<HTMLDivElement>(null);

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
        <>
          <div className={styles.block}>
            <div className={styles.blockHead}>{t("dslTitle")}</div>
            <pre className={styles.code}>{JSON.stringify(reply.dsl, null, 2)}</pre>
          </div>

          {reply.transparency.length > 0 && (
            <div className={styles.block}>
              <div className={styles.blockHead}>{t("transparencyTitle")}</div>
              <table className={styles.table}>
                <tbody>
                  {reply.transparency.map((row, i) => (
                    <tr key={i}>
                      <td>{row.param}</td>
                      <td>{row.formula}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <SaveRow dsl={reply.dsl as StrategyDSL} />
        </>
      )}
    </>
  );
}

type SaveState =
  | { status: "idle" }
  | { status: "saving" }
  | { status: "saved" }
  | { status: "error"; message: string };

function SaveRow({ dsl }: { dsl: StrategyDSL }) {
  const t = useTranslations("aiChat");
  const { user } = useAuth();
  const [state, setState] = useState<SaveState>({ status: "idle" });

  async function save() {
    if (!user) return;
    const name = window.prompt(t("saveNamePrompt"));
    if (!name) return;
    const db = getFirebaseDb();
    if (!db) {
      setState({ status: "error", message: t("saveFailed") });
      return;
    }
    setState({ status: "saving" });
    try {
      await createStrategy(db, user.uid, { name, dsl });
      setState({ status: "saved" });
    } catch (e) {
      setState({ status: "error", message: e instanceof Error ? e.message : t("saveFailed") });
    }
  }

  return (
    <div className={styles.block}>
      <div className={styles.saveRow}>
        {!user ? (
          <>
            <Link href="/login" className={styles.saveBtn}>
              {t("saveNeedLogin")}
            </Link>
          </>
        ) : state.status === "saved" ? (
          <span className={styles.saveNote}>✓ {t("saved")}</span>
        ) : (
          <button
            className={styles.saveBtn}
            onClick={() => void save()}
            disabled={state.status === "saving"}
          >
            {state.status === "saving" ? t("saving") : t("saveDraft")}
          </button>
        )}
        {state.status === "error" && (
          <span className={styles.saveNote}>✗ {state.message}</span>
        )}
        {state.status === "idle" && user && (
          <span className={styles.saveNote}>{t("saveNote")}</span>
        )}
      </div>
    </div>
  );
}
