from app.services.ai_service import generate_adaptive_score_details
from pprint import pprint
content = 'X'*800
res = generate_adaptive_score_details(content, '综合分析题', 85.0, '反馈')
print('Count:', len(res))
for d in res:
    print(d.item, d.fullScore, d.actualScore)
