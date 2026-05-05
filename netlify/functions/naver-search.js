// 네이버 지역 검색 API 호출 함수
// Netlify Functions는 서버 역할을 해서 CORS 문제 없이 API 호출 가능
// 환경 변수에 저장된 네이버 키를 안전하게 사용

exports.handler = async (event, context) => {
  // CORS 헤더 (브라우저에서 호출 가능하도록)
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // OPTIONS 요청 처리 (preflight)
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // URL 파라미터에서 검색어 받기
    const query = event.queryStringParameters?.query;
    
    if (!query) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: '검색어가 필요해요' })
      };
    }

    // 환경 변수에서 네이버 API 키 가져오기 (안전하게 보관됨)
    const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
    const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

    if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: '네이버 API 키가 설정되지 않았어요' })
      };
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
      return {
        statusCode: response.status,
        headers,
        body: JSON.stringify({ error: `네이버 API 오류: ${response.status}` })
      };
    }

    const data = await response.json();

    // 네이버 응답을 우리 형식으로 변환
    const places = (data.items || []).map(item => {
      // HTML 태그 제거 (네이버는 검색어를 <b> 태그로 강조해서 보냄)
      const cleanName = item.title.replace(/<\/?b>/g, '').replace(/&amp;/g, '&');
      
      // 네이버 좌표는 카텍 좌표계 → 위경도 변환 필요
      // mapx, mapy는 1000만배 곱한 값으로 옴
      const lng = parseFloat(item.mapx) / 10000000;
      const lat = parseFloat(item.mapy) / 10000000;
      
      return {
        place_name: cleanName,
        address_name: item.address || '',
        road_address_name: item.roadAddress || item.address || '',
        category_name: item.category || '음식점 > 한식',
        phone: item.telephone || '',
        place_url: item.link || `https://search.naver.com/search.naver?query=${encodeURIComponent(cleanName)}`,
        x: lng,  // 경도
        y: lat,  // 위도
        id: 'naver_' + (item.title + item.address).replace(/[^a-zA-Z0-9가-힣]/g, '').substring(0, 20),
        source: 'naver'
      };
    });

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: true,
        total: data.total,
        places: places
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: '서버 오류가 발생했어요',
        message: error.message 
      })
    };
  }
};
