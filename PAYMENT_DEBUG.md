# 결제 페이지 "결제 요청하기" 버튼 비활성화 디버깅 가이드

## 문제 상황
https://devsolve.kro.kr/payment/16 페이지에서 "결제 요청하기" 버튼이 비활성화되어 있음

---

## 버튼 활성화 조건

결제 버튼이 활성화되려면 다음 **모든 조건**이 충족되어야 합니다:

```typescript
// src/pages/PaymentPage.tsx:244
const canSubmitPayment =
  agreeTerms &&          // 1. 약관 동의 체크됨
  !isProcessing &&       // 2. 결제 처리 중이 아님
  !configError &&        // 3. 결제 설정 에러 없음
  !!config &&            // 4. 결제 설정(PortOne) 로드됨
  !!tutorial;            // 5. 튜토리얼 정보 로드됨
```

---

## 디버깅 단계

### 1단계: 브라우저 개발자 도구 열기
- `F12` 또는 `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows)
- **Console** 탭으로 이동

### 2단계: 현재 상태 확인

콘솔에 다음 코드를 붙여넣고 실행:

```javascript
// 모든 조건 확인
console.log('=== 결제 버튼 활성화 조건 체크 ===');
console.log('1. 약관 동의 체크:', document.querySelector('input[type="checkbox"]')?.checked);
console.log('2. 결제 처리 중:', '버튼 텍스트 확인 필요');
console.log('3. 결제 설정 에러:', '콘솔 에러 메시지 확인');
console.log('4. PortOne 설정 로드:', '아래 Network 탭 확인');
console.log('5. 튜토리얼 정보 로드:', document.querySelector('h3')?.textContent || '로드 실패');
```

### 3단계: Network 탭 확인

**Console 탭 옆 Network 탭** 클릭 후:

#### 3-1. 튜토리얼 정보 로드 확인
```
Request URL: https://api.devsolve.kro.kr/api/tutorials/16
Method: GET
Status: 200 (정상) 또는 에러 코드
```

**확인 사항**:
- Status가 200이 아니면 → 튜토리얼 로드 실패
- CORS 에러 → 백엔드 CORS 설정 문제

#### 3-2. 결제 설정 로드 확인
```
Request URL: https://api.devsolve.kro.kr/api/payments/config
Method: GET
Status: 200 (정상) 또는 에러 코드
```

**Response 확인**:
```json
{
  "success": true,
  "data": {
    "storeId": "store-xxx",
    "channelKey": "channel-key-xxx"
  }
}
```

**가능한 문제**:
- ❌ Status 404/500 → 백엔드 엔드포인트 미구현
- ❌ Status 401 → 인증 필요 (토큰 문제)
- ❌ Response에 storeId/channelKey 없음 → 백엔드 응답 형식 문제

---

## 가장 가능성 높은 원인

### 원인 1: `/api/payments/config` 엔드포인트 미구현 (90% 가능성)

**증상**:
- Network 탭에서 `/api/payments/config` 요청이 404 또는 500 에러
- Console에 에러 메시지:
  ```
  결제 설정 로딩 실패: Error: config load failed: 404
  ```

**해결 방법**:
백엔드 팀에 다음 엔드포인트 구현 요청:

```
GET /api/payments/config

Response:
{
  "success": true,
  "data": {
    "storeId": "store-your-portone-id",
    "channelKey": "channel-key-xxxx-xxxx-xxxx"
  }
}
```

**백엔드 구현 예시 (Spring Boot)**:
```java
@RestController
@RequestMapping("/api/payments")
public class PaymentController {

    @Value("${portone.store.id}")
    private String storeId;

    @Value("${portone.channel.key}")
    private String channelKey;

    @GetMapping("/config")
    public ApiResponse<PaymentConfig> getPaymentConfig() {
        PaymentConfig config = PaymentConfig.builder()
            .storeId(storeId)
            .channelKey(channelKey)
            .build();

        return ApiResponse.success(config);
    }

    @Data
    @Builder
    static class PaymentConfig {
        private String storeId;
        private String channelKey;
    }
}
```

---

### 원인 2: CORS 에러 (5% 가능성)

**증상**:
- Console에 빨간 글씨 에러:
  ```
  Access to fetch at 'https://api.devsolve.kro.kr/api/payments/config'
  from origin 'https://devsolve.kro.kr' has been blocked by CORS policy
  ```

**해결 방법**:
백엔드 CORS 설정에 `https://devsolve.kro.kr` 추가

