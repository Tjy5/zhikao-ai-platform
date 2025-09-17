#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""重新导入指定行测 docx 题目并写入数据库"""
import json
import os
import shutil
import time
import uuid
from pathlib import Path
from datetime import datetime

from docx import Document

from app.db.database import Base, SessionLocal, engine
from app.models import Question, QuestionImage, ExtractionHistory
from app.services.question_extractor import HumanLogicQuestionExtractor, QuestionImageExtractor

BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
DOC_RELATIVE_PATH = Path('题目') / '2025年国家公务员录用考试《行测》题（副省级网友回忆版）.docx'
SOURCE_DOC_PATH = ROOT_DIR / DOC_RELATIVE_PATH
UPLOAD_DIR = BASE_DIR / 'uploads'
IMAGES_DIR = UPLOAD_DIR / 'images'


def ensure_environment() -> None:
    """确保运行环境可用，如目录与数据库表"""
    if not SOURCE_DOC_PATH.exists():
        raise FileNotFoundError(f'找不到原始文档: {SOURCE_DOC_PATH}')
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)
    Base.metadata.create_all(bind=engine)


def cleanup_existing(session, source_name: str) -> None:
    """删除同名来源的旧题目与图片文件，避免重复数据"""
    existing_questions = session.query(Question).filter(Question.source == source_name).all()
    for question in existing_questions:
        for image in list(question.images):
            if image.image_path:
                image_file = IMAGES_DIR / image.image_path
                if image_file.exists():
                    try:
                        image_file.unlink()
                    except OSError:
                        pass
        session.delete(question)
    existing_histories = (
        session.query(ExtractionHistory)
        .filter(ExtractionHistory.filename == source_name)
        .all()
    )
    for history in existing_histories:
        session.delete(history)


def run_import() -> None:
    ensure_environment()
    source_name = SOURCE_DOC_PATH.name
    temp_file_id = str(uuid.uuid4())
    stored_doc_path = UPLOAD_DIR / f'{temp_file_id}_{source_name}'
    shutil.copyfile(SOURCE_DOC_PATH, stored_doc_path)

    extractor = HumanLogicQuestionExtractor()
    start = time.time()
    result = extractor.extract_questions(str(stored_doc_path))
    processing_seconds = int(time.time() - start)

    session = SessionLocal()
    try:
        cleanup_existing(session, source_name)

        history = ExtractionHistory(
            id=str(uuid.uuid4()),
            filename=source_name,
            file_path=str(stored_doc_path),
            total_questions_extracted=result.get('total_questions', 0),
            total_images_extracted=result.get('total_images', 0),
            success=result.get('success', False),
            error_message=result.get('error', ''),
            extraction_result=json.dumps(result, ensure_ascii=False),
            processing_time_seconds=processing_seconds,
        )
        session.add(history)

        if not result.get('success', False):
            session.commit()
            raise RuntimeError(f"解析失败: {result.get('error', '未知错误')}")

        doc = Document(str(stored_doc_path))
        image_extractor = QuestionImageExtractor(output_dir=str(IMAGES_DIR))

        saved_questions = 0
        saved_images = 0
        for qdata in result['questions']:
            question_id = str(uuid.uuid4())
            question = Question(
                id=question_id,
                title=f"题目{qdata['number']}",
                content=json.dumps(qdata.get('content', {}), ensure_ascii=False),
                question_type=qdata.get('section'),
                question_number=qdata.get('number'),
                parent_question_id=None,
                difficulty=None,
                source=source_name,
                paragraph_range=qdata.get('paragraph_range'),
                total_images=qdata.get('content', {}).get('total_images', 0),
                total_text_length=qdata.get('content', {}).get('total_text_length', 0),
            )
            session.add(question)

            try:
                images = image_extractor.extract_images_from_question(doc, qdata, question_id)
            except Exception as exc:
                images = []
                print(f'题目{qdata.get("number")}提取图片失败: {exc}')

            for img in images:
                question_image = QuestionImage(
                    id=str(uuid.uuid4()),
                    question_id=question_id,
                    image_name=os.path.basename(img.get('filename') or ''),
                    image_path=img.get('filename'),
                    image_type=img.get('image_type'),
                    image_order=img.get('position_in_question'),
                    ocr_text=None,
                    context_text=img.get('context_text'),
                    paragraph_index=img.get('paragraph_index'),
                    position_in_question=img.get('position_in_question'),
                    order_index=img.get('position_in_question'),
                    created_at=datetime.utcnow(),
                )
                session.add(question_image)
                saved_images += 1
            saved_questions += 1

        session.commit()
        print(f'导入完成: 题目 {saved_questions} 道, 图片 {saved_images} 张, 处理耗时 {processing_seconds} 秒')
        print(f'文档已存储至: {stored_doc_path}')
    finally:
        session.close()


if __name__ == '__main__':
    run_import()


