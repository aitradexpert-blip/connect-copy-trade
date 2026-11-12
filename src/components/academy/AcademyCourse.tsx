import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Award, CheckCircle, ChevronLeft, ChevronRight, Download, Lightbulb, Lock, PlayCircle, Sparkles } from "lucide-react";
import { academyModules, isModuleUnlocked, scoreQuiz, totalLessons, PASS_MARK, type AcademyLesson, type AcademyModule } from "@/data/academyCurriculum";
import guidePdf from "@/assets/pro-forex-guide.pdf.asset.json";

interface Saved { lessons: Record<string, boolean>; quizzes: Record<string, boolean>; }

interface Props {
  userId?: string;
  onAskTutor: (lesson: AcademyLesson) => void;
}

export default function AcademyCourse({ userId, onAskTutor }: Props) {
  const key = `academyProgress:${userId ?? "guest"}`;
  const [saved, setSaved] = useState<Saved>(() => {
    try { return JSON.parse(localStorage.getItem(key) || "") as Saved; } catch { return { lessons: {}, quizzes: {} }; }
  });
  const [moduleIdx, setModuleIdx] = useState<number | null>(null);
  const [lessonIdx, setLessonIdx] = useState(0);
  const [quizMode, setQuizMode] = useState(false);
  const [answers, setAnswers] = useState<number[]>([]);
  const [result, setResult] = useState<{ correct: number; passed: boolean } | null>(null);

  useEffect(() => { localStorage.setItem(key, JSON.stringify(saved)); }, [key, saved]);

  const doneLessons = Object.values(saved.lessons).filter(Boolean).length;
  const passedCount = academyModules.filter(m => saved.quizzes[m.id]).length;
  const certified = passedCount === academyModules.length;

  const mod: AcademyModule | null = moduleIdx === null ? null : academyModules[moduleIdx];
  const lesson = mod?.lessons[lessonIdx];

  const openModule = (i: number) => {
    setModuleIdx(i); setLessonIdx(0); setQuizMode(false); setAnswers([]); setResult(null);
  };

  const completeLesson = () => {
    if (!mod || !lesson) return;
    setSaved(s => ({ ...s, lessons: { ...s.lessons, [lesson.id]: true } }));
    if (lessonIdx < mod.lessons.length - 1) setLessonIdx(lessonIdx + 1);
    else { setQuizMode(true); setAnswers([]); setResult(null); }
  };

  const submitQuiz = () => {
    if (!mod) return;
    const r = scoreQuiz(mod.quiz, answers);
    setResult(r);
    if (r.passed) setSaved(s => ({ ...s, quizzes: { ...s.quizzes, [mod.id]: true } }));
  };

  const moduleProgress = useMemo(() => (m: AcademyModule) =>
    Math.round((m.lessons.filter(l => saved.lessons[l.id]).length / m.lessons.length) * 100), [saved]);

  if (!mod) {
    return (
      <div className="space-y-4">
        <Card className="bg-gradient-card border-border">
          <CardContent className="p-5 flex flex-col md:flex-row md:items-center gap-4">
            <div className="flex-1">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Pro Forex Institute Programme</p>
              <h2 className="text-xl font-bold mt-1">Your First Step to Financial Freedom</h2>
              <p className="text-sm text-muted-foreground mt-1">6 modules · {totalLessons} lessons · quiz at the end of each module</p>
              <Progress value={(doneLessons / totalLessons) * 100} className="mt-3 h-2" />
              <p className="text-xs text-muted-foreground mt-1">{doneLessons}/{totalLessons} lessons · {passedCount}/6 quizzes passed</p>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" asChild className="min-h-11">
                <a href={guidePdf.url} target="_blank" rel="noreferrer"><Download className="h-4 w-4 mr-2" />Study Guide (PDF)</a>
              </Button>
              {certified && <Badge className="justify-center py-2"><Award className="h-4 w-4 mr-1" />Course Certified</Badge>}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {academyModules.map((m, i) => {
            const unlocked = isModuleUnlocked(i, saved.quizzes);
            const passed = saved.quizzes[m.id];
            return (
              <Card key={m.id} className={`border-border transition-colors ${unlocked ? "hover:border-primary/50 cursor-pointer" : "opacity-60"}`}
                onClick={() => unlocked && openModule(i)}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline">Module {m.number} · {m.level}</Badge>
                    {passed ? <CheckCircle className="h-5 w-5 text-profit" /> : !unlocked ? <Lock className="h-4 w-4 text-muted-foreground" /> : <PlayCircle className="h-5 w-5 text-primary" />}
                  </div>
                  <h3 className="font-semibold">{m.title}</h3>
                  <p className="text-xs text-muted-foreground">{m.description}</p>
                  <Progress value={moduleProgress(m)} className="h-1.5" />
                  <p className="text-xs text-muted-foreground">{m.lessons.length} lessons{!unlocked && " · pass the previous quiz to unlock"}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => setModuleIdx(null)}><ChevronLeft className="h-4 w-4 mr-1" />All modules</Button>
      <div>
        <p className="text-xs text-muted-foreground">Module {mod.number}</p>
        <h2 className="text-xl font-bold">{mod.title}</h2>
      </div>

      <div className="flex flex-wrap gap-2">
        {mod.lessons.map((l, i) => (
          <Button key={l.id} size="sm" variant={!quizMode && i === lessonIdx ? "default" : "outline"} className="min-h-10"
            onClick={() => { setQuizMode(false); setLessonIdx(i); }}>
            {saved.lessons[l.id] && <CheckCircle className="h-3 w-3 mr-1" />}{i + 1}. {l.title}
          </Button>
        ))}
        <Button size="sm" variant={quizMode ? "default" : "outline"} className="min-h-10" onClick={() => { setQuizMode(true); setResult(null); }}>
          {saved.quizzes[mod.id] && <CheckCircle className="h-3 w-3 mr-1" />}Quiz
        </Button>
      </div>

      {!quizMode && lesson && (
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle>{lesson.title}</CardTitle>
            <CardDescription>{lesson.summary}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="space-y-2">
              {lesson.points.map((p, i) => (
                <li key={i} className="flex gap-2 text-sm"><span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary flex-shrink-0" />{p}</li>
              ))}
            </ul>
            {lesson.keyTakeaway && (
              <div className="flex gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm">
                <Lightbulb className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />{lesson.keyTakeaway}
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="min-h-11" onClick={() => onAskTutor(lesson)}><Sparkles className="h-4 w-4 mr-2" />Ask Khumo about this</Button>
              <Button className="min-h-11 flex-1" onClick={completeLesson}>
                {lessonIdx < mod.lessons.length - 1 ? "Complete & next" : "Complete & take quiz"}<ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {quizMode && (
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle>Module {mod.number} Quiz</CardTitle>
            <CardDescription>Score {Math.round(PASS_MARK * 100)}% or more to unlock the next module.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {mod.quiz.map((q, qi) => (
              <div key={qi} className="space-y-2">
                <p className="text-sm font-medium">{qi + 1}. {q.q}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((o, oi) => {
                    const picked = answers[qi] === oi;
                    const showRight = result && oi === q.answer;
                    const showWrong = result && picked && oi !== q.answer;
                    return (
                      <Button key={oi} variant={picked ? "default" : "outline"} disabled={!!result}
                        className={`min-h-11 justify-start whitespace-normal text-left h-auto ${showRight ? "border-profit text-profit" : ""} ${showWrong ? "border-destructive" : ""}`}
                        onClick={() => { const a = [...answers]; a[qi] = oi; setAnswers(a); }}>
                        {o}
                      </Button>
                    );
                  })}
                </div>
              </div>
            ))}
            {result ? (
              <div className="space-y-2">
                <p className={`text-sm font-medium ${result.passed ? "text-profit" : "text-destructive"}`}>
                  {result.correct}/{mod.quiz.length} correct — {result.passed ? "Passed!" : "Not yet. Review the lessons and try again."}
                </p>
                <div className="flex gap-2">
                  {!result.passed && <Button variant="outline" onClick={() => { setAnswers([]); setResult(null); }}>Retry</Button>}
                  {result.passed && moduleIdx! < academyModules.length - 1 && <Button onClick={() => openModule(moduleIdx! + 1)}>Next module<ChevronRight className="h-4 w-4 ml-1" /></Button>}
                  {result.passed && moduleIdx === academyModules.length - 1 && <Button onClick={() => setModuleIdx(null)}><Award className="h-4 w-4 mr-1" />View certificate</Button>}
                </div>
              </div>
            ) : (
              <Button className="w-full min-h-11" disabled={answers.filter(a => a !== undefined).length < mod.quiz.length} onClick={submitQuiz}>Submit answers</Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
