package com.zhikao.backend.study;

import com.zhikao.backend.security.CurrentUser;
import com.zhikao.backend.study.StudyDtos.EditRequest;
import com.zhikao.backend.study.StudyDtos.ProposeRequest;
import com.zhikao.backend.study.StudyDtos.ProposalsResponse;
import com.zhikao.backend.study.StudyDtos.RejectRequest;
import com.zhikao.backend.study.StudyDtos.RejectResponse;
import com.zhikao.backend.study.StudyDtos.RevertRequest;
import com.zhikao.backend.study.StudyDtos.RevisionDetail;
import com.zhikao.backend.study.StudyDtos.RevisionSummary;
import com.zhikao.backend.study.StudyDtos.RevisionsResponse;
import com.zhikao.backend.study.StudyDtos.SectionLive;
import com.zhikao.backend.study.StudyDtos.SectionsResponse;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * {@code /api/v1/study} — versioned study content. Reads and {@code propose} require only an
 * authenticated user; edit / approve / reject / revert / proposals require {@code ROLE_ADMIN} via
 * {@code @PreAuthorize} (child-2 RBAC). {@code author_id} is never read from the body — the service
 * always derives it from the authenticated principal.
 */
@RestController
@RequestMapping("/api/v1/study")
public class StudyController {
  private final StudyService studyService;

  public StudyController(StudyService studyService) {
    this.studyService = studyService;
  }

  // ----- reads (login) -----------------------------------------------------

  @GetMapping("/sections")
  public SectionsResponse sections() {
    return studyService.getSections();
  }

  @GetMapping("/sections/{key}")
  public SectionLive section(@PathVariable String key) {
    return studyService.getSection(key);
  }

  @GetMapping("/sections/{key}/revisions")
  public RevisionsResponse revisions(
      @PathVariable String key,
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer offset) {
    return studyService.getRevisions(key, limit, offset);
  }

  @GetMapping("/revisions/{id}")
  public RevisionDetail revision(@PathVariable long id) {
    return studyService.getRevision(id);
  }

  // ----- writes (login) ----------------------------------------------------

  @PostMapping("/sections/{key}/propose")
  public RevisionSummary propose(
      Authentication authentication,
      @PathVariable String key,
      @Valid @RequestBody ProposeRequest request) {
    return studyService.propose(key, currentUser(authentication), request);
  }

  // ----- writes (admin) ----------------------------------------------------

  @PostMapping("/sections/{key}/edit")
  @PreAuthorize("hasRole('ADMIN')")
  public RevisionDetail edit(
      Authentication authentication,
      @PathVariable String key,
      @Valid @RequestBody EditRequest request) {
    return studyService.edit(key, currentUser(authentication), request);
  }

  @PostMapping("/revisions/{id}/approve")
  @PreAuthorize("hasRole('ADMIN')")
  public RevisionDetail approve(Authentication authentication, @PathVariable long id) {
    return studyService.approve(id, currentUser(authentication));
  }

  @PostMapping("/revisions/{id}/reject")
  @PreAuthorize("hasRole('ADMIN')")
  public RejectResponse reject(
      Authentication authentication,
      @PathVariable long id,
      @RequestBody(required = false) RejectRequest request) {
    String note = request == null ? null : request.reviewNote();
    return studyService.reject(id, currentUser(authentication), note);
  }

  @PostMapping("/sections/{key}/revert")
  @PreAuthorize("hasRole('ADMIN')")
  public RevisionDetail revert(
      Authentication authentication,
      @PathVariable String key,
      @Valid @RequestBody RevertRequest request) {
    return studyService.revert(key, currentUser(authentication), request.targetRevisionId());
  }

  @GetMapping("/proposals")
  @PreAuthorize("hasRole('ADMIN')")
  public ProposalsResponse proposals(
      @RequestParam(required = false) Integer limit,
      @RequestParam(required = false) Integer offset) {
    return studyService.getProposals(limit, offset);
  }

  private static CurrentUser currentUser(Authentication authentication) {
    return (CurrentUser) authentication.getPrincipal();
  }
}
