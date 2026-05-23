// 네이버 지역 검색 API 호출 함수 (Cloudflare Pages Functions)
// 경로: /api/naver-search
// 환경 변수(NAVER_CLIENT_ID, NAVER_CLIENT_SECRET)는 Cloudflare 대시보드에서 설정

export async function onRequest(context) {
  const { request, env } = context;

  // CORS 헤더
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS 요청 처리 (preflight)
  if (request.method === 'OPTIONS') {
    return new Response('', { status: 200, headers });
  }

  try {
    // URL 파라미터에서 검색어 받기
    const url = new URL(request.url);
    const query = url.searchParams.get('query');

    if (!query) {
      return new Response(
        JSON.stringify({ error: '검색어가 필요해요' }),
        { status: 400, headers }
      );
    }

    // 환경 변수에서 네이버 API 키 가져오기
    const NAVER_CLIENT_ID = env.NAVER_CLIENT_ID;
    const NAVER_CLIENT_SECRET = env.NAVER_CLIENT_SECRET;

    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      return new Response(
        JSON.stringify({ error: '네이버 API 키가 설정되지 않았어요' }),
        { status: 500, headers }
      );
    }

    // 네이버 지역 검색 API 호출
    const naverUrl = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5&start=1&sort=random`;

    const response = await fetch(naverUrl, {
      method: 'GET',
      headers: {
        'X-Naver-Client-Id': NAVER_CLIENT_ID,
        'X-Naver-Client-Secret': NAVER_CLIENT_SECRET
      }
    });

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: `네이버 API 오류: ${response.status}` }),
        { status: response.status, headers }
      );
    }

    const data = await response.json();

    // 네이버 응답을 우리 형식으로 변환
    const places = (data.items || []).map(item => {
      const cleanName = item.title.replace(/<\/?b>/g, '').replace(/&amp;/g, '&');
      const lng = parseFloat(item.mapx) / 10000000;
      const lat = parseFloat(item.mapy) / 10000000;

      return {
        place_name: cleanName,
        address_name: item.address || '',
        road_address_name: item.roadAddress || item.address || '',
        category_name: item.category || '음식점 > 한식',
        phone: item.telephone || '',
        place_url: item.link || `https://search.naver.com/search.naver?query=${encodeURIComponent(cleanName)}`,
        x: lng,
        y: lat,
        id: 'naver_' + (item.title + item.address).replace(/[^a-zA-Z0-9가-힣]/g, '').substring(0, 20),
        source: 'naver'
      };
    });

    return new Response(
      JSON.stringify({ success: true, total: data.total, places: places }),
      { status: 200, headers }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: '서버 오류가 발생했어요', message: error.message }),
      { status: 500, headers }
    );
  }
}
