import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import * as tutorialApi from "@/api/tutorial";
import type { Tutorial } from "@/api/tutorial";
import { API_BASE_URL } from "@/api/client";

type PortOneConfig = {
  storeId: string;
  channelKey: string;
};

export default function PaymentPage() {
  const { tutorialId } = useParams<{ tutorialId: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [isTutorialLoading, setIsTutorialLoading] = useState(true);
  const [tutorialError, setTutorialError] = useState<string | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<"card" | "transfer">(
    "card",
  );
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lessonCount, setLessonCount] = useState(4);
  const [config, setConfig] = useState<PortOneConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);

  // 결제 설정(storeId/channelKey) 로드
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/payments/config`);
        if (!res.ok) {
          throw new Error(`config load failed: ${res.status}`);
        }
        const json = await res.json();
        const data = json?.data ?? json;
        if (!data?.storeId || !data?.channelKey) {
          throw new Error("config missing storeId/channelKey");
        }
        setConfig({ storeId: data.storeId, channelKey: data.channelKey });
      } catch (error) {
        console.error("결제 설정 로딩 실패:", error);
        setConfigError(
          "결제 설정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        );
      }
    };

    fetchConfig();
  }, []);

  // 튜토리얼 상세 로드
  useEffect(() => {
    const fetchTutorial = async () => {
      if (!tutorialId) {
        setTutorialError("튜토리얼 정보를 불러올 수 없습니다.");
        setIsTutorialLoading(false);
        return;
      }

      setIsTutorialLoading(true);
      setTutorialError(null);
      try {
        const res = await tutorialApi.getTutorial(Number(tutorialId));
        if (res.success && res.data) {
          setTutorial(res.data);
        } else {
          setTutorialError("튜토리얼 정보를 불러올 수 없습니다.");
        }
      } catch (error) {
        console.error("튜토리얼 로딩 실패:", error);
        setTutorialError("튜토리얼 정보를 불러오지 못했습니다.");
      } finally {
        setIsTutorialLoading(false);
      }
    };

    fetchTutorial();
  }, [tutorialId]);

  const MIN_LESSON_COUNT = 1;
  const MAX_LESSON_COUNT = 12;

  const tutorialPrice = tutorial?.price ?? 0;
  const orderAmount = tutorialPrice * lessonCount;
  const totalAmount = orderAmount;
  const mentorName = tutorial?.mentorNickname ?? "멘토";

  // 수업 횟수 증가
  const handleIncrease = () => {
    if (lessonCount < MAX_LESSON_COUNT) {
      setLessonCount((prev) => prev + 1);
    }
  };

  // 수업 횟수 감소
  const handleDecrease = () => {
    if (lessonCount > MIN_LESSON_COUNT) {
      setLessonCount((prev) => prev - 1);
    }
  };

  // 결제 수단을 PortOne 값으로 매핑
  const getPayMethod = () => {
    switch (paymentMethod) {
      case "card":
        return "CARD";
      case "transfer":
        return "TRANSFER";
      default:
        return "CARD";
    }
  };

  // 결제 생성 → PortOne 결제 → 서버 검증
  const handlePayment = async () => {
    if (!agreeTerms) {
      alert("이용약관에 동의해주세요.");
      return;
    }

    if (!isAuthenticated || !user) {
      alert("로그인 후 결제가 가능합니다.");
      navigate("/login");
      return;
    }

    if (!tutorial) {
      alert("튜토리얼 정보를 불러오지 못했습니다.");
      return;
    }

    if (configError || !config) {
      alert(
        configError ??
          "결제 설정을 불러오는 중입니다. 잠시 후 다시 시도해주세요.",
      );
      return;
    }

    const resolvedTutorialId = Number(tutorialId);
    if (!resolvedTutorialId) {
      alert("유효하지 않은 튜토리얼 ID입니다.");
      return;
    }

    setIsProcessing(true);

    try {
      const token = localStorage.getItem("accessToken");
      const createRes = await fetch(
        `${API_BASE_URL}/api/tutorials/${resolvedTutorialId}/payments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            count: lessonCount,
          }),
        },
      );

      if (!createRes.ok) {
        const errorText = await createRes.text();
        alert(`결제 생성 실패: ${errorText}`);
        setIsProcessing(false);
        return;
      }

      const createJson = await createRes.json();
      const paymentData = createJson?.data ?? createJson;

      if (!paymentData?.paymentId) {
        alert("결제 생성 응답이 올바르지 않습니다.");
        setIsProcessing(false);
        return;
      }

      // PortOne의 paymentId는 고유해야 하므로 타임스탬프를 포함한 고유 ID 생성
      const orderPaymentId = `LION-${Date.now()}-${paymentData.paymentId}`;
      const paymentAmount = paymentData.amount ?? totalAmount;

      const response = await PortOne.requestPayment({
        storeId: config.storeId,
        channelKey: config.channelKey,
        paymentId: orderPaymentId,
        orderName: tutorial.title,
        totalAmount: paymentAmount,
        currency: "CURRENCY_KRW",
        payMethod: getPayMethod() as "CARD" | "TRANSFER",
        customer: {
          fullName: user.nickname || "사용자",
          phoneNumber: "010-0000-0000",
          email: user.email || "user@example.com",
        },
        windowType: {
          pc: "IFRAME",
        },
      });

      if (response.code != null) {
        alert("결제 실패: " + response.message);
        setIsProcessing(false);
        return;
      }

      const verifyRes = await fetch(
        `${API_BASE_URL}/api/payments/${paymentData.paymentId}/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            impUid: response.paymentId,
          }),
        },
      );

      if (verifyRes.ok) {
        navigate("/payment/complete", {
          state: {
            paymentId: paymentData.paymentId,
            tutorialTitle: tutorial.title,
            amount: paymentAmount,
            mentorName,
          },
        });
      } else {
        const errorText = await verifyRes.text();
        alert("서버 검증 실패: " + errorText);
      }
    } catch (error) {
      console.error("결제 프로세스 에러:", error);
      alert("결제 중 오류가 발생했습니다.");
    } finally {
      setIsProcessing(false);
    }
  };

  const canSubmitPayment =
    agreeTerms && !isProcessing && !configError && !!config && !!tutorial;

  if (isTutorialLoading) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center">
        <span className="material-symbols-outlined animate-spin text-4xl text-primary">
          progress_activity
        </span>
      </div>
    );
  }

  if (tutorialError || !tutorial) {
    return (
      <div className="pt-16 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <span className="material-symbols-outlined text-6xl text-slate-300 dark:text-slate-600 mb-4">
            error
          </span>
          <p className="text-lg text-slate-500 dark:text-slate-400">
            {tutorialError ?? "튜토리얼 정보를 불러올 수 없습니다."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="pt-16">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-black text-slate-900 dark:text-white">
            결제하기
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            수업 내용을 확인하고 결제를 진행해주세요.
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  info
                </span>
                수업 정보
              </h2>
              <div className="flex gap-5">
                <div className="w-32 h-32 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 flex items-center justify-center flex-shrink-0 overflow-hidden">
                  <span className="material-symbols-outlined text-slate-400 dark:text-slate-500 text-5xl">
                    school
                  </span>
                </div>
                <div className="flex-1">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">
                    PROFESSIONAL COURSE
                  </span>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">
                    {tutorial.title}
                  </h3>
                  <div className="flex flex-col gap-2 mt-4 text-sm text-slate-600 dark:text-slate-400">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">
                        person
                      </span>
                      <span>
                        멘토:{" "}
                        <strong className="text-slate-900 dark:text-white">
                          {mentorName}
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">
                        payments
                      </span>
                      <span>
                        회당 수업료:{" "}
                        <strong className="text-slate-900 dark:text-white">
                          ₩{tutorialPrice.toLocaleString()}
                        </strong>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-base">
                        schedule
                      </span>
                      <span>
                        수업 시간:{" "}
                        <strong className="text-slate-900 dark:text-white">
                          {tutorial.duration}분
                        </strong>
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-base">
                          rebase_edit
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">
                          수업 횟수 선택
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleDecrease}
                          disabled={lessonCount <= MIN_LESSON_COUNT}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 dark:bg-slate-600 text-white hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-lg">
                            remove
                          </span>
                        </button>
                        <span className="w-10 text-center text-lg font-bold text-slate-900 dark:text-white">
                          {lessonCount}
                        </span>
                        <button
                          onClick={handleIncrease}
                          disabled={lessonCount >= MAX_LESSON_COUNT}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-800 dark:bg-slate-600 text-white hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="material-symbols-outlined text-lg">
                            add
                          </span>
                        </button>
                        <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">
                          회 (최대 {MAX_LESSON_COUNT}회)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">
                  credit_card
                </span>
                결제 수단 선택
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => setPaymentMethod("card")}
                  className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${
                    paymentMethod === "card"
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                  }`}
                >
                  <span className="material-symbols-outlined text-3xl text-slate-600 dark:text-slate-300 mb-2">
                    credit_card
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    신용카드
                  </span>
                </button>

                <button
                  onClick={() => setPaymentMethod("transfer")}
                  className={`flex flex-col items-center justify-center p-6 rounded-xl border-2 transition-all ${
                    paymentMethod === "transfer"
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 dark:border-slate-700 hover:border-primary/50"
                  }`}
                >
                  <span className="material-symbols-outlined text-3xl text-slate-600 dark:text-slate-300 mb-2">
                    account_balance
                  </span>
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    계좌이체
                  </span>
                </button>
              </div>
            </div>
          </div>

          <div>
            <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 sticky top-24 shadow-lg">
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6">
                최종 결제 금액
              </h2>

              <div className="space-y-4 pb-6 border-b border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    주문 금액 (₩{tutorialPrice.toLocaleString()} × {lessonCount}
                    회)
                  </span>
                  <span className="text-slate-900 dark:text-white font-semibold">
                    ₩{orderAmount.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center py-6">
                <span className="font-bold text-slate-900 dark:text-white">
                  총 결제 금액
                </span>
                <span className="text-3xl font-black text-primary">
                  ₩{totalAmount.toLocaleString()}
                </span>
              </div>

              <label className="flex items-start gap-3 cursor-pointer mb-5 p-3 rounded-lg bg-slate-50 dark:bg-slate-900">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  className="w-4 h-4 mt-0.5 text-primary rounded"
                />
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  주문 내용을 확인하였으며,{" "}
                  <span className="text-primary underline cursor-pointer">
                    개인정보 수집 및 이용
                  </span>
                  과{" "}
                  <span className="text-primary underline cursor-pointer">
                    결제대행 서비스 약관
                  </span>
                  에 모두 동의합니다.
                </p>
              </label>

              <button
                onClick={handlePayment}
                disabled={!canSubmitPayment}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all flex items-center justify-center gap-2 ${
                  canSubmitPayment
                    ? "bg-primary text-white hover:brightness-110 shadow-lg shadow-primary/30"
                    : "bg-slate-200 dark:bg-slate-700 text-slate-400 cursor-not-allowed"
                }`}
              >
                {isProcessing ? (
                  <>
                    <span className="material-symbols-outlined animate-spin">
                      progress_activity
                    </span>
                    결제 처리 중...
                  </>
                ) : (
                  <>
                    <span>결제 요청하기</span>
                    <span className="material-symbols-outlined">
                      arrow_forward
                    </span>
                  </>
                )}
              </button>

              <div className="mt-5 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg">
                <div className="flex items-start gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-sm mt-0.5">
                    info
                  </span>
                  <p>
                    DevSolve는 안전한 결제를 위해 최선을 다하고 있습니다. 모든
                    결제 정보는 암호화되어 전송됩니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
