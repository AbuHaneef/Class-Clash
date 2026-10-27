"use client";

import React, { useEffect, useMemo, useState } from "react";
import { navigate } from "@/lib/clash/client/router";
import { apiGet } from "@/lib/clash/client/api";
import { useClash } from "@/lib/clash/client/store";
import { SubjectIcon, SectionTitle, EmptyState, LoadingCard } from "@/components/clash/shared";
import { GraduationCap, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Structure = {
  grades: { id: string; name: string; levelName: string; hasContent: boolean }[];
  subjects: { id: string; name: string; slug: string; icon: string; color: string; description: string }[];
  subjectGrades: { subjectId: string; gradeId: string }[];
};

export default function SubjectsView() {
  const me = useClash((s) => s.me);
  const [structure, setStructure] = useState<Structure | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiGet<{ structure: Structure }>("/structure").then((r) => {
      if (r.ok) setStructure(r.structure);
      setLoading(false);
    });
  }, []);

  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);

  const contentGrades = useMemo(
    () => (structure?.grades ?? []).filter((g) => g.hasContent),
    [structure]
  );

  useEffect(() => {
    if (!selectedGrade && contentGrades.length > 0) {
      setSelectedGrade(me?.gradeId && contentGrades.some((g) => g.id === me.gradeId) ? me.gradeId : contentGrades[0].id);
    }
  }, [contentGrades, me, selectedGrade]);

  if (loading) return <LoadingCard label="Loading subjects…" />;

  const levels = [...new Set(contentGrades.map((g) => g.levelName))];
  const subjectsForGrade = (structure?.subjectGrades ?? [])
    .filter((sg) => sg.gradeId === selectedGrade)
    .map((sg) => structure!.subjects.find((s) => s.id === sg.subjectId)!)
    .filter(Boolean);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold sm:text-3xl">Explore Subjects</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a class to see its subjects, topics and champions.
          {me?.gradeId && selectedGrade !== me.gradeId && " You're browsing another class — practice is tied to YOUR class."}
        </p>
      </div>

      {/* class picker */}
      <div className="cc-scroll -mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="tablist" aria-label="Classes">
        {levels.flatMap((lvl) =>
          contentGrades
            .filter((g) => g.levelName === lvl)
            .map((g) => (
              <button
                key={g.id}
                role="tab"
                aria-selected={selectedGrade === g.id}
                onClick={() => setSelectedGrade(g.id)}
                className={cn(
                  "cc-tap shrink-0 rounded-2xl border-2 px-4 py-2 font-display text-sm font-bold transition-all",
                  selectedGrade === g.id
                    ? "border-yellow-400 bg-yellow-500/10 text-yellow-300"
                    : "border-border/60 bg-card/60 text-muted-foreground hover:border-border"
                )}
              >
                {g.name}
                {me?.gradeId === g.id && <span className="ml-1.5 text-[10px] text-emerald-400">YOU</span>}
              </button>
            ))
        )}
      </div>

      {subjectsForGrade.length === 0 ? (
        <EmptyState icon={GraduationCap} title="No subjects yet for this class" description="Content is being added by question editors. Check back soon!" />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {subjectsForGrade.map((s) => (
            <button
              key={s.id}
              onClick={() => navigate(`/subject/${s.id}?grade=${selectedGrade}`)}
              className="group flex items-start gap-3 rounded-2xl border border-border/60 bg-card/70 p-4 text-left transition-all hover:border-border hover:bg-card"
            >
              <SubjectIcon icon={s.icon} color={s.color} size={26} className="mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold">{s.name}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{s.description}</p>
                <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-yellow-400 opacity-80 group-hover:opacity-100">
                  Topics & champion <ChevronRight size={13} aria-hidden />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      <p className="rounded-2xl border border-border/50 bg-secondary/30 p-4 text-xs leading-relaxed text-muted-foreground">
        📘 <strong className="text-foreground/80">Note:</strong> Question content for other classes (Primary 1–5, JSS 1, SS 1) is on the
        roadmap and will be added by editors through the admin question bank. Every question shows its review status in review screens.
      </p>
    </div>
  );
}
