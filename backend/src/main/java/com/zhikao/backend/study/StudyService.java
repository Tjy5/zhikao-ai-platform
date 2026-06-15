package com.zhikao.backend.study;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.zhikao.backend.common.Clock;
import com.zhikao.backend.data.UserRecord;
import com.zhikao.backend.data.UserRepository;
import com.zhikao.backend.security.CurrentUser;
import com.zhikao.backend.study.StudyDtos.EditRequest;
import com.zhikao.backend.study.StudyDtos.ProposeRequest;
import com.zhikao.backend.study.StudyDtos.ProposalsResponse;
import com.zhikao.backend.study.StudyDtos.RejectResponse;
import com.zhikao.backend.study.StudyDtos.RevisionDetail;
import com.zhikao.backend.study.StudyDtos.RevisionSummary;
import com.zhikao.backend.study.StudyDtos.RevisionsResponse;
import com.zhikao.backend.study.StudyDtos.SectionLive;
import com.zhikao.backend.study.StudyDtos.SectionsResponse;
import com.zhikao.backend.study.StudyRevisionRepository.RevisionSummaryRow;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

/**
 * Versioning / proposal / audit state machine for study content (parent design.md §4, §6). Writers
 * are {@code @Transactional}; the SQLite single-connection datasource (pool=1) serializes them and
 * keeps each "new published + supersede old + update section pointer" step atomic. {@code
 * author_id} is ALWAYS taken from {@link CurrentUser#id()} — request bodies carry no author field.
 */
@Service
public class StudyService {
  static final int MAX_CONTENT_BYTES = 64 * 1024;
  private static final int DEFAULT_LIMIT = 50;
  private static final int MAX_LIMIT = 200;

  private final StudySectionRepository sections;
  private final StudyRevisionRepository revisions;
  private final UserRepository users;
  private final ObjectMapper mapper;
  private final Clock clock;

  public StudyService(
      StudySectionRepository sections,
      StudyRevisionRepository revisions,
      UserRepository users,
      ObjectMapper mapper,
      Clock clock) {
    this.sections = sections;
    this.revisions = revisions;
    this.users = users;
    this.mapper = mapper;
    this.clock = clock;
  }

  // ----- reads -------------------------------------------------------------

  public SectionsResponse getSections() {
    List<SectionLive> live = new ArrayList<>();
    for (String key : StudySectionShape.KEYS) {
      sections
          .findById(key)
          .filter(section -> section.currentRevisionId() != null)
          .ifPresent(section -> live.add(loadLive(section)));
    }
    return new SectionsResponse(live);
  }

