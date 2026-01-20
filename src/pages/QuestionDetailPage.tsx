import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import * as qnaApi from '@/api/qna';
import type { QuestionDetail, Answer } from '@/api/qna';
import { useAuth } from '@/contexts/AuthContext';

function formatDate(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));

    if (hours < 24) {
        return `${hours}시간 전`;
    }
    return date.toLocaleDateString('ko-KR');
}

export default function QuestionDetailPage() {
    const { questionId } = useParams<{ questionId: string }>();
    const { user } = useAuth();

    const [question, setQuestion] = useState<QuestionDetail | null>(null);
    const [answers, setAnswers] = useState<Answer[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [answerContent, setAnswerContent] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // API 호출
    useEffect(() => {
        const fetchQuestion = async () => {
            if (!questionId) return;

            setIsLoading(true);
            setError(null);

            try {
                const response = await qnaApi.getQuestion(Number(questionId));
                if (response.success && response.data) {
                    setQuestion(response.data);
                    setAnswers(response.data.answers || []);
                } else {
                    setError('질문을 찾을 수 없습니다.');
                }
            } catch (err) {
                setError('데이터를 불러오는데 실패했습니다.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuestion();
    }, [questionId]);

    const handleSubmitAnswer = async () => {
        if (!questionId || !answerContent.trim()) {
            alert('답변 내용을 입력해주세요.');
            return;
        }

        if (user?.role !== 'MENTOR') {
            alert('멘토만 답변을 작성할 수 있습니다.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await qnaApi.createAnswer(Number(questionId), {
                content: answerContent.trim(),
            });
            if (res.success) {
                setAnswerContent('');
                // 질문 다시 불러오기
                const questionRes = await qnaApi.getQuestion(Number(questionId));
                if (questionRes.success && questionRes.data) {
                    setQuestion(questionRes.data);
                    setAnswers(questionRes.data.answers || []);
                } else {
                    alert('질문을 다시 불러오는데 실패했습니다.');
                }
            } else {
                alert('답변 등록에 실패했습니다.');
            }
        } catch (error) {
            console.error('답변 등록 실패:', error);
            alert('답변 등록에 실패했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="pt-16 min-h-screen flex items-center justify-center">
                <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
            </div>
        );
    }

    if (error || !question) {
        return (
            <div className="pt-16 min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <span className="material-symbols-outlined text-6xl text-muted-foreground mb-4">error</span>
                    <p className="text-lg text-muted-foreground">{error || '질문을 찾을 수 없습니다.'}</p>
                    <Link to="/qna" className="mt-4 inline-block text-primary hover:underline">
                        목록으로 돌아가기
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="pt-16">
            <main className="max-w-[1000px] mx-auto px-6 py-8">
                {/* Breadcrumbs */}
                <nav className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
                    <Link to="/qna" className="hover:text-primary">질문 리스트</Link>
                    <span className="material-symbols-outlined text-xs">chevron_right</span>
                    <span className="text-foreground">질문 상세</span>
                </nav>

                {/* Question Header */}
                <section className="mb-8">
                    <div className="flex flex-col gap-4">
                        <div className="flex items-start gap-4">
                            <Badge variant="destructive" className="shrink-0">긴급 도움</Badge>
                            <h1 className="text-2xl md:text-3xl font-bold leading-tight">
                                {question.title}
                            </h1>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                                <Avatar className="h-6 w-6">
                                    <AvatarFallback className="text-xs">U</AvatarFallback>
                                </Avatar>
                                <span className="font-semibold text-foreground">작성자</span>
                            </div>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-sm">schedule</span>
                                {formatDate(question.createdAt)}
              </span>
                        </div>
                    </div>
                </section>

                {/* Question Content */}
                <div className="space-y-8">
                    {/* Problem Description */}
                    <Card>
                        <CardContent className="p-0">
                            <div className="px-6 py-4 border-b bg-muted/30">
                                <h3 className="font-bold flex items-center gap-2">
                                    <span className="material-symbols-outlined text-primary">description</span>
                                    문제 설명
                                </h3>
                            </div>
                            <div className="p-6 text-muted-foreground leading-relaxed space-y-4">
                                {question.content.split('\n\n').map((paragraph, i) => (
                                    <p key={i}>{paragraph}</p>
                                ))}
                            </div>

                            {/* Code Block */}
                            {question.codeContent && (
                                <div className="px-6 pb-6">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-mono text-muted-foreground">코드</span>
                                        <Button variant="link" size="sm" className="text-xs h-auto p-0">
                                            <span className="material-symbols-outlined text-sm mr-1">content_copy</span>
                                            코드 복사
                                        </Button>
                                    </div>
                                    <div className="bg-slate-900 dark:bg-slate-950 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                    <pre className="text-slate-300">
                      <code>{question.codeContent}</code>
                    </pre>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Answers */}
                    {answers.length > 0 ? (
                        answers.map((answer) => (
                            <Card key={answer.id} className={answer.isAccepted ? 'border-green-500/50' : ''}>
                                <CardContent className="p-0">
                                    <div className="px-6 py-4 border-b bg-muted/30 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <Avatar>
                                                <AvatarFallback>{answer.mentorNickname?.[0] || 'M'}</AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <p className="font-bold">{answer.mentorNickname || '멘토'}</p>
                                                <p className="text-xs text-muted-foreground">{formatDate(answer.createdAt)}</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-6 prose dark:prose-invert max-w-none">
                                        {answer.content.split('\n\n').map((paragraph, i) => {
                                            if (paragraph.startsWith('```')) {
                                                const code = paragraph.replace(/```\w*\n?/g, '');
                                                return (
                                                    <pre key={i} className="bg-slate-900 dark:bg-slate-950 rounded-lg p-4 text-sm overflow-x-auto">
                            <code className="text-slate-300">{code}</code>
                          </pre>
                                                );
                                            }
                                            if (paragraph.startsWith('**')) {
                                                return (
                                                    <p key={i} className="font-bold text-foreground">
                                                        {paragraph.replace(/\*\*/g, '')}
                                                    </p>
                                                );
                                            }
                                            return <p key={i} className="text-muted-foreground">{paragraph}</p>;
                                        })}
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    ) : (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <span className="material-symbols-outlined text-4xl text-muted-foreground mb-2">chat_bubble_outline</span>
                                <p className="text-muted-foreground">아직 답변이 없습니다.</p>
                            </CardContent>
                        </Card>
                    )}

                    {/* Answer Editor */}
                    <div className="flex items-center justify-between pt-4 border-t">
                        <h2 className="text-xl font-bold flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary">edit_note</span>
                            멘토님의 해결책을 작성해주세요
                        </h2>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <span className="inline-block w-2 h-2 rounded-full bg-green-500" />
                            멘토 자동 저장 활성화됨
                        </div>
                    </div>

                    <Card>
                        <CardContent className="p-0">
                            {/* Toolbar */}
                            <div className="flex flex-wrap items-center gap-1 p-2 border-b bg-muted/30">
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <span className="material-symbols-outlined">format_bold</span>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <span className="material-symbols-outlined">format_italic</span>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <span className="material-symbols-outlined">format_list_bulleted</span>
                                </Button>
                                <div className="w-px h-6 bg-border mx-1" />
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <span className="material-symbols-outlined">code</span>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <span className="material-symbols-outlined">image</span>
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                    <span className="material-symbols-outlined">link</span>
                                </Button>
                                <div className="ml-auto flex items-center gap-4 px-2">
                                    <span className="text-xs text-muted-foreground">Markdown 지원</span>
                                </div>
                            </div>

                            <Textarea
                                value={answerContent}
                                onChange={(e) => setAnswerContent(e.target.value)}
                                placeholder="해결 방법, 코드 예시, 그리고 주의할 점을 상세히 작성해주세요..."
                                className="min-h-[300px] border-0 rounded-none focus-visible:ring-0 resize-none"
                            />

                            {/* Footer */}
                            <div className="flex items-center justify-between px-6 py-4 border-t bg-muted/30">
                                <Button variant="ghost" size="sm">
                                    <span className="material-symbols-outlined text-lg mr-2">attach_file</span>
                                    파일 첨부
                                </Button>
                                <div className="flex gap-3">
                                    <Button 
                                        variant="secondary"
                                        onClick={() => setAnswerContent('')}
                                    >
                                        취소
                                    </Button>
                                    <Button 
                                        onClick={handleSubmitAnswer}
                                        disabled={isSubmitting || !answerContent.trim()}
                                        className="shadow-lg shadow-primary/20"
                                    >
                                        {isSubmitting ? '등록 중...' : '답변 등록하기'}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </main>
        </div>
    );
}
