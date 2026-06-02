import { useState, useEffect } from "react";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GraduationCap, BookOpen, Video, Book, FileText, Wrench, ExternalLink, CheckCircle, Search, Loader2, Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface TrainingContent {
  id: string;
  title: string;
  description: string | null;
  type: string;
  url: string | null;
  content_text: string | null;
  difficulty: string;
  tags: string[];
  category: string | null;
  order_index: number;
}

interface Progress {
  content_id: string;
  completed: boolean;
}

const typeIcons: Record<string, any> = {
  lesson: BookOpen,
  video: Video,
  book: Book,
  pdf: FileText,
  tool: Wrench,
};

const difficultyColors: Record<string, string> = {
  beginner: "bg-green-500/10 text-green-600 border-green-500/20",
  intermediate: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  advanced: "bg-red-500/10 text-red-600 border-red-500/20",
};

export default function TrainingCenter() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [content, setContent] = useState<TrainingContent[]>([]);
  const [progress, setProgress] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedContent, setSelectedContent] = useState<TrainingContent | null>(null);
  const [askingKhumo, setAskingKhumo] = useState(false);
  const [khumoAnswer, setKhumoAnswer] = useState<string | null>(null);
  const [question, setQuestion] = useState("");

  useEffect(() => {
    loadContent();
  }, [user]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('training_content')
        .select('*')
        .order('order_index', { ascending: true });

      setContent(data || []);

      if (user) {
        const { data: progressData } = await supabase
          .from('user_training_progress')
          .select('content_id, completed')
          .eq('user_id', user.id);

        const progressMap: Record<string, boolean> = {};
        (progressData || []).forEach(p => { progressMap[p.content_id] = p.completed; });
        setProgress(progressMap);
      }
    } catch (err) {
      console.error("Error loading training content:", err);
    } finally {
      setLoading(false);
    }
  };

  const markComplete = async (contentId: string) => {
    if (!user) return;
    try {
      await supabase.from('user_training_progress').upsert({
        user_id: user.id,
        content_id: contentId,
        completed: true,
        completed_at: new Date().toISOString(),
      });
      setProgress(prev => ({ ...prev, [contentId]: true }));
      toast({ title: "Lesson completed! 🎉" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const askKhumo = async () => {
    if (!question.trim() || !user) return;
    setAskingKhumo(true);
    try {
      const context = selectedContent
        ? `The user is studying: "${selectedContent.title}" - ${selectedContent.content_text || selectedContent.description || ''}`
        : 'The user is in the Training Center.';

      const { data } = await supabase.functions.invoke('khumo-chat', {
        body: {
          user_id: user.id,
          message: question,
          context: `training_center: ${context}`
        }
      });

      if (data?.text) {
        setKhumoAnswer(data.text);
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAskingKhumo(false);
    }
  };

  const filteredContent = content.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.description?.toLowerCase().includes(search.toLowerCase()) ||
    c.tags?.some(t => t.toLowerCase().includes(search.toLowerCase()))
  );

  const beginnerContent = filteredContent.filter(c => c.difficulty === 'beginner');
  const intermediateContent = filteredContent.filter(c => c.difficulty === 'intermediate');
  const advancedContent = filteredContent.filter(c => c.difficulty === 'advanced');

  const completedCount = Object.values(progress).filter(Boolean).length;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const renderContentCard = (item: TrainingContent) => {
    const Icon = typeIcons[item.type] || BookOpen;
    const isCompleted = progress[item.id];

    return (
      <Card key={item.id} className={`bg-gradient-card border-border hover:border-primary/50 transition-colors cursor-pointer ${isCompleted ? 'opacity-75' : ''}`}
        onClick={() => setSelectedContent(item)}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-3 flex-1">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-medium text-sm">{item.title}</h3>
                {item.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className={`text-xs ${difficultyColors[item.difficulty] || ''}`}>
                    {item.difficulty}
                  </Badge>
                  <Badge variant="outline" className="text-xs">{item.type}</Badge>
                  {item.category && <span className="text-xs text-muted-foreground">{item.category}</span>}
                </div>
              </div>
            </div>
            {isCompleted && <CheckCircle className="h-5 w-5 text-profit flex-shrink-0" />}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <GraduationCap className="h-8 w-8" />
              Training Center
            </h1>
            <p className="text-muted-foreground mt-1">Learn trading from beginner to advanced</p>
          </div>
          <Badge variant="secondary" className="text-sm">
            {completedCount}/{content.length} completed
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search lessons, topics, strategies..."
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Content Tabs */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="beginner">
              <TabsList>
                <TabsTrigger value="beginner">Beginner ({beginnerContent.length})</TabsTrigger>
                <TabsTrigger value="intermediate">Intermediate ({intermediateContent.length})</TabsTrigger>
                <TabsTrigger value="advanced">Advanced ({advancedContent.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="beginner">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">{beginnerContent.map(renderContentCard)}</div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="intermediate">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">{intermediateContent.map(renderContentCard)}</div>
                </ScrollArea>
              </TabsContent>
              <TabsContent value="advanced">
                <ScrollArea className="h-[500px]">
                  <div className="space-y-3 pr-4">{advancedContent.map(renderContentCard)}</div>
                </ScrollArea>
              </TabsContent>
            </Tabs>
          </div>

          {/* Detail & Khumo Panel */}
          <div className="space-y-4">
            {selectedContent ? (
              <Card className="bg-gradient-card border-border">
                <CardHeader>
                  <CardTitle className="text-lg">{selectedContent.title}</CardTitle>
                  <CardDescription>{selectedContent.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {selectedContent.content_text && (
                    <div className="text-sm bg-muted/50 p-3 rounded-lg">
                      {selectedContent.content_text}
                    </div>
                  )}
                  {selectedContent.url && (
                    <Button variant="outline" className="w-full" onClick={() => window.open(selectedContent.url!, '_blank')}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open Resource
                    </Button>
                  )}
                  {!progress[selectedContent.id] && (
                    <Button className="w-full" onClick={() => markComplete(selectedContent.id)}>
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Mark as Complete
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card className="bg-gradient-card border-border">
                <CardContent className="p-6 text-center text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Select a lesson to view details</p>
                </CardContent>
              </Card>
            )}

            {/* Khumo AI Tutor */}
            <Card className="bg-gradient-card border-border">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Ask Khumo
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Input
                  value={question}
                  onChange={e => setQuestion(e.target.value)}
                  placeholder="Ask about any trading concept..."
                  onKeyDown={e => e.key === 'Enter' && askKhumo()}
                />
                <Button size="sm" className="w-full" onClick={askKhumo} disabled={askingKhumo || !question.trim()}>
                  {askingKhumo ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Sparkles className="h-3 w-3 mr-1" />}
                  {askingKhumo ? "Thinking..." : "Ask"}
                </Button>
                {khumoAnswer && (
                  <div className="text-sm bg-muted/50 p-3 rounded-lg mt-2 whitespace-pre-wrap">
                    {khumoAnswer}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