```java
@Configuration
public class WebConfig implements WebMvcConfigurer {
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
            .allowedOrigins(
                "http://localhost:5173",
                "https://devsolve.kro.kr",  // 추가 필요
                "https://*.vercel.app"
            )
            .allowedMethods("GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS")
            .allowedHeaders("*")
            .allowCredentials(true);
    }
}
```

---

### 원인 3: 튜토리얼 정보 로드 실패 (3% 가능성)

**증상**:
- Network 탭에서 `/api/tutorials/16` 요청이 404 또는 500 에러
- 페이지에 튜토리얼 제목이 표시되지 않음

**해결 방법**:
- 튜토리얼 ID 16이 실제로 존재하는지 확인
- 백엔드 데이터베이스 확인

---

### 원인 4: 약관 동의 체크 안 됨 (1% 가능성)

**증상**:
- 체크박스가 체크되지 않음
- 모든 API 호출은 성공했지만 버튼 비활성화

**해결 방법**:
- 페이지 하단 약관 동의 체크박스를 클릭

---

## 빠른 확인 방법

### Console에 다음 코드 실행:

```javascript
// API 호출 테스트
fetch('https://api.devsolve.kro.kr/api/payments/config')
  .then(res => res.json())
  .then(data => {
    console.log('✅ 결제 설정 로드 성공:', data);
    if (!data.storeId || !data.channelKey) {
      console.error('❌ storeId 또는 channelKey 없음:', data);
    }
  })
  .catch(err => {
    console.error('❌ 결제 설정 로드 실패:', err);
  });

fetch('https://api.devsolve.kro.kr/api/tutorials/16')
  .then(res => res.json())
  .then(data => {
    console.log('✅ 튜토리얼 로드 성공:', data);
  })
  .catch(err => {
    console.error('❌ 튜토리얼 로드 실패:', err);
  });
```

---

## 예상 결과별 조치

### Case 1: `/api/payments/config` 404 에러
```
❌ 결제 설정 로드 실패: Error: config load failed: 404
```

**조치**: 백엔드에 `/api/payments/config` 엔드포인트 구현 요청

---

### Case 2: `/api/payments/config` 응답에 데이터 없음
```
✅ 결제 설정 로드 성공: { success: true, data: null }
또는
✅ 결제 설정 로드 성공: { storeId: null, channelKey: null }
```

**조치**: 백엔드에서 PortOne 자격증명 설정 요청

---

### Case 3: CORS 에러
```
Access to fetch at '...' has been blocked by CORS policy
```

**조치**: 백엔드 CORS 설정에 `https://devsolve.kro.kr` 추가

---

### Case 4: 모든 API 성공했지만 버튼 비활성화
```
✅ 결제 설정 로드 성공
✅ 튜토리얼 로드 성공
```

**조치**:
1. 약관 동의 체크박스 클릭 확인
2. 페이지 새로고침 (Cmd+R / Ctrl+R)
3. 캐시 삭제 후 새로고침 (Cmd+Shift+R / Ctrl+Shift+R)

---

## 즉시 확인 체크리스트

백엔드 팀에게 확인 요청:

```
[결제 페이지 오류 - 긴급]

다음 엔드포인트들이 정상 작동하는지 확인 부탁드립니다:

1. GET /api/payments/config
   - 예상 응답: { "success": true, "data": { "storeId": "...", "channelKey": "..." } }
   - 현재 상태: (404 또는 500 에러 추정)

2. GET /api/tutorials/16
   - 예상 응답: 튜토리얼 정보
   - 현재 상태: (확인 필요)

3. CORS 설정:
   - https://devsolve.kro.kr 도메인 허용 확인

확인 후 회신 부탁드립니다.
```

---

## 프론트엔드 임시 디버그 코드

문제 확인을 위해 `PaymentPage.tsx`에 임시로 추가할 디버그 코드:

```typescript
// 29번 줄 아래에 추가
useEffect(() => {
  console.log('=== PaymentPage Debug ===');
  console.log('agreeTerms:', agreeTerms);
  console.log('isProcessing:', isProcessing);
  console.log('configError:', configError);
  console.log('config:', config);
  console.log('tutorial:', tutorial);
  console.log('canSubmitPayment:', canSubmitPayment);
}, [agreeTerms, isProcessing, configError, config, tutorial, canSubmitPayment]);
```

이 코드를 추가하고 페이지 새로고침하면 Console에서 실시간 상태를 볼 수 있습니다.
