"""
题目管理API接口
"""
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Request
from fastapi.responses import HTMLResponse, FileResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session, load_only
from sqlalchemy import func, or_, cast, String
from typing import List, Optional
from uuid import UUID
import os
import uuid
import json
import time
import shutil
import glob
import logging
from datetime import datetime

from ...db.database import get_db
from ...models import Question, QuestionImage, ExtractionHistory
from ...services.question_extractor import HumanLogicQuestionExtractor, print_extraction_summary, QuestionImageExtractor
# 移除有问题的导入，暂时不使用

router = APIRouter()
logger = logging.getLogger(__name__)
templates = Jinja2Templates(directory="templates")

# 上传文件存储目录
UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload", response_model=dict)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """上传docx文档进行解析"""
    
    # 验证文件类型
    if not file.filename.endswith('.docx'):
        raise HTTPException(status_code=400, detail="只支持.docx文件")
    
    # 保存上传文件
    file_id = str(uuid.uuid4())
    file_path = os.path.join(UPLOAD_DIR, f"{file_id}_{file.filename}")
    
    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        # 开始提取
        start_time = time.time()
        extractor = HumanLogicQuestionExtractor()
        result = extractor.extract_questions(file_path)
        processing_time = int(time.time() - start_time)
        
        # 记录提取历史
        history = ExtractionHistory(
            id=str(uuid.uuid4()),
            filename=file.filename,
            file_path=file_path,
            total_questions_extracted=result.get('total_questions', 0),
            total_images_extracted=result.get('total_images', 0),
            success=result.get('success', False),
            error_message=result.get('error', ''),
            extraction_result=json.dumps(result, ensure_ascii=False),
            processing_time_seconds=processing_time
        )
        db.add(history)
        
        if result['success']:
            # 保存题目到数据库
            questions_saved = 0
            total_images_saved = 0
            
            # 创建图片提取器
            image_extractor = QuestionImageExtractor(output_dir=os.path.join(UPLOAD_DIR, "images"))
            
            # 重新打开文档用于图片提取
            from docx import Document
            doc = Document(file_path)
            
            for question_data in result['questions']:
                question_id = str(uuid.uuid4())
                
                # 保存题目
                question = Question(
                    id=question_id,
                    title=f"题目{question_data['number']}",
                    content=json.dumps(question_data['content'], ensure_ascii=False),
                    question_type=question_data['section'],
                    question_number=question_data['number'],
                    source=file.filename,
                    paragraph_range=question_data['paragraph_range'],
                    total_images=question_data['content']['total_images'],
                    total_text_length=question_data['content']['total_text_length']
                )
                db.add(question)
                
                # 提取和保存图片
                try:
                    images = image_extractor.extract_images_from_question(doc, question_data, question_id)
                    for img_data in images:
                        # 透传图片类型（材料/选项）
                        image_type_value = img_data.get('image_type') if img_data.get('image_type') in ('material', 'option') else None
                        question_image = QuestionImage(
                            id=str(uuid.uuid4()),
                            question_id=question_id,
                            image_name=os.path.basename(img_data['filename']) if img_data.get('filename') else None,
                            image_path=img_data['filename'],  # 只存储相对路径
                            image_order=img_data['position_in_question'],
                            image_type=image_type_value,
                            context_text=img_data['context_text'],
                            paragraph_index=img_data['paragraph_index'],
                            position_in_question=img_data['position_in_question'],
                            order_index=img_data['position_in_question'],
                            created_at=datetime.utcnow()
                        )
                        db.add(question_image)
                        total_images_saved += 1
                        
                except Exception as e:
                    print(f"图片提取失败 - 题目{question_data['number']}: {str(e)}")
                
                questions_saved += 1
            
            db.commit()
            
            return {
                "success": True,
                "message": "文档解析成功",
                "extraction_id": history.id,
                "questions_count": result['total_questions'],
                "images_count": result['total_images'],
                "images_saved": total_images_saved,
                "questions_saved": questions_saved,
                "processing_time": processing_time,
                "validation": result['validation']
            }
        else:
            db.commit()
            raise HTTPException(status_code=500, detail=f"解析失败：{result.get('error', '未知错误')}")
            
    except Exception as e:
        # 清理文件
        if os.path.exists(file_path):
            os.remove(file_path)
        raise HTTPException(status_code=500, detail=f"处理失败：{str(e)}")


@router.get("/")
async def list_questions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    question_type: Optional[str] = None,
    search: Optional[str] = None,
    question_number: Optional[int] = Query(None, ge=1),
    sort_by: Optional[str] = Query("number", regex="^(number|created_at)$"),
    order: Optional[str] = Query("asc", regex="^(asc|desc)$"),
    db: Session = Depends(get_db)
):
    """获取题目列表（支持筛选/搜索/排序/分页）"""

    query = (
        db.query(Question)
        .options(
            load_only(
                Question.id,
                Question.title,
                Question.question_number,
                Question.question_type,
                Question.total_images,
                Question.paragraph_range,
                Question.created_at,
            )
        )
    )

    # 按类型筛选
    if question_type:
        query = query.filter(Question.question_type.contains(question_type))

    # 按题号精确跳转
    if question_number is not None:
        query = query.filter(Question.question_number == question_number)

    # 关键词搜索（标题/内容）
    if search:
        like_expr = f"%{search}%"
        query = query.filter(
            or_(
                Question.title.contains(search),
                Question.content.like(like_expr)
            )
        )

    # 排序
    if sort_by == "created_at":
        order_column = Question.created_at
    else:
        order_column = Question.question_number

    # 为了避免同一题号存在多条记录时返回旧数据的问题，这里在主排序字段之外
    # 追加按创建时间倒序、按ID倒序的稳定排序，确保默认取到最新导入的记录。
    if order == "desc":
        query = query.order_by(
            order_column.desc(),
            Question.created_at.desc(),
            Question.id.desc(),
        )
    else:
        query = query.order_by(
            order_column.asc(),
            Question.created_at.desc(),
            Question.id.desc(),
        )

    # 统计总数（在分页前）
    total = query.count()

    # 分页
    offset = (page - 1) * page_size
    questions = query.offset(offset).limit(page_size).all()

    result = {
        "questions": [
            {
                "id": q.id,
                "title": q.title,
                "question_number": q.question_number,
                "question_type": q.question_type,
                "total_images": q.total_images,
                "paragraph_range": q.paragraph_range,
                "created_at": q.created_at.isoformat() if q.created_at else None
            }
            for q in questions
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size
    }
    return result


# 统计信息接口（用于前端动态刷新统计与题型下拉）
@router.get("/stats")
async def get_questions_stats(db: Session = Depends(get_db)):
    total_questions = db.query(Question).count()
    total_extractions = db.query(ExtractionHistory).count()

    # 题型分布（完整类型名）
    rows = db.query(Question.question_type, func.count(Question.id)).group_by(Question.question_type).all()
    type_distribution = [
        {"type": (t or "未知"), "count": c}
        for t, c in rows
    ]

    # 最近提取（最多5条）
    recent = db.query(ExtractionHistory).order_by(ExtractionHistory.created_at.desc()).limit(5).all()
    recent_extractions = [
        {
            "id": e.id,
            "filename": e.filename,
            "total_questions_extracted": e.total_questions_extracted,
            "total_images_extracted": e.total_images_extracted,
            "success": e.success,
            "error_message": e.error_message,
            "processing_time_seconds": e.processing_time_seconds,
            "created_at": e.created_at.isoformat() if e.created_at else None
        }
        for e in recent
    ]

    return {
        "total_questions": total_questions,
        "total_extractions": total_extractions,
        "type_distribution": type_distribution,
        "recent_extractions": recent_extractions
    }


# 题型洞察：返回原始题型取值、归一化统计与映射建议
@router.get("/type-insights")
async def get_question_type_insights(db: Session = Depends(get_db)):
    """统计所有题型原始值，并提供归一化后的聚合结果与映射建议"""
    rows = (
        db.query(Question.question_type, func.count(Question.id))
        .group_by(Question.question_type)
        .all()
    )

    def normalize(raw: str) -> str:
        t = (raw or "").strip()
        if "言语" in t:
            return "言语理解与表达"
        if "资料" in t:
            return "资料分析"
        if "常识" in t:
            return "常识判断"
        if "判断" in t:
            return "判断推理"
        if "数量" in t:
            return "数量关系"
        if "政治" in t:
            return "政治理论"
        return "未知"

    raw_types = []
    mappings = []
    normalized_counts = {}

    for raw, cnt in rows:
        raw_name = raw or "未知"
        norm = normalize(raw_name)
        raw_types.append({"raw": raw_name, "count": cnt})
        mappings.append({"raw": raw_name, "normalized": norm, "count": cnt})
        normalized_counts[norm] = normalized_counts.get(norm, 0) + int(cnt or 0)

    order = ["政治理论", "常识判断", "言语理解与表达", "数量关系", "判断推理", "资料分析", "未知"]
    normalized = [
        {"type": k, "count": normalized_counts.get(k, 0)}
        for k in order
        if normalized_counts.get(k, 0) > 0
    ]

    known = sum(v for k, v in normalized_counts.items() if k != "未知")
    unknown = normalized_counts.get("未知", 0)
    total = known + unknown

    # 排序：按数量倒序
    raw_types.sort(key=lambda x: x["count"], reverse=True)
    mappings.sort(key=lambda x: x["count"], reverse=True)

    return {
        "raw_types": raw_types,
        "normalized": normalized,
        "mappings": mappings,
        "coverage": {"known": known, "unknown": unknown, "total": total},
        "order": order,
    }


@router.get("/{question_id}")
async def get_question(question_id: str, db: Session = Depends(get_db)):
    """获取题目详情"""
    try:
        uuid_obj = UUID(question_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="题目ID无效")
    str_question_id = str(uuid_obj)

    question = db.query(Question).filter(Question.id == str_question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")

    try:
        content = json.loads(question.content) if question.content else {}
    except Exception:
        content = {"error": "数据解析失败"}

    images = (
        db.query(QuestionImage)
        .filter(cast(QuestionImage.question_id, String) == str_question_id)
        .order_by(QuestionImage.order_index)
        .all()
    )
    image_list = []
    for img in images:
        image_list.append({
            "id": img.id,
            "url": f"/api/v1/questions/images/{img.image_path}",
            "image_type": img.image_type,
            "context_text": img.context_text,
            "paragraph_index": img.paragraph_index,
            "position_in_question": img.position_in_question,
        })

    # 若为资料分析非组首题，则补充本组组首题的材料图片
    try:
        if question.question_type and ('资料分析' in question.question_type):
            # 计算该题型的起始题号（最小题号）
            min_num = (
                db.query(func.min(Question.question_number))
                .filter(Question.question_type == question.question_type)
                .scalar()
            )
            if min_num is None:
                min_num = question.question_number
            # 每组5题：起始 = min_num + floor((n - min_num)/5)*5
            n = int(question.question_number or 0)
            group_start_num = int(min_num + ((n - min_num) // 5) * 5)
            # 先判断是否已有“材料图”，若已有则不再从组长题补充，避免重复
            def is_option_ctx(ctx: str) -> bool:
                if not ctx:
                    return False
                ctx = ctx.strip()
                return True if len(ctx) > 0 and ctx[0] in ['A', 'B', 'C', 'D', '��', '��', '��', '��'] else False
            has_material = any((img.get("image_type") == 'material') or (img.get("image_type") is None and not is_option_ctx(img.get("context_text"))) for img in image_list)
            if (n != group_start_num) and (not has_material):
                leader = (
                    db.query(Question)
                    .filter(
                        Question.question_number == group_start_num,
                        Question.question_type == question.question_type,
                    )
                    .first()
                )
                if leader:
                    leader_imgs = (
                        db.query(QuestionImage)
                        .filter(cast(QuestionImage.question_id, String) == str(leader.id))
                        .order_by(QuestionImage.order_index)
                        .all()
                    )
                    # 仅补充材料图（非选项图）。兼容旧数据：image_type 为空时用上下文首字母匹配
                    def is_option_ctx(ctx: str) -> bool:
                        if not ctx:
                            return False
                        ctx = ctx.strip()
                        return True if len(ctx) > 0 and ctx[0] in ['A', 'B', 'C', 'D', 'Ａ', 'Ｂ', 'Ｃ', 'Ｄ'] else False
                    existing_urls = {i["url"] for i in image_list}
                    for limg in leader_imgs:
                        is_option = (limg.image_type == 'option') or is_option_ctx(limg.context_text or '')
                        if is_option:
                            continue
                        url = f"/api/v1/questions/images/{limg.image_path}"
                        if url in existing_urls:
                            continue
                        image_list.insert(0, {
                            "id": limg.id,
                            "url": url,
                            "image_type": limg.image_type or 'material',
                            "context_text": limg.context_text,
                            "paragraph_index": limg.paragraph_index,
                            "position_in_question": limg.position_in_question,
                        })

            # 兜底：如果组首题材料也为空，则从本组所有小题中聚合“非选项图”作为材料补充，仅用于展示
            has_material = any((img.get("image_type") == 'material') or (img.get("image_type") is None and not (img.get("context_text") or '').strip().startswith(('A', 'B', 'C', 'D', 'Ａ', 'Ｂ', 'Ｃ', 'Ｄ'))) for img in image_list)
            if not has_material:
                group_end_num = group_start_num + 4
                group_qs = (
                    db.query(Question)
                    .filter(
                        Question.question_type == question.question_type,
                        Question.question_number >= group_start_num,
                        Question.question_number <= group_end_num,
                    ).all()
                )
                group_ids = [str(q.id) for q in group_qs]
                if group_ids:
                    group_imgs = (
                        db.query(QuestionImage)
                        .filter(cast(QuestionImage.question_id, String).in_(group_ids))
                        .order_by(QuestionImage.paragraph_index, QuestionImage.order_index)
                        .all()
                    )
                    def is_option_img(img_obj) -> bool:
                        ctx = (img_obj.context_text or '').strip()
                        return (img_obj.image_type == 'option') or (len(ctx) > 0 and ctx[0] in ['A', 'B', 'C', 'D', 'Ａ', 'Ｂ', 'Ｃ', 'Ｄ'])
                    supplemental = []
                    seen_paths = {i["url"] for i in image_list}
                    for gi in group_imgs:
                        if is_option_img(gi):
                            continue
                        url = f"/api/v1/questions/images/{gi.image_path}"
                        if url in seen_paths:
                            continue
                        supplemental.append({
                            "id": gi.id,
                            "url": url,
                            "image_type": gi.image_type or 'material',
                            "context_text": gi.context_text,
                            "paragraph_index": gi.paragraph_index,
                            "position_in_question": gi.position_in_question,
                        })
                    if supplemental:
                        # 仅前2-3张作为材料展示，避免过多
                        image_list = supplemental[:3] + image_list
    except Exception:
        # 补充失败不影响主体返回
        pass

    return {
        "id": question.id,
        "title": question.title,
        "question_number": question.question_number,
        "question_type": question.question_type,
        "content": content,
        "paragraph_range": question.paragraph_range,
        "total_images": question.total_images,
        "images": image_list,
        "source": question.source,
        "created_at": question.created_at.isoformat() if question.created_at else None,
    }


@router.get("/images/{image_filename}")
async def get_image(image_filename: str):
    """获取图片文件"""
    image_path = os.path.join(UPLOAD_DIR, "images", image_filename)
    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="图片不存在")
    
    return FileResponse(
        path=image_path,
        media_type="image/jpeg",  # 根据实际文件类型调整
        headers={"Cache-Control": "max-age=3600"}
    )


@router.put("/{question_id}")
async def update_question(
    question_id: str,
    title: Optional[str] = None,
    question_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """更新题目信息"""
    
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")
    
    if title:
        question.title = title
    if question_type:
        question.question_type = question_type
    
    db.commit()
    
    return {"message": "更新成功", "question_id": question_id}


@router.delete("/{question_id}")
async def delete_question(question_id: str, db: Session = Depends(get_db)):
    """删除题目"""
    
    question = db.query(Question).filter(Question.id == question_id).first()
    if not question:
        raise HTTPException(status_code=404, detail="题目不存在")
    
    db.delete(question)
    db.commit()
    
    return {"message": "删除成功", "question_id": question_id}


@router.post("/clear-all")
async def clear_all_questions(
    clear_history: bool = Query(False, description="是否同时清空提取历史"),
    db: Session = Depends(get_db)
):
    """清空所有题目和图片数据"""
    
    try:
        # 统计要删除的数据
        total_questions = db.query(Question).count()
        total_images = db.query(QuestionImage).count()
        total_history = db.query(ExtractionHistory).count()
        
        # 获取所有图片文件路径（用于删除文件）
        image_files = db.query(QuestionImage.image_path).all()
        image_paths = [img.image_path for img in image_files]
        
        # 删除数据库记录（由于外键关系，先删除图片记录）
        db.query(QuestionImage).delete()
        db.query(Question).delete()
        
        if clear_history:
            db.query(ExtractionHistory).delete()
        
        db.commit()
        
        # 删除实际的图片文件
        images_dir = os.path.join(UPLOAD_DIR, "images")
        deleted_files = 0
        
        if os.path.exists(images_dir):
            for image_path in image_paths:
                full_path = os.path.join(images_dir, image_path)
                if os.path.exists(full_path):
                    try:
                        os.remove(full_path)
                        deleted_files += 1
                    except Exception as e:
                        print(f"删除图片文件失败 {image_path}: {str(e)}")
        
        # 清理空目录和临时文件
        try:
            # 删除所有剩余的图片文件（防止有遗漏的）
            if os.path.exists(images_dir):
                for file_pattern in ['*.jpg', '*.jpeg', '*.png', '*.gif']:
                    for file_path in glob.glob(os.path.join(images_dir, file_pattern)):
                        try:
                            os.remove(file_path)
                            deleted_files += 1
                        except:
                            pass
        except Exception as e:
            print(f"清理图片目录失败: {str(e)}")
        
        return {
            "success": True,
            "message": "题库清空成功",
            "statistics": {
                "deleted_questions": total_questions,
                "deleted_images_records": total_images,
                "deleted_image_files": deleted_files,
                "deleted_history": total_history if clear_history else 0,
                "history_cleared": clear_history
            }
        }
        
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"清空失败：{str(e)}")


@router.get("/history/extractions")
async def list_extractions(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db)
):
    """获取提取历史"""
    
    offset = (page - 1) * page_size
    extractions = db.query(ExtractionHistory).order_by(
        ExtractionHistory.created_at.desc()
    ).offset(offset).limit(page_size).all()
    
    total = db.query(ExtractionHistory).count()
    
    return {
        "extractions": [
            {
                "id": e.id,
                "filename": e.filename,
                "total_questions_extracted": e.total_questions_extracted,
                "total_images_extracted": e.total_images_extracted,
                "success": e.success,
                "error_message": e.error_message,
                "processing_time_seconds": e.processing_time_seconds,
                "created_at": e.created_at.isoformat() if e.created_at else None
            }
            for e in extractions
        ],
        "total": total,
        "page": page,
        "page_size": page_size
    }


# 统计信息接口（用于前端动态刷新统计与题型下拉）
@router.get("/stats")
async def get_questions_stats(db: Session = Depends(get_db)):
    total_questions = db.query(Question).count()
    total_extractions = db.query(ExtractionHistory).count()

    # 题型分布（完整类型名）
    rows = db.query(Question.question_type, func.count(Question.id)).group_by(Question.question_type).all()
    type_distribution = [
        {"type": (t or "未知"), "count": c}
        for t, c in rows
    ]

    # 最近提取（最多5条）
    recent = db.query(ExtractionHistory).order_by(ExtractionHistory.created_at.desc()).limit(5).all()
    recent_extractions = [
        {
            "id": e.id,
            "filename": e.filename,
            "total_questions_extracted": e.total_questions_extracted,
            "total_images_extracted": e.total_images_extracted,
            "success": e.success,
            "error_message": e.error_message,
            "processing_time_seconds": e.processing_time_seconds,
            "created_at": e.created_at.isoformat() if e.created_at else None
        }
        for e in recent
    ]

    return {
        "total_questions": total_questions,
        "total_extractions": total_extractions,
        "type_distribution": type_distribution,
        "recent_extractions": recent_extractions
    }

# 管理界面路由
@router.get("/admin/dashboard", response_class=HTMLResponse)
async def questions_admin(request: Request, db: Session = Depends(get_db)):
    """��Ŀ�����ҳ��"""

    try:
        # ͳ����Ϣ
        total_questions = db.query(func.count(Question.id)).scalar() or 0
        total_extractions = db.query(func.count(ExtractionHistory.id)).scalar() or 0

        # ���ͷֲ�
        type_distribution = {}
        for question_type, count in (
            db.query(Question.question_type, func.count(Question.id))
            .group_by(Question.question_type)
            .all()
        ):
            key = question_type if question_type else "δ֪"
            type_distribution[key] = count

        # �����ȡ
        recent_extractions = (
            db.query(ExtractionHistory)
            .order_by(ExtractionHistory.created_at.desc())
            .limit(5)
            .all()
        )
        # SSR 首屏列表兜底，避免前端脚本异常导致空白
        try:
            ssr_qs = (
                db.query(Question)
                .options(
                    load_only(
                        Question.id,
                        Question.question_number,
                        Question.question_type,
                        Question.total_images,
                        Question.paragraph_range,
                        Question.created_at,
                    )
                )
                .order_by(Question.question_number.asc(), Question.created_at.desc(), Question.id.desc())
                .limit(20)
                .all()
            )
            ssr_questions = [
                {
                    "id": q.id,
                    "question_number": q.question_number,
                    "question_type": q.question_type,
                    "total_images": q.total_images,
                    "paragraph_range": q.paragraph_range,
                    "created_at": q.created_at.isoformat() if q.created_at else None,
                }
                for q in ssr_qs
            ]
        except Exception:
            ssr_questions = []

    except Exception as exc:
        logger.warning("����ͳ����Ϣʧ�ܣ�����ʹ���ն����ݣ�%s", exc)
        total_questions = 0
        total_extractions = 0
        type_distribution = {}
        recent_extractions = []
        ssr_questions = []

    return templates.TemplateResponse("questions_admin.html", {
        "request": request,
        "total_questions": total_questions,
        "total_extractions": total_extractions,
        "type_distribution": type_distribution,
        "recent_extractions": recent_extractions,
        "ssr_questions": ssr_questions,
    })
