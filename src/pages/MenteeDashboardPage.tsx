import { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import * as lessonApi from '@/api/lesson';
import * as paymentApi from '@/api/payment';
import * as reviewApi from '@/api/review';
import type { Lesson } from '@/api/lesson';
import type { Ticket } from '@/api/payment';
import type { Review } from '@/api/review';
import { LessonBookingDialog } from '@/components/booking/LessonBookingDialog';
import { ReviewWriteDialog } from '@/components/review/ReviewWriteDialog';

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  const weekday = weekdays[date.getDay()];
  return `${date.getFullYear()}.${month}.${day} (${weekday})`;
}

function formatTime(dateString: string): string {
  const date = new Date(dateString);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}


export default function MenteeDashboardPage() {
    const { user, isAuthenticated, isLoading: authLoading } = useAuth();
    const navigate = useNavigate();

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [reviews, setReviews] = useState<Map<number, Review>>(new Map()); // tutorialId -> Review
  const [isLoading, setIsLoading] = useState(true);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [reservationModal, setReservationModal] = useState<{
    isOpen: boolean;
    ticket: Ticket | null;
  }>({ isOpen: false, ticket: null });
  const [reviewModal, setReviewModal] = useState<{
    isOpen: boolean;
    tutorialId: number;
    tutorialTitle: string;
    mentorNickname: string;
    reviewId?: number;
    isEdit?: boolean;
  }>({ isOpen: false, tutorialId: 0, tutorialTitle: '', mentorNickname: '', reviewId: undefined, isEdit: false });

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!authLoading && isAuthenticated) {
      fetchData();
    }
  }, [authLoading, isAuthenticated, navigate]);

    const fetchData = async () => {
    setIsLoading(true);
    try {
      const [lessonsRes, ticketsRes] = await Promise.all([
        lessonApi.getMyLessons(),
        paymentApi.getMyTickets(),
      ]);

      if (lessonsRes.success && lessonsRes.data) {
        setLessons(lessonsRes.data.lessons);
      }
      if (ticketsRes.success && ticketsRes.data) {
        setTickets(ticketsRes.data);
        
        // 각 튜토리얼에 대한 리뷰 정보 가져오기
        const reviewMap = new Map<number, Review>();
        const reviewPromises = ticketsRes.data.map(async (ticket) => {
          try {
            const reviewRes = await reviewApi.getMyReview(ticket.tutorialId);
            if (reviewRes.success && reviewRes.data) {
              reviewMap.set(ticket.tutorialId, reviewRes.data);
            }
          } catch {
            // 리뷰가 없으면 무시
          }
        });
        await Promise.all(reviewPromises);
        setReviews(reviewMap);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 다음 예정 수업 찾기
  const nextLesson = useMemo(() => {
    const now = new Date();
    const upcomingLessons = lessons
      .filter(l => ['CONFIRMED', 'SCHEDULED'].includes(l.status) && l.scheduledAt)
      .filter(l => new Date(l.scheduledAt!) > now)
      .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());
    return upcomingLessons[0] || null;
  }, [lessons]);

  // 티켓 기반 수강 목록 생성
  const courseList = useMemo(() => {
    return tickets.map(ticket => {
      const ticketLessons = lessons.filter(l => l.ticketId === ticket.id);
      const completedCount = ticketLessons.filter(l => l.status === 'COMPLETED').length;

      // 진행 중인 수업 상태 확인
      const hasPendingLesson = ticketLessons.some(l => l.status === 'REQUESTED');
      const hasConfirmedLesson = ticketLessons.some(l => ['CONFIRMED', 'SCHEDULED'].includes(l.status));

      // 예약 가능 여부: 남은 횟수 있고, 진행 중인 수업 없음
      const canBook = ticket.remainingCount > 0 && !hasPendingLesson && !hasConfirmedLesson;

      // 기존 상태 계산 (stats용)
      const hasOngoing = ticketLessons.some(l => ['CONFIRMED', 'SCHEDULED', 'IN_PROGRESS'].includes(l.status));
      const hasWaiting = ticketLessons.some(l => l.status === 'REQUESTED');

      // 환불된 티켓: 레슨이 없고 카운트가 다 차고(remainingCount === 0) 만기일이 지났으면 사용불가
      // 레슨이 없고 카운트가 다 찬 경우는 환불된 티켓일 가능성이 높으므로 사용불가로 처리
      const isUnavailable = ticketLessons.length === 0 && ticket.remainingCount === 0 && ticket.expired;
      // 레슨이 없고 카운트가 다 찬 경우도 사용불가 (환불된 티켓)
      const isRefunded = ticketLessons.length === 0 && ticket.remainingCount === 0;

      let status: 'ongoing' | 'waiting' | 'completed' | 'unavailable' = 'completed';
      if (isUnavailable || isRefunded) status = 'unavailable';
      else if (hasOngoing) status = 'ongoing';
      else if (hasWaiting) status = 'waiting';
      else if (ticket.remainingCount > 0 && completedCount > 0) status = 'ongoing';
      else if (ticket.remainingCount === 0 && completedCount === ticket.totalCount) status = 'completed';
      else if (completedCount === 0) status = 'waiting';

      const review = reviews.get(ticket.tutorialId);
      
      return {
        ...ticket,
        usedCount: ticket.totalCount - ticket.remainingCount,
        status,
        completedCount,
        hasPendingLesson,
        hasConfirmedLesson,
        canBook,
        review,
      };
    });
  }, [tickets, lessons, reviews]);

  // Stats 계산 (courseList 기반)
  const stats = useMemo(() => {
    const waiting = courseList.filter(c => c.status === 'waiting').length;
    const ongoing = courseList.filter(c => c.status === 'ongoing').length;
    const completed = courseList.filter(c => c.status === 'completed').length;
    return { waiting, ongoing, completed };
  }, [courseList]);

  if (authLoading || isLoading) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center bg-slate-950">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">progress_activity</span>
      </div>
    );
  }

  return (
    <div className="pt-16 min-h-screen bg-slate-950">
      <div className="flex">
        {/* Sidebar */}
        <aside className="w-72 p-6 border-r border-slate-800 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto">
          {/* Profile Card */}
          <div className="bg-slate-900 rounded-2xl p-6 text-center mb-5 border border-slate-800">
            <div className="relative inline-block mb-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-3xl border-2 border-slate-700">
                😺
              </div>
              <button className="absolute bottom-0 right-0 w-7 h-7 bg-primary rounded-full flex items-center justify-center border-2 border-slate-900">
                <span className="material-symbols-outlined text-sm text-white">edit</span>
              </button>
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">{user?.nickname}</h3>
            <p className="text-sm text-slate-400 mb-4">{user?.email}</p>
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            <button
              onClick={() => setActiveNav('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                activeNav === 'dashboard'
                  ? 'bg-primary/15 text-primary'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <span className="material-symbols-outlined text-xl">dashboard</span>
              내 강의 현황
            </button>
            <Link
              to="/qna"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-xl">chat_bubble_outline</span>
              수업 Q/A
            </Link>
            <Link
              to="/mypage/payments"
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-white transition-colors"
            >
              <span className="material-symbols-outlined text-xl">receipt_long</span>
              결제 내역
            </Link>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8 max-w-5xl">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 text-center hover:translate-y-[-2px] hover:shadow-xl transition-all">
              <p className="text-sm text-slate-400 mb-2">승인 대기</p>
              <p className="text-3xl font-bold text-amber-500 font-mono">{stats.waiting}</p>
            </div>
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 text-center hover:translate-y-[-2px] hover:shadow-xl transition-all">
              <p className="text-sm text-slate-400 mb-2">수강 중</p>
              <p className="text-3xl font-bold text-green-500 font-mono">{stats.ongoing}</p>
            </div>
            <div className="bg-slate-900 rounded-2xl p-5 border border-slate-800 text-center hover:translate-y-[-2px] hover:shadow-xl transition-all">
              <p className="text-sm text-slate-400 mb-2">수강 완료</p>
              <p className="text-3xl font-bold text-slate-400 font-mono">{stats.completed}</p>
            </div>
          </div>

          {/* Next Lesson Card */}
          {nextLesson && (
            <div className="bg-gradient-to-r from-primary/15 to-purple-500/10 border border-primary/30 rounded-2xl p-5 mb-6 flex items-center gap-5">
              <div className="w-14 h-14 bg-gradient-to-br from-primary to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-2xl text-white">play_circle</span>
              </div>
              <div className="flex-1">
                <p className="text-xs text-primary font-semibold uppercase tracking-wide mb-1">다음 예정 수업</p>
                <p className="text-base font-semibold text-white mb-1">{nextLesson.tutorialTitle}</p>
                <p className="text-sm text-slate-400">{nextLesson.mentorName} 멘토 · 60분</p>
              </div>
              <div className="text-right mr-4">
                <p className="text-sm font-semibold text-white">{formatDate(nextLesson.scheduledAt!)}</p>
                <p className="text-2xl font-bold text-primary font-mono">{formatTime(nextLesson.scheduledAt!)}</p>
              </div>
              <button 
                onClick={() => navigate(`/tutorial/${nextLesson.tutorialId}`)}
                className="px-5 py-2.5 bg-gradient-to-r from-primary to-blue-700 rounded-xl text-white text-sm font-semibold hover:scale-[1.02] hover:shadow-lg hover:shadow-primary/40 transition-all"
              >
                강의실 입장
              </button>
            </div>
          )}

          {/* Course List */}
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">내 수강 목록</h2>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden mb-6">
            {/* Table Header */}
            <div className="grid grid-cols-[2fr_1.2fr_100px_1fr_120px] gap-4 px-5 py-3 bg-slate-800/50 border-b border-slate-800 text-xs text-slate-500 font-semibold uppercase tracking-wide">
              <div>강의명</div>
              <div>멘토</div>
              <div>상태</div>
              <div>수강 현황</div>
              <div>관리</div>
            </div>

            {/* Table Rows */}
            {courseList.length === 0 ? (
              <div className="py-12 text-center text-slate-500">
                <span className="material-symbols-outlined text-4xl mb-2">school</span>
                <p>수강 중인 강의가 없습니다.</p>
                <Link to="/mentors" className="text-primary font-medium mt-2 inline-block hover:underline">
                  멘토 찾아보기
                </Link>
              </div>
            ) : (
              courseList.map((course) => {
                const progressPercent = (course.usedCount / course.totalCount) * 100;
                const statusBadge = course.status === 'ongoing'
                  ? { label: '수강 중', className: 'bg-green-500/15 text-green-500' }
                  : course.status === 'waiting'
                  ? { label: '승인 대기', className: 'bg-amber-500/15 text-amber-500' }
                  : course.status === 'unavailable'
                  ? { label: '사용불가', className: 'bg-red-500/15 text-red-500' }
                  : { label: '수강 완료', className: 'bg-slate-500/15 text-slate-400' };

                const progressColor = course.status === 'completed'
                  ? 'bg-gradient-to-r from-slate-500 to-slate-600'
                  : course.status === 'waiting'
                  ? 'bg-gradient-to-r from-amber-500 to-amber-600'
                  : 'bg-gradient-to-r from-green-500 to-green-600';

                return (
                  <div
                    key={course.id}
                    className="grid grid-cols-[2fr_1.2fr_100px_1fr_120px] gap-4 px-5 py-4 items-center border-b border-slate-800 last:border-b-0 hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="font-medium text-white text-sm">{course.tutorialTitle}</div>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center text-xs">
                        👨‍💻
                      </div>
                      <span className="text-sm text-slate-400">{course.mentorNickname} 멘토</span>
                    </div>
                    <div>
                      <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      <span className="text-xs text-slate-400 font-mono">
                        {course.usedCount} / {course.totalCount} 회차
                      </span>
                      <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${progressColor}`}
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                    </div>
                    <div>
                      {course.status === 'unavailable' ? (
                        // 사용불가 상태: 관리 버튼 없음
                        null
                      ) : course.canBook ? (
                        <button
                          onClick={() => setReservationModal({ isOpen: true, ticket: course })}
                          className="px-4 py-2 bg-gradient-to-r from-primary to-blue-700 rounded-lg text-white text-xs font-medium hover:shadow-lg hover:shadow-primary/30 transition-all"
                        >
                          예약하기
                        </button>
                      ) : course.hasPendingLesson ? (
                        <button
                          disabled
                          className="px-4 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg text-amber-500 text-xs font-medium cursor-not-allowed"
                        >
                          승인 대기
                        </button>
                      ) : course.hasConfirmedLesson ? (
                        <button
                          disabled
                          className="px-4 py-2 bg-green-500/20 border border-green-500/30 rounded-lg text-green-500 text-xs font-medium cursor-not-allowed"
                        >
                          수업 예정
                        </button>
                      ) : course.status === 'completed' ? (
                        course.review ? (
                          <button
                            onClick={() => setReviewModal({
                              isOpen: true,
                              tutorialId: course.tutorialId,
                              tutorialTitle: course.tutorialTitle,
                              mentorNickname: course.mentorNickname,
                              reviewId: course.review?.id,
                              isEdit: true,
                            })}
                            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-medium hover:bg-slate-700 transition-colors"
                          >
                            리뷰 수정
                          </button>
                        ) : (
                          <button
                            onClick={() => setReviewModal({
                              isOpen: true,
                              tutorialId: course.tutorialId,
                              tutorialTitle: course.tutorialTitle,
                              mentorNickname: course.mentorNickname,
                              reviewId: undefined,
                              isEdit: false,
                            })}
                            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-xs font-medium hover:bg-slate-700 transition-colors"
                          >
                            리뷰 쓰기
                          </button>
                        )
                      ) : (
                        <button className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-400 text-xs font-medium hover:bg-slate-700 transition-colors">
                          ⋯
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* CTA Banner */}
          <div className="bg-gradient-to-r from-slate-900 to-primary/10 border border-slate-800 rounded-2xl p-8 flex items-center justify-between relative overflow-hidden">
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-primary/10 rounded-full blur-2xl" />
            <div className="relative z-10">
              <h3 className="text-xl font-semibold text-white mb-2">당신을 위한 새로운 멘토를 찾아보세요</h3>
              <p className="text-sm text-slate-400">다양한 기술 스택의 전문가들이 기다리고 있습니다.</p>
            </div>
            <Link
              to="/tutorials"
              className="relative z-10 px-6 py-3 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-medium flex items-center gap-2 hover:bg-slate-800 hover:border-primary transition-colors"
            >
              더 많은 강의 보기
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </Link>
          </div>
        </main>
      </div>

      {/* 수업 예약 모달 */}
      {reservationModal.ticket && (
        <LessonBookingDialog
          open={reservationModal.isOpen}
          onOpenChange={(open) => setReservationModal({ isOpen: open, ticket: open ? reservationModal.ticket : null })}
          tutorial={{
            id: reservationModal.ticket.tutorialId,
            title: reservationModal.ticket.tutorialTitle,
            duration: 60,
          }}
          ticket={reservationModal.ticket}
          onSuccess={() => {
            fetchData();
            setReservationModal({ isOpen: false, ticket: null });
          }}
        />
      )}

      {/* 리뷰 작성/수정 모달 */}
      <ReviewWriteDialog
        open={reviewModal.isOpen}
        onOpenChange={(open) => setReviewModal({ ...reviewModal, isOpen: open })}
        tutorialId={reviewModal.tutorialId}
        tutorialTitle={reviewModal.tutorialTitle}
        mentorNickname={reviewModal.mentorNickname}
        reviewId={reviewModal.reviewId}
        isEdit={reviewModal.isEdit}
        onSuccess={() => {
          alert(reviewModal.isEdit ? '리뷰가 수정되었습니다!' : '리뷰가 등록되었습니다!');
          fetchData();
        }}
      />
    </div>
  );
}
