import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import * as qnaApi from '@/api/qna';
import * as lessonApi from '@/api/lesson';
import { useAuth } from '@/contexts/AuthContext';

export default function QuestionCreatePage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [lessonId, setLessonId] = useState<number | ''>('');
  const [lessons, setLessons] = useState<lessonApi.Lesson[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim() && tags.length < 5) {
      e.preventDefault();
      if (!tags.includes(tagInput.trim().toLowerCase())) {
        setTags([...tags, tagInput.trim().toLowerCase()]);
      }
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove));
  };

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    // 멘티의 수업 목록 가져오기 (질문 가능한 수업: 확정, 예정, 완료)
    const fetchLessons = async () => {
      try {
        const res = await lessonApi.getMyLessons();
        if (res.success && res.data) {
          // 질문 가능한 상태의 수업만 필터링 (CONFIRMED, SCHEDULED, COMPLETED)
          const availableLessons = res.data.lessons.filter(
            lesson => ['CONFIRMED', 'SCHEDULED', 'COMPLETED'].includes(lesson.status)
          );
          setLessons(availableLessons);
        }
      } catch (error) {
        console.error('수업 목록 조회 실패:', error);
      }
    };
    fetchLessons();
  }, [isAuthenticated, navigate]);

  const handleSubmit = async () => {
    if (!title.trim() || !content.trim()) {
      alert('제목과 내용을 입력해주세요.');
      return;
    }
    if (!lessonId) {
      alert('수업을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await qnaApi.createQuestion(Number(lessonId), {
        title: title.trim(),
        content: content.trim(),
      });
      if (res.success) {
        alert('질문이 등록되었습니다.');
        navigate('/qna');
      } else {
        alert('질문 등록에 실패했습니다.');
      }
    } catch (error) {
      console.error('질문 등록 실패:', error);
      alert('질문 등록에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="pt-16">
      <main className="max-w-7xl mx-auto px-4 md:px-10 py-10">
        <div className="flex flex-col lg:flex-row gap-10">
          {/* Main Form */}
          <div className="flex-1 space-y-8">
            <div>
              <h1 className="text-foreground text-3xl font-extrabold tracking-tight mb-2">질문하기</h1>
              <p className="text-muted-foreground text-base">
                명확한 제목을 작성하고 개발 문제에 대한 상세한 문맥을 제공해 주세요.
              </p>
            </div>

            <Card>
              <CardContent className="p-8 space-y-8">
                {/* Lesson Selection */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">수업 선택 *</Label>
                  <p className="text-muted-foreground text-xs">
                    질문할 수업을 선택해주세요.
                  </p>
                  <select
                    value={lessonId}
                    onChange={(e) => setLessonId(e.target.value ? Number(e.target.value) : '')}
                    className="flex h-12 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="">수업을 선택하세요</option>
                    {lessons.map((lesson) => (
                      <option key={lesson.lessonId} value={lesson.lessonId}>
                        {lesson.tutorialTitle} - {lesson.mentorName} 멘토
                      </option>
                    ))}
                  </select>
                </div>

                {/* Title */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">제목 *</Label>
                  <p className="text-muted-foreground text-xs">
                    다른 사람에게 질문한다고 생각하고 구체적으로 작성해 주세요.
                  </p>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="예: React useEffect에서 레이스 컨디션을 처리하는 방법은 무엇인가요?"
                    className="h-12"
                  />
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">내용</Label>
                  <p className="text-muted-foreground text-xs">
                    질문에 답변하기 위해 필요한 모든 정보를 포함해 주세요.
                  </p>
                  <div className="border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-ring">
                    {/* Toolbar */}
                    <div className="flex items-center gap-1 p-2 bg-muted/50 border-b">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="material-symbols-outlined text-lg">format_bold</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="material-symbols-outlined text-lg">format_italic</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="material-symbols-outlined text-lg">link</span>
                      </Button>
                      <div className="w-px h-5 bg-border mx-1" />
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="material-symbols-outlined text-lg">format_list_bulleted</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="material-symbols-outlined text-lg">format_list_numbered</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="material-symbols-outlined text-lg">image</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <span className="material-symbols-outlined text-lg">code</span>
                      </Button>
                    </div>
                    <Textarea
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      placeholder="문제의 문맥과 시도해본 내용을 설명해 주세요..."
                      className="min-h-[256px] border-0 rounded-none focus-visible:ring-0 resize-none"
                    />
                  </div>
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label className="text-base font-semibold">태그</Label>
                  <p className="text-muted-foreground text-xs">
                    질문을 분류하기 위해 최대 5개의 태그를 추가해 주세요.
                  </p>
                  <div className="flex flex-wrap items-center gap-2 p-3 min-h-[50px] border rounded-lg focus-within:ring-2 focus-within:ring-ring">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1.5">
                        {tag}
                        <button
                          onClick={() => handleRemoveTag(tag)}
                          className="hover:text-destructive"
                        >
                          <span className="material-symbols-outlined text-sm">close</span>
                        </button>
                      </Badge>
                    ))}
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={handleAddTag}
                      placeholder="입력 후 엔터를 누르세요..."
                      className="flex-1 min-w-[150px] border-0 h-8 focus-visible:ring-0"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-6 border-t">
                  <div className="flex items-center gap-4">
                    <Button 
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="shadow-lg shadow-primary/20"
                    >
                      {isSubmitting ? '등록 중...' : '질문 등록'}
                    </Button>
                    <Button 
                      variant="ghost"
                      onClick={() => navigate('/qna')}
                    >
                      취소
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <aside className="w-full lg:w-[340px] space-y-6">
            <div className="sticky top-24 space-y-6">
              {/* Tips Card */}
              <Card>
                <CardHeader className="bg-muted/50 border-b">
                  <CardTitle className="text-lg">좋은 질문을 위한 팁</CardTitle>
                  <p className="text-muted-foreground text-sm">
                    질문의 질이 높을수록 전문가의 해결책을 얻기 쉽습니다.
                  </p>
                </CardHeader>
                <CardContent className="p-4 space-y-1">
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
                    <span className="material-symbols-outlined text-primary mt-0.5">summarize</span>
                    <div>
                      <p className="text-sm font-semibold">문제 요약하기</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        직면한 구체적인 문제를 짧게 설명해 주세요.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="material-symbols-outlined text-muted-foreground mt-0.5">history_edu</span>
                    <div>
                      <p className="text-sm font-semibold">시도한 내용 작성</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        무엇을 시도해 보았고 왜 실패했는지 설명해 주세요.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                    <span className="material-symbols-outlined text-muted-foreground mt-0.5">terminal</span>
                    <div>
                      <p className="text-sm font-semibold">코드 스니펫 포함</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        본문에 재현 가능한 코드 예제를 직접 포함해 주세요.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Mentoring CTA */}
              <Card className="bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
                <CardContent className="p-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-lg">
                      <span className="material-symbols-outlined text-primary">school</span>
                    </div>
                    <h4 className="font-bold">1:1 튜터링</h4>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    더 빠른 결과가 필요하신가요? 검증된 시니어 개발자와 라이브 세션으로 연결해 보세요.
                  </p>
                  <Link
                    to="/mentors"
                    className="inline-flex items-center gap-2 text-primary text-sm font-bold hover:gap-3 transition-all"
                  >
                    멘토 찾아보기
                    <span className="material-symbols-outlined text-base">arrow_forward</span>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}