  public SectionLive getSection(String key) {
    StudySectionShape.forKey(key); // 404 on unknown key
    StudySectionRecord section =
        sections
            .findById(key)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "节不存在"));
    if (section.currentRevisionId() == null) {
      throw new ResponseStatusException(HttpStatus.NOT_FOUND, "节暂无已发布内容");
    }
    return loadLive(section);
  }

  public RevisionsResponse getRevisions(String key, Integer requestedLimit, Integer requestedOffset) {
    StudySectionShape.forKey(key);
    int limit = clampLimit(requestedLimit);
    int offset = clampOffset(requestedOffset);
    List<RevisionSummary> items =
        revisions.listSummariesBySection(key, limit, offset).stream()
            .map(StudyService::toSummary)
            .toList();
    return new RevisionsResponse(items, revisions.countBySection(key));
  }

  public RevisionDetail getRevision(long id) {
    StudyRevisionRecord record = requireRevision(id);
    return toDetail(record);
  }

  public ProposalsResponse getProposals(Integer requestedLimit, Integer requestedOffset) {
    int limit = clampLimit(requestedLimit);
    int offset = clampOffset(requestedOffset);
    List<RevisionSummary> items =
        revisions.listProposedSummaries(limit, offset).stream()
            .map(StudyService::toSummary)
            .toList();
    return new ProposalsResponse(items, revisions.countProposed());
  }

  // ----- writes ------------------------------------------------------------

  /** user/admin → new {@code proposed/propose} row; live content unchanged. */
  @Transactional
  public RevisionSummary propose(
      String key, CurrentUser author, ProposeRequest request) {
    String content = validateAndStore(key, request.contentJson());
    ensureSection(key);
    Instant now = clock.now();
    long id =
        revisions.insert(
            new StudyRevisionRecord(
                null,
                key,
                content,
                author.id(),
                now,
                request.changeSummary(),
                "proposed",
                "propose",
                null,
                null,
                null,
                null));
    return toSummary(revisions.listSummariesBySection(key, DEFAULT_LIMIT, 0).stream()
        .filter(row -> row.id() == id)
        .findFirst()
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "提案读取失败")));
  }

  /** admin → new {@code published/direct_edit}; old published → superseded; pointer updated. */
  @Transactional
  public RevisionDetail edit(String key, CurrentUser admin, EditRequest request) {
    String content = validateAndStore(key, request.contentJson());
    ensureSection(key);
    Instant now = clock.now();
    revisions.markCurrentPublishedSuperseded(key);
    long id =
        revisions.insert(
            new StudyRevisionRecord(
                null,
                key,
                content,
                admin.id(),
                now,
                request.changeSummary(),
                "published",
                "direct_edit",
                null,
                null,
                null,
                null));
    sections.updateCurrent(key, id, now, admin.id());
    return toDetail(requireRevision(id));
  }

  /**
   * admin → approve a proposal. New {@code published/approve} row keeps the proposer as author
   * (server-derived from the proposal row), stamps the admin as reviewer, parents at the proposal;
   * the proposal itself becomes {@code superseded}.
   */
  @Transactional
  public RevisionDetail approve(long revisionId, CurrentUser admin) {
    StudyRevisionRecord proposal = requireRevision(revisionId);
    requireState(proposal, "proposed");
    String key = proposal.sectionKey();
    Instant now = clock.now();
    revisions.markCurrentPublishedSuperseded(key);
    long id =
        revisions.insert(
            new StudyRevisionRecord(
                null,
                key,
                proposal.contentJson(),
                proposal.authorId(), // author = original proposer
                now,
                proposal.changeSummary(),
                "published",
                "approve",
                proposal.id(), // parent = approved proposal
                admin.id(), // reviewer = approving admin
                now,
                null));
    revisions.setStatus(proposal.id(), "superseded");
    sections.updateCurrent(key, id, now, admin.id());
    return toDetail(requireRevision(id));
  }

  /** admin → reject a proposal: same row flows to {@code rejected} with note + reviewer. */
  @Transactional
  public RejectResponse reject(long revisionId, CurrentUser admin, String note) {
    StudyRevisionRecord proposal = requireRevision(revisionId);
    requireState(proposal, "proposed");
    revisions.reject(proposal.id(), admin.id(), clock.now(), note);
    return new RejectResponse(1);
  }

  /**
   * admin → revert to a target. New {@code published/revert} copies the target's content and
   * parents at it; the target and any intermediate versions are NEVER deleted (full audit chain).
   */
  @Transactional
  public RevisionDetail revert(String key, CurrentUser admin, long targetRevisionId) {
    StudySectionShape.forKey(key);
    StudyRevisionRecord target = requireRevision(targetRevisionId);
    if (!target.sectionKey().equals(key)) {
      throw new ResponseStatusException(HttpStatus.CONFLICT, "回滚目标不属于该节");
    }
    if (!"published".equals(target.status()) && !"superseded".equals(target.status())) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT, "只能回滚到已发布或已归档的版本");
    }
    ensureSection(key);
    Instant now = clock.now();
    revisions.markCurrentPublishedSuperseded(key);
    long id =
        revisions.insert(
            new StudyRevisionRecord(
                null,
                key,
                target.contentJson(), // append-only: copy the snapshot text
                admin.id(),
                now,
                "回滚到版本 #" + target.id(),
                "published",
                "revert",
                target.id(), // parent = restored target
                null,
                null,
                null));
    sections.updateCurrent(key, id, now, admin.id());
    return toDetail(requireRevision(id));
  }

  // ----- helpers -----------------------------------------------------------

  /**
   * Validates and serializes an incoming {@code content_json} for storage: ②③ structure (shape) and
   * ④ 64KB size limit. ① JSON parsability is enforced by Jackson during request binding (malformed
   * bodies surface as 400 via {@link StudyExceptionHandler}).
   */
  private String validateAndStore(String key, JsonNode content) {
    StudySectionShape shape = StudySectionShape.forKey(key);
    shape.validateStructure(content);
    int bytes;
    try {
      bytes = mapper.writeValueAsBytes(content).length;
    } catch (JsonProcessingException error) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content_json 序列化失败");
    }
    if (bytes > MAX_CONTENT_BYTES) {
      throw new ResponseStatusException(
          HttpStatus.BAD_REQUEST, "content_json 超过 " + (MAX_CONTENT_BYTES / 1024) + "KB 上限");
    }
    try {
      return mapper.writeValueAsString(content);
    } catch (JsonProcessingException error) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "content_json 序列化失败");
    }
  }

  /** Ensures the section row exists (seeds it on first touch); returns the row. */
  private StudySectionRecord ensureSection(String key) {
    return sections
        .findById(key)
        .orElseGet(
            () -> {
              sections.insert(key, clock.now());
              return sections.findById(key).orElseThrow();
            });
  }

  private StudyRevisionRecord requireRevision(long id) {
    return revisions
        .findById(id)
        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "修订不存在"));
  }

  private void requireState(StudyRevisionRecord revision, String expected) {
    if (!expected.equals(revision.status())) {
      throw new ResponseStatusException(
          HttpStatus.CONFLICT,
          "修订状态为 " + revision.status() + "，无法执行该操作（需为 " + expected + "）");
    }
  }

  private SectionLive loadLive(StudySectionRecord section) {
    StudyRevisionRecord revision = requireRevision(section.currentRevisionId());
    return new SectionLive(
        section.sectionKey(),
        parseJson(revision.contentJson()),
        section.updatedAt(),
        section.updatedBy());
  }

  private RevisionDetail toDetail(StudyRevisionRecord record) {
    return new RevisionDetail(
        record.id(),
        record.sectionKey(),
        record.action(),
        record.status(),
        username(record.authorId()),
        record.createdAt(),
        record.changeSummary(),
        username(record.reviewerId()),
        record.reviewedAt(),
        record.reviewNote(),
        record.parentRevisionId(),
        parseJson(record.contentJson()));
  }

  private String username(Long userId) {
    if (userId == null) {
      return null;
    }
    return users.findById(userId).map(UserRecord::username).orElse(null);
  }

  private JsonNode parseJson(String text) {
    try {
      return mapper.readTree(text);
    } catch (JsonProcessingException error) {
      throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "存储内容解析失败");
    }
  }

  private static RevisionSummary toSummary(RevisionSummaryRow row) {
    return new RevisionSummary(
        row.id(),
        row.sectionKey(),
        row.action(),
        row.status(),
        row.authorUsername(),
        row.createdAt(),
        row.changeSummary(),
        row.reviewerUsername(),
        row.reviewedAt(),
        row.reviewNote(),
        row.parentRevisionId());
  }

  private static int clampLimit(Integer requested) {
    if (requested == null || requested <= 0) {
      return DEFAULT_LIMIT;
    }
    return Math.min(requested, MAX_LIMIT);
  }

  private static int clampOffset(Integer requested) {
    if (requested == null || requested < 0) {
      return 0;
    }
    return requested;
  }
}
