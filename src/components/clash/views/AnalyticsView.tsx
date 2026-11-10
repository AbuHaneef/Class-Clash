"use client";

import React, { useEffect, useState } from "react";
import { apiGet } from "@/lib/clash/client/api";
import { LoadingCard, ErrorState, Pill } from "@/components/clash/shared";
import { navigate } from "@/lib/clash/client/router";
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, LineChart, Line,
  CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Info, Clock } from "lucide-react";

type Analytics = {
  analytics: {
    totalAnswered: number;
    totalCorrect: number;
    overallAccuracy: number;
    sampleSize: number;
    smallSample: boolean;
    subjects: { id: string; name: string; color: string; icon: string; accuracy: number; answered: number; best: number | null }[];
    strongest: { name: string; subject: string; accuracy: number; total: number }[];
    weakest: { name: string; subject: string; subjectId: string; accuracy: number; total: number }[];
    progress: { date: string; accuracy: number; answered: number }[];
    sessions: { id: string; subjectName: string; subjectColor: string; mode: string; score: number; correctCount: number; totalCount: number; completedAt: string }[];
  };
};

export default function AnalyticsView() {
  const [data, setData] = useState<Analytics["analytics"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiGet<Analytics>("/analytics").then((r) => {
      if (r.ok) setData((r as unknown as Analytics).analytics);
      else setError(r.error);
      setLoading(false);
    });
  }, []);

  if (loading) return <LoadingCard label="Crunching your numbers…" />;
  if (error) return <ErrorState message={error} />;
  if (!data) return null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">My Progress</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Based on {data.totalAnswered} real answers. Compared only against your own past performance.
        </p>
      </div>

      {data.smallSample && (
        <p className="flex items-start gap-2 rounded-2xl border border-yellow-500/25 bg-yellow-500/8 p-4 text-xs leading-relaxed text-yellow-200/90">
          <Info size={15} className="mt-0.5 shrink-0" aria-hidden />
          You've answered fewer than 20 questions so far — insights will get sharper as you practise more.
        </p>
      )}

      {/* overview */}
      <section className="grid grid-cols-3 gap-2.5">
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4 text-center">
          <p className="font-display text-3xl font-bold cc-gradient-text">{data.overallAccuracy}%</p>
          <p className="text-xs font-semibold">Overall accuracy</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4 text-center">
          <p className="font-display text-3xl font-bold">{data.totalAnswered}</p>
          <p className="text-xs font-semibold">Questions answered</p>
        </div>
        <div className="rounded-2xl border border-border/60 bg-card/70 p-4 text-center">
          <p className="font-display text-3xl font-bold">{data.sessions.length}</p>
          <p className="text-xs font-semibold">Recent sessions</p>
        </div>
      </section>

      {/* accuracy by subject */}
      {data.subjects.length > 0 && (
        <section className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <h2 className="mb-4 font-display text-lg font-bold">Accuracy by subject</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.subjects.map((s) => ({ name: s.name.slice(0, 9), accuracy: s.accuracy, color: s.color }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="name" tick={{ fill: "#8b8b9e", fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#8b8b9e", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#211a33", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                  labelStyle={{ color: "#fff" }}
                />
                <Bar dataKey="accuracy" radius={[6, 6, 0, 0]}>
                  {data.subjects.map((s, i) => (
                    <Bar key={i} dataKey="accuracy" fill={s.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* progress over time */}
      {data.progress.length >= 2 && (
        <section className="rounded-3xl border border-border/60 bg-card/70 p-5">
          <h2 className="mb-4 font-display text-lg font-bold">Accuracy over time</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.progress.map((p) => ({ date: p.date.slice(5), accuracy: p.accuracy }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                <XAxis dataKey="date" tick={{ fill: "#8b8b9e", fontSize: 11 }} />
                <YAxis domain={[0, 100]} tick={{ fill: "#8b8b9e", fontSize: 11 }} />
                <Tooltip
                  contentStyle={{ background: "#211a33", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12 }}
                />
                <Line type="monotone" dataKey="accuracy" stroke="#f5c518" strokeWidth={2.5} dot={{ fill: "#f5c518", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      )}

      {/* strongest & weakest */}
      <div className="grid gap-4 sm:grid-cols-2">
        {data.strongest.length > 0 && (
          <section className="rounded-3xl border border-emerald-500/25 bg-emerald-500/6 p-5">
            <h2 className="flex items-center gap-2 font-display font-bold text-emerald-300">
              <TrendingUp size={17} aria-hidden /> Strongest topics
            </h2>
            <div className="mt-3 space-y-2">
              {data.strongest.map((t) => (
                <div key={t.name} className="rounded-xl bg-secondary/50 p-3">
                  <p className="text-sm font-bold">{t.name} <span className="font-normal text-muted-foreground">• {t.subject}</span></p>
                  <p className="text-xs text-emerald-400">{t.accuracy}% in {t.total} answers</p>
                </div>
              ))}
            </div>
          </section>
        )}
        {data.weakest.length > 0 && (
          <section className="rounded-3xl border border-orange-500/25 bg-orange-500/6 p-5">
            <h2 className="flex items-center gap-2 font-display font-bold text-orange-300">
              <TrendingDown size={17} aria-hidden /> Needs practice
            </h2>
            <div className="mt-3 space-y-2">
              {data.weakest.map((t) => (
                <button
                  key={t.name}
                  onClick={() => navigate(`/subject/${t.subjectId}`)}
                  className="w-full rounded-xl bg-secondary/50 p-3 text-left hover:bg-secondary/70"
                >
                  <p className="text-sm font-bold">{t.name} <span className="font-normal text-muted-foreground">• {t.subject}</span></p>
                  <p className="text-xs text-orange-400">{t.accuracy}% in {t.total} answers — train this!</p>
                </button>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* session history */}
      {data.sessions.length > 0 && (
        <section>
          <h2 className="mb-3 flex items-center gap-2 font-display text-lg font-bold">
            <Clock size={17} className="text-yellow-400" aria-hidden /> Recent sessions
          </h2>
          <div className="space-y-2">
            {data.sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-secondary/30 p-3">
                <span className="h-8 w-1.5 rounded-full" style={{ background: s.subjectColor }} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold">{s.subjectName}</p>
                  <p className="text-xs text-muted-foreground">
                    {s.mode.replace("_", " ")} • {new Date(s.completedAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-display font-bold">{s.correctCount}/{s.totalCount}</p>
                  <p className="text-xs text-muted-foreground">{s.score} pts</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="rounded-2xl border border-border/50 bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground">
        <Pill color="violet" className="mr-1.5">Honest analytics</Pill>
        ClassClash never claims to predict exam grades or intelligence. Insights come only from your actual
        answer records, and weak topics stay private to you.
      </p>
    </div>
  );
}
