"use client";

import { cn } from "cn";
import { ArrowUp, Loader2, Mic, Undo2 } from "lucide-react";
import Link from "next/link";
import { useRef, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { editEntryAction } from "@/app/(app)/actions";
import { type ChloeReply, chloeCommandAction } from "@/app/(app)/chloe-actions";

const OWNER = "Cauã";

const EXAMPLES = ["me lembra daqui a pouco de beber água", "o que tenho amanhã?", "dia 20 tenho prova às 19h", "anota: ideia para o Axial"];

interface Recognition {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start(): void;
  stop(): void;
}
type RecognitionCtor = new () => Recognition;

function speechApi(): RecognitionCtor | null {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noSubscribe = () => () => {};

function greeting(now: number) {
  const hour = Number(new Date(now).toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hourCycle: "h23" }));
  return hour < 5 ? "Boa madrugada" : hour < 12 ? "Bom dia" : hour < 18 ? "Boa tarde" : "Boa noite";
}

/** Chloe's command bar: greets by the hour and runs short requests right away. */
export function ChloeCommand({ now }: { now: number }) {
  const [text, setText] = useState("");
  const [answer, setAnswer] = useState<ChloeReply | null>(null);
  const [listening, setListening] = useState(false);
  const [pending, startTransition] = useTransition();
  const recognition = useRef<Recognition | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const canListen = useSyncExternalStore(noSubscribe, () => !!speechApi(), () => false);

  function send(value = text) {
    const request = value.trim();
    if (!request || pending) return;
    startTransition(async () => {
      const result = await chloeCommandAction(request);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setAnswer(result.data);
      setText("");
    });
  }

  function undo(id: string) {
    startTransition(async () => {
      const result = await editEntryAction({ id, arquivado: true });
      if (!result.ok) toast.error(result.error);
      else setAnswer({ reply: "Desfeito." });
    });
  }

  function listen() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const Api = speechApi();
    if (!Api) return;
    const rec = new Api();
    rec.lang = "pt-BR";
    rec.interimResults = true;
    let heard = "";
    rec.onresult = (event) => {
      heard = Array.from(event.results, (result) => result[0].transcript).join(" ");
      setText(heard);
    };
    rec.onerror = () => toast.error("Não consegui ouvir. Verifique a permissão do microfone.");
    rec.onend = () => {
      setListening(false);
      if (heard.trim()) send(heard);
    };
    recognition.current = rec;
    setListening(true);
    rec.start();
  }

  return (
    <section className="glass border-beam rounded-2xl p-4 animate-in fade-in-0 duration-300 md:p-5">
      <p className="label-mono text-lilac">chloe</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">
        {greeting(now)}, {OWNER}.
      </h1>
      <p className="text-sm text-muted-foreground md:text-base">O que você quer hoje?</p>

      <form
        className="mt-3 flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          send();
        }}
      >
        <input
          ref={input}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={listening ? "Ouvindo…" : "Peça algo: lembrete, evento, nota, agenda…"}
          aria-label="Pedido para a Chloe"
          enterKeyHint="send"
          maxLength={500}
          className="h-12 min-w-0 flex-1 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-base outline-none transition-colors duration-150 placeholder:text-muted-foreground/70 focus:border-primary/60"
        />
        {canListen && (
          <button
            type="button"
            onClick={listen}
            aria-label={listening ? "Parar de ouvir" : "Falar"}
            className={cn(
              "grid size-12 shrink-0 place-items-center rounded-xl border border-white/10 transition-colors duration-150 hover:border-primary/50",
              listening && "animate-pulse border-primary/70 bg-primary/25 text-lilac",
            )}
          >
            <Mic className="size-5" />
          </button>
        )}
        <button
          type="submit"
          disabled={!text.trim() || pending}
          aria-label="Enviar"
          className="grid size-12 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-opacity duration-150 disabled:opacity-40"
        >
          {pending ? <Loader2 className="size-5 animate-spin" /> : <ArrowUp className="size-5" />}
        </button>
      </form>

      {answer ? (
        <div className="mt-3 rounded-xl bg-primary/10 p-3 text-sm animate-in fade-in-0 slide-in-from-top-1 duration-200">
          <p>{answer.reply}</p>
          {answer.items && answer.items.length > 0 && (
            <ul className="mt-2 space-y-1 font-mono text-[13px] text-muted-foreground">
              {answer.items.slice(0, 8).map((item) => (
                <li key={item} className="truncate">
                  {item}
                </li>
              ))}
            </ul>
          )}
          <div className="mt-2 flex items-center gap-3 font-mono text-[11px]">
            {answer.undoId && (
              <button type="button" onClick={() => undo(answer.undoId!)} className="flex items-center gap-1 text-muted-foreground hover:text-foreground">
                <Undo2 className="size-3.5" /> desfazer
              </button>
            )}
            {answer.href && (
              <Link href={answer.href} className="text-muted-foreground hover:text-foreground">
                abrir →
              </Link>
            )}
            <button type="button" onClick={() => setAnswer(null)} className="ml-auto text-muted-foreground hover:text-foreground">
              ok
            </button>
          </div>
        </div>
      ) : (
        <div className="no-scrollbar -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0">
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => {
                setText(example);
                input.current?.focus();
              }}
              className="shrink-0 rounded-full border border-white/10 px-3 py-1.5 text-[12px] text-muted-foreground transition-colors duration-150 hover:border-primary/40 hover:text-foreground"
            >
              {example}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
